"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { KeyRound, LogIn, Mail, ShieldCheck, UserPlus, X } from "lucide-react";
import { supabase, supabaseConfigured } from "../services/supabase";
import { getCloudState } from "../services/storage";
import { unlinkPushSubscriptionBeforeLogout } from "../services/notifications";
import { getMyProfile, permissionsForRole } from "../services/roles";
import { PASSWORD_POLICY_SUMMARY, passwordPolicyError, passwordRequirementStatus } from "../services/passwordPolicy";

const AuthContext = createContext(null);
const MODE_KEY = "gymflow-emergency-local-mode";
const MASTER_PIN_SHA256 = "f80a08b67ae13695c7e3c325abd0fcd811419ee8af4707ccd9423e020664e70a"; // 110725
const PROFILE_CACHE_KEY = "gymflow-profile-v1";

function getModeStorage() { try { return window.sessionStorage; } catch { return null; } }
function getCachedProfile(userId) { try { const value = JSON.parse(localStorage.getItem(PROFILE_CACHE_KEY) || "null"); return value?.user_id === userId ? value : null; } catch { return null; } }
function cacheProfile(profile) { try { if (profile) localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile)); } catch { /* no-op */ } }

function isDesktopPc() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const mobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const ipadDesktopUa = /Macintosh/i.test(ua) && Number(navigator.maxTouchPoints || 0) > 1;
  const wideEnough = window.matchMedia?.("(min-width: 900px)")?.matches ?? window.innerWidth >= 900;
  const finePointer = window.matchMedia?.("(pointer: fine)")?.matches ?? true;
  return !mobileUa && !ipadDesktopUa && wideEnough && finePointer;
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function authMessage(error, action = "login") {
  const message = String(error?.message || "").toLowerCase();
  const code = String(error?.code || "").toLowerCase();
  if (message.includes("invalid login credentials")) return "Email o contraseña incorrectos.";
  if (message.includes("email not confirmed")) return "Primero confirmá tu email desde el mensaje que te envió Supabase.";
  if (message.includes("user already registered")) return "Ese email ya tiene una cuenta. Usá Ingresar.";
  if (message.includes("dni") && message.includes("registr")) return "Ese DNI ya tiene una cuenta registrada.";
  if (message.includes("dni")) return "Ingresá un DNI válido.";
  if (message.includes("nombre completo")) return "Ingresá tu nombre completo.";
  if (code.includes("weak_password") || (message.includes("password") && (message.includes("least") || message.includes("characters") || message.includes("contain") || message.includes("weak")))) return `La contraseña no cumple los requisitos. ${PASSWORD_POLICY_SUMMARY}`;
  if (message.includes("invalid email")) return "El email no es válido.";
  if (message.includes("rate limit") || error?.status === 429) return "Demasiados intentos. Esperá unos minutos y volvé a probar.";
  if (message.includes("network") || message.includes("fetch")) return "No se pudo conectar con Supabase. Revisá la conexión.";
  if (!supabaseConfigured) return "Supabase todavía no está configurado para esta versión de GymFlow.";
  if (action === "register") return "No se pudo crear la cuenta. Revisá nombre, DNI, email y contraseña.";
  if (action === "reset") return "No se pudo enviar el correo de recuperación.";
  if (action === "password") return "No se pudo actualizar la contraseña.";
  return "No se pudo iniciar sesión.";
}

function PasswordRequirements({ value, id = "password-requirements" }) {
  const status = passwordRequirementStatus(value);
  return <div id={id} className="mt-2 rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Requisitos de contraseña</p><div className="mt-2 grid grid-cols-1 gap-1.5 min-[380px]:grid-cols-2">{status.map((item) => <span key={item.key} className={`text-[11px] font-bold ${item.met ? "text-emerald-700" : "text-slate-400"}`}>{item.met ? "✓" : "•"} {item.label}</span>)}</div></div>;
}

