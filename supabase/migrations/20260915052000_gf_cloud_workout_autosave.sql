alter table private.gf_workout_sessions
  alter column completed_at drop not null;

alter table private.gf_workout_sessions
  add column if not exists updated_at timestamptz not null default now();

alter table private.gf_workout_sets
  add column if not exists completed boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists gf_workout_sessions_one_active_idx
  on private.gf_workout_sessions(user_id, routine_id)
  where completed_at is null;

create or replace function public.gf_open_workout_session(
  p_routine_id uuid,
  p_started_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_person_id text;
  v_routine_title text;
  v_allowed boolean := false;
  v_session_id uuid;
  v_started_at timestamptz;
  v_updated_at timestamptz;
  v_created boolean := false;
  v_sets jsonb;
begin
  if v_user_id is null then raise exception 'Sesión no autenticada.'; end if;
  select role into v_role from public.gf_profiles where user_id = v_user_id;
  if v_role is distinct from 'cliente' then raise exception 'Disponible exclusivamente para cuentas Cliente.'; end if;

  select person_id into v_person_id
  from public.gf_account_links
  where user_id = v_user_id and link_kind = 'cliente'
  limit 1;

  select r.title,
    (
      (r.source_type = 'client' and r.owner_user_id = v_user_id)
      or
      (r.source_type = 'professor' and (
        exists(select 1 from private.gf_routine_assignments a where a.routine_id = r.id and a.client_user_id = v_user_id)
        or (v_person_id is not null and exists(select 1 from private.gf_routine_person_assignments a where a.routine_id = r.id and a.person_id = v_person_id))
      ))
    )
  into v_routine_title, v_allowed
  from private.gf_routines r
  where r.id = p_routine_id;

  if v_routine_title is null or not coalesce(v_allowed, false) then
    raise exception 'La rutina no está disponible para esta cuenta.';
  end if;
  if p_started_at is null or p_started_at > now() + interval '5 minutes' then
    raise exception 'Fecha de inicio inválida.';
  end if;

  select s.id, s.started_at, s.updated_at
  into v_session_id, v_started_at, v_updated_at
  from private.gf_workout_sessions s
  where s.user_id = v_user_id
    and s.routine_id = p_routine_id
    and s.completed_at is null
  order by s.created_at desc
  limit 1;

  if v_session_id is null then
    insert into private.gf_workout_sessions(
      user_id, person_id, routine_id, routine_title, started_at, completed_at, updated_at
    )
    values (
      v_user_id, v_person_id, p_routine_id, left(v_routine_title, 200), p_started_at, null, now()
    )
    on conflict (user_id, routine_id) where completed_at is null do nothing
    returning id, started_at, updated_at into v_session_id, v_started_at, v_updated_at;

    if v_session_id is not null then
      v_created := true;
    else
      select s.id, s.started_at, s.updated_at
      into v_session_id, v_started_at, v_updated_at
      from private.gf_workout_sessions s
      where s.user_id = v_user_id
        and s.routine_id = p_routine_id
        and s.completed_at is null
      order by s.created_at desc
      limit 1;
    end if;
  end if;

  if v_session_id is null then raise exception 'No se pudo abrir el entrenamiento.'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'exerciseKey', ws.exercise_key,
    'exerciseId', ws.exercise_id,
    'exerciseName', ws.exercise_name,
    'setNumber', ws.set_number,
    'reps', ws.reps,
    'weightKg', ws.weight_kg,
    'rir', ws.rir,
    'completed', ws.completed
  ) order by ws.exercise_name, ws.set_number), '[]'::jsonb)
  into v_sets
  from private.gf_workout_sets ws
  where ws.session_id = v_session_id;

  return jsonb_build_object(
    'sessionId', v_session_id,
    'startedAt', v_started_at,
    'updatedAt', v_updated_at,
    'resumed', not v_created,
    'sets', coalesce(v_sets, '[]'::jsonb)
  );
end;
$function$;

