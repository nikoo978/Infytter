create or replace function public.gf_get_my_platform_access()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_link public.gf_account_links%rowtype;
  v_member private.gf_people%rowtype;
  v_today date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if v_user_id is null then raise exception 'Sesión no autenticada.'; end if;

  select role into v_role from public.gf_profiles where user_id = v_user_id limit 1;
  if v_role is distinct from 'cliente' then
    return jsonb_build_object('allowed', false, 'reason', 'not_client', 'linked', false, 'today', v_today);
  end if;

  select * into v_link
  from public.gf_account_links
  where user_id = v_user_id and link_kind = 'cliente'
  limit 1;

  if v_link.user_id is null then
    return jsonb_build_object('allowed', false, 'reason', 'unlinked', 'linked', false, 'today', v_today);
  end if;

  select * into v_member
  from private.gf_people
  where id = v_link.person_id and role = 'Cliente'
  limit 1;

  if v_member.id is null then
    return jsonb_build_object('allowed', false, 'reason', 'unlinked', 'linked', false, 'today', v_today);
  end if;

  if v_member.payload ? 'archivedAt' then
    return jsonb_build_object('allowed', false, 'reason', 'archived', 'linked', true, 'personId', v_member.id, 'name', v_member.name, 'expiry', v_member.expiry_date, 'today', v_today);
  end if;

  if v_member.start_date is null or v_member.start_date > v_today then
    return jsonb_build_object('allowed', false, 'reason', 'not_started', 'linked', true, 'personId', v_member.id, 'name', v_member.name, 'start', v_member.start_date, 'expiry', v_member.expiry_date, 'today', v_today);
  end if;

  if v_member.expiry_date is null or v_member.expiry_date < v_today then
    return jsonb_build_object('allowed', false, 'reason', 'expired', 'linked', true, 'personId', v_member.id, 'name', v_member.name, 'start', v_member.start_date, 'expiry', v_member.expiry_date, 'today', v_today);
  end if;

  return jsonb_build_object('allowed', true, 'reason', 'active', 'linked', true, 'personId', v_member.id, 'name', v_member.name, 'plan', v_member.plan, 'start', v_member.start_date, 'expiry', v_member.expiry_date, 'today', v_today);
end;
$function$;

revoke all on function public.gf_get_my_platform_access() from public, anon;
grant execute on function public.gf_get_my_platform_access() to authenticated;

create or replace function public.gf_client_has_platform_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce((public.gf_get_my_platform_access()->>'allowed')::boolean, false);
$function$;

revoke all on function public.gf_client_has_platform_access() from public, anon;
grant execute on function public.gf_client_has_platform_access() to authenticated;

drop policy if exists "Usuarios autenticados leen ejercicios" on public.gf_exercises;
create policy "Usuarios habilitados leen ejercicios"
on public.gf_exercises
for select
to authenticated
using (
  public.gf_current_role() = any (array['admin'::text, 'coadmin'::text, 'profe'::text])
  or (public.gf_current_role() = 'cliente'::text and public.gf_client_has_platform_access())
);

create or replace function public.gf_get_my_client_portal()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_profile public.gf_profiles;
  v_link public.gf_account_links;
  v_member private.gf_people;
  v_accesses jsonb := '[]'::jsonb;
  v_branch_name text;
  v_config jsonb;
begin
  select * into v_profile from public.gf_profiles where user_id=auth.uid() limit 1;
  if v_profile.user_id is null then raise exception 'La cuenta no tiene un perfil Infytter.'; end if;
  if v_profile.role<>'cliente' then raise exception 'Este portal está disponible exclusivamente para cuentas Cliente.'; end if;
  if not public.gf_client_has_platform_access() then raise exception 'Tu cuenta necesita una ficha vinculada y una mensualidad vigente para acceder a Infytter.'; end if;

  select * into v_link from public.gf_account_links where user_id=auth.uid() and link_kind='cliente' limit 1;
  select * into v_member from private.gf_people where id=v_link.person_id and role='Cliente' limit 1;

  select data into v_config from public.gf_gym_state where id='main';
  select item->>'name' into v_branch_name
  from jsonb_array_elements(coalesce(v_config->'branches','[]'::jsonb)) item
  where item->>'id'=v_member.branch limit 1;

  select coalesce(jsonb_agg(row_data order by occurred_at desc nulls last),'[]'::jsonb)
  into v_accesses
  from (
    select jsonb_build_object('id',a.id,'allowed',a.allowed,'manual',a.manual,'date',coalesce(a.occurred_at::text,a.payload->>'date'),'branch',a.branch) row_data,
           a.occurred_at
    from private.gf_accesses a
    where a.person_id=v_member.id
    order by a.occurred_at desc nulls last
    limit 30
  ) q;

  return jsonb_build_object(
    'linked',true,
    'account',jsonb_build_object('email',v_profile.email,'displayName',v_profile.display_name,'role',v_profile.role),
    'member',jsonb_build_object('id',v_member.id,'name',v_member.name,'dni',v_member.dni,'phone',v_member.phone,'plan',v_member.plan,'start',v_member.start_date,'expiry',v_member.expiry_date,'branch',v_member.branch,'biometricMethod',v_member.biometric_method,'biometricStatus',v_member.biometric_status),
    'branchName',v_branch_name,
    'accesses',v_accesses
  );
end;
$function$;

revoke all on function public.gf_get_my_client_portal() from public, anon;
grant execute on function public.gf_get_my_client_portal() to authenticated;
