import { useMemo, useState } from "react";
import ExerciseCatalog from "../components/exercises/ExerciseCatalog";
import ProfessorLayout from "../components/layout/ProfessorLayout";
import { statusOf, useGym } from "../context/GymContext";
import ProfessorDashboard from "./ProfessorDashboard";
import ProfessorProgress from "./ProfessorProgress";
import Routines from "./Routines";

const professorPaths = new Set(["/", "/clientes", "/progreso", "/ejercicios", "/rutinas"]);

function ProfessorClientsPreview() {
  const { data } = useGym();
  const [query, setQuery] = useState("");
  const clients = useMemo(() => (data.people || [])
    .filter((person) => person.role === "Cliente" && !person.archivedAt && person.branch === data.activeBranch)
    .filter((person) => `${person.name} ${person.dni}`.toLowerCase().includes(query.trim().toLowerCase())), [data.people, data.activeBranch, query]);

  return <div className="mx-auto max-w-[1480px] space-y-4 sm:space-y-6">
    <section className="page-head"><div><p className="eyebrow">Personas</p><h1 className="page-title">Alumnos</h1><p className="page-subtitle">Alumnos, planes y vencimientos de la sucursal activa.</p></div></section>
    <section className="panel p-3.5 sm:p-5">
      <label className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 focus-within:ring-2 focus-within:ring-[#E30613]/15"><input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 w-full bg-transparent text-sm outline-none" placeholder="Buscar por nombre o DNI" /></label>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{clients.map((person) => { const status = statusOf(person); return <article key={person.id} className="rounded-2xl border border-black/7 bg-white p-3.5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-words font-black text-slate-800">{person.name}</p><p className="mt-1 text-xs font-bold text-slate-400">DNI {person.dni || "—"} · {person.plan || "Sin plan"}</p></div><span className={`status shrink-0 ${status === "Vigente" ? "status-ok" : status === "Por vencer" ? "status-warn" : "status-bad"}`}>{status}</span></div><div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-xl bg-slate-50 p-2.5"><p className="text-[10px] font-black uppercase text-slate-400">Vencimiento</p><p className="mt-1 text-xs font-black text-slate-700">{person.expiry ? new Date(`${person.expiry}T12:00:00`).toLocaleDateString("es-AR") : "—"}</p></div><div className="rounded-xl bg-slate-50 p-2.5"><p className="text-[10px] font-black uppercase text-slate-400">Biometría</p><p className="mt-1 break-words text-xs font-black text-slate-700">{person.biometricMethod || "Sin registrar"}</p></div></div><p className="mt-3 text-[10px] font-black uppercase tracking-wider text-slate-400">Solo lectura</p></article>; })}{!clients.length && <p className="py-10 text-center text-sm text-slate-400 md:col-span-2 xl:col-span-3">No hay alumnos para mostrar.</p>}</div>
    </section>
  </div>;
}

export default function ProfessorMobilePreview() {
  const { data } = useGym();
  const [professorPath, setProfessorPath] = useState("/");
  const professors = useMemo(() => data.people.filter((person) => person.role === "Profesor"), [data.people]);
  const professor = professors[0] || null;

  const navigateProfessor = (path) => { if (professorPaths.has(path)) setProfessorPath(path); };

  const professorContent = (() => {
    if (professorPath === "/clientes") return <ProfessorClientsPreview />;
    if (professorPath === "/progreso") return <div className="pointer-events-none select-none"><ProfessorProgress /></div>;
    if (professorPath === "/ejercicios") return <ExerciseCatalog preview />;
    if (professorPath === "/rutinas") return <div className="pointer-events-none select-none"><Routines /></div>;
    return <div onClickCapture={(event) => { const link = event.target.closest?.("a[href]"); if (!link) return; event.preventDefault(); navigateProfessor(link.getAttribute("href")); }}><ProfessorDashboard previewProfile={{ display_name: professor?.name || "Profesor" }} /></div>;
  })();

  return <ProfessorLayout preview previewProfile={{ display_name: professor?.name || "Profesor" }} currentPath={professorPath} onPreviewNavigate={navigateProfessor}>{professorContent}</ProfessorLayout>;
}
