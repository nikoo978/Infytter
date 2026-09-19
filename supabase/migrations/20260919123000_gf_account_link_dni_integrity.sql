-- Infytter V.1.09.1 · integridad entre cuenta Cliente y ficha vinculada.

create or replace function public.gf_set_account_link(
  target_user_id uuid,
  target_person_id text,
  target_kind text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor public.gf_profiles%rowtype;
  target public.gf_profiles%rowtype;
  v_person private.gf_people%rowtype;
  expected_person_role text;
  v_target_dni text;
  v_person_dni text;
begin
  select * into actor from public.gf_profiles where user_id = auth.uid();
  if actor.user_id is null or actor.role not in ('admin','coadmin') then
    raise exception 'No tenés permisos para vincular cuentas.';
  end if;

  select * into target from public.gf_profiles where user_id = target_user_id;
  if target.user_id is null then raise exception 'La cuenta indicada no existe.'; end if;
  if target.is_master then raise exception 'El Admin master no utiliza vínculo de ficha.'; end if;
  if target_kind not in ('cliente','profe') then raise exception 'Tipo de vínculo inválido.'; end if;
  if coalesce(trim(target_person_id),'') = '' then raise exception 'Seleccioná una ficha del gimnasio.'; end if;

  expected_person_role := case when target_kind = 'profe' then 'Profesor' else 'Cliente' end;

  select * into v_person
  from private.gf_people
  where id = target_person_id
    and role = expected_person_role
    and not (coalesce(payload, '{}'::jsonb) ? 'archivedAt')
  limit 1;

  if v_person.id is null then
    raise exception 'La ficha elegida no existe, está archivada o no coincide con el tipo de cuenta.';
  end if;

  if target_kind = 'cliente' then
    v_target_dni := regexp_replace(coalesce(target.dni, ''), '[^0-9]', '', 'g');
    v_person_dni := regexp_replace(coalesce(v_person.dni, ''), '[^0-9]', '', 'g');

    if v_target_dni = '' then
      raise exception 'La cuenta Cliente no tiene un DNI válido para comprobar el vínculo.';
    end if;
    if v_person_dni = '' then
      raise exception 'La ficha Cliente no tiene un DNI válido para comprobar el vínculo.';
    end if;
    if v_target_dni <> v_person_dni then
      raise exception 'El DNI de la cuenta no coincide con el DNI de la ficha seleccionada.';
    end if;
  end if;

  if exists (
    select 1 from public.gf_account_links
    where person_id = target_person_id and user_id <> target_user_id
  ) then
    raise exception 'Esa ficha ya está vinculada a otra cuenta PWA.';
  end if;

  update public.gf_profiles
  set role = target_kind
  where user_id = target_user_id;

  insert into public.gf_account_links(user_id, person_id, link_kind, linked_by, linked_at, updated_at)
  values (target_user_id, target_person_id, target_kind, auth.uid(), now(), now())
  on conflict (user_id) do update
  set person_id = excluded.person_id,
      link_kind = excluded.link_kind,
      linked_by = excluded.linked_by,
      linked_at = excluded.linked_at,
      updated_at = now();

  return jsonb_build_object(
    'ok', true,
    'userId', target_user_id,
    'personId', target_person_id,
    'kind', target_kind,
    'personName', v_person.name
  );
end;
$function$;

revoke all on function public.gf_set_account_link(uuid, text, text) from public, anon;
grant execute on function public.gf_set_account_link(uuid, text, text) to authenticated;

create or replace function public.gf_get_my_platform_access()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_profile public.gf_profiles%rowtype;
  v_link public.gf_account_links%rowtype;
  v_member private.gf_people%rowtype;
  v_today date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_profile_dni text;
  v_member_dni text;
begin
  if v_user_id is null then raise exception 'Sesión no autenticada.'; end if;

  select * into v_profile
  from public.gf_profiles
  where user_id = v_user_id
  limit 1;

  if v_profile.role is distinct from 'cliente' then
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

  v_profile_dni := regexp_replace(coalesce(v_profile.dni, ''), '[^0-9]', '', 'g');
  v_member_dni := regexp_replace(coalesce(v_member.dni, ''), '[^0-9]', '', 'g');

  if v_profile_dni <> '' and v_member_dni <> '' and v_profile_dni <> v_member_dni then
    return jsonb_build_object('allowed', false, 'reason', 'link_mismatch', 'linked', true, 'personId', v_member.id, 'today', v_today);
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
