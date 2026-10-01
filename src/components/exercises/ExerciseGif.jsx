import useAppBack from "../../hooks/useAppBack";
import { Image as ImageIcon, Maximize2, Minus, Plus, RotateCcw, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const CLOUDINARY_GIF_BASE = "https://res.cloudinary.com/po0pnxfc/image/upload/";

export function exerciseGifCandidates(exercise) {
  const candidates = [];

  for (const url of exercise?.variant_image_urls || []) {
    const value = String(url || "").trim();
    if (value) candidates.push(value);
  }

  const imageUrl = String(exercise?.image_url || "").trim();
  if (imageUrl) candidates.push(imageUrl);

  for (const code of exercise?.library_codes || []) {
    const normalized = Number(code);
    if (Number.isInteger(normalized) && normalized > 0) {
      candidates.push(`${CLOUDINARY_GIF_BASE}${normalized}.gif`);
    }
  }

  return [...new Set(candidates)];
}

export default function ExerciseGif({ exercise, className = "max-h-64 w-full object-contain" }) {
  const candidates = useMemo(() => exerciseGifCandidates(exercise), [exercise?.image_url, exercise?.library_codes, exercise?.variant_image_urls]);
  const signature = candidates.join("|");
  const [index, setIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => { setIndex(0); setFullscreen(false); }, [signature]);

  if (!candidates.length || index >= candidates.length) {
    return <GifUnavailable />;
  }

  const url = candidates[index];
  const alt = `Demostración de ${exercise?.name || "ejercicio"}`;
  return <><GifButton url={url} alt={alt} className={className} onOpen={() => setFullscreen(true)} onError={() => setIndex((value) => value + 1)} />{fullscreen && <FullscreenGif url={url} alt={alt} onClose={() => setFullscreen(false)} />}</>;
}

export function ExerciseGifGallery({ exercise, className = "max-h-64 w-full object-contain" }) {
  const candidates = useMemo(() => exerciseGifCandidates(exercise), [exercise?.image_url, exercise?.library_codes, exercise?.variant_image_urls]);
  const signature = candidates.join("|");
  const [failed, setFailed] = useState(() => new Set());
  const [fullscreenUrl, setFullscreenUrl] = useState("");

  useEffect(() => { setFailed(new Set()); setFullscreenUrl(""); }, [signature]);

  const visible = candidates.filter((url) => !failed.has(url));
  if (!visible.length) return <GifUnavailable />;

  const alt = `Demostración de ${exercise?.name || "ejercicio"}`;
  return (
    <>
      <div className={`grid gap-2 ${visible.length > 1 ? "grid-cols-1 min-[420px]:grid-cols-2" : "grid-cols-1"}`}>
        {visible.map((url) => (
          <GifButton
            key={url}
            url={url}
            alt={alt}
            className={className}
            onOpen={() => setFullscreenUrl(url)}
            onError={() => setFailed((current) => new Set([...current, url]))}
          />
        ))}
      </div>
      {fullscreenUrl && <FullscreenGif url={fullscreenUrl} alt={alt} onClose={() => setFullscreenUrl("")} />}
    </>
  );
}

function GifButton({ url, alt, className, onOpen, onError }) {
  return (
    <button type="button" onClick={onOpen} className="group relative block w-full overflow-hidden rounded-2xl bg-slate-100 text-left" aria-label={`${alt}. Abrir en pantalla completa`} aria-haspopup="dialog">
      <img src={url} alt={alt} className={className} loading="lazy" decoding="async" onError={onError} />
      <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-xl bg-black/75 px-2.5 py-1.5 text-[10px] font-black text-white shadow-sm backdrop-blur-sm"><Maximize2 className="size-3.5" /> Ampliar</span>
    </button>
  );
}

export function FullscreenGif({ url, alt, onClose }) {
  useAppBack(true, onClose, 1000);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const pointers = useRef(new Map());
  const gesture = useRef(null);
  const surface = useRef(null);
  const close = useRef(null);
  const dialog = useRef(null);
  const clamp = (value) => Math.min(4, Math.max(1, value));
  const changeZoom = (value) => { const next = clamp(value); setZoom(next); if (next === 1) setPan({ x: 0, y: 0 }); };
  const point = (event) => ({ x: event.clientX, y: event.clientY });
  const snapshot = () => {
    const pts = [...pointers.current.values()];
    gesture.current = { pts, zoom, pan, distance: pts.length > 1 ? Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) : 0 };
  };
  const start = (event) => { surface.current?.setPointerCapture(event.pointerId); pointers.current.set(event.pointerId, point(event)); snapshot(); };
  const move = (event) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, point(event));
    const pts = [...pointers.current.values()]; const initial = gesture.current;
    if (!initial) return;
    if (pts.length > 1 && initial.distance > 0) {
      changeZoom(initial.zoom * Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) / initial.distance);
    } else if (pts.length === 1 && zoom > 1) {
      const bounds = surface.current?.getBoundingClientRect();
      const limitX = (bounds?.width || 300) * (zoom - 1) / 2;
      const limitY = (bounds?.height || 500) * (zoom - 1) / 2;
      setPan({ x: Math.max(-limitX, Math.min(limitX, initial.pan.x + pts[0].x - initial.pts[0].x)), y: Math.max(-limitY, Math.min(limitY, initial.pan.y + pts[0].y - initial.pts[0].y)) });
    }
  };
  const end = (event) => { pointers.current.delete(event.pointerId); snapshot(); };
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") { event.stopPropagation(); onClose(); }
      if (event.key !== "Tab") return;
      const buttons = [...dialog.current.querySelectorAll("button:not(:disabled)")];
      const first = buttons[0]; const last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.body.style.overflow = "hidden";
    close.current?.focus();
    window.addEventListener("keydown", closeOnEscape);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", closeOnEscape); previousFocus?.focus?.(); };
  }, [onClose]);
  return <div ref={dialog} role="dialog" aria-modal="true" aria-label={alt} className="fixed inset-0 z-[140] flex flex-col bg-[#090b0f] text-white">
    <div className="flex shrink-0 items-center justify-between gap-3 p-3 pt-[max(.75rem,env(safe-area-inset-top))]">
      <p className="min-w-0 text-sm font-bold">{alt}</p>
      <button ref={close} type="button" onClick={onClose} className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/15" aria-label="Cerrar pantalla completa"><X /></button>
    </div>
    <div ref={surface} data-exercise-zoom className="relative grid min-h-0 flex-1 place-items-center overflow-hidden p-3" style={{ touchAction: "none" }} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onWheel={(event) => changeZoom(zoom + (event.deltaY < 0 ? .2 : -.2))}>
      <img src={url} alt={alt} draggable={false} className="max-h-full max-w-full select-none rounded-xl bg-white object-contain" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, pointerEvents: "none" }} />
    </div>
    <div className="shrink-0 p-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-center gap-3">
        <button type="button" onClick={() => changeZoom(zoom - .5)} disabled={zoom === 1} aria-label="Reducir zoom" className="grid size-11 place-items-center rounded-xl bg-white/15 disabled:opacity-30"><Minus /></button>
        <output aria-label="Nivel de zoom" className="w-16 text-center font-bold">{Math.round(zoom * 100)}%</output>
        <button type="button" onClick={() => changeZoom(zoom + .5)} disabled={zoom === 4} aria-label="Aumentar zoom" className="grid size-11 place-items-center rounded-xl bg-white/15 disabled:opacity-30"><Plus /></button>
        <button type="button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} aria-label="Restablecer zoom" className="grid size-11 place-items-center rounded-xl bg-white/15"><RotateCcw /></button>
      </div>
      <p className="mt-3 text-center text-xs text-white/60">Pellizcá para ampliar. Arrastrá para mover la imagen.</p>
    </div>
  </div>;
}

function GifUnavailable() {
  return <div className="grid min-h-36 place-items-center p-5 text-center text-slate-400"><div><ImageIcon className="mx-auto size-8" /><p className="mt-2 text-xs font-bold">GIF no disponible</p></div></div>;
}
