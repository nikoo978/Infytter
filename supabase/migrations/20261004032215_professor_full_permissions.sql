-- Granular permissions; existing functionality and grants are preserved.
alter table public.gf_profiles
  add column if not exists can_view_student_progress boolean not null default false,
  add column if not exists can_record_student_metrics boolean not null default false,
  add column if not exists can_delete_student_metrics boolean not null default false,
  add column if not exists can_view_student_routines boolean not null default false,
  add column if not exists can_view_routines boolean not null default true,
  add column if not exists can_create_routines boolean not null default false,
  add column if not exists can_edit_routines boolean not null default false,
  add column if not exists can_assign_routines boolean not null default false,
  add column if not exists can_view_exercises boolean not null default true,
  add column if not exists can_use_own_progress boolean not null default true;
update public.gf_profiles set
  can_view_student_progress = can_view_students,
  can_record_student_metrics = can_view_students,
  can_delete_student_metrics = can_view_students,
  can_view_student_routines = can_view_students,
  can_view_routines = true,
  can_create_routines = true,
  can_edit_routines = true,
  can_assign_routines = can_view_students,
  can_view_exercises = true,
  can_use_own_progress = true
where role='profe';
create or replace function public.gf_profile_access_permission_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.role <> 'profe' then
    new.can_view_students := false;
    new.can_view_student_progress := false;
    new.can_record_student_metrics := false;
    new.can_delete_student_metrics := false;
    new.can_view_student_routines := false;
    new.can_view_routines := false;
    new.can_create_routines := false;
    new.can_edit_routines := false;
    new.can_assign_routines := false;
    new.can_view_exercises := false;
    new.can_create_exercises := false;
    new.can_edit_exercises := false;
    new.can_delete_exercises := false;
    new.can_use_own_progress := false;
    new.can_grant_access := false;
  end if;
  return new;
end;
$$;
-- Remove the duplicate historical trigger, keeping the current one.
drop trigger if exists gf_profiles_access_permission_guard on public.gf_profiles;

