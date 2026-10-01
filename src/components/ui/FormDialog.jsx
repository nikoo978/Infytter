"use client";
import { useContext, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import useAppBack, { BackDepth } from "../../hooks/useAppBack";

const dialogs = [];
let originalOverflow = "";

export default function FormDialog({ trigger, title, description, open, onOpenChange, children }) {
  const depth = useContext(BackDepth);
  useAppBack(open, () => onOpenChange?.(false), 300 + depth);
  const panel = useRef(null);
  const close = useRef(null);
  const change = useRef(onOpenChange);
  change.current = onOpenChange;
  useEffect(() => {
    if (!open) return;
    const token = {};
    const previousFocus = document.activeElement;
    if (!dialogs.length) { originalOverflow = document.body.style.overflow; document.body.style.overflow = "hidden"; }
    dialogs.push(token);
    close.current?.focus();
    const keydown = (event) => {
      if (dialogs.at(-1) !== token) return;
      // A fullscreen exercise has its own dialog and keyboard handling.
      const activeDialog = document.activeElement?.closest('[role="dialog"]');
      if (activeDialog && activeDialog !== panel.current) return;
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); change.current?.(false); }
      if (event.key !== "Tab") return;
      const targets = [...panel.current.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')].filter((element) => element.getClientRects().length);
      const first = targets[0]; const last = targets.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      dialogs.splice(dialogs.indexOf(token), 1);
      if (!dialogs.length) document.body.style.overflow = originalOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open]);
  const dialog = open && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 sm:grid sm:place-items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onOpenChange?.(false); }}>
      <section ref={panel} role="dialog" aria-modal="true" aria-label={title} className="flex max-h-[96dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:max-h-[90svh] sm:max-w-xl sm:rounded-3xl">
        <div className="shrink-0 border-b border-black/6 bg-white px-4 pb-4 pt-3 sm:px-6 sm:pt-6">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200 sm:hidden" />
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0"><h2 className="text-lg font-black leading-tight text-[#050505] sm:text-xl">{title}</h2>{description && <p className="mt-1 text-xs leading-5 text-slate-600 sm:text-sm">{description}</p>}</div>
            <button ref={close} type="button" onClick={() => onOpenChange?.(false)} className="grid size-11 shrink-0 place-items-center rounded-xl border border-black/10 text-xl text-slate-600" aria-label={`Cerrar ${title}`}>×</button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pb-6 sm:pt-5">{children}</div>
      </section>
    </div>;
  return <BackDepth.Provider value={depth + 1}>
    {trigger && <span onClick={() => onOpenChange?.(true)}>{trigger}</span>}
    {dialog && (typeof document === "undefined" ? dialog : createPortal(dialog, document.body))}
  </BackDepth.Provider>;
}
