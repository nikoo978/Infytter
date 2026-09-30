import { metadataForLibraryCode } from "../data/exerciseMetadata";
import { supabase } from "./supabase";

export const MUSCLE_GROUPS = ["Pecho", "Espalda", "Hombros", "Bíceps", "Tríceps", "Antebrazos", "Core", "Glúteos", "Cuádriceps", "Isquiotibiales", "Gemelos", "Cadera", "Cuello", "Cuerpo completo", "Cardio", "Movilidad"];
export const EXERCISE_CATEGORIES = ["Fuerza", "Hipertrofia", "Técnica", "Cardio", "Movilidad"];

const EXERCISE_PAGE_SIZE = 500;
const EXERCISE_SELECT = "id,name,muscle_group,category,equipment,image_url,video_url,default_sets,default_reps,rest_seconds,notes,is_system,created_by,created_at,updated_at,library_codes,aliases,original_name,is_hidden";

export function normalizeExerciseSearch(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const uniqueValues = (values = []) => {
  const seen = new Set();
  const result = [];
  values.flat().forEach((value) => {
    const text = String(value ?? "").trim();
    if (!text) return;
    const key = normalizeExerciseSearch(text);
    if (!key || seen.has(key)) return;
    seen.add(key);
    result.push(text);
  });
  return result;
};

function buildExerciseSearchIndex(exercise) {
  return normalizeExerciseSearch([
    exercise?.name,
    exercise?.original_name,
    ...(exercise?.original_names || []),
    exercise?.muscle_group,
    exercise?.category,
    exercise?.equipment,
    exercise?.notes,
    ...(exercise?.aliases || []),
    ...(exercise?.library_codes || []),
  ].filter(Boolean).join(" "));
}

export function matchesExerciseSearch(exercise, query = "") {
  const normalizedQuery = normalizeExerciseSearch(query);
  if (!normalizedQuery) return true;
  const haystack = exercise?.search_index || buildExerciseSearchIndex(exercise);
  return normalizedQuery.split(" ").every((token) => haystack.includes(token));
}

function prepareExercise(exercise) {
  const libraryCode = Number(exercise?.library_codes?.[0] || 0) || null;
  const metadata = libraryCode ? metadataForLibraryCode(libraryCode) : null;
  const enriched = {
    ...exercise,
    name: metadata?.name || exercise?.name || "",
    aliases: metadata ? metadata.aliases : (Array.isArray(exercise?.aliases) ? exercise.aliases : []),
    original_name: metadata?.originalName || exercise?.original_name || "",
    original_names: uniqueValues([metadata?.originalName || exercise?.original_name || ""]),
    library_code: libraryCode,
    variant_ids: exercise?.id ? [String(exercise.id)] : [],
    variant_count: 1,
  };
  return { ...enriched, search_index: buildExerciseSearchIndex(enriched) };
}

function groupSystemVariants(exercises) {
  const custom = [];
  const grouped = new Map();

  exercises.forEach((exercise) => {
    if (!exercise?.is_system || !exercise?.library_code) {
      custom.push(exercise);
      return;
    }

    const key = normalizeExerciseSearch(exercise.name);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(exercise);
  });

  const system = [...grouped.values()].map((variants) => {
    const ordered = [...variants].sort((a, b) => Number(a.library_code || 0) - Number(b.library_code || 0));
    const canonical = ordered[0];
    const libraryCodes = [...new Set(ordered.flatMap((item) => item.library_codes || []).map(Number).filter((value) => Number.isInteger(value) && value > 0))].sort((a, b) => a - b);
    const aliases = uniqueValues(ordered.flatMap((item) => item.aliases || []));
    const originalNames = uniqueValues(ordered.flatMap((item) => item.original_names?.length ? item.original_names : [item.original_name]));
    const imageUrls = uniqueValues(ordered.map((item) => item.image_url));
    const videoUrls = uniqueValues(ordered.map((item) => item.video_url));
    const groupedExercise = {
      ...canonical,
      aliases,
      original_name: originalNames[0] || canonical.original_name || "",
      original_names: originalNames,
      library_codes: libraryCodes,
      library_code: libraryCodes[0] || canonical.library_code || null,
      variant_ids: ordered.map((item) => String(item.id)),
      variant_count: ordered.length,
      has_variants: ordered.length > 1,
      variant_image_urls: imageUrls,
      video_url: videoUrls[0] || canonical.video_url || null,
    };
    return { ...groupedExercise, search_index: buildExerciseSearchIndex(groupedExercise) };
  });

  return [...system, ...custom]
    .map((exercise) => ({
      ...exercise,
      has_variants: Boolean(exercise.has_variants),
      variant_count: Math.max(1, Number(exercise.variant_count || 1)),
      variant_ids: exercise.variant_ids?.length ? exercise.variant_ids : [String(exercise.id)],
      original_names: exercise.original_names?.length ? exercise.original_names : uniqueValues([exercise.original_name]),
    }))
    .sort((a, b) => {
      const muscle = String(a.muscle_group || "").localeCompare(String(b.muscle_group || ""), "es");
      return muscle || String(a.name || "").localeCompare(String(b.name || ""), "es");
    });
}

export async function listExercises() {
  if (!supabase) return { exercises: [], error: new Error("Supabase no configurado") };

  const exercises = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("gf_exercises")
      .select(EXERCISE_SELECT)
      .order("muscle_group", { ascending: true })
      .order("name", { ascending: true })
      .range(from, from + EXERCISE_PAGE_SIZE - 1);

    if (error) return { exercises: [], error };

    const batch = (data || []).map(prepareExercise);
    exercises.push(...batch);
    if (batch.length < EXERCISE_PAGE_SIZE) break;
    from += EXERCISE_PAGE_SIZE;
  }

  return { exercises: groupSystemVariants(exercises), error: null };
}

export async function createExercise(payload) {
  if (!supabase) return { exercise: null, error: new Error("Supabase no configurado") };
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user?.id) return { exercise: null, error: authError || new Error("Sin sesión") };
  const { data, error } = await supabase
    .from("gf_exercises")
    .insert({ ...payload, created_by: authData.user.id, is_system: false })
    .select()
    .single();
  return { exercise: data ? prepareExercise(data) : null, error };
}

export async function updateExercise(id, payload) {
  if (!supabase) return { exercise: null, error: new Error("Supabase no configurado") };
  const { data, error } = await supabase
    .from("gf_exercises")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  return { exercise: data ? prepareExercise(data) : null, error };
}

export async function deleteExercise(id) {
  if (!supabase) return { ok: false, error: new Error("Supabase no configurado") };
  const { error } = await supabase.from("gf_exercises").delete().eq("id", id);
  return { ok: !error, error };
}

// Update all grouped variants together so a hidden GIF cannot remain in the catalog.
export async function setExerciseVisibility(exercise, hidden) {
  if (!supabase) return { error: new Error("Supabase no configurado") };
  const ids = exercise.variant_ids?.length ? exercise.variant_ids : [exercise.id];
  const { error } = await supabase.from("gf_exercises").update({ is_hidden: hidden }).in("id", ids);
  return { error };
}
