-- Qualify the profile lookup: user_id is also a RETURNS TABLE variable.
CREATE OR REPLACE FUNCTION public.gf_list_routine_clients()
RETURNS TABLE(user_id uuid, email text, display_name text, dni text, person_id text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
declare
  v_role text;
begin
  select p.role into v_role from public.gf_profiles p where p.user_id = auth.uid();
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