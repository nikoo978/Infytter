import { ArrowRight, CheckCircle2, Dumbbell, LineChart, Sparkles, TriangleAlert, Trophy } from "lucide-react";
import { emailConfirmationResult } from "../../services/emailConfirmation";

export default function EmailConfirmedWelcome() {
  const result = emailConfirmationResult();
  const confirmed = result.status === "success";
  const failed = result.status === "error";

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#050505] px-4 py-8 text-white sm:grid sm:place-items-center sm:px-6">
      <div aria-hidden="true" className="pointer-events-none absolute -left-24 top-20 size-72 rounded-full bg-[#E30613]/25 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 bottom-10 size-80 rounded-full bg-[#E30613]/15 blur-3xl" />

      <section className="relative mx-auto w-full max-w-xl overflow-hidden rounded-[32px] border border-white/10 bg-white text-[#050505] shadow-2xl">
        <div className="bg-[#050505] px-6 pb-8 pt-6 text-white sm:px-8">
          <div className="flex items-center justify-between gap-4">
            <img src="/infytter-logo.svg" alt="Infytter Fitness" className="h-12 w-auto max-w-[190px] object-contain object-left" />
            <span className={`grid size-12 shrink-0 place-items-center rounded-2xl ring-1 ${failed ? "bg-amber-400/15 text-amber-300 ring-amber-300/20" : "bg-emerald-400/15 text-emerald-300 ring-emerald-300/20"}`}>
              {failed ? <TriangleAlert className="size-7" /> : <CheckCircle2 className="size-7" />}
            </span>
          </div>

          {confirmed ? <>
            <p className="mt-7 text-[11px] font-black uppercase tracking-[0.22em] text-emerald-300">Cuenta activada</p>
            <h1 className="mt-2 text-4xl font-black uppercase leading-[.95] sm:text-5xl">¡BIENVENIDO!</h1>
            <p className="mt-4 text-xl font-black uppercase leading-tight text-white sm:text-2xl">¡SU MAIL HA SIDO CONFIRMADO!</p>
            <p className="mt-4 max-w-md text-sm font-medium leading-6 text-white/70 sm:text-base">Tu cuenta de Infytter ya está lista. Desde ahora podés ingresar y empezar a usar tu experiencia personalizada del gimnasio.</p>
          </> : failed ? <>
            <p className="mt-7 text-[11px] font-black uppercase tracking-[0.22em] text-amber-300">No se pudo confirmar</p>
            <h1 className="mt-2 text-4xl font-black uppercase leading-[.95] sm:text-5xl">REVISÁ EL ENLACE</h1>
            <p className="mt-4 max-w-md text-sm font-medium leading-6 text-white/70 sm:text-base">{result.message}</p>
          </> : <>
            <p className="mt-7 text-[11px] font-black uppercase tracking-[0.22em] text-white/60">Infytter Fitness</p>
            <h1 className="mt-2 text-4xl font-black uppercase leading-[.95] sm:text-5xl">CONFIRMACIÓN DE MAIL</h1>
            <p className="mt-4 max-w-md text-sm font-medium leading-6 text-white/70 sm:text-base">Abrí esta pantalla desde el botón de confirmación que recibiste por email para completar el alta.</p>
          </>}
        </div>

        <div className="p-5 sm:p-8">
          {confirmed ? <>
            <div className="flex items-start gap-3 rounded-2xl bg-red-50 p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#E30613] text-white"><Sparkles className="size-5" /></span>
              <div>
                <p className="text-sm font-black uppercase text-[#9E0710]">Ahora empieza lo bueno</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">Entrená, registrá tus avances y mirá tu progreso crecer con cada sesión.</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
              <div className="rounded-2xl border border-black/8 bg-slate-50 p-3 text-center"><Dumbbell className="mx-auto size-5 text-[#E30613]" /><p className="mt-2 text-[11px] font-black uppercase text-slate-800">Entrená</p><p className="mt-1 text-[10px] leading-4 text-slate-500">Tus rutinas</p></div>
              <div className="rounded-2xl border border-black/8 bg-slate-50 p-3 text-center"><LineChart className="mx-auto size-5 text-[#E30613]" /><p className="mt-2 text-[11px] font-black uppercase text-slate-800">Medí</p><p className="mt-1 text-[10px] leading-4 text-slate-500">Tu progreso</p></div>
              <div className="rounded-2xl border border-black/8 bg-slate-50 p-3 text-center"><Trophy className="mx-auto size-5 text-[#E30613]" /><p className="mt-2 text-[11px] font-black uppercase text-slate-800">Mejorá</p><p className="mt-1 text-[10px] leading-4 text-slate-500">Cada sesión</p></div>
            </div>
          </> : null}

          <button type="button" onClick={() => window.location.assign("/")} className="btn-primary mt-6 w-full py-3.5 text-sm">
            {confirmed ? "Entrar a Infytter" : "Volver al acceso"} <ArrowRight className="size-4" />
          </button>
          {confirmed && <p className="mt-4 text-center text-xs font-bold text-slate-400">Nos vemos en tu próximo entrenamiento.</p>}
        </div>
      </section>
    </main>
  );
}
