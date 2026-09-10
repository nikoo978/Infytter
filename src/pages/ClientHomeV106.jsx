import { Activity, CalendarDays, CheckCircle2, Clock3, Dumbbell, Edit3, Fingerprint, Home, ListPlus, LogOut, Plus, RefreshCw, ShieldCheck, Trash2, UserRound, UsersRound, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { APP_VERSION } from "../App";
import { statusOf, weeklyAccessUsage } from "../services/accessPolicy";
import ExerciseCatalog from "../components/exercises/ExerciseCatalog";
import BodyMetricsPanel from "../components/progress/BodyMetricsPanel";
import RoutineEditor from "../components/routines/RoutineEditor";
import RoutineView from "../components/routines/RoutineView";
import FormDialog from "../components/ui/FormDialog";
import { useAuth } from "../context/AuthContext";
import { getMyBodyMetrics } from "../services/bodyMetrics";
import { listExercises } from "../services/exercises";
import { getMyClientPortal } from "../services/roles";
import { deleteMyRoutine, getMyRoutines, removeAssignedRoutine, saveMyRoutine } from "../services/routines";

const dateLabel = (value) => value ? new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString("es-AR") : "—";
const number = (value, digits = 1) => value == null ? "—" : Number(value).toLocaleString("es-AR", { maximumFractionDigits: digits });

export default function ClientHomeV106({ previewPortal = null, previewIdentity = null, preview = false }) {
  const { user, profile, logout } = useAuth();
  const [portal, setPortal] = useState(previewPortal);
  const [loading, setLoading] = useState(!preview);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("inicio");
  const [routines, setRoutines] = useState({ personal: [], assigned: [] });
  const [exercises, setExercises] = useState([]);
  const [routineLoading, setRoutineLoading] = useState(!preview);
  const [routineError, setRoutineError] = useState("");
  const [routineBusy, setRoutineBusy] = useState(false);
  const [creatingRoutine, setCreatingRoutine] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState(null);
  const [latestMetrics, setLatestMetrics] = useState([]);

  const shownEmail = previewIdentity?.email || user?.email || "cliente@ejemplo.com";
  const name = previewIdentity?.name || profile?.display_name || user?.user_metadata?.name || shownEmail.split("@")[0] || "Usuario";

  const load = async () => {
    if (preview) return;
    setLoading(true); setError("");
    const [portalResult, metricResult] = await Promise.all([getMyClientPortal(), getMyBodyMetrics(2)]);
    if (portalResult.error) setError(portalResult.error.message || "No se pudo cargar tu ficha.");
    else setPortal(portalResult.portal);
    if (!metricResult.error) setLatestMetrics(metricResult.items || []);
    setLoading(false);
  };

  const loadRoutines = async () => {
    if (preview) { setRoutineLoading(false); return; }
    setRoutineLoading(true); setRoutineError("");
    const [routineResult, exerciseResult] = await Promise.all([getMyRoutines(), listExercises()]);
    if (routineResult.error) setRoutineError(routineResult.error.message || "No se pudieron cargar tus rutinas.");
    else setRoutines(routineResult.routines);
    if (!exerciseResult.error) setExercises(exerciseResult.exercises);
    setRoutineLoading(false);
  };

  useEffect(() => {
    if (preview) { setPortal(previewPortal); setLoading(false); setRoutineLoading(false); setError(""); return; }
    load(); loadRoutines();
  }, [user?.id, preview, previewPortal]);

  const member = portal?.member;
  const accesses = portal?.accesses || [];
  const status = statusOf(member);
  const latest = latestMetrics[0] || null;
  const thisWeekDays = useMemo(() => {
    if (!member || member.plan !== "3 días") return null;
    return weeklyAccessUsage(accesses).usedDays;
  }, [member, accesses]);
  const statusTone = status === "Vigente" ? "bg-emerald-50 text-emerald-700" : status === "Por vencer" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700";

  const saveRoutine = async (routine) => {
    setRoutineBusy(true); setRoutineError("");
    const result = await saveMyRoutine(routine);
    if (result.error) setRoutineError(result.error.message || "No se pudo guardar la rutina.");
    else { setCreatingRoutine(false); setEditingRoutine(null); await loadRoutines(); }
    setRoutineBusy(false);
  };

  const removePersonal = async (routine) => {
    if (!window.confirm(`¿Eliminar tu rutina ${routine.title}?`)) return;
    setRoutineBusy(true); const result = await deleteMyRoutine(routine.id);
    if (!result.ok) setRoutineError(result.error?.message || "No se pudo eliminar la rutina.");
    else await loadRoutines(); setRoutineBusy(false);
  };

  const removeProfessor = async (routine) => {
    if (!window.confirm(`¿Quitar ${routine.title} de tus rutinas del profesor?`)) return;
    setRoutineBusy(true); const result = await removeAssignedRoutine(routine.id);
    if (!result.ok) setRoutineError(result.error?.message || "No se pudo quitar la rutina.");
    else await loadRoutines(); setRoutineBusy(false);
  };

  const navClass = preview ? "sticky bottom-2 mx-2" : "fixed bottom-0 left-1/2 w-full max-w-md -translate-x-1/2 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))]";
  const routineProgressScope = user?.id || "preview";

  return <main className={`${preview ? "min-h-[760px]" : "min-h-dvh"} overflow-x-hidden bg-[#F5F5F5]`}>
    <div className="mx-auto w-full max-w-md pb-[calc(7rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-white/10 bg-[#050505]/95 px-4 text-white shadow-lg backdrop-blur-xl sm:h-16"><img src="/infytter-logo.svg" alt="Infytter Fitness" className="h-8 w-28 object-contain object-left sm:h-9 sm:w-32" /><div className="text-right"><p className="text-[11px] font-black text-[#E30613]">{APP_VERSION}</p><p className="text-[10px] text-white/50">Mi Infytter</p></div></header>

      <div className="space-y-4 p-3.5 sm:p-4">
        {tab === "inicio" && <>
          <section className="overflow-hidden rounded-[26px] bg-[#050505] p-5 text-white shadow-xl"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.18em] text-white/45">Mi cuenta</p><h1 className="mt-2 truncate text-2xl font-black">Hola, {name}</h1><p className="mt-1 truncate text-xs text-white/50">{shownEmail}</p></div><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#E30613]"><ShieldCheck className="size-5" /></span></div>{member && <div className="mt-5 flex items-center justify-between rounded-2xl bg-white/8 px-4 py-3"><div><p className="text-[10px] font-black uppercase tracking-wider text-white/40">Membresía</p><p className="mt-1 text-lg font-black">{status}</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-black ${statusTone}`}>{dateLabel(member.expiry)}</span></div>}</section>

          {loading && <div className="flex items-center gap-2 rounded-2xl bg-white p-4 text-sm font-bold text-slate-500 shadow-sm"><RefreshCw className="size-4 animate-spin" /> Cargando tu información…</div>}
          {error && <div className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}
          {!loading && !error && !portal?.linked && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex items-start gap-3"><UserRound className="mt-0.5 size-5 shrink-0 text-amber-700" /><div><p className="font-black text-amber-900">Falta vincular tu ficha</p><p className="mt-1 text-sm leading-6 text-amber-800">El administrador debe buscar <strong>{shownEmail}</strong> en Usuarios y vincularlo con tu ficha de Cliente.</p></div></div></div>}

          {!loading && member && <>
            <section className="grid grid-cols-2 gap-3"><InfoCard label="Plan" value={member.plan || "—"} /><InfoCard label="Vence" value={dateLabel(member.expiry)} /><InfoCard icon={ScaleIcon} label="Peso" value={latest ? `${number(latest.weightKg)} kg` : "Sin medir"} /><InfoCard icon={Activity} label="IMC / grasa" value={latest ? `${number(latest.bmi,2)}${latest.bodyFatPct != null ? ` · ${number(latest.bodyFatPct)}%` : ""}` : "Sin datos"} /></section>
            <section className="grid grid-cols-2 gap-3"><button onClick={() => setTab("progreso")} className="min-h-24 rounded-[20px] bg-white p-4 text-left shadow-sm active:scale-[.98]"><Activity className="size-5 text-[#E30613]" /><p className="mt-3 text-sm font-black text-slate-900">Registrar progreso</p><p className="mt-1 text-[10px] font-bold text-slate-400">Peso, medidas, IMC y Navy</p></button><button onClick={() => setTab("ejercicios")} className="min-h-24 rounded-[20px] bg-white p-4 text-left shadow-sm active:scale-[.98]"><Dumbbell className="size-5 text-[#E30613]" /><p className="mt-3 text-sm font-black text-slate-900">Consultar ejercicios</p><p className="mt-1 text-[10px] font-bold text-slate-400">Técnica y referencias</p></button></section>
            <section className="grid grid-cols-2 gap-3"><article className="rounded-2xl bg-white p-4 shadow-sm"><p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400"><Fingerprint className="size-3.5" /> Acceso</p><p className="mt-2 text-sm font-black text-slate-800">{member.biometricMethod || "Sin registrar"}</p><p className="mt-1 text-[11px] text-slate-400">{portal.branchName || "—"}</p></article><article className="rounded-2xl bg-white p-4 shadow-sm"><p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400"><CalendarDays className="size-3.5" /> Semana</p><p className="mt-2 text-sm font-black text-slate-800">{thisWeekDays === null ? "Sin límite" : `${thisWeekDays} / 3 días`}</p><p className="mt-1 text-[11px] text-slate-400">Alta {dateLabel(member.start)}</p></article></section>
            <section className="rounded-[22px] bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#E30613]">Actividad</p><h2 className="mt-1 text-lg font-black text-[#050505]">Últimos accesos</h2></div>{!preview && <button onClick={load} className="grid size-10 place-items-center rounded-xl border border-black/8 text-slate-500"><RefreshCw className="size-4" /></button>}</div><div className="mt-3 divide-y divide-slate-100">{accesses.slice(0, 6).map((item) => <div key={item.id} className="flex items-center justify-between gap-3 py-3"><div className="flex min-w-0 items-center gap-3"><span className={`grid size-9 shrink-0 place-items-center rounded-xl ${item.allowed ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{item.allowed ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}</span><div className="min-w-0"><p className="truncate text-sm font-black text-slate-800">{item.allowed ? "Ingreso autorizado" : "Ingreso rechazado"}</p><p className="text-[11px] text-slate-400">{new Date(item.date).toLocaleDateString("es-AR")}</p></div></div><span className="shrink-0 text-xs font-bold text-slate-400"><Clock3 className="mr-1 inline size-3.5" />{new Date(item.date).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</span></div>)}{!accesses.length && <p className="py-7 text-center text-sm text-slate-400">Todavía no tenés accesos registrados.</p>}</div></section>
          </>}
          {!preview && <button onClick={logout} className="btn-secondary min-h-11 w-full"><LogOut className="size-4" /> Cerrar sesión</button>}
        </>}

        {tab === "progreso" && <BodyMetricsPanel self preview={preview} title="Mi progreso" subtitle="Registrá peso, altura y medidas. El IMC y la grasa corporal por Navy son estimaciones orientativas." />}
        {tab === "ejercicios" && <ExerciseCatalog preview={preview} />}

        {tab === "mias" && <><section className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#E30613]">Entrenamiento</p><h1 className="text-2xl font-black">Mis rutinas</h1><p className="mt-1 text-xs text-slate-500">Podés crear hasta 3 rutinas personales.</p></div>{!preview && <button onClick={() => setCreatingRoutine(true)} disabled={routines.personal.length >= 3} className="grid size-11 place-items-center rounded-2xl bg-[#E30613] text-white disabled:bg-slate-300"><Plus className="size-5" /></button>}</section>{routineError && <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{routineError}</p>}{routineLoading ? <p className="rounded-2xl bg-white p-4 text-sm text-slate-500">Cargando rutinas…</p> : <div className="space-y-3">{routines.personal.map((routine) => <RoutineView key={routine.id} routine={routine} exercises={exercises} preview={preview} progressScope={routineProgressScope} actions={!preview && <><button onClick={() => setEditingRoutine(routine)} className="btn-secondary flex-1"><Edit3 className="size-4" /> Editar</button><button onClick={() => removePersonal(routine)} className="btn-secondary px-3 text-[#9E0710]"><Trash2 className="size-4" /></button></>} />)}{!routines.personal.length && <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-400">Todavía no creaste rutinas personales.</p>}</div>}<p className="text-center text-xs font-black text-slate-400">{routines.personal.length} / 3 rutinas</p></>}

        {tab === "profe" && <><section><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#E30613]">Asignadas</p><h1 className="text-2xl font-black">Rutinas del profe</h1><p className="mt-1 text-xs leading-5 text-slate-500">Los cambios del profesor se actualizan automáticamente. Vos decidís cuándo quitar una rutina.</p></section>{routineError && <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{routineError}</p>}{routineLoading ? <p className="rounded-2xl bg-white p-4 text-sm text-slate-500">Cargando rutinas…</p> : <div className="space-y-3">{routines.assigned.map((routine) => <RoutineView key={routine.id} routine={routine} exercises={exercises} preview={preview} progressScope={routineProgressScope} actions={!preview && <button onClick={() => removeProfessor(routine)} className="btn-secondary w-full text-[#9E0710]"><Trash2 className="size-4" /> Quitar de mi cuenta</button>} />)}{!routines.assigned.length && <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-400">Tu profesor todavía no te asignó rutinas.</p>}</div>}</>}
      </div>

      <div className={`${navClass} z-40`}><nav className="grid grid-cols-5 gap-1 rounded-[22px] border border-black/10 bg-white/95 p-1.5 shadow-[0_-8px_30px_rgba(0,0,0,.12)] backdrop-blur-xl"><NavButton active={tab === "inicio"} onClick={() => setTab("inicio")} icon={Home} label="Inicio" /><NavButton active={tab === "progreso"} onClick={() => { setTab("progreso"); if (!preview) load(); }} icon={Activity} label="Progreso" /><NavButton active={tab === "ejercicios"} onClick={() => setTab("ejercicios")} icon={Dumbbell} label="Ejercicios" /><NavButton active={tab === "mias"} onClick={() => setTab("mias")} icon={ListPlus} label="Mis rutinas" /><NavButton active={tab === "profe"} onClick={() => setTab("profe")} icon={UsersRound} label="Profe" /></nav></div>
    </div>

    <FormDialog open={creatingRoutine} onOpenChange={setCreatingRoutine} title="Nueva rutina" description="Elegí ejercicios y configurá series, repeticiones y descanso."><RoutineEditor exercises={exercises} onSave={saveRoutine} busy={routineBusy} compact /></FormDialog>
    <FormDialog open={!!editingRoutine} onOpenChange={(value) => { if (!value) setEditingRoutine(null); }} title={`Editar ${editingRoutine?.title || "rutina"}`} description="Actualizá tu rutina personal.">{editingRoutine && <RoutineEditor routine={editingRoutine} exercises={exercises} onSave={saveRoutine} busy={routineBusy} compact />}</FormDialog>
  </main>;
}

function InfoCard({ icon: Icon = CalendarDays, label, value }) {
  return <article className="rounded-2xl bg-white p-4 shadow-sm"><p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400"><Icon className="size-3.5" /> {label}</p><p className="mt-2 text-sm font-black text-slate-800">{value}</p></article>;
}

function ScaleIcon(props) { return <Activity {...props} />; }

function NavButton({ active, onClick, icon: Icon, label }) {
  return <button onClick={onClick} className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2.5 text-[9px] font-black leading-none transition active:scale-95 ${active ? "bg-[#E30613] text-white shadow-sm" : "text-slate-500"}`}><Icon className="size-4" /><span className="truncate">{label}</span></button>;
}
