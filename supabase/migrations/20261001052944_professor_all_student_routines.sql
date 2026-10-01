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
        'canEdit', (routine.source_type = 'professor' and (v_role in ('admin','coadmin') or routine.created_by = auth.uid()))
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
      union all
      select personal.id, personal.updated_at
      from private.gf_routines personal
      join public.gf_account_links link on link.user_id=personal.owner_user_id and link.link_kind='cliente'
      where link.person_id=p_person_id and personal.source_type='client'
    ) assignment
    group by assignment.routine_id
  ) assigned
  join private.gf_routines routine
    on routine.id = assigned.routine_id;

  return v_result;
end;
$function$;

revoke all on function public.gf_get_person_routines_for_professor(text) from public, anon;
grant execute on function public.gf_get_person_routines_for_professor(text) to authenticated;
