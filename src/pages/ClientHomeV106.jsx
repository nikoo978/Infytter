import CollapsibleSection from "../components/ui/CollapsibleSection";
import Recipes from "./Recipes";
import useRecipeVisibility from "../hooks/useRecipeVisibility";
import useAppBack from "../hooks/useAppBack";
import {
  Activity, ChefHat, CalendarDays, CheckCircle2, ChevronLeft, Clock3, Dumbbell, Fingerprint,
  Home, LogOut, Plus, RefreshCw, ShieldCheck, Trash2, UserRound, XCircle
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { APP_VERSION } from "../App";
import { gymWeekDay, GYM_TIME_ZONE } from "../services/gymDate";
import { statusOf, weeklyAccessUsage } from "../services/accessPolicy";
import ExerciseCatalog from "../components/exercises/ExerciseCatalog";
import BodyMetricsPanel from "../components/progress/BodyMetricsPanel";
import TrainingProgressPanel from "../components/progress/TrainingProgressPanel";
import RoutineEditor from "../components/routines/RoutineEditor";
import TrainingPlan from "../components/routines/TrainingPlan";
import FormDialog from "../components/ui/FormDialog";
import { useAuth } from "../context/AuthContext";
import { getMyBodyMetrics } from "../services/bodyMetrics";
import { listExercises } from "../services/exercises";
import { getMyClientPortal } from "../services/roles";
import { deleteMyRoutine, getMyRoutines, removeAssignedRoutine, saveMyRoutine, setMyRoutineDays } from "../services/routines";

const dateLabel = (value) => value ? new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString("es-AR") : "—";
const number = (value, digits = 1) => value == null ? "—" : Number(value).toLocaleString("es-AR", { maximumFractionDigits: digits });

export default function ClientHomeV106({ previewPortal = null, previewIdentity = null, preview = false }) {
  const { user, profile, logout } = useAuth();
  const recipesEnabled = useRecipeVisibility(preview);
  const [portal, setPortal] = useState(previewPortal);
  const [loading, setLoading] = useState(!preview);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("inicio");
  const [trainingView, setTrainingView] = useState("plan");
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
    setLoading(true);
    setError("");
    const [portalResult, metricResult] = await Promise.all([getMyClientPortal(), getMyBodyMetrics(2)]);
    if (portalResult.error) setError(portalResult.error.message || "No se pudo cargar tu ficha.");
    else setPortal(portalResult.portal);
    if (!metricResult.error) setLatestMetrics(metricResult.items || []);
    setLoading(false);
  };

  const loadRoutines = async () => {
    if (preview) { setRoutineLoading(false); return; }
    setRoutineLoading(true);
    setRoutineError("");
    const [routineResult, exerciseResult] = await Promise.all([getMyRoutines(), listExercises()]);
    if (routineResult.error) setRoutineError(routineResult.error.message || "No se pudieron cargar tus rutinas.");
    else setRoutines(routineResult.routines);
    if (!exerciseResult.error) setExercises(exerciseResult.exercises);
    else setRoutineError(exerciseResult.error.message || "No se pudo cargar la biblioteca de ejercicios.");
    setRoutineLoading(false);
  };

  useEffect(() => {
    if (preview) {
      setPortal(previewPortal);
      setLoading(false);
      setRoutineLoading(false);
      setError("");
      return;
    }
    void load();
    void loadRoutines();
  }, [user?.id, preview, previewPortal]);

  useAppBack(tab !== "inicio", () => { setTab("inicio"); setTrainingView("plan"); }, 0);

  const member = portal?.member;
  const accesses = portal?.accesses || [];
  const status = statusOf(member);
  const latest = latestMetrics[0] || null;
  const allRoutines = [...(routines.assigned || []), ...(routines.personal || [])];
  const todayValue = gymWeekDay();
  const todayLabel = new Intl.DateTimeFormat("es-AR", { timeZone: GYM_TIME_ZONE, weekday: "long", day: "numeric", month: "long" }).format(new Date());
  useEffect(() => { if (!preview) window.scrollTo({ top: 0, behavior: "instant" }); }, [tab, preview]);
  const todayRoutines = allRoutines.filter((routine) => (routine.scheduleDays || []).map(Number).includes(todayValue));
  const thisWeekDays = useMemo(() => {
    if (!member || member.plan !== "3 días") return null;
    return weeklyAccessUsage(accesses).usedDays;
  }, [member, accesses]);
  const statusTone = status === "Vigente" ? "bg-emerald-50 text-emerald-700" : status === "Por vencer" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700";

  const changeRoutineDays = async (routine, days) => {
    const result = await setMyRoutineDays(routine.id, days);
    if (result.error) throw result.error;
    setRoutines((current) => Object.fromEntries(Object.entries(current).map(([key, list]) => [key, list.map((item) => item.id === routine.id ? { ...item, scheduleDays: days } : item)])));
  };

  const saveRoutine = async (routine) => {
    setRoutineBusy(true);
    setRoutineError("");
    const result = await saveMyRoutine(routine);
    if (result.error) setRoutineError(result.error.message || "No se pudo guardar la rutina.");
    else {
      setCreatingRoutine(false);
      setEditingRoutine(null);
      await loadRoutines();
    }
    setRoutineBusy(false);
  };

  const removePersonal = async (routine) => {
    if (!window.confirm(`¿Eliminar tu rutina ${routine.title}?`)) return;
    setRoutineBusy(true);
    const result = await deleteMyRoutine(routine.id);
    if (!result.ok) setRoutineError(result.error?.message || "No se pudo eliminar la rutina.");
    else await loadRoutines();
    setRoutineBusy(false);
  };

  const removeProfessor = async (routine) => {
    if (!window.confirm(`¿Quitar ${routine.title} de tus rutinas del profesor?`)) return;
    setRoutineBusy(true);
    const result = await removeAssignedRoutine(routine.id);
    if (!result.ok) setRoutineError(result.error?.message || "No se pudo quitar la rutina.");
    else await loadRoutines();
    setRoutineBusy(false);
  };

  const navClass = preview
    ? "sticky bottom-2 mx-2"
    : "fixed bottom-0 left-1/2 w-full max-w-3xl -translate-x-1/2 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))]";

  return <main className={`${preview ? "min-h-full" : "min-h-dvh"} role-shell client-shell overflow-x-hidden bg-[#F4F5F7]`}>
    <div className="client-shell__inner mx-auto w-full max-w-5xl pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-white/10 bg-[#050505]/95 px-4 text-white shadow-lg backdrop-blur-xl sm:h-16">
        <img src="/infytter-logo.svg" alt="Infytter Fitness" className="h-8 w-28 object-contain object-left sm:h-9 sm:w-32" />
        <div className="whitespace-nowrap text-right"><p className="text-[11px] font-black text-[#E30613]">{APP_VERSION}</p><p className="text-[10px] text-white/70">Mi Infytter</p></div>
      </header>

      <div className={`${tab === "inicio" ? "student-home" : "space-y-4"} p-3.5 sm:p-4`}>
        {tab === "inicio" && <>
          <section className="student-home__welcome overflow-hidden rounded-[26px] bg-[#050505] p-5 text-white shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.18em] text-white/65">Tu día en Infytter</p><h1 className="student-home__greeting mt-2 break-words text-2xl font-black sm:text-3xl">Hola, {name}</h1><p className="mt-2 text-xs text-white/70">{todayLabel.charAt(0).toUpperCase() + todayLabel.slice(1)}</p></div>
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#E30613]"><ShieldCheck className="size-5" /></span>
            </div>
            {member && <div className="student-home__membership mt-5 flex items-center justify-between rounded-2xl bg-white/8 px-4 py-3 border border-white/10"><div><p className="text-[10px] font-black uppercase tracking-wider text-white/40">Membresía</p><p className="mt-1 text-lg font-black">{status}</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-black ${statusTone}`}>{dateLabel(member.expiry)}</span></div>}
          </section>

          {loading && <div className="flex items-center gap-2 rounded-2xl bg-white p-4 text-sm font-bold text-slate-500 shadow-sm"><RefreshCw className="size-4 animate-spin" /> Cargando tu información…</div>}
          {error && <div role="alert" className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}<button type="button" onClick={load} className="mt-3 block min-h-11 rounded-xl bg-white px-4">Volver a intentar</button></div>}
          {!loading && !error && !member && <section className="rounded-2xl bg-white p-6 text-center"><UserRound className="mx-auto size-8 text-slate-400" /><h2 className="mt-3 font-black">Tu ficha todavía no está vinculada</h2><p className="mt-2 text-sm text-slate-500">Pedí en recepción que vinculen tu cuenta con tu DNI para ver tu plan y membresía.</p><button type="button" onClick={load} className="btn-secondary mt-4">Actualizar mi ficha</button></section>}

          {routineError && tab === "inicio" && <div role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{routineError}<button type="button" onClick={loadRoutines} className="btn-secondary mt-3 min-h-11">Volver a cargar mi plan</button></div>}

          {!loading && member && <>
            <button disabled={routineLoading} onClick={() => { setTab("entrenar"); setTrainingView("plan"); }} className="student-home__training w-full disabled:opacity-60 overflow-hidden rounded-[24px] bg-[#E30613] p-5 text-left text-white shadow-lg active:scale-[.99]">
              <div className="flex items-center justify-between gap-4">
                <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-white/65">Entrenar hoy</p><p className="mt-1 text-xl font-black">{routineLoading ? "Cargando tus rutinas…" : todayRoutines.length ? todayRoutines[0].title : "Elegir una rutina"}</p><p className="mt-1 text-xs text-white/70">{todayRoutines.length ? `${todayRoutines.length} rutina${todayRoutines.length === 1 ? "" : "s"} programada${todayRoutines.length === 1 ? "" : "s"} para hoy` : "Todas tus rutinas, disponibles cuando quieras"}</p></div>
                <Dumbbell className="size-9 shrink-0" />
              </div>
            </button>

            <section className="student-home__stats grid grid-cols-2 gap-3 sm:grid-cols-4">
              <InfoCard label="Plan" value={member.plan || "—"} />
              <InfoCard icon={Fingerprint} label="Accesos esta semana" value={thisWeekDays === null ? "Sin límite" : `${thisWeekDays} / 3 días`} />
              <InfoCard icon={ScaleIcon} label="Peso" value={latest ? `${number(latest.weightKg)} kg` : "Sin medir"} />
              <InfoCard icon={Activity} label="IMC / grasa" value={latest ? `${number(latest.bmi, 2)}${latest.bodyFatPct != null ? ` · ${number(latest.bodyFatPct)}%` : ""}` : "Sin datos"} />
            </section>

            <section className="student-home__shortcuts grid grid-cols-2 gap-3">
              <button onClick={() => setTab("progreso")} className="min-h-24 rounded-[20px] bg-white p-4 text-left shadow-sm active:scale-[.98]"><Activity className="size-5 text-[#E30613]" /><p className="mt-3 text-sm font-black text-slate-900">Ver progreso</p><p className="mt-1 text-[10px] font-bold text-slate-400">Cuerpo + rendimiento</p></button>
              <button onClick={() => { setTab("ejercicios"); }} className="min-h-24 rounded-[20px] bg-white p-4 text-left shadow-sm active:scale-[.98]"><Dumbbell className="size-5 text-[#E30613]" /><p className="mt-3 text-sm font-black text-slate-900">Ejercicios</p><p className="mt-1 text-[10px] font-bold text-slate-400">Técnica y ejercicios</p></button>
            </section>
          </>}
        </>}

        {tab === "entrenar" && trainingView === "plan" && <TrainingPlan
          routines={routines}
          onChangeDays={changeRoutineDays}
          exercises={exercises}
          preview={preview}
          loading={routineLoading}
          error={routineError}
          onCreatePersonal={!preview ? () => setCreatingRoutine(true) : undefined}
          onEditPersonal={!preview ? setEditingRoutine : undefined}
          onDeletePersonal={!preview ? removePersonal : undefined}
          onRemoveAssigned={!preview ? removeProfessor : undefined}
          onOpenLibrary={() => setTab("ejercicios")}
          onRetry={loadRoutines}
        />}

        {tab === "entrenar" && trainingView === "biblioteca" && <>
          <button onClick={() => setTrainingView("plan")} className="flex items-center gap-2 text-sm font-black text-slate-600"><ChevronLeft className="size-4" /> Volver a mi plan</button>
          <ExerciseCatalog preview={preview} />
        </>}

        {tab === "recetas" && <Recipes onBack={() => setTab("inicio")} />}

        {tab === "ejercicios" && <ExerciseCatalog compact preview={preview} />}

        {tab === "progreso" && <div className="space-y-5">
          <TrainingProgressPanel preview={preview} />
          <BodyMetricsPanel self preview={preview} title="Progreso corporal" subtitle="Registrá peso, altura y medidas. El IMC y la grasa corporal por Navy son estimaciones orientativas." />
        </div>}

        {tab === "perfil" && <>
          <section className="overflow-hidden rounded-[26px] bg-[#050505] p-5 text-white shadow-xl">
            <div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.18em] text-white/70">Perfil</p><h1 className="mt-2 truncate text-2xl font-black">{name}</h1><p className="mt-1 truncate text-xs text-white/70">{shownEmail}</p></div><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/8"><UserRound className="size-5" /></span></div>
          </section>

          {member && <>
            <section className="grid grid-cols-2 gap-3">
              <InfoCard label="Membresía" value={status} />
              <InfoCard label="Vencimiento" value={dateLabel(member.expiry)} />
              <InfoCard icon={Fingerprint} label="Acceso" value={member.biometricMethod || "Sin registrar"} />
              <InfoCard icon={CalendarDays} label="Semana" value={thisWeekDays === null ? "Sin límite" : `${thisWeekDays} / 3 días`} />
            </section>

            <CollapsibleSection title="Últimos accesos" count={Math.min(accesses.length, 8)} description="Actividad de ingreso al gimnasio" actions={!preview && <button type="button" aria-label="Actualizar accesos" onClick={load} className="grid size-11 place-items-center rounded-xl border border-black/8 text-slate-500"><RefreshCw className="size-4" /></button>}>
              <div className="mt-3 divide-y divide-slate-100">{accesses.slice(0, 8).map((item) => <div key={item.id} className="flex items-center justify-between gap-3 py-3"><div className="flex min-w-0 items-center gap-3"><span className={`grid size-9 shrink-0 place-items-center rounded-xl ${item.allowed ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{item.allowed ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}</span><div className="min-w-0"><p className="truncate text-sm font-black text-slate-800">{item.allowed ? "Ingreso autorizado" : "Ingreso rechazado"}</p><p className="text-[11px] text-slate-400">{new Date(item.date).toLocaleDateString("es-AR", { timeZone: GYM_TIME_ZONE })}</p></div></div><span className="shrink-0 text-xs font-bold text-slate-400"><Clock3 className="mr-1 inline size-3.5" />{new Date(item.date).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: GYM_TIME_ZONE })}</span></div>)}{!accesses.length && <p className="py-7 text-center text-sm text-slate-400">Todavía no tenés accesos registrados.</p>}</div>
            </CollapsibleSection>
          </>}

          {!preview && <button onClick={logout} className="btn-secondary min-h-11 w-full"><LogOut className="size-4" /> Cerrar sesión</button>}
        </>}
      </div>

      <div className={`${navClass} z-40`}><nav aria-label="Menú del alumno" style={{ gridTemplateColumns: recipesEnabled ? "minmax(0, .8fr) minmax(0, 1.1fr) minmax(0, 1.2fr) minmax(0, 1.1fr) minmax(0, 1fr) minmax(0, .8fr)" : "repeat(5, minmax(0, 1fr))" }} className="grid gap-0.5 sm:gap-1 rounded-[22px] border border-black/10 bg-white/95 p-1.5 shadow-[0_-8px_30px_rgba(0,0,0,.12)] backdrop-blur-xl">
        <NavButton active={tab === "inicio"} onClick={() => setTab("inicio")} icon={Home} label="Inicio" />
        <NavButton active={tab === "entrenar"} onClick={() => { setTab("entrenar"); setTrainingView("plan"); }} icon={Dumbbell} label="Entrenar" />
        <NavButton active={tab === "ejercicios"} onClick={() => setTab("ejercicios")} icon={Dumbbell} label="Ejercicios" />
        <NavButton active={tab === "progreso"} onClick={() => { setTab("progreso"); if (!preview) void load(); }} icon={Activity} label="Progreso" />
        {recipesEnabled && <NavButton active={tab === "recetas"} onClick={() => setTab("recetas")} icon={ChefHat} label="Recetas" />}
        <NavButton active={tab === "perfil"} onClick={() => setTab("perfil")} icon={UserRound} label="Perfil" />
      </nav></div>
    </div>

    {routineError && (creatingRoutine || editingRoutine) && <p role="alert" className="fixed bottom-24 inset-x-3 z-[60] rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{routineError}</p>}
    <FormDialog open={creatingRoutine} onOpenChange={setCreatingRoutine} title="Nueva rutina" description="Elegí ejercicios, series, repeticiones y descanso. Entrenala cuando quieras."><RoutineEditor exercises={exercises} onSave={saveRoutine} busy={routineBusy} compact /></FormDialog>
    <FormDialog open={!!editingRoutine} onOpenChange={(value) => { if (!value) setEditingRoutine(null); }} title={`Editar ${editingRoutine?.title || "rutina"}`} description="Actualizá los ejercicios de tu rutina.">{editingRoutine && <RoutineEditor routine={editingRoutine} exercises={exercises} onSave={saveRoutine} busy={routineBusy} compact />}</FormDialog>
  </main>;
}

function InfoCard({ icon: Icon = CalendarDays, label, value }) {
  return <article className="rounded-2xl bg-white p-4 shadow-sm"><p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400"><Icon className="size-3.5" /> {label}</p><p className="mt-2 text-sm font-black text-slate-800">{value}</p></article>;
}

function ScaleIcon(props) { return <Activity {...props} />; }

function NavButton({ active, onClick, icon: Icon, label }) {
  return <button type="button" aria-current={active ? "page" : undefined} onClick={onClick} className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-0.5 py-2.5 text-[9px] min-[390px]:text-[10px] font-bold leading-none transition active:scale-95 ${active ? "bg-[#E30613] text-white shadow-sm" : "text-slate-500"}`}><Icon className="size-4" /><span className="whitespace-nowrap">{label}</span></button>;
}
