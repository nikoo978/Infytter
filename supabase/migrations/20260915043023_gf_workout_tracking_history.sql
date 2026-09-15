create table private.gf_workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  person_id text,
  routine_id uuid,
  routine_title text not null,
  started_at timestamptz not null,
  completed_at timestamptz not null,
  duration_seconds integer not null default 0 check (duration_seconds between 0 and 43200),
  completed_sets integer not null default 0 check (completed_sets between 0 and 200),
  total_volume_kg numeric(12,2) not null default 0 check (total_volume_kg >= 0),
  created_at timestamptz not null default now()
);

create index gf_workout_sessions_user_routine_completed_idx
  on private.gf_workout_sessions(user_id, routine_id, completed_at desc);
create index gf_workout_sessions_person_completed_idx
  on private.gf_workout_sessions(person_id, completed_at desc)
  where person_id is not null;

alter table private.gf_workout_sessions enable row level security;
revoke all on private.gf_workout_sessions from public, anon, authenticated;

create table private.gf_workout_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references private.gf_workout_sessions(id) on delete cascade,
  exercise_key text not null,
  exercise_id text,
  exercise_name text not null,
  set_number integer not null check (set_number between 1 and 30),
  reps integer not null check (reps between 0 and 1000),
  weight_kg numeric(8,2) not null default 0 check (weight_kg between 0 and 2000),
  rir integer check (rir between 0 and 10),
  created_at timestamptz not null default now(),
  unique(session_id, exercise_key, set_number)
);

create index gf_workout_sets_session_idx on private.gf_workout_sets(session_id, exercise_key, set_number);
alter table private.gf_workout_sets enable row level security;
revoke all on private.gf_workout_sets from public, anon, authenticated;

create or replace function public.gf_save_workout_session(
  p_routine_id uuid,
  p_started_at timestamptz,
  p_completed_at timestamptz,
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
  v_person_id text;
  v_routine_title text;
  v_allowed boolean := false;
  v_session_id uuid;
  v_duration integer;
  v_completed_sets integer := 0;
  v_total_volume numeric(12,2) := 0;
  v_set jsonb;
  v_key text;
  v_exercise_id text;
  v_name text;
  v_set_number integer;
  v_reps integer;
  v_weight numeric(8,2);
  v_rir integer;
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

  if v_routine_title is null or not coalesce(v_allowed, false) then raise exception 'La rutina no está disponible para esta cuenta.'; end if;
  if p_started_at is null or p_completed_at is null or p_completed_at < p_started_at then raise exception 'Fechas de entrenamiento inválidas.'; end if;
  if p_completed_at > now() + interval '5 minutes' then raise exception 'La fecha de finalización no puede estar en el futuro.'; end if;

  v_duration := floor(extract(epoch from (p_completed_at - p_started_at)))::integer;
  if v_duration < 0 or v_duration > 43200 then raise exception 'La duración del entrenamiento no es válida.'; end if;
  if jsonb_typeof(coalesce(p_sets, '[]'::jsonb)) <> 'array' then raise exception 'Las series deben enviarse como una lista.'; end if;
  if jsonb_array_length(coalesce(p_sets, '[]'::jsonb)) > 200 then raise exception 'Demasiadas series en una sola sesión.'; end if;

  insert into private.gf_workout_sessions(user_id, person_id, routine_id, routine_title, started_at, completed_at, duration_seconds)
  values (v_user_id, v_person_id, p_routine_id, left(v_routine_title, 200), p_started_at, p_completed_at, v_duration)
  returning id into v_session_id;

  for v_set in select value from jsonb_array_elements(coalesce(p_sets, '[]'::jsonb)) loop
    if coalesce((v_set->>'completed')::boolean, false) is not true then continue; end if;

    v_key := left(trim(coalesce(v_set->>'exerciseKey', '')), 160);
    v_exercise_id := nullif(left(trim(coalesce(v_set->>'exerciseId', '')), 100), '');
    v_name := left(trim(coalesce(v_set->>'exerciseName', '')), 200);
    v_set_number := nullif(v_set->>'setNumber', '')::integer;
    v_reps := nullif(v_set->>'reps', '')::integer;
    v_weight := coalesce(nullif(replace(v_set->>'weightKg', ',', '.'), '')::numeric, 0);
    v_rir := nullif(v_set->>'rir', '')::integer;

    if v_key = '' or v_name = '' then raise exception 'Cada serie debe indicar el ejercicio.'; end if;
    if v_set_number is null or v_set_number not between 1 and 30 then raise exception 'Número de serie inválido.'; end if;
    if v_reps is null or v_reps not between 0 and 1000 then raise exception 'Cantidad de repeticiones inválida.'; end if;
    if v_weight < 0 or v_weight > 2000 then raise exception 'Peso inválido.'; end if;
    if v_rir is not null and v_rir not between 0 and 10 then raise exception 'RIR inválido.'; end if;

    insert into private.gf_workout_sets(session_id, exercise_key, exercise_id, exercise_name, set_number, reps, weight_kg, rir)
    values (v_session_id, v_key, v_exercise_id, v_name, v_set_number, v_reps, v_weight, v_rir);

    v_completed_sets := v_completed_sets + 1;
    v_total_volume := v_total_volume + (v_reps * v_weight);
  end loop;

  if v_completed_sets = 0 then raise exception 'Marcá al menos una serie antes de finalizar.'; end if;

  update private.gf_workout_sessions
  set completed_sets = v_completed_sets, total_volume_kg = round(v_total_volume, 2)
  where id = v_session_id;

  return jsonb_build_object(
    'sessionId', v_session_id,
    'durationSeconds', v_duration,
    'completedSets', v_completed_sets,
    'totalVolumeKg', round(v_total_volume, 2)
  );
end;
$function$;

revoke all on function public.gf_save_workout_session(uuid, timestamptz, timestamptz, jsonb) from public, anon;
grant execute on function public.gf_save_workout_session(uuid, timestamptz, timestamptz, jsonb) to authenticated;

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
          from private.gf_workout_sets ws where ws.session_id = s.id
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
        where ws.session_id = latest.session_id and ws.exercise_key = latest.exercise_key
      ), '[]'::jsonb))
      from latest_exercise_session latest
    ), '{}'::jsonb)
  ) into v_result;

  return v_result;
end;
$function$;

revoke all on function public.gf_get_workout_history(uuid, integer) from public, anon;
grant execute on function public.gf_get_workout_history(uuid, integer) to authenticated;
