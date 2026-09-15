import { ChevronDown, ChevronUp, Dumbbell, ExternalLink, Pencil, Plus, RefreshCw, Search, Trash2, Video } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ExerciseGifGallery } from "../components/exercises/ExerciseGif";
import MuscleMap from "../components/exercises/MuscleMap";
import FormDialog from "../components/ui/FormDialog";
import { useAuth } from "../context/AuthContext";
import { createExercise, deleteExercise, EXERCISE_CATEGORIES, listExercises, matchesExerciseSearch, MUSCLE_GROUPS, updateExercise } from "../services/exercises";

const input = "mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#E30613]/20";
const PAGE_SIZE = 48;

function normalizePayload(form) {
  return {
    name: String(form.get("name") || "").trim(),
    muscle_group: String(form.get("muscle_group") || "Cuerpo completo"),
    category: String(form.get("category") || "Hipertrofia"),
    equipment: String(form.get("equipment") || "").trim(),
    image_url: String(form.get("image_url") || "").trim() || null,
    video_url: String(form.get("video_url") || "").trim() || null,
    default_sets: Math.max(1, Number(form.get("default_sets") || 3)),
    default_reps: String(form.get("default_reps") || "8-12").trim(),
    rest_seconds: Math.max(0, Number(form.get("rest_seconds") || 60)),
    notes: String(form.get("notes") || "").trim(),
  };
}

