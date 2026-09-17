-- V.1.09.0 · plan semanal, progreso por ejercicio y seguimiento del profesor

alter table private.gf_routines
  add column if not exists schedule_days smallint[] not null default '{}'::smallint[];

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'private.gf_routines'::regclass
      and conname = 'gf_routines_schedule_days_check'
  ) then
    alter table private.gf_routines
      add constraint gf_routines_schedule_days_check
      check (schedule_days <@ array[1,2,3,4,5,6,7]::smallint[]);
  end if;
end $$;

create or replace function private.gf_routine_json(p_routine_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'private', 'public'
as $function$
  select jsonb_build_object(
    'id', r.id,
    'title', r.title,
    'description', r.description,
    'sourceType', r.source_type,
    'ownerUserId', r.owner_user_id,
    'createdBy', r.created_by,
    'createdAt', r.created_at,
    'updatedAt', r.updated_at,
    'scheduleDays', to_jsonb(coalesce(r.schedule_days, '{}'::smallint[])),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id,
        'exercise_id', i.exercise_id,
        'exercise_name', i.exercise_name,
        'position', i.position,
        'sets', i.sets,
        'reps', i.reps,
        'rest_seconds', i.rest_seconds,
        'notes', i.notes
      ) order by i.position)
      from private.gf_routine_items i
      where i.routine_id = r.id
    ), '[]'::jsonb)
  )
  from private.gf_routines r
  where r.id = p_routine_id;
$function$;

