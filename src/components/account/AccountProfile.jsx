import { Camera, KeyRound, LogOut, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { avatarUrl, changeAccountPassword, saveAvatar } from "../../services/accountProfile";
import { PASSWORD_POLICY_SUMMARY } from "../../services/passwordPolicy";
import { supabase } from "../../services/supabase";
import FormDialog from "../ui/FormDialog";

export default function AccountProfile({ name, email, preview = false }) {
  const { user, logout, isOnline } = useAuth();
  const [photo, setPhoto] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [needsCode, setNeedsCode] = useState(false);
  const fileInput = useRef(null);
  const disabled = preview || !isOnline;
  useEffect(() => {
    let active = true;
    if (!preview) avatarUrl(user?.user_metadata?.avatar_path, user?.id).then((url) => { if (active) setPhoto(url); }).catch(() => { if (active) setPhoto(""); });
    return () => { active = false; };
  }, [user?.id, user?.user_metadata?.avatar_path, preview]);

  const upload = async (event) => {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file || disabled) return;
    setPhotoBusy(true); setError(""); setNotice("");
    try { setPhoto(await saveAvatar(file, user)); setNotice("Foto de perfil actualizada."); }
    catch (err) { setError(err.message || "No se pudo guardar la foto. Intentá otra vez."); }
    finally { setPhotoBusy(false); }
  };
  const changePassword = async (event) => {
    event.preventDefault();
    if (disabled || passwordBusy) return;
    const form = new FormData(event.currentTarget);
    setPasswordBusy(true); setPasswordError("");
    try {
      await changeAccountPassword(form.get("current"), form.get("password"), form.get("confirmation"), form.get("nonce"));
      setPasswordOpen(false); setNotice("Contraseña actualizada correctamente.");
    } catch (err) {
      if (err.code === "reauthentication_needed") {
        const { error: codeError } = await supabase.auth.reauthenticate();
        if (!codeError) { setNeedsCode(true); setPasswordError("Ingresá el código que enviamos a tu correo para confirmar el cambio."); }
        else setPasswordError("No se pudo enviar el código. Intentá nuevamente.");
      } else setPasswordError(err.code === "invalid_credentials" ? "La contraseña actual es incorrecta." : err.message || "No se pudo cambiar la contraseña.");
    } finally { setPasswordBusy(false); }
  };
  return <div className="space-y-4">
    <section className="rounded-[26px] bg-white px-5 py-7 text-center shadow-sm">
      <h1 className="text-lg font-black text-slate-900">Mi perfil</h1>
      <div className="relative mx-auto mt-6 size-28">
        <div className="grid size-28 place-items-center overflow-hidden rounded-full border-4 border-white bg-slate-100 ring-2 ring-[#E30613]">
          {photo ? <img src={photo} alt={`Foto de ${name}`} className="size-full object-cover" onError={() => setPhoto("")} /> : <UserRound className="size-12 text-slate-400" aria-hidden="true" />}
        </div>
        <button type="button" aria-label="Cambiar foto de perfil" disabled={disabled || photoBusy} onClick={() => fileInput.current?.click()} className="absolute -bottom-1 -right-1 grid size-11 place-items-center rounded-full border-4 border-white bg-[#E30613] text-white disabled:opacity-50"><Camera className="size-5" /></button>
      </div>
      <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Elegir foto de perfil" className="sr-only" onChange={upload} disabled={disabled || photoBusy} />
      <h2 className="mt-5 break-words text-2xl font-black text-slate-900">{name}</h2>
      <p className="mt-1 break-all text-sm text-slate-500">{email}</p>
      <button type="button" disabled={disabled || photoBusy} onClick={() => fileInput.current?.click()} className="mt-3 min-h-11 px-3 text-sm font-bold text-[#E30613] disabled:opacity-50">{photoBusy ? "Guardando foto…" : "Cambiar foto"}</button>
      <p className="text-xs text-slate-400">JPG, PNG o WebP · hasta 5 MB</p>
    </section>
    {notice && <p role="status" className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{notice}</p>}
    {error && <p role="alert" className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</p>}
    <section className="rounded-[24px] bg-white p-4 shadow-sm">
      <h2 className="px-1 text-xs font-black uppercase tracking-wider text-slate-400">Seguridad de la cuenta</h2>
      <button type="button" disabled={disabled} onClick={() => { setPasswordError(""); setNotice(""); setNeedsCode(false); setPasswordOpen(true); }} className="mt-3 flex min-h-16 w-full items-center gap-3 rounded-2xl bg-slate-50 p-4 text-left disabled:opacity-50"><KeyRound className="size-5 shrink-0 text-[#E30613]" /><span><span className="block text-sm font-black">Cambiar contraseña</span><span className="mt-1 block text-xs text-slate-500">Actualizá tu acceso a Infytter</span></span></button>
      {disabled && <p className="mt-3 text-xs text-slate-500">{preview ? "Estas opciones están disponibles en tu cuenta real." : "Conectate a Internet para editar tu cuenta."}</p>}
    </section>
    {!preview && <button type="button" onClick={logout} className="btn-secondary min-h-12 w-full"><LogOut className="size-4" /> Cerrar sesión</button>}
    <FormDialog open={passwordOpen} onOpenChange={(open) => { if (!passwordBusy) setPasswordOpen(open); }} title="Cambiar contraseña" description={PASSWORD_POLICY_SUMMARY}>
      <form onSubmit={changePassword} className="grid gap-4">
        {[['current', 'Contraseña actual', 'current-password'], ['password', 'Nueva contraseña', 'new-password'], ['confirmation', 'Confirmar nueva contraseña', 'new-password']].map(([field, label, autocomplete]) => <label key={field} className="grid gap-2 text-sm font-bold text-slate-700">{label}<input name={field} type="password" autoComplete={autocomplete} required disabled={passwordBusy} className="h-12 min-w-0 rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-[#E30613]/20" /></label>)}
        {needsCode && <label className="grid gap-2 text-sm font-bold">Código enviado al correo<input name="nonce" autoComplete="one-time-code" required className="h-12 rounded-xl border border-slate-200 px-3" /></label>}
        {passwordError && <p role="alert" className="text-sm font-bold text-red-700">{passwordError}</p>}
        <button disabled={passwordBusy} className="btn-primary min-h-12 w-full">{passwordBusy ? "Guardando…" : "Guardar contraseña"}</button>
      </form>
    </FormDialog>
  </div>;
}
