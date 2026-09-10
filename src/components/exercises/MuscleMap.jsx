import { useState } from "react";
import "./muscle-map.css";

// Original, purpose-built SVG anatomy diagram. Coordinates are shared by the
// visible muscles and their hit targets; no image overlay or remote asset.
const MIRROR = "translate(260 0) scale(-1 1)";

function Pair({ children }) {
  return <>{children}<g transform={MIRROR}>{children}</g></>;
}

function Muscle({ name, selected, onSelect, onHover, children }) {
  const active = selected === name;
  return (
    <g
      className={`muscle-map__region${active ? " is-selected" : ""}`}
      role="button"
      tabIndex={0}
      aria-label={`Filtrar por ${name}`}
      aria-pressed={active}
      onClick={() => onSelect(name)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(name);
        }
      }}
      onMouseEnter={() => onHover(name)}
      onMouseLeave={() => onHover("")}
      onFocus={() => onHover(name)}
      onBlur={() => onHover("")}
    >
      <title>{name}</title>
      {children}
    </g>
  );
}

function Head({ female, back }) {
  return (
    <g className="muscle-map__body">
      {female && <path d="M105 86 C94 72 97 57 98 41 C99 17 113 9 130 9 C150 9 163 22 163 45 C163 64 158 78 153 87 L146 72 112 72Z" />}
      <path d={back
        ? "M107 68 C101 62 101 44 103 34 C105 17 117 13 130 13 C145 13 156 23 157 39 C158 53 156 65 151 71 L144 82 116 82Z"
        : "M107 43 C104 38 105 27 110 23 C116 14 128 13 138 16 C152 16 157 29 154 43 C161 39 160 60 153 62 C150 73 142 81 130 85 C118 81 110 73 107 62 C100 60 99 39 107 43Z"} />
      {!back && <path className="muscle-map__line" d={female
        ? "M105 45 C110 31 115 31 118 25 C128 39 144 35 155 48 M118 25 Q134 26 148 35"
        : "M107 43 L109 30 Q130 37 149 29 L154 43"} />}
      {back && <path className="muscle-map__line" d="M111 77 Q115 66 119 68 L126 69 131 65 Q141 65 149 78" />}
    </g>
  );
}

