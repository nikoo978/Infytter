import { Activity, CalendarDays, Clock3, Dumbbell, RefreshCw, TrendingUp, Weight } from "lucide-react";
import { useEffect, useState } from "react";
import { getMyTrainingOverview } from "../../services/routines";

const number = (value, digits = 0) => Number(value || 0).toLocaleString("es-AR", { maximumFractionDigits: digits });
const duration = (seconds) => {
  const value = Math.max(0, Number(seconds || 0));
  const minutes = Math.round(value / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours} h${rest ? ` ${rest} min` : ""}`;
};

function Stat({ icon: Icon, label, value }) {
  return <article className="rounded-2xl bg-white p-4 shadow-sm">
    <span className="grid size-9 place-items-center rounded-xl bg-red-50 text-[#E30613]"><Icon className="size-4" /></span>
    <p className="mt-3 text-xl font-black text-[#050505]">{value}</p>
    <p className="mt-1 text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p>
  </article>;
}

export default function TrainingProgressPanel({ preview = false }) {
  const [overview, setOverview] = useState(preview ? { last30: {}, recent: [] } : null);
  const [loading, setLoading] = useState(!preview);
  const [error, setError] = useState("");

  const load = async () => {
    if (preview) return;
    setLoading(true);
    setError("");
    const result = await getMyTrainingOverview(12);
    if (result.error) setError(result.error.message || "No se pudo cargar tu progreso de entrenamiento.");
    else setOverview(result.overview);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const stats = overview?.last30 || {};
  const recent = overview?.recent || [];

  return <section className="space-y-3">
    <div className="flex items-end justify-between gap-3">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#E30613]">Entrenamiento</p>
        <h2 className="mt-1 text-xl font-black text-[#050505]">Últimos 30 días</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">Sólo se cuentan entrenamientos finalizados y guardados en la nube.</p>
      </div>
      {!preview && <button onClick={load} disabled={loading} className="grid size-10 shrink-0 place-items-center rounded-xl border border-black/8 bg-white text-slate-500 shadow-sm"><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /></button>}
    </div>

    {error && <p className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</p>}
    {loading && <p className="rounded-2xl bg-white p-4 text-sm font-bold text-slate-500 shadow-sm">Cargando entrenamientos…</p>}

    {!loading && !error && <div className="grid grid-cols-2 gap-3">
      <Stat icon={CalendarDays} label="Entrenamientos" value={number(stats.workouts)} />
      <Stat icon={Activity} label="Días entrenados" value={number(stats.trainingDays)} />
      <Stat icon={Dumbbell} label="Series hechas" value={number(stats.sets)} />
      <Stat icon={Clock3} label="Tiempo total" value={`${number(stats.minutes)} min`} />
      <div className="col-span-2"><Stat icon={Weight} label="Volumen acumulado" value={`${number(stats.volumeKg)} kg`} /></div>
    </div>}

    {!loading && <div className="rounded-[22px] bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2"><TrendingUp className="size-5 text-[#E30613]" /><div><p className="text-sm font-black text-slate-900">Entrenamientos recientes</p><p className="text-[11px] text-slate-400">Duración, series y volumen real registrado.</p></div></div>
      <div className="mt-3 divide-y divide-slate-100">
        {recent.map((session) => <article key={session.id} className="py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-slate-800">{session.routineTitle || "Entrenamiento"}</p>
              <p className="mt-1 text-[11px] font-bold text-slate-400">{new Date(session.completedAt).toLocaleDateString("es-AR")} · {session.exercises || 0} ejercicios</p>
            </div>
            <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500">{duration(session.durationSeconds)}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-black text-slate-500">
            <span className="rounded-lg bg-slate-50 px-2 py-1">{session.completedSets || 0} series</span>
            <span className="rounded-lg bg-slate-50 px-2 py-1">{number(session.totalVolumeKg)} kg movidos</span>
          </div>
        </article>)}
        {!recent.length && <p className="py-7 text-center text-sm text-slate-400">Todavía no finalizaste entrenamientos desde Infytter.</p>}
      </div>
    </div>}
  </section>;
}
