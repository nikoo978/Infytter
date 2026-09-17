-- V.1.09.0 · la referencia "última vez" cruza todas las rutinas del cliente

create or replace function public.gf_get_workout_history(p_routine_id uuid,p_limit integer default 8)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_person_id text;
  v_allowed boolean := false;
  v_limit integer := least(greatest(coalesce(p_limit,8),1),20);
  v_result jsonb;
begin
  if v_user_id is null then raise exception 'Sesión no autenticada.'; end if;
  select role into v_role from public.gf_profiles where user_id=v_user_id;
  if v_role is distinct from 'cliente' then raise exception 'Disponible exclusivamente para cuentas Cliente.'; end if;
  if not public.gf_client_has_platform_access() then raise exception 'Necesitás una mensualidad vigente para consultar tu progreso.'; end if;

  select person_id into v_person_id from public.gf_account_links where user_id=v_user_id and link_kind='cliente' limit 1;

  select (
    (r.source_type='client' and r.owner_user_id=v_user_id)
    or
    (r.source_type='professor' and (
      exists(select 1 from private.gf_routine_assignments a where a.routine_id=r.id and a.client_user_id=v_user_id)
      or (v_person_id is not null and exists(select 1 from private.gf_routine_person_assignments a where a.routine_id=r.id and a.person_id=v_person_id))
    ))
  ) into v_allowed
  from private.gf_routines r where r.id=p_routine_id;

  if not coalesce(v_allowed,false) then raise exception 'La rutina no está disponible para esta cuenta.'; end if;

  with all_user_sessions as (
    select s.* from private.gf_workout_sessions s where s.user_id=v_user_id and s.completed_at is not null
  ),
  routine_sessions as (
    select * from all_user_sessions where routine_id=p_routine_id
  ),
  recent_sessions as (
    select * from routine_sessions order by completed_at desc limit v_limit
  ),
  latest_exercise_session as (
    select distinct on (ws.exercise_key) ws.exercise_key,ws.exercise_name,ws.session_id,s.completed_at
    from private.gf_workout_sets ws
    join all_user_sessions s on s.id=ws.session_id
    where ws.completed is true
    order by ws.exercise_key,s.completed_at desc
  )
  select jsonb_build_object(
    'recent',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',s.id,'startedAt',s.started_at,'completedAt',s.completed_at,'durationSeconds',s.duration_seconds,
        'completedSets',s.completed_sets,'totalVolumeKg',s.total_volume_kg,
        'sets',coalesce((
          select jsonb_agg(jsonb_build_object(
            'exerciseKey',ws.exercise_key,'exerciseId',ws.exercise_id,'exerciseName',ws.exercise_name,
            'setNumber',ws.set_number,'reps',ws.reps,'weightKg',ws.weight_kg,'rir',ws.rir
          ) order by ws.exercise_name,ws.set_number)
          from private.gf_workout_sets ws where ws.session_id=s.id and ws.completed is true
        ),'[]'::jsonb)
      ) order by s.completed_at desc)
      from recent_sessions s
    ),'[]'::jsonb),
    'lastByExercise',coalesce((
      select jsonb_object_agg(latest.exercise_key,coalesce((
        select jsonb_agg(jsonb_build_object(
          'setNumber',ws.set_number,'reps',ws.reps,'weightKg',ws.weight_kg,'rir',ws.rir,'completedAt',latest.completed_at
        ) order by ws.set_number)
        from private.gf_workout_sets ws
        where ws.session_id=latest.session_id and ws.exercise_key=latest.exercise_key and ws.completed is true
      ),'[]'::jsonb))
      from latest_exercise_session latest
    ),'{}'::jsonb)
  ) into v_result;

  return v_result;
end;
$function$;

revoke all on function public.gf_get_workout_history(uuid,integer) from public, anon;
grant execute on function public.gf_get_workout_history(uuid,integer) to authenticated;
