import { ClipboardList, Edit3, Plus, RefreshCw, Search, Send, UserRoundSearch, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import RoutineEditor from "../components/routines/RoutineEditor";
import FormDialog from "../components/ui/FormDialog";
import { listExercises } from "../services/exercises";
import { assignProfessorRoutine, getClientRoutinesForProfessor, listProfessorRoutines, listRoutineClients, saveProfessorRoutine } from "../services/routines";

export default function Routines() {
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

  const load = async () => {
    setLoading(true); setError("");
    const [routineResult, clientResult, exerciseResult] = await Promise.all([listProfessorRoutines(), listRoutineClients(), listExercises()]);
    if (routineResult.error) setError(routineResult.error.message || "No se pudieron cargar las rutinas.");
    else setRoutines(routineResult.routines);
    if (clientResult.error) setError((current) => current || clientResult.error.message || "No se pudieron cargar los clientes.");
    else setClients(clientResult.clients);
    if (!exerciseResult.error) setExercises(exerciseResult.exercises);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const selectedClient = clients.find((client) => String(client.person_id) === selectedClientId) || null;
  const clientName = selectedClient?.display_name || selectedClient?.email || "Cliente";
  const clientById = useMemo(() => new Map(clients.map((client) => [String(client.person_id), client])), [clients]);
  const filteredAssignClients = useMemo(() => clients.filter((client) => `${client.display_name || ""} ${client.email || ""} ${client.dni || ""}`.toLowerCase().includes(assignQuery.trim().toLowerCase())), [clients, assignQuery]);

  const loadClient = async (personId) => {
    setSelectedClientId(personId); setClientRoutines([]); setError("");
    if (!personId) return;
    const result = await getClientRoutinesForProfessor(personId);
    if (result.error) setError(result.error.message || "No se pudieron cargar las rutinas del cliente.");
    else setClientRoutines(result.routines);
  };

  const save = async (routine) => {
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
    setAssigning(routine);
    setAssignSelection((routine.assignedPersonIds || []).map(String));
    setAssignQuery("");
  };

  const assign = async () => {
    if (!assigning) return;
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
    <section className="page-head gap-4"><div><p className="eyebrow">Entrenamiento</p><h1 className="page-title">Rutinas</h1><p className="page-subtitle">Creá una vez, ajustá fácil y enviala a uno o varios clientes.</p></div><div className="grid w-full grid-cols-[auto_1fr] gap-2 sm:flex sm:w-auto"><button onClick={load} disabled={loading} className="btn-secondary px-3"><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /><span className="hidden sm:inline">Actualizar</span></button><button onClick={() => setCreating(true)} className="btn-primary"><Plus className="size-4" /> Nueva rutina</button></div></section>

    {message && <p className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</p>}
    {error && <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}

    <div className="grid grid-cols-2 rounded-2xl bg-slate-200/70 p-1 xl:hidden"><button onClick={() => setMobileView("rutinas")} className={`rounded-xl px-3 py-2.5 text-xs font-black ${mobileView === "rutinas" ? "bg-white text-[#050505] shadow-sm" : "text-slate-500"}`}><ClipboardList className="mr-1.5 inline size-4" /> Mis rutinas</button><button onClick={() => setMobileView("clientes")} className={`rounded-xl px-3 py-2.5 text-xs font-black ${mobileView === "clientes" ? "bg-white text-[#050505] shadow-sm" : "text-slate-500"}`}><UsersRound className="mr-1.5 inline size-4" /> Por cliente</button></div>

    <section className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
      <div className={`${mobileView === "rutinas" ? "block" : "hidden"} panel p-3.5 sm:p-5 xl:block`}><div className="flex items-center justify-between gap-3"><div><h2 className="section-title">Mis rutinas</h2><p className="mt-1 text-xs leading-5 text-slate-500">Editar una rutina actualiza automáticamente lo que ven los clientes que ya la recibieron.</p></div><ClipboardList className="size-5 shrink-0 text-[#E30613]" /></div>
        <div className="mt-4 space-y-3">{routines.map((routine) => <article key={routine.id} className="rounded-2xl border border-black/7 bg-white p-3.5 sm:p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="truncate font-black text-slate-800">{routine.title}</p><p className="mt-1 text-xs font-bold text-slate-400">{routine.items?.length || 0} ejercicios · {(routine.assignedPersonIds || []).length} clientes</p>{routine.description && <p className="mt-2 text-xs leading-5 text-slate-500 sm:text-sm">{routine.description}</p>}</div><div className="grid grid-cols-2 gap-2 sm:flex"><button onClick={() => setEditing(routine)} className="btn-secondary min-h-10 px-3"><Edit3 className="size-4" /> Editar</button><button onClick={() => openAssign(routine)} className="btn-primary min-h-10 px-3"><Send className="size-4" /> Enviar</button></div></div><div className="mt-3 flex flex-wrap gap-2">{(routine.assignedPersonIds || []).slice(0, 6).map((id) => <span key={id} className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-600">{clientById.get(String(id))?.display_name || clientById.get(String(id))?.email || "Cliente"}</span>)}{(routine.assignedPersonIds || []).length > 6 && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500">+{routine.assignedPersonIds.length - 6}</span>}</div></article>)}{!loading && !routines.length && <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center"><ClipboardList className="mx-auto size-7 text-slate-300" /><p className="mt-3 text-sm font-bold text-slate-400">Todavía no creaste rutinas.</p><button onClick={() => setCreating(true)} className="btn-primary mt-4"><Plus className="size-4" /> Crear primera rutina</button></div>}</div>
      </div>

      <div className={`${mobileView === "clientes" ? "block" : "hidden"} panel p-3.5 sm:p-5 xl:block`}><div className="flex items-center gap-2"><UserRoundSearch className="size-5 shrink-0 text-[#E30613]" /><div><h2 className="section-title">Ver por cliente</h2><p className="text-xs leading-5 text-slate-500">Incluye fichas del gimnasio aunque todavía no tengan una cuenta de acceso.</p></div></div>
        <select value={selectedClientId} onChange={(event) => loadClient(event.target.value)} className="mt-4 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-black outline-none"><option value="">Seleccionar cliente</option>{clients.map((client) => <option key={client.person_id} value={client.person_id}>{client.display_name || client.email} · DNI {client.dni || "—"}</option>)}</select>
        {selectedClient && <div className="mt-4 space-y-3"><p className="text-xs font-black uppercase tracking-wider text-slate-400">Rutinas de {clientName}</p>{clientRoutines.map((routine) => <article key={routine.id} className="rounded-2xl bg-slate-50 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-black text-slate-800">{routine.title}</p><p className="mt-1 text-xs text-slate-400">{routine.items?.length || 0} ejercicios</p></div>{routine.canEdit && <button onClick={() => setEditing(routine)} className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-slate-600 shadow-sm" aria-label="Editar rutina"><Edit3 className="size-4" /></button>}</div></article>)}{!clientRoutines.length && <p className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">Este cliente todavía no recibió rutinas.</p>}</div>}
        {!selectedClient && <div className="mt-5 rounded-2xl bg-slate-50 p-6 text-center"><UserRoundSearch className="mx-auto size-7 text-slate-300" /><p className="mt-2 text-sm font-bold text-slate-400">Elegí un cliente para ver sus rutinas.</p></div>}
      </div>
    </section>

    <FormDialog open={creating} onOpenChange={setCreating} title="Nueva rutina" description="Buscá ejercicios, agregalos con un toque y configurá la rutina."><RoutineEditor exercises={exercises} onSave={save} busy={busy} /></FormDialog>
    <FormDialog open={!!editing} onOpenChange={(value) => { if (!value) setEditing(null); }} title={`Editar ${editing?.title || "rutina"}`} description="Los cambios se reflejan en todos los clientes que ya recibieron esta rutina.">{editing && <RoutineEditor routine={editing} exercises={exercises} onSave={save} busy={busy} />}</FormDialog>
    <FormDialog open={!!assigning} onOpenChange={(value) => { if (!value) setAssigning(null); }} title={`Enviar ${assigning?.title || "rutina"}`} description="Seleccioná uno o varios clientes. Los envíos existentes permanecen vinculados a su ficha."><label className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3"><Search className="size-4 text-slate-400" /><input value={assignQuery} onChange={(event) => setAssignQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Buscar nombre, DNI o email" /></label><div className="mt-3 max-h-[52dvh] space-y-2 overflow-y-auto">{filteredAssignClients.map((client) => { const clientId = String(client.person_id); const checked = assignSelection.includes(clientId); const locked = (assigning?.assignedPersonIds || []).map(String).includes(clientId); return <label key={clientId} className={`flex items-center gap-3 rounded-xl border p-3 ${checked ? "border-[#E30613]/20 bg-red-50/50" : "border-black/7"}`}><input type="checkbox" checked={checked} disabled={locked} onChange={(event) => setAssignSelection((current) => event.target.checked ? [...new Set([...current, clientId])] : current.filter((id) => id !== clientId))} className="size-5 shrink-0 accent-[#E30613]" /><div className="min-w-0"><p className="truncate text-sm font-black text-slate-800">{client.display_name || client.email}</p><p className="truncate text-xs text-slate-400">DNI {client.dni || "—"}{client.user_id ? " · Cuenta vinculada" : " · Ficha del gimnasio"}{locked ? " · Ya enviada" : ""}</p></div></label>; })}{!filteredAssignClients.length && <p className="py-6 text-center text-sm text-slate-400">No hay clientes que coincidan.</p>}</div><button onClick={assign} disabled={busy || !clients.length} className="btn-primary mt-4 min-h-11 w-full"><UsersRound className="size-4" /> {busy ? "Enviando…" : "Enviar a seleccionados"}</button></FormDialog>
  </div>;
}
