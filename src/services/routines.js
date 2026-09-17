import { supabase } from "./supabase";

const noSupabase = () => new Error("Supabase no configurado");

export async function getMyRoutines() {
  if (!supabase) return { routines: { personal: [], assigned: [] }, error: noSupabase() };
  const { data, error } = await supabase.rpc("gf_get_my_routines");
  return { routines: data || { personal: [], assigned: [] }, error };
}

export async function saveMyRoutine(routine) {
  if (!supabase) return { routine: null, error: noSupabase() };
  const { data, error } = await supabase.rpc("gf_save_my_routine_v2", {
    p_routine_id: routine?.id || null,
    p_title: routine?.title || "",
    p_description: routine?.description || "",
    p_items: routine?.items || [],
    p_schedule_days: routine?.scheduleDays || [],
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

export async function getWorkoutHistory(routineId, limit = 8) {
  if (!supabase) return { history: { recent: [], lastByExercise: {} }, error: noSupabase() };
  const { data, error } = await supabase.rpc("gf_get_workout_history", {
    p_routine_id: routineId,
    p_limit: limit,
  });
  return { history: data || { recent: [], lastByExercise: {} }, error };
}

export async function getExercisePerformance(exerciseKey, limit = 12) {
  if (!supabase) return { performance: { stats: {}, trend: [], recent: [] }, error: noSupabase() };
  const { data, error } = await supabase.rpc("gf_get_exercise_performance", {
    p_exercise_key: exerciseKey,
    p_limit: limit,
  });
  return { performance: data || { stats: {}, trend: [], recent: [] }, error };
}

export async function getMyTrainingOverview(limit = 12) {
  if (!supabase) return { overview: { last30: {}, recent: [] }, error: noSupabase() };
  const { data, error } = await supabase.rpc("gf_get_my_training_overview", { p_limit: limit });
  return { overview: data || { last30: {}, recent: [] }, error };
}

export async function getPersonTrainingOverview(personId, limit = 12) {
  if (!supabase) return { overview: { last30: {}, recent: [] }, error: noSupabase() };
  const { data, error } = await supabase.rpc("gf_get_person_training_overview", {
    p_person_id: personId,
    p_limit: limit,
  });
  return { overview: data || { last30: {}, recent: [] }, error };
}

export async function openWorkoutSession(routineId, startedAt = new Date().toISOString()) {
  if (!supabase) return { session: null, error: noSupabase() };
  const { data, error } = await supabase.rpc("gf_open_workout_session", {
    p_routine_id: routineId,
    p_started_at: startedAt,
  });
  return { session: data || null, error };
}

export async function saveWorkoutProgress({ sessionId, sets }) {
  if (!supabase) return { result: null, error: noSupabase() };
  const { data, error } = await supabase.rpc("gf_save_workout_progress", {
    p_session_id: sessionId,
    p_sets: sets || [],
  });
  return { result: data || null, error };
}

export async function resetWorkoutSession({ sessionId, startedAt = new Date().toISOString() }) {
  if (!supabase) return { session: null, error: noSupabase() };
  const { data, error } = await supabase.rpc("gf_reset_workout_session", {
    p_session_id: sessionId,
    p_started_at: startedAt,
  });
  return { session: data || null, error };
}

export async function finishWorkoutSession({ sessionId, completedAt = new Date().toISOString() }) {
  if (!supabase) return { summary: null, error: noSupabase() };
  const { data, error } = await supabase.rpc("gf_finish_workout_session", {
    p_session_id: sessionId,
    p_completed_at: completedAt,
  });
  return { summary: data || null, error };
}

// Compatibilidad temporal con clientes que todavía tengan V.1.08.1 en caché.
export async function saveWorkoutSession({ routineId, startedAt, completedAt, sets }) {
  if (!supabase) return { summary: null, error: noSupabase() };
  const { data, error } = await supabase.rpc("gf_save_workout_session", {
    p_routine_id: routineId,
    p_started_at: startedAt,
    p_completed_at: completedAt,
    p_sets: sets || [],
  });
  return { summary: data || null, error };
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
  const { data, error } = await supabase.rpc("gf_save_professor_routine_v2", {
    p_routine_id: routine?.id || null,
    p_title: routine?.title || "",
    p_description: routine?.description || "",
    p_items: routine?.items || [],
    p_schedule_days: routine?.scheduleDays || [],
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
