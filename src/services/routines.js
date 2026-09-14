import { supabase } from "./supabase";

const noSupabase = () => new Error("Supabase no configurado");

export async function getMyRoutines() {
  if (!supabase) return { routines: { personal: [], assigned: [] }, error: noSupabase() };
  const { data, error } = await supabase.rpc("gf_get_my_routines");
  return { routines: data || { personal: [], assigned: [] }, error };
}

export async function saveMyRoutine(routine) {
  if (!supabase) return { routine: null, error: noSupabase() };
  const { data, error } = await supabase.rpc("gf_save_my_routine", {
    p_routine_id: routine?.id || null,
    p_title: routine?.title || "",
    p_description: routine?.description || "",
    p_items: routine?.items || [],
  });
  return { routine: data || null, error };
}

export async function deleteMyRoutine(id) {
  if (!supabase) return { ok: false, error: noSupabase() };
  const { data, error } = await supabase.rpc("gf_delete_my_routine", { p_routine_id: id });
  return { ok: Boolean(data) && !error, error };
}

export async function removeAssignedRoutine(id) {
  if (!supabase) return { ok: false, error: noSupabase() };
  const { data, error } = await supabase.rpc("gf_remove_assigned_routine", { p_routine_id: id });
  return { ok: Boolean(data) && !error, error };
}

export async function listRoutineClients() {
  if (!supabase) return { clients: [], error: noSupabase() };
  const { data, error } = await supabase.rpc("gf_list_routine_clients");
  return { clients: data || [], error };
}

export async function listProfessorRoutines() {
  if (!supabase) return { routines: [], error: noSupabase() };
  const { data, error } = await supabase.rpc("gf_list_professor_routines");
  return { routines: data || [], error };
}

export async function saveProfessorRoutine(routine) {
  if (!supabase) return { routine: null, error: noSupabase() };
  const { data, error } = await supabase.rpc("gf_save_professor_routine", {
    p_routine_id: routine?.id || null,
    p_title: routine?.title || "",
    p_description: routine?.description || "",
    p_items: routine?.items || [],
  });
  return { routine: data || null, error };
}

export async function assignProfessorRoutine(routineId, personIds) {
  if (!supabase) return { added: 0, error: noSupabase() };
  const { data, error } = await supabase.rpc("gf_assign_professor_routine_people", {
    p_routine_id: routineId,
    p_person_ids: personIds || [],
  });
  return { added: Number(data || 0), error };
}

export async function getClientRoutinesForProfessor(personId) {
  if (!supabase) return { routines: [], error: noSupabase() };
  const { data, error } = await supabase.rpc("gf_get_person_routines_for_professor", {
    p_person_id: personId,
  });
  return { routines: data || [], error };
}