create or replace function public.gf_save_workout_progress(
  p_session_id uuid,
  p_sets jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_session private.gf_workout_sessions%rowtype;
  v_set jsonb;
  v_key text;
  v_exercise_id text;
  v_name text;
  v_set_number integer;
  v_reps integer;
  v_weight numeric(8,2);
  v_rir integer;
  v_completed boolean;
  v_updated_at timestamptz := now();
begin
  if v_user_id is null then raise exception 'Sesión no autenticada.'; end if;
  select role into v_role from public.gf_profiles where user_id = v_user_id;
  if v_role is distinct from 'cliente' then raise exception 'Disponible exclusivamente para cuentas Cliente.'; end if;

  select * into v_session
  from private.gf_workout_sessions
  where id = p_session_id and user_id = v_user_id
  for update;

  if not found then raise exception 'Entrenamiento no encontrado.'; end if;
  if v_session.completed_at is not null then raise exception 'El entrenamiento ya fue finalizado.'; end if;
  if jsonb_typeof(coalesce(p_sets, '[]'::jsonb)) <> 'array' then raise exception 'Las series deben enviarse como una lista.'; end if;
  if jsonb_array_length(coalesce(p_sets, '[]'::jsonb)) > 200 then raise exception 'Demasiadas series en una sola sesión.'; end if;

  delete from private.gf_workout_sets where session_id = p_session_id;

  for v_set in select value from jsonb_array_elements(coalesce(p_sets, '[]'::jsonb)) loop
    v_key := left(trim(coalesce(v_set->>'exerciseKey', '')), 160);
    v_exercise_id := nullif(left(trim(coalesce(v_set->>'exerciseId', '')), 100), '');
    v_name := left(trim(coalesce(v_set->>'exerciseName', '')), 200);
    v_set_number := nullif(v_set->>'setNumber', '')::integer;
    v_reps := coalesce(nullif(v_set->>'reps', '')::integer, 0);
    v_weight := coalesce(nullif(replace(v_set->>'weightKg', ',', '.'), '')::numeric, 0);
    v_rir := nullif(v_set->>'rir', '')::integer;
    v_completed := coalesce((v_set->>'completed')::boolean, false);

    if v_key = '' or v_name = '' then raise exception 'Cada serie debe indicar el ejercicio.'; end if;
    if v_set_number is null or v_set_number not between 1 and 30 then raise exception 'Número de serie inválido.'; end if;
    if v_reps not between 0 and 1000 then raise exception 'Cantidad de repeticiones inválida.'; end if;
    if v_weight < 0 or v_weight > 2000 then raise exception 'Peso inválido.'; end if;
    if v_rir is not null and v_rir not between 0 and 10 then raise exception 'RIR inválido.'; end if;
    if v_completed and v_reps <= 0 then raise exception 'Una serie completada debe tener repeticiones.'; end if;

    insert into private.gf_workout_sets(
      session_id, exercise_key, exercise_id, exercise_name, set_number, reps, weight_kg, rir, completed, updated_at
    ) values (
      p_session_id, v_key, v_exercise_id, v_name, v_set_number, v_reps, v_weight, v_rir, v_completed, v_updated_at
    );
  end loop;

  update private.gf_workout_sessions
  set updated_at = v_updated_at
  where id = p_session_id;

  return jsonb_build_object(
    'sessionId', p_session_id,
    'updatedAt', v_updated_at,
    'savedSets', jsonb_array_length(coalesce(p_sets, '[]'::jsonb))
  );
end;
$function$;

create or replace function public.gf_reset_workout_session(
  p_session_id uuid,
  p_started_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_session private.gf_workout_sessions%rowtype;
  v_started_at timestamptz := coalesce(p_started_at, now());
  v_updated_at timestamptz := now();
begin
  if v_user_id is null then raise exception 'Sesión no autenticada.'; end if;
  select role into v_role from public.gf_profiles where user_id = v_user_id;
  if v_role is distinct from 'cliente' then raise exception 'Disponible exclusivamente para cuentas Cliente.'; end if;

  select * into v_session
  from private.gf_workout_sessions
  where id = p_session_id and user_id = v_user_id
  for update;

  if not found then raise exception 'Entrenamiento no encontrado.'; end if;
  if v_session.completed_at is not null then raise exception 'El entrenamiento ya fue finalizado.'; end if;
  if v_started_at > now() + interval '5 minutes' then raise exception 'Fecha de inicio inválida.'; end if;

  delete from private.gf_workout_sets where session_id = p_session_id;
  update private.gf_workout_sessions
  set started_at = v_started_at,
      duration_seconds = 0,
      completed_sets = 0,
      total_volume_kg = 0,
      updated_at = v_updated_at
  where id = p_session_id;

  return jsonb_build_object(
    'sessionId', p_session_id,
    'startedAt', v_started_at,
    'updatedAt', v_updated_at
  );
end;
$function$;

create or replace function public.gf_finish_workout_session(
  p_session_id uuid,
  p_completed_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_session private.gf_workout_sessions%rowtype;
  v_completed_at timestamptz := coalesce(p_completed_at, now());
  v_duration integer;
  v_completed_sets integer;
  v_total_volume numeric(12,2);
begin
  if v_user_id is null then raise exception 'Sesión no autenticada.'; end if;
  select role into v_role from public.gf_profiles where user_id = v_user_id;
  if v_role is distinct from 'cliente' then raise exception 'Disponible exclusivamente para cuentas Cliente.'; end if;

  select * into v_session
  from private.gf_workout_sessions
  where id = p_session_id and user_id = v_user_id
  for update;

  if not found then raise exception 'Entrenamiento no encontrado.'; end if;
  if v_session.completed_at is not null then raise exception 'El entrenamiento ya fue finalizado.'; end if;
  if v_completed_at < v_session.started_at or v_completed_at > now() + interval '5 minutes' then raise exception 'Fecha de finalización inválida.'; end if;

  v_duration := floor(extract(epoch from (v_completed_at - v_session.started_at)))::integer;
  if v_duration < 0 or v_duration > 43200 then raise exception 'La duración del entrenamiento no es válida.'; end if;

  select count(*)::integer, coalesce(round(sum((reps::numeric) * weight_kg), 2), 0)
  into v_completed_sets, v_total_volume
  from private.gf_workout_sets
  where session_id = p_session_id and completed is true;

  if v_completed_sets = 0 then raise exception 'Marcá al menos una serie antes de finalizar.'; end if;

  update private.gf_workout_sessions
  set completed_at = v_completed_at,
      duration_seconds = v_duration,
      completed_sets = v_completed_sets,
      total_volume_kg = v_total_volume,
      updated_at = now()
  where id = p_session_id;

  return jsonb_build_object(
    'sessionId', p_session_id,
    'durationSeconds', v_duration,
    'completedSets', v_completed_sets,
    'totalVolumeKg', v_total_volume,
    'completedAt', v_completed_at
  );
end;
$function$;

create or replace function public.gf_get_workout_history(
  p_routine_id uuid,
  p_limit integer default 8
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_person_id text;
  v_allowed boolean := false;
  v_limit integer := least(greatest(coalesce(p_limit, 8), 1), 20);
  v_result jsonb;
begin
  if v_user_id is null then raise exception 'Sesión no autenticada.'; end if;
  select role into v_role from public.gf_profiles where user_id = v_user_id;
  if v_role is distinct from 'cliente' then raise exception 'Disponible exclusivamente para cuentas Cliente.'; end if;

  select person_id into v_person_id
  from public.gf_account_links
  where user_id = v_user_id and link_kind = 'cliente'
  limit 1;

  select (
    (r.source_type = 'client' and r.owner_user_id = v_user_id)
    or
    (r.source_type = 'professor' and (
      exists(select 1 from private.gf_routine_assignments a where a.routine_id = r.id and a.client_user_id = v_user_id)
      or (v_person_id is not null and exists(select 1 from private.gf_routine_person_assignments a where a.routine_id = r.id and a.person_id = v_person_id))
    ))
  ) into v_allowed
  from private.gf_routines r
  where r.id = p_routine_id;

  if not coalesce(v_allowed, false) then raise exception 'La rutina no está disponible para esta cuenta.'; end if;

  with all_sessions as (
    select s.*
    from private.gf_workout_sessions s
    where s.user_id = v_user_id
      and s.routine_id = p_routine_id
      and s.completed_at is not null
  ), recent_sessions as (
    select * from all_sessions order by completed_at desc limit v_limit
  ), latest_exercise_session as (
    select distinct on (ws.exercise_key)
      ws.exercise_key, ws.exercise_name, ws.session_id, s.completed_at
    from private.gf_workout_sets ws
    join all_sessions s on s.id = ws.session_id
    where ws.completed is true
    order by ws.exercise_key, s.completed_at desc
  )
  select jsonb_build_object(
    'recent', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'startedAt', s.started_at,
        'completedAt', s.completed_at,
        'durationSeconds', s.duration_seconds,
        'completedSets', s.completed_sets,
        'totalVolumeKg', s.total_volume_kg,
        'sets', coalesce((
          select jsonb_agg(jsonb_build_object(
            'exerciseKey', ws.exercise_key,
            'exerciseId', ws.exercise_id,
            'exerciseName', ws.exercise_name,
            'setNumber', ws.set_number,
            'reps', ws.reps,
            'weightKg', ws.weight_kg,
            'rir', ws.rir
          ) order by ws.exercise_name, ws.set_number)
          from private.gf_workout_sets ws
          where ws.session_id = s.id and ws.completed is true
        ), '[]'::jsonb)
      ) order by s.completed_at desc)
      from recent_sessions s
    ), '[]'::jsonb),
    'lastByExercise', coalesce((
      select jsonb_object_agg(latest.exercise_key, coalesce((
        select jsonb_agg(jsonb_build_object(
          'setNumber', ws.set_number,
          'reps', ws.reps,
          'weightKg', ws.weight_kg,
          'rir', ws.rir,
          'completedAt', latest.completed_at
        ) order by ws.set_number)
        from private.gf_workout_sets ws
        where ws.session_id = latest.session_id
          and ws.exercise_key = latest.exercise_key
          and ws.completed is true
      ), '[]'::jsonb))
      from latest_exercise_session latest
    ), '{}'::jsonb)
  ) into v_result;

  return v_result;
