import { useId, useState } from "react";
import { ExternalLink, Video } from "lucide-react";
import { ExerciseGifGallery } from "./ExerciseGif";
import { AnatomyFigure } from "./MuscleMap";
import "./exercise-detail.css";

export function MuscleFocus({ group = "" }) {
  const [gender, setGender] = useState("male");
  return <div className="exercise-detail__focus">
    <div className="exercise-detail__heading">
      <h3>Área de enfoque</h3>
      <div className="exercise-detail__switch" role="group" aria-label="Figura anatómica">
        {[["male", "Hombre"], ["female", "Mujer"]].map(([value, label]) => <button key={value} type="button" aria-pressed={gender === value} onClick={() => setGender(value)}>{label}</button>)}
      </div>
    </div>
    <p className="exercise-detail__chip"><span aria-hidden="true" />{group || "Grupo muscular sin especificar"}</p>
    <figure className="exercise-detail__anatomy">
      <div className="exercise-detail__figures">
        <AnatomyFigure gender={gender} selected={group} />
        <AnatomyFigure gender={gender} back selected={group} />
      </div>
      <figcaption>{group && !["Cardio", "Movilidad"].includes(group) ? "Zona de enfoque · frente y espalda" : "Vista corporal general"}</figcaption>
    </figure>
  </div>;
}

export default function ExerciseDetail({ exercise = {}, title = true }) {
  const [view, setView] = useState("technique");
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
