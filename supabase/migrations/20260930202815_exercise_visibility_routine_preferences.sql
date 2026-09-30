alter table public.gf_exercises add column is_hidden boolean not null default false;

-- Keep the existing membership gate; managers can review and restore hidden rows.
alter policy "Usuarios habilitados leen ejercicios" on public.gf_exercises
using (
  public.gf_current_role() in ('admin','coadmin')
  or (not is_hidden and (public.gf_current_role()='profe'
    or (public.gf_current_role()='cliente' and public.gf_client_has_platform_access())))
);

create or replace function private.gf_guard_exercise_visibility()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (TG_OP='INSERT' and new.is_hidden) or
     (TG_OP='UPDATE' and new.is_hidden is distinct from old.is_hidden) then
    if auth.uid() is null or public.gf_current_role() is null or public.gf_current_role() not in ('admin','coadmin') then
      raise exception 'Sólo administración puede cambiar la visibilidad.';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.gf_guard_exercise_visibility() from public, anon, authenticated;
create trigger gf_exercise_visibility_guard before insert or update on public.gf_exercises
for each row execute function private.gf_guard_exercise_visibility();

-- Per-account days do not alter the routine shared by a professor.
create table private.gf_routine_day_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  routine_id uuid not null references private.gf_routines(id) on delete cascade,
  days smallint[] not null default '{}',
  primary key(user_id,routine_id),
  check(days <@ array[1,2,3,4,5,6,7]::smallint[])
);
alter table private.gf_routine_day_preferences enable row level security;
revoke all on private.gf_routine_day_preferences from public, anon, authenticated;

create or replace function public.gf_get_my_routine_days()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.gf_current_role() is distinct from 'cliente' or not public.gf_client_has_platform_access() then
    raise exception 'Necesitás una cuenta Cliente con mensualidad vigente.';
  end if;
  return (select coalesce(jsonb_object_agg(routine_id::text,to_jsonb(days)), '{}'::jsonb)
    from private.gf_routine_day_preferences where user_id=auth.uid());
end;
$$;

create or replace function public.gf_set_my_routine_days(p_routine_id uuid,p_days integer[])
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_routines jsonb; v_days smallint[];
begin
  if auth.uid() is null then raise exception 'Sin sesión.'; end if;
  -- This RPC revalidates role, membership and current routine assignments.
  v_routines := public.gf_get_my_routines();
  if not exists (select 1 from jsonb_array_elements((v_routines->'personal') || (v_routines->'assigned')) r where r->>'id'=p_routine_id::text) then
    raise exception 'La rutina no está disponible en tu cuenta.';
  end if;
  if exists (select 1 from unnest(coalesce(p_days,'{}'::integer[])) d where d is null or d not between 1 and 7) then
    raise exception 'Días inválidos.';
  end if;
  select coalesce(array_agg(distinct d::smallint order by d::smallint),'{}'::smallint[]) into v_days from unnest(coalesce(p_days,'{}'::integer[])) d;
  insert into private.gf_routine_day_preferences(user_id,routine_id,days) values(auth.uid(),p_routine_id,v_days)
  on conflict(user_id,routine_id) do update set days=excluded.days;
  return true;
end;
$$;
revoke all on function public.gf_get_my_routine_days() from public,anon;
revoke all on function public.gf_set_my_routine_days(uuid,integer[]) from public,anon;
grant execute on function public.gf_get_my_routine_days() to authenticated;
grant execute on function public.gf_set_my_routine_days(uuid,integer[]) to authenticated;
