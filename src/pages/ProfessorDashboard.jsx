import useRecipeVisibility from "../hooks/useRecipeVisibility";
import { Activity, ArrowUpRight, CalendarClock, ChefHat, ClipboardList, DoorOpen, Dumbbell, UserCheck, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { statusOf, useGym } from "../context/GymContext";
import { useAuth } from "../context/AuthContext";
import { allowProfessorManualAccess } from "../services/professorAccess";
import { permissionsForRole } from "../services/roles";
import { gymDateISO, gymDateISOOrNull } from "../services/gymDate";

const today = () => gymDateISO();

export default function ProfessorDashboard({ previewProfile = null }) {
  const recipesEnabled = useRecipeVisibility(!!previewProfile);
  const { data, sync, syncPendingNow } = useGym();
  const { profile, permissions } = useAuth();
  const [accessBusy, setAccessBusy] = useState(false);
  const [accessMessage, setAccessMessage] = useState("");
  const [accessError, setAccessError] = useState("");
  const shownProfile = previewProfile || profile;
  const branch = data.activeBranch;
  const people = useMemo(() => data.people.filter((person) => person.role === "Cliente" && !person.archivedAt && person.branch === branch), [data.people, branch]);
  const active = people.filter((person) => statusOf(person) !== "Vencida");
  const expiring = people.filter((person) => statusOf(person) === "Por vencer").sort((a, b) => String(a.expiry).localeCompare(String(b.expiry)));
  const accessesToday = data.accesses.filter((item) => item.branch === branch && gymDateISOOrNull(item.date) === today());
  const allowed = previewProfile ? permissionsForRole("profe", previewProfile) : permissions;
  const canViewStudents = allowed.canViewStudents;
  const canGrantAccess = !previewProfile && permissions.canGrantManualAccess;

  const grantAccess = async () => {
    if (!canGrantAccess || accessBusy) return;
    if (!window.confirm("¿Permitir un acceso manual ahora? Se reflejará en todas las segundas pantallas.")) return;
    setAccessBusy(true); setAccessError(""); setAccessMessage("");
    const result = await allowProfessorManualAccess(branch);
    if (result.error) setAccessError(result.error.message || "No se pudo permitir el acceso.");
    else setAccessMessage("Acceso permitido y enviado a la segunda pantalla.");
    setAccessBusy(false);
  };

  return <div className="mx-auto max-w-[1480px] flex flex-col gap-4 sm:gap-6">
    <section className="overflow-hidden rounded-[26px] bg-[#050505] p-5 text-white shadow-xl sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#ff7a82]">Panel profesor</p><h1 className="mt-2 truncate text-2xl font-black sm:text-3xl">Hola, {shownProfile?.display_name || "Profe"}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">Organizá tus rutinas y consultá los ejercicios para preparar tus entrenamientos.</p></div>
        {canGrantAccess && <button onClick={grantAccess} disabled={accessBusy} className="min-h-14 w-full rounded-2xl bg-[#E30613] px-5 text-base font-black text-white shadow-lg shadow-red-950/20 transition active:scale-[.98] disabled:opacity-60 lg:w-auto"><DoorOpen className="mr-2 inline size-5" /> {accessBusy ? "Permitiendo…" : "Permitir acceso"}</button>}
      </div>
    </section>

    {!previewProfile && sync?.includes("Sin conexión") && <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Sin conexión. Los datos pueden estar desactualizados.<button type="button" onClick={syncPendingNow} className="btn-secondary mt-3 min-h-11">Volver a conectar</button></div>}

    {accessMessage && <p className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{accessMessage}</p>}
    {accessError && <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{accessError}</p>}

    {canViewStudents && <section className="order-1 grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Stat icon={UsersRound} value={people.length} label="Alumnos" />
      <Stat icon={UserCheck} value={active.length} label="Membresías activas" />
      <Stat icon={Activity} value={accessesToday.filter((item) => item.allowed).length} label="Ingresos hoy" />
      <Stat icon={CalendarClock} value={expiring.length} label="Por vencer" />
    </section>}

    <section className="order-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
      {(allowed.canUseOwnProgress || allowed.canViewStudentProgress) && <QuickLink to="/progreso" icon={Activity} label="Progreso" detail={allowed.canViewStudentProgress ? "Medidas y evolución" : "Mis medidas"} />}
      {allowed.canViewExercises && <QuickLink to="/ejercicios" icon={Dumbbell} label="Ejercicios" detail="Resolver dudas" />}
      {(allowed.canViewRoutines || allowed.canViewStudentRoutines) && <QuickLink to="/rutinas" icon={ClipboardList} label="Rutinas" detail="Consultar rutinas" />}
      {recipesEnabled && <QuickLink to="/recetas" icon={ChefHat} label="Recetas" detail="Ingredientes y preparación" />}
    </section>


  </div>;
}

function Stat({ icon: Icon, value, label }) {
  return <article className="rounded-[20px] bg-white p-3 shadow-sm"><span className="grid size-8 place-items-center rounded-xl bg-red-50 text-[#E30613]"><Icon className="size-4" /></span><p className="mt-2 text-xl font-black text-slate-900 sm:text-2xl">{value}</p><p className="mt-1 text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p></article>;
}

function QuickLink({ to, icon: Icon, label, detail }) {
  return <Link to={to} className="min-h-[88px] group rounded-[20px] border border-black/7 bg-white p-4 shadow-sm transition hover:border-red-200 hover:shadow-md active:scale-[.98]"><Icon className="size-5 text-[#E30613]" /><p className="mt-3 flex items-center justify-between text-sm font-black text-slate-900">{label}<ArrowUpRight className="size-4 text-slate-400 group-hover:text-[#E30613]" /></p><p className="mt-1 text-[10px] font-bold text-slate-400">{detail}</p></Link>;
}
