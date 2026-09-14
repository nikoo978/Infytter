-- Infytter V.1.08.1 · integra las fichas de clientes con la pantalla de Rutinas.

create or replace function public.gf_list_routine_clients()
returns table(user_id uuid, email text, display_name text, dni text, person_id text)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_role text;
begin
  select role into v_role from public.gf_profiles where user_id = auth.uid();
  if v_role is null or v_role not in ('admin','coadmin','profe') then
    raise exception 'Sin permisos para consultar alumnos.';
  end if;

  return query
  select
    case when profile.role = 'cliente' then link.user_id else null end as user_id,
    coalesce(nullif(profile.email, ''), nullif(person.email, ''), '') as email,
    coalesce(nullif(profile.display_name, ''), nullif(person.name, ''), 'Cliente') as display_name,
    coalesce(nullif(profile.dni, ''), nullif(person.dni, ''), '') as dni,
    person.id as person_id
  from private.gf_people person
  left join public.gf_account_links link
    on link.person_id = person.id and link.link_kind = 'cliente'
  left join public.gf_profiles profile
    on profile.user_id = link.user_id
  where person.role = 'Cliente'
    and not (person.payload ? 'archivedAt')
  order by coalesce(nullif(profile.display_name, ''), person.name), person.id;
end;
$function$;

revoke all on function public.gf_list_routine_clients() from public, anon;
grant execute on function public.gf_list_routine_clients() to authenticated;

create or replace function public.gf_assign_professor_routine_people(
  p_routine_id uuid,
  p_person_ids text[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_role text;
  v_creator uuid;
  v_person_id text;
  v_added integer := 0;
begin
  select role into v_role from public.gf_profiles where user_id = auth.uid();
  if v_role is null or v_role not in ('admin','coadmin','profe') then
    raise exception 'Sin permisos para asignar rutinas.';
  end if;

  select created_by into v_creator
  from private.gf_routines
  where id = p_routine_id and source_type = 'professor';
  if not found then raise exception 'La rutina indicada no existe.'; end if;
  if v_role = 'profe' and v_creator is distinct from auth.uid() then
    raise exception 'Sólo podés asignar rutinas creadas por vos.';
  end if;

  foreach v_person_id in array coalesce(p_person_ids, array[]::text[]) loop
    if not exists (
      select 1 from private.gf_people person
      where person.id = v_person_id
        and person.role = 'Cliente'
        and not (person.payload ? 'archivedAt')
    ) then
      raise exception 'Uno de los clientes seleccionados no tiene una ficha Cliente activa.';
    end if;

    insert into private.gf_routine_person_assignments(routine_id, person_id, assigned_by)
    values (p_routine_id, v_person_id, auth.uid())
    on conflict (routine_id, person_id) do nothing;
    if found then v_added := v_added + 1; end if;
  end loop;

  return v_added;
end;
$function$;

revoke all on function public.gf_assign_professor_routine_people(uuid, text[]) from public, anon;
grant execute on function public.gf_assign_professor_routine_people(uuid, text[]) to authenticated;

create or replace function public.gf_get_person_routines_for_professor(p_person_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_role text;
  v_result jsonb;
begin
  select role into v_role from public.gf_profiles where user_id = auth.uid();
  if v_role is null or v_role not in ('admin','coadmin','profe') then
    raise exception 'Sin permisos para consultar rutinas de alumnos.';
  end if;

  if not exists (
    select 1 from private.gf_people person
    where person.id = p_person_id
      and person.role = 'Cliente'
      and not (person.payload ? 'archivedAt')
  ) then
    raise exception 'Cliente inválido.';
  end if;

  select coalesce(jsonb_agg(
    private.gf_routine_json(routine.id)
      || jsonb_build_object(
        'assignedAt', assigned.assigned_at,
        'canEdit', (v_role in ('admin','coadmin') or routine.created_by = auth.uid())
      )
    order by assigned.assigned_at desc
  ), '[]'::jsonb)
  into v_result
  from (
    select assignment.routine_id, max(assignment.created_at) as assigned_at
    from (
      select person_assignment.routine_id, person_assignment.created_at
      from private.gf_routine_person_assignments person_assignment
      where person_assignment.person_id = p_person_id
      union all
      select account_assignment.routine_id, account_assignment.created_at
      from private.gf_routine_assignments account_assignment
      join public.gf_account_links link
        on link.user_id = account_assignment.client_user_id
       and link.link_kind = 'cliente'
      where link.person_id = p_person_id
    ) assignment
    group by assignment.routine_id
  ) assigned
  join private.gf_routines routine
    on routine.id = assigned.routine_id
   and routine.source_type = 'professor';

  return v_result;
end;
$function$;

revoke all on function public.gf_get_person_routines_for_professor(text) from public, anon;
grant execute on function public.gf_get_person_routines_for_professor(text) to authenticated;