create or replace function public.gf_save_my_routine_v2(
  p_routine_id uuid,
  p_title text,
  p_description text,
  p_items jsonb,
  p_schedule_days integer[] default '{}'::integer[]
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_role text;
  v_id uuid;
  v_days smallint[];
begin
  select role into v_role from public.gf_profiles where user_id = auth.uid();
  if v_role is distinct from 'cliente' then raise exception 'Disponible exclusivamente para cuentas Cliente.'; end if;
  if not public.gf_client_has_platform_access() then raise exception 'Necesitás una mensualidad vigente para usar la plataforma.'; end if;
  if char_length(trim(coalesce(p_title, ''))) < 2 then raise exception 'Ingresá un nombre para la rutina.'; end if;

  select coalesce(array_agg(d::smallint order by d), '{}'::smallint[])
  into v_days
  from (
    select distinct value as d
    from unnest(coalesce(p_schedule_days, '{}'::integer[])) value
    where value between 1 and 7
  ) days;

  if p_routine_id is null then
    if (select count(*) from private.gf_routines where source_type='client' and owner_user_id=auth.uid()) >= 3 then
      raise exception 'Podés crear hasta 3 rutinas personales.';
    end if;
    insert into private.gf_routines(title,description,source_type,owner_user_id,created_by,schedule_days)
    values(trim(p_title),coalesce(p_description,''),'client',auth.uid(),auth.uid(),v_days)
    returning id into v_id;
  else
    select id into v_id
    from private.gf_routines
    where id=p_routine_id and source_type='client' and owner_user_id=auth.uid();
    if v_id is null then raise exception 'La rutina personal no existe.'; end if;
    update private.gf_routines
    set title=trim(p_title), description=coalesce(p_description,''), schedule_days=v_days, updated_at=now()
    where id=v_id;
  end if;

  perform private.gf_replace_routine_items(v_id,p_items);
  update private.gf_routines set updated_at=now() where id=v_id;
  return private.gf_routine_json(v_id);
end;
$function$;

revoke all on function public.gf_save_my_routine_v2(uuid,text,text,jsonb,integer[]) from public, anon;
grant execute on function public.gf_save_my_routine_v2(uuid,text,text,jsonb,integer[]) to authenticated;

create or replace function public.gf_save_professor_routine_v2(
  p_routine_id uuid,
  p_title text,
  p_description text,
  p_items jsonb,
  p_schedule_days integer[] default '{}'::integer[]
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_role text;
  v_id uuid;
  v_creator uuid;
  v_days smallint[];
begin
  select role into v_role from public.gf_profiles where user_id = auth.uid();
  if v_role is null or v_role not in ('admin','coadmin','profe') then raise exception 'Sin permisos para administrar rutinas.'; end if;
  if char_length(trim(coalesce(p_title, ''))) < 2 then raise exception 'Ingresá un nombre para la rutina.'; end if;

  select coalesce(array_agg(d::smallint order by d), '{}'::smallint[])
  into v_days
  from (
    select distinct value as d
    from unnest(coalesce(p_schedule_days, '{}'::integer[])) value
    where value between 1 and 7
  ) days;

  if p_routine_id is null then
    insert into private.gf_routines(title,description,source_type,owner_user_id,created_by,schedule_days)
    values(trim(p_title),coalesce(p_description,''),'professor',null,auth.uid(),v_days)
    returning id into v_id;
  else
    select id,created_by into v_id,v_creator
    from private.gf_routines
    where id=p_routine_id and source_type='professor';
    if v_id is null then raise exception 'La rutina indicada no existe.'; end if;
    if v_role='profe' and v_creator is distinct from auth.uid() then raise exception 'Sólo podés editar rutinas creadas por vos.'; end if;
    update private.gf_routines
    set title=trim(p_title), description=coalesce(p_description,''), schedule_days=v_days, updated_at=now()
    where id=v_id;
  end if;

  perform private.gf_replace_routine_items(v_id,p_items);
  update private.gf_routines set updated_at=now() where id=v_id;
  return private.gf_routine_json(v_id);
end;
$function$;

revoke all on function public.gf_save_professor_routine_v2(uuid,text,text,jsonb,integer[]) from public, anon;
grant execute on function public.gf_save_professor_routine_v2(uuid,text,text,jsonb,integer[]) to authenticated;

create or replace function public.gf_get_exercise_performance(p_exercise_key text, p_limit integer default 12)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_key text := trim(coalesce(p_exercise_key, ''));
  v_limit integer := least(greatest(coalesce(p_limit,12),1),30);
  v_result jsonb;
begin
  if v_user_id is null then raise exception 'Sesión no autenticada.'; end if;
  select role into v_role from public.gf_profiles where user_id=v_user_id;
  if v_role is distinct from 'cliente' then raise exception 'Disponible exclusivamente para cuentas Cliente.'; end if;
  if not public.gf_client_has_platform_access() then raise exception 'Necesitás una mensualidad vigente para consultar tu progreso.'; end if;
  if v_key='' then raise exception 'Ejercicio inválido.'; end if;

  with session_stats as (
    select s.id,s.routine_title,s.completed_at,s.duration_seconds,
      count(*)::integer sets_count,
      max(ws.weight_kg) max_weight_kg,
      max(ws.reps)::integer max_reps,
      round(sum(ws.weight_kg*ws.reps),2) volume_kg,
      round(max(case when ws.weight_kg<=0 or ws.reps<=0 then 0 when ws.reps=1 then ws.weight_kg else ws.weight_kg*(1+ws.reps::numeric/30) end),2) e1rm
    from private.gf_workout_sessions s
    join private.gf_workout_sets ws on ws.session_id=s.id
    where s.user_id=v_user_id and s.completed_at is not null and ws.completed is true and ws.exercise_key=v_key
    group by s.id,s.routine_title,s.completed_at,s.duration_seconds
  ),
  recent as (select * from session_stats order by completed_at desc limit v_limit),
  latest as (select * from session_stats order by completed_at desc limit 1)
  select jsonb_build_object(
    'exerciseKey',v_key,
    'stats',jsonb_build_object(
      'sessions',(select count(*) from session_stats),
      'bestWeightKg',coalesce((select max(max_weight_kg) from session_stats),0),
      'bestReps',coalesce((select max(max_reps) from session_stats),0),
      'bestVolumeKg',coalesce((select max(volume_kg) from session_stats),0),
      'allTimeE1rm',coalesce((select max(e1rm) from session_stats),0),
      'currentE1rm',coalesce((select e1rm from latest),0)
    ),
    'trend',coalesce((
      select jsonb_agg(jsonb_build_object('sessionId',r.id,'date',r.completed_at,'e1rm',r.e1rm,'maxWeightKg',r.max_weight_kg,'maxReps',r.max_reps,'volumeKg',r.volume_kg) order by r.completed_at asc)
      from (select * from recent order by completed_at asc) r
    ),'[]'::jsonb),
    'recent',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',r.id,'routineTitle',r.routine_title,'completedAt',r.completed_at,'durationSeconds',r.duration_seconds,
        'e1rm',r.e1rm,'maxWeightKg',r.max_weight_kg,'volumeKg',r.volume_kg,
        'sets',coalesce((
          select jsonb_agg(jsonb_build_object('setNumber',ws.set_number,'reps',ws.reps,'weightKg',ws.weight_kg,'rir',ws.rir) order by ws.set_number)
          from private.gf_workout_sets ws
          where ws.session_id=r.id and ws.completed is true and ws.exercise_key=v_key
        ),'[]'::jsonb)
      ) order by r.completed_at desc)
      from recent r
    ),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$function$;

revoke all on function public.gf_get_exercise_performance(text,integer) from public, anon;
grant execute on function public.gf_get_exercise_performance(text,integer) to authenticated;

create or replace function public.gf_get_my_training_overview(p_limit integer default 12)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_limit integer := least(greatest(coalesce(p_limit,12),1),30);
  v_result jsonb;