export function AnatomyFigure({ gender, back = false, detailed = false, selected = "", onSelect = () => {}, onHover = () => {} }) {
  const female = gender === "female";
  const shoulder = female ? 81 : 73;
  const waist = female ? 108 : 100;
  const hip = female ? 81 : 87;
  const armShift = female ? 5 : 0;
  const region = (name, children) => <Muscle name={name} selected={selected} onSelect={onSelect} onHover={onHover}>{children}</Muscle>;

  return (
    <svg viewBox="0 0 260 600" className="muscle-map__figure" role="group" aria-label={`${back ? "Espalda" : "Frente"}, figura ${female ? "femenina" : "masculina"}`}>
      <Head female={female} back={back} />
      <g className="muscle-map__body">
        <path d={`M115 78 L113 96 Q102 103 ${shoulder} 110 Q${shoulder - 10} 117 ${shoulder + 1} 151 L89 180 Q${waist - 2} 213 ${waist} 236 Q${waist - 3} 252 ${hip} 274 C${hip - 6} 298 ${hip - 4} 328 ${hip + 2} 357 L96 413 Q98 430 94 444 C87 466 90 490 94 513 L95 549 Q90 561 83 569 Q80 577 91 578 L111 577 Q117 576 116 570 L113 548 L114 506 Q125 464 115 439 L114 421 Q120 384 124 348 L130 322 L136 348 Q140 384 146 421 L145 439 Q135 464 146 506 L147 548 Q143 568 144 573 Q145 579 153 578 L170 578 Q181 577 177 570 Q170 561 165 549 L166 513 C170 490 173 466 166 444 Q162 430 164 413 L${260 - hip - 2} 357 C${264 - hip} 328 ${266 - hip} 298 ${260 - hip} 274 Q${263 - waist} 252 ${260 - waist} 236 Q${262 - waist} 213 171 180 L${259 - shoulder} 151 Q${270 - shoulder} 117 ${260 - shoulder} 110 Q158 103 147 96 L145 78`} />
        <Pair>
          <path transform={`translate(${armShift} 0)`} d="M77 114 Q60 112 56 134 C51 151 51 167 43 190 L38 207 Q28 220 24 242 L15 270 Q10 277 10 287 L9 302 Q10 306 13 301 L17 286 L16 311 Q18 316 21 310 L25 288 L24 311 Q27 315 29 307 L34 284 Q41 284 42 274 L36 263 Q42 242 50 228 L58 210 Q69 197 73 182 L83 154Z" />
        </Pair>
      </g>

      {region("Cuello", <Pair><path d={`M115 82 L113 97 ${back ? `Q104 103 ${shoulder + 6} 110 L115 109 Q122 108 127 105` : "L124 112 127 107"} L121 86Z`} /></Pair>)}

      {region("Hombros", <Pair><path d={`M${shoulder} 112 Q${shoulder - 13} 114 ${shoulder - 16} 128 L${shoulder - 20} 152 Q${shoulder - 7} 151 ${shoulder + 7} 136 L${shoulder + 18} 119 Q${shoulder + 9} 112 ${shoulder} 112Z`} /></Pair>)}

      {back ? <>
        {region("Espalda", <>
          <path d={`M${shoulder + 13} 113 Q130 102 ${247 - shoulder} 113 L147 126 130 133 113 126Z`} />
          <path d="M113 129 Q130 137 147 129 L140 169 Q136 188 130 193 Q124 188 120 169Z" />
          <Pair>
            <path d={`M${shoulder + 12} 121 L110 133 Q116 160 120 181 L125 196 Q114 204 ${waist + 1} 227 L${waist - 1} 241 Q${waist - 8} 221 94 198 L86 171 Q81 152 ${shoulder + 12} 121Z`} />
            <path d={`M126 201 Q118 216 ${waist + 4} 240 L${hip + 10} 268 Q111 262 129 274 L129 210Z`} />
          </Pair>
        </>)}
        {region("Glúteos", <Pair><path d={`M${hip + 10} 270 Q112 263 127 277 L128 308 Q125 327 111 330 C${hip + 3} 331 ${hip - 2} 310 ${hip + 1} 292 Q${hip + 2} 278 ${hip + 10} 270Z`} /></Pair>)}
        {region("Isquiotibiales", <Pair><path d={`M${hip + 2} 320 Q108 339 126 320 Q123 352 118 381 L112 414 Q109 422 105 413 L102 399 Q99 405 96 413 L94 391 Q${hip - 1} 353 ${hip + 2} 320Z`} /></Pair>)}
        {region("Gemelos", <Pair>
          <path d="M100 437 Q95 444 94 457 C90 474 92 493 100 500 Q107 500 110 489 Q116 465 108 441 L104 448Z" />
          <path d="M109 442 Q122 462 116 484 Q114 494 111 497 L108 488 Q113 465 109 442Z" />
        </Pair>)}
      </> : <>
        {region("Pecho", <Pair><path d={`M${shoulder + 22} 116 Q111 108 128 116 L128 153 C127 169 112 178 98 172 Q88 169 85 153 L${shoulder + 22} 116Z`} /></Pair>)}
        {region("Core", <>
          <Pair>
            <path d="M128 177 Q114 173 108 184 L109 202 128 204Z" />
            <path d="M109 207 L128 209 128 229 109 227Z" />
            <path d="M110 232 L128 234 128 254 112 251Z" />
            <path d="M113 256 L128 259 128 292 Q119 282 116 274Z" />
            <path d={`M91 179 Q99 185 104 199 L${waist + 1} 237 109 256 119 285 Q${hip + 9} 266 ${waist - 2} 240 Q${waist - 7} 212 91 179Z`} />
          </Pair>
        </>)}
        {region("Cadera", <Pair><path d={`M${waist - 4} 247 Q${waist - 8} 259 ${hip + 2} 274 L${hip + 2} 302 Q${hip + 10} 296 ${hip + 14} 287 L126 311 128 304 Q111 280 ${waist - 4} 247Z`} /></Pair>)}
        {region("Cuádriceps", <Pair>
          <path d={`M${hip + 2} 306 Q${hip + 10} 302 ${hip + 15} 291 L119 316 Q118 347 111 376 Q109 391 105 399 Q97 404 94 393 C${hip - 2} 363 ${hip - 2} 326 ${hip + 2} 306Z`} />
          <path d="M123 320 Q128 341 119 382 L115 404 Q110 417 105 409 L107 399 Q116 380 117 357Z" />
        </Pair>)}
        {/* The anterior shin is structural, not a calf exercise hit target. */}
        <g className="muscle-map__line"><Pair><path d="M96 442 Q90 464 96 494 L101 537 M105 439 L105 496 107 546 M116 447 Q123 468 114 493" /></Pair></g>
      </>}

      {region(back ? "Tríceps" : "Bíceps", <Pair>
        <path transform={`translate(${armShift} 0)`} d={back
          ? "M58 151 Q71 146 78 143 L73 173 Q68 193 58 203 L51 199 48 204 47 190 Q54 172 58 151Z"
          : "M58 155 Q67 153 76 145 Q73 163 69 177 C65 192 58 199 51 195 Q47 190 51 178Z"} />
      </Pair>)}
      {region("Antebrazos", <Pair>
        <path transform={`translate(${armShift} 0)`} d="M44 207 Q50 204 56 207 Q47 233 36 251 L31 267 20 265 Q26 244 29 231 Q34 215 44 207Z" />
      </Pair>)}

      <g className="muscle-map__line" aria-hidden="true">
        <Pair>
          <path d="M96 419 Q105 429 114 419 M96 428 Q102 437 112 428 M97 550 L111 550 M87 572 L95 569 M98 571 L104 569" />
          {back && <path d="M100 503 L102 542 Q98 549 99 557 M110 501 L107 543 Q111 550 109 557" />}
          <path transform={`translate(${armShift} 0)`} d="M19 270 L31 273 M30 277 L25 287" />
          {detailed && <>
            <path transform={`translate(${armShift} 0)`} d="M68 122 Q64 137 59 147 M47 216 Q37 238 28 260 M38 218 Q33 235 28 244" />
            {back
              ? <path d={`M${shoulder + 15} 134 Q103 149 115 166 M99 178 L116 191 M104 197 L114 201 M112 279 Q96 285 96 307 M99 338 Q96 371 102 391 M114 338 L109 385 M98 455 Q104 468 100 486`} />
              : <path d={`M${shoulder + 21} 128 Q111 133 124 129 M96 157 Q110 163 122 156 M96 187 L104 194 M99 198 L105 203 M${hip + 12} 313 Q${hip + 4} 350 103 382 M${hip + 16} 315 L111 347`} />}
          </>}
        </Pair>
      </g>
    </svg>
  );
}

