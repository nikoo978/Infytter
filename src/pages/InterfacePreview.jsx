import { ChevronRight, Eye, Smartphone, UserCog, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useGym } from "../context/GymContext";
import ClientHomeV106 from "./ClientHomeV106";

function PreviewClose({ onClose }) {
  return <button type="button" onClick={onClose} aria-label="Cerrar vista previa" title="Cerrar vista previa" className="fixed z-[130] grid size-12 place-items-center rounded-full border border-black/10 bg-white text-[#050505] shadow-2xl transition active:scale-95" style={{ top: "max(12px, env(safe-area-inset-top))", right: "max(12px, env(safe-area-inset-right))" }}><X className="size-6" /></button>;
}

export default function InterfacePreview() {
  const { data } = useGym();
  const [previewRole, setPreviewRole] = useState("");
  const clients = useMemo(() => data.people.filter((person) => person.role === "Cliente" && !person.archivedAt), [data.people]);
  const client = clients[0] || null;

  const portal = client ? {
    linked: true,
    member: client,
    branchName: data.branches.find((branch) => branch.id === client.branch)?.name || "—",
    accesses: data.accesses.filter((item) => item.personId === client.id).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10),
  } : { linked: false, member: null, branchName: "—", accesses: [] };

  const closePreview = () => setPreviewRole("");

  if (previewRole === "cliente") return <div className="fixed inset-0 z-[100] overflow-y-auto bg-[#F5F5F5]"><PreviewClose onClose={closePreview} /><ClientHomeV106 preview previewPortal={portal} previewIdentity={{ name: client?.name || "Cliente", email: "cliente@preview.local" }} /></div>;

  if (previewRole === "profe") return <div className="fixed inset-0 z-[100] overflow-hidden bg-[#E9EAEC]"><PreviewClose onClose={closePreview} /><div className="mx-auto h-dvh w-full max-w-md overflow-hidden bg-[#F5F5F5] shadow-2xl"><iframe src="/preview-profesor-mobile" title="Vista previa móvil de Profesor" className="h-full w-full border-0 bg-[#F5F5F5]" /></div></div>;

  return <div className="mx-auto max-w-[1100px] space-y-6">
    <section className="page-head"><div><p className="eyebrow">Control de interfaces</p><h1 className="page-title">Vista previa</h1><p className="page-subtitle">Elegí un rol. La administración desaparece temporalmente y vas a ver el interfaz tal como lo ve ese usuario. La X superior devuelve al panel Admin.</p></div><span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-600"><Eye className="size-4" /> Solo lectura</span></section>

    <section className="grid gap-4 md:grid-cols-2">
      <button type="button" onClick={() => setPreviewRole("profe")} className="group rounded-[28px] border border-black/8 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg active:scale-[.99] sm:p-8"><div className="flex items-start justify-between gap-5"><span className="grid size-14 place-items-center rounded-2xl bg-red-50 text-[#E30613]"><UserCog className="size-7" /></span><ChevronRight className="size-6 text-slate-300 transition group-hover:translate-x-1 group-hover:text-[#E30613]" /></div><p className="mt-6 text-xs font-black uppercase tracking-[.18em] text-[#E30613]">Vista móvil</p><h2 className="mt-2 text-2xl font-black text-[#050505]">Profesor</h2><p className="mt-2 text-sm leading-6 text-slate-500">Inicio, alumnos, progreso, ejercicios y rutinas dentro del mismo formato móvil que utiliza el profesor.</p></button>
      <button type="button" onClick={() => setPreviewRole("cliente")} className="group rounded-[28px] border border-black/8 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg active:scale-[.99] sm:p-8"><div className="flex items-start justify-between gap-5"><span className="grid size-14 place-items-center rounded-2xl bg-slate-950 text-white"><Smartphone className="size-7" /></span><ChevronRight className="size-6 text-slate-300 transition group-hover:translate-x-1 group-hover:text-[#E30613]" /></div><p className="mt-6 text-xs font-black uppercase tracking-[.18em] text-[#E30613]">Vista móvil</p><h2 className="mt-2 text-2xl font-black text-[#050505]">Cliente</h2><p className="mt-2 text-sm leading-6 text-slate-500">Inicio, progreso, ejercicios y rutinas dentro del mismo formato móvil que utiliza el cliente.</p></button>
    </section>
  </div>;
}
