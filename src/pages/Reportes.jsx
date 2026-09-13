import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, CalendarDays, PackageOpen, ReceiptText, RotateCcw, UserPlus, WalletCards } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import MetricCard from "../components/ui/MetricCard";
import { useGym } from "../context/GymContext";
import { addCalendarDays, addCalendarMonths, gymDateISO } from "../services/gymDate";

const money = (value) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
const iso = (date) => gymDateISO(date);
const calendarDate = (value) => new Date(`${value}T12:00:00Z`);
const dateFormat = (date, options) => date.toLocaleDateString("es-AR", { ...options, timeZone: "UTC" });
const periods = [{ id: "day", label: "Día" }, { id: "week", label: "Semana" }, { id: "month", label: "Mes" }, { id: "year", label: "Año" }];

function rangeFor(period, anchor, offset = 0) {
  const base = calendarDate(anchor); let start; let end;
  if (period === "day") { start = new Date(base); start.setUTCDate(start.getUTCDate() + offset); end = new Date(start); end.setUTCDate(end.getUTCDate() + 1); }
  if (period === "week") { start = new Date(base); start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7) + offset * 7); end = new Date(start); end.setUTCDate(end.getUTCDate() + 7); }
  if (period === "month") { start = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + offset, 1)); end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)); }
  if (period === "year") { start = new Date(Date.UTC(base.getUTCFullYear() + offset, 0, 1)); end = new Date(Date.UTC(start.getUTCFullYear() + 1, 0, 1)); }
  return { start, end };
}

const inRange = (date, range) => { const value = calendarDate(date); return value >= range.start && value < range.end; };
const percent = (current, previous) => previous ? Math.round(((current - previous) / previous) * 100) : current ? 100 : 0;
const groupTotals = (items) => Object.entries(items.reduce((acc, item) => { acc[item.category || "Sin categoría"] = (acc[item.category || "Sin categoría"] || 0) + item.amount; return acc; }, {})).sort((a, b) => b[1] - a[1]);

function rangeLabel(period, range) {
  if (period === "day") return dateFormat(range.start, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  if (period === "week") { const last = new Date(range.end); last.setUTCDate(last.getUTCDate() - 1); return `${dateFormat(range.start, { day: "numeric", month: "short" })} — ${dateFormat(last, { day: "numeric", month: "short", year: "numeric" })}`; }
  if (period === "month") return dateFormat(range.start, { month: "long", year: "numeric" });
  return dateFormat(range.start, { year: "numeric" });
}

function shiftDate(anchor, period, direction) {
  if (period === "day") return addCalendarDays(anchor, direction);
  if (period === "week") return addCalendarDays(anchor, direction * 7);
  if (period === "month") return addCalendarMonths(anchor, direction);
  return addCalendarMonths(anchor, direction * 12);
}

function pointFor(label, range, transactions, clients) {
  const rows = transactions.filter((item) => inRange(item.date, range));
  return {
    label,
    Membresías: rows.filter((item) => item.type === "income" && item.category === "Membresía").reduce((sum, item) => sum + item.amount, 0),
    Ventas: rows.filter((item) => item.type === "income" && item.category !== "Membresía").reduce((sum, item) => sum + item.amount, 0),
    Gastos: rows.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0),
    Clientes: clients.filter((person) => inRange(person.start, range)).length,
  };
}

function trendData(period, range, transactions, clients) {
  const points = [];
  if (period === "year") {
    for (let month = 0; month < 12; month += 1) {
      const start = new Date(Date.UTC(range.start.getUTCFullYear(), month, 1)); const end = new Date(Date.UTC(range.start.getUTCFullYear(), month + 1, 1));
      points.push(pointFor(dateFormat(start, { month: "short" }).replace(".", ""), { start, end }, transactions, clients));
    }
    return points;
  }
  const days = period === "day" ? 1 : Math.round((range.end - range.start) / 86400000);
  for (let index = 0; index < days; index += 1) {
    const start = new Date(range.start); start.setUTCDate(start.getUTCDate() + index); const end = new Date(start); end.setUTCDate(end.getUTCDate() + 1);
    const label = period === "week" ? dateFormat(start, { weekday: "short" }).replace(".", "") : start.getUTCDate().toString();
    points.push(pointFor(label, { start, end }, transactions, clients));
  }
  return points;
}

