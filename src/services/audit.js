import { supabase } from "./supabase";

export async function listAuditEvents(limit = 200) {
  if (!supabase) return { events: [], error: new Error("Supabase no configurado") };
  const { data, error } = await supabase.rpc("gf_list_audit_events", { p_limit: limit });
  return { events: data || [], error };
}
