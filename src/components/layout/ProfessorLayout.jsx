"use client";

import { Activity, ClipboardList, Dumbbell, LayoutDashboard, LogOut, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import { APP_VERSION } from "../../App";
import { useAuth } from "../../context/AuthContext";
import { permissionsForRole } from "../../services/roles";
import { useGym } from "../../context/GymContext";

const professorNavigation = [
  { label: "Inicio", path: "/", icon: LayoutDashboard },
  { label: "Alumnos", path: "/clientes", icon: UsersRound },
  { label: "Progreso", path: "/progreso", icon: Activity },
  { label: "Ejercicios", path: "/ejercicios", icon: Dumbbell },
  { label: "Rutinas", path: "/rutinas", icon: ClipboardList },
];

export default function ProfessorLayout({ currentPath = "/", children, preview = false, previewProfile = null, onPreviewNavigate = null }) {
  const { profile, logout } = useAuth();
  const { data, setBranch, sync } = useGym();
  const shownProfile = previewProfile || profile;
  const allowed = permissionsForRole("profe", shownProfile);
  const visibleNavigation = professorNavigation.filter((item) => item.path === "/" || ({ "/clientes": allowed.canViewStudents, "/progreso": allowed.canUseOwnProgress || allowed.canViewStudentProgress, "/ejercicios": allowed.canViewExercises, "/rutinas": allowed.canViewRoutines || allowed.canViewStudentRoutines }[item.path]));
  const displayName = shownProfile?.display_name || "Profesor";

  const NavItem = ({ item, compact = false }) => {
    const Icon = item.icon;
    const active = currentPath === item.path;
    const classes = compact
      ? `flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-3 text-[10px] font-black leading-none transition active:scale-95 ${active ? "bg-[#E30613] text-white shadow-sm" : "text-slate-500"}`
      : `inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-black ${active ? "bg-[#E30613] text-white" : "text-slate-600 hover:bg-slate-100"}`;
    if (preview && onPreviewNavigate) return <button type="button" aria-current={active ? "page" : undefined} onClick={() => onPreviewNavigate(item.path)} className={classes}><Icon className="size-4" />{item.label}</button>;
    if (preview) return <span className={classes}><Icon className="size-4" />{item.label}</span>;
    return <Link aria-current={active ? "page" : undefined} to={item.path} className={classes}><Icon className="size-4" />{item.label}</Link>;
  };

  return <div className="role-shell min-h-dvh overflow-x-hidden bg-[#F4F5F7]">
    <header className="sticky top-0 z-30 border-b border-black/8 bg-white/95 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1480px] items-center justify-between gap-2 px-3 sm:h-16 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <img src="/infytter-logo.svg" alt="Infytter Fitness" className="h-8 w-24 shrink-0 rounded-lg bg-[#050505] object-contain px-2 sm:h-9 sm:w-28" />
          <div className="hidden min-w-0 sm:block"><p className="truncate text-sm font-black text-[#050505]">Panel Profesor</p><p className="text-[10px] font-bold text-slate-400">{APP_VERSION}</p></div>
        </div>
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <select value={data.activeBranch} onChange={(event) => !preview && setBranch(event.target.value)} disabled={preview} aria-label="Sucursal" className="h-9 max-w-[132px] min-w-0 rounded-xl border border-black/10 bg-white px-2 text-[11px] font-black text-slate-700 outline-none disabled:opacity-70 sm:max-w-none sm:text-xs">
            {(data.branches || []).map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select>
          {!preview && <button onClick={logout} className="grid size-11 shrink-0 place-items-center rounded-xl border border-black/10 text-slate-500" aria-label="Cerrar sesión"><LogOut className="size-4" /></button>}
        </div>
      </div>
      <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-3 border-t border-black/5 px-3 py-1.5 text-[10px] font-bold text-slate-400 sm:px-6 md:hidden"><span className="truncate">{displayName}</span><span className="shrink-0">{sync}</span></div>
      <nav className="mx-auto hidden max-w-[1480px] items-center justify-center gap-1 border-t border-black/5 px-4 py-2 md:flex lg:border-0 lg:py-0">{visibleNavigation.map((item) => <NavItem key={item.path} item={item} />)}</nav>
    </header>

    <main className="px-3 pb-[calc(6.75rem+env(safe-area-inset-bottom))] pt-4 sm:p-6 sm:pb-28 md:pb-8 lg:p-8">{children}</main>

    <div className="fixed inset-x-0 bottom-0 z-40 px-2 pb-[max(.45rem,env(safe-area-inset-bottom))] md:hidden">
      <nav style={{ gridTemplateColumns: `repeat(${visibleNavigation.length}, minmax(0, 1fr))` }} className="grid gap-1 rounded-[22px] border border-black/10 bg-white/95 p-1.5 shadow-[0_-8px_30px_rgba(0,0,0,.10)] backdrop-blur-xl">
        {visibleNavigation.map((item) => <NavItem key={item.path} item={item} compact />)}
      </nav>
    </div>
  </div>;
}
