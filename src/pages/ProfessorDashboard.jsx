import { Activity, CalendarClock, ClipboardList, DoorOpen, Dumbbell, Search, UserCheck, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { statusOf, useGym } from "../context/GymContext";
import { useAuth } from "../context/AuthContext";
import { allowProfessorManualAccess } from "../services/professorAccess";
import { gymDateISO, gymDateISOOrNull } from "../services/gymDate";

const today = () => gymDateISO();
const dateLabel = (value) => value ? new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString("es-AR") : "—";

export default function ProfessorDashboard({ previewProfile = null }) {
  const { data } = useGym();
  const { profile } = useAuth();
  const [query, setQuery] = useState("");
  const [accessBusy, setAccessBusy] = useState(false);
  const [accessMessage, setAccessMessage] = useState("");
  const [accessError, setAccessError] = useState("");
  const shownProfile = previewProfile || profile;
  const branch = data.activeBranch;
  const people = useMemo(() => data.people.filter((person) => person.role === "Cliente" && !person.archivedAt && person.branch === branch), [data.people, branch]);
  const active = people.filter((person) => statusOf(person) !== "Vencida");
  const expiring = people.filter((person) => statusOf(person) === "Por vencer").sort((a, b) => String(a.expiry).localeCompare(String(b.expiry)));
  const accessesToday = data.accesses.filter((item) => item.branch === branch && gymDateISOOrNull(item.date) === today());
  const filtered = people.filter((person) => `${person.name} ${person.dni}`.toLowerCase().includes(query.toLowerCase())).slice(0, 8);
  const canGrantAccess = !previewProfile && Boolean(profile?.can_grant_access);

  const grantAccess = async () => {
    if (!canGrantAccess || accessBusy) return;
    if (!window.confirm("¿Permitir un acceso manual ahora? Se reflejará en todas las segundas pantallas.")) return;
    setAccessBusy(true); setAccessError(""); setAccessMessage("");
    const result = await allowProfessorManualAccess(branch);
    if (result.error) setAccessError(result.error.message || "No se pudo permitir el acceso.");
    else setAccessMessage("Acceso permitido y enviado a la segunda pantalla.");
    setAccessBusy(false);
  };

  return <div className="mx-auto max-w-[1480px] space-y-4 sm:space-y-6">
    <section className="overflow-hidden rounded-[26px] bg-[#050505] p-5 text-white shadow-xl sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#E30613]">Panel profesor</p><h1 className="mt-2 truncate text-2xl font-black sm:text-3xl">Hola, {shownProfile?.display_name || "Profe"}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">Tus alumnos, sus rutinas, progreso y biblioteca de ejercicios en una interfaz preparada para celular.</p></div>
        {canGrantAccess && <button onClick={grantAccess} disabled={accessBusy} className="min-h-14 w-full rounded-2xl bg-[#E30613] px-5 text-base font-black text-white shadow-lg shadow-red-950/20 transition active:scale-[.98] disabled:opacity-60 lg:w-auto"><DoorOpen className="mr-2 inline size-5" /> {accessBusy ? "Permitiendo…" : "Permitir acceso"}</button>}
      </div>
    </section>

    {accessMessage && <p className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{accessMessage}</p>}
    {accessError && <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{accessError}</p>}

    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Stat icon={UsersRound} value={people.length} label="Alumnos" />
      <Stat icon={UserCheck} value={active.length} label="Membresías activas" />
      <Stat icon={Activity} value={accessesToday.filter((item) => item.allowed).length} label="Ingresos hoy" />
      <Stat icon={CalendarClock} value={expiring.length} label="Por vencer" />
    </section>

    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <QuickLink to="/clientes" icon={UsersRound} label="Alumnos" detail="Consultar fichas" />
      <QuickLink to="/progreso" icon={Activity} label="Progreso" detail="Medidas y evolución" />
      <QuickLink to="/ejercicios" icon={Dumbbell} label="Ejercicios" detail="Resolver dudas" />
      <QuickLink to="/rutinas" icon={ClipboardList} label="Rutinas" detail="Crear y enviar" />
    </section>

    <section className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
      <div className="panel p-3.5 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="section-title">Alumnos</h2><p className="mt-1 text-xs text-slate-500">Acceso rápido a estado y vencimiento.</p></div><label className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-3"><Search className="size-4 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Nombre o DNI" /></label></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">{filtered.map((person) => { const status = statusOf(person); return <article key={person.id} className="rounded-2xl border border-black/7 bg-white p-3.5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-black text-slate-900">{person.name}</p><p className="mt-1 text-xs font-bold text-slate-400">DNI {person.dni} · {person.plan}</p></div><span className={`status shrink-0 ${status === "Vigente" ? "status-ok" : status === "Por vencer" ? "status-warn" : "status-bad"}`}>{status}</span></div><p className="mt-3 text-xs font-bold text-slate-500">Vence {dateLabel(person.expiry)}</p></article>; })}{!filtered.length && <p className="py-8 text-center text-sm text-slate-400 sm:col-span-2">No hay alumnos para mostrar.</p>}</div>
      </div>

      <div className="panel p-3.5 sm:p-5"><h2 className="section-title">Próximos vencimientos</h2><div className="mt-4 space-y-2">{expiring.slice(0, 6).map((person) => <div key={person.id} className="flex items-center justify-between gap-3 rounded-xl bg-amber-50 px-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-black text-slate-800">{person.name}</p><p className="text-xs text-slate-500">{person.plan}</p></div><span className="shrink-0 text-xs font-black text-amber-700">{dateLabel(person.expiry)}</span></div>)}{!expiring.length && <p className="py-6 text-center text-sm text-slate-400">Sin vencimientos cercanos.</p>}</div></div>
    </section>
  </div>;
}

function Stat({ icon: Icon, value, label }) {
  return <article className="rounded-[20px] bg-white p-4 shadow-sm"><span className="grid size-9 place-items-center rounded-xl bg-red-50 text-[#E30613]"><Icon className="size-4" /></span><p className="mt-3 text-2xl font-black text-slate-900 sm:text-3xl">{value}</p><p className="mt-1 text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p></article>;
}

function QuickLink({ to, icon: Icon, label, detail }) {
  return <Link to={to} className="min-h-[108px] rounded-[20px] border border-black/7 bg-white p-4 shadow-sm transition active:scale-[.98]"><Icon className="size-5 text-[#E30613]" /><p className="mt-3 text-sm font-black text-slate-900">{label}</p><p className="mt-1 text-[10px] font-bold text-slate-400">{detail}</p></Link>;
}
