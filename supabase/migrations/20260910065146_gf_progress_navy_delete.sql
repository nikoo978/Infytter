-- Infytter: progreso corporal
-- Evita resultados Navy silenciosamente nulos cuando las medidas son incompatibles
-- y permite borrar una medición cargada por error respetando los permisos existentes.

create or replace function private.gf_calculate_metric(
  p_weight_kg numeric,
  p_height_cm numeric,
  p_waist_cm numeric,
  p_neck_cm numeric,
  p_hip_cm numeric,
  p_sex text
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_bmi numeric;
  v_fat numeric;
  v_den numeric;
begin
  if p_weight_kg < 20 or p_weight_kg > 400 then raise exception 'Peso fuera de rango.'; end if;
  if p_height_cm < 100 or p_height_cm > 250 then raise exception 'Altura fuera de rango.'; end if;
  if p_waist_cm is not null and (p_waist_cm < 30 or p_waist_cm > 250) then raise exception 'Cintura fuera de rango.'; end if;
  if p_neck_cm is not null and (p_neck_cm < 20 or p_neck_cm > 100) then raise exception 'Cuello fuera de rango.'; end if;
  if p_hip_cm is not null and (p_hip_cm < 40 or p_hip_cm > 250) then raise exception 'Cadera fuera de rango.'; end if;
  if p_sex is not null and p_sex not in ('male','female') then raise exception 'Sexo inválido para el cálculo.'; end if;

  v_bmi := round((p_weight_kg / power(p_height_cm / 100.0, 2))::numeric, 2);

  if p_sex = 'male' and p_waist_cm is not null and p_neck_cm is not null then
    if p_waist_cm <= p_neck_cm then
      raise exception 'Para calcular grasa con Navy, la cintura debe ser mayor que el cuello.';
    end if;
    v_den := 1.0324 - 0.19077 * log(10, p_waist_cm - p_neck_cm) + 0.15456 * log(10, p_height_cm);
    if v_den > 0 then v_fat := round((495 / v_den - 450)::numeric, 2); end if;
  elsif p_sex = 'female' and p_waist_cm is not null and p_neck_cm is not null and p_hip_cm is not null then
    if (p_waist_cm + p_hip_cm) <= p_neck_cm then
      raise exception 'Para calcular grasa con Navy, cintura + cadera debe ser mayor que el cuello.';
    end if;
    v_den := 1.29579 - 0.35004 * log(10, p_waist_cm + p_hip_cm - p_neck_cm) + 0.22100 * log(10, p_height_cm);
    if v_den > 0 then v_fat := round((495 / v_den - 450)::numeric, 2); end if;
  end if;

  if v_fat is not null and (v_fat < 1 or v_fat > 75) then
    raise exception 'Las medidas producen una estimación Navy fuera del rango válido. Revisá cintura, cuello, cadera y altura.';
  end if;

  return jsonb_build_object('bmi', v_bmi, 'bodyFatPct', v_fat);
end;
$$;

revoke all on function private.gf_calculate_metric(numeric,numeric,numeric,numeric,numeric,text) from public, anon, authenticated;

create or replace function public.gf_delete_my_body_metric(p_metric_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_person_id text;
begin
  select role into v_role from public.gf_profiles where user_id = auth.uid();
  if v_role is null or v_role not in ('cliente','profe') then
    raise exception 'Esta función es para cuentas Cliente o Profesor.';
  end if;

  select person_id into v_person_id
  from public.gf_account_links
  where user_id = auth.uid() and link_kind = v_role
  limit 1;
  if v_person_id is null then raise exception 'Tu cuenta todavía no tiene una ficha vinculada.'; end if;

  delete from private.gf_body_metrics
  where id = p_metric_id and person_id = v_person_id;
  return found;
end;
$$;

create or replace function public.gf_delete_person_body_metric(p_person_id text, p_metric_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_person jsonb;
begin
  select role into v_role from public.gf_profiles where user_id = auth.uid();
  if v_role is null or v_role not in ('admin','coadmin','profe') then
    raise exception 'Sin permisos para eliminar progreso.';
  end if;

  v_person := private.gf_metric_person(p_person_id);
  if v_person is null then raise exception 'Ficha no encontrada.'; end if;
  if v_role = 'profe' and v_person->>'role' <> 'Cliente' then
    raise exception 'El Profesor sólo puede eliminar medidas de alumnos.';
  end if;

  delete from private.gf_body_metrics
  where id = p_metric_id and person_id = p_person_id;
  return found;
end;
$$;

revoke all on function public.gf_delete_my_body_metric(uuid) from public, anon;
revoke all on function public.gf_delete_person_body_metric(text,uuid) from public, anon;
grant execute on function public.gf_delete_my_body_metric(uuid) to authenticated;
grant execute on function public.gf_delete_person_body_metric(text,uuid) to authenticated;
