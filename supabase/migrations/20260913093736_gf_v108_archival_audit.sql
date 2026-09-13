-- Infytter V.1.08.0 · aplicada el 13/09/2026
-- Auditoría inmutable para operaciones sensibles y limpieza segura al eliminar fichas.

create table if not exists private.gf_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  actor_name text not null default '',
  actor_role text not null,
  action text not null,
  entity_type text not null,
  entity_id text,
  branch text,
  reason text not null default '',
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists gf_audit_events_occurred_at_idx
  on private.gf_audit_events (occurred_at desc);
create index if not exists gf_audit_events_entity_idx
  on private.gf_audit_events (entity_type, entity_id, occurred_at desc);
create index if not exists gf_audit_events_actor_idx
  on private.gf_audit_events (actor_user_id, occurred_at desc);

alter table private.gf_audit_events enable row level security;
revoke all on table private.gf_audit_events from public, anon, authenticated;

create or replace function public.gf_apply_operations(p_operations jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_role text;
  v_actor_name text;
  v_op jsonb;
  v_result jsonb;
  v_action text;
  v_collection text;
  v_record_id text;
  v_audit_action text;
  v_reason text;
  v_branch text;
begin
  select role, coalesce(nullif(display_name, ''), email, 'Usuario')
    into v_role, v_actor_name
  from public.gf_profiles
  where user_id = auth.uid();

  if v_role is null or v_role not in ('admin', 'coadmin', 'profe') then
    raise exception 'Tu rol no puede modificar la operación del gimnasio.';
  end if;

  if jsonb_typeof(coalesce(p_operations, '[]'::jsonb)) <> 'array' then
    raise exception 'Formato de operaciones inválido.';
  end if;

  -- El Profesor sólo puede cambiar su sucursal desde este canal.
  if v_role = 'profe' then
    for v_op in select value from jsonb_array_elements(coalesce(p_operations, '[]'::jsonb)) loop
      if not (v_op->>'action' = 'set' and v_op->>'key' = 'activeBranch') then
        raise exception 'El Profesor no puede usar el canal operativo de accesos. Usá el permiso individual de acceso manual.';
      end if;
    end loop;
  end if;

  -- Valida la confirmación destructiva en el servidor, no sólo en la interfaz.
  for v_op in select value from jsonb_array_elements(coalesce(p_operations, '[]'::jsonb)) loop
    if v_op->>'action' = 'delete' and v_op->>'collection' = 'people' then
      if v_role <> 'admin' then raise exception 'Sólo el Admin master puede eliminar personas.'; end if;
      if length(trim(coalesce(v_op#>>'{audit,reason}', ''))) < 3 then
        raise exception 'Indicá el motivo de la eliminación.';
      end if;
    end if;
  end loop;

  v_result := public.gf_apply_operations_core_v106(p_operations);

  for v_op in select value from jsonb_array_elements(coalesce(p_operations, '[]'::jsonb)) loop
    v_action := coalesce(v_op->>'action', 'unknown');
    v_collection := coalesce(v_op->>'collection', v_op->>'key', 'state');
    v_record_id := nullif(v_op->>'recordId', '');
    v_audit_action := nullif(trim(coalesce(v_op#>>'{audit,action}', '')), '');
    v_reason := left(trim(coalesce(v_op#>>'{audit,reason}', '')), 300);
    v_branch := nullif(trim(coalesce(v_op#>>'{audit,branch}', v_op->>'branch', '')), '');

    if v_audit_action is null then
      v_audit_action := v_action || '_' || v_collection;
    end if;

    -- Evita llenar la auditoría con cada acceso y cada notificación rutinaria.
    if v_collection in ('people', 'transactions', 'closures')
       or v_action = 'clear'
       or v_audit_action in ('archive_person', 'restore_person', 'delete_person') then
      insert into private.gf_audit_events (
        actor_user_id, actor_name, actor_role, action, entity_type,
        entity_id, branch, reason, details
      ) values (
        auth.uid(), v_actor_name, v_role, v_audit_action, v_collection,
        v_record_id, v_branch, v_reason,
        jsonb_build_object('operationId', v_op->>'id', 'deviceId', v_op->>'deviceId')
      );
    end if;

    if v_action = 'delete' and v_collection = 'people' then
      -- Conserva la contabilidad y los accesos anonimizados; elimina datos personales relacionados.
      update private.gf_transactions
         set person_id = null,
             payload = (payload - 'personId') || jsonb_build_object('deletedPerson', true),
             updated_at = now()
       where person_id = v_record_id;
      update private.gf_accesses
         set person_id = null,
             payload = (payload - 'personId') || jsonb_build_object('deletedPerson', true),
             updated_at = now()
       where person_id = v_record_id;
      delete from private.gf_body_metrics where person_id = v_record_id;
      delete from public.gf_account_links where person_id = v_record_id;
    end if;
  end loop;

  return v_result;
end;
$function$;

revoke all on function public.gf_apply_operations(jsonb) from public, anon;
grant execute on function public.gf_apply_operations(jsonb) to authenticated;

create or replace function public.gf_list_audit_events(p_limit integer default 100)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_role text;
begin
  select role into v_role from public.gf_profiles where user_id = auth.uid();
  if v_role is null or v_role not in ('admin', 'coadmin') then
    raise exception 'No tenés permisos para consultar la auditoría.';
  end if;

  return coalesce((
    select jsonb_agg(to_jsonb(event_row) order by event_row.occurred_at desc)
    from (
      select id, actor_name, actor_role, action, entity_type, entity_id,
             branch, reason, details, occurred_at
      from private.gf_audit_events
      order by occurred_at desc
      limit greatest(1, least(coalesce(p_limit, 100), 500))
    ) event_row
  ), '[]'::jsonb);
end;
$function$;

revoke all on function public.gf_list_audit_events(integer) from public, anon;
grant execute on function public.gf_list_audit_events(integer) to authenticated;
