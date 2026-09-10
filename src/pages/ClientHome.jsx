import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Clock3, Edit3, Fingerprint, Home, ListPlus, LogOut, Plus, RefreshCw, ShieldCheck, Trash2, UserRound, UsersRound, XCircle } from "lucide-react";
import { APP_VERSION } from "../App";
import { statusOf, weeklyAccessUsage } from "../services/accessPolicy";
import RoutineEditor from "../components/routines/RoutineEditor";
import FormDialog from "../components/ui/FormDialog";
import { useAuth } from "../context/AuthContext";
import { listExercises } from "../services/exercises";
import { getMyClientPortal } from "../services/roles";
import { deleteMyRoutine, getMyRoutines, removeAssignedRoutine, saveMyRoutine } from "../services/routines";

const dateLabel = (value) => value ? new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString("es-AR") : "—";


function RoutineView({ routine, actions = null }) {
  const [open, setOpen] = useState(false);
  return <article className="rounded-[22px] bg-white p-4 shadow-sm"><button onClick={() => setOpen((value) => !value)} className="flex w-full items-start justify-between gap-3 text-left"><div><p className="font-black text-slate-900">{routine.title}</p><p className="mt-1 text-xs text-slate-400">{routine.items?.length || 0} ejercicios{routine.description ? ` · ${routine.description}` : ""}</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500">{open ? "Cerrar" : "Ver"}</span></button>{open && <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">{(routine.items || []).map((item, index) => <div key={item.id || `${item.exercise_name}-${index}`} className="rounded-xl bg-slate-50 p-3"><p className="text-sm font-black text-slate-800">{index + 1}. {item.exercise_name}</p><p className="mt-1 text-xs font-bold text-slate-500">{item.sets} series · {item.reps} reps · {item.rest_seconds}s descanso</p>{item.notes && <p className="mt-1 text-xs text-slate-400">{item.notes}</p>}</div>)}{actions && <div className="flex gap-2 pt-2">{actions}</div>}</div>}</article>;
}