begin
  if v_user_id is null then raise exception 'Sesión no autenticada.'; end if;
  select role into v_role from public.gf_profiles where user_id=v_user_id;
  if v_role is distinct from 'cliente' then raise exception 'Disponible exclusivamente para cuentas Cliente.'; end if;
  if not public.gf_client_has_platform_access() then raise exception 'Necesitás una mensualidad vigente para consultar tu progreso.'; end if;

  with completed as (
    select * from private.gf_workout_sessions where user_id=v_user_id and completed_at is not null
  ),
  recent as (select * from completed order by completed_at desc limit v_limit),
  last30 as (select * from completed where completed_at>=now()-interval '30 days')
  select jsonb_build_object(
    'last30',jsonb_build_object(
      'workouts',(select count(*) from last30),
      'trainingDays',(select count(distinct (completed_at at time zone 'America/Argentina/Buenos_Aires')::date) from last30),
      'sets',coalesce((select sum(completed_sets) from last30),0),
      'volumeKg',coalesce((select round(sum(total_volume_kg),2) from last30),0),
      'minutes',coalesce((select floor(sum(duration_seconds)/60.0)::integer from last30),0)
    ),
    'recent',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',r.id,'routineId',r.routine_id,'routineTitle',r.routine_title,'startedAt',r.started_at,'completedAt',r.completed_at,
        'durationSeconds',r.duration_seconds,'completedSets',r.completed_sets,'totalVolumeKg',r.total_volume_kg,
        'exercises',coalesce((select count(distinct ws.exercise_key) from private.gf_workout_sets ws where ws.session_id=r.id and ws.completed is true),0)
      ) order by r.completed_at desc)
      from recent r
    ),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$function$;

revoke all on function public.gf_get_my_training_overview(integer) from public, anon;
grant execute on function public.gf_get_my_training_overview(integer) to authenticated;

create or replace function public.gf_get_person_training_overview(p_person_id text,p_limit integer default 12)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_role text;
  v_limit integer := least(greatest(coalesce(p_limit,12),1),30);
  v_result jsonb;
begin
  select role into v_role from public.gf_profiles where user_id=auth.uid();
  if v_role is null or v_role not in ('admin','coadmin','profe') then raise exception 'Sin permisos para consultar entrenamientos.'; end if;
  if not exists(select 1 from private.gf_people p where p.id=p_person_id and p.role='Cliente' and not (p.payload ? 'archivedAt')) then raise exception 'Cliente inválido.'; end if;

  with completed as (
    select s.* from private.gf_workout_sessions s
    where s.completed_at is not null
      and (s.person_id=p_person_id or exists(select 1 from public.gf_account_links l where l.user_id=s.user_id and l.person_id=p_person_id and l.link_kind='cliente'))
  ),
  recent as (select * from completed order by completed_at desc limit v_limit),
  last30 as (select * from completed where completed_at>=now()-interval '30 days')
  select jsonb_build_object(
    'last30',jsonb_build_object(
      'workouts',(select count(*) from last30),
      'trainingDays',(select count(distinct (completed_at at time zone 'America/Argentina/Buenos_Aires')::date) from last30),
      'sets',coalesce((select sum(completed_sets) from last30),0),
      'volumeKg',coalesce((select round(sum(total_volume_kg),2) from last30),0),
      'minutes',coalesce((select floor(sum(duration_seconds)/60.0)::integer from last30),0)
    ),
    'recent',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',r.id,'routineId',r.routine_id,'routineTitle',r.routine_title,'startedAt',r.started_at,'completedAt',r.completed_at,
        'durationSeconds',r.duration_seconds,'completedSets',r.completed_sets,'totalVolumeKg',r.total_volume_kg,
        'sets',coalesce((
          select jsonb_agg(jsonb_build_object('exerciseKey',ws.exercise_key,'exerciseName',ws.exercise_name,'setNumber',ws.set_number,'reps',ws.reps,'weightKg',ws.weight_kg,'rir',ws.rir) order by ws.exercise_name,ws.set_number)
          from private.gf_workout_sets ws where ws.session_id=r.id and ws.completed is true
        ),'[]'::jsonb)
      ) order by r.completed_at desc)
      from recent r
    ),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$function$;

revoke all on function public.gf_get_person_training_overview(text,integer) from public, anon;
grant execute on function public.gf_get_person_training_overview(text,integer) to authenticated;

create or replace function public.gf_get_my_routines()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','private'
as $function$
declare
  v_role text;
  v_person_id text;
  v_personal jsonb;
  v_assigned jsonb;
begin
  select role into v_role from public.gf_profiles where user_id=auth.uid();
  if v_role is distinct from 'cliente' then raise exception 'Disponible exclusivamente para cuentas Cliente.'; end if;
  if not public.gf_client_has_platform_access() then raise exception 'Necesitás una mensualidad vigente para usar la plataforma.'; end if;
  select person_id into v_person_id from public.gf_account_links where user_id=auth.uid() and link_kind='cliente';

  select coalesce(jsonb_agg(private.gf_routine_json(r.id) order by r.updated_at desc),'[]'::jsonb)
  into v_personal from private.gf_routines r where r.source_type='client' and r.owner_user_id=auth.uid();

  select coalesce(jsonb_agg(private.gf_routine_json(r.id)||jsonb_build_object('assignedAt',assigned.assigned_at) order by assigned.assigned_at desc),'[]'::jsonb)
  into v_assigned
  from (
    select source.routine_id,max(source.created_at) assigned_at
    from (
      select a.routine_id,a.created_at from private.gf_routine_assignments a where a.client_user_id=auth.uid()
      union all
      select a.routine_id,a.created_at from private.gf_routine_person_assignments a where a.person_id=v_person_id
    ) source group by source.routine_id
  ) assigned
  join private.gf_routines r on r.id=assigned.routine_id and r.source_type='professor';

  return jsonb_build_object('personal',v_personal,'assigned',v_assigned);
end;
$function$;
