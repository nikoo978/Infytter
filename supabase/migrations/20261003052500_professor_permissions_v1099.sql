-- Independent opt-in permissions. Existing manual-access grants are preserved.
alter table public.gf_profiles
  add column if not exists can_view_students boolean not null default false,
  add column if not exists can_create_exercises boolean not null default false,
  add column if not exists can_edit_exercises boolean not null default false,
  add column if not exists can_delete_exercises boolean not null default false;

create or replace function public.gf_profile_access_permission_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.role <> 'profe' then
    new.can_grant_access := false;
    new.can_view_students := false;
    new.can_create_exercises := false;
    new.can_edit_exercises := false;
    new.can_delete_exercises := false;
  end if;
  return new;
end;
$$;
drop trigger if exists gf_profile_access_permission_guard on public.gf_profiles;
create trigger gf_profile_permissions_guard before insert or update on public.gf_profiles
for each row execute function public.gf_profile_access_permission_guard();

create or replace function private.gf_set_professor_permission(p_user_id uuid, p_permission text, p_enabled boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor public.gf_profiles; v_target public.gf_profiles; v_column text;
begin
  select * into v_actor from public.gf_profiles where user_id = auth.uid();
  if v_actor.user_id is null or v_actor.role <> 'admin' or not v_actor.is_master then
    raise exception 'Sólo el Admin master puede administrar los permisos.';
  end if;
  select * into v_target from public.gf_profiles where user_id = p_user_id;
  if v_target.user_id is null or v_target.role <> 'profe' then raise exception 'La cuenta seleccionada no es Profesor.'; end if;
  v_column := case p_permission
    when 'canGrantAccess' then 'can_grant_access'
    when 'canViewStudents' then 'can_view_students'
    when 'canCreateExercises' then 'can_create_exercises'
    when 'canEditExercises' then 'can_edit_exercises'
    when 'canDeleteExercises' then 'can_delete_exercises' end;
  if v_column is null then raise exception 'Permiso desconocido.'; end if;
  execute format('update public.gf_profiles set %I = $1 where user_id = $2', v_column) using coalesce(p_enabled,false), p_user_id;
  return jsonb_build_object('userId',p_user_id,p_permission,coalesce(p_enabled,false));
end;
$$;
revoke all on function private.gf_set_professor_permission(uuid,text,boolean) from public, anon;
grant execute on function private.gf_set_professor_permission(uuid,text,boolean) to authenticated;
create or replace function public.gf_set_professor_permission(p_user_id uuid, p_permission text, p_enabled boolean)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.gf_set_professor_permission(p_user_id,p_permission,p_enabled);
$$;
revoke all on function public.gf_set_professor_permission(uuid,text,boolean) from public, anon;
grant execute on function public.gf_set_professor_permission(uuid,text,boolean) to authenticated;

create or replace function public.gf_list_professor_permissions()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor public.gf_profiles;
begin
  select * into v_actor from public.gf_profiles where user_id = auth.uid();
  if v_actor.user_id is null or v_actor.role <> 'admin' or not v_actor.is_master then
    raise exception 'Sólo el Admin master puede administrar los permisos.';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'userId',p.user_id,'name',p.display_name,'email',p.email,
    'canGrantAccess',p.can_grant_access,'canViewStudents',p.can_view_students,
    'canCreateExercises',p.can_create_exercises,'canEditExercises',p.can_edit_exercises,
    'canDeleteExercises',p.can_delete_exercises,'linkedPersonId',l.person_id
  ) order by lower(p.display_name),lower(p.email))
  from public.gf_profiles p left join public.gf_account_links l on l.user_id=p.user_id and l.link_kind='profe'
  where p.role='profe'),'[]'::jsonb);
end;
$$;

create or replace function private.gf_require_student_permission()
returns void language plpgsql security definer set search_path = '' as $$
declare v_profile public.gf_profiles;
begin
  select * into v_profile from public.gf_profiles where user_id=auth.uid();
  if v_profile.user_id is null or v_profile.role not in ('admin','coadmin','profe') then
    raise exception 'Tu rol no tiene acceso a alumnos.';
  end if;
  if v_profile.role='profe' and not v_profile.can_view_students then
    raise exception 'El administrador debe habilitar el permiso para consultar alumnos.';
  end if;
