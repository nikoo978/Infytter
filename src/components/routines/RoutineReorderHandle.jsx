import { GripVertical } from "lucide-react";
import { useEffect, useRef } from "react";

export default function RoutineReorderHandle({ index, name, listRef, onTarget, onDrop, disabled }) {
  const drag = useRef(null);
  const frame = useRef(0);
  const callbacks = useRef({ onTarget, onDrop });
  callbacks.current = { onTarget, onDrop };
  const findTarget = () => {
    const current = drag.current;
    if (!current) return;
    const row = document.elementFromPoint(current.x, current.y)?.closest('[data-routine-position]');
    current.target = row && listRef.current?.contains(row) ? Number(row.dataset.routinePosition) : null;
    callbacks.current.onTarget(current.target);
  };
  const scroll = () => {
    const current = drag.current;
    if (!current) return;
    const bounds = current.scroller === document.scrollingElement ? { top: 0, bottom: innerHeight } : current.scroller.getBoundingClientRect();
    const delta = current.y < bounds.top + 64 ? -10 : current.y > bounds.bottom - 64 ? 10 : 0;
    if (delta) { current.scroller.scrollBy(0, delta); findTarget(); }
    frame.current = requestAnimationFrame(scroll);
  };
  useEffect(() => () => { drag.current = null; cancelAnimationFrame(frame.current); }, []);
  const finish = (cancelled = false) => {
    const current = drag.current;
    drag.current = null; cancelAnimationFrame(frame.current);
    callbacks.current.onTarget(null);
    if (!cancelled && current?.target != null) callbacks.current.onDrop(index, current.target);
  };
  return <button type="button" disabled={disabled} aria-label={`Arrastrar ${name} para cambiar el orden`} title="Arrastrá para ordenar; también podés usar las flechas o elegir la posición" className="routine-grip grid size-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500" style={{ touchAction: "none" }}
    onPointerDown={(event) => {
      if (event.button !== 0 || !event.isPrimary) return;
      event.preventDefault();
      let scroller = listRef.current?.parentElement;
      while (scroller && !(scroller.scrollHeight > scroller.clientHeight && /auto|scroll/.test(getComputedStyle(scroller).overflowY))) scroller = scroller.parentElement;
      drag.current = { x: event.clientX, y: event.clientY, target: index, scroller: scroller || document.scrollingElement };
      event.currentTarget.setPointerCapture(event.pointerId); callbacks.current.onTarget(index);
      frame.current = requestAnimationFrame(scroll);
    }}
    onPointerMove={(event) => { if (drag.current) { drag.current.x = event.clientX; drag.current.y = event.clientY; findTarget(); } }}
    onPointerUp={() => finish()} onPointerCancel={() => finish(true)} onLostPointerCapture={() => { if (drag.current) finish(true); }}><GripVertical className="size-5" /></button>;
}
