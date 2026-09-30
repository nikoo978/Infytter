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
  return <svg viewBox={`${back ? 328 : 0} 0 328 614`} className="muscle-map__figure" role={interactive ? "group" : "img"} aria-label={`${back ? "Espalda" : "Frente"}, figura ${figure === "female" ? "femenina" : "masculina"}`}>
    <defs><clipPath id={`${id}-clip`}>{selectedArea && <path d={polygonPath(selectedArea)} />}</clipPath></defs>
    <image href={neutral} width="656" height="614" />
    {selected && plate && <image href={`/images/muscles/${figure}_muscle_${plate}.webp`} width="656" height="614" clipPath={selected === "Cuerpo completo" ? undefined : `url(#${id}-clip)`} />}
    {selectedArea && !plate && <path d={polygonPath(selectedArea)} fill="#e30613" opacity=".35" />}
    {interactive && paths.map(([name,area]) => <path key={name} d={polygonPath(area[side])} fill="transparent" stroke="transparent" className="anatomy-plate__target" role="button" tabIndex={0} aria-label={`Filtrar por ${name}`} aria-pressed={selected === name} onClick={() => onSelect(name)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(name); } }} onMouseEnter={() => onHover(name)} onMouseLeave={() => onHover("")} onFocus={() => onHover(name)} onBlur={() => onHover("")}><title>{name}</title></path>)}
  </svg>;
}