function ExerciseForm({ exercise, onSubmit, busy }) {
  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <label className="sm:col-span-2 text-sm font-bold text-slate-600">Nombre<input name="name" required defaultValue={exercise?.name || ""} className={input} /></label>
      <label className="text-sm font-bold text-slate-600">Músculo<select name="muscle_group" defaultValue={exercise?.muscle_group || "Pecho"} className={input}>{MUSCLE_GROUPS.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label className="text-sm font-bold text-slate-600">Categoría<select name="category" defaultValue={exercise?.category || "Hipertrofia"} className={input}>{EXERCISE_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label className="sm:col-span-2 text-sm font-bold text-slate-600">Explicación breve<textarea name="notes" rows="3" maxLength="360" defaultValue={exercise?.notes || ""} placeholder="Una indicación corta sobre ejecución y técnica." className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-[#E30613]/20" /></label>
      <label className="sm:col-span-2 text-sm font-bold text-slate-600">Equipamiento<input name="equipment" defaultValue={exercise?.equipment || ""} placeholder="Mancuernas, barra, máquina…" className={input} /></label>
      <label className="sm:col-span-2 text-sm font-bold text-slate-600">URL imagen / GIF<input name="image_url" type="url" defaultValue={exercise?.image_url || ""} placeholder="https://…" className={input} /></label>
      <label className="sm:col-span-2 text-sm font-bold text-slate-600">URL video<input name="video_url" type="url" defaultValue={exercise?.video_url || ""} placeholder="https://…" className={input} /></label>
      <div className="sm:col-span-2 rounded-2xl bg-slate-50 p-4">
        <p className="text-xs font-black uppercase tracking-wider text-slate-500">Valores sugeridos al agregarlo a una rutina</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="text-sm font-bold text-slate-600">Series<input name="default_sets" type="number" min="1" max="20" defaultValue={exercise?.default_sets || 3} className={input} /></label>
          <label className="text-sm font-bold text-slate-600">Repeticiones<input name="default_reps" defaultValue={exercise?.default_reps || "8-12"} className={input} /></label>
          <label className="text-sm font-bold text-slate-600">Descanso seg.<input name="rest_seconds" type="number" min="0" max="1800" step="5" defaultValue={exercise?.rest_seconds ?? 60} className={input} /></label>
        </div>
      </div>
      <button disabled={busy} className="btn-primary sm:col-span-2 disabled:opacity-60">{busy ? "Guardando…" : exercise ? "Guardar cambios" : "Crear ejercicio"}</button>
    </form>
  );
}

function SecondaryNames({ exercise }) {
  const aliases = exercise?.aliases || [];
  const originalNames = exercise?.original_names?.length
    ? exercise.original_names
    : [String(exercise?.original_name || "").trim()].filter(Boolean);
  if (!aliases.length && !originalNames.length) return null;

  return (
    <div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3">
      {aliases.length > 0 && (
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">También se conoce como</p>
          <p className="mt-1 break-words text-xs font-bold leading-5 text-slate-600">{aliases.join(", ")}</p>
        </div>
      )}
      {originalNames.length > 0 && (
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Nombre original</p>
          <p className="mt-1 break-words text-xs font-bold leading-5 text-slate-600">{originalNames.join(", ")}</p>
        </div>
      )}
    </div>
  );
}

export default function Exercises() {
  const { user, role } = useAuth();
  const [exercises, setExercises] = useState([]);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("Todos");
  const [openId, setOpenId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const isManager = ["admin", "coadmin"].includes(role);
  const canCreate = ["admin", "coadmin", "profe"].includes(role);

  const load = async () => {
    setLoading(true);
    setError("");
    const result = await listExercises();
    if (result.error) setError(result.error.message || "No se pudo cargar el glosario.");
    else setExercises(result.exercises);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { setVisibleCount(PAGE_SIZE); setOpenId(""); }, [query, group]);

  const visible = useMemo(() => exercises.filter((exercise) => {
    if (group !== "Todos" && exercise.muscle_group !== group) return false;
    return matchesExerciseSearch(exercise, query);
  }), [exercises, group, query]);
  const shown = visible.slice(0, visibleCount);

  const submitCreate = async (event) => {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    const result = await createExercise(normalizePayload(new FormData(event.currentTarget)));
    if (result.error) setError(result.error.message || "No se pudo crear el ejercicio.");
    else { setCreating(false); setMessage("Ejercicio agregado al glosario."); await load(); }
    setBusy(false);
  };

  const submitEdit = async (event) => {
    event.preventDefault();
    if (!editing) return;
    setBusy(true); setError(""); setMessage("");
    const result = await updateExercise(editing.id, normalizePayload(new FormData(event.currentTarget)));
    if (result.error) setError(result.error.message || "No se pudo actualizar el ejercicio.");
    else { setEditing(null); setMessage("Ejercicio actualizado."); await load(); }
    setBusy(false);
  };

  const remove = async (exercise) => {
    if (!window.confirm(`¿Eliminar ${exercise.name}?`)) return;
    setBusy(true); setError("");
    const result = await deleteExercise(exercise.id);
    if (!result.ok) setError(result.error?.message || "No se pudo eliminar el ejercicio.");
    else { setMessage("Ejercicio eliminado."); await load(); }
    setBusy(false);
  };

  const canEdit = (exercise) => isManager || (!exercise.is_system && exercise.created_by === user?.id);

  return (
    <div className="mx-auto max-w-[1480px] space-y-4 sm:space-y-6">
      <section className="page-head gap-4">
        <div>
          <p className="eyebrow">Glosario</p>
          <h1 className="page-title">Ejercicios</h1>
          <p className="page-subtitle">Biblioteca completa clasificada por músculo. Cada ejercicio aparece una sola vez; cuando tiene variantes visuales, todos sus GIFs se muestran dentro del mismo detalle.</p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <button onClick={load} disabled={loading} className="btn-secondary flex-1 sm:flex-none"><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /><span className="hidden sm:inline">Actualizar</span></button>
          {canCreate && <button onClick={() => setCreating(true)} className="btn-primary flex-1 sm:flex-none"><Plus className="size-4" /> Nuevo</button>}
        </div>
      </section>

      {message && <p className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</p>}
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}

      <section className="panel space-y-3 p-3 sm:p-4">
        <label className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 focus-within:ring-2 focus-within:ring-[#E30613]/15">
          <Search className="size-4 shrink-0 text-slate-400" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Buscar nombre, alias u original" />
        </label>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-black text-slate-400">{loading ? "Cargando…" : `${visible.length} de ${exercises.length} ejercicios`}</p>
          {query && <button type="button" onClick={() => setQuery("")} className="text-xs font-black text-[#9E0710]">Limpiar</button>}
        </div>

        <MuscleMap value={group} onChange={setGroup} />

        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Todos los filtros</p>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button type="button" onClick={() => setGroup("Todos")} className={`shrink-0 rounded-full px-3 py-2 text-xs font-black ${group === "Todos" ? "bg-[#050505] text-white" : "bg-slate-100 text-slate-600"}`}>Todos</button>
          {MUSCLE_GROUPS.map((item) => <button key={item} type="button" onClick={() => setGroup(item)} className={`shrink-0 rounded-full px-3 py-2 text-xs font-black ${group === item ? "bg-[#E30613] text-white" : "bg-slate-100 text-slate-600"}`}>{item}</button>)}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        {shown.map((exercise) => {
          const open = openId === exercise.id;
          return (
            <article key={exercise.id} className="overflow-hidden rounded-[22px] border border-black/8 bg-white shadow-sm">
              <button onClick={() => setOpenId(open ? "" : exercise.id)} className="flex min-h-16 w-full items-start justify-between gap-4 p-4 text-left">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span className="mt-0.5 grid size-11 shrink-0 place-items-center rounded-2xl bg-red-50 text-[#E30613]"><Dumbbell className="size-5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-black leading-5 text-slate-900">{exercise.name}</p>
                    <p className="mt-1 break-words text-xs font-bold leading-4 text-slate-400">{exercise.muscle_group}{exercise.equipment ? ` · ${exercise.equipment}` : ""}</p>
                  </div>
                </div>
                {open ? <ChevronUp className="mt-1 size-4 shrink-0 text-slate-400" /> : <ChevronDown className="mt-1 size-4 shrink-0 text-slate-400" />}
              </button>

              {open && (
                <div className="border-t border-slate-100 p-4">
                  <h2 className="text-lg font-black leading-6 text-slate-900">{exercise.name}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{exercise.notes || "La explicación breve de este ejercicio se completará más adelante."}</p>
                  <SecondaryNames exercise={exercise} />
                  <div className="mt-3 rounded-xl bg-slate-50 p-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Referencia</p>
                    <p className="mt-1 text-xs font-bold text-slate-600">{exercise.category} · {exercise.default_sets || 3} series · {exercise.default_reps || "8-12"} reps · {exercise.rest_seconds ?? 60}s</p>
                  </div>
                  <div className="mt-4"><ExerciseGifGallery exercise={exercise} /></div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {exercise.video_url && <a href={exercise.video_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700"><Video className="size-3.5" /> Ver video <ExternalLink className="size-3" /></a>}
                    {canEdit(exercise) && <button onClick={() => setEditing(exercise)} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700"><Pencil className="size-3.5" /> Editar</button>}
                    {canEdit(exercise) && !exercise.is_system && <button onClick={() => remove(exercise)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-[#9E0710]"><Trash2 className="size-3.5" /> Eliminar</button>}
                  </div>
                </div>
              )}
            </article>
          );
        })}
        {!loading && !visible.length && <div className="panel md:col-span-2"><p className="py-8 text-center text-sm text-slate-400">No hay ejercicios para ese filtro.</p></div>}
      </section>

      {shown.length < visible.length && <button type="button" onClick={() => setVisibleCount((value) => value + PAGE_SIZE)} className="min-h-11 w-full rounded-2xl border border-black/10 bg-white text-sm font-black text-slate-700 shadow-sm">Mostrar más · {visible.length - shown.length} restantes</button>}

      <FormDialog open={creating} onOpenChange={setCreating} title="Nuevo ejercicio" description="Se agrega al glosario compartido del gimnasio."><ExerciseForm onSubmit={submitCreate} busy={busy} /></FormDialog>
      <FormDialog open={!!editing} onOpenChange={(value) => { if (!value) setEditing(null); }} title={`Editar ${editing?.name || "ejercicio"}`} description="Actualizá la explicación o el material multimedia."><ExerciseForm exercise={editing} onSubmit={submitEdit} busy={busy} /></FormDialog>
    </div>
  );
}
