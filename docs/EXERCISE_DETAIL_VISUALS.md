# Detalle visual de ejercicios — 29/09/2026

`ExerciseDetail` se comparte entre catálogo, detalle de rutina y técnica del entrenamiento. Usa los datos actuales del ejercicio; no cambia registro, permisos ni estado de Supabase.

## Recursos

Las imágenes WebP de `public/images/muscles/` provienen del ZIP aportado por el propietario, `estilo_detalle_musculos_para_otro_chat.zip`. Se conservan los originales sin modificar. Se cargan localmente y bajo demanda; no requieren un proveedor externo.

Correspondencias revisadas visualmente para las figuras masculina y femenina: 00 = neutral; 01 = espalda; 02 = hombros; 04 = pecho; 05 = core; 06 = glúteos; 08 = cuerpo completo. Las láminas son referencias de zona, no una clasificación nueva de músculos secundarios por ejercicio.

Las láminas 03 y 07 del paquete resaltan brazos/piernas completos. No se usan para representar bíceps, tríceps, antebrazos, cuádriceps, isquiotibiales o gemelos de forma individual. Esos grupos, cuello y cadera usan el SVG existente en modo informativo con marcado preciso. Cardio, movilidad y grupos desconocidos muestran una figura neutral. Si una imagen falla, se usa el SVG local.

## Comprobaciones

- `npm run build`, luego `npm test`.
- Detalle en catálogo, rutina y pestaña Técnica del entrenamiento.
- Cambio Hombre/Mujer y Músculos/Cómo hacerlo.
- Texto, GIFs, videos e indicaciones del profesor accesibles.
- Las figuras informativas no ofrecen botones que no hacen nada; el mapa de filtros conserva teclado y selección.
