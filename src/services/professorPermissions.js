export const PROFESSOR_PERMISSIONS = [
  { key: "canViewStudentPhotos", column: "can_view_student_photos", group: "Alumnos", label: "Ver fotos de alumnos", detail: "Mostrar sus fotos de perfil en las fichas. Requiere consultar alumnos.", requires: "canViewStudents" },
  {
    "key": "canViewStudents",
    "column": "can_view_students",
    "group": "Alumnos",
    "label": "Consultar alumnos",
    "detail": "Buscar fichas de alumnos. No habilita progreso ni rutinas.",
    "requires": null
  },
  {
    "key": "canViewStudentProgress",
    "column": "can_view_student_progress",
    "group": "Alumnos",
    "label": "Consultar progreso de alumnos",
    "detail": "Ver medidas e historial de entrenamientos.",
    "requires": "canViewStudents"
  },
  {
    "key": "canRecordStudentMetrics",
    "column": "can_record_student_metrics",
    "group": "Alumnos",
    "label": "Registrar medidas de alumnos",
    "detail": "Agregar mediciones corporales.",
    "requires": "canViewStudentProgress"
  },
  {
    "key": "canDeleteStudentMetrics",
    "column": "can_delete_student_metrics",
    "group": "Alumnos",
    "label": "Eliminar medidas de alumnos",
    "detail": "Quitar mediciones con confirmación.",
    "requires": "canViewStudentProgress"
  },
  {
    "key": "canViewStudentRoutines",
    "column": "can_view_student_routines",
    "group": "Alumnos",
    "label": "Consultar rutinas de alumnos",
    "detail": "Ver rutinas personales y compartidas, sin modificar las personales.",
    "requires": "canViewStudents"
  },
  {
    "key": "canViewRoutines",
    "column": "can_view_routines",
    "group": "Rutinas",
    "label": "Consultar mis rutinas",
    "detail": "Acceder a la biblioteca de rutinas del profesor.",
    "requires": null
  },
  {
    "key": "canCreateRoutines",
    "column": "can_create_routines",
    "group": "Rutinas",
    "label": "Crear rutinas",
    "detail": "Requiere consultar mis rutinas y ejercicios.",
    "requires": "canViewRoutines"
  },
  {
    "key": "canEditRoutines",
    "column": "can_edit_routines",
    "group": "Rutinas",
    "label": "Modificar rutinas propias",
    "detail": "Requiere consultar mis rutinas y ejercicios; sólo modifica las propias.",
    "requires": "canViewRoutines"
  },
  {
    "key": "canAssignRoutines",
    "column": "can_assign_routines",
    "group": "Rutinas",
    "label": "Enviar rutinas a alumnos",
    "detail": "Requiere consultar alumnos y mis rutinas.",
    "requires": "canViewRoutines"
  },
  {
    "key": "canViewExercises",
    "column": "can_view_exercises",
    "group": "Ejercicios",
    "label": "Consultar ejercicios",
    "detail": "Abrir el catálogo y la técnica de los ejercicios.",
    "requires": null
  },
  {
    "key": "canCreateExercises",
    "column": "can_create_exercises",
    "group": "Ejercicios",
    "label": "Agregar ejercicios",
    "detail": "Crear ejercicios personalizados.",
    "requires": "canViewExercises"
  },
  {
    "key": "canEditExercises",
    "column": "can_edit_exercises",
    "group": "Ejercicios",
    "label": "Modificar ejercicios propios",
    "detail": "Editar sus ejercicios personalizados.",
    "requires": "canViewExercises"
  },
  {
    "key": "canDeleteExercises",
    "column": "can_delete_exercises",
    "group": "Ejercicios",
    "label": "Quitar ejercicios propios",
    "detail": "Eliminar sus ejercicios; conserva el catálogo base.",
    "requires": "canViewExercises"
  },
  {
    "key": "canUseOwnProgress",
    "column": "can_use_own_progress",
    "group": "Otras funciones",
    "label": "Mi progreso personal",
    "detail": "Consultar, registrar y quitar sus propias mediciones.",
    "requires": null
  },
  {
    "key": "canGrantAccess",
    "column": "can_grant_access",
    "group": "Otras funciones",
    "label": "Permitir acceso",
    "detail": "Autorizar un ingreso manual al gimnasio.",
    "requires": null
  }
];

export function professorPermissionEnabled(profile, key) {
  const control = PROFESSOR_PERMISSIONS.find((item) => item.key === key);
  if (!control || profile?.[control.column] !== true) return false;
  if (control.requires && !professorPermissionEnabled(profile, control.requires)) return false;
  if (["canCreateRoutines", "canEditRoutines"].includes(key) && !professorPermissionEnabled(profile, "canViewExercises")) return false;
  if (key === "canAssignRoutines" && !professorPermissionEnabled(profile, "canViewStudents")) return false;
  return true;
}
