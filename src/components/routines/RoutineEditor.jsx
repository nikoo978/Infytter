import { ArrowDown, ArrowUp, Check, Minus, Plus, Save, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { matchesExerciseSearch, MUSCLE_GROUPS } from "../../services/exercises";

const input = "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#E30613]/20";
const OPTION_LIMIT = 60;

export default function RoutineEditor({ routine = null, exercises = [], onSave, busy = false, compact = false }) {
  const [title, setTitle] = useState(routine?.title || "");
  const [description, setDescription] = useState(routine?.description || "");
  const [items, setItems] = useState((routine?.items || []).map((item) => ({ ...item })));
  const [group, setGroup] = useState("Todos");
  const [query, setQuery] = useState("");

  const exerciseById = useMemo(() => {
    const map = new Map();
    exercises.forEach((exercise) => {
      map.set(String(exercise.id), exercise);
      (exercise.variant_ids || []).forEach((id) => map.set(String(id), exercise));
    });
    return map;
  }, [exercises]);
  const selectedIds = useMemo(() => new Set(items.map((item) => {
    const source = exerciseById.get(String(item.exercise_id || ""));
    return String(source?.id || item.exercise_id || "");
  })), [items, exerciseById]);
  const options = useMemo(() => exercises.filter((exercise) => {
    if (group !== "Todos" && exercise.muscle_group !== group) return false;
    return matchesExerciseSearch(exercise, query);
  }), [exercises, group, query]);
  const shownOptions = options.slice(0, OPTION_LIMIT);
  const titleLength = title.trim().length;
  const titleTooShort = titleLength === 1;
  const canSave = titleLength >= 2 && items.length > 0;

  const addExercise = (exercise) => {
    if (!exercise || selectedIds.has(String(exercise.id))) return;
    setItems((current) => [...current, {
      exercise_id: exercise.id,
      exercise_name: exercise.name,
      sets: exercise.default_sets || 3,
      reps: exercise.default_reps || "8-12",
      rest_seconds: exercise.rest_seconds ?? 60,
      notes: "",
    }]);
  };

  const patchItem = (index, patch) => setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  const removeItem = (index) => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  const moveItem = (index, direction) => setItems((current) => {
    const target = index + direction;
    if (target < 0 || target >= current.length) return current;
    const next = [...current];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });
  const changeSets = (index, delta) => patchItem(index, { sets: Math.max(1, Math.min(20, Number(items[index]?.sets || 1) + delta)) });
  const changeRest = (index, delta) => patchItem(index, { rest_seconds: Math.max(0, Math.min(1800, Number(items[index]?.rest_seconds || 0) + delta)) });

  const submit = (event) => {
    event.preventDefault();
    if (title.trim().length < 2 || !items.length) return;
    const normalizedItems = items.map((item) => {
      const sourceExercise = exerciseById.get(String(item.exercise_id || ""));
      return {
        ...item,
        exercise_id: sourceExercise?.id || item.exercise_id,
        exercise_name: sourceExercise?.name || item.exercise_name,
      };
    });
    onSave?.({ id: routine?.id || null, title: title.trim(), description: description.trim(), items: normalizedItems });
  };

  return <form onSubmit={submit} className="space-y-5">
    <section className="rounded-2xl border border-black/6 bg-white">
      <div className={`grid gap-3 p-3.5 ${compact ? "" : "sm:grid-cols-2 sm:p-4"}`}>
        <label className="text-xs font-black uppercase tracking-wide text-slate-500">Nombre de la rutina<input value={title} onChange={(event) => setTitle(event.target.value)} required minLength={2} maxLength={100} aria-invalid={titleTooShort} aria-describedby="routine-title-help" className={`mt-1.5 ${input} ${titleTooShort ? "border-red-300 focus:ring-red-200" : ""}`} placeholder="Ej. Torso A" /><span id="routine-title-help" className={`mt-1.5 block text-[10px] normal-case tracking-normal ${titleTooShort ? "font-black text-red-600" : "font-bold text-slate-400"}`}>{titleTooShort ? "Usá al menos 2 caracteres para poder guardar la rutina." : "Mínimo 2 caracteres."}</span></label>
        <label className="text-xs font-black uppercase tracking-wide text-slate-500">Objetivo o indicación<input value={description} onChange={(event) => setDescription(event.target.value)} className={`mt-1.5 ${input}`} placeholder="Ej. Fuerza e hipertrofia" /></label>
      </div>
    </section>

    <section className="rounded-2xl bg-slate-50 p-3.5 sm:p-4">
      <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-slate-500">1. Elegí ejercicios</p><p className="mt-1 text-xs text-slate-400">Tocá un ejercicio para agregarlo.</p></div><span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-slate-500 shadow-sm">{items.length} elegidos</span></div>

      <label className="mt-3 flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 focus-within:ring-2 focus-within:ring-[#E30613]/15"><Search className="size-4 shrink-0 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Buscar nombre, alias u original" /></label>

      <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"><button type="button" onClick={() => setGroup("Todos")} className={`shrink-0 rounded-full px-3 py-2 text-[11px] font-black ${group === "Todos" ? "bg-[#050505] text-white" : "bg-white text-slate-500"}`}>Todos</button>{MUSCLE_GROUPS.map((item) => <button key={item} type="button" onClick={() => setGroup(item)} className={`shrink-0 rounded-full px-3 py-2 text-[11px] font-black ${group === item ? "bg-[#050505] text-white" : "bg-white text-slate-500"}`}>{item}</button>)}</div>

      <div className="mt-3 flex items-center justify-between gap-3"><p className="text-[10px] font-black text-slate-400">{options.length} coincidencia{options.length === 1 ? "" : "s"}</p>{options.length > OPTION_LIMIT && <p className="text-right text-[10px] font-bold text-slate-400">Mostrando {OPTION_LIMIT}. Buscá o filtrá para acotar.</p>}</div>

      <div className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-0.5">{shownOptions.map((exercise) => { const added = selectedIds.has(String(exercise.id)); return <button key={exercise.id} type="button" onClick={() => addExercise(exercise)} disabled={added} className={`flex w-full items-start justify-between gap-3 rounded-xl border p-3 text-left transition ${added ? "border-emerald-100 bg-emerald-50" : "border-black/6 bg-white active:scale-[.99]"}`}><div className="min-w-0 flex-1"><p className="break-words text-sm font-black leading-5 text-slate-800">{exercise.name}</p><p className="mt-0.5 break-words text-[11px] font-bold leading-4 text-slate-400">{exercise.muscle_group}{exercise.equipment ? ` · ${exercise.equipment}` : ""}</p></div><span className={`grid size-8 shrink-0 place-items-center rounded-xl ${added ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"}`}>{added ? <Check className="size-4" /> : <Plus className="size-4" />}</span></button>; })}{!options.length && <p className="rounded-xl border border-dashed border-slate-200 bg-white p-5 text-center text-xs text-slate-400">No hay ejercicios para este filtro.</p>}</div>
    </section>

    <section>
      <div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-slate-500">2. Configurá la rutina</p><p className="mt-1 text-xs text-slate-400">Ordená y ajustá cada ejercicio.</p></div><span className="text-xs font-black text-slate-400">{items.length} ejercicios</span></div>
      <div className="space-y-3">{items.map((item, index) => { const sourceExercise = exerciseById.get(String(item.exercise_id || "")); const visibleName = sourceExercise?.name || item.exercise_name; return <article key={`${item.exercise_id || item.exercise_name}-${index}`} className="rounded-2xl border border-black/7 bg-white p-3.5 shadow-sm sm:p-4">
        <div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#050505] text-xs font-black text-white">{index + 1}</span><div className="min-w-0 flex-1"><p className="break-words font-black leading-5 text-slate-800">{visibleName}</p><p className="mt-0.5 text-[11px] font-bold text-slate-400">Series · repeticiones · descanso</p></div><div className="flex shrink-0 gap-1"><button type="button" onClick={() => moveItem(index, -1)} disabled={index === 0} className="grid size-8 place-items-center rounded-lg bg-slate-100 text-slate-500 disabled:opacity-25" aria-label="Subir ejercicio"><ArrowUp className="size-3.5" /></button><button type="button" onClick={() => moveItem(index, 1)} disabled={index === items.length - 1} className="grid size-8 place-items-center rounded-lg bg-slate-100 text-slate-500 disabled:opacity-25" aria-label="Bajar ejercicio"><ArrowDown className="size-3.5" /></button><button type="button" onClick={() => removeItem(index)} className="grid size-8 place-items-center rounded-lg bg-red-50 text-[#9E0710]" aria-label="Eliminar ejercicio"><Trash2 className="size-3.5" /></button></div></div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-2.5"><p className="text-[10px] font-black uppercase text-slate-400">Series</p><div className="mt-1.5 flex items-center gap-2"><button type="button" onClick={() => changeSets(index, -1)} className="grid size-8 place-items-center rounded-lg bg-white text-slate-600 shadow-sm"><Minus className="size-3.5" /></button><input type="number" min="1" max="20" value={item.sets} onChange={(event) => patchItem(index, { sets: Math.max(1, Math.min(20, Number(event.target.value || 1))) })} className="h-8 min-w-0 flex-1 bg-transparent text-center text-sm font-black outline-none" /><button type="button" onClick={() => changeSets(index, 1)} className="grid size-8 place-items-center rounded-lg bg-white text-slate-600 shadow-sm"><Plus className="size-3.5" /></button></div></div>
          <label className="rounded-xl bg-slate-50 p-2.5"><span className="text-[10px] font-black uppercase text-slate-400">Repeticiones</span><input value={item.reps} onChange={(event) => patchItem(index, { reps: event.target.value })} className="mt-1.5 h-8 w-full bg-transparent text-center text-sm font-black outline-none" placeholder="8-12" /></label>
          <div className="rounded-xl bg-slate-50 p-2.5"><p className="text-[10px] font-black uppercase text-slate-400">Descanso</p><div className="mt-1.5 flex items-center gap-1"><button type="button" onClick={() => changeRest(index, -15)} className="grid size-8 place-items-center rounded-lg bg-white text-slate-600 shadow-sm"><Minus className="size-3.5" /></button><input type="number" min="0" max="1800" step="5" value={item.rest_seconds} onChange={(event) => patchItem(index, { rest_seconds: Math.max(0, Math.min(1800, Number(event.target.value || 0))) })} className="h-8 min-w-0 flex-1 bg-transparent text-center text-sm font-black outline-none" /><span className="text-[10px] font-black text-slate-400">s</span><button type="button" onClick={() => changeRest(index, 15)} className="grid size-8 place-items-center rounded-lg bg-white text-slate-600 shadow-sm"><Plus className="size-3.5" /></button></div></div>
        </div>
        <input value={item.notes || ""} onChange={(event) => patchItem(index, { notes: event.target.value })} className={`mt-2 ${input}`} placeholder="Nota opcional: técnica, carga, tempo…" />
      </article>; })}{!items.length && <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-400">Elegí ejercicios arriba para empezar a armar la rutina.</p>}</div>
    </section>

    <div className="sticky bottom-0 z-10 -mx-4 border-t border-black/6 bg-white/95 px-4 pb-[max(.25rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0"><button disabled={busy || !canSave} className="btn-primary min-h-11 w-full disabled:opacity-50"><Save className="size-4" /> {busy ? "Guardando…" : routine ? "Guardar cambios" : "Crear rutina"}</button><p className={`mt-2 text-center text-[10px] font-bold ${titleTooShort ? "text-red-600" : "text-slate-400"}`}>{titleTooShort ? "El nombre necesita al menos 2 caracteres." : !items.length ? "Agregá al menos un ejercicio" : titleLength < 2 ? "Escribí un nombre de al menos 2 caracteres" : `${items.length} ejercicios listos para guardar`}</p></div>
  </form>;
}
