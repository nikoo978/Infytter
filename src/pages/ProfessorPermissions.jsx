import { RefreshCw, UserCog } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { listProfessorAccessPermissions, setProfessorPermission } from "../services/professorAccess";

const controls = [
  ["canViewStudents", "Consultar alumnos", "Buscar fichas, consultar progreso y enviar rutinas."],
  ["canCreateExercises", "Agregar ejercicios", "Crear ejercicios personalizados."],
  ["canEditExercises", "Modificar ejercicios propios", "Editar los ejercicios personalizados que creó."],
  ["canDeleteExercises", "Quitar ejercicios propios", "Eliminar sus ejercicios personalizados; conserva el catálogo base."],
  ["canGrantAccess", "Permitir acceso", "Autorizar un ingreso manual al gimnasio."],
];

export default function ProfessorPermissions() {
  const { permissions } = useAuth();
  const [professors, setProfessors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const load = async () => {
    setLoading(true); setError("");
    const result = await listProfessorAccessPermissions();
    if (result.error) setError(result.error.message || "No se pudieron cargar los permisos.");
    else setProfessors(result.professors || []);
    setLoading(false);
  };
  useEffect(() => { if (permissions?.isMaster) void load(); }, [permissions?.isMaster]);
  const toggle = async (professor, key, label) => {
    if (saving) return;
    const next = !professor[key];
    setSaving(`${professor.userId}:${key}`); setError(""); setMessage("");
    try {
      const result = await setProfessorPermission(professor.userId, key, next);
      if (result.error) setError(result.error.message || "No se pudo actualizar el permiso.");
      else {
        setProfessors((current) => current.map((item) => item.userId === professor.userId ? { ...item, [key]: next } : item));
        setMessage(`${professor.name || professor.email}: ${label} ${next ? "habilitado" : "deshabilitado"}.`);
      }
    } catch { setError("No se pudo guardar el permiso. Volvé a intentar."); }
    finally { setSaving(""); }
  };
  if (!permissions?.isMaster) return null;
  return <div className="mx-auto max-w-[1000px] space-y-6">
    <section className="page-head"><div><h1 className="page-title">Permisos de profesores</h1><p className="page-subtitle">Habilitá cada función para los profesores que elijas.</p></div><button onClick={load} disabled={loading || Boolean(saving)} className="btn-secondary"><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Actualizar</button></section>
    {message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</p>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
    <section className="space-y-4">{professors.map((professor) => <article key={professor.userId} className="panel p-4 sm:p-5">
      <div className="mb-4 flex min-w-0 items-center gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-red-50 text-[#E30613]"><UserCog className="size-5" /></span><div className="min-w-0"><h2 className="truncate font-black text-slate-900">{professor.name || professor.email}</h2><p className="truncate text-xs text-slate-500">{professor.email}</p></div></div>
      <div className="divide-y divide-slate-100">{controls.map(([key, label, detail]) => <div key={key} className="flex items-center justify-between gap-4 py-3"><div className="min-w-0"><p id={`${professor.userId}-${key}`} className="text-sm font-bold text-slate-800">{label}</p><p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p></div><button type="button" role="switch" aria-checked={Boolean(professor[key])} aria-labelledby={`${professor.userId}-${key}`} disabled={Boolean(saving)} onClick={() => toggle(professor, key, label)} className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition disabled:opacity-50 ${professor[key] ? "bg-[#E30613]" : "bg-slate-300"}`}><span className={`size-6 rounded-full bg-white shadow transition-transform ${professor[key] ? "translate-x-7" : "translate-x-1"}`} /></button></div>)}</div>
    </article>)}{loading && <p className="text-sm text-slate-500">Cargando profesores…</p>}{!loading && !professors.length && <p className="panel py-10 text-center text-sm text-slate-500">No hay cuentas Profesor registradas.</p>}</section>
  </div>;
}
