import { useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { MUSCLE_GROUPS } from "../../services/exercises";
import MuscleMap from "./MuscleMap";

export default function ExerciseExplorer({ query, onQueryChange, group, onGroupChange, count, loading }) {
  const muscles = useRef(null);
  useEffect(() => {
    const row = muscles.current; const selected = row?.querySelector('[aria-pressed="true"]');
    if (selected) row.scrollTo({ left: Math.max(0, selected.offsetLeft - row.offsetLeft - (row.clientWidth - selected.offsetWidth) / 2), behavior: "smooth" });
  }, [group]);
  return <section className="exercise-explorer overflow-hidden rounded-[24px] border border-black/5 bg-white p-3 shadow-sm sm:p-5" aria-label="Explorar ejercicios">
    <MuscleMap minimal value={group} onChange={onGroupChange} />
    <label className="mt-3 flex min-h-12 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 focus-within:ring-2 focus-within:ring-[#E30613]/20">
      <Search className="size-5 shrink-0 text-[#E30613]" aria-hidden="true" />
      <input value={query} onChange={(event) => onQueryChange(event.target.value)} className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none" aria-label="Buscar ejercicios" placeholder="Buscar ejercicio" />
      {query && <button type="button" onClick={() => onQueryChange("")} className="grid size-11 shrink-0 place-items-center rounded-xl text-slate-500" aria-label="Limpiar búsqueda"><X className="size-4" /></button>}
    </label>
    <div ref={muscles} className="relative mt-3 flex flex-nowrap gap-2 overflow-x-auto overscroll-x-contain pb-2" role="group" aria-label="Filtrar por músculo">
      {["Todos", ...MUSCLE_GROUPS].map((muscle) => <button key={muscle} type="button" aria-pressed={group === muscle} onClick={() => onGroupChange(muscle)} className={`min-h-11 shrink-0 whitespace-nowrap rounded-full px-3 text-xs font-bold transition ${group === muscle ? "bg-[#E30613] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{muscle}</button>)}
    </div>
    <p className="mt-3 text-right text-xs font-bold text-slate-500" role="status" aria-live="polite">{loading ? "Cargando…" : `${count} ejercicio${count === 1 ? "" : "s"}`}</p>
  </section>;
}
