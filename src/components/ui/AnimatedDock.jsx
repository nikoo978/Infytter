export default function AnimatedDock({ label, count, activeIndex, children, className = "" }) {
  return <nav aria-label={label} className={`animated-dock ${className}`} style={{ "--dock-count": count, "--dock-index": Math.max(0, activeIndex), gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
    <span aria-hidden="true" className="animated-dock__indicator" style={{ opacity: activeIndex < 0 ? 0 : 1 }} />
    {children}
  </nav>;
}