create or replace function private.gf_professor_can(p_permission text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_profile public.gf_profiles; v_column text; v_required text;
begin
  select * into v_profile from public.gf_profiles where user_id=auth.uid();
  if v_profile.role in ('admin','coadmin') then return true; end if;
  if v_profile.role is distinct from 'profe' then return false; end if;
  v_column := case p_permission
    when 'canViewStudents' then 'can_view_students'
    when 'canViewStudentProgress' then 'can_view_student_progress'
    when 'canRecordStudentMetrics' then 'can_record_student_metrics'
    when 'canDeleteStudentMetrics' then 'can_delete_student_metrics'
    when 'canViewStudentRoutines' then 'can_view_student_routines'
    when 'canViewRoutines' then 'can_view_routines'
    when 'canCreateRoutines' then 'can_create_routines'
    when 'canEditRoutines' then 'can_edit_routines'
    when 'canAssignRoutines' then 'can_assign_routines'
    when 'canViewExercises' then 'can_view_exercises'
    when 'canCreateExercises' then 'can_create_exercises'
    when 'canEditExercises' then 'can_edit_exercises'
    when 'canDeleteExercises' then 'can_delete_exercises'
    when 'canUseOwnProgress' then 'can_use_own_progress'
    when 'canGrantAccess' then 'can_grant_access'
  end;
  if v_column is null or coalesce((to_jsonb(v_profile)->>v_column)::boolean,false) is not true then return false; end if;
  v_required := case p_permission
    when 'canViewStudentProgress' then 'canViewStudents'
    when 'canRecordStudentMetrics' then 'canViewStudentProgress'
    when 'canDeleteStudentMetrics' then 'canViewStudentProgress'
    when 'canViewStudentRoutines' then 'canViewStudents'
    when 'canCreateRoutines' then 'canViewRoutines'
    when 'canEditRoutines' then 'canViewRoutines'
    when 'canAssignRoutines' then 'canViewRoutines'
    when 'canCreateExercises' then 'canViewExercises'
    when 'canEditExercises' then 'canViewExercises'
    when 'canDeleteExercises' then 'canViewExercises'
  end;
  if v_required is not null and not private.gf_professor_can(v_required) then return false; end if;
  if p_permission in ('canCreateRoutines','canEditRoutines') and not v_profile.can_view_exercises then return false; end if;
  if p_permission='canAssignRoutines' and not v_profile.can_view_students then return false; end if;
  return true;
end;
$$;
revoke all on function private.gf_professor_can(text) from public,anon;
grant execute on function private.gf_professor_can(text) to authenticated;

create or replace function private.gf_require_professor_permission(p_permission text)
returns void language plpgsql stable security definer set search_path = '' as $$
declare v_role text;
begin
  select role into v_role from public.gf_profiles where user_id=auth.uid();
  if v_role is null then raise exception 'Sin sesión o perfil.'; end if;
  -- Other roles retain each RPC's existing ownership and role checks.
  if v_role='profe' and not private.gf_professor_can(p_permission) then
    raise exception 'El administrador no habilitó esta función (%).',p_permission;
  end if;
end;
$$;
revoke all on function private.gf_require_professor_permission(text) from public,anon;
grant execute on function private.gf_require_professor_permission(text) to authenticated;

create or replace function private.gf_set_professor_permission(p_user_id uuid,p_permission text,p_enabled boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor public.gf_profiles; v_column text;
begin
  select * into v_actor from public.gf_profiles where user_id=auth.uid();
  if v_actor.user_id is null or v_actor.role <> 'admin' or not v_actor.is_master then raise exception 'Sólo el Admin master puede administrar los permisos.'; end if;
  if not exists(select 1 from public.gf_profiles where user_id=p_user_id and role='profe') then raise exception 'La cuenta seleccionada no es Profesor.'; end if;
  v_column := case p_permission
    when 'canViewStudents' then 'can_view_students'
    when 'canViewStudentProgress' then 'can_view_student_progress'
    when 'canRecordStudentMetrics' then 'can_record_student_metrics'
    when 'canDeleteStudentMetrics' then 'can_delete_student_metrics'
    when 'canViewStudentRoutines' then 'can_view_student_routines'
    when 'canViewRoutines' then 'can_view_routines'
    when 'canCreateRoutines' then 'can_create_routines'
    when 'canEditRoutines' then 'can_edit_routines'
    when 'canAssignRoutines' then 'can_assign_routines'
    when 'canViewExercises' then 'can_view_exercises'
    when 'canCreateExercises' then 'can_create_exercises'
    when 'canEditExercises' then 'can_edit_exercises'
    when 'canDeleteExercises' then 'can_delete_exercises'
    when 'canUseOwnProgress' then 'can_use_own_progress'
    when 'canGrantAccess' then 'can_grant_access'
  end;
  if v_column is null then raise exception 'Permiso desconocido.'; end if;
  execute format('update public.gf_profiles set %I=$1 where user_id=$2',v_column) using coalesce(p_enabled,false),p_user_id;
  return jsonb_build_object('userId',p_user_id,p_permission,coalesce(p_enabled,false));
end;
$$;

create or replace function public.gf_set_professor_permissions(p_user_id uuid,p_permissions jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_entry record;
begin
  if jsonb_typeof(p_permissions) is distinct from 'object' or p_permissions='{}'::jsonb then raise exception 'Indicá los permisos a guardar.'; end if;
  for v_entry in select * from jsonb_each(p_permissions) loop
    if jsonb_typeof(v_entry.value) <> 'boolean' then raise exception 'El permiso debe ser verdadero o falso.'; end if;
    perform private.gf_set_professor_permission(p_user_id,v_entry.key,(v_entry.value::text)::boolean);
  end loop;
  return jsonb_build_object('userId',p_user_id,'permissions',p_permissions);
end;
$$;
revoke all on function public.gf_set_professor_permissions(uuid,jsonb) from public,anon;
grant execute on function public.gf_set_professor_permissions(uuid,jsonb) to authenticated;

create or replace function public.gf_list_professor_permissions()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor public.gf_profiles;
begin
  select * into v_actor from public.gf_profiles where user_id=auth.uid();
  if v_actor.user_id is null or v_actor.role <> 'admin' or not v_actor.is_master then raise exception 'Sólo el Admin master puede administrar los permisos.'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'userId',p.user_id,'name',p.display_name,'email',p.email,'linkedPersonId',l.person_id,
    'canViewStudents',p.can_view_students,
    'canViewStudentProgress',p.can_view_student_progress,
    'canRecordStudentMetrics',p.can_record_student_metrics,
    'canDeleteStudentMetrics',p.can_delete_student_metrics,
    'canViewStudentRoutines',p.can_view_student_routines,
    'canViewRoutines',p.can_view_routines,
    'canCreateRoutines',p.can_create_routines,
    'canEditRoutines',p.can_edit_routines,
    'canAssignRoutines',p.can_assign_routines,
    'canViewExercises',p.can_view_exercises,
    'canCreateExercises',p.can_create_exercises,
    'canEditExercises',p.can_edit_exercises,
    'canDeleteExercises',p.can_delete_exercises,
    'canUseOwnProgress',p.can_use_own_progress,
    'canGrantAccess',p.can_grant_access
  ) order by lower(p.display_name),lower(p.email)) from public.gf_profiles p
  left join public.gf_account_links l on l.user_id=p.user_id and l.link_kind='profe' where p.role='profe'),'[]'::jsonb);
