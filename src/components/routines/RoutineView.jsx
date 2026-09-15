import { ChevronDown, ChevronUp, Dumbbell, Play } from "lucide-react";
import { useMemo, useState } from "react";
import { normalizeExerciseSearch } from "../../services/exercises";
import { ExerciseGifGallery } from "../exercises/ExerciseGif";
import WorkoutRunner from "./WorkoutRunner";

export default function RoutineView({ routine, exercises = [], actions = null, preview = false }) {
  const [open, setOpen] = useState(false);
  const [openExercise, setOpenExercise] = useState("");
  const [workoutOpen, setWorkoutOpen] = useState(false);

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

  const itemKey = (item, index) => String(item?.id || item?.exercise_id || `${normalizeExerciseSearch(item?.exercise_name)}-${index}`);
  const total = routine?.items?.length || 0;
  const totalSets = (routine?.items || []).reduce((sum, item) => sum + Math.max(1, Number(item.sets || 1)), 0);

  return (
    <>
      <article className="overflow-hidden rounded-[22px] bg-white shadow-sm">
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <button type="button" onClick={() => setOpen((value) => !value)} className="min-w-0 flex-1 text-left" aria-expanded={open}>
              <p className="truncate font-black text-slate-900">{routine.title}</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">{total} ejercicios · {totalSets} series{routine.description ? ` · ${routine.description}` : ""}</p>
            </button>
            <button type="button" onClick={() => setOpen((value) => !value)} className="grid size-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500" aria-label={open ? "Cerrar detalle" : "Ver detalle"}>{open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}</button>
          </div>
          {total > 0 && <button type="button" onClick={() => setWorkoutOpen(true)} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#E30613] px-4 text-sm font-black text-white shadow-sm active:scale-[.99]"><Play className="size-4 fill-current" /> Iniciar entrenamiento</button>}
        </div>

        {open && (
          <div className="space-y-2 border-t border-slate-100 bg-slate-50/70 p-3">
            {(routine.items || []).map((item, index) => {
              const key = itemKey(item, index);
              const source = exerciseById.get(String(item.exercise_id || "")) || exerciseByName.get(normalizeExerciseSearch(item.exercise_name));
              const expanded = openExercise === key;
              return (
                <div key={key} className="overflow-hidden rounded-xl border border-black/5 bg-white">
                  <button type="button" onClick={() => setOpenExercise(expanded ? "" : key)} className="flex w-full items-start justify-between gap-3 p-3 text-left" aria-expanded={expanded}>
                    <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[#050505] text-[11px] font-black text-white">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-black leading-5 text-slate-800">{item.exercise_name}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">{item.sets} series · {item.reps} reps · {item.rest_seconds}s descanso</p>
                    </div>
                    {expanded ? <ChevronUp className="mt-1 size-4 shrink-0 text-slate-400" /> : <ChevronDown className="mt-1 size-4 shrink-0 text-slate-400" />}
                  </button>
                  {expanded && <div className="border-t border-black/5 p-3">
                    <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400"><Dumbbell className="size-3.5" /> Técnica</p>
                    <p className="mt-1.5 text-sm leading-6 text-slate-600">{source?.notes || "La explicación breve de este ejercicio todavía no está disponible."}</p>
                    {source?.muscle_group && <p className="mt-2 text-xs font-bold text-slate-400">{source.muscle_group}{source.equipment ? ` · ${source.equipment}` : ""}</p>}
                    {item.notes && <div className="mt-3 rounded-xl bg-amber-50 p-3"><p className="text-[10px] font-black uppercase tracking-wider text-amber-700">Indicación de la rutina</p><p className="mt-1 text-xs leading-5 text-amber-800">{item.notes}</p></div>}
                    {source && <div className="mt-3"><ExerciseGifGallery exercise={source} className="max-h-72 w-full object-contain" /></div>}
                  </div>}
                </div>
              );
            })}
            {actions && <div className="flex gap-2 pt-2">{actions}</div>}
          </div>
        )}
      </article>
      <WorkoutRunner open={workoutOpen} onClose={() => setWorkoutOpen(false)} routine={routine} exercises={exercises} preview={preview} />
    </>
  );
}
