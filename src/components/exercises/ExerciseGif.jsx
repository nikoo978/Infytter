import { Image as ImageIcon, Maximize2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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

function FullscreenGif({ url, alt, onClose }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => { if (event.key === "Escape") onClose(); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label={alt} className="fixed inset-0 z-[140] grid place-items-center bg-black/95 p-3 sm:p-6" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <button type="button" onClick={onClose} className="absolute right-3 top-[max(.75rem,env(safe-area-inset-top))] grid size-12 place-items-center rounded-2xl bg-white text-black shadow-xl sm:right-6" aria-label="Cerrar pantalla completa"><X className="size-6" /></button>
      <img src={url} alt={alt} className="max-h-[calc(100dvh-5.5rem)] max-w-full rounded-2xl bg-white object-contain shadow-2xl" />
    </div>
  );
}

function GifUnavailable() {
  return <div className="grid min-h-36 place-items-center p-5 text-center text-slate-400"><div><ImageIcon className="mx-auto size-8" /><p className="mt-2 text-xs font-bold">GIF no disponible</p></div></div>;
}
