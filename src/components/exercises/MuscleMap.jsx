import { useState } from "react";

const ACTIVE = "#E30613";
const IDLE = "#fecdd3";
const OUTLINE = "#475569";
const BODY = "#f8fafc";

function interactive(group, selected, onSelect) {
  const activate = () => onSelect(group);
  return {
    fill: selected === group ? ACTIVE : IDLE,
    stroke: selected === group ? "#9E0710" : "#f87171",
    strokeWidth: 1.5,
    className: "cursor-pointer transition hover:opacity-80 focus:outline-none",
    role: "button",
    tabIndex: 0,
    "aria-label": `Filtrar por ${group}`,
    onClick: activate,
    onKeyDown: (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activate();
      }
    },
  };
}

function FrontFigure({ gender, selected, onSelect }) {
  const female = gender === "female";
  return (
    <svg viewBox="0 0 150 330" className="mx-auto h-auto w-full max-w-[170px]" aria-label={`Vista frontal ${female ? "femenina" : "masculina"}`}>
      <g fill={BODY} stroke={OUTLINE} strokeWidth="2" strokeLinejoin="round">
        <circle cx="75" cy="31" r="22" />
        <path d={female ? "M50 58 Q75 48 100 58 L112 124 Q103 147 96 161 L92 190 H58 L54 161 Q47 147 38 124Z" : "M47 58 Q75 47 103 58 L114 123 Q104 146 96 161 L92 190 H58 L54 161 Q46 146 36 123Z"} />
        <path d="M39 70 Q25 81 20 112 L10 167 Q8 177 16 180 Q24 180 26 169 L37 119 50 84Z" />
        <path d="M111 70 Q125 81 130 112 L140 167 Q142 177 134 180 Q126 180 124 169 L113 119 100 84Z" />
        <path d={female ? "M59 187 L72 187 L70 252 61 319 43 319 48 251 49 201Z" : "M58 187 L73 187 L71 252 61 319 43 319 48 251 49 199Z"} />
        <path d={female ? "M91 187 L78 187 L80 252 89 319 107 319 102 251 101 201Z" : "M92 187 L77 187 L79 252 89 319 107 319 102 251 101 199Z"} />
      </g>

      <g {...interactive("Cuello", selected, onSelect)}><path d="M66 51 L84 51 L86 65 Q75 72 64 65Z" /></g>
      <g {...interactive("Hombros", selected, onSelect)}><ellipse cx="48" cy="72" rx="15" ry="12" /><ellipse cx="102" cy="72" rx="15" ry="12" /></g>
      <g {...interactive("Pecho", selected, onSelect)}><path d="M52 78 Q63 70 74 80 L73 104 Q59 106 49 98Z" /><path d="M98 78 Q87 70 76 80 L77 104 Q91 106 101 98Z" /></g>
      <g {...interactive("Bíceps", selected, onSelect)}><ellipse cx="31" cy="110" rx="9" ry="20" transform="rotate(13 31 110)" /><ellipse cx="119" cy="110" rx="9" ry="20" transform="rotate(-13 119 110)" /></g>
      <g {...interactive("Antebrazos", selected, onSelect)}><ellipse cx="20" cy="148" rx="7" ry="22" transform="rotate(10 20 148)" /><ellipse cx="130" cy="148" rx="7" ry="22" transform="rotate(-10 130 148)" /></g>
      <g {...interactive("Core", selected, onSelect)}><path d="M61 108 Q75 104 89 108 L88 158 Q75 169 62 158Z" /></g>
      <g {...interactive("Cadera", selected, onSelect)}><path d="M57 163 Q75 174 93 163 L92 192 Q75 201 58 192Z" /></g>
      <g {...interactive("Cuádriceps", selected, onSelect)}><path d="M50 197 Q59 190 69 197 L67 249 Q61 263 51 249Z" /><path d="M100 197 Q91 190 81 197 L83 249 Q89 263 99 249Z" /></g>
      <g {...interactive("Gemelos", selected, onSelect)}><path d="M49 263 Q58 254 65 266 L60 307 Q53 315 47 303Z" /><path d="M101 263 Q92 254 85 266 L90 307 Q97 315 103 303Z" /></g>
      <text x="75" y="327" textAnchor="middle" fontSize="9" fill="#64748b">Frente</text>
    </svg>
  );
}

