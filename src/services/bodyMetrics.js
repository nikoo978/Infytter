import { supabase } from "./supabase";

const noSupabase = () => new Error("Supabase no configurado");
const num = (value) => value === "" || value == null ? null : Number(value);

const payload = (values = {}) => ({
  p_weight_kg: num(values.weightKg),
  p_height_cm: num(values.heightCm),
  p_waist_cm: num(values.waistCm),
  p_neck_cm: num(values.neckCm),
  p_hip_cm: num(values.hipCm),
  p_sex: values.sex || null,
  p_notes: String(values.notes || "").trim(),
});

export async function getMyBodyMetrics(limit = 30) {
  if (!supabase) return { personId: null, items: [], error: noSupabase() };
  const { data, error } = await supabase.rpc("gf_get_my_body_metrics", { p_limit: limit });
  return { personId: data?.personId || null, items: data?.items || [], error };
}

export async function saveMyBodyMetric(values) {
  if (!supabase) return { item: null, error: noSupabase() };
  const { data, error } = await supabase.rpc("gf_save_my_body_metric", payload(values));
  return { item: data || null, error };
}

export async function deleteMyBodyMetric(metricId) {
  if (!supabase) return { ok: false, error: noSupabase() };
  const { data, error } = await supabase.rpc("gf_delete_my_body_metric", { p_metric_id: metricId });
  return { ok: Boolean(data) && !error, error };
}

export async function getPersonBodyMetrics(personId, limit = 30) {
  if (!supabase) return { personId, items: [], error: noSupabase() };
  const { data, error } = await supabase.rpc("gf_get_person_body_metrics", { p_person_id: personId, p_limit: limit });
  return { personId: data?.personId || personId, items: data?.items || [], error };
}

export async function savePersonBodyMetric(personId, values) {
  if (!supabase) return { item: null, error: noSupabase() };
  const { data, error } = await supabase.rpc("gf_save_person_body_metric", { p_person_id: personId, ...payload(values) });
  return { item: data || null, error };
}

export async function deletePersonBodyMetric(personId, metricId) {
  if (!supabase) return { ok: false, error: noSupabase() };
  const { data, error } = await supabase.rpc("gf_delete_person_body_metric", { p_person_id: personId, p_metric_id: metricId });
  return { ok: Boolean(data) && !error, error };
}
