import { supabase } from "./supabase";

export const ROLE_LABELS = {
  admin: "Admin master",
  coadmin: "Coadmin",
  profe: "Profe",
  cliente: "Cliente",
};

export const ROLE_OPTIONS = ["coadmin", "profe", "cliente"];

export async function getMyProfile() {
  if (!supabase) return { profile: null, error: new Error("Supabase no configurado") };
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user?.id) return { profile: null, error: authError || new Error("Sin sesión") };
  const { data, error } = await supabase
    .from("gf_profiles")
    .select("user_id,email,display_name,dni,role,is_master,can_grant_access,created_at,updated_at")
    .eq("user_id", authData.user.id)
    .maybeSingle();
  return { profile: data || null, error };
}

export async function listProfiles() {
  if (!supabase) return { profiles: [], error: new Error("Supabase no configurado") };
  const { data, error } = await supabase.rpc("gf_list_accounts");
  return { profiles: data || [], error };
}

export async function setUserRoleByEmail(email, role) {
  if (!supabase) return { ok: false, error: new Error("Supabase no configurado") };
  const { data, error } = await supabase.rpc("gf_set_user_role", {
    target_email: String(email || "").trim().toLowerCase(),
    new_role: role,
  });
  return { ok: !error, profile: data || null, error };
}

export async function setAccountLink(userId, personId, kind) {
  if (!supabase) return { ok: false, error: new Error("Supabase no configurado") };
  const { data, error } = await supabase.rpc("gf_set_account_link", {
    target_user_id: userId,
    target_person_id: personId,
    target_kind: kind,
  });
  return { ok: !error, result: data || null, error };
}

export async function unlinkAccount(userId) {
  if (!supabase) return { ok: false, error: new Error("Supabase no configurado") };
  const { data, error } = await supabase.rpc("gf_unlink_account", { target_user_id: userId });
  return { ok: !error, result: data, error };
}

export async function deleteRegisteredAccount(userId) {
  if (!supabase) return { ok: false, result: null, error: new Error("Supabase no configurado") };
  const { data, error } = await supabase.rpc("gf_delete_registered_account", { target_user_id: userId });
  return { ok: !error && Boolean(data?.ok), result: data || null, error };
}

export async function listAccountEvents(limit = 10) {
  if (!supabase) return { events: [], error: new Error("Supabase no configurado") };
  const { data, error } = await supabase.rpc("gf_list_account_events", { p_limit: limit });
  return { events: data || [], error };
}

export async function getMyClientPlatformAccess() {
  if (!supabase) return { access: null, error: new Error("Supabase no configurado") };
  const { data, error } = await supabase.rpc("gf_get_my_platform_access");
  return { access: data || null, error };
}

export async function getMyClientPortal() {
  if (!supabase) return { portal: null, error: new Error("Supabase no configurado") };
  const { data, error } = await supabase.rpc("gf_get_my_client_portal");
  return { portal: data || null, error };
}

export function permissionsForRole(role, profile = null) {
  const professorAccess = role === "profe" && Boolean(profile?.can_grant_access);
  return {
    role,
    isMaster: role === "admin",
    isStaff: ["admin", "coadmin", "profe"].includes(role),
    canManageRoles: ["admin", "coadmin"].includes(role),
    canUseLocalMode: role === "admin",
    canOperate: ["admin", "coadmin"].includes(role),
    canDelete: role === "admin",
    canAccessControl: ["admin", "coadmin"].includes(role),
    canGrantManualAccess: professorAccess,
    canViewFinance: ["admin", "coadmin"].includes(role),
    canManageNotifications: ["admin", "coadmin"].includes(role),
  };
}
