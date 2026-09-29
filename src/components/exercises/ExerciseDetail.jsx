import { useId, useState } from "react";
import { ExternalLink, Video } from "lucide-react";
import { ExerciseGifGallery } from "./ExerciseGif";
import { AnatomyFigure } from "./MuscleMap";
import "./exercise-detail.css";

// The supplied arm/leg plates combine multiple groups. Use the precise SVG for
// those groups rather than present the entire limb as the exercise's target.
const PLATES = { Espalda: "01", Hombros: "02", Pecho: "04", Core: "05", Glúteos: "06", "Cuerpo completo": "08" };
const PRECISE_GROUPS = new Set(["Bíceps", "Tríceps", "Antebrazos", "Cuádriceps", "Isquiotibiales", "Gemelos", "Cadera", "Cuello"]);

export function muscleIllustration(group, gender = "male") {
  const figure = gender === "female" ? "female" : "male";
  return { precise: PRECISE_GROUPS.has(group), highlighted: Boolean(PLATES[group]) || PRECISE_GROUPS.has(group), src: `/images/muscles/${figure}_muscle_${PLATES[group] || "00"}.webp` };
}

export function MuscleFocus({ group = "" }) {
  const [gender, setGender] = useState("male");
  const [failedSrc, setFailedSrc] = useState("");
  const illustration = muscleIllustration(group, gender);
  const fallback = illustration.precise || failedSrc === illustration.src;
  return <div className="exercise-detail__focus">
    <div className="exercise-detail__heading">
      <h3>Área de enfoque</h3>
      <div className="exercise-detail__switch" role="group" aria-label="Figura anatómica">
        {[["male", "Hombre"], ["female", "Mujer"]].map(([value, label]) => <button key={value} type="button" aria-pressed={gender === value} onClick={() => setGender(value)}>{label}</button>)}
      </div>
    </div>
    <p className="exercise-detail__chip"><span aria-hidden="true" />{group || "Grupo muscular sin especificar"}</p>
    <figure className="exercise-detail__anatomy">
      {fallback ? <div className="exercise-detail__figures">
        <AnatomyFigure gender={gender} selected={group} detailed interactive={false} />
        <AnatomyFigure gender={gender} back selected={group} detailed interactive={false} />
      </div> : <img src={illustration.src} alt={`Vista de frente y espalda, figura ${gender === "female" ? "femenina" : "masculina"}${illustration.highlighted ? `: ${group}` : " de referencia"}`} width="656" height="614" loading="lazy" decoding="async" onError={() => setFailedSrc(illustration.src)} />}
      <figcaption>{illustration.highlighted ? "Referencia de la zona corporal" : "Vista corporal general · sin zona específica marcada"}</figcaption>
    </figure>
  </div>;
}

export default function ExerciseDetail({ exercise = {}, title = true }) {
  const [view, setView] = useState("muscles");
  const id = useId();
  return <section className="exercise-detail" aria-label={`Detalle de ${exercise.name || "ejercicio"}`}>
    {title && <h2 className="exercise-detail__title">{exercise.name || "Detalle del ejercicio"}</h2>}
    <div className="exercise-detail__tabs" role="group" aria-label="Información del ejercicio">
      {[["muscles", "Músculos"], ["technique", "Cómo hacerlo"]].map(([key, label]) => <button type="button" key={key} aria-pressed={view === key} aria-controls={`${id}-content`} onClick={() => setView(key)}>{label}</button>)}
    </div>
    <div id={`${id}-content`}>
      {view === "muscles" ? <MuscleFocus group={exercise.muscle_group} /> : <div className="exercise-detail__technique">
        <h3>Guía del ejercicio</h3>
        <p>{exercise.notes || "La explicación de este ejercicio todavía no fue cargada."}</p>
        <ExerciseGifGallery exercise={exercise} className="max-h-80 w-full rounded-2xl object-contain" />
        {exercise.video_url && <a className="exercise-detail__video" href={exercise.video_url} target="_blank" rel="noreferrer"><Video size={16} /> Ver video <ExternalLink size={14} /></a>}
      </div>}
    </div>
    <div className="exercise-detail__equipment"><h3>Equipo</h3><p className="exercise-detail__chip">{exercise.equipment || "Sin especificar"}</p></div>
  </section>;
}
