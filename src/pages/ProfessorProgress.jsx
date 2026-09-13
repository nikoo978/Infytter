import { Search, UserRound, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import BodyMetricsPanel from "../components/progress/BodyMetricsPanel";
import { useGym } from "../context/GymContext";

export default function ProfessorProgress() {
  const { data } = useGym();
  const [mode, setMode] = useState("alumnos");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");

  const clients = useMemo(() => (data.people || [])
    .filter((person) => person.role === "Cliente" && !person.archivedAt && person.branch === data.activeBranch)
    .filter((person) => `${person.name} ${person.dni}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "es")), [data.people, data.activeBranch, query]);

  const selected = (data.people || []).find((person) => String(person.id) === String(selectedId)) || null;

  return <div className="mx-auto max-w-[1200px] space-y-4 sm:space-y-6">
    <section className="page-head"><div><p className="eyebrow">Seguimiento</p><h1 className="page-title">Progreso</h1><p className="page-subtitle">Medidas propias y seguimiento corporal de alumnos, pensado para usar desde el celular.</p></div></section>

    <div className="grid grid-cols-2 rounded-2xl bg-slate-200/70 p-1">
      <button onClick={() => setMode("alumnos")} className={`min-h-11 rounded-xl px-3 text-xs font-black ${mode === "alumnos" ? "bg-white text-[#050505] shadow-sm" : "text-slate-500"}`}><UsersRound className="mr-1.5 inline size-4" /> Alumnos</button>
      <button onClick={() => setMode("mio")} className={`min-h-11 rounded-xl px-3 text-xs font-black ${mode === "mio" ? "bg-white text-[#050505] shadow-sm" : "text-slate-500"}`}><UserRound className="mr-1.5 inline size-4" /> Mis medidas</button>
    </div>

    {mode === "mio" && <div className="rounded-[24px] bg-[#F5F5F5]"><BodyMetricsPanel self title="Mi progreso" subtitle="Registrá tus propias medidas y seguí tu evolución." /></div>}

    {mode === "alumnos" && <section className="grid gap-5 xl:grid-cols-[360px_1fr]">
      <div className="panel p-3.5 sm:p-5">
        <h2 className="section-title">Elegir alumno</h2>
        <label className="mt-3 flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 focus-within:ring-2 focus-within:ring-[#E30613]/15"><Search className="size-4 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Nombre o DNI" /></label>
        <div className="mt-3 max-h-[55dvh] space-y-2 overflow-y-auto pr-1">{clients.slice(0, 60).map((person) => <button key={person.id} onClick={() => setSelectedId(person.id)} className={`w-full rounded-2xl border p-3 text-left transition active:scale-[.99] ${String(selectedId) === String(person.id) ? "border-[#E30613]/30 bg-red-50" : "border-black/7 bg-white"}`}><p className="truncate text-sm font-black text-slate-900">{person.name}</p><p className="mt-1 text-xs font-bold text-slate-400">DNI {person.dni || "—"} · {person.plan || "Sin plan"}</p></button>)}{!clients.length && <p className="py-8 text-center text-sm text-slate-400">No hay alumnos que coincidan.</p>}{clients.length > 60 && <p className="py-2 text-center text-[11px] font-bold text-slate-400">Refiná la búsqueda para encontrar otros alumnos.</p>}</div>
      </div>

      <div className="min-w-0">{selected ? <BodyMetricsPanel personId={selected.id} title={selected.name} subtitle={`DNI ${selected.dni || "—"} · ${selected.plan || "Sin plan"}`} /> : <div className="grid min-h-64 place-items-center rounded-[24px] border border-dashed border-slate-200 bg-white p-8 text-center"><div><UsersRound className="mx-auto size-9 text-slate-300" /><p className="mt-3 font-black text-slate-500">Seleccioná un alumno</p><p className="mt-1 text-sm text-slate-400">Vas a poder registrar peso, altura, medidas, IMC y grasa estimada.</p></div></div>}</div>
    </section>}
  </div>;
}
