import { useCallback, useEffect, useMemo, useState } from "react";
import { BellRing, CheckCircle2, History, Monitor, Send, Settings2, Share, Smartphone, Trash2, XCircle } from "lucide-react";
import { useGym } from "../context/GymContext";
import { useAuth } from "../context/AuthContext";
import { DEFAULT_PREFERENCES, disablePushNotifications, enableLocalNotifications, enablePushNotifications, getDeviceEnvironment, getPushDiagnostics, getPushStatus, testBrowserNotification, testPushNotification, updatePushPreferences } from "../services/notifications";

const options = [
  { id: "newClient", label: "Cliente nuevo", detail: "Cuando se registra un cliente." },
  { id: "income", label: "Ingresos de dinero", detail: "Cuotas, ventas y otros ingresos." },
  { id: "withdrawal", label: "Retiros de caja", detail: "Cuando se registra un retiro." },
  { id: "expense", label: "Gastos", detail: "Limpieza, servicios, insumos y otros." },
  { id: "membershipExpiring", label: "Período por vencer", detail: "Un día antes del vencimiento del cliente." },
  { id: "membershipExpired", label: "Período vencido", detail: "Cuando la membresía ya quedó vencida." },
  { id: "clientAccess", label: "Ingreso de clientes", detail: "Cada acceso permitido de un cliente." },
  { id: "staffAccess", label: "Ingreso de profesores", detail: "Cada acceso del personal." },
  { id: "deniedAccess", label: "Accesos rechazados", detail: "Cuota vencida o DNI no registrado." },
  { id: "manualAccess", label: "Accesos manuales", detail: "Personas autorizadas desde recepción." },
];

function platformContent(environment) {
  if (environment.platform === "android") {
    return {
      title: environment.standalone ? "Android · App instalada" : "Android",
      description: environment.standalone
        ? "Estás usando Infytter como app instalada. Web Push puede funcionar incluso con la app cerrada."
        : "Estás usando Infytter desde el navegador. Android permite Web Push desde Chrome; si ya instalaste la app, abrila desde su ícono para usar el modo PWA.",
      steps: environment.standalone
        ? ["Tocá “Activar notificaciones” abajo.", "Aceptá el permiso de Android.", "Usá “Probar en este navegador” para comprobar el permiso y luego “Probar envío remoto”."]
        : ["Tocá “Activar notificaciones” abajo.", "Aceptá el permiso del navegador.", "Opcional: instalá/abrí Infytter desde el ícono para usarla como PWA."],
      icon: Smartphone,
    };
  }

  if (environment.platform === "ios") {
    return {
      title: "iPhone y iPad",
      description: environment.standalone ? "Infytter está abierta como PWA. Ya podés activar Web Push." : "En iOS, Web Push requiere instalar la app en la pantalla de inicio.",
      steps: environment.standalone
        ? ["Tocá “Activar notificaciones” abajo.", "Aceptá el permiso de iOS.", "Usá “Probar en este navegador” para comprobar el permiso y luego “Probar envío remoto”."]
        : ["Tocá Compartir.", "Elegí “Agregar a inicio”.", "Abrí Infytter desde el ícono y activá las notificaciones."],
      icon: Smartphone,
    };
  }

  return {
    title: environment.platform === "windows" ? "PC · Windows" : environment.platform === "mac" ? "PC · macOS" : "PC / navegador",
    description: `Estás usando ${environment.browser}. Las notificaciones dependen del permiso del navegador y del sistema operativo.`,
    steps: ["Tocá “Activar notificaciones” abajo.", "Permití las notificaciones cuando el navegador lo solicite.", "Usá “Probar en este navegador” para comprobar el permiso y luego “Probar envío remoto”."],
    icon: Monitor,
  };
}