function AuthScreen({ onLogin, onRegister, onReset, error, notice, busy }) {
  const [view, setView] = useState("login");
  const [passwordDraft, setPasswordDraft] = useState("");
  const changeView = (next) => { setView(next); setPasswordDraft(""); };

  const submit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();
    if (view === "reset") { await onReset(email); return; }
    const password = String(form.get("password") || "");
    if (view === "register") {
      await onRegister(
        String(form.get("name") || "").trim(),
        String(form.get("dni") || "").replace(/\D/g, ""),
        email,
        password,
      );
    } else await onLogin(email, password);
  };

  const field = "mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-[#E30613]/20";

  return <main className="grid min-h-screen place-items-center bg-[#050505] p-4">
    <section className="w-full max-w-md rounded-[24px] border border-white/10 bg-white p-7 shadow-2xl">
      <img src="/infytter-logo.svg" alt="Infytter Fitness" className="h-16 w-full rounded-xl bg-[#050505] object-contain p-2" />
      <h1 className="mt-6 text-3xl font-black uppercase text-[#050505]">{view === "register" ? "Crear cuenta" : view === "reset" ? "Recuperar acceso" : "Ingresar"}</h1>
      <p className="mt-2 text-sm leading-6 text-slate-500">{view === "register" ? "Registrate con nombre completo, DNI, email y una contraseña que cumpla los requisitos indicados abajo. La cuenta ingresa como Cliente hasta que un administrador la vincule o cambie su rol." : view === "reset" ? "Te enviaremos un enlace para elegir una contraseña nueva." : "Acceso seguro con Supabase."}</p>

      <form onSubmit={submit} className="mt-6 grid gap-4">
        {view === "register" && <><label className="text-sm font-bold text-slate-600">Nombre completo<input name="name" required minLength="3" autoComplete="name" placeholder="Nombre y apellido" className={field} /></label><label className="text-sm font-bold text-slate-600">DNI<input name="dni" required inputMode="numeric" pattern="[0-9]{6,10}" minLength="6" maxLength="10" autoComplete="off" placeholder="Solo números" className={field} /></label></>}
        <label className="text-sm font-bold text-slate-600">Email<input name="email" type="email" required autoComplete="email" className={field} /></label>
        {view !== "reset" && <label className="text-sm font-bold text-slate-600">Contraseña<input name="password" type="password" minLength="8" required autoComplete={view === "register" ? "new-password" : "current-password"} onChange={(event) => setPasswordDraft(event.target.value)} aria-describedby={view === "register" ? "register-password-requirements" : undefined} className={field} />{view === "register" && <PasswordRequirements value={passwordDraft} id="register-password-requirements" />}</label>}
        {error && <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-600">{error}</p>}
        {notice && <p className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{notice}</p>}
        <button disabled={busy} className="btn-primary w-full disabled:opacity-60">{busy ? "Procesando…" : view === "register" ? <><UserPlus className="size-4" /> Crear cuenta</> : view === "reset" ? <><Mail className="size-4" /> Enviar recuperación</> : <><LogIn className="size-4" /> Ingresar</>}</button>
      </form>

      <div className="mt-4 grid gap-2 text-sm font-bold">{view !== "login" && <button disabled={busy} onClick={() => changeView("login")} className="rounded-xl px-3 py-2 text-[#9E0710] hover:bg-red-50 disabled:opacity-60">Volver a ingresar</button>}{view === "login" && <button disabled={busy} onClick={() => changeView("register")} className="rounded-xl px-3 py-2 text-[#9E0710] hover:bg-red-50 disabled:opacity-60">Crear cuenta</button>}{view === "login" && <button disabled={busy} onClick={() => changeView("reset")} className="rounded-xl px-3 py-2 text-slate-600 hover:bg-slate-50 disabled:opacity-60">Olvidé mi contraseña</button>}</div>
    </section>
  </main>;
}

