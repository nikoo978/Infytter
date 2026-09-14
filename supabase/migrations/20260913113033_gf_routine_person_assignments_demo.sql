-- Infytter V.1.08.1 · asignaciones de rutinas por ficha de cliente.
-- Permite que Profesores trabajen con clientes del gimnasio aunque todavía no tengan cuenta Auth.

create table if not exists private.gf_routine_person_assignments (
  routine_id uuid not null references private.gf_routines(id) on delete cascade,
  person_id text not null references private.gf_people(id) on delete cascade,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (routine_id, person_id)
);

create index if not exists gf_routine_person_assignments_person_idx
  on private.gf_routine_person_assignments(person_id, created_at desc);

alter table private.gf_routine_person_assignments enable row level security;
revoke all on table private.gf_routine_person_assignments from public, anon, authenticated;

create or replace function public.gf_list_routine_people()
returns table(person_id text, user_id uuid, email text, display_name text, dni text, branch text, has_account boolean)
language plpgsql
stable
security definer
set search_path = public, private
as $$
begin
  if coalesce(public.gf_current_role(), '') not in ('admin','coadmin','profe') then
    raise exception 'Sin permisos para consultar alumnos.';
  end if;

  return query
  select
    person.id,
    link.user_id,
    coalesce(nullif(profile.email, ''), nullif(person.email, ''), ''),
    coalesce(nullif(person.name, ''), nullif(profile.display_name, ''), 'Cliente'),
    coalesce(person.dni, ''),
    coalesce(person.branch, ''),
    link.user_id is not null
  from private.gf_people person
  left join public.gf_account_links link
    on link.person_id = person.id and link.link_kind = 'cliente'
  left join public.gf_profiles profile on profile.user_id = link.user_id
  where person.role = 'Cliente'
    and not (coalesce(person.payload, '{}'::jsonb) ? 'archivedAt')
  order by person.name, person.dni;
end;
$$;

create or replace function public.gf_assign_professor_routine_people(p_routine_id uuid, p_person_ids text[])
returns integer
language plpgsql
security definer
set search_path = public, private
as $$
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
      select 1 from private.gf_people
      where id = v_person_id and role = 'Cliente'
        and not (coalesce(payload, '{}'::jsonb) ? 'archivedAt')
    ) then
      raise exception 'Una de las fichas seleccionadas no es un cliente activo.';
    end if;

    insert into private.gf_routine_person_assignments(routine_id, person_id, assigned_by)
    values (p_routine_id, v_person_id, auth.uid())
    on conflict (routine_id, person_id) do nothing;
    if found then v_added := v_added + 1; end if;
  end loop;

  return v_added;
end;
$$;

create or replace function public.gf_list_professor_routines()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare v_role text; v_result jsonb;
begin
  select role into v_role from public.gf_profiles where user_id = auth.uid();
  if v_role is null or v_role not in ('admin','coadmin','profe') then raise exception 'Sin permisos para administrar rutinas.'; end if;

  select coalesce(jsonb_agg(
    private.gf_routine_json(r.id) || jsonb_build_object(
      'assignedPersonIds', coalesce((
        select jsonb_agg(a.person_id order by a.created_at)
        from private.gf_routine_person_assignments a where a.routine_id = r.id
      ), '[]'::jsonb)
    ) order by r.updated_at desc
  ), '[]'::jsonb)
  into v_result
  from private.gf_routines r
  where r.source_type = 'professor'
    and (v_role in ('admin','coadmin') or r.created_by = auth.uid());
  return v_result;
end;
$$;

create or replace function public.gf_get_person_routines_for_professor(p_person_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare v_role text; v_result jsonb;
begin
  select role into v_role from public.gf_profiles where user_id = auth.uid();
  if v_role is null or v_role not in ('admin','coadmin','profe') then raise exception 'Sin permisos para consultar rutinas de alumnos.'; end if;
  if not exists(select 1 from private.gf_people where id = p_person_id and role = 'Cliente') then raise exception 'Cliente inválido.'; end if;

  select coalesce(jsonb_agg(
    private.gf_routine_json(r.id) || jsonb_build_object(
      'assignedAt', a.created_at,
      'canEdit', (v_role in ('admin','coadmin') or r.created_by = auth.uid())
    ) order by a.created_at desc
  ), '[]'::jsonb)
  into v_result
  from private.gf_routine_person_assignments a
  join private.gf_routines r on r.id = a.routine_id and r.source_type = 'professor'
  where a.person_id = p_person_id;
  return v_result;
end;
$$;

create or replace function public.gf_get_my_routines()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare v_role text; v_person_id text; v_personal jsonb; v_assigned jsonb;
begin
  select role into v_role from public.gf_profiles where user_id = auth.uid();
  if v_role is distinct from 'cliente' then raise exception 'Disponible exclusivamente para cuentas Cliente.'; end if;
  select person_id into v_person_id from public.gf_account_links where user_id = auth.uid() and link_kind = 'cliente';

  select coalesce(jsonb_agg(private.gf_routine_json(r.id) order by r.updated_at desc), '[]'::jsonb)
  into v_personal from private.gf_routines r
  where r.source_type = 'client' and r.owner_user_id = auth.uid();

  select coalesce(jsonb_agg(
    private.gf_routine_json(r.id) || jsonb_build_object('assignedAt', assigned.assigned_at)
    order by assigned.assigned_at desc
  ), '[]'::jsonb)
  into v_assigned
  from (
    select source.routine_id, max(source.created_at) as assigned_at
    from (
      select a.routine_id, a.created_at
      from private.gf_routine_assignments a where a.client_user_id = auth.uid()
      union all
      select a.routine_id, a.created_at
      from private.gf_routine_person_assignments a where a.person_id = v_person_id
    ) source
    group by source.routine_id
  ) assigned
  join private.gf_routines r on r.id = assigned.routine_id and r.source_type = 'professor';

  return jsonb_build_object('personal', v_personal, 'assigned', v_assigned);
end;
$$;

create or replace function public.gf_remove_assigned_routine(p_routine_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, private
as $$
declare v_person_id text; v_removed boolean := false;
begin
  if public.gf_current_role() is distinct from 'cliente' then raise exception 'Disponible exclusivamente para cuentas Cliente.'; end if;
  select person_id into v_person_id from public.gf_account_links where user_id = auth.uid() and link_kind = 'cliente';
  delete from private.gf_routine_assignments where routine_id = p_routine_id and client_user_id = auth.uid();
  v_removed := found;
  if v_person_id is not null then
    delete from private.gf_routine_person_assignments where routine_id = p_routine_id and person_id = v_person_id;
    v_removed := v_removed or found;
  end if;
  return v_removed;
end;
$$;

revoke all on function public.gf_list_routine_people() from public, anon;
revoke all on function public.gf_assign_professor_routine_people(uuid, text[]) from public, anon;
revoke all on function public.gf_get_person_routines_for_professor(text) from public, anon;
revoke all on function public.gf_list_professor_routines() from public, anon;
revoke all on function public.gf_get_my_routines() from public, anon;
revoke all on function public.gf_remove_assigned_routine(uuid) from public, anon;
grant execute on function public.gf_list_routine_people() to authenticated;
grant execute on function public.gf_assign_professor_routine_people(uuid, text[]) to authenticated;
grant execute on function public.gf_get_person_routines_for_professor(text) to authenticated;
grant execute on function public.gf_list_professor_routines() to authenticated;
grant execute on function public.gf_get_my_routines() to authenticated;
grant execute on function public.gf_remove_assigned_routine(uuid) to authenticated;
