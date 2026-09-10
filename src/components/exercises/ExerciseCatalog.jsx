import { ChevronDown, ChevronUp, Dumbbell, ExternalLink, Search, Video } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { listExercises, matchesExerciseSearch, MUSCLE_GROUPS } from "../../services/exercises";
import { ExerciseGifGallery } from "./ExerciseGif";
import MuscleMap from "./MuscleMap";

const PAGE_SIZE = 48;

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

export default function ExerciseCatalog({ compact = false, preview = false }) {
  const [exercises, setExercises] = useState([]);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("Todos");
  const [openId, setOpenId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const load = async () => {
    setLoading(true);
    setError("");
    const result = await listExercises();
    if (result.error) setError(result.error.message || "No se pudo cargar el glosario.");
    else setExercises(result.exercises || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [preview]);
  useEffect(() => { setVisibleCount(PAGE_SIZE); setOpenId(""); }, [query, group]);

  const visible = useMemo(() => exercises.filter((exercise) => {
    if (group !== "Todos" && exercise.muscle_group !== group) return false;
    return matchesExerciseSearch(exercise, query);
  }), [exercises, group, query]);
  const shown = visible.slice(0, visibleCount);

  return (
    <section className="space-y-3">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#E30613]">Consulta</p>
        <h1 className={`${compact ? "text-xl" : "text-2xl"} mt-1 font-black text-[#050505]`}>Ejercicios</h1>
        <p className="mt-1 text-xs leading-5 text-slate-500">Buscá por nombre argentino, alias, nombre original, músculo o equipamiento y revisá la técnica y todos los GIFs disponibles del movimiento.</p>
      </div>

      <div className="rounded-[20px] bg-white p-3 shadow-sm">
        <label className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-3">
          <Search className="size-4 text-slate-400" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Buscar nombre, alias u original" />
        </label>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-[11px] font-black text-slate-400">{loading ? "Cargando…" : `${visible.length} ejercicio${visible.length === 1 ? "" : "s"}`}</p>
          {query && <button type="button" onClick={() => setQuery("")} className="text-[11px] font-black text-[#9E0710]">Limpiar búsqueda</button>}
        </div>

        <div className="mt-3"><MuscleMap value={group} onChange={setGroup} /></div>

        <p className="mt-3 text-[10px] font-black uppercase tracking-wider text-slate-400">Todos los filtros</p>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button type="button" onClick={() => setGroup("Todos")} className={`shrink-0 rounded-full px-3 py-2 text-xs font-black ${group === "Todos" ? "bg-[#050505] text-white" : "bg-slate-100 text-slate-600"}`}>Todos</button>
          {MUSCLE_GROUPS.map((item) => <button key={item} type="button" onClick={() => setGroup(item)} className={`shrink-0 rounded-full px-3 py-2 text-xs font-black ${group === item ? "bg-[#E30613] text-white" : "bg-slate-100 text-slate-600"}`}>{item}</button>)}
        </div>
      </div>

      {loading && <p className="rounded-2xl bg-white p-4 text-sm font-bold text-slate-500">Cargando ejercicios…</p>}
      {error && <p className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</p>}

      <div className="space-y-2">
        {shown.map((exercise) => {
          const open = openId === exercise.id;
          return (
            <article key={exercise.id} className="overflow-hidden rounded-[20px] border border-black/7 bg-white shadow-sm">
              <button type="button" onClick={() => setOpenId(open ? "" : exercise.id)} className="flex min-h-16 w-full items-start justify-between gap-3 p-3.5 text-left" aria-expanded={open}>
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-2xl bg-red-50 text-[#E30613]"><Dumbbell className="size-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-black leading-5 text-slate-900">{exercise.name}</p>
                    <p className="mt-1 break-words text-[11px] font-bold leading-4 text-slate-400">{exercise.muscle_group}{exercise.equipment ? ` · ${exercise.equipment}` : ""}</p>
                  </div>
                </div>
                {open ? <ChevronUp className="mt-1 size-4 shrink-0 text-slate-400" /> : <ChevronDown className="mt-1 size-4 shrink-0 text-slate-400" />}
              </button>

              {open && (
                <div className="border-t border-slate-100 p-3.5">
                  <h2 className="text-base font-black leading-6 text-slate-900">{exercise.name}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{exercise.notes || "La explicación de este ejercicio todavía no fue cargada."}</p>
                  <SecondaryNames exercise={exercise} />
                  <div className="mt-3 rounded-xl bg-slate-50 p-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Referencia</p>
                    <p className="mt-1 text-xs font-bold text-slate-600">{exercise.default_sets || 3} series · {exercise.default_reps || "8-12"} reps · {exercise.rest_seconds ?? 60}s descanso</p>
                  </div>
                  <div className="mt-3"><ExerciseGifGallery exercise={exercise} className="max-h-56 w-full object-contain" /></div>
                  {exercise.video_url && <a href={exercise.video_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[#050505] px-3 text-xs font-black text-white"><Video className="size-3.5" /> Ver video <ExternalLink className="size-3" /></a>}
                </div>
              )}
            </article>
          );
        })}
        {!loading && !visible.length && <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-7 text-center text-sm text-slate-400">No hay ejercicios para ese filtro.</p>}
      </div>

      {shown.length < visible.length && <button type="button" onClick={() => setVisibleCount((value) => value + PAGE_SIZE)} className="min-h-11 w-full rounded-2xl border border-black/10 bg-white text-sm font-black text-slate-700 shadow-sm">Mostrar más · {visible.length - shown.length} restantes</button>}
    </section>
  );
}
