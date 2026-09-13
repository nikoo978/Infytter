import { ArrowUpRight, CalendarCheck2, CircleDollarSign, Clock3, UserCheck, UsersRound, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import MetricCard from "../components/ui/MetricCard";
import { statusOf, useGym } from "../context/GymContext";
import { useAuth } from "../context/AuthContext";
import { gymDateISO, gymDateISOOrNull } from "../services/gymDate";
import { daysUntilExpiry } from "../services/accessPolicy";

const money = (value) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
const today = () => gymDateISO();
const dateLabel = (value) => value ? new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString("es-AR") : "—";

function DetailModal({ type, onClose, people, tx, accesses, expiring, data }) {
  if (!type) return null;
  const titles = {
    people: "Personas activas y registradas",
    income: "Ingresos del día",
    accesses: "Accesos de hoy",
    expiring: "Cuotas por vencer",
  };

  const personName = (id) => data.people.find((person) => person.id === id)?.name || "No identificado";
  const activePeople = people.filter((person) => statusOf(person) !== "Vencida");
  const incomeRows = tx.filter((item) => item.type === "income");
  const allowed = accesses.filter((item) => item.allowed);
  const rejected = accesses.filter((item) => !item.allowed);

  return <div className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onMouseDown={onClose}>
    <section className="w-full max-w-3xl overflow-hidden rounded-[26px] bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
      <header className="flex items-start justify-between gap-4 border-b border-black/7 px-5 py-4 sm:px-6"><div><p className="eyebrow">Detalle</p><h2 className="text-xl font-black text-[#050505]">{titles[type]}</h2></div><button onClick={onClose} className="grid size-9 place-items-center rounded-xl border border-black/8 hover:bg-slate-50"><X className="size-4" /></button></header>
      <div className="max-h-[70vh] overflow-y-auto p-5 sm:p-6">
        {type === "people" && <div className="space-y-6">
          <div><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-black text-[#050505]">Activas</h3><span className="status status-ok">{activePeople.length}</span></div><div className="grid gap-2 sm:grid-cols-2">{activePeople.map((person) => <div key={person.id} className="rounded-xl border border-black/7 bg-slate-50 p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-black text-slate-800">{person.name}</p><p className="mt-1 text-xs text-slate-500">DNI {person.dni} · {person.plan}</p></div><span className={`status ${statusOf(person) === "Por vencer" ? "status-warn" : "status-ok"}`}>{statusOf(person)}</span></div></div>)}{!activePeople.length && <p className="text-sm text-slate-400">No hay personas activas.</p>}</div></div>
          <div><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-black text-[#050505]">Todas las registradas</h3><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">{people.length}</span></div><div className="divide-y divide-slate-100 rounded-xl border border-black/7">{people.map((person) => <div key={person.id} className="flex items-center justify-between gap-3 p-3"><div><p className="text-sm font-bold text-slate-800">{person.name}</p><p className="text-xs text-slate-400">DNI {person.dni}</p></div><span className={`status ${statusOf(person) === "Vigente" ? "status-ok" : statusOf(person) === "Por vencer" ? "status-warn" : "status-bad"}`}>{statusOf(person)}</span></div>)}{!people.length && <p className="p-5 text-center text-sm text-slate-400">No hay personas registradas.</p>}</div></div>
        </div>}

        {type === "income" && <div className="space-y-2">{incomeRows.map((item) => <div key={item.id} className="flex flex-col justify-between gap-2 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 sm:flex-row sm:items-center"><div><p className="text-sm font-black text-slate-800">{item.detail}</p><p className="mt-1 text-xs text-slate-500">{item.category} · {item.method || "Sin medio"}{item.personId ? ` · ${personName(item.personId)}` : ""}</p></div><strong className="text-base text-[#050505]">{money(item.amount)}</strong></div>)}{!incomeRows.length && <p className="py-10 text-center text-sm text-slate-400">No hay ingresos registrados hoy.</p>}</div>}

        {type === "accesses" && <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-emerald-50 p-4"><p className="text-xs font-black uppercase text-emerald-700">Autorizados</p><p className="mt-1 text-3xl font-black">{allowed.length}</p></div><div className="rounded-2xl bg-red-50 p-4"><p className="text-xs font-black uppercase text-red-700">Rechazados</p><p className="mt-1 text-3xl font-black">{rejected.length}</p></div></div><div className="divide-y divide-slate-100 rounded-xl border border-black/7">{accesses.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 p-3"><div><p className="text-sm font-bold text-slate-800">{item.manual ? "Acceso manual" : personName(item.personId)}</p><p className="text-xs text-slate-400">{new Date(item.date).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</p></div><span className={`status ${item.allowed ? "status-ok" : "status-bad"}`}>{item.allowed ? "Autorizado" : "Rechazado"}</span></div>)}{!accesses.length && <p className="p-5 text-center text-sm text-slate-400">No hubo accesos hoy.</p>}</div></div>}

        {type === "expiring" && <div className="space-y-2">{expiring.map((person) => { const days = Math.max(0, daysUntilExpiry(person.expiry) || 0); return <div key={person.id} className="flex items-center justify-between gap-3 rounded-xl border border-amber-100 bg-amber-50/60 p-3"><div><p className="text-sm font-black text-slate-800">{person.name}</p><p className="mt-1 text-xs text-slate-500">Vence {dateLabel(person.expiry)} · DNI {person.dni}</p></div><span className="status status-warn">{days === 0 ? "Hoy" : `${days} día${days === 1 ? "" : "s"}`}</span></div>; })}{!expiring.length && <p className="py-10 text-center text-sm text-slate-400">No hay cuotas por vencer en los próximos 7 días.</p>}</div>}
      </div>
    </section>
  </div>;
}

export default function Dashboard() {
  const { data } = useGym();
  const { permissions } = useAuth();
  const [detail, setDetail] = useState(null);
  const people = data.people.filter((p) => p.branch === data.activeBranch && !p.archivedAt);
  const tx = data.transactions.filter((t) => t.branch === data.activeBranch && t.date === today());
  const accesses = data.accesses.filter((a) => a.branch === data.activeBranch && gymDateISOOrNull(a.date) === today());
  const revenue = tx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expiringPeople = useMemo(() => people.filter((p) => statusOf(p) === "Por vencer").sort((a, b) => String(a.expiry).localeCompare(String(b.expiry))), [people]);
  const branchName = data.branches.find((b) => b.id === data.activeBranch)?.name;

  return <div className="mx-auto max-w-[1480px] space-y-6">
    <section className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="eyebrow">Resumen de hoy</p><h1 className="page-title">Operación en tiempo real</h1><p className="page-subtitle">Todo bajo control en {branchName}.</p></div>{permissions?.canViewFinance && <Link to="/caja" className="btn-primary self-start sm:self-auto">Abrir caja <ArrowUpRight className="size-4" /></Link>}</section>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Personas activas" value={people.filter((p) => statusOf(p) !== "Vencida").length} detail={`${people.length} registradas`} icon={UsersRound} onIconClick={() => setDetail("people")} />
      {permissions?.canViewFinance && <MetricCard label="Ingresos del día" value={money(revenue)} detail={`${tx.filter((t) => t.type === "income").length} pagos`} icon={CircleDollarSign} tone="red" onIconClick={() => setDetail("income")} />}
      <MetricCard label="Accesos hoy" value={accesses.filter((a) => a.allowed).length} detail={`${accesses.filter((a) => !a.allowed).length} rechazados`} icon={UserCheck} tone="blue" onIconClick={() => setDetail("accesses")} />
      <MetricCard label="Cuotas por vencer" value={expiringPeople.length} detail="Próximos 7 días" icon={CalendarCheck2} tone="orange" onIconClick={() => setDetail("expiring")} />
    </section>
    <section className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
      <article className="panel"><div className="flex items-center justify-between"><div><h2 className="section-title">Estado de membresías</h2><p className="text-xs text-slate-500">Distribución actual de la sede</p></div><span className="status status-ok">En vivo</span></div><div className="mt-8 grid gap-5 sm:grid-cols-3">{["Vigente", "Por vencer", "Vencida"].map((s) => { const count = people.filter((p) => statusOf(p) === s).length; return <div key={s} className="rounded-2xl bg-slate-50 p-5"><p className="text-sm font-bold text-slate-500">{s}</p><p className="mt-2 text-4xl font-black text-[#050505]">{count}</p><div className="mt-4 h-2 rounded-full bg-white"><div className={`h-full rounded-full ${s === "Vigente" ? "bg-[#282828]" : s === "Por vencer" ? "bg-[#9E0710]" : "bg-red-500"}`} style={{ width: `${people.length ? Math.max(8, count / people.length * 100) : 0}%` }} /></div></div>; })}</div></article>
      <article className="rounded-[24px] bg-[#050505] p-6 text-white"><Clock3 className="size-7 text-[#E30613]" /><p className="mt-8 text-xs font-bold uppercase tracking-[.16em] text-[#AFAFAF]">Último acceso</p>{accesses[0] ? <><p className="mt-2 text-2xl font-black">{data.people.find((p) => p.id === accesses[0].personId)?.name || "No identificado"}</p><p className="mt-2 text-sm text-[#AFAFAF]">{new Date(accesses[0].date).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })} · {accesses[0].allowed ? "Autorizado" : "Rechazado"}</p></> : <p className="mt-2 text-lg font-bold">Sin ingresos hoy</p>}<Link to="/accesos" className="mt-8 inline-flex text-sm font-black text-[#E30613]">Abrir control de acceso →</Link></article>
    </section>
    <DetailModal type={detail} onClose={() => setDetail(null)} people={people} tx={tx} accesses={accesses} expiring={expiringPeople} data={data} />
  </div>;
}
