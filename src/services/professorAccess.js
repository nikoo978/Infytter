import { PROFESSOR_PERMISSIONS } from "./professorPermissions";
import { supabase } from "./supabase";

const noSupabase = () => new Error("Supabase no configurado");

export async function listProfessorAccessPermissions() {
  if (!supabase) return { professors: [], error: noSupabase() };
  const { data, error } = await supabase.rpc("gf_list_professor_permissions");
  return { professors: data || [], error };
}

export async function setProfessorAccessPermission(userId, enabled) {
  if (!supabase) return { result: null, error: noSupabase() };
  const { data, error } = await supabase.rpc("gf_set_professor_access_permission", {
    p_user_id: userId,
    p_enabled: Boolean(enabled),
  });
  return { result: data || null, error };
}

export async function allowProfessorManualAccess(branch) {
  if (!supabase) return { event: null, error: noSupabase() };
  const { data, error } = await supabase.rpc("gf_professor_allow_manual_access", { p_branch: branch });
  return { event: data || null, error };
}

export async function setProfessorPermission(userId, permission, enabled) {
  if (!supabase) return { result: null, error: noSupabase() };
  const allowed = PROFESSOR_PERMISSIONS.map(({ key }) => key);
  if (!allowed.includes(permission)) return { result: null, error: new Error("Permiso inválido.") };
  const { data, error } = await supabase.rpc("gf_set_professor_permission", {
    p_user_id: userId, p_permission: permission, p_enabled: Boolean(enabled),
  });
  return { result: data || null, error };
}

export async function setProfessorPermissions(userId, values) {
  if (!supabase) return { error: noSupabase() };
  const { data, error } = await supabase.rpc("gf_set_professor_permissions", { p_user_id: userId, p_permissions: values });
  return { result: data, error };
}
