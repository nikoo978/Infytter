import { useCallback, useEffect, useMemo, useState } from "react";
import { FileClock, RefreshCw } from "lucide-react";
import { useGym } from "../context/GymContext";
import { useAuth } from "../context/AuthContext";
import { listAuditEvents } from "../services/audit";

const actionLabels = {
  archive_person: "Cliente archivado",
  restore_person: "Cliente restaurado",
  delete_person: "Persona eliminada",
  upsert_people: "Persona creada",
  patch_people: "Persona actualizada",
  upsert_transactions: "Movimiento creado",
  patch_transactions: "Movimiento actualizado",
  delete_transactions: "Movimiento eliminado",
  upsert_closures: "Cierre de caja",
  patch_closures: "Cierre actualizado",
  clear_accesses: "Historial de accesos limpiado",
  clear_notificationLog: "Historial de notificaciones limpiado",
};

export default function Auditoria() {
  const { data } = useGym();
  const { isCloud } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!isCloud) { setLoading(false); setError("La auditoría está disponible al recuperar la conexión."); return; }
    setLoading(true); setError("");
    const result = await listAuditEvents(300);
    if (result.error) setError(result.error.message || "No se pudo cargar la auditoría.");
    else setEvents(result.events);
    setLoading(false);
  }, [isCloud]);

  useEffect(() => { load(); }, [load]);
  const branchNames = useMemo(() => new Map(data.branches.map((branch) => [branch.id, branch.name])), [data.branches]);

  return <div className="mx-auto max-w-[1200px] space-y-6">
    <section className="page-head"><div><p className="eyebrow">Seguridad operativa</p><h1 className="page-title">Auditoría</h1><p className="page-subtitle">Registro inmutable de cambios sensibles, responsables y motivos.</p></div><button onClick={load} disabled={loading} className="btn-secondary"><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Actualizar</button></section>
    {error && <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
    <section className="panel p-3.5 sm:p-5">
      <div className="space-y-3">{events.map((event) => <article key={event.id} className="rounded-2xl border border-black/7 bg-white p-4"><div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start"><div><p className="font-black text-slate-900">{actionLabels[event.action] || event.action}</p><p className="mt-1 text-xs font-bold text-slate-500">{event.actor_name} · {event.actor_role}{event.branch ? ` · ${branchNames.get(event.branch) || event.branch}` : ""}</p></div><time className="text-xs font-bold text-slate-400">{new Date(event.occurred_at).toLocaleString("es-AR")}</time></div>{event.reason && <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600"><strong>Motivo:</strong> {event.reason}</p>}</article>)}{!loading && !events.length && !error && <div className="py-12 text-center"><FileClock className="mx-auto size-9 text-slate-300" /><p className="mt-3 text-sm font-bold text-slate-400">Todavía no hay eventos auditados.</p></div>}</div>
    </section>
  </div>;
}