end;
$$;
revoke all on function private.gf_require_student_permission() from public, anon;
grant execute on function private.gf_require_student_permission() to authenticated;

-- Preserve current RPC bodies, especially personal+assigned routines introduced in v1.09.8.
do $$
declare v_function record; v_definition text;
begin
  for v_function in select p.oid,p.proname,l.lanname from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
    where n.nspname='public' and p.proname = any(array[
      'gf_list_routine_clients','gf_list_routine_clients_page','gf_list_routine_clients_by_ids',
      'gf_list_routine_people','gf_get_client_routines_for_professor','gf_get_person_routines_for_professor',
      'gf_get_person_training_overview','gf_get_person_body_metrics','gf_save_person_body_metric',
      'gf_delete_person_body_metric','gf_assign_professor_routine','gf_assign_professor_routine_people'
    ])
  loop
    v_definition := pg_get_functiondef(v_function.oid);
    if v_function.lanname <> 'plpgsql' then raise exception 'Unexpected language for %',v_function.proname; end if;
    if strpos(v_definition,'private.gf_require_student_permission')=0 then
      v_definition := regexp_replace(v_definition,'\mbegin\M','begin' || chr(10) || '  perform private.gf_require_student_permission();','i');
      execute v_definition;
    end if;
  end loop;
end;
$$;

create or replace function public.gf_get_gym_state()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_profile public.gf_profiles; v_data jsonb;
begin
  select * into v_profile from public.gf_profiles where user_id=auth.uid();
  if v_profile.user_id is null or v_profile.role not in ('admin','coadmin','profe') then
    raise exception 'Tu rol no tiene acceso al panel operativo.';
  end if;
  select data into v_data from public.gf_gym_state where id='main';
  v_data := coalesce(v_data,'{}'::jsonb);
  if v_profile.role='profe' then
    v_data := jsonb_set(v_data,'{transactions}','[]'::jsonb,true);
    v_data := jsonb_set(v_data,'{closures}','[]'::jsonb,true);
    v_data := jsonb_set(v_data,'{notificationPreferences}','{}'::jsonb,true);
    if not v_profile.can_view_students then
      v_data := jsonb_set(v_data,'{people}','[]'::jsonb,true);
      v_data := jsonb_set(v_data,'{accesses}','[]'::jsonb,true);
      v_data := jsonb_set(v_data,'{notificationLog}','[]'::jsonb,true);
    else
      v_data := jsonb_set(v_data,'{people}',coalesce((select jsonb_agg(item-'price')
        from jsonb_array_elements(coalesce(v_data->'people','[]'::jsonb)) item),'[]'::jsonb),true);
      v_data := jsonb_set(v_data,'{notificationLog}',coalesce((select jsonb_agg(item)
        from jsonb_array_elements(coalesce(v_data->'notificationLog','[]'::jsonb)) item
        where coalesce(item->>'type','') not in ('income','expense','withdrawal')),'[]'::jsonb),true);
    end if;
  end if;
  return v_data;
end;
$$;

-- Additional restrictive policies retain the existing ownership/system protections.
create policy "Professor exercise create permission" on public.gf_exercises as restrictive
for insert to authenticated with check (
  public.gf_current_role() <> 'profe' or exists(select 1 from public.gf_profiles p where p.user_id=(select auth.uid()) and p.can_create_exercises)
);
create policy "Professor exercise edit permission" on public.gf_exercises as restrictive
for update to authenticated using (
  public.gf_current_role() <> 'profe' or exists(select 1 from public.gf_profiles p where p.user_id=(select auth.uid()) and p.can_edit_exercises)
) with check (
  public.gf_current_role() <> 'profe' or exists(select 1 from public.gf_profiles p where p.user_id=(select auth.uid()) and p.can_edit_exercises)
);
create policy "Professor exercise delete permission" on public.gf_exercises as restrictive
for delete to authenticated using (
  public.gf_current_role() <> 'profe' or exists(select 1 from public.gf_profiles p where p.user_id=(select auth.uid()) and p.can_delete_exercises)
);
notify pgrst, 'reload schema';
