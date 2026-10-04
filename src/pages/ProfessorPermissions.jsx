import useAppBack from "../hooks/useAppBack";
import { RefreshCw, Search, ShieldCheck, UserCog } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { listProfessorAccessPermissions, setProfessorPermission, setProfessorPermissions } from "../services/professorAccess";
import { PROFESSOR_PERMISSIONS, professorPermissionEnabled } from "../services/professorPermissions";

const groups = [...new Set(PROFESSOR_PERMISSIONS.map((item) => item.group))];
const asProfile = (professor) => Object.fromEntries(PROFESSOR_PERMISSIONS.map(({ key, column }) => [column, professor[key]]));

export default function ProfessorPermissions() {
  const { permissions } = useAuth();
  const [professors, setProfessors] = useState([]);
  const [query, setQuery] = useState("");
  const [openProfessor, setOpenProfessor] = useState("");
  useAppBack(Boolean(openProfessor), () => setOpenProfessor(""), 20);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const load = async () => {
    setLoading(true); setError("");
    try {
      const result = await listProfessorAccessPermissions();
      if (result.error) throw result.error;
      setProfessors(result.professors || []);
    } catch (err) { setError(err.message || "No se pudieron cargar los permisos."); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (permissions?.isMaster) void load(); }, [permissions?.isMaster]);
  const save = async (professor, values, label) => {
    if (saving) return;
    setSaving(professor.userId); setError(""); setMessage("");
    try {
      const entries = Object.entries(values);
      const result = entries.length === 1
        ? await setProfessorPermission(professor.userId, entries[0][0], entries[0][1])
        : await setProfessorPermissions(professor.userId, values);
      if (result.error) throw result.error;
      setProfessors((current) => current.map((item) => item.userId === professor.userId ? { ...item, ...values } : item));
      setMessage(`${professor.name || professor.email}: ${label}.`);
    } catch (err) { setError(err.message || "No se pudo guardar. Volvé a intentar."); }
    finally { setSaving(""); }
  };
  const setAll = (professor, enabled) => save(professor, Object.fromEntries(PROFESSOR_PERMISSIONS.map(({ key }) => [key, enabled])), enabled ? "todos los permisos habilitados" : "todos los permisos deshabilitados");
  const shown = professors.filter((item) => `${item.name || ""} ${item.email || ""}`.toLowerCase().includes(query.trim().toLowerCase()));
  if (!permissions?.isMaster) return null;
  return <div className="mx-auto max-w-[1100px] space-y-5">
    <section className="page-head"><div><p className="eyebrow">Administración</p><h1 className="page-title">Permisos de profesores</h1><p className="page-subtitle">Controlá cada función por profesor. Los cambios también se validan en la base de datos.</p></div><button onClick={load} disabled={loading || Boolean(saving)} className="btn-secondary"><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Actualizar</button></section>
    <div className="panel flex flex-col gap-3 sm:flex-row sm:items-center"><p className="flex items-center gap-2 text-sm font-bold text-slate-600"><ShieldCheck className="size-5 text-[#E30613]" /> {professors.length} profesores · {PROFESSOR_PERMISSIONS.length} permisos</p><label className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 px-3"><Search className="size-4 shrink-0 text-slate-400" /><input aria-label="Buscar profesor" placeholder="Nombre o email" value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label></div>
    <p className="text-xs leading-5 text-slate-500">Un permiso dependiente queda inactivo si su función principal está deshabilitada. Las sesiones abiertas actualizan los permisos automáticamente.</p>
    {message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</p>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
    <section className="space-y-4">{shown.map((professor) => {
      const profile = asProfile(professor);
      const enabledCount = PROFESSOR_PERMISSIONS.filter(({ key }) => professorPermissionEnabled(profile, key)).length;
      return <details key={professor.userId} open={openProfessor === professor.userId} onToggle={(event) => { if (event.currentTarget.open) setOpenProfessor(professor.userId); else setOpenProfessor((current) => current === professor.userId ? "" : current); }} className="panel p-4 sm:p-5">
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-red-50 text-[#E30613]"><UserCog className="size-5" /></span><div className="min-w-0 flex-1"><h2 className="truncate font-black text-slate-900">{professor.name || professor.email}</h2><p className="truncate text-xs text-slate-500">{professor.email}</p></div><span className="shrink-0 rounded-xl bg-slate-100 px-2 py-1 text-xs font-bold">{enabledCount}/{PROFESSOR_PERMISSIONS.length} activos</span><span aria-hidden="true">⌄</span></summary>
        <div className="mt-4 flex flex-wrap gap-2"><button onClick={() => setAll(professor, true)} disabled={Boolean(saving)} className="btn-secondary min-h-11 text-xs">Habilitar todos</button><button onClick={() => setAll(professor, false)} disabled={Boolean(saving)} className="btn-secondary min-h-11 text-xs text-[#9E0710]">Deshabilitar todos</button></div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">{groups.map((group) => <fieldset key={group} className="rounded-2xl border border-slate-200 px-4"><legend className="px-2 text-sm font-black text-slate-900">{group}</legend><div className="divide-y divide-slate-100">{PROFESSOR_PERMISSIONS.filter((item) => item.group === group).map(({ key, label, detail }) => <div key={key} className="flex items-center justify-between gap-4 py-3"><div className="min-w-0"><p id={`${professor.userId}-${key}`} className="text-sm font-bold text-slate-800">{label}</p><p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>{professor[key] && !professorPermissionEnabled(profile, key) && <p className="mt-1 text-xs font-bold text-amber-700">Inactivo: falta habilitar una función necesaria.</p>}</div><button type="button" role="switch" aria-checked={Boolean(professor[key])} aria-labelledby={`${professor.userId}-${key}`} disabled={Boolean(saving)} onClick={() => save(professor, { [key]: !professor[key] }, `${label} ${professor[key] ? "deshabilitado" : "habilitado"}`)} className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition disabled:opacity-50 ${professor[key] ? "bg-[#E30613]" : "bg-slate-300"}`}><span className={`size-6 rounded-full bg-white shadow transition-transform ${professor[key] ? "translate-x-7" : "translate-x-1"}`} /></button></div>)}</div></fieldset>)}</div>
      </details>;
    })}{loading && <p className="text-sm text-slate-500">Cargando profesores…</p>}{!loading && !shown.length && <p className="panel py-10 text-center text-sm text-slate-500">{professors.length ? "No hay profesores que coincidan." : "No hay cuentas Profesor registradas."}</p>}</section>
  </div>;
}