function PasswordRecovery({ onUpdatePassword, error, notice, busy }) {
  const [passwordDraft, setPasswordDraft] = useState("");
  const submit = async (event) => { event.preventDefault(); await onUpdatePassword(passwordDraft); };
  return <main className="grid min-h-screen place-items-center bg-[#050505] p-4"><section className="w-full max-w-md rounded-[24px] bg-white p-7 shadow-2xl"><span className="grid size-12 place-items-center rounded-2xl bg-red-50 text-[#E30613]"><KeyRound className="size-6" /></span><h1 className="mt-5 text-3xl font-black uppercase">Nueva contraseña</h1><p className="mt-2 text-sm leading-6 text-slate-500">{PASSWORD_POLICY_SUMMARY}</p><form onSubmit={submit} className="mt-6 grid gap-4"><input name="password" value={passwordDraft} onChange={(event) => setPasswordDraft(event.target.value)} type="password" minLength="8" required autoComplete="new-password" aria-describedby="recovery-password-requirements" className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-[#E30613]/20" /><PasswordRequirements value={passwordDraft} id="recovery-password-requirements" />{error && <p className="text-sm font-bold text-red-600">{error}</p>}{notice && <p className="text-sm font-bold text-emerald-700">{notice}</p>}<button disabled={busy} className="btn-primary w-full">{busy ? "Guardando…" : "Guardar contraseña"}</button></form></section></main>;
}

function LocalPinModal({ open, onClose, onConfirm, error, busy }) {
  const [pin, setPin] = useState("");
  useEffect(() => { if (open) setPin(""); }, [open]);
  if (!open) return null;
  const submit = async (event) => { event.preventDefault(); await onConfirm(pin); };
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"><section className="w-full max-w-sm rounded-[24px] bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><span className="grid size-12 place-items-center rounded-2xl bg-red-50 text-[#E30613]"><ShieldCheck className="size-6" /></span><button type="button" onClick={onClose} disabled={busy} className="grid size-9 place-items-center rounded-xl border border-black/10 text-slate-500 hover:bg-slate-50"><X className="size-4" /></button></div><h2 className="mt-5 text-2xl font-black uppercase">Modo local</h2><p className="mt-2 text-sm leading-6 text-slate-500">Emergencia exclusiva del administrador durante un corte de Internet. Ingresá el PIN maestro.</p><form onSubmit={submit} className="mt-5 grid gap-3"><input autoFocus inputMode="numeric" autoComplete="off" pattern="[0-9]*" maxLength={6} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))} className="h-12 rounded-xl border border-slate-200 px-4 text-center text-xl font-black tracking-[0.35em] outline-none focus:ring-2 focus:ring-[#E30613]/20" aria-label="PIN maestro" />{error && <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-600">{error}</p>}<button disabled={busy || pin.length !== 6} className="btn-primary w-full disabled:opacity-50">{busy ? "Verificando…" : "Entrar en modo local"}</button></form></section></div>;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined);
  const [mode, setMode] = useState("loading");
  const [recovery, setRecovery] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [desktopPc, setDesktopPc] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine !== false);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinError, setPinError] = useState("");
  const [pinBusy, setPinBusy] = useState(false);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const modeRef = useRef(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  const refreshProfile = async (userId = session?.user?.id) => {
    if (!userId) { setProfile(null); setProfileError(""); return null; }
    setProfileLoading(true);
    try {
      const { profile: next, error: profileLoadError } = await getMyProfile();
      if (profileLoadError) throw profileLoadError;
      if (!next) throw new Error("Tu cuenta todavía no tiene un perfil GymFlow.");
      setProfile(next); cacheProfile(next); setProfileError(""); return next;
    } catch (err) {
      const cached = getCachedProfile(userId);
      if (cached) { setProfile(cached); setProfileError(""); return cached; }
      setProfile(null); setProfileError(err?.message || "No se pudo cargar el rol de la cuenta."); return null;
    } finally { setProfileLoading(false); }
  };

  useEffect(() => { if (!session?.user?.id) { setProfile(null); setProfileError(""); return; } refreshProfile(session.user.id); }, [session?.user?.id, isOnline]);
  useEffect(() => { if (!session?.user?.id || !isOnline) return undefined; const timer = setInterval(() => refreshProfile(session.user.id), 15000); return () => clearInterval(timer); }, [session?.user?.id, isOnline]);

  useEffect(() => {
    let active = true; let controller = null;
    const refreshDesktop = () => setDesktopPc(isDesktopPc());
    const checkConnectivity = async () => {
      if (navigator.onLine === false) { if (active) setIsOnline(false); return; }
      controller?.abort(); controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 3000);
      try { const response = await fetch(`/api/health?t=${Date.now()}`, { cache: "no-store", signal: controller.signal }); if (active) setIsOnline(response.ok); } catch { if (active) setIsOnline(false); } finally { clearTimeout(timeout); }
    };
    const online = () => checkConnectivity(); const offline = () => setIsOnline(false);
    refreshDesktop(); checkConnectivity(); const interval = setInterval(checkConnectivity, 8000);
    window.addEventListener("resize", refreshDesktop); window.addEventListener("online", online); window.addEventListener("offline", offline);
    return () => { active = false; controller?.abort(); clearInterval(interval); window.removeEventListener("resize", refreshDesktop); window.removeEventListener("online", online); window.removeEventListener("offline", offline); };
  }, []);

  useEffect(() => {
    let active = true;
    if (!supabaseConfigured || !supabase) { setSession(null); setMode("auth"); return undefined; }
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const current = data.session || null;
      const rememberedLocal = getModeStorage()?.getItem(MODE_KEY) === "local";
      const canResumeLocal = Boolean(current && rememberedLocal && isDesktopPc());
      setSession(current); setMode(current ? (canResumeLocal ? "local" : "cloud") : "auth");
      if (!canResumeLocal) getModeStorage()?.removeItem(MODE_KEY);
    }).catch(() => { if (active) { setSession(null); setMode("auth"); } });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      setSession(nextSession || null);
      if (event === "PASSWORD_RECOVERY") { setRecovery(true); setMode("cloud"); return; }
      if (nextSession) {
        const keepLocal = modeRef.current === "local" && getModeStorage()?.getItem(MODE_KEY) === "local" && isDesktopPc();
        setMode(keepLocal ? "local" : "cloud");
      } else { getModeStorage()?.removeItem(MODE_KEY); setMode("auth"); }
    });
    return () => { active = false; subscription?.subscription?.unsubscribe?.(); };
  }, []);

  const login = async (email, password) => {
    setError(""); setNotice(""); setBusy(true);
    try { if (!supabase) throw new Error("Supabase no configurado"); const { error: signInError } = await supabase.auth.signInWithPassword({ email, password }); if (signInError) throw signInError; }
    catch (err) { setError(authMessage(err, "login")); }
    finally { setBusy(false); }
  };

  const register = async (name, dni, email, password) => {
    setError(""); setNotice("");
    const cleanName = String(name || "").trim();
    const cleanDni = String(dni || "").replace(/\D/g, "");
    if (cleanName.length < 3 || !cleanName.includes(" ")) { setError("Ingresá nombre y apellido."); return; }
    if (!/^[0-9]{6,10}$/.test(cleanDni)) { setError("Ingresá un DNI válido, sólo con números."); return; }
    const passwordError = passwordPolicyError(password);
    if (passwordError) { setError(passwordError); return; }
    setBusy(true);
    try {
      if (!supabase) throw new Error("Supabase no configurado");
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/`, data: { name: cleanName, dni: cleanDni } } });
      if (signUpError) throw signUpError;
      if (!data.session) setNotice("Cuenta creada. Revisá tu correo para confirmar el email y después ingresá.");
      else setNotice("Cuenta creada correctamente.");
    } catch (err) { setError(authMessage(err, "register")); }
    finally { setBusy(false); }
  };

  const resetPassword = async (email) => {
    setError(""); setNotice(""); setBusy(true);
    try { if (!supabase) throw new Error("Supabase no configurado"); const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/` }); if (resetError) throw resetError; setNotice("Te enviamos un correo de recuperación. Revisá también Spam/Correo no deseado."); }
    catch (err) { setError(authMessage(err, "reset")); }
    finally { setBusy(false); }
  };

  const updatePassword = async (password) => {
    setError(""); setNotice("");
    const passwordError = passwordPolicyError(password);
    if (passwordError) { setError(passwordError); return; }
    setBusy(true);
    try { const { error: updateError } = await supabase.auth.updateUser({ password }); if (updateError) throw updateError; setNotice("Contraseña actualizada correctamente."); setRecovery(false); }
    catch (err) { setError(authMessage(err, "password")); }
    finally { setBusy(false); }
  };

  const requestLocalMode = () => {
    setPinError("");
    if (!desktopPc) return;
    if (!session?.user?.id) { setError("El modo local requiere una sesión cloud iniciada previamente en esta PC."); return; }
    if (profile?.role !== "admin" || !profile?.is_master) { setError("El modo local está reservado exclusivamente para el Admin master."); return; }
    if (isOnline) { setError("El modo local de emergencia sólo se habilita cuando esta PC está sin Internet."); return; }
    setPinOpen(true);
  };

  const confirmLocalMode = async (pin) => {
    setPinError(""); setPinBusy(true);
    try {
      if (!desktopPc || !session?.user?.id) throw new Error("El modo local sólo está disponible en PC con una sesión cloud previa.");
      if (profile?.role !== "admin" || !profile?.is_master) throw new Error("El modo local está reservado exclusivamente para el Admin master.");
      if (isOnline) throw new Error("La conexión volvió. No es necesario usar el modo local.");
      if (await sha256(String(pin || "")) !== MASTER_PIN_SHA256) throw new Error("PIN maestro incorrecto.");
      const cached = await getCloudState(session.user.id).catch(() => null);
      if (!cached) throw new Error("Esta PC todavía no tiene una copia cloud. Iniciá sesión con Internet al menos una vez antes de usar el modo local.");
      await navigator.storage?.persist?.().catch(() => false); getModeStorage()?.setItem(MODE_KEY, "local"); setMode("local"); setPinOpen(false);
    } catch (err) { setPinError(err?.message || "No se pudo habilitar el modo local."); }
    finally { setPinBusy(false); }
  };

  const exitLocalMode = () => { getModeStorage()?.removeItem(MODE_KEY); setMode(session?.user ? "cloud" : "auth"); };
  const openCloudLogin = () => { getModeStorage()?.removeItem(MODE_KEY); setMode(session?.user ? "cloud" : "auth"); };
  const logout = async () => {
    if (session?.user?.id) { await unlinkPushSubscriptionBeforeLogout().catch(() => undefined); try { localStorage.removeItem("gymflow-access-display"); localStorage.removeItem("gymflow-access-input"); } catch { /* no-op */ } }
    await supabase?.auth.signOut({ scope: "local" }).catch(() => undefined); getModeStorage()?.removeItem(MODE_KEY); setSession(null); setProfile(null); setMode("auth");
  };

  if (mode === "loading" || session === undefined) return <div className="min-h-screen bg-[#050505]" />;
  if (recovery) return <PasswordRecovery onUpdatePassword={updatePassword} error={error} notice={notice} busy={busy} />;
  if (mode === "auth") return <AuthScreen onLogin={login} onRegister={register} onReset={resetPassword} error={error} notice={notice} busy={busy} />;

  const user = session?.user || null;
  if (user && profileLoading && !profile) return <div className="min-h-screen bg-[#050505]" />;
  if (user && profileError && !profile) return <main className="grid min-h-screen place-items-center bg-[#050505] p-4"><section className="w-full max-w-lg rounded-[24px] bg-white p-7 shadow-2xl"><h1 className="text-2xl font-black uppercase text-[#050505]">Actualización requerida</h1><p className="mt-3 text-sm leading-6 text-slate-500">{profileError}</p><button onClick={logout} className="btn-primary mt-5 w-full">Cerrar sesión</button></section></main>;

  const permissions = permissionsForRole(profile?.role);
  const value = { mode, session, user, profile, role: profile?.role || "cliente", permissions, refreshProfile, isCloud: mode === "cloud" && Boolean(user), isLocal: mode === "local" && Boolean(user), isOnline, canUseLocalMode: permissions.canUseLocalMode && Boolean(profile?.is_master) && desktopPc && Boolean(user) && !isOnline, requestLocalMode, exitLocalMode, logout, openCloudLogin };

  return <AuthContext.Provider value={value}>{children}<LocalPinModal open={pinOpen} onClose={() => setPinOpen(false)} onConfirm={confirmLocalMode} error={pinError} busy={pinBusy} /></AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
