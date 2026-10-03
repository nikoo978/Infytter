import { useState } from "react";
import "./muscle-map.css";

import AnatomyPlate from "./AnatomyPlate";

export const AnatomyFigure = AnatomyPlate;

export default function MuscleMap({ value = "Todos", onChange, minimal = false }) {
  const [gender, setGender] = useState("male");
  const [hovered, setHovered] = useState("");
  const selected = value === "Todos" ? "" : value;
  const select = (name) => onChange(name === selected ? "Todos" : name);

  return (
    <div className={`muscle-map${minimal ? " muscle-map--minimal" : ""}`}>
      <div className="muscle-map__header">
        {!minimal && <div>
          <p className="muscle-map__title">Seleccioná el músculo</p>
          <p className="muscle-map__hint">Tocá una zona para ver sus ejercicios.</p>
        </div>}
        <div className="muscle-map__gender" role="group" aria-label="Tipo de figura">
          {[["male", "Hombre"], ["female", "Mujer"]].map(([key, label]) => (
            <button key={key} type="button" aria-pressed={gender === key} onClick={() => setGender(key)}>{label}</button>
          ))}
        </div>
      </div>
      {!minimal && <div className="muscle-map__toolbar">
        <span className="muscle-map__hover" aria-hidden="true">{hovered || "Frente y espalda"}</span>

      </div>}
      <div className="muscle-map__canvas">
        {[false, true].map((back) => (
          <div className="muscle-map__view" key={String(back)}>
            <AnatomyFigure gender={gender} back={back} interactive selected={selected} onSelect={select} onHover={setHovered} />
            <p className="muscle-map__caption">{back ? "Espalda" : "Frente"}</p>
          </div>
        ))}
      </div>
      {!minimal && <div className="muscle-map__footer">
        <p role="status" aria-live="polite"><span className={`muscle-map__swatch${selected ? " is-selected" : ""}`} />{selected || "Sin filtro corporal"}</p>
        {selected && <button type="button" onClick={() => onChange("Todos")}>Ver todos</button>}
      </div>}
    </div>
  );
}
