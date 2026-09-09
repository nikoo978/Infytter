-- Deny missing profiles explicitly: SQL NULL must never bypass a role guard.
CREATE OR REPLACE FUNCTION public.gf_assign_professor_routine(p_routine_id uuid, p_client_user_ids uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare v_role text; v_creator uuid; v_client uuid; v_added integer:=0;
begin
 select role into v_role from public.gf_profiles where user_id=auth.uid(); if v_role is null or v_role not in ('admin','coadmin','profe') then raise exception 'Sin permisos para asignar rutinas.'; end if;
 select created_by into v_creator from private.gf_routines where id=p_routine_id and source_type='professor'; if not found then raise exception 'La rutina indicada no existe.'; end if; if v_role='profe' and v_creator is distinct from auth.uid() then raise exception 'Sólo podés asignar rutinas creadas por vos.'; end if;
 foreach v_client in array coalesce(p_client_user_ids,array[]::uuid[]) loop
  if not exists(select 1 from public.gf_profiles p join public.gf_account_links l on l.user_id=p.user_id and l.link_kind='cliente' where p.user_id=v_client and p.role='cliente') then raise exception 'Uno de los clientes seleccionados no tiene cuenta vinculada válida.'; end if;
  insert into private.gf_routine_assignments(routine_id,client_user_id,assigned_by) values(p_routine_id,v_client,auth.uid()) on conflict(routine_id,client_user_id) do nothing; if found then v_added:=v_added+1; end if;
 end loop; return v_added;
end;$function$;

CREATE OR REPLACE FUNCTION public.gf_delete_my_routine(p_routine_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$ begin if public.gf_current_role() is distinct from 'cliente' then raise exception 'Disponible exclusivamente para cuentas Cliente.'; end if; delete from private.gf_routines where id=p_routine_id and source_type='client' and owner_user_id=auth.uid(); return found; end;$function$;

CREATE OR REPLACE FUNCTION public.gf_get_access_display_key()
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role text;
  v_key text;
begin
  select role into v_role
  from public.gf_profiles
  where user_id = auth.uid()
  limit 1;

  if v_role is null or v_role not in ('admin','coadmin','profe') then
    raise exception 'Sin permisos para abrir la segunda pantalla.';
  end if;

  select display_key into v_key
  from private.gf_access_display_state
  where id = 'main';

  return v_key;
end;
$function$;

CREATE OR REPLACE FUNCTION public.gf_get_client_routines_for_professor(p_client_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare v_role text; v_result jsonb;
begin
 select role into v_role from public.gf_profiles where user_id=auth.uid(); if v_role is null or v_role not in ('admin','coadmin','profe') then raise exception 'Sin permisos para consultar rutinas de alumnos.'; end if; if not exists(select 1 from public.gf_profiles where user_id=p_client_user_id and role='cliente') then raise exception 'Cliente inválido.'; end if;
 select coalesce(jsonb_agg(private.gf_routine_json(r.id)||jsonb_build_object('assignedAt',a.created_at,'canEdit',(v_role in ('admin','coadmin') or r.created_by=auth.uid())) order by a.created_at desc),'[]'::jsonb) into v_result from private.gf_routine_assignments a join private.gf_routines r on r.id=a.routine_id and r.source_type='professor' where a.client_user_id=p_client_user_id; return v_result;
end;$function$;

CREATE OR REPLACE FUNCTION public.gf_get_my_body_metrics(p_limit integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role text;
  v_person_id text;
begin
  select role into v_role from public.gf_profiles where user_id = auth.uid();
  if v_role is null or v_role not in ('cliente','profe') then raise exception 'Esta función es para cuentas Cliente o Profesor.'; end if;
  select person_id into v_person_id from public.gf_account_links where user_id = auth.uid() and link_kind = v_role limit 1;
  if v_person_id is null then raise exception 'Tu cuenta todavía no tiene una ficha vinculada.'; end if;
  return jsonb_build_object('personId', v_person_id, 'items', private.gf_metrics_json(v_person_id, p_limit));
end;
$function$;

CREATE OR REPLACE FUNCTION public.gf_get_person_body_metrics(p_person_id text, p_limit integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role text;
  v_person jsonb;
begin
  select role into v_role from public.gf_profiles where user_id = auth.uid();
  if v_role is null or v_role not in ('admin','coadmin','profe') then raise exception 'Sin permisos para consultar progreso.'; end if;
  v_person := private.gf_metric_person(p_person_id);
  if v_person is null then raise exception 'Ficha no encontrada.'; end if;
  if v_role = 'profe' and v_person->>'role' <> 'Cliente' then raise exception 'El Profesor sólo puede consultar alumnos.'; end if;
  return jsonb_build_object('personId', p_person_id, 'items', private.gf_metrics_json(p_person_id, p_limit));
end;
$function$;

CREATE OR REPLACE FUNCTION public.gf_get_report_snapshot(p_branch text, p_start date, p_end date, p_previous_start date, p_previous_end date, p_granularity text DEFAULT 'day'::text, p_limit integer DEFAULT 500)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_role text; v_limit integer:=greatest(1,least(coalesce(p_limit,500),1000)); v_metrics jsonb; v_chart jsonb; v_sales jsonb; v_expenses jsonb; v_rows jsonb; v_count bigint; v_step interval;
begin
 select role into v_role from public.gf_profiles where user_id=auth.uid(); if v_role is null or v_role not in ('admin','coadmin') then raise exception 'Sin permisos para consultar reportes.'; end if; if p_branch is null or p_start is null or p_end is null or p_end<=p_start then raise exception 'Rango inválido.'; end if; if p_end-p_start>370 then raise exception 'El rango máximo es de 370 días.'; end if; if p_granularity not in ('day','month') then raise exception 'Granularidad inválida.'; end if;
 select jsonb_build_object('newClients',(select count(*) from private.gf_people p where p.role='Cliente' and p.branch=p_branch and p.start_date>=p_start and p.start_date<p_end),'previousNewClients',(select count(*) from private.gf_people p where p.role='Cliente' and p.branch=p_branch and p.start_date>=p_previous_start and p.start_date<p_previous_end),'membershipAmount',coalesce((select sum(t.amount) from private.gf_transactions t where t.branch=p_branch and t.event_date>=p_start and t.event_date<p_end and t.type='income' and t.category='Membresía'),0),'membershipCount',(select count(*) from private.gf_transactions t where t.branch=p_branch and t.event_date>=p_start and t.event_date<p_end and t.type='income' and t.category='Membresía'),'salesAmount',coalesce((select sum(t.amount) from private.gf_transactions t where t.branch=p_branch and t.event_date>=p_start and t.event_date<p_end and t.type='income' and coalesce(t.category,'')<>'Membresía'),0),'salesCount',(select count(*) from private.gf_transactions t where t.branch=p_branch and t.event_date>=p_start and t.event_date<p_end and t.type='income' and coalesce(t.category,'')<>'Membresía'),'expenseAmount',coalesce((select sum(t.amount) from private.gf_transactions t where t.branch=p_branch and t.event_date>=p_start and t.event_date<p_end and t.type='expense'),0),'expenseCount',(select count(*) from private.gf_transactions t where t.branch=p_branch and t.event_date>=p_start and t.event_date<p_end and t.type='expense'),'incomeAmount',coalesce((select sum(t.amount) from private.gf_transactions t where t.branch=p_branch and t.event_date>=p_start and t.event_date<p_end and t.type='income'),0),'previousIncomeAmount',coalesce((select sum(t.amount) from private.gf_transactions t where t.branch=p_branch and t.event_date>=p_previous_start and t.event_date<p_previous_end and t.type='income'),0)) into v_metrics;
 v_step:=case when p_granularity='month' then interval '1 month' else interval '1 day' end;
 select coalesce(jsonb_agg(jsonb_build_object('date',g.bucket::date,'membership',coalesce(x.membership,0),'sales',coalesce(x.sales,0),'expenses',coalesce(x.expenses,0),'clients',coalesce(c.clients,0)) order by g.bucket),'[]'::jsonb) into v_chart from generate_series(case when p_granularity='month' then date_trunc('month',p_start::timestamp) else p_start::timestamp end,(p_end::timestamp-interval '1 day'),v_step) g(bucket) left join lateral (select sum(t.amount) filter(where t.type='income' and t.category='Membresía') membership,sum(t.amount) filter(where t.type='income' and coalesce(t.category,'')<>'Membresía') sales,sum(t.amount) filter(where t.type='expense') expenses from private.gf_transactions t where t.branch=p_branch and t.event_date>=g.bucket::date and t.event_date<(g.bucket+v_step)::date and t.event_date>=p_start and t.event_date<p_end) x on true left join lateral (select count(*) clients from private.gf_people p where p.role='Cliente' and p.branch=p_branch and p.start_date>=g.bucket::date and p.start_date<(g.bucket+v_step)::date and p.start_date>=p_start and p.start_date<p_end) c on true;
 select coalesce(jsonb_agg(jsonb_build_object('label',category,'value',total) order by total desc),'[]'::jsonb) into v_sales from (select coalesce(category,'Sin categoría') category,sum(amount) total from private.gf_transactions where branch=p_branch and event_date>=p_start and event_date<p_end and type='income' and coalesce(category,'')<>'Membresía' group by coalesce(category,'Sin categoría')) q;
 select coalesce(jsonb_agg(jsonb_build_object('label',category,'value',total) order by total desc),'[]'::jsonb) into v_expenses from (select coalesce(category,'Sin categoría') category,sum(amount) total from private.gf_transactions where branch=p_branch and event_date>=p_start and event_date<p_end and type='expense' group by coalesce(category,'Sin categoría')) q;
 select count(*) into v_count from private.gf_transactions where branch=p_branch and event_date>=p_start and event_date<p_end;
 select coalesce(jsonb_agg(payload order by event_date desc,id desc),'[]'::jsonb) into v_rows from (select t.payload,t.event_date,t.id from private.gf_transactions t where t.branch=p_branch and t.event_date>=p_start and t.event_date<p_end order by t.event_date desc,t.id desc limit v_limit) q;
 return jsonb_build_object('metrics',v_metrics,'chart',v_chart,'salesBreakdown',v_sales,'expenseBreakdown',v_expenses,'transactions',v_rows,'transactionCount',v_count,'transactionLimit',v_limit);
end; $function$;

CREATE OR REPLACE FUNCTION public.gf_list_account_events(p_limit integer DEFAULT 10)
 RETURNS TABLE(id uuid, event_type text, user_id uuid, email text, display_name text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if coalesce(public.gf_current_role(), '') not in ('admin','coadmin') then
    raise exception 'No tenés permisos para ver eventos de cuentas.';
  end if;

  return query
  select e.id, e.event_type, e.user_id, e.email, e.display_name, e.created_at
  from public.gf_account_events e
  order by e.created_at desc
  limit greatest(1, least(coalesce(p_limit, 10), 50));
end;
$function$;

CREATE OR REPLACE FUNCTION public.gf_list_accounts()
 RETURNS TABLE(user_id uuid, email text, display_name text, dni text, role text, is_master boolean, created_at timestamp with time zone, updated_at timestamp with time zone, linked_person_id text, linked_kind text, linked_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if coalesce(public.gf_current_role(), '') not in ('admin','coadmin') then raise exception 'No tenés permisos para ver las cuentas registradas.'; end if;
  return query select p.user_id,p.email,p.display_name,p.dni,p.role,p.is_master,p.created_at,p.updated_at,l.person_id,l.link_kind,l.linked_at from public.gf_profiles p left join public.gf_account_links l on l.user_id=p.user_id order by p.is_master desc,p.created_at asc;
end;
$function$;

CREATE OR REPLACE FUNCTION public.gf_list_accounts_page(p_query text DEFAULT ''::text, p_role text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare v_role text; v_query text:=lower(trim(coalesce(p_query,''))); v_limit integer:=greatest(1,least(coalesce(p_limit,50),100)); v_offset integer:=greatest(0,coalesce(p_offset,0)); v_result jsonb; begin select role into v_role from public.gf_profiles where user_id=auth.uid(); if v_role is null or v_role not in ('admin','coadmin') then raise exception 'No tenés permisos para ver las cuentas registradas.'; end if; with filtered as materialized (select p.user_id,p.email,p.display_name,p.dni,p.role,p.is_master,p.created_at,p.updated_at,l.person_id linked_person_id,l.link_kind linked_kind,l.linked_at,gp.name linked_person_name from public.gf_profiles p left join public.gf_account_links l on l.user_id=p.user_id left join private.gf_people gp on gp.id=l.person_id where (p_role is null or p_role='' or p_role='todos' or p.role=p_role) and (v_query='' or lower(coalesce(p.display_name,'')) like '%'||v_query||'%' or lower(coalesce(p.email,'')) like '%'||v_query||'%' or lower(coalesce(p.dni,'')) like '%'||v_query||'%' or lower(coalesce(gp.name,'')) like '%'||v_query||'%')) select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(x) order by x.is_master desc,x.created_at,x.user_id) from (select * from filtered order by is_master desc,created_at,user_id limit v_limit offset v_offset) x),'[]'::jsonb),'totalFiltered',(select count(*) from filtered),'limit',v_limit,'offset',v_offset,'counts',(select jsonb_build_object('total',count(*),'unlinked',count(*) filter(where not p.is_master and p.role<>'coadmin' and l.user_id is null),'profe',count(*) filter(where p.role='profe'),'cliente',count(*) filter(where p.role='cliente')) from public.gf_profiles p left join public.gf_account_links l on l.user_id=p.user_id)) into v_result; return v_result; end; $function$;

CREATE OR REPLACE FUNCTION public.gf_list_professor_routines()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare v_role text; v_result jsonb;
begin select role into v_role from public.gf_profiles where user_id=auth.uid(); if v_role is null or v_role not in ('admin','coadmin','profe') then raise exception 'Sin permisos para administrar rutinas.'; end if; select coalesce(jsonb_agg(private.gf_routine_json(r.id)||jsonb_build_object('assignedUserIds',coalesce((select jsonb_agg(a.client_user_id) from private.gf_routine_assignments a where a.routine_id=r.id),'[]'::jsonb)) order by r.updated_at desc),'[]'::jsonb) into v_result from private.gf_routines r where r.source_type='professor' and (v_role in ('admin','coadmin') or r.created_by=auth.uid()); return v_result; end;$function$;

CREATE OR REPLACE FUNCTION public.gf_list_routine_clients()
 RETURNS TABLE(user_id uuid, email text, display_name text, dni text, person_id text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ begin if coalesce(public.gf_current_role(), '') not in ('admin','coadmin','profe') then raise exception 'Sin permisos para consultar alumnos.'; end if; return query select p.user_id,p.email,p.display_name,p.dni,l.person_id from public.gf_profiles p join public.gf_account_links l on l.user_id=p.user_id and l.link_kind='cliente' where p.role='cliente' order by p.display_name,p.email; end;$function$;

CREATE OR REPLACE FUNCTION public.gf_list_routine_clients_by_ids(p_user_ids uuid[])
 RETURNS TABLE(user_id uuid, email text, display_name text, dni text, person_id text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare v_role text; begin select role into v_role from public.gf_profiles where public.gf_profiles.user_id=auth.uid(); if v_role is null or v_role not in ('admin','coadmin','profe') then raise exception 'Sin permisos para consultar alumnos.'; end if; return query select p.user_id,p.email,coalesce(nullif(p.display_name,''),gp.name,p.email),coalesce(nullif(p.dni,''),gp.dni),l.person_id from public.gf_profiles p join public.gf_account_links l on l.user_id=p.user_id and l.link_kind='cliente' left join private.gf_people gp on gp.id=l.person_id where p.role='cliente' and p.user_id=any(coalesce(p_user_ids,array[]::uuid[])); end; $function$;

CREATE OR REPLACE FUNCTION public.gf_list_routine_clients_page(p_query text DEFAULT ''::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare v_role text; v_query text:=lower(trim(coalesce(p_query,''))); v_limit integer:=greatest(1,least(coalesce(p_limit,50),100)); v_offset integer:=greatest(0,coalesce(p_offset,0)); v_result jsonb; begin select role into v_role from public.gf_profiles where user_id=auth.uid(); if v_role is null or v_role not in ('admin','coadmin','profe') then raise exception 'Sin permisos para consultar alumnos.'; end if; with filtered as materialized (select p.user_id,p.email,coalesce(nullif(p.display_name,''),gp.name,p.email) display_name,coalesce(nullif(p.dni,''),gp.dni) dni,l.person_id from public.gf_profiles p join public.gf_account_links l on l.user_id=p.user_id and l.link_kind='cliente' left join private.gf_people gp on gp.id=l.person_id where p.role='cliente' and (v_query='' or lower(coalesce(p.display_name,gp.name,'')) like '%'||v_query||'%' or lower(coalesce(p.email,'')) like '%'||v_query||'%' or lower(coalesce(p.dni,gp.dni,'')) like '%'||v_query||'%')) select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(x) order by x.display_name,x.email) from (select * from filtered order by display_name,email limit v_limit offset v_offset) x),'[]'::jsonb),'totalFiltered',(select count(*) from filtered),'limit',v_limit,'offset',v_offset) into v_result; return v_result; end; $function$;

CREATE OR REPLACE FUNCTION public.gf_publish_access_display(p_event jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role text;
  v_can boolean;
  v_key text;
  v_event jsonb;
begin
  select role, can_grant_access into v_role, v_can from public.gf_profiles where user_id = auth.uid() limit 1;
  if v_role is null or v_role not in ('admin','coadmin','profe') then raise exception 'Sin permisos para publicar accesos.'; end if;
  if v_role = 'profe' and not coalesce(v_can,false) then raise exception 'El Admin no habilitó acceso manual para este Profesor.'; end if;
  if jsonb_typeof(coalesce(p_event,'{}'::jsonb)) <> 'object' then raise exception 'Evento de acceso inválido.'; end if;
  v_event := coalesce(p_event,'{}'::jsonb);
  select display_key into v_key from private.gf_access_display_state where id='main' for update;
  if v_key is null then raise exception 'Segunda pantalla no configurada.'; end if;
  update private.gf_access_display_state set event=v_event, updated_at=now() where id='main';
  perform realtime.send(v_event, 'access-result', 'access-display:' || v_key, false);
  return true;
end;
$function$;

CREATE OR REPLACE FUNCTION public.gf_remove_assigned_routine(p_routine_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$ begin if public.gf_current_role() is distinct from 'cliente' then raise exception 'Disponible exclusivamente para cuentas Cliente.'; end if; delete from private.gf_routine_assignments where routine_id=p_routine_id and client_user_id=auth.uid(); return found; end;$function$;

CREATE OR REPLACE FUNCTION public.gf_save_my_body_metric(p_weight_kg numeric, p_height_cm numeric, p_waist_cm numeric DEFAULT NULL::numeric, p_neck_cm numeric DEFAULT NULL::numeric, p_hip_cm numeric DEFAULT NULL::numeric, p_sex text DEFAULT NULL::text, p_notes text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role text;
  v_person_id text;
begin
  select role into v_role from public.gf_profiles where user_id = auth.uid();
  if v_role is null or v_role not in ('cliente','profe') then raise exception 'Esta función es para cuentas Cliente o Profesor.'; end if;
  select person_id into v_person_id from public.gf_account_links where user_id = auth.uid() and link_kind = v_role limit 1;
  if v_person_id is null then raise exception 'Tu cuenta todavía no tiene una ficha vinculada.'; end if;
  return private.gf_insert_metric(v_person_id, p_weight_kg, p_height_cm, p_waist_cm, p_neck_cm, p_hip_cm, p_sex, p_notes);
end;
$function$;

CREATE OR REPLACE FUNCTION public.gf_save_person_body_metric(p_person_id text, p_weight_kg numeric, p_height_cm numeric, p_waist_cm numeric DEFAULT NULL::numeric, p_neck_cm numeric DEFAULT NULL::numeric, p_hip_cm numeric DEFAULT NULL::numeric, p_sex text DEFAULT NULL::text, p_notes text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role text;
  v_person jsonb;
begin
  select role into v_role from public.gf_profiles where user_id = auth.uid();
  if v_role is null or v_role not in ('admin','coadmin','profe') then raise exception 'Sin permisos para registrar progreso.'; end if;
  v_person := private.gf_metric_person(p_person_id);
  if v_person is null then raise exception 'Ficha no encontrada.'; end if;
  if v_role = 'profe' and v_person->>'role' <> 'Cliente' then raise exception 'El Profesor sólo puede registrar medidas de alumnos.'; end if;
  return private.gf_insert_metric(p_person_id, p_weight_kg, p_height_cm, p_waist_cm, p_neck_cm, p_hip_cm, p_sex, p_notes);
end;
$function$;

CREATE OR REPLACE FUNCTION public.gf_save_professor_routine(p_routine_id uuid, p_title text, p_description text, p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare v_role text; v_id uuid; v_creator uuid;
begin
 select role into v_role from public.gf_profiles where user_id=auth.uid(); if v_role is null or v_role not in ('admin','coadmin','profe') then raise exception 'Sin permisos para administrar rutinas.'; end if; if char_length(trim(coalesce(p_title,'')))<2 then raise exception 'Ingresá un nombre para la rutina.'; end if;
 if p_routine_id is null then insert into private.gf_routines(title,description,source_type,owner_user_id,created_by) values(trim(p_title),coalesce(p_description,''),'professor',null,auth.uid()) returning id into v_id;
 else select id,created_by into v_id,v_creator from private.gf_routines where id=p_routine_id and source_type='professor'; if v_id is null then raise exception 'La rutina indicada no existe.'; end if; if v_role='profe' and v_creator is distinct from auth.uid() then raise exception 'Sólo podés editar rutinas creadas por vos.'; end if; update private.gf_routines set title=trim(p_title),description=coalesce(p_description,''),updated_at=now() where id=v_id; end if;
 perform private.gf_replace_routine_items(v_id,p_items); update private.gf_routines set updated_at=now() where id=v_id; return private.gf_routine_json(v_id);
end;$function$;

CREATE OR REPLACE FUNCTION public.gf_scaling_status()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare v_role text; v_legacy jsonb; begin select role into v_role from public.gf_profiles where user_id=auth.uid(); if v_role is null or v_role not in ('admin','coadmin') then raise exception 'Sin permisos para consultar capacidad.'; end if; select data into v_legacy from public.gf_gym_state where id='main'; return jsonb_build_object('targetUsers',10000,'architecture','relational-mirror-v1','databaseBytes',pg_database_size(current_database()),'legacyStateBytes',pg_column_size(coalesce(v_legacy,'{}'::jsonb)),'registeredAccounts',(select count(*) from public.gf_profiles),'people',(select count(*) from private.gf_people),'transactions',(select count(*) from private.gf_transactions),'accesses',(select count(*) from private.gf_accesses),'closures',(select count(*) from private.gf_closures),'notifications',(select count(*) from private.gf_notification_log),'routines',(select count(*) from private.gf_routines),'exercises',(select count(*) from public.gf_exercises),'legacyPeople',jsonb_array_length(coalesce(v_legacy->'people','[]'::jsonb)),'legacyTransactions',jsonb_array_length(coalesce(v_legacy->'transactions','[]'::jsonb)),'legacyAccesses',jsonb_array_length(coalesce(v_legacy->'accesses','[]'::jsonb))); end; $function$;

-- Registration verification and the paired display keep their intended access.
REVOKE EXECUTE ON FUNCTION public.gf_get_gym_state(), public.gf_list_account_events(integer), public.gf_set_account_link(uuid,text,text), public.gf_set_user_role(text,text), public.gf_unlink_account(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gf_get_gym_state(), public.gf_list_account_events(integer), public.gf_set_account_link(uuid,text,text), public.gf_set_user_role(text,text), public.gf_unlink_account(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.gf_log_profile_registration() FROM PUBLIC, anon, authenticated;
