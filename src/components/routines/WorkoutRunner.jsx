import { Check, ChevronLeft, ChevronRight, Clock3, Cloud, CloudCheck, CloudOff, Dumbbell, History, Info, LoaderCircle, RotateCcw, Trophy, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { normalizeExerciseSearch } from "../../services/exercises";
import { finishWorkoutSession, getWorkoutHistory, openWorkoutSession, resetWorkoutSession, saveWorkoutProgress } from "../../services/routines";
import { ExerciseGifGallery } from "../exercises/ExerciseGif";
import { AnatomyFigure } from "../exercises/MuscleMap";

const CLOUD_SAVE_DEBOUNCE_MS = 350;

const asNumber = (value) => {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatNumber = (value, digits = 1) => Number(value || 0).toLocaleString("es-AR", { maximumFractionDigits: digits });
const formatDuration = (seconds) => {
  const safe = Math.max(0, Number(seconds || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = Math.floor(safe % 60);
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}` : `${minutes}:${String(secs).padStart(2, "0")}`;
};

const targetReps = (value) => {
  const first = String(value || "").match(/\d+/)?.[0];
  return first ? Number(first) : 10;
};

const exerciseKey = (item) => String(item?.exercise_id || item?.id || normalizeExerciseSearch(item?.exercise_name) || "ejercicio");

function sourceMaps(exercises) {
  const byId = new Map();
  const byName = new Map();
  exercises.forEach((exercise) => {
    if (exercise?.id) byId.set(String(exercise.id), exercise);
    (exercise?.variant_ids || []).forEach((id) => byId.set(String(id), exercise));
    const name = normalizeExerciseSearch(exercise?.name);
    if (name && !byName.has(name)) byName.set(name, exercise);
  });
  return { byId, byName };
}

function createWorkoutItems(routine, history) {
  return (routine?.items || []).map((item) => {
    const key = exerciseKey(item);
    const previous = history?.lastByExercise?.[key] || [];
    const plannedSets = Math.max(1, Math.min(20, Number(item.sets || 1)));
    const sets = Array.from({ length: plannedSets }, (_, index) => {
      const last = previous[index] || null;
      return {
        setNumber: index + 1,
        reps: last?.reps ?? targetReps(item.reps),
        weightKg: last?.weightKg != null ? String(last.weightKg) : "",
        rir: "",
        completed: false,
      };
    });
    return { ...item, exerciseKey: key, sets };
  });
}

function restoreCloudProgress(items, cloudSets) {
  const saved = new Map((cloudSets || []).map((set) => [`${set.exerciseKey}:${set.setNumber}`, set]));
  return items.map((item) => ({
    ...item,
    sets: item.sets.map((set) => {
      const cloud = saved.get(`${item.exerciseKey}:${set.setNumber}`);
      if (!cloud) return set;
      return {
        ...set,
        reps: cloud.reps ?? 0,
        weightKg: cloud.weightKg != null ? String(cloud.weightKg) : "",
        rir: cloud.rir == null ? "" : String(cloud.rir),
        completed: Boolean(cloud.completed),
      };
    }),
  }));
}

function serializeWorkoutItems(items) {
  return items.flatMap((item) => item.sets.map((set) => ({
    exerciseKey: item.exerciseKey,
    exerciseId: item.exercise_id || null,
    exerciseName: item.exercise_name,
    setNumber: set.setNumber,
    reps: asNumber(set.reps),
    weightKg: asNumber(set.weightKg),
    rir: String(set.rir ?? "").trim() === "" ? null : asNumber(set.rir),
    completed: Boolean(set.completed),
  })));
}

function Summary({ summary, routine, onClose }) {
  return <div className="fixed inset-0 z-[120] overflow-y-auto bg-[#090b0f] text-white">
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]">
      <div className="flex flex-1 flex-col justify-center">
        <span className="mx-auto grid size-20 place-items-center rounded-[28px] bg-emerald-400/10 text-emerald-300"><Trophy className="size-10" /></span>
        <p className="mt-7 text-center text-xs font-black uppercase tracking-[.2em] text-emerald-300">Entrenamiento guardado en la nube</p>
        <h2 className="mt-2 text-center text-3xl font-black">{routine.title}</h2>
        <div className="mt-8 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-white/7 p-3 text-center"><p className="text-xl font-black">{formatDuration(summary?.durationSeconds)}</p><p className="mt-1 text-[10px] font-bold uppercase text-white/45">Duración</p></div>
          <div className="rounded-2xl bg-white/7 p-3 text-center"><p className="text-xl font-black">{summary?.completedSets || 0}</p><p className="mt-1 text-[10px] font-bold uppercase text-white/45">Series</p></div>
          <div className="rounded-2xl bg-white/7 p-3 text-center"><p className="text-xl font-black">{formatNumber(summary?.totalVolumeKg, 0)}</p><p className="mt-1 text-[10px] font-bold uppercase text-white/45">Kg movidos</p></div>
        </div>
        <p className="mx-auto mt-6 max-w-xs text-center text-sm leading-6 text-white/50">Las cargas y repeticiones quedan asociadas a tu cuenta para usarlas como referencia en el próximo entrenamiento.</p>
      </div>
      <button onClick={onClose} className="mt-8 min-h-12 rounded-2xl bg-[#E30613] px-4 text-sm font-black text-white">Listo</button>
    </div>
  </div>;
}

export default function WorkoutRunner({ routine, exercises = [], open, onClose, preview = false }) {
  const [history, setHistory] = useState({ recent: [], lastByExercise: {} });
  const [items, setItems] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [sessionId, setSessionId] = useState(null);
  const [startedAt, setStartedAt] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [view, setView] = useState("entrenamiento");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncState, setSyncState] = useState("idle");
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState(null);

  const itemsRef = useRef([]);
  const sessionIdRef = useRef(null);
  const saveChainRef = useRef(Promise.resolve(true));
  const saveTimerRef = useRef(null);
  const pendingSnapshotRef = useRef(null);
  const saveVersionRef = useRef(0);
  const sessionEpochRef = useRef(0);

  const maps = useMemo(() => sourceMaps(exercises), [exercises]);
  const current = items[activeIndex] || null;
  const source = current ? maps.byId.get(String(current.exercise_id || "")) || maps.byName.get(normalizeExerciseSearch(current.exercise_name)) : null;
  const totalSets = items.reduce((sum, item) => sum + item.sets.length, 0);
  const completedSets = items.reduce((sum, item) => sum + item.sets.filter((set) => set.completed).length, 0);
  const completedExercises = items.filter((item) => item.sets.length > 0 && item.sets.every((set) => set.completed)).length;
  const progress = totalSets ? Math.round((completedSets / totalSets) * 100) : 0;

  const queueCloudSave = useCallback((snapshot) => {
    if (preview) return Promise.resolve(true);
    const activeSessionId = sessionIdRef.current;
    if (!activeSessionId) return Promise.resolve(false);

    const epoch = sessionEpochRef.current;
    const version = ++saveVersionRef.current;
    const payload = serializeWorkoutItems(snapshot);
    setSyncState("saving");

    const task = saveChainRef.current.catch(() => true).then(async () => {
      const result = await saveWorkoutProgress({ sessionId: activeSessionId, sets: payload });
      if (epoch !== sessionEpochRef.current) return !result.error;
      if (result.error) {
        if (version === saveVersionRef.current) {
          setSyncState("error");
          setError(result.error.message || "No se pudo guardar el progreso en la nube.");
        }
        return false;
      }
      if (version === saveVersionRef.current) {
        setSyncState("saved");
        setLastSavedAt(result.result?.updatedAt || new Date().toISOString());
        setError((currentError) => currentError.includes("guardar") || currentError.includes("conexión") ? "" : currentError);
      }
      return true;
    }).catch(() => {
      if (epoch === sessionEpochRef.current && version === saveVersionRef.current) {
        setSyncState("error");
        setError("No se pudo guardar el progreso en la nube. Revisá tu conexión.");
      }
      return false;
    });

    saveChainRef.current = task;
    return task;
  }, [preview]);

  const scheduleCloudSave = useCallback((snapshot, immediate = false) => {
    if (preview || !sessionIdRef.current) return;
    pendingSnapshotRef.current = snapshot;
    setSyncState("saving");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    if (immediate) {
      saveTimerRef.current = null;
      pendingSnapshotRef.current = null;
      void queueCloudSave(snapshot);
      return;
    }

    saveTimerRef.current = setTimeout(() => {
      const pending = pendingSnapshotRef.current;
      pendingSnapshotRef.current = null;
      saveTimerRef.current = null;
      if (pending) void queueCloudSave(pending);
    }, CLOUD_SAVE_DEBOUNCE_MS);
  }, [preview, queueCloudSave]);

  const flushCloud = useCallback(async (snapshot = itemsRef.current) => {
    if (preview) return true;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    pendingSnapshotRef.current = null;
    return queueCloudSave(snapshot);
  }, [preview, queueCloudSave]);

  useEffect(() => {
    if (!open || !routine) return undefined;
    let active = true;
    sessionEpochRef.current += 1;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    pendingSnapshotRef.current = null;
    saveChainRef.current = Promise.resolve(true);
    sessionIdRef.current = null;
    itemsRef.current = [];

    const boot = async () => {
      setLoading(true);
      setError("");
      setSummary(null);
      setView("entrenamiento");
      setActiveIndex(0);
      setSessionId(null);
      setStartedAt(null);
      setSyncState(preview ? "preview" : "opening");
      setLastSavedAt(null);

      if (preview) {
        const previewItems = createWorkoutItems(routine, { recent: [], lastByExercise: {} });
        if (!active) return;
        itemsRef.current = previewItems;
        setHistory({ recent: [], lastByExercise: {} });
        setItems(previewItems);
        setStartedAt(new Date().toISOString());
        setLoading(false);
        return;
      }

      const requestedStart = new Date().toISOString();
      const [historyResult, sessionResult] = await Promise.all([
        getWorkoutHistory(routine.id, 8),
        openWorkoutSession(routine.id, requestedStart),
      ]);
      if (!active) return;

      if (sessionResult.error || !sessionResult.session?.sessionId) {
        setItems([]);
        itemsRef.current = [];
        setSyncState("error");
        setError(sessionResult.error?.message || "No se pudo iniciar el entrenamiento en la nube. Revisá tu conexión e intentá nuevamente.");
        setLoading(false);
        return;
      }

      const nextHistory = historyResult.error ? { recent: [], lastByExercise: {} } : historyResult.history;
      const freshItems = createWorkoutItems(routine, nextHistory);
      const restoredItems = restoreCloudProgress(freshItems, sessionResult.session.sets);

      sessionIdRef.current = sessionResult.session.sessionId;
      itemsRef.current = restoredItems;
      setSessionId(sessionResult.session.sessionId);
      setHistory(nextHistory);
      setItems(restoredItems);
      setStartedAt(sessionResult.session.startedAt || requestedStart);
      setLastSavedAt(sessionResult.session.updatedAt || null);
      setSyncState("saved");
      if (historyResult.error) setError("No se pudo cargar el historial anterior. El entrenamiento actual sí está conectado a la nube.");
      setLoading(false);
    };

    void boot();
    return () => {
      active = false;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    };
  }, [open, routine?.id, preview]);

  useEffect(() => {
    if (!open || !startedAt || summary) return undefined;
    const update = () => setElapsed(Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [open, startedAt, summary]);

  useEffect(() => {
    if (!open || preview) return undefined;
    const persistBeforeBackground = () => {
      if (document.visibilityState !== "hidden" || !sessionIdRef.current) return;
      const pending = pendingSnapshotRef.current;
      if (!pending) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      pendingSnapshotRef.current = null;
      void queueCloudSave(pending);
    };
    document.addEventListener("visibilitychange", persistBeforeBackground);
    return () => document.removeEventListener("visibilitychange", persistBeforeBackground);
  }, [open, preview, queueCloudSave]);

  if (!open || !routine) return null;
  if (summary) return <Summary summary={summary} routine={routine} onClose={() => { setSummary(null); onClose?.(); }} />;

  const applyItems = (nextItems) => {
    itemsRef.current = nextItems;
    setItems(nextItems);
  };

  const patchSet = (itemIndex, setIndex, patch, immediate = false) => {
    const nextItems = itemsRef.current.map((item, index) => index !== itemIndex ? item : {
      ...item,
      sets: item.sets.map((set, index2) => index2 === setIndex ? { ...set, ...patch } : set),
    });
    applyItems(nextItems);
    scheduleCloudSave(nextItems, immediate);
  };

  const toggleSet = (setIndex) => {
    const set = current?.sets?.[setIndex];
    if (!set) return;
    if (!set.completed && (!String(set.reps).trim() || asNumber(set.reps) <= 0)) {
      setError("Ingresá las repeticiones antes de marcar la serie.");
      return;
    }
    setError("");
    patchSet(activeIndex, setIndex, { completed: !set.completed }, true);
  };

  const currentHistory = history.recent.map((session) => ({
    ...session,
    sets: (session.sets || []).filter((set) => set.exerciseKey === current?.exerciseKey),
  })).filter((session) => session.sets.length).slice(0, 6);
  const lastSets = history.lastByExercise?.[current?.exerciseKey] || [];

  const resetWorkout = async () => {
    if (!window.confirm("¿Reiniciar este entrenamiento? Se borrará el avance de esta sesión también en la nube.")) return;
    if (preview) {
      const fresh = createWorkoutItems(routine, history);
      applyItems(fresh);
      setActiveIndex(0);
      setStartedAt(new Date().toISOString());
      setElapsed(0);
      setView("entrenamiento");
      setError("");
      return;
    }
    if (!sessionIdRef.current) return;

    setSaving(true);
    setError("");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    pendingSnapshotRef.current = null;
    await saveChainRef.current;

    const nextStartedAt = new Date().toISOString();
    const result = await resetWorkoutSession({ sessionId: sessionIdRef.current, startedAt: nextStartedAt });
    if (result.error) {
      setSyncState("error");
      setError(result.error.message || "No se pudo reiniciar el entrenamiento en la nube.");
    } else {
      const fresh = createWorkoutItems(routine, history);
      applyItems(fresh);
      setActiveIndex(0);
      setStartedAt(result.session?.startedAt || nextStartedAt);
      setElapsed(0);
      setView("entrenamiento");
      setLastSavedAt(result.session?.updatedAt || new Date().toISOString());
      setSyncState("saved");
    }
    setSaving(false);
  };

  const finish = async () => {
    if (!completedSets) { setError("Marcá al menos una serie antes de finalizar."); return; }
    if (completedSets < totalSets && !window.confirm(`Completaste ${completedSets} de ${totalSets} series. ¿Finalizar igual?`)) return;
    if (preview) { setError("En la vista previa no se guardan entrenamientos."); return; }
    if (!sessionIdRef.current) { setError("No hay una sesión en la nube disponible para finalizar."); return; }

    setSaving(true);
    setError("");
    const saved = await flushCloud(itemsRef.current);
    if (!saved) {
      setSaving(false);
      setError("No se pudo sincronizar el último cambio. El entrenamiento no se finalizó para evitar perder datos.");
      return;
    }

    const result = await finishWorkoutSession({ sessionId: sessionIdRef.current, completedAt: new Date().toISOString() });
    if (result.error) {
      setSyncState("error");
      setError(result.error.message || "No se pudo finalizar el entrenamiento.");
    } else {
      setSyncState("saved");
      setSummary(result.summary);
    }
    setSaving(false);
  };

  const close = async () => {
    if (preview) { onClose?.(); return; }
    if (!sessionIdRef.current) { onClose?.(); return; }
    setSaving(true);
    setError("");
    const saved = await flushCloud(itemsRef.current);
    setSaving(false);
    if (!saved) {
      setError("No se pudo guardar el último cambio en la nube. La pantalla seguirá abierta para que puedas reintentar.");
      return;
    }
    onClose?.();
  };

  const syncLabel = preview ? "Vista previa · sin guardar" : syncState === "saving" ? "Guardando en la nube…" : syncState === "error" ? "Error al guardar en la nube" : syncState === "opening" ? "Conectando con la nube…" : "Guardado en la nube";
  const SyncIcon = preview || syncState === "opening" ? Cloud : syncState === "error" ? CloudOff : syncState === "saving" ? LoaderCircle : CloudCheck;
  const syncClass = syncState === "error" ? "text-red-300" : syncState === "saved" ? "text-emerald-300" : "text-white/40";

  return <div className="fixed inset-0 z-[110] overflow-y-auto bg-[#090b0f] text-white">
    <div className="mx-auto min-h-dvh w-full max-w-md pb-[max(6.5rem,env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-30 border-b border-white/8 bg-[#090b0f]/95 px-3 pb-3 pt-[max(.75rem,env(safe-area-inset-top))] backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button onClick={close} disabled={saving} className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/7 text-white/70 disabled:opacity-40" aria-label="Salir del entrenamiento"><X className="size-5" /></button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black">{routine.title}</p>
            <p className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-white/45"><Clock3 className="size-3" /> {formatDuration(elapsed)} · {completedSets}/{totalSets} series</p>
            <p className={`mt-0.5 flex items-center gap-1 text-[10px] font-bold ${syncClass}`}><SyncIcon className={`size-3 ${syncState === "saving" ? "animate-spin" : ""}`} /> {syncLabel}{lastSavedAt && syncState === "saved" ? ` · ${new Date(lastSavedAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}` : ""}</p>
          </div>
          <button onClick={resetWorkout} disabled={saving || loading || (!preview && !sessionId)} className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/7 text-white/55 disabled:opacity-30" aria-label="Reiniciar entrenamiento"><RotateCcw className="size-4" /></button>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-[#E30613] transition-all" style={{ width: `${progress}%` }} /></div>
        <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{items.map((item, index) => { const done = item.sets.every((set) => set.completed); return <button key={item.exerciseKey} onClick={() => { setActiveIndex(index); setView("entrenamiento"); }} className={`grid size-10 shrink-0 place-items-center rounded-xl border text-xs font-black ${index === activeIndex ? "border-[#E30613] bg-[#E30613] text-white" : done ? "border-emerald-500/30 bg-emerald-400/10 text-emerald-300" : "border-white/10 bg-white/5 text-white/45"}`}>{done ? <Check className="size-4" /> : index + 1}</button>; })}</div>
      </header>

      {loading ? <div className="grid min-h-[60dvh] place-items-center"><div className="text-center"><LoaderCircle className="mx-auto size-7 animate-spin text-[#E30613]" /><p className="mt-3 text-xs font-bold text-white/40">Preparando entrenamiento en la nube…</p></div></div> : current ? <div className="space-y-4 p-3.5">
        <section className="overflow-hidden rounded-[24px] border border-white/8 bg-[#12151b] shadow-2xl">
          <div className="p-4">
            <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#E30613]/15 text-[#ff5f69]"><Dumbbell className="size-5" /></span><div className="min-w-0"><p className="text-lg font-black leading-6">{current.exercise_name}</p><p className="mt-1 text-xs font-bold text-white/40">{source?.muscle_group || "Grupo muscular"}{source?.equipment ? ` · ${source.equipment}` : ""}</p></div></div>
            {current.notes && <p className="mt-3 rounded-xl bg-amber-300/8 p-3 text-xs leading-5 text-amber-100/80">{current.notes}</p>}
          </div>
          <div className="grid grid-cols-3 border-t border-white/8 bg-black/15 p-1.5"><button onClick={() => setView("entrenamiento")} className={`rounded-xl px-2 py-2.5 text-[11px] font-black ${view === "entrenamiento" ? "bg-white/10 text-white" : "text-white/40"}`}>Series</button><button onClick={() => setView("tecnica")} className={`rounded-xl px-2 py-2.5 text-[11px] font-black ${view === "tecnica" ? "bg-white/10 text-white" : "text-white/40"}`}>Técnica</button><button onClick={() => setView("historial")} className={`rounded-xl px-2 py-2.5 text-[11px] font-black ${view === "historial" ? "bg-white/10 text-white" : "text-white/40"}`}>Historial</button></div>
        </section>

        {view === "entrenamiento" && <>
          {lastSets.length > 0 && <section className="rounded-2xl border border-cyan-300/10 bg-cyan-300/5 p-3"><p className="text-[10px] font-black uppercase tracking-[.15em] text-cyan-200/65">Última vez</p><div className="mt-2 flex flex-wrap gap-2">{lastSets.map((set) => <span key={set.setNumber} className="rounded-lg bg-black/20 px-2.5 py-1.5 text-[11px] font-bold text-cyan-50">S{set.setNumber}: {set.reps} reps × {formatNumber(set.weightKg)} kg{set.rir != null ? ` · RIR ${set.rir}` : ""}</span>)}</div></section>}
          <section className="rounded-[22px] bg-[#12151b] p-3.5">
            <div className="grid grid-cols-[34px_1fr_1fr_54px_42px] gap-2 px-1 text-center text-[9px] font-black uppercase tracking-wide text-white/30"><span>#</span><span>Reps</span><span>Peso kg</span><span>RIR</span><span>OK</span></div>
            <div className="mt-2 space-y-2">{current.sets.map((set, setIndex) => <div key={set.setNumber} className={`grid grid-cols-[34px_1fr_1fr_54px_42px] items-center gap-2 rounded-xl p-1.5 ${set.completed ? "bg-emerald-400/8" : "bg-white/[.035]"}`}><span className="text-center text-xs font-black text-white/40">{set.setNumber}</span><input value={set.reps} onChange={(event) => patchSet(activeIndex, setIndex, { reps: event.target.value.replace(/\D/g, "").slice(0, 4) })} onBlur={() => { if (!preview) void flushCloud(itemsRef.current); }} inputMode="numeric" className="h-10 min-w-0 rounded-lg border border-white/8 bg-black/20 px-2 text-center text-sm font-black text-white outline-none focus:border-[#E30613]" aria-label={`Repeticiones serie ${set.setNumber}`} /><input value={set.weightKg} onChange={(event) => patchSet(activeIndex, setIndex, { weightKg: event.target.value.replace(/[^0-9,.]/g, "").slice(0, 7) })} onBlur={() => { if (!preview) void flushCloud(itemsRef.current); }} inputMode="decimal" placeholder="0" className="h-10 min-w-0 rounded-lg border border-white/8 bg-black/20 px-2 text-center text-sm font-black text-white outline-none focus:border-[#E30613]" aria-label={`Peso serie ${set.setNumber}`} /><input value={set.rir} onChange={(event) => patchSet(activeIndex, setIndex, { rir: event.target.value.replace(/\D/g, "").slice(0, 2) })} onBlur={() => { if (!preview) void flushCloud(itemsRef.current); }} inputMode="numeric" placeholder="—" className="h-10 min-w-0 rounded-lg border border-white/8 bg-black/20 px-1 text-center text-xs font-black text-white outline-none focus:border-[#E30613]" aria-label={`RIR serie ${set.setNumber}`} /><button onClick={() => toggleSet(setIndex)} className={`grid size-10 place-items-center rounded-lg border ${set.completed ? "border-emerald-400 bg-emerald-400 text-[#06130d]" : "border-white/10 bg-white/5 text-white/25"}`} aria-label={`Marcar serie ${set.setNumber}`}><Check className="size-5" /></button></div>)}</div>
            <p className="mt-3 text-[10px] leading-4 text-white/35">RIR es opcional: repeticiones que sentís que te quedaban “en reserva”. Para ejercicios con peso corporal podés usar 0 kg.</p>
          </section>
        </>}

        {view === "tecnica" && <section className="space-y-3 rounded-[22px] bg-[#12151b] p-4">
          <div><p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[.15em] text-white/35"><Info className="size-3.5" /> Cómo realizarlo</p><p className="mt-2 text-sm leading-6 text-white/70">{source?.notes || "La explicación técnica de este ejercicio todavía no está disponible."}</p></div>
          {source && <ExerciseGifGallery exercise={source} className="max-h-[52dvh] w-full rounded-2xl bg-black/20 object-contain" />}
          {source?.muscle_group && <div className="rounded-2xl bg-white/[.035] p-3"><p className="text-[10px] font-black uppercase tracking-[.15em] text-white/35">Músculo principal · {source.muscle_group}</p><div className="mx-auto mt-3 grid max-w-[230px] grid-cols-2 gap-2 rounded-xl bg-slate-100 p-2"><AnatomyFigure gender="male" selected={source.muscle_group} detailed /><AnatomyFigure gender="male" back selected={source.muscle_group} detailed /></div></div>}
          {source?.equipment && <div className="rounded-xl bg-white/[.035] p-3"><p className="text-[10px] font-black uppercase tracking-[.15em] text-white/35">Equipo</p><p className="mt-1 text-sm font-black text-white/75">{source.equipment}</p></div>}
        </section>}

        {view === "historial" && <section className="space-y-3 rounded-[22px] bg-[#12151b] p-4"><div><p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[.15em] text-white/35"><History className="size-3.5" /> Historial del ejercicio</p><p className="mt-1 text-xs text-white/40">Tus últimas cargas registradas en esta rutina.</p></div>{currentHistory.map((session) => <article key={session.id} className="rounded-xl bg-white/[.04] p-3"><div className="flex items-center justify-between gap-3"><p className="text-xs font-black text-white/75">{new Date(session.completedAt).toLocaleDateString("es-AR")}</p><span className="text-[10px] font-bold text-white/35">{formatDuration(session.durationSeconds)}</span></div><div className="mt-2 flex flex-wrap gap-2">{session.sets.map((set) => <span key={`${session.id}-${set.setNumber}`} className="rounded-lg bg-black/20 px-2 py-1.5 text-[11px] font-bold text-white/65">S{set.setNumber}: {set.reps} × {formatNumber(set.weightKg)} kg{set.rir != null ? ` · RIR ${set.rir}` : ""}</span>)}</div></article>)}{!currentHistory.length && <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-white/35">Todavía no hay entrenamientos guardados para este ejercicio.</p>}</section>}

        {error && <p className="rounded-xl border border-red-400/15 bg-red-400/10 p-3 text-sm font-bold text-red-200">{error}</p>}

        <div className="flex items-center justify-between gap-3"><button disabled={activeIndex === 0} onClick={() => { setActiveIndex((index) => Math.max(0, index - 1)); setView("entrenamiento"); }} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-white/7 text-xs font-black text-white/55 disabled:opacity-25"><ChevronLeft className="size-4" /> Anterior</button><button disabled={activeIndex >= items.length - 1} onClick={() => { setActiveIndex((index) => Math.min(items.length - 1, index + 1)); setView("entrenamiento"); }} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-white/7 text-xs font-black text-white/55 disabled:opacity-25">Siguiente <ChevronRight className="size-4" /></button></div>
      </div> : error ? <div className="p-4"><p className="rounded-2xl border border-red-400/15 bg-red-400/10 p-4 text-sm font-bold leading-6 text-red-200">{error}</p></div> : null}
    </div>

    <div className="fixed inset-x-0 bottom-0 z-[115] mx-auto w-full max-w-md border-t border-white/8 bg-[#090b0f]/96 px-3 pb-[max(.65rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl"><button onClick={finish} disabled={saving || loading || !items.length || (!preview && !sessionId)} className="min-h-12 w-full rounded-2xl bg-[#E30613] px-4 text-sm font-black text-white disabled:opacity-45">{saving ? <><LoaderCircle className="mr-2 inline size-4 animate-spin" /> Sincronizando…</> : `Finalizar · ${completedExercises}/${items.length} ejercicios`}</button></div>
  </div>;
}
