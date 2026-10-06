alter table public.gf_profiles add column if not exists can_view_student_photos boolean not null default false;

create or replace function private.gf_set_professor_permission(p_user_id uuid,p_permission text,p_enabled boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor public.gf_profiles; v_column text;
begin
  select * into v_actor from public.gf_profiles where user_id=auth.uid();
  if v_actor.user_id is null or v_actor.role <> 'admin' or not v_actor.is_master then raise exception 'Sólo el Admin master puede administrar los permisos.'; end if;
  if not exists(select 1 from public.gf_profiles where user_id=p_user_id and role='profe') then raise exception 'La cuenta seleccionada no es Profesor.'; end if;
  v_column := case p_permission
    when 'canViewStudents' then 'can_view_students'
    when 'canViewStudentPhotos' then 'can_view_student_photos'
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

create or replace function public.gf_list_professor_permissions()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor public.gf_profiles;
begin
  select * into v_actor from public.gf_profiles where user_id=auth.uid();
  if v_actor.user_id is null or v_actor.role <> 'admin' or not v_actor.is_master then raise exception 'Sólo el Admin master puede administrar los permisos.'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'userId',p.user_id,'name',p.display_name,'email',p.email,'linkedPersonId',l.person_id,
    'canViewStudents',p.can_view_students,
    'canViewStudentPhotos',p.can_view_student_photos,
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


create or replace function private.gf_avatar_account(p_person_id text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor public.gf_profiles; v_uid uuid;
begin
  if auth.uid() is null then raise exception 'Sesión requerida'; end if;
  select * into v_actor from public.gf_profiles where user_id=auth.uid();
  if v_actor.user_id is null or not (v_actor.role='admin' or (v_actor.role='profe' and v_actor.can_view_students and v_actor.can_view_student_photos)) then
    raise exception 'No tenés permiso para ver fotos de alumnos';
  end if;
  select l.user_id into v_uid from public.gf_account_links l
    join public.gf_profiles p on p.user_id=l.user_id and p.role='cliente'
    where l.person_id::text=p_person_id and l.link_kind='cliente' limit 1;
  return v_uid;
end;
$$;
create or replace function public.gf_avatar_account(p_person_id text)
returns uuid language sql security invoker set search_path = '' as $$
  select private.gf_avatar_account(p_person_id);
$$;
revoke all on function private.gf_avatar_account(text) from public, anon;
revoke all on function public.gf_avatar_account(text) from public, anon;
grant execute on function private.gf_avatar_account(text) to authenticated;
grant execute on function public.gf_avatar_account(text) to authenticated;
-- Retain reads/deletes of legacy photos. New uploads use the bounded server endpoint.
drop policy if exists gf_avatar_insert_own on storage.objects;

create or replace function private.gf_photo_permission_role_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.role <> 'profe' then new.can_view_student_photos := false; end if;
  return new;
end;
$$;
revoke all on function private.gf_photo_permission_role_guard() from public, anon, authenticated;
create trigger gf_photo_permission_role_guard before insert or update of role, can_view_student_photos
  on public.gf_profiles for each row execute function private.gf_photo_permission_role_guard();