export default function MuscleMap({ value = "Todos", onChange }) {
  const [gender, setGender] = useState("male");
  const [detailed, setDetailed] = useState(false);
  const [hovered, setHovered] = useState("");
  const selected = value === "Todos" ? "" : value;
  const select = (name) => onChange(name === selected ? "Todos" : name);

  return (
    <div className="muscle-map">
      <div className="muscle-map__header">
        <div>
          <p className="muscle-map__title">Seleccioná el músculo</p>
          <p className="muscle-map__hint">Tocá una zona para ver sus ejercicios.</p>
        </div>
        <div className="muscle-map__gender" role="group" aria-label="Tipo de figura">
          {[["male", "Hombre"], ["female", "Mujer"]].map(([key, label]) => (
            <button key={key} type="button" aria-pressed={gender === key} onClick={() => setGender(key)}>{label}</button>
          ))}
        </div>
      </div>
      <div className="muscle-map__toolbar">
        <span className="muscle-map__hover" aria-hidden="true">{hovered || "Frente y espalda"}</span>
        <label className="muscle-map__detail"><input type="checkbox" checked={detailed} onChange={(event) => setDetailed(event.target.checked)} />Más detalle</label>
      </div>
      <div className="muscle-map__canvas">
        {[false, true].map((back) => (
          <div className="muscle-map__view" key={String(back)}>
            <AnatomyFigure gender={gender} back={back} detailed={detailed} selected={selected} onSelect={select} onHover={setHovered} />
            <p className="muscle-map__caption">{back ? "Espalda" : "Frente"}</p>
          </div>
        ))}
      </div>
      <div className="muscle-map__footer">
        <p role="status" aria-live="polite"><span className={`muscle-map__swatch${selected ? " is-selected" : ""}`} />{selected || "Sin filtro corporal"}</p>
        {selected && <button type="button" onClick={() => onChange("Todos")}>Ver todos</button>}
      </div>
    </div>
  );
}
