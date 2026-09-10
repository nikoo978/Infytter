import "./polyfills/randomUUID";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import SiteApp from "./SiteApp";
import "../app/globals.css";

// La interfaz móvil usa controles propios y debe mantener la escala estable.
// El viewport cubre Android; estos eventos complementan iOS, que puede ignorar
// user-scalable=no para los gestos nativos de pellizco.
if (("ontouchstart" in window) || navigator.maxTouchPoints > 0) {
  const preventGesture = (event) => event.preventDefault();
  const preventMultiTouch = (event) => { if (event.touches?.length > 1) event.preventDefault(); };
  document.addEventListener("gesturestart", preventGesture, { passive: false });
  document.addEventListener("gesturechange", preventGesture, { passive: false });
  document.addEventListener("touchmove", preventMultiTouch, { passive: false });
}

// Registro temprano y no bloqueante. La pantalla de Notificaciones realiza su
// propia verificación con timeout, por lo que un fallo aquí nunca congela la UI.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch((error) => {
      console.warn("No se pudo registrar el Service Worker:", error);
    });
  }, { once: true });
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <SiteApp />
  </StrictMode>,
);