end;
$$;

-- Guard current and legacy endpoints, preserving their ownership checks and bodies.
do $$
declare v_function record; v_definition text; v_key text; v_guard text;
begin
  for v_function in select p.oid,p.proname,l.lanname from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang where n.nspname='public' loop
    v_key := case v_function.proname
      when 'gf_list_professor_routines' then 'canViewRoutines'
      when 'gf_get_person_routines_for_professor' then 'canViewStudentRoutines'
      when 'gf_get_client_routines_for_professor' then 'canViewStudentRoutines'
      when 'gf_get_person_training_overview' then 'canViewStudentProgress'
      when 'gf_get_person_body_metrics' then 'canViewStudentProgress'
      when 'gf_save_person_body_metric' then 'canRecordStudentMetrics'
      when 'gf_delete_person_body_metric' then 'canDeleteStudentMetrics'
      when 'gf_assign_professor_routine_people' then 'canAssignRoutines'
      when 'gf_assign_professor_routine' then 'canAssignRoutines'
      when 'gf_get_my_body_metrics' then 'canUseOwnProgress'
      when 'gf_save_my_body_metric' then 'canUseOwnProgress'
      when 'gf_delete_my_body_metric' then 'canUseOwnProgress'
    end;
    if v_function.proname in ('gf_save_professor_routine','gf_save_professor_routine_v2') then
      v_guard := 'perform private.gf_require_professor_permission(case when p_routine_id is null then ''canCreateRoutines'' else ''canEditRoutines'' end);';
    elsif v_key is not null then
      v_guard := format('perform private.gf_require_professor_permission(%L);',v_key);
    else continue;
    end if;
    if v_function.lanname <> 'plpgsql' then raise exception 'Unexpected language for %',v_function.proname; end if;
    v_definition := pg_get_functiondef(v_function.oid);
    v_definition := regexp_replace(v_definition,'\mbegin\M','begin'||chr(10)||'  '||v_guard,'i');
    execute v_definition;
    execute format('revoke all on function %s from public,anon',v_function.oid::regprocedure);
    execute format('grant execute on function %s to authenticated',v_function.oid::regprocedure);
  end loop;
end;
$$;

-- SELECT protection applies even to direct REST requests. Existing visibility and ownership rules still apply.
create policy "Professor exercise catalog permission" on public.gf_exercises as restrictive
for select to authenticated using (public.gf_current_role() <> 'profe' or (select private.gf_professor_can('canViewExercises')));
create policy "Professor exercise write prerequisites" on public.gf_exercises as restrictive
for all to authenticated using (public.gf_current_role() <> 'profe' or (select private.gf_professor_can('canViewExercises')))
with check (public.gf_current_role() <> 'profe' or (select private.gf_professor_can('canViewExercises')));
notify pgrst,'reload schema';
