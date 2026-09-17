import { CalendarDays, Dumbbell, Edit3, Play, Plus, Trash2, UserRound, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { normalizeExerciseSearch } from "../../services/exercises";
import WorkoutRunner from "./WorkoutRunnerV2";

export const TRAINING_DAYS = [
  { value: 1, short: "L", label: "Lunes" },
  { value: 2, short: "M", label: "Martes" },
  { value: 3, short: "X", label: "Miércoles" },
  { value: 4, short: "J", label: "Jueves" },
  { value: 5, short: "V", label: "Viernes" },
  { value: 6, short: "S", label: "Sábado" },
  { value: 7, short: "D", label: "Domingo" },
];

const todayDay = () => {
  const day = new Date().getDay();
  return day === 0 ? 7 : day;
};

const sourceMaps = (exercises) => {
  const byId = new Map();
  const byName = new Map();
  exercises.forEach((exercise) => {
    if (exercise?.id) byId.set(String(exercise.id), exercise);
    (exercise?.variant_ids || []).forEach((id) => byId.set(String(id), exercise));
    const key = normalizeExerciseSearch(exercise?.name);
    if (key && !byName.has(key)) byName.set(key, exercise);
  });
  return { byId, byName };
};

function routineSource(item, maps) {
  return maps.byId.get(String(item?.exercise_id || "")) || maps.byName.get(normalizeExerciseSearch(item?.exercise_name));
}

function RoutinePlanCard({ routine, exercises, onStart, onEdit, onDelete, onRemove, preview }) {
  const maps = useMemo(() => sourceMaps(exercises), [exercises]);
  const totalSets = (routine.items || []).reduce((sum, item) => sum + Math.max(1, Number(item.sets || 1)), 0);
  const muscles = [...new Set((routine.items || []).map((item) => routineSource(item, maps)?.muscle_group).filter(Boolean))].slice(0, 4);
  const isProfessor = routine.sourceType === "professor";

  return <article className="overflow-hidden rounded-[24px] border border-black/6 bg-white shadow-sm">
    <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black ${isProfessor ? "bg-red-50 text-[#9E0710]" : "bg-slate-100 text-slate-600"}`}>
            {isProfessor ? <UsersRound className="size-3" /> : <UserRound className="size-3" />}
            {isProfessor ? "Plan del profesor" : "Rutina personal"}
          </span>
          <h3 className="mt-2 text-xl font-black leading-6 text-[#050505]">{routine.title}</h3>
          {routine.description && <p className="mt-1.5 text-xs leading-5 text-slate-500">{routine.description}</p>}
        </div>
        <div className="rounded-2xl bg-[#050505] px-3 py-2 text-center text-white">
          <p className="text-base font-black">{totalSets}</p>
          <p className="text-[9px] font-black uppercase tracking-wider text-white/50">series</p>
        </div>
      </div>

      {!!muscles.length && <div className="mt-3 flex flex-wrap gap-1.5">{muscles.map((muscle) => <span key={muscle} className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500">{muscle}</span>)}</div>}

      <div className="mt-4 space-y-2">
        {(routine.items || []).map((item, index) => {
          const source = routineSource(item, maps);
          const image = source?.image_url || source?.variant_image_urls?.[0] || null;
          return <div key={item.id || `${item.exercise_name}-${index}`} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-2.5">
            <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-white shadow-sm">
              {image ? <img src={image} alt="" className="h-full w-full object-contain" loading="lazy" /> : <Dumbbell className="size-5 text-slate-300" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-slate-800">{item.exercise_name}</p>
              <p className="mt-0.5 text-[11px] font-bold text-slate-400">{item.sets} series · {item.reps} reps{source?.equipment ? ` · ${source.equipment}` : ""}</p>
            </div>
          </div>;
        })}
      </div>

      <button type="button" onClick={() => onStart(routine)} disabled={!routine.items?.length} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#E30613] px-4 text-sm font-black text-white shadow-sm disabled:opacity-40">
        <Play className="size-4 fill-current" /> Comenzar entrenamiento
      </button>

      {!preview && <div className="mt-2 grid grid-cols-2 gap-2">
        {!isProfessor && onEdit && <button type="button" onClick={() => onEdit(routine)} className="btn-secondary min-h-10"><Edit3 className="size-4" /> Editar</button>}
        {!isProfessor && onDelete && <button type="button" onClick={() => onDelete(routine)} className="btn-secondary min-h-10 text-[#9E0710]"><Trash2 className="size-4" /> Eliminar</button>}
        {isProfessor && onRemove && <button type="button" onClick={() => onRemove(routine)} className="btn-secondary col-span-2 min-h-10 text-[#9E0710]"><Trash2 className="size-4" /> Quitar de mi cuenta</button>}
      </div>}
    </div>
  </article>;
}

export default function TrainingPlan({
  routines = { personal: [], assigned: [] },
  exercises = [],
  preview = false,
  loading = false,
  error = "",
  onCreatePersonal,
  onEditPersonal,
  onDeletePersonal,
  onRemoveAssigned,
  onOpenLibrary,
}) {
  const [selectedDay, setSelectedDay] = useState(todayDay());
  const [activeRoutine, setActiveRoutine] = useState(null);
  const allRoutines = useMemo(() => [
    ...(routines.assigned || []),
    ...(routines.personal || []),
  ], [routines]);

  const scheduled = useMemo(() => allRoutines.filter((routine) => (routine.scheduleDays || []).map(Number).includes(selectedDay)), [allRoutines, selectedDay]);
  const unscheduled = useMemo(() => allRoutines.filter((routine) => !(routine.scheduleDays || []).length), [allRoutines]);
  const selectedLabel = TRAINING_DAYS.find((day) => day.value === selectedDay)?.label || "Día";

  return <>
    <section className="overflow-hidden rounded-[26px] bg-[#050505] p-4 text-white shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#ff5f69]">Entrenamiento</p>
          <h1 className="mt-1 text-2xl font-black">Mi plan</h1>
          <p className="mt-1 text-xs leading-5 text-white/45">Tu semana, tus cargas y tu historial en un solo lugar.</p>
        </div>
        {!preview && onCreatePersonal && <button onClick={onCreatePersonal} disabled={(routines.personal || []).length >= 3} className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#E30613] text-white disabled:opacity-30" aria-label="Crear rutina personal"><Plus className="size-5" /></button>}
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1.5">{TRAINING_DAYS.map((day) => {
        const hasPlan = allRoutines.some((routine) => (routine.scheduleDays || []).map(Number).includes(day.value));
        const active = selectedDay === day.value;
        return <button key={day.value} type="button" onClick={() => setSelectedDay(day.value)} className={`relative grid min-h-12 place-items-center rounded-xl text-xs font-black transition ${active ? "bg-[#E30613] text-white" : "bg-white/7 text-white/45"}`}>
          {day.short}
          {hasPlan && !active && <span className="absolute bottom-1.5 size-1 rounded-full bg-[#E30613]" />}
        </button>;
      })}</div>
    </section>

    {error && <p className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</p>}
    {loading && <p className="rounded-2xl bg-white p-4 text-sm font-bold text-slate-500 shadow-sm">Cargando tu plan…</p>}

    {!loading && <section>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#E30613]"><CalendarDays className="mr-1 inline size-3.5" /> {selectedLabel}</p>
          <h2 className="mt-1 text-lg font-black text-[#050505]">{scheduled.length ? "Entrenamientos programados" : "Sin entrenamiento programado"}</h2>
        </div>
        {onOpenLibrary && <button onClick={onOpenLibrary} className="text-xs font-black text-slate-500">Biblioteca</button>}
      </div>

      <div className="space-y-3">
        {scheduled.map((routine) => <RoutinePlanCard key={routine.id} routine={routine} exercises={exercises} onStart={setActiveRoutine} onEdit={onEditPersonal} onDelete={onDeletePersonal} onRemove={onRemoveAssigned} preview={preview} />)}
        {!scheduled.length && <div className="rounded-[22px] border border-dashed border-slate-200 bg-white p-6 text-center">
          <CalendarDays className="mx-auto size-7 text-slate-300" />
          <p className="mt-3 text-sm font-black text-slate-700">No hay una rutina asignada para {selectedLabel.toLowerCase()}.</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">Podés elegir otro día o usar una rutina sin día fijo.</p>
        </div>}
      </div>
    </section>}

    {!loading && !!unscheduled.length && <section>
      <div className="mb-3"><p className="text-[10px] font-black uppercase tracking-[.16em] text-slate-400">Sin día fijo</p><h2 className="mt-1 text-lg font-black text-[#050505]">Entrenamientos disponibles</h2></div>
      <div className="space-y-3">{unscheduled.map((routine) => <RoutinePlanCard key={routine.id} routine={routine} exercises={exercises} onStart={setActiveRoutine} onEdit={onEditPersonal} onDelete={onDeletePersonal} onRemove={onRemoveAssigned} preview={preview} />)}</div>
    </section>}

    {!loading && !allRoutines.length && <div className="rounded-[22px] border border-dashed border-slate-200 bg-white p-8 text-center">
      <Dumbbell className="mx-auto size-8 text-slate-300" />
      <p className="mt-3 font-black text-slate-700">Todavía no tenés un plan.</p>
      <p className="mt-1 text-xs leading-5 text-slate-400">Tu profesor puede asignarte uno o podés crear hasta 3 rutinas personales.</p>
    </div>}

    <WorkoutRunner open={!!activeRoutine} onClose={() => setActiveRoutine(null)} routine={activeRoutine} exercises={exercises} preview={preview} />
  </>;
}
