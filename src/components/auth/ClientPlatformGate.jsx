import { CalendarClock, Link2Off, LogOut, RefreshCw, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { getMyClientPlatformAccess } from "../../services/roles";

const dateLabel = (value) => value
  ? new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString("es-AR")
  : null;

function blockedCopy(access) {
  switch (access?.reason) {
    case "unlinked":
      return {
        Icon: Link2Off,
        eyebrow: "Cuenta pendiente de vinculación",
        title: "Todavía no podemos habilitar tu plataforma",
        body: "Tu cuenta está creada, pero aún no está vinculada a una ficha de Cliente del gimnasio. Acercate a recepción para que vinculen tu DNI con esta cuenta.",
      };
    case "link_mismatch":
      return {
        Icon: Link2Off,
        eyebrow: "Vínculo de cuenta incorrecto",
        title: "Tu cuenta está vinculada a otra ficha",
        body: "El DNI de tu cuenta no coincide con la ficha vinculada. Pedí en recepción que revisen el vínculo; tu membresía no se modificó.",
      };
    case "expired":
      return {
        Icon: CalendarClock,
        eyebrow: "Mensualidad vencida",
        title: "Renová tu mensualidad para seguir usando Infytter",
        body: access?.expiry
          ? `Tu última mensualidad venció el ${dateLabel(access.expiry)}. Una vez renovada en recepción, el acceso a la plataforma se habilita nuevamente.`
          : "Tu ficha no tiene una mensualidad vigente. Una vez renovada en recepción, el acceso a la plataforma se habilita nuevamente.",
      };
    case "not_started":
      return {
        Icon: CalendarClock,
        eyebrow: "Membresía aún no iniciada",
        title: "Tu acceso todavía no está activo",
        body: access?.start
          ? `Tu membresía comienza el ${dateLabel(access.start)}. Desde esa fecha vas a poder usar toda la plataforma.`
          : "Tu membresía todavía no tiene una fecha de inicio válida. Consultalo en recepción.",
      };
    case "archived":
      return {
        Icon: ShieldAlert,
        eyebrow: "Ficha inactiva",
        title: "Tu ficha de Cliente está inactiva",
        body: "Para volver a ingresar a la plataforma, consultá en recepción para que revisen el estado de tu ficha.",
      };
    default:
      return {
        Icon: ShieldAlert,
        eyebrow: "Acceso restringido",
        title: "No pudimos habilitar tu plataforma",
        body: "Tu cuenta necesita una ficha de Cliente vinculada y una mensualidad vigente. Consultá en recepción si necesitás ayuda.",
      };
  }
}

function GateShell({ children }) {
  return <main className="min-h-dvh bg-[#050505] px-4 py-6 text-white sm:grid sm:place-items-center">
    <section className="mx-auto w-full max-w-md rounded-[28px] border border-white/10 bg-white p-6 text-[#050505] shadow-2xl sm:p-8">
      <img src="/infytter-logo.svg" alt="Infytter Fitness" className="h-14 w-full rounded-xl bg-[#050505] object-contain p-2" />
      {children}
    </section>
  </main>;
}

export default function ClientPlatformGate({ children }) {
  const { user, logout } = useAuth();
  const [access, setAccess] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const checkAccess = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError("");
    const result = await getMyClientPlatformAccess();
    if (result.error) {
      setError(result.error.message || "No pudimos verificar tu membresía.");
      setAccess(null);
    } else {
      setAccess(result.access);
    }
    if (!silent) setLoading(false);
  }, []);

  useEffect(() => {
    checkAccess();
    const interval = window.setInterval(() => checkAccess({ silent: true }), 60_000);
    const onFocus = () => checkAccess({ silent: true });
    const onVisibility = () => { if (document.visibilityState === "visible") onFocus(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [checkAccess, user?.id]);

  if (loading) {
    return <GateShell><div className="flex min-h-52 flex-col items-center justify-center gap-3 text-center"><RefreshCw className="size-7 animate-spin text-[#E30613]" /><p className="text-sm font-black text-slate-700">Verificando tu membresía…</p></div></GateShell>;
  }

  if (error) {
    return <GateShell>
      <div className="mt-7 text-center"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-red-50 text-[#E30613]"><ShieldAlert className="size-7" /></span><p className="mt-5 text-[11px] font-black uppercase tracking-[.2em] text-[#E30613]">Verificación pendiente</p><h1 className="mt-2 text-2xl font-black">No pudimos comprobar tu acceso</h1><p className="mt-3 text-sm leading-6 text-slate-500">Por seguridad, Infytter no muestra la plataforma hasta poder validar tu ficha y tu mensualidad.</p><p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs font-bold text-slate-500">{error}</p></div>
      <div className="mt-6 grid gap-2"><button onClick={() => checkAccess()} className="btn-primary min-h-12 w-full"><RefreshCw className="size-4" /> Reintentar</button><button onClick={logout} className="btn-secondary min-h-12 w-full"><LogOut className="size-4" /> Cerrar sesión</button></div>
    </GateShell>;
  }

  if (!access?.allowed) {
    const copy = blockedCopy(access);
    const Icon = copy.Icon;
    return <GateShell>
      <div className="mt-7 text-center"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-red-50 text-[#E30613]"><Icon className="size-7" /></span><p className="mt-5 text-[11px] font-black uppercase tracking-[.2em] text-[#E30613]">{copy.eyebrow}</p><h1 className="mt-2 text-2xl font-black leading-tight">{copy.title}</h1><p className="mt-3 text-sm leading-6 text-slate-500">{copy.body}</p></div>
      <div className="mt-6 rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-wider text-slate-400">Para ingresar necesitás</p><div className="mt-3 space-y-2 text-sm font-bold text-slate-700"><p>✓ Cuenta vinculada a tu ficha de Cliente</p><p>✓ Mensualidad vigente</p></div></div>
      <div className="mt-6 grid gap-2"><button onClick={() => checkAccess()} className="btn-primary min-h-12 w-full"><RefreshCw className="size-4" /> {access?.reason === "link_mismatch" ? "Verificar vínculo de nuevo" : "Ya renové · Verificar de nuevo"}</button><button onClick={logout} className="btn-secondary min-h-12 w-full"><LogOut className="size-4" /> Cerrar sesión</button></div>
    </GateShell>;
  }

  return children;
}
