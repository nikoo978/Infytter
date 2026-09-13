import { useMemo, useState } from "react";
import { Archive, ArchiveRestore, CreditCard, Pencil, Plus, Search, Trash2 } from "lucide-react";
import FormDialog from "../components/ui/FormDialog";
import { statusOf, useGym } from "../context/GymContext";
import { useAuth } from "../context/AuthContext";
import { addCalendarMonths, gymDateISO } from "../services/gymDate";

const input = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#E30613]/20";
const dateLabel = (value) => value ? new Date(`${value}T12:00:00Z`).toLocaleDateString("es-AR", { timeZone: "UTC" }) : "—";

export default function Clientes() {
  const { data, addPerson, editPerson, archivePerson, restorePerson, deletePerson, renew } = useGym();
  const { permissions } = useAuth();
  const [query, setQuery] = useState("");
  const [view, setView] = useState("active");
  const [adding, setAdding] = useState(false);
  const [renewing, setRenewing] = useState(null);
  const [editing, setEditing] = useState(null);
  const [archiving, setArchiving] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [error, setError] = useState("");

  const branchClients = useMemo(() => data.people.filter((person) => person.role === "Cliente" && person.branch === data.activeBranch), [data.people, data.activeBranch]);
  const archivedCount = branchClients.filter((person) => person.archivedAt).length;
  const clients = useMemo(() => branchClients
    .filter((person) => view === "archived" ? Boolean(person.archivedAt) : !person.archivedAt)
    .filter((person) => `${person.name} ${person.dni}`.toLowerCase().includes(query.trim().toLowerCase())), [branchClients, query, view]);

  const submitPerson = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const start = gymDateISO();
    const result = addPerson({
      name: form.get("name").trim(), dni: form.get("dni").trim(), phone: form.get("phone").trim(),
      role: "Cliente", plan: form.get("plan"), price: Number(form.get("price")),
      biometricMethod: form.get("biometricMethod"),
      biometricStatus: form.get("biometricMethod") === "Sin registrar" ? "Pendiente" : "Listo para vincular",
      initialPayment: form.get("initialPayment") === "on", discount: Number(form.get("discount")),
      method: form.get("method"), start, expiry: addCalendarMonths(start, 1),
    });
    if (!result.ok) { setError(result.error); return; }
    setError(""); setAdding(false);
  };

  const submitEdit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = editPerson(editing.id, {
      name: form.get("name").trim(), dni: form.get("dni").trim(), phone: form.get("phone").trim(),
      plan: form.get("plan"), price: Number(form.get("price")), biometricMethod: form.get("biometricMethod"),
      biometricStatus: form.get("biometricMethod") === "Sin registrar" ? "Pendiente" : "Listo para vincular",
    });
    if (!result.ok) { setError(result.error); return; }
    setError(""); setEditing(null);
  };

  const submitArchive = (event) => {
    event.preventDefault();
    const result = archivePerson(archiving.id, new FormData(event.currentTarget).get("reason"));
    if (!result.ok) { setError(result.error); return; }
    setError(""); setArchiving(null);
  };

  const restore = (person) => {
    const result = restorePerson(person.id);
    if (!result.ok) setError(result.error);
  };

  const submitDelete = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (form.get("confirmation") !== "ELIMINAR") { setError("Escribí ELIMINAR para confirmar."); return; }
    const result = deletePerson(deleting.id, form.get("reason"));
    if (!result.ok) { setError(result.error); return; }
    setError(""); setDeleting(null);
  };

  const submitRenew = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    renew(renewing.id, { months: form.get("months"), discount: form.get("discount"), method: form.get("method") });
    setRenewing(null);
  };

  const activeActions = (person, compact = false) => permissions?.canOperate && <>
    <button onClick={() => setRenewing(person)} className={compact ? "btn-primary min-h-10" : "inline-flex items-center gap-1 text-sm font-black text-[#E30613]"}><CreditCard className="size-4" /> Renovar</button>
    <button onClick={() => { setError(""); setEditing(person); }} className={compact ? "btn-secondary min-h-10" : "inline-flex items-center gap-1 text-sm font-black text-slate-600"}><Pencil className="size-4" /> Editar</button>
    <button onClick={() => { setError(""); setArchiving(person); }} className={compact ? "btn-secondary min-h-10" : "inline-flex items-center gap-1 text-sm font-black text-slate-600"}><Archive className="size-4" /> Archivar</button>
    {permissions?.canDelete && <button onClick={() => { setError(""); setDeleting(person); }} className={compact ? "min-h-10 rounded-xl bg-red-50 text-sm font-black text-[#9E0710]" : "inline-flex items-center gap-1 text-sm font-black text-[#9E0710]"} aria-label={`Eliminar definitivamente a ${person.name}`}><Trash2 className="size-4" />{compact && " Eliminar"}</button>}
  </>;

  const archivedActions = (person, compact = false) => permissions?.canOperate && <>
    <button onClick={() => restore(person)} className={compact ? "btn-primary min-h-10" : "inline-flex items-center gap-1 text-sm font-black text-[#E30613]"}><ArchiveRestore className="size-4" /> Restaurar</button>
    {permissions?.canDelete && <button onClick={() => { setError(""); setDeleting(person); }} className={compact ? "min-h-10 rounded-xl bg-red-50 text-sm font-black text-[#9E0710]" : "inline-flex items-center gap-1 text-sm font-black text-[#9E0710]"}><Trash2 className="size-4" /> Eliminar</button>}
  </>;

  return <div className="mx-auto max-w-[1480px] space-y-4 sm:space-y-6">
    <section className="page-head"><div><p className="eyebrow">Personas</p><h1 className="page-title">Clientes</h1><p className="page-subtitle">Alumnos, planes y vencimientos de la sucursal activa.</p></div>{permissions?.canOperate && <button onClick={() => setAdding(true)} className="btn-primary"><Plus className="size-4" /> Nuevo cliente</button>}</section>

    <section className="panel p-3.5 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 focus-within:ring-2 focus-within:ring-[#E30613]/15"><Search className="size-4 shrink-0 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 w-full bg-transparent text-sm outline-none" placeholder="Buscar por nombre o DNI" /></label>
        <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1"><button onClick={() => setView("active")} className={`rounded-lg px-3 py-2 text-xs font-black ${view === "active" ? "bg-white text-[#050505] shadow-sm" : "text-slate-500"}`}>Activos</button><button onClick={() => setView("archived")} className={`rounded-lg px-3 py-2 text-xs font-black ${view === "archived" ? "bg-white text-[#050505] shadow-sm" : "text-slate-500"}`}>Archivados ({archivedCount})</button></div>
      </div>
      {error && !adding && !editing && !archiving && !deleting && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-600">{error}</p>}

      <div className="mt-4 space-y-3 md:hidden">{clients.map((person) => { const status = statusOf(person); return <article key={person.id} className="rounded-2xl border border-black/7 bg-white p-3.5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-black text-slate-800">{person.name}</p><p className="mt-1 text-xs font-bold text-slate-400">DNI {person.dni} · {person.plan}</p></div><span className={`status shrink-0 ${status === "Vigente" ? "status-ok" : status === "Por vencer" ? "status-warn" : "status-bad"}`}>{status}</span></div><div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-xl bg-slate-50 p-2.5"><p className="text-[10px] font-black uppercase text-slate-400">Vencimiento</p><p className="mt-1 text-xs font-black text-slate-700">{dateLabel(person.expiry)}</p></div><div className="rounded-xl bg-slate-50 p-2.5"><p className="text-[10px] font-black uppercase text-slate-400">Biometría</p><p className="mt-1 truncate text-xs font-black text-slate-700">{person.biometricMethod || "Sin registrar"}</p></div></div>{person.archivedAt && <p className="mt-3 text-xs text-slate-500">Archivado el {new Date(person.archivedAt).toLocaleDateString("es-AR")}{person.archivedReason ? ` · ${person.archivedReason}` : ""}</p>}<div className={`mt-3 grid gap-2 ${permissions?.canDelete ? "grid-cols-2" : "grid-cols-1"}`}>{view === "archived" ? archivedActions(person, true) : activeActions(person, true)}</div></article>; })}{!clients.length && <p className="py-10 text-center text-sm text-slate-400">No hay clientes para mostrar.</p>}</div>

      <div className="mt-5 hidden overflow-x-auto md:block"><table className="w-full min-w-[1000px] text-left"><thead><tr className="table-head"><th>Cliente</th><th>Plan</th><th>Biometría</th><th>Vencimiento</th><th>Estado</th><th className="text-right">Acciones</th></tr></thead><tbody className="divide-y divide-slate-100">{clients.map((person) => { const status = statusOf(person); return <tr key={person.id}><td className="py-4"><p className="font-bold text-slate-800">{person.name}</p><p className="text-xs text-slate-400">DNI {person.dni}</p>{person.archivedReason && <p className="mt-1 max-w-56 truncate text-xs text-slate-400">{person.archivedReason}</p>}</td><td>{person.plan}</td><td><span className="status status-ok">{person.biometricMethod || "Sin registrar"}</span></td><td>{dateLabel(person.expiry)}</td><td><span className={`status ${status === "Vigente" ? "status-ok" : status === "Por vencer" ? "status-warn" : "status-bad"}`}>{status}</span></td><td><div className="flex justify-end gap-3">{view === "archived" ? archivedActions(person) : activeActions(person)}</div></td></tr>; })}</tbody></table>{!clients.length && <p className="py-12 text-center text-sm text-slate-400">No hay clientes para mostrar.</p>}</div>
    </section>

    <FormDialog open={adding} onOpenChange={(value) => { setAdding(value); setError(""); }} title="Nuevo cliente" description="La membresía inicial será válida por un mes."><form onSubmit={submitPerson} className="grid gap-4 sm:grid-cols-2"><label className="sm:col-span-2">Nombre completo<input name="name" required className={input} /></label><label>DNI<input name="dni" inputMode="numeric" pattern="[0-9]+" required className={input} /></label><label>Teléfono<input name="phone" className={input} /></label><label>Plan<select name="plan" className={input}><option>Full</option><option>3 días</option></select></label><label>Precio mensual<input name="price" required type="number" min="0" defaultValue="45000" className={input} /></label><label>Descuento inicial %<input name="discount" type="number" min="0" max="100" defaultValue="0" className={input} /></label><label>Medio de pago<select name="method" className={input}><option>Efectivo</option><option>Transferencia</option><option>Tarjeta</option></select></label><label className="sm:col-span-2">Dato biométrico<select name="biometricMethod" className={input}><option>Sin registrar</option><option>Huella</option><option>Reconocimiento facial</option></select></label><label className="sm:col-span-2 flex items-center gap-3 rounded-xl bg-[#F5F5F5] p-3 text-sm font-bold"><input name="initialPayment" type="checkbox" defaultChecked className="size-4 accent-[#E30613]" /> Registrar también el pago inicial</label>{error && <p className="sm:col-span-2 text-sm font-bold text-red-600">{error}</p>}<button className="btn-primary sm:col-span-2">Guardar cliente</button></form></FormDialog>
    <FormDialog open={!!editing} onOpenChange={(value) => { if (!value) setEditing(null); setError(""); }} title={`Editar a ${editing?.name || ""}`} description="Actualizá sus datos y la opción biométrica."><form onSubmit={submitEdit} className="grid gap-4 sm:grid-cols-2"><label className="sm:col-span-2">Nombre completo<input name="name" required defaultValue={editing?.name} className={input} /></label><label>DNI<input name="dni" required inputMode="numeric" pattern="[0-9]+" defaultValue={editing?.dni} className={input} /></label><label>Teléfono<input name="phone" defaultValue={editing?.phone} className={input} /></label><label>Plan<select name="plan" defaultValue={editing?.plan} className={input}><option>Full</option><option>3 días</option></select></label><label>Precio mensual<input name="price" required type="number" min="0" defaultValue={editing?.price} className={input} /></label><label className="sm:col-span-2">Dato biométrico<select name="biometricMethod" defaultValue={editing?.biometricMethod || "Sin registrar"} className={input}><option>Sin registrar</option><option>Huella</option><option>Reconocimiento facial</option></select></label>{error && <p className="sm:col-span-2 text-sm font-bold text-red-600">{error}</p>}<button className="btn-primary sm:col-span-2">Guardar cambios</button></form></FormDialog>
    <FormDialog open={!!renewing} onOpenChange={(value) => !value && setRenewing(null)} title={`Renovar a ${renewing?.name || ""}`} description="Se registra el pago y extiende el vencimiento."><form onSubmit={submitRenew} className="grid gap-4 sm:grid-cols-2"><label>Meses<input name="months" type="number" min="1" defaultValue="1" className={input} /></label><label>Descuento %<input name="discount" type="number" min="0" max="100" defaultValue="0" className={input} /></label><label className="sm:col-span-2">Medio de pago<select name="method" className={input}><option>Efectivo</option><option>Transferencia</option><option>Tarjeta</option></select></label><button className="btn-primary sm:col-span-2">Confirmar renovación</button></form></FormDialog>
    <FormDialog open={!!archiving} onOpenChange={(value) => { if (!value) setArchiving(null); setError(""); }} title={`Archivar a ${archiving?.name || ""}`} description="La ficha dejará de aparecer entre los clientes activos, pero conservará su historial y podrá restaurarse."><form onSubmit={submitArchive} className="grid gap-4"><label>Motivo opcional<textarea name="reason" rows="3" maxLength="300" className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-[#E30613]/20" /></label>{error && <p className="text-sm font-bold text-red-600">{error}</p>}<button className="btn-primary"><Archive className="size-4" /> Archivar cliente</button></form></FormDialog>
    <FormDialog open={!!deleting} onOpenChange={(value) => { if (!value) setDeleting(null); setError(""); }} title={`Eliminar definitivamente a ${deleting?.name || ""}`} description="Se eliminará la ficha y se anonimizarán sus referencias. Los movimientos financieros se conservarán."><form onSubmit={submitDelete} className="grid gap-4"><label>Motivo de eliminación<textarea name="reason" required minLength="3" rows="3" maxLength="300" className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-[#E30613]/20" /></label><label>Escribí ELIMINAR para confirmar<input name="confirmation" required autoComplete="off" className={input} /></label>{error && <p className="text-sm font-bold text-red-600">{error}</p>}<button className="min-h-11 rounded-xl bg-[#9E0710] px-4 text-sm font-black text-white"><Trash2 className="mr-2 inline size-4" /> Eliminar definitivamente</button></form></FormDialog>
  </div>;
}