function BackFigure({ gender, selected, onSelect }) {
  const female = gender === "female";
  return (
    <svg viewBox="0 0 150 330" className="mx-auto h-auto w-full max-w-[170px]" aria-label={`Vista posterior ${female ? "femenina" : "masculina"}`}>
      <g fill={BODY} stroke={OUTLINE} strokeWidth="2" strokeLinejoin="round">
        <circle cx="75" cy="31" r="22" />
        <path d={female ? "M50 58 Q75 48 100 58 L112 124 Q103 147 96 161 L92 190 H58 L54 161 Q47 147 38 124Z" : "M47 58 Q75 47 103 58 L114 123 Q104 146 96 161 L92 190 H58 L54 161 Q46 146 36 123Z"} />
        <path d="M39 70 Q25 81 20 112 L10 167 Q8 177 16 180 Q24 180 26 169 L37 119 50 84Z" />
        <path d="M111 70 Q125 81 130 112 L140 167 Q142 177 134 180 Q126 180 124 169 L113 119 100 84Z" />
        <path d="M58 187 L73 187 L71 252 61 319 43 319 48 251 49 199Z" />
        <path d="M92 187 L77 187 L79 252 89 319 107 319 102 251 101 199Z" />
      </g>

      <g {...interactive("Cuello", selected, onSelect)}><path d="M65 51 L85 51 L87 67 Q75 72 63 67Z" /></g>
      <g {...interactive("Hombros", selected, onSelect)}><ellipse cx="48" cy="72" rx="15" ry="12" /><ellipse cx="102" cy="72" rx="15" ry="12" /></g>
      <g {...interactive("Espalda", selected, onSelect)}><path d="M56 79 Q75 69 94 79 L99 124 Q87 146 75 153 Q63 146 51 124Z" /></g>
      <g {...interactive("Tríceps", selected, onSelect)}><ellipse cx="31" cy="110" rx="9" ry="20" transform="rotate(13 31 110)" /><ellipse cx="119" cy="110" rx="9" ry="20" transform="rotate(-13 119 110)" /></g>
      <g {...interactive("Antebrazos", selected, onSelect)}><ellipse cx="20" cy="148" rx="7" ry="22" transform="rotate(10 20 148)" /><ellipse cx="130" cy="148" rx="7" ry="22" transform="rotate(-10 130 148)" /></g>
      <g {...interactive("Glúteos", selected, onSelect)}><ellipse cx="64" cy="178" rx="14" ry="17" /><ellipse cx="86" cy="178" rx="14" ry="17" /></g>
      <g {...interactive("Isquiotibiales", selected, onSelect)}><path d="M50 199 Q59 190 69 199 L67 250 Q60 261 51 249Z" /><path d="M100 199 Q91 190 81 199 L83 250 Q90 261 99 249Z" /></g>
      <g {...interactive("Gemelos", selected, onSelect)}><path d="M48 263 Q57 253 65 266 L60 307 Q53 315 47 303Z" /><path d="M102 263 Q93 253 85 266 L90 307 Q97 315 103 303Z" /></g>
      <text x="75" y="327" textAnchor="middle" fontSize="9" fill="#64748b">Espalda</text>
    </svg>
  );
}

export default function MuscleMap({ value = "Todos", onChange }) {
  const [gender, setGender] = useState("male");
  const selected = value === "Todos" ? "" : value;

  return (
    <div className="rounded-[20px] border border-black/7 bg-slate-50 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black text-slate-800">Seleccioná el músculo</p>
          <p className="mt-1 text-[11px] leading-4 text-slate-400">Tocá una zona del frente o la espalda para filtrar los ejercicios.</p>
        </div>
        <div className="grid shrink-0 grid-cols-2 rounded-xl bg-white p-1 shadow-sm" aria-label="Tipo de figura">
          <button type="button" onClick={() => setGender("male")} className={`rounded-lg px-2.5 py-1.5 text-[10px] font-black ${gender === "male" ? "bg-[#050505] text-white" : "text-slate-500"}`}>Hombre</button>
          <button type="button" onClick={() => setGender("female")} className={`rounded-lg px-2.5 py-1.5 text-[10px] font-black ${gender === "female" ? "bg-[#050505] text-white" : "text-slate-500"}`}>Mujer</button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-white p-2 sm:px-6">
        <FrontFigure gender={gender} selected={selected} onSelect={onChange} />
        <BackFigure gender={gender} selected={selected} onSelect={onChange} />
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold text-slate-400">{selected ? `Filtro: ${selected}` : "Sin filtro corporal"}</p>
        {selected && <button type="button" onClick={() => onChange("Todos")} className="text-[10px] font-black text-[#9E0710]">Ver todos</button>}
      </div>
    </div>
  );
}
