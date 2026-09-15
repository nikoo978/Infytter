import { ArrowRight, CheckCircle2, Dumbbell, LineChart, Sparkles, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function EmailConfirmedWelcome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const displayName = String(user?.user_metadata?.name || "").trim();
  const firstName = displayName.split(/\s+/).filter(Boolean)[0] || "";

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#050505] px-4 py-8 text-white sm:grid sm:place-items-center sm:px-6">
      <div aria-hidden="true" className="pointer-events-none absolute -left-24 top-20 size-72 rounded-full bg-[#E30613]/25 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 bottom-10 size-80 rounded-full bg-[#E30613]/15 blur-3xl" />

      <section className="relative mx-auto w-full max-w-xl overflow-hidden rounded-[32px] border border-white/10 bg-white text-[#050505] shadow-2xl">
        <div className="bg-[#050505] px-6 pb-7 pt-6 text-white sm:px-8">
          <div className="flex items-center justify-between gap-4">
            <img src="/infytter-logo.svg" alt="Infytter Fitness" className="h-12 w-auto max-w-[190px] object-contain object-left" />
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-300/20">
              <CheckCircle2 className="size-7" />
            </span>
          </div>
          <p className="mt-7 text-[11px] font-black uppercase tracking-[0.22em] text-emerald-300">Email confirmado</p>
          <h1 className="mt-2 text-4xl font-black uppercase leading-[.95] sm:text-5xl">
            ¡Bienvenido{firstName ? `, ${firstName}` : ""}!
          </h1>
          <p className="mt-4 max-w-md text-sm font-medium leading-6 text-white/70 sm:text-base">
            Tu cuenta de Infytter ya está lista. Acabás de completar el primer paso de tu experiencia en el gimnasio.
          </p>
        </div>

        <div className="p-5 sm:p-8">
          <div className="flex items-start gap-3 rounded-2xl bg-red-50 p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#E30613] text-white"><Sparkles className="size-5" /></span>
            <div>
              <p className="text-sm font-black uppercase text-[#9E0710]">Ahora empieza lo bueno</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">Entrená, registrá tus avances y mirá cómo cambia tu historial con cada semana de constancia.</p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
            <div className="rounded-2xl border border-black/8 bg-slate-50 p-3 text-center">
              <Dumbbell className="mx-auto size-5 text-[#E30613]" />
              <p className="mt-2 text-[11px] font-black uppercase text-slate-800">Entrená</p>
              <p className="mt-1 text-[10px] leading-4 text-slate-500">Tus rutinas</p>
            </div>
            <div className="rounded-2xl border border-black/8 bg-slate-50 p-3 text-center">
              <LineChart className="mx-auto size-5 text-[#E30613]" />
              <p className="mt-2 text-[11px] font-black uppercase text-slate-800">Medí</p>
              <p className="mt-1 text-[10px] leading-4 text-slate-500">Tu progreso</p>
            </div>
            <div className="rounded-2xl border border-black/8 bg-slate-50 p-3 text-center">
              <Trophy className="mx-auto size-5 text-[#E30613]" />
              <p className="mt-2 text-[11px] font-black uppercase text-slate-800">Mejorá</p>
              <p className="mt-1 text-[10px] leading-4 text-slate-500">Cada sesión</p>
            </div>
          </div>

          <button type="button" onClick={() => navigate("/", { replace: true })} className="btn-primary mt-6 w-full py-3.5 text-sm">
            Entrar a Infytter <ArrowRight className="size-4" />
          </button>
          <p className="mt-4 text-center text-xs font-bold text-slate-400">Nos vemos en tu próximo entrenamiento.</p>
        </div>
      </section>
    </main>
  );
}
