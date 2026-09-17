import { ChevronDown, ChevronUp, Clock3, Dumbbell, RefreshCw, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { getPersonTrainingOverview } from "../../services/routines";

const number = (value, digits = 0) => Number(value || 0).toLocaleString("es-AR", { maximumFractionDigits: digits });
const duration = (seconds) => {
  const minutes = Math.max(0, Math.round(Number(seconds || 0) / 60));
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
};

export default function ProfessorTrainingOverview({ personId }) {
  const [overview, setOverview] = useState({ last30: {}, recent: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [openSession, setOpenSession] = useState("");

  const load = async () => {
    if (!personId) return;
    setLoading(true);
    setError("");
    const result = await getPersonTrainingOverview(personId, 12);
    if (result.error) setError(result.error.message || "No se pudo cargar el historial del cliente.");
    else setOverview(result.overview);
    setLoading(false);
  };

  useEffect(() => { void load(); setOpenSession(""); }, [personId]);

  if (!personId) return null;

  const stats = overview?.last30 || {};
  const recent = overview?.recent || [];

  return <section className="mt-5 rounded-[22px] border border-black/6 bg-white p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#E30613]">Seguimiento</p>
        <h3 className="mt-1 text-lg font-black text-slate-900">Entrenamientos reales</h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">Lo que el cliente registró y guardó en la nube durante sus sesiones.</p>
      </div>
      <button onClick={load} disabled={loading} className="grid size-10 shrink-0 place-items-center rounded-xl border border-black/8 text-slate-500"><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /></button>
    </div>

    {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}

    {!error && <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <div className="rounded-xl bg-slate-50 p-3"><p className="text-lg font-black text-slate-800">{number(stats.workouts)}</p><p className="text-[9px] font-black uppercase text-slate-400">Entrenamientos / 30d</p></div>
      <div className="rounded-xl bg-slate-50 p-3"><p className="text-lg font-black text-slate-800">{number(stats.sets)}</p><p className="text-[9px] font-black uppercase text-slate-400">Series</p></div>
      <div className="rounded-xl bg-slate-50 p-3"><p className="text-lg font-black text-slate-800">{number(stats.volumeKg)}</p><p className="text-[9px] font-black uppercase text-slate-400">Kg movidos</p></div>
      <div className="rounded-xl bg-slate-50 p-3"><p className="text-lg font-black text-slate-800">{number(stats.minutes)}</p><p className="text-[9px] font-black uppercase text-slate-400">Minutos</p></div>
    </div>}

    <div className="mt-4 space-y-2">
      {recent.map((session) => {
        const expanded = openSession === session.id;
        const grouped = new Map();
        (session.sets || []).forEach((set) => {
          if (!grouped.has(set.exerciseName)) grouped.set(set.exerciseName, []);
          grouped.get(set.exerciseName).push(set);
        });
        return <article key={session.id} className="overflow-hidden rounded-2xl border border-black/6">
          <button type="button" onClick={() => setOpenSession(expanded ? "" : session.id)} className="flex w-full items-center gap-3 p-3 text-left">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-red-50 text-[#E30613]"><Dumbbell className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-slate-800">{session.routineTitle || "Entrenamiento"}</p>
              <p className="mt-0.5 text-[11px] font-bold text-slate-400">{new Date(session.completedAt).toLocaleDateString("es-AR")} · {session.completedSets || 0} series · {number(session.totalVolumeKg)} kg</p>
            </div>
            <span className="hidden shrink-0 items-center gap-1 text-[10px] font-black text-slate-400 sm:flex"><Clock3 className="size-3" /> {duration(session.durationSeconds)}</span>
            {expanded ? <ChevronUp className="size-4 text-slate-400" /> : <ChevronDown className="size-4 text-slate-400" />}
          </button>
          {expanded && <div className="border-t border-black/6 bg-slate-50 p-3">
            {[...grouped.entries()].map(([name, sets]) => <div key={name} className="mb-2 rounded-xl bg-white p-3 last:mb-0">
              <p className="text-xs font-black text-slate-800">{name}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">{sets.map((set) => <span key={`${name}-${set.setNumber}`} className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">S{set.setNumber}: {set.reps} × {number(set.weightKg, 1)} kg{set.rir != null ? ` · RIR ${set.rir}` : ""}</span>)}</div>
            </div>)}
          </div>}
        </article>;
      })}
      {!loading && !recent.length && !error && <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center"><TrendingUp className="mx-auto size-6 text-slate-300" /><p className="mt-2 text-sm font-bold text-slate-400">Todavía no hay entrenamientos finalizados para este cliente.</p></div>}
    </div>
  </section>;
}