export default function ClientHome({ previewPortal = null, previewIdentity = null, preview = false }) {
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
  const shownEmail = previewIdentity?.email || user?.email || "cliente@ejemplo.com";
  const name = previewIdentity?.name || profile?.display_name || user?.user_metadata?.name || shownEmail.split("@")[0] || "Usuario";

  const load = async () => {
    if (preview) return;
    setLoading(true); setError("");
    const result = await getMyClientPortal();
    if (result.error) setError(result.error.message || "No se pudo cargar tu ficha.");
    else setPortal(result.portal);
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

  const navClass = preview ? "sticky bottom-2 mx-3" : "fixed bottom-3 left-1/2 w-[calc(100%-1.5rem)] max-w-[420px] -translate-x-1/2";

  return <main className={`${preview ? "min-h-[760px]" : "min-h-svh"} bg-[#F5F5F5]`}>
    <div className="mx-auto w-full max-w-md pb-[calc(7rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between bg-[#050505] px-4 text-white shadow-lg"><img src="/infytter-logo.svg" alt="Infytter Fitness" className="h-9 w-32 object-contain object-left" /><div className="text-right"><p className="text-[11px] font-black text-[#E30613]">{APP_VERSION}</p><p className="text-[10px] text-white/50">Mi Infytter</p></div></header>

      <div className="space-y-4 p-4">
        {tab === "inicio" && <>
          <section className="overflow-hidden rounded-[28px] bg-[#050505] p-5 text-white shadow-xl"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="text-[11px] font-black uppercase tracking-[.18em] text-white/45">Mi cuenta</p><h1 className="mt-2 truncate text-2xl font-black">Hola, {name}</h1><p className="mt-1 truncate text-xs text-white/50">{shownEmail}</p></div><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#E30613]"><ShieldCheck className="size-5" /></span></div>{member && <div className="mt-5 flex items-center justify-between rounded-2xl bg-white/8 px-4 py-3"><div><p className="text-[10px] font-black uppercase tracking-wider text-white/40">Estado de membresía</p><p className="mt-1 text-lg font-black">{status}</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-black ${statusTone}`}>{dateLabel(member.expiry)}</span></div>}</section>
          {loading && <div className="flex items-center gap-2 rounded-2xl bg-white p-4 text-sm font-bold text-slate-500 shadow-sm"><RefreshCw className="size-4 animate-spin" /> Cargando tu información…</div>}
          {error && <div className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}
          {!loading && !error && !portal?.linked && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex items-start gap-3"><UserRound className="mt-0.5 size-5 shrink-0 text-amber-700" /><div><p className="font-black text-amber-900">Falta vincular tu ficha</p><p className="mt-1 text-sm leading-6 text-amber-800">El administrador debe buscar <strong>{shownEmail}</strong> en Usuarios y vincularlo con tu ficha de Cliente.</p></div></div></div>}
          {!loading && member && <><section className="grid grid-cols-2 gap-3"><article className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Plan</p><p className="mt-2 text-lg font-black text-slate-800">{member.plan || "—"}</p></article><article className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Vence</p><p className="mt-2 text-lg font-black text-slate-800">{dateLabel(member.expiry)}</p></article><article className="rounded-2xl bg-white p-4 shadow-sm"><p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400"><Fingerprint className="size-3.5" /> Acceso</p><p className="mt-2 text-sm font-black text-slate-800">{member.biometricMethod || "Sin registrar"}</p><p className="mt-1 text-[11px] text-slate-400">{portal.branchName || "—"}</p></article><article className="rounded-2xl bg-white p-4 shadow-sm"><p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400"><CalendarDays className="size-3.5" /> Semana</p><p className="mt-2 text-sm font-black text-slate-800">{thisWeekDays === null ? "Sin límite" : `${thisWeekDays} / 3 días`}</p><p className="mt-1 text-[11px] text-slate-400">Alta {dateLabel(member.start)}</p></article></section><section className="rounded-[24px] bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#E30613]">Actividad</p><h2 className="mt-1 text-lg font-black text-[#050505]">Últimos accesos</h2></div>{!preview && <button onClick={load} className="grid size-9 place-items-center rounded-xl border border-black/8 text-slate-500"><RefreshCw className="size-4" /></button>}</div><div className="mt-3 divide-y divide-slate-100">{accesses.slice(0, 8).map((item) => <div key={item.id} className="flex items-center justify-between gap-3 py-3"><div className="flex min-w-0 items-center gap-3"><span className={`grid size-9 shrink-0 place-items-center rounded-xl ${item.allowed ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{item.allowed ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}</span><div className="min-w-0"><p className="truncate text-sm font-black text-slate-800">{item.allowed ? "Ingreso autorizado" : "Ingreso rechazado"}</p><p className="text-[11px] text-slate-400">{new Date(item.date).toLocaleDateString("es-AR")}</p></div></div><span className="shrink-0 text-xs font-bold text-slate-400"><Clock3 className="mr-1 inline size-3.5" />{new Date(item.date).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</span></div>)}{!accesses.length && <p className="py-8 text-center text-sm text-slate-400">Todavía no tenés accesos registrados.</p>}</div></section></>}
          {!preview && <button onClick={logout} className="btn-secondary w-full"><LogOut className="size-4" /> Cerrar sesión</button>}
        </>}

        {tab === "mias" && <><section className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#E30613]">Entrenamiento</p><h1 className="text-2xl font-black">Mis rutinas</h1><p className="mt-1 text-xs text-slate-500">Podés crear hasta 3 rutinas personales.</p></div>{!preview && <button onClick={() => setCreatingRoutine(true)} disabled={routines.personal.length >= 3} className="grid size-11 place-items-center rounded-2xl bg-[#E30613] text-white disabled:bg-slate-300"><Plus className="size-5" /></button>}</section>{routineError && <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{routineError}</p>}{routineLoading ? <p className="rounded-2xl bg-white p-4 text-sm text-slate-500">Cargando rutinas…</p> : <div className="space-y-3">{routines.personal.map((routine) => <RoutineView key={routine.id} routine={routine} actions={!preview && <><button onClick={() => setEditingRoutine(routine)} className="btn-secondary flex-1"><Edit3 className="size-4" /> Editar</button><button onClick={() => removePersonal(routine)} className="btn-secondary px-3 text-[#9E0710]"><Trash2 className="size-4" /></button></>} />)}{!routines.personal.length && <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-400">Todavía no creaste rutinas personales.</p>}</div>}<p className="text-center text-xs font-black text-slate-400">{routines.personal.length} / 3 rutinas</p></>}

        {tab === "profe" && <><section><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#E30613]">Asignadas</p><h1 className="text-2xl font-black">Rutinas del profe</h1><p className="mt-1 text-xs leading-5 text-slate-500">Los cambios que haga tu profesor se actualizan acá. La rutina permanece hasta que vos decidas eliminarla.</p></section>{routineError && <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{routineError}</p>}<div className="space-y-3">{routines.assigned.map((routine) => <RoutineView key={routine.id} routine={routine} actions={!preview && <button onClick={() => removeProfessor(routine)} className="btn-secondary w-full text-[#9E0710]"><Trash2 className="size-4" /> Eliminar de mi cuenta</button>} />)}{!routineLoading && !routines.assigned.length && <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-400">Tu profesor todavía no te envió rutinas.</p>}</div></>}
      </div>

      <nav className={`${navClass} z-40 grid grid-cols-3 rounded-2xl border border-black/10 bg-white/95 p-1.5 shadow-2xl backdrop-blur-xl`}><button onClick={() => setTab("inicio")} className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-black ${tab === "inicio" ? "bg-[#050505] text-white" : "text-slate-500"}`}><Home className="size-4" /> Inicio</button><button onClick={() => setTab("mias")} className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-black ${tab === "mias" ? "bg-[#E30613] text-white" : "text-slate-500"}`}><ListPlus className="size-4" /> Mis rutinas</button><button onClick={() => setTab("profe")} className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-black ${tab === "profe" ? "bg-[#E30613] text-white" : "text-slate-500"}`}><UsersRound className="size-4" /> Profe</button></nav>
    </div>

    <FormDialog open={creatingRoutine} onOpenChange={setCreatingRoutine} title="Nueva rutina" description="Elegí ejercicios del glosario y ajustá los valores."><RoutineEditor compact exercises={exercises} onSave={saveRoutine} busy={routineBusy} /></FormDialog>
    <FormDialog open={!!editingRoutine} onOpenChange={(value) => { if (!value) setEditingRoutine(null); }} title={`Editar ${editingRoutine?.title || "rutina"}`} description="Esta rutina es sólo tuya.">{editingRoutine && <RoutineEditor compact routine={editingRoutine} exercises={exercises} onSave={saveRoutine} busy={routineBusy} />}</FormDialog>
  </main>;
}
