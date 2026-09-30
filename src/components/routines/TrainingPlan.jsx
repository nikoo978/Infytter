import { CalendarDays, Dumbbell, Edit3, Play, Plus, Trash2, UserRound, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { normalizeExerciseSearch } from "../../services/exercises";
import ExerciseDetail from "../exercises/ExerciseDetail";
import FormDialog from "../ui/FormDialog";
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

function RoutinePlanCard({ routine, exercises, onStart, onEdit, onDelete, onRemove, onSchedule, preview }) {
  const [detail, setDetail] = useState(null);
  const maps = useMemo(() => sourceMaps(exercises), [exercises]);
  const totalSets = (routine.items || []).reduce((sum, item) => sum + Math.max(1, Number(item.sets || 1)), 0);
  const muscles = [...new Set((routine.items || []).map((item) => routineSource(item, maps)?.muscle_group).filter(Boolean))].slice(0, 4);
  const isProfessor = routine.sourceType === "professor";

  return <><article className="overflow-hidden rounded-[24px] border border-black/6 bg-white shadow-sm">
    <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black ${isProfessor ? "bg-red-50 text-[#9E0710]" : "bg-slate-100 text-slate-600"}`}>
            {isProfessor ? <UsersRound className="size-3" /> : <UserRound className="size-3" />}
            {isProfessor ? "Rutina del profesor" : "Rutina personal"}
          </span>
          <h3 className="mt-2 text-xl font-black leading-6 text-[#050505]">{routine.title}</h3>
          {routine.description && <p className="mt-1.5 text-xs leading-5 text-slate-500">{routine.description}</p>}
        </div>
        <div className="rounded-2xl bg-[#050505] px-3 py-2 text-center text-white">
          <p className="text-base font-black">{totalSets}</p>
          <p className="text-[9px] font-black uppercase tracking-wider text-white/70">series</p>
        </div>
      </div>

      {!!muscles.length && <div className="mt-3 flex flex-wrap gap-1.5">{muscles.map((muscle) => <span key={muscle} className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500">{muscle}</span>)}</div>}

      <div className="mt-4 space-y-2">
        {(routine.items || []).map((item, index) => {
          const source = routineSource(item, maps);
          const image = source?.image_url || source?.variant_image_urls?.[0] || null;
          return <button type="button" onClick={() => setDetail(source || { name: item.exercise_name })} aria-label={`Ver ejercicio: ${item.exercise_name}`} key={item.id || `${item.exercise_name}-${index}`} className="flex w-full items-center gap-3 rounded-2xl bg-slate-50 p-2.5 text-left">
            <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-white shadow-sm">
              {image ? <img src={image} alt="" className="h-full w-full object-contain" loading="lazy" /> : <Dumbbell className="size-5 text-slate-300" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-slate-800">{item.exercise_name}</p>
              <p className="mt-0.5 text-[11px] font-bold text-slate-400">{item.sets} series · {item.reps} reps{source?.equipment ? ` · ${source.equipment}` : ""}</p>
            </div>
          </button>;
        })}
      </div>

      <button type="button" onClick={() => onStart(routine)} disabled={!routine.items?.length} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#E30613] px-4 text-sm font-black text-white shadow-sm disabled:opacity-40">
        <Play className="size-4 fill-current" /> Comenzar entrenamiento
      </button>

      {!preview && onSchedule && <button type="button" onClick={() => onSchedule(routine)} className="btn-secondary mt-2 min-h-11 w-full"><CalendarDays className="size-4" /> Organizar días (opcional)</button>}
      {!!routine.scheduleDays?.length && <p className="mt-2 text-xs text-slate-500">Sugeridos: {TRAINING_DAYS.filter((day) => routine.scheduleDays.includes(day.value)).map((day) => day.label).join(" · ")}. Podés entrenarla cualquier día.</p>}
      {!preview && <div className="mt-2 grid grid-cols-2 gap-2">
        {!isProfessor && onEdit && <button type="button" onClick={() => onEdit(routine)} className="btn-secondary min-h-10"><Edit3 className="size-4" /> Editar</button>}
        {!isProfessor && onDelete && <button type="button" onClick={() => onDelete(routine)} className="btn-secondary min-h-10 text-[#9E0710]"><Trash2 className="size-4" /> Eliminar</button>}
        {isProfessor && onRemove && <button type="button" onClick={() => onRemove(routine)} className="btn-secondary col-span-2 min-h-10 text-[#9E0710]"><Trash2 className="size-4" /> Quitar de mi cuenta</button>}
      </div>}
    </div>
  </article><FormDialog open={!!detail} onOpenChange={(open) => { if (!open) setDetail(null); }} title="Consultar ejercicio">{detail && <ExerciseDetail exercise={detail} />}</FormDialog></>;
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
  onRetry,
  onChangeDays,
}) {
  const [selectedDay, setSelectedDay] = useState(null);
  const [scheduling, setScheduling] = useState(null);
  const [draftDays, setDraftDays] = useState([]);
  const [savingDays, setSavingDays] = useState(false);
  const [daysError, setDaysError] = useState("");
  const openSchedule = (routine) => { setScheduling(routine); setDraftDays(routine.scheduleDays || []); setDaysError(""); };
  const saveDays = async () => {
    setSavingDays(true); setDaysError("");
    try { await onChangeDays(scheduling, draftDays); setScheduling(null); }
    catch (error) { setDaysError(error.message || "No se pudieron guardar los días."); }
    finally { setSavingDays(false); }
  };
  const [activeRoutine, setActiveRoutine] = useState(null);
  const allRoutines = useMemo(() => [
    ...(routines.assigned || []),
    ...(routines.personal || []),
  ], [routines]);

  const scheduled = useMemo(() => allRoutines.filter((routine) => (routine.scheduleDays || []).map(Number).includes(selectedDay)), [allRoutines, selectedDay]);

  const selectedLabel = TRAINING_DAYS.find((day) => day.value === selectedDay)?.label || "Día";

  return <>
    <section className="overflow-hidden rounded-[26px] bg-[#050505] p-4 text-white shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#ff5f69]">Entrenamiento</p>
          <h1 className="mt-1 text-2xl font-black">Mis rutinas</h1>
          <p className="mt-1 text-xs leading-5 text-white/70">Elegí qué entrenar hoy. Todas tus rutinas están siempre disponibles.</p>
        </div>
        {!preview && onCreatePersonal && <button onClick={onCreatePersonal} disabled={(routines.personal || []).length >= 3} className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#E30613] text-white disabled:opacity-30" aria-label="Crear rutina personal"><Plus className="size-5" /></button>}
      </div>

      <button type="button" aria-pressed={selectedDay === null} onClick={() => setSelectedDay(null)} className="mt-4 min-h-11 rounded-xl bg-white/10 px-4 text-sm font-black">Todas mis rutinas</button>
      <p className="mt-3 text-xs text-white/70">Días opcionales: consultá tus sugerencias sin limitar cuándo entrenás.</p>
      <div className="mt-2 grid grid-cols-7 gap-1.5">{TRAINING_DAYS.map((day) => {
        const hasPlan = allRoutines.some((routine) => (routine.scheduleDays || []).map(Number).includes(day.value));
        const active = selectedDay === day.value;
        return <button key={day.value} type="button" aria-label={day.label} aria-pressed={active} onClick={() => setSelectedDay(day.value)} className={`relative grid min-h-12 place-items-center rounded-xl text-xs font-black transition ${active ? "bg-[#E30613] text-white" : "bg-white/7 text-white/70"}`}>
          {day.short}
          {hasPlan && !active && <span className="absolute bottom-1.5 size-1 rounded-full bg-[#E30613]" />}
        </button>;
      })}</div>
    </section>

    {error && <div role="alert" className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}{onRetry && <button type="button" onClick={onRetry} className="mt-3 block min-h-11 rounded-xl bg-white px-4">Volver a intentar</button>}</div>}
    {loading && <p className="rounded-2xl bg-white p-4 text-sm font-bold text-slate-500 shadow-sm">Cargando tu plan…</p>}

    {!loading && <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-black">Todas mis rutinas</h2>
        {onOpenLibrary && <button type="button" onClick={onOpenLibrary} className="min-h-11 text-xs font-black text-slate-600">Ver ejercicios</button>}
      </div>
      {selectedDay !== null && <p role="status" className="mb-3 rounded-xl bg-slate-100 p-3 text-sm text-slate-600">{selectedLabel}: {scheduled.length ? scheduled.map((routine) => routine.title).join(" · ") : "Sin sugerencias"}. Podés elegir cualquiera de tus rutinas.</p>}
      <div className="space-y-3">{allRoutines.map((routine) => <RoutinePlanCard key={routine.id} routine={routine} exercises={exercises} onStart={setActiveRoutine} onEdit={onEditPersonal} onDelete={onDeletePersonal} onRemove={onRemoveAssigned} onSchedule={onChangeDays ? openSchedule : null} preview={preview} />)}</div>
    </section>}

    {!loading && !error && !allRoutines.length && <div className="rounded-[22px] border border-dashed border-slate-200 bg-white p-8 text-center">
      <Dumbbell className="mx-auto size-8 text-slate-300" />
      <p className="mt-3 font-black text-slate-700">Todavía no tenés rutinas.</p>
      <p className="mt-1 text-xs leading-5 text-slate-400">Tu profesor puede compartirte una o podés crear hasta 3 rutinas personales.</p>
      {!preview && onCreatePersonal && <button type="button" onClick={onCreatePersonal} className="btn-primary mt-4 min-h-11"><Plus className="size-4" /> Crear mi primera rutina</button>}
    </div>}

    <FormDialog open={!!scheduling} onOpenChange={(open) => { if (!open && !savingDays) setScheduling(null); }} title="Organizar días" description="Sólo organiza tu semana. La rutina seguirá disponible todos los días.">
      <p className="font-black">{scheduling?.title}</p>
      <div className="my-4 grid grid-cols-7 gap-1">{TRAINING_DAYS.map((day) => <button key={day.value} type="button" aria-label={day.label} aria-pressed={draftDays.includes(day.value)} disabled={savingDays} onClick={() => setDraftDays((days) => days.includes(day.value) ? days.filter((value) => value !== day.value) : [...days, day.value].sort())} className={`min-h-11 rounded-xl font-black ${draftDays.includes(day.value) ? "bg-[#E30613] text-white" : "bg-slate-100 text-slate-700"}`}>{day.short}</button>)}</div>
      {daysError && <p role="alert" className="mb-3 text-sm text-red-700">{daysError}</p>}
      <div className="flex gap-2"><button type="button" disabled={savingDays} onClick={() => setDraftDays([])} className="btn-secondary">Sin día fijo</button><button type="button" disabled={savingDays} onClick={saveDays} className="btn-primary flex-1">{savingDays ? "Guardando…" : "Guardar días"}</button></div>
    </FormDialog>
    <WorkoutRunner open={!!activeRoutine} onClose={() => setActiveRoutine(null)} routine={activeRoutine} exercises={exercises} preview={preview} />
  </>;
}
