import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import useAppBack from "../../hooks/useAppBack";

export default function CollapsibleSection({ title, count, description, icon: Icon, actions, children, collapsible = true, className = "rounded-[22px] bg-white p-4 shadow-sm" }) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  useAppBack(collapsible && expanded, () => setExpanded(false), 10);
  const heading = <><span className="flex min-w-0 flex-1 items-center gap-2">{Icon && <Icon aria-hidden="true" className="size-5 shrink-0 text-[#E30613]" />}<span className="min-w-0"><span role="heading" aria-level="3" className="block text-sm font-black">{title}{count != null && <span className="ml-2 text-xs font-bold opacity-60">({count})</span>}</span>{description && <span className="mt-1 block text-[11px] font-normal opacity-60">{description}</span>}</span></span>{collapsible && <ChevronDown aria-hidden="true" className={`size-5 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />}</>;
  return <section className={className}>
    <div className="flex items-center gap-3">
      {collapsible ? <button type="button" aria-label={title} aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded((value) => !value)} className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left">{heading}</button> : <div className="flex min-w-0 flex-1 items-center gap-3">{heading}</div>}
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
    <div id={id} hidden={collapsible && !expanded} className="mt-3">{children}</div>
  </section>;
}
