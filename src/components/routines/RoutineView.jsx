import { CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { normalizeExerciseSearch } from "../../services/exercises";
import { ExerciseGifGallery } from "../exercises/ExerciseGif";

const GYM_TIME_ZONE = "America/Argentina/Buenos_Aires";

function gymDateKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: GYM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type) => parts.find((part) => part.type === type)?.value || "00";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function readCompleted(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return new Set(Array.isArray(value) ? value.map(String) : []);
  } catch {
    return new Set();
  }
}

export default function RoutineView({ routine, exercises = [], actions = null, preview = false, progressScope = "client" }) {
  const [open, setOpen] = useState(false);
  const [openExercise, setOpenExercise] = useState("");
  const storageKey = useMemo(
    () => `infytter-routine-progress-v1:${progressScope}:${routine?.id || normalizeExerciseSearch(routine?.title)}:${gymDateKey()}`,
    [progressScope, routine?.id, routine?.title],
  );
  const [completed, setCompleted] = useState(() => preview ? new Set() : readCompleted(storageKey));

  const exerciseById = useMemo(() => {
    const map = new Map();
    exercises.forEach((exercise) => {
      if (exercise?.id) map.set(String(exercise.id), exercise);
      (exercise?.variant_ids || []).forEach((id) => map.set(String(id), exercise));
    });
    return map;
  }, [exercises]);

  const exerciseByName = useMemo(() => {
    const map = new Map();
    exercises.forEach((exercise) => {
      const key = normalizeExerciseSearch(exercise?.name);
      if (key && !map.has(key)) map.set(key, exercise);
    });
    return map;
  }, [exercises]);

  useEffect(() => {
    setCompleted(preview ? new Set() : readCompleted(storageKey));
    setOpenExercise("");
  }, [storageKey, preview]);

  const itemKey = (item, index) => String(item?.id || item?.exercise_id || `${normalizeExerciseSearch(item?.exercise_name)}-${index}`);
  const toggleCompleted = (key) => {
    setCompleted((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      if (!preview) {
        try { localStorage.setItem(storageKey, JSON.stringify([...next])); } catch { /* almacenamiento opcional */ }
      }
      return next;
    });
  };

  const total = routine?.items?.length || 0;
  const completedCount = (routine?.items || []).reduce((count, item, index) => count + (completed.has(itemKey(item, index)) ? 1 : 0), 0);

  return (
    <article className="rounded-[22px] bg-white p-4 shadow-sm">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex min-h-12 w-full items-start justify-between gap-3 text-left" aria-expanded={open}>
        <div className="min-w-0">
          <p className="truncate font-black text-slate-900">{routine.title}</p>
          <p className="mt-1 text-xs text-slate-400">{total} ejercicios{routine.description ? ` · ${routine.description}` : ""}</p>
          {total > 0 && <p className="mt-1 text-[10px] font-black text-[#E30613]">Hoy: {completedCount} / {total} completados</p>}
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500">{open ? "Cerrar" : "Ver"}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          {(routine.items || []).map((item, index) => {
            const key = itemKey(item, index);
            const done = completed.has(key);
            const source = exerciseById.get(String(item.exercise_id || "")) || exerciseByName.get(normalizeExerciseSearch(item.exercise_name));
            const expanded = openExercise === key;
            return (
              <div key={key} className={`overflow-hidden rounded-xl border transition ${done ? "border-emerald-200 bg-emerald-50/70" : "border-transparent bg-slate-50"}`}>
                <div className="flex items-start gap-3 p-3">
                  <label className="mt-0.5 grid size-7 shrink-0 cursor-pointer place-items-center" title={done ? "Marcar como pendiente" : "Marcar como realizado"}>
                    <input
                      type="checkbox"
                      checked={done}
                      onChange={() => toggleCompleted(key)}
                      className="size-5 cursor-pointer accent-[#E30613]"
                      aria-label={`${done ? "Desmarcar" : "Marcar"} ${item.exercise_name}`}
                    />
                  </label>
                  <button type="button" onClick={() => setOpenExercise(expanded ? "" : key)} className="flex min-w-0 flex-1 items-start justify-between gap-3 text-left" aria-expanded={expanded}>
                    <div className="min-w-0 flex-1">
                      <p className={`break-words text-sm font-black leading-5 ${done ? "text-slate-400 line-through" : "text-slate-800"}`}>{index + 1}. {item.exercise_name}</p>
                      <p className={`mt-1 text-xs font-bold ${done ? "text-emerald-700/60" : "text-slate-500"}`}>{item.sets} series · {item.reps} reps · {item.rest_seconds}s descanso</p>
                    </div>
                    {expanded ? <ChevronUp className="mt-0.5 size-4 shrink-0 text-slate-400" /> : <ChevronDown className="mt-0.5 size-4 shrink-0 text-slate-400" />}
                  </button>
                </div>

                {expanded && (
                  <div className="border-t border-black/5 bg-white p-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Cómo realizarlo</p>
                    <p className="mt-1.5 text-sm leading-6 text-slate-600">{source?.notes || "La explicación breve de este ejercicio todavía no está disponible."}</p>
                    {item.notes && <div className="mt-3 rounded-xl bg-amber-50 p-3"><p className="text-[10px] font-black uppercase tracking-wider text-amber-700">Indicación de la rutina</p><p className="mt-1 text-xs leading-5 text-amber-800">{item.notes}</p></div>}
                    {source && <div className="mt-3"><ExerciseGifGallery exercise={source} className="max-h-72 w-full object-contain" /></div>}
                    {done && <p className="mt-3 flex items-center gap-1.5 text-xs font-black text-emerald-700"><CheckCircle2 className="size-4" /> Marcado como realizado hoy</p>}
                  </div>
                )}
              </div>
            );
          })}
          {actions && <div className="flex gap-2 pt-2">{actions}</div>}
        </div>
      )}
    </article>
  );
}