end;
$function$;

revoke all on function public.gf_open_workout_session(uuid, timestamptz) from public, anon;
revoke all on function public.gf_save_workout_progress(uuid, jsonb) from public, anon;
revoke all on function public.gf_reset_workout_session(uuid, timestamptz) from public, anon;
revoke all on function public.gf_finish_workout_session(uuid, timestamptz) from public, anon;

grant execute on function public.gf_open_workout_session(uuid, timestamptz) to authenticated;
grant execute on function public.gf_save_workout_progress(uuid, jsonb) to authenticated;
grant execute on function public.gf_reset_workout_session(uuid, timestamptz) to authenticated;
grant execute on function public.gf_finish_workout_session(uuid, timestamptz) to authenticated;

comment on function public.gf_open_workout_session(uuid, timestamptz) is 'Abre o reanuda una sesión activa de entrenamiento guardada en Supabase.';
comment on function public.gf_save_workout_progress(uuid, jsonb) is 'Guarda en Supabase el estado completo de series de una sesión activa.';
comment on function public.gf_reset_workout_session(uuid, timestamptz) is 'Reinicia en la nube una sesión activa del Cliente autenticado.';
comment on function public.gf_finish_workout_session(uuid, timestamptz) is 'Finaliza una sesión activa y calcula su resumen desde las series persistidas.';
