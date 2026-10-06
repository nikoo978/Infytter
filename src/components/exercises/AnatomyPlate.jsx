import { useId } from "react";

// Front/back plates share the 656 × 614 coordinate system supplied by the gym.
// Hit areas align to the real image; limb highlights are clipped to one group.
const AREAS = {
  Cuello: { front: "125,85 195,85 206,120 113,120", back: "463,87 526,87 536,125 451,125" },
  Hombros: { front: "69,123 112,114 124,156 69,179 M198,119 245,125 252,179 205,161", back: "406,135 449,124 466,163 405,186 M530,127 576,140 582,182 540,166" },
  Pecho: { front: "108,125 206,125 227,185 91,185" },
  Core: { front: "107,183 209,183 207,306 104,306" },
  Espalda: { back: "444,109 543,109 560,271 432,271" },
  Bíceps: { front: "60,174 91,169 102,226 50,240 M216,174 246,171 268,231 228,237" },
  Tríceps: { back: "401,177 441,172 440,241 383,249 M548,178 585,185 606,249 559,247" },
  Antebrazos: { front: "38,225 85,220 67,288 25,300 M233,223 275,225 294,303 257,287", back: "375,237 423,233 395,303 353,319 M573,235 612,248 640,319 599,308" },
  Glúteos: { back: "439,260 551,260 552,338 438,338" },
  Cuádriceps: { front: "99,301 220,301 217,435 99,435" },
  Isquiotibiales: { back: "439,333 551,333 552,442 436,442" },
  Gemelos: { back: "435,441 553,441 551,503 437,503" },
  Cadera: { front: "100,273 220,273 220,328 99,328" },
};
const PLATES = { Espalda: "01", Hombros: "02", Pecho: "04", Core: "05", Glúteos: "06", "Cuerpo completo": "08", Bíceps: "03", Tríceps: "03", Antebrazos: "03", Cuádriceps: "07", Isquiotibiales: "07", Gemelos: "07" };

function polygonPath(points) {
  return points.split(" M").map((part) => `M${part.trim()}Z`).join(" ");
}

export default function AnatomyPlate({ gender = "male", back = false, selected = "", interactive = false, onSelect = () => {}, onHover = () => {} }) {
  const id = useId().replace(/:/g, "");
  const figure = gender === "female" ? "female" : "male";
  const side = back ? "back" : "front";
  const neutral = `/images/muscles/${figure}_muscle_00.webp`;
  const paths = Object.entries(AREAS).filter(([,area]) => area[side]);
  const selectedArea = AREAS[selected]?.[side];
  const plate = PLATES[selected];
  // Each viewport must hide the unused half of the combined plate.
  // Otherwise the back image paints over the front highlight.
  return <svg overflow="hidden" style={{ overflow: "hidden" }} viewBox={`${back ? 328 : 0} 0 328 614`} className="muscle-map__figure" role={interactive ? "group" : "img"} aria-label={`${back ? "Espalda" : "Frente"}, figura ${figure === "female" ? "femenina" : "masculina"}`}>
    <defs>
      <clipPath id={`${id}-viewport`} clipPathUnits="userSpaceOnUse"><rect x={back ? 328 : 0} y="0" width="328" height="614" /></clipPath>
      <clipPath id={`${id}-clip`}>{selectedArea && <path d={polygonPath(selectedArea)} />}</clipPath>
      {figure === "female" && <>
        {/* Preserve the original muscle coordinates; only replace heads and add matching white outlines. */}
        <mask id={`${id}-heads`} maskUnits="userSpaceOnUse" x="0" y="0" width="656" height="614">
          <rect width="656" height="614" fill="white" />
          <rect x="113" y="0" width="94" height="95" fill="black" />
          <rect x="450" y="0" width="92" height="79" fill="black" />
        </mask>
        <mask id={`${id}-waist`} maskUnits="userSpaceOnUse" x="0" y="0" width="656" height="614">
          <rect width="656" height="614" fill="white" />
          <path d="M100 190 L116 190 Q149 230 109 270 L100 270 Z M220 190 L203 190 Q170 230 210 270 L220 270 Z" fill="black" />
          <path d="M434 170 L446 170 C450 190 465 210 463 230 C462 241 451 245 444 260 L434 260 Z M557 170 L545 170 C541 190 526 210 528 230 C529 241 540 245 547 260 L557 260 Z" fill="black" />
        </mask>
        <filter id={`${id}-outline`} colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
          <feMorphology in="SourceAlpha" operator="dilate" radius="1.3" result="outline" />
          <feFlood floodColor="white" />
          <feComposite in2="outline" operator="in" />
          <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </>}
    </defs>
    <g clipPath={`url(#${id}-viewport)`}>
    <g mask={figure === "female" ? `url(#${id}-waist)` : undefined}>
    <g mask={figure === "female" ? `url(#${id}-heads)` : undefined} filter={figure === "female" ? `url(#${id}-outline)` : undefined}>
      <image href={neutral} width="656" height="614" />
      {selected && plate && <image href={`/images/muscles/${figure}_muscle_${plate}.webp`} width="656" height="614" clipPath={selected === "Cuerpo completo" ? undefined : `url(#${id}-clip)`} />}
    </g>
    {figure === "female" && <g aria-hidden="true" fill="#c0c0c0" stroke="white" strokeWidth="2.5" strokeLinejoin="round">
      {/* Hair follows the same neutral, faceless drawing style. */}
      <path data-anatomy-hair="front" d="M160 5 C134 5 124 24 126 51 L124 70 Q124 85 115 93 Q129 98 140 87 L180 87 Q191 98 205 93 Q196 85 196 70 L194 51 C196 24 186 5 160 5 Z" />
      <path data-anatomy-hair="back" d="M495 5 C468 5 458 25 460 49 L458 70 Q458 85 449 93 Q462 99 476 88 Q495 82 514 88 Q528 99 541 93 Q532 85 532 70 L530 49 C532 25 522 5 495 5 Z" />
      <path d="M160 8 C139 8 131 24 132 47 C125 45 127 65 136 66 C139 82 149 92 160 94 C172 92 182 82 185 66 C194 65 196 45 188 47 C189 24 181 8 160 8 Z" />
    </g>}
    {figure === "female" && <g aria-hidden="true" fill="none" stroke="white" strokeWidth="2.5">
      <path d="M116 190 Q149 230 109 270 M203 190 Q170 230 210 270 M446 170 C450 190 465 210 463 230 C462 241 451 245 444 260 M545 170 C541 190 526 210 528 230 C529 241 540 245 547 260" />
    </g>}
    {selectedArea && !plate && <path d={polygonPath(selectedArea)} fill="#e30613" opacity=".35" />}
    {interactive && paths.map(([name,area]) => <path key={name} d={polygonPath(area[side])} fill="transparent" stroke="transparent" className="anatomy-plate__target" role="button" tabIndex={0} aria-label={`Filtrar por ${name}`} aria-pressed={selected === name} onClick={() => onSelect(name)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(name); } }} onMouseEnter={() => onHover(name)} onMouseLeave={() => onHover("")} onFocus={() => onHover(name)} onBlur={() => onHover("")}><title>{name}</title></path>)}
    </g>
    </g>
  </svg>;
}