export default function Notificaciones() {
  const { data, clearNotificationLog } = useGym();
  const { isCloud, permissions } = useAuth();
  const [state, setState] = useState("checking");
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState("info");
  const [permission, setPermission] = useState(() => typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  const [diagnostics, setDiagnostics] = useState(null);
  const environment = useMemo(() => getDeviceEnvironment(), []);
  const help = useMemo(() => platformContent(environment), [environment]);
  const HelpIcon = help.icon;

  const checkStatus = useCallback(async () => {
    setState("checking");
    setMessage("");
    setMessageKind("info");
    let timeoutId;
    try {
      const timeout = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("La comprobación tardó demasiado. Podés reintentar sin recargar la app.")), 9000);
      });
      const status = await Promise.race([getPushStatus({ remote: isCloud }), timeout]);
      if (status.preferences) setPreferences({ ...DEFAULT_PREFERENCES, ...status.preferences });
      setPermission(status.permission || (typeof Notification === "undefined" ? "unsupported" : Notification.permission));
      setState(status.subscription && status.registered === true ? "remote" : status.localOnly && status.permission === "granted" ? "local" : status.requiresInstall ? "install" : status.permission);

      if (isCloud) {
        try {
          const health = await getPushDiagnostics();
          setDiagnostics(health);
        } catch (diagnosticError) {
          setDiagnostics(null);
          setMessageKind("error");
          setMessage(diagnosticError?.message || "No se pudo comprobar la API Push.");
        }
      } else {
        setDiagnostics(null);
      }
    } catch (error) {
      setState("error");
      setMessageKind("error");
      setMessage(error?.message || "No se pudo comprobar el estado de las notificaciones.");
    } finally {
      clearTimeout(timeoutId);
    }
  }, [isCloud]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const activate = async () => {
    setMessage("");
    setMessageKind("info");
    try {
      if (!isCloud) {
        const result = await enableLocalNotifications();
        setPermission(result.permission);
        setState(result.local ? "local" : result.permission);
        setMessage(result.local ? "Notificaciones locales activadas. Para recibir avisos remotos iniciá sesión con una cuenta cloud." : "No se otorgó permiso para notificaciones.");
        return;
      }
      const result = await enablePushNotifications(preferences);
      setPermission(result.permission);
      setPreferences(result.preferences || preferences);
      setState(result.remote ? "remote" : result.permission);
      setMessage(result.remote ? "Este dispositivo quedó registrado correctamente." : "No se otorgó permiso para notificaciones.");
    } catch (error) {
      const currentPermission = typeof Notification === "undefined" ? "unsupported" : Notification.permission;
      setPermission(currentPermission);
      setState(currentPermission === "granted" ? "granted" : "error");
      setMessageKind("error");
      setMessage(error.message);
    }
  };

  const toggle = async (id) => {
    const next = { ...preferences, [id]: !preferences[id] };
    setPreferences(next);
    if (state === "remote" && isCloud) {
      try {
        await updatePushPreferences(next);
        setMessage("Preferencias guardadas en este dispositivo.");
      } catch (error) {
        setPreferences(preferences);
        setMessageKind("error");
        setMessage(error.message);
      }
    }
  };

  const testBrowser = async () => {
    setMessage("");
    setMessageKind("info");
    try {
      const result = await testBrowserNotification();
      setPermission(result.permission);
      if (state !== "remote") setState("granted");
      setMessage("Prueba local mostrada. El permiso del navegador funciona correctamente.");
    } catch (error) {
      setPermission(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
      setMessageKind("error");
      setMessage(error.message);
    }
  };

  const test = async () => {
    setMessage("");
    setMessageKind("info");
    try {
      await testPushNotification();
      setMessage("Notificación de prueba enviada.");
    } catch (error) {
      setMessageKind("error");
      setMessage(error.message);
    }
  };

  const disable = async () => {
    setMessage("");
    setMessageKind("info");
    try {
      await disablePushNotifications();
      setPermission(Notification.permission);
      setState(Notification.permission);
      setMessage("Este dispositivo fue desvinculado de Web Push.");
    } catch (error) {
      setMessageKind("error");
      setMessage(error.message);
    }
  };

  const buttonLabel = state === "remote"
    ? "Activadas"
    : state === "local"
      ? "Locales activadas"
    : state === "checking"
      ? "Comprobando…"
      : state === "install"
        ? "Agregar a inicio para activar"
        : permission === "granted"
          ? "Activar notificaciones remotas"
          : "Activar notificaciones";

  const buttonDisabled = state === "remote" || state === "local" || state === "checking" || state === "install" || state === "unsupported";
  const canTestBrowser = permission === "granted" || state === "remote" || state === "local" || state === "granted";

  return <div className="mx-auto max-w-5xl space-y-6">
    <section><p className="eyebrow">Comunicación</p><h1 className="page-title">Notificaciones</h1><p className="page-subtitle">Cada cuenta cloud puede elegir qué avisos remotos recibe en cada dispositivo. En modo local, los avisos permanecen en este equipo.</p></section>

    <section className="grid gap-5 md:grid-cols-2">
      <article className="panel">
        <span className="grid size-12 place-items-center rounded-2xl bg-[#E30613] text-white"><BellRing className="size-6" /></span>
        <h2 className="mt-5 section-title">Este dispositivo</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">{environment.platform === "android" ? `Android · ${environment.browser}${environment.standalone ? " · PWA instalada" : " · navegador"}` : environment.platform === "ios" ? `iOS · ${environment.standalone ? "PWA instalada" : "Safari/navegador"}` : `${environment.browser} · PC`}</p>
        <button onClick={activate} disabled={buttonDisabled} className="btn-primary mt-6 w-full">{state === "remote" || state === "local" ? <><CheckCircle2 className="size-4" /> {buttonLabel}</> : buttonLabel}</button>
        {canTestBrowser && <button onClick={testBrowser} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-black/10 px-3 py-2.5 text-xs font-black"><BellRing className="size-3.5" /> Probar en este navegador</button>}
        {state === "remote" && isCloud && <div className="mt-2 grid grid-cols-2 gap-2"><button onClick={test} className="inline-flex items-center justify-center gap-2 rounded-xl border border-black/10 px-3 py-2 text-xs font-black"><Send className="size-3.5" /> Probar envío remoto</button><button onClick={disable} className="inline-flex items-center justify-center gap-2 rounded-xl border border-black/10 px-3 py-2 text-xs font-black text-[#9E0710]"><XCircle className="size-3.5" /> Desvincular</button></div>}
        {state === "denied" && <p className="mt-3 text-xs text-red-600">El permiso está bloqueado. Habilitalo desde la configuración de notificaciones del navegador o de Android.</p>}
        {state === "unsupported" && <p className="mt-3 text-xs text-red-600">Este navegador no admite Web Push.</p>}
        {!isCloud && <p className="mt-3 text-xs font-bold text-slate-500">Modo local: los avisos remotos se pausan. Los movimientos operativos pendientes se sincronizan con Cloud cuando vuelve Internet.</p>}
        {message && <p className={`mt-3 text-xs font-bold ${messageKind === "error" ? "text-red-600" : "text-slate-500"}`}>{message}</p>}
        {isCloud && diagnostics && !diagnostics.configuredForImmediatePush && <p className="mt-3 text-xs font-bold text-red-600">Backend Push incompleto: revisá VAPID y Redis en el servidor.</p>}
        {isCloud && diagnostics?.configuredForImmediatePush && !diagnostics.configuredForScheduledPush && <p className="mt-3 text-xs font-bold text-amber-700">Push inmediato listo; faltan QStash/NOTIFICATION_SECRET/PUBLIC_APP_URL para avisos de vencimientos programados.</p>}
      </article>

      <article className="rounded-[24px] bg-[#050505] p-6 text-white">
        <HelpIcon className="size-7 text-[#E30613]" />
        <h2 className="mt-5 text-xl font-black">{help.title}</h2>
        <p className="mt-2 text-sm leading-6 text-[#AFAFAF]">{help.description}</p>
        <ol className="mt-5 space-y-4 text-sm">{help.steps.map((step, index) => <li key={step} className="flex gap-3"><span className="step">{index + 1}</span><span>{step}{environment.platform === "ios" && !environment.standalone && index === 0 ? <Share className="ml-1 inline size-4" /> : null}</span></li>)}</ol>
      </article>
    </section>

    <section className="panel"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-red-50 text-[#E30613]"><Settings2 className="size-5" /></span><div><h2 className="section-title">Eventos que quiero recibir</h2><p className="text-xs text-slate-500">Estas preferencias pertenecen a este dispositivo.</p></div></div><div className="mt-6 grid gap-3 sm:grid-cols-2">{options.map((option) => { const enabled = preferences[option.id] ?? true; return <button key={option.id} type="button" role="switch" aria-checked={enabled} onClick={() => toggle(option.id)} className="flex items-center justify-between gap-4 rounded-2xl border border-black/8 bg-[#F5F5F5] p-4 text-left transition hover:border-[#E30613]/30"><span><span className="block text-sm font-black text-[#050505]">{option.label}</span><span className="mt-1 block text-xs text-slate-500">{option.detail}</span></span><span className={`relative h-7 w-12 shrink-0 rounded-full transition ${enabled ? "bg-[#E30613]" : "bg-[#AFAFAF]"}`}><span className={`absolute top-1 size-5 rounded-full bg-white shadow-sm transition ${enabled ? "left-6" : "left-1"}`} /></span></button>; })}</div></section>

    <section className="panel"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><History className="size-5 text-[#E30613]" /><div><h2 className="section-title">Actividad reciente</h2><p className="text-xs text-slate-500">Últimos eventos generados por el sistema.</p></div></div>{permissions?.canDelete && <button onClick={clearNotificationLog} disabled={!(data.notificationLog || []).length} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black text-[#9E0710] hover:bg-red-50 disabled:opacity-35"><Trash2 className="size-3.5" /> Borrar</button>}</div><div className="mt-5 divide-y divide-slate-100">{(data.notificationLog || []).slice(0, 15).map((item) => <div key={item.id} className="flex gap-3 py-4"><span className="mt-1 size-2 shrink-0 rounded-full bg-[#E30613]" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-black text-[#050505]">{item.title}</p><p className="text-xs text-slate-400">{new Date(item.date).toLocaleString("es-AR")}</p></div><p className="mt-1 text-sm text-slate-500">{item.body}</p></div></div>)}{!(data.notificationLog || []).length && <p className="py-10 text-center text-sm text-slate-400">Todavía no hay eventos registrados.</p>}</div></section>
  </div>;
}
