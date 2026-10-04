import useAppBack from "../hooks/useAppBack";
import { ClipboardList, Edit3, Plus, RefreshCw, Search, Send, UserRoundSearch, UsersRound } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useSearchParams } from "react-router-dom";
import RoutineView from "../components/routines/RoutineView";
import RoutineEditor from "../components/routines/RoutineEditor";
import ProfessorTrainingOverview from "../components/routines/ProfessorTrainingOverview";
import FormDialog from "../components/ui/FormDialog";
import { listExercises } from "../services/exercises";
import { assignProfessorRoutine, getClientRoutinesForProfessor, listProfessorRoutines, listRoutineClients, saveProfessorRoutine } from "../services/routines";

export default function Routines() {
  const { permissions } = useAuth();
  const canViewStudents = permissions.canViewStudentRoutines;
  const needsClients = canViewStudents || permissions.canAssignRoutines;
  const loadId = useRef(0);
  const [searchParams] = useSearchParams();
  const requestId = useRef(0);
  const linkedClient = useRef("");
  const [clientLoading, setClientLoading] = useState(false);
  const [routines, setRoutines] = useState([]);
  const [clients, setClients] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [clientRoutines, setClientRoutines] = useState([]);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [assigning, setAssigning] = useState(null);
  const [assignSelection, setAssignSelection] = useState([]);
  const [assignQuery, setAssignQuery] = useState("");
  const [mobileView, setMobileView] = useState("rutinas");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useAppBack(mobileView === "clientes", () => setMobileView("rutinas"), 5);

  const load = async () => {
    const currentLoad = ++loadId.current;
    setLoading(true); setError("");
    const [routineResult, clientResult, exerciseResult] = await Promise.all([permissions.canViewRoutines ? listProfessorRoutines() : Promise.resolve({ routines: [] }), needsClients ? listRoutineClients() : Promise.resolve({ clients: [] }), permissions.canViewExercises ? listExercises() : Promise.resolve({ exercises: [] })]);
    if (currentLoad !== loadId.current) return;
    if (routineResult.error) setError(routineResult.error.message || "No se pudieron cargar las rutinas.");
    else setRoutines(routineResult.routines);
    if (clientResult.error) setError((current) => current || clientResult.error.message || "No se pudieron cargar los clientes.");
    else setClients(clientResult.clients);
    if (!exerciseResult.error) setExercises(exerciseResult.exercises);
    else setError((current) => current || "No se pudo cargar la biblioteca de ejercicios. Volvé a intentar antes de editar una rutina.");
    setLoading(false);
  };

  useEffect(() => {
    void load();
    if (!canViewStudents) {
      ++requestId.current; setClients([]); setClientRoutines([]); setSelectedClientId(""); setMobileView("rutinas"); linkedClient.current = "";
    }
    return () => { ++loadId.current; ++requestId.current; };
    if (!permissions.canAssignRoutines) setAssigning(null);
    if (!permissions.canCreateRoutines) setCreating(false);
    if (!permissions.canEditRoutines) setEditing(null);
  }, [canViewStudents, permissions.canViewRoutines, permissions.canAssignRoutines, permissions.canCreateRoutines, permissions.canEditRoutines, permissions.canViewExercises]);

  const selectedClient = clients.find((client) => String(client.person_id) === selectedClientId) || null;
  const clientName = selectedClient?.display_name || selectedClient?.email || "Cliente";
  const clientById = useMemo(() => new Map(clients.map((client) => [String(client.person_id), client])), [clients]);
  const filteredAssignClients = useMemo(() => clients.filter((client) => `${client.display_name || ""} ${client.email || ""} ${client.dni || ""}`.toLowerCase().includes(assignQuery.trim().toLowerCase())), [clients, assignQuery]);

  const loadClient = async (personId) => {
    const currentRequest = ++requestId.current;
    setSelectedClientId(String(personId)); setClientRoutines([]); setError(""); setClientLoading(Boolean(personId) && canViewStudents);
    if (!personId || !canViewStudents) return;
    const result = await getClientRoutinesForProfessor(personId);
    if (currentRequest !== requestId.current) return;
    setClientLoading(false);
    if (result.error) setError(result.error.message || "No se pudieron cargar las rutinas del cliente.");
    else setClientRoutines(result.routines);
  };

  useEffect(() => {
    const id = searchParams.get("alumno");
    if (!canViewStudents || !id || loading || linkedClient.current === id || !clients.some((client) => String(client.person_id) === id)) return;
    linkedClient.current = id;
    setMobileView("clientes");
    void loadClient(id);
  }, [searchParams, clients, loading, canViewStudents]);

  const newRecipients = assignSelection.filter((id) => !(assigning?.assignedPersonIds || []).map(String).includes(id));

  const save = async (routine) => {
    if (routine.id ? !permissions.canEditRoutines : !permissions.canCreateRoutines) return;
    setBusy(true); setError(""); setMessage("");
    const result = await saveProfessorRoutine(routine);
    if (result.error) setError(result.error.message || "No se pudo guardar la rutina.");
    else {
      setCreating(false); setEditing(null); setMessage("Rutina guardada."); await load();
      if (selectedClientId) await loadClient(selectedClientId);
    }
    setBusy(false);
  };

  const openAssign = (routine) => {
    if (!permissions.canAssignRoutines) return;
    setAssigning(routine);
    setAssignSelection((routine.assignedPersonIds || []).map(String));
    setAssignQuery("");
  };

  const assign = async () => {
    if (!assigning || !permissions.canAssignRoutines) return;
    const existing = new Set((assigning.assignedPersonIds || []).map(String));
    const additions = assignSelection.filter((id) => !existing.has(String(id)));
    if (!additions.length) { setAssigning(null); return; }
    setBusy(true); setError(""); setMessage("");
    const result = await assignProfessorRoutine(assigning.id, additions);
    if (result.error) setError(result.error.message || "No se pudo asignar la rutina.");
    else { setMessage(`Rutina enviada a ${result.added} cliente${result.added === 1 ? "" : "s"}.`); setAssigning(null); await load(); if (selectedClientId) await loadClient(selectedClientId); }
    setBusy(false);
  };

  return <div className="mx-auto max-w-[1480px] space-y-4 sm:space-y-6">
    <section className="page-head gap-4"><div><p className="eyebrow">Entrenamiento</p><h1 className="page-title">Rutinas</h1><p className="page-subtitle">Creá una vez, ajustá fácil y enviala a uno o varios clientes.</p></div><div className="grid w-full grid-cols-[auto_1fr] gap-2 sm:flex sm:w-auto"><button aria-label="Actualizar rutinas" onClick={load} disabled={loading} className="btn-secondary px-3"><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /><span className="hidden sm:inline">Actualizar</span></button>{permissions.canCreateRoutines && <button onClick={() => setCreating(true)} disabled={loading || busy || !exercises.length} className="btn-primary disabled:opacity-50"><Plus className="size-4" /> Nueva rutina</button>}</div></section>

    {message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</p>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}

    {canViewStudents && permissions.canViewRoutines && <div className="grid grid-cols-2 rounded-2xl bg-slate-200/70 p-1 xl:hidden"><button aria-pressed={mobileView === "rutinas"} onClick={() => setMobileView("rutinas")} className={`rounded-xl px-3 py-2.5 text-xs font-black ${mobileView === "rutinas" ? "bg-white text-[#050505] shadow-sm" : "text-slate-500"}`}><ClipboardList className="mr-1.5 inline size-4" /> Mis rutinas</button><button aria-pressed={mobileView === "clientes"} onClick={() => setMobileView("clientes")} className={`rounded-xl px-3 py-2.5 text-xs font-black ${mobileView === "clientes" || !permissions.canViewRoutines ? "bg-white text-[#050505] shadow-sm" : "text-slate-500"}`}><UsersRound className="mr-1.5 inline size-4" /> Por cliente</button></div>}

    <section className={`grid min-w-0 gap-6 ${canViewStudents && permissions.canViewRoutines ? "xl:grid-cols-[1.15fr_.85fr]" : ""}`}>
      {permissions.canViewRoutines && <div className={`${mobileView === "rutinas" ? "block" : "hidden"} min-w-0 panel p-3.5 sm:p-5 xl:block`}><div className="flex items-center justify-between gap-3"><div><h2 className="section-title">Mis rutinas</h2><p className="mt-1 text-xs leading-5 text-slate-500">Editar una rutina actualiza automáticamente lo que ven los clientes que ya la recibieron.</p></div><ClipboardList className="size-5 shrink-0 text-[#E30613]" /></div>
        <div className="mt-4 space-y-3">{routines.map((routine) => <RoutineView key={routine.id} routine={routine} exercises={exercises} allowTraining={false} summary={`${(routine.assignedPersonIds || []).length} clientes`} actions={<div className="w-full space-y-3"><div className="grid grid-cols-2 gap-2">{permissions.canEditRoutines && <button onClick={() => setEditing(routine)} className="btn-secondary min-h-11"><Edit3 className="size-4" /> Editar</button>}{permissions.canAssignRoutines && <button onClick={() => openAssign(routine)} className="btn-primary min-h-11"><Send className="size-4" /> Enviar</button>}</div><div className="flex flex-wrap gap-2">{(routine.assignedPersonIds || []).map((id) => <span key={id} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{clientById.get(String(id))?.display_name || clientById.get(String(id))?.email || "Cliente"}</span>)}</div></div>} />)}{!loading && !routines.length && <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center"><ClipboardList className="mx-auto size-7 text-slate-300" /><p className="mt-3 text-sm font-bold text-slate-400">Todavía no creaste rutinas.</p>{permissions.canCreateRoutines && <button onClick={() => setCreating(true)} className="btn-primary mt-4"><Plus className="size-4" /> Crear primera rutina</button>}</div>}</div>
      </div>}

      {canViewStudents && <div className={`${mobileView === "clientes" || !permissions.canViewRoutines ? "block" : "hidden"} min-w-0 panel p-3.5 sm:p-5 xl:block`}><div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:items-start sm:text-left"><UserRoundSearch className="size-5 shrink-0 text-[#E30613]" /><div className="min-w-0 w-full"><h2 className="section-title">Ver por cliente</h2><p className="text-xs leading-5 text-slate-500">Rutinas personales y compartidas. También incluye fichas sin cuenta de acceso.</p></div></div>
        <select aria-label="Alumno para consultar rutinas" value={selectedClientId} onChange={(event) => loadClient(event.target.value)} className="mt-4 h-11 min-w-0 max-w-full w-full truncate rounded-xl border border-slate-200 bg-white px-3 text-sm font-black outline-none"><option value="">Seleccionar cliente</option>{clients.map((client) => <option key={client.person_id} value={client.person_id}>{client.display_name || client.email} · DNI {client.dni || "—"}</option>)}</select>
        {clientLoading && <p role="status" className="mt-4 text-sm text-slate-500">Cargando rutinas del alumno…</p>}
        {selectedClient && <div className="mt-4 space-y-3"><p className="text-xs font-black uppercase tracking-wider text-slate-400">Rutinas de {clientName}</p>{clientRoutines.map((routine) => <RoutineView key={`${selectedClientId}-${routine.id}`} routine={routine} exercises={exercises} allowTraining={false} summary={routine.sourceType === "client" ? "Personal del alumno" : "Compartida por profesor"} actions={routine.canEdit && permissions.canEditRoutines ? <button onClick={() => setEditing(routine)} className="btn-secondary min-h-11"><Edit3 className="size-4" /> Editar rutina</button> : null} />)}{!clientLoading && !error && !clientRoutines.length && <p className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">Este alumno todavía no tiene rutinas personales ni compartidas.</p>}</div>}
        {selectedClient && permissions.canViewStudentProgress && <ProfessorTrainingOverview key={selectedClientId} personId={selectedClientId} />}{!selectedClient && <div className="mt-5 rounded-2xl bg-slate-50 p-6 text-center"><UserRoundSearch className="mx-auto size-7 text-slate-300" /><p className="mt-2 text-sm font-bold text-slate-400">Elegí un cliente para ver sus rutinas y entrenamientos.</p></div>}
      </div>}
    </section>

    <FormDialog open={creating} onOpenChange={setCreating} title="Nueva rutina" description="Buscá ejercicios, agregalos con un toque y configurá la rutina."><>{error && <p role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}<RoutineEditor exercises={exercises} onSave={save} busy={busy} /></></FormDialog>
    <FormDialog open={!!editing} onOpenChange={(value) => { if (!value) setEditing(null); }} title={`Editar ${editing?.title || "rutina"}`} description="Los cambios se reflejan en todos los clientes que ya recibieron esta rutina.">{error && <p role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}{editing && <RoutineEditor routine={editing} exercises={exercises} onSave={save} busy={busy} />}</FormDialog>
    <FormDialog open={!!assigning} onOpenChange={(value) => { if (!value) setAssigning(null); }} title={`Enviar ${assigning?.title || "rutina"}`} description="Seleccioná uno o varios clientes. Los envíos existentes permanecen vinculados a su ficha.">{error && <p role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}<label className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3"><Search className="size-4 text-slate-400" /><input value={assignQuery} onChange={(event) => setAssignQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" aria-label="Buscar destinatarios" placeholder="Buscar nombre, DNI o email" /></label><div className="mt-3 max-h-[52dvh] space-y-2 overflow-y-auto">{filteredAssignClients.map((client) => { const clientId = String(client.person_id); const checked = assignSelection.includes(clientId); const locked = (assigning?.assignedPersonIds || []).map(String).includes(clientId); return <label key={clientId} className={`flex items-center gap-3 rounded-xl border p-3 ${checked ? "border-[#E30613]/20 bg-red-50/50" : "border-black/7"}`}><input type="checkbox" checked={checked} disabled={locked || busy} onChange={(event) => setAssignSelection((current) => event.target.checked ? [...new Set([...current, clientId])] : current.filter((id) => id !== clientId))} className="size-5 shrink-0 accent-[#E30613]" /><div className="min-w-0"><p className="truncate text-sm font-black text-slate-800">{client.display_name || client.email}</p><p className="break-words text-xs text-slate-500">DNI {client.dni || "—"}{client.user_id ? " · Cuenta vinculada" : " · Ficha del gimnasio"}{locked ? " · Ya enviada" : ""}</p></div></label>; })}{!filteredAssignClients.length && <p className="py-6 text-center text-sm text-slate-400">No hay clientes que coincidan.</p>}</div><button onClick={assign} disabled={busy || !newRecipients.length} className="btn-primary mt-4 min-h-11 w-full"><UsersRound className="size-4" /> {busy ? "Enviando…" : `Enviar a ${newRecipients.length} alumno${newRecipients.length === 1 ? "" : "s"}`}</button></FormDialog>
  </div>;
}
