"use client";

import { useSyncExternalStore } from "react";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import EmailConfirmedWelcome from "./components/auth/EmailConfirmedWelcome";
import { AuthProvider } from "./context/AuthContext";
import { GymProvider } from "./context/GymContext";

export default function SiteApp() {
  const mounted = useSyncExternalStore(() => () => undefined, () => true, () => false);

  if (!mounted) {
    return <div className="min-h-screen bg-[#050505]" aria-label="Cargando aplicación" />;
  }

  // La confirmación de email debe verse aunque la sesión todavía no se haya
  // restaurado en este navegador. Supabase confirma primero el correo y luego
  // redirige a esta ruta; el usuario entra a la app desde el botón final.
  if (window.location.pathname === "/bienvenido") return <EmailConfirmedWelcome />;

  return (
    <BrowserRouter>
      <AuthProvider><GymProvider><App /></GymProvider></AuthProvider>
    </BrowserRouter>
  );
}