export default function Reportes() {
  const { data } = useGym();
  const [period, setPeriod] = useState("month");
  const [anchor, setAnchor] = useState(() => gymDateISO());
  const branchName = data.branches.find((branch) => branch.id === data.activeBranch)?.name;
  const report = useMemo(() => {
    const current = rangeFor(period, anchor); const previous = rangeFor(period, anchor, -1);
    const allTransactions = data.transactions.filter((item) => item.branch === data.activeBranch);
    const allClients = data.people.filter((person) => person.branch === data.activeBranch && person.role === "Cliente");
    const tx = allTransactions.filter((item) => inRange(item.date, current));
    const oldTx = allTransactions.filter((item) => inRange(item.date, previous));
    const clients = allClients.filter((person) => inRange(person.start, current));
    const oldClients = allClients.filter((person) => inRange(person.start, previous));
    const membership = tx.filter((item) => item.type === "income" && item.category === "Membresía");
    const sales = tx.filter((item) => item.type === "income" && item.category !== "Membresía");
    const expenses = tx.filter((item) => item.type === "expense");
    const oldIncome = oldTx.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
    const income = membership.reduce((sum, item) => sum + item.amount, 0) + sales.reduce((sum, item) => sum + item.amount, 0);
    const expense = expenses.reduce((sum, item) => sum + item.amount, 0);
    return { current, tx, clients, oldClients, membership, sales, expenses, income, expense, oldIncome, chart: trendData(period, current, allTransactions, allClients) };
  }, [anchor, data, period]);
  const saleGroups = groupTotals(report.sales); const expenseGroups = groupTotals(report.expenses);
  const maxBreakdown = Math.max(1, ...saleGroups.map(([, value]) => value), ...expenseGroups.map(([, value]) => value));

  return <div className="mx-auto max-w-[1480px] space-y-6">
    <section className="page-head"><div><p className="eyebrow">Análisis financiero</p><h1 className="page-title">Reportes y rendimiento</h1><p className="page-subtitle">{branchName} · elegí cualquier fecha para analizarla.</p></div></section>
    <section className="panel space-y-4"><div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"><div className="flex flex-wrap items-center gap-2"><button onClick={() => setAnchor(shiftDate(anchor, period, -1))} className="btn-secondary size-11 px-0" aria-label="Período anterior"><ArrowLeft className="size-4" /></button><div className="min-w-[230px] text-center"><p className="text-xs font-black uppercase tracking-[.16em] text-[#E30613]">Período seleccionado</p><p className="mt-1 text-lg font-black capitalize text-[#050505]">{rangeLabel(period, report.current)}</p></div><button onClick={() => setAnchor(shiftDate(anchor, period, 1))} className="btn-secondary size-11 px-0" aria-label="Período siguiente"><ArrowRight className="size-4" /></button></div><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><label className="flex items-center gap-2 rounded-xl border border-black/10 bg-[#F5F5F5] px-3 py-2"><CalendarDays className="size-4 text-[#E30613]" /><span className="sr-only">Elegir fecha</span><input type="date" value={anchor} onChange={(event) => setAnchor(event.target.value)} className="bg-transparent text-sm font-black text-[#050505] outline-none" /></label><button onClick={() => setAnchor(iso(new Date()))} className="btn-secondary"><RotateCcw className="size-4" /> Hoy</button></div></div><div className="grid grid-cols-4 rounded-xl border border-black/10 bg-[#F5F5F5] p-1" role="group" aria-label="Período del reporte">{periods.map((item) => <button key={item.id} onClick={() => setPeriod(item.id)} className={`rounded-lg px-2 py-2.5 text-xs font-black transition sm:px-4 ${period === item.id ? "bg-[#E30613] text-white shadow-sm" : "text-slate-500 hover:bg-white"}`}>{item.label}</button>)}</div></section>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><MetricCard label="Nuevos clientes" value={report.clients.length} detail={`${percent(report.clients.length, report.oldClients.length)}% vs. período anterior`} icon={UserPlus} /><MetricCard label="Membresías" value={money(report.membership.reduce((sum, item) => sum + item.amount, 0))} detail={`${report.membership.length} cobros`} icon={WalletCards} tone="red" /><MetricCard label="Ventas de productos" value={money(report.sales.reduce((sum, item) => sum + item.amount, 0))} detail={`${report.sales.length} ventas`} icon={PackageOpen} tone="blue" /><MetricCard label="Gastos" value={money(report.expense)} detail={`${report.expenses.length} movimientos`} icon={ReceiptText} tone="orange" /><MetricCard label="Resultado neto" value={money(report.income - report.expense)} detail={`${percent(report.income, report.oldIncome)}% ingresos`} icon={report.income >= report.expense ? ArrowUpRight : ArrowDownRight} tone={report.income >= report.expense ? "red" : "orange"} /></section>
    <section className="panel"><div className="mb-6"><h2 className="section-title">Evolución del período</h2><p className="mt-1 text-xs text-slate-500">Comparación visual entre membresías, ventas y gastos</p></div><div className="h-[320px] w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={report.chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#DADADA" /><XAxis dataKey="label" tick={{ fontSize: 11, fill: "#737373" }} interval={period === "month" ? 2 : 0} axisLine={false} tickLine={false} /><YAxis tickFormatter={(value) => `$${Math.round(value / 1000)}k`} tick={{ fontSize: 11, fill: "#737373" }} axisLine={false} tickLine={false} width={48} /><Tooltip content={<ChartTooltip />} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 14 }} /><Bar dataKey="Membresías" stackId="income" fill="#E30613" radius={[4, 4, 0, 0]} /><Bar dataKey="Ventas" stackId="income" fill="#9E0710" radius={[4, 4, 0, 0]} /><Bar dataKey="Gastos" fill="#282828" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></section>
    <section className="grid gap-5 lg:grid-cols-2"><Breakdown title="Ventas por producto" empty="No se registraron ventas de productos." rows={saleGroups} max={maxBreakdown} color="bg-[#E30613]" /><Breakdown title="Gastos por categoría" empty="No se registraron gastos." rows={expenseGroups} max={maxBreakdown} color="bg-[#282828]" /></section>
    <section className="panel"><div className="flex items-center justify-between gap-3"><div><h2 className="section-title">Movimientos del período</h2><p className="mt-1 text-xs text-slate-500">Ingresos, ventas y egresos registrados</p></div><span className="status status-ok"><CalendarDays className="mr-1 size-3" /> {report.tx.length} operaciones</span></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead><tr className="table-head"><th>Fecha</th><th>Concepto</th><th>Categoría</th><th>Medio</th><th className="text-right">Importe</th></tr></thead><tbody className="divide-y divide-slate-100">{report.tx.map((item) => <tr key={item.id}><td className="py-4 text-sm text-slate-500">{new Date(`${item.date}T12:00:00`).toLocaleDateString("es-AR")}</td><td className="font-bold text-slate-800">{item.detail}</td><td><span className="status status-ok">{item.category}</span></td><td className="text-sm text-slate-500">{item.method}</td><td className={`text-right font-black ${item.type === "income" ? "text-[#E30613]" : "text-[#282828]"}`}>{item.type === "income" ? "+" : "−"} {money(item.amount)}</td></tr>)}</tbody></table>{!report.tx.length && <p className="py-12 text-center text-sm text-slate-400">No hay movimientos en este período.</p>}</div></section>
  </div>;
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return <div className="rounded-xl border border-black/10 bg-white p-3 shadow-xl"><p className="mb-2 text-xs font-black uppercase text-slate-500">{label}</p>{payload.map((item) => <p key={item.dataKey} className="text-sm font-bold" style={{ color: item.color }}>{item.dataKey}: {money(item.value)}</p>)}</div>;
}

function Breakdown({ title, empty, rows, max, color }) {
  return <article className="panel"><h2 className="section-title">{title}</h2><div className="mt-6 space-y-5">{rows.map(([label, value]) => <div key={label}><div className="mb-2 flex items-center justify-between gap-3 text-sm"><span className="font-bold text-slate-700">{label}</span><strong>{money(value)}</strong></div><div className="h-2 overflow-hidden rounded-full bg-[#DADADA]"><div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(5, value / max * 100)}%` }} /></div></div>)}{!rows.length && <p className="py-8 text-center text-sm text-slate-400">{empty}</p>}</div></article>;
}
