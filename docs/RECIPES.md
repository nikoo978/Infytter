# Recetario — V1.11.0

Ubicación: menú flotante del alumno, entre Progreso y Perfil; Inicio del profesor; menú Recetas del admin. El profesor puede abrir `/recetas`. El menú del alumno muestra seis opciones cuando Recetas está habilitada y cinco si el admin oculta la sección.

El admin crea, edita, publica/oculta y elimina con confirmación. También puede ocultar toda la sección. Profesores, alumnos y coadmins consultan únicamente recetas publicadas mientras la sección esté habilitada. El recetario es compartido por Junín y Chacabuco.

## Persistencia y permisos

`public.gf_recipes` almacena contenido, macros originales y visibilidad. `public.gf_recipe_settings` contiene el interruptor global. Ambas tablas tienen RLS: sin acceso anónimo; escritura únicamente con perfil `admin` validado por `gf_current_role()` en PostgreSQL. No se utiliza el estado JSON del gimnasio ni se modifica la cola offline. La gestión requiere conexión.

La migración `20261004081632_recipes_catalog.sql`, aplicada en Supabase, importa una sola vez las 99 recetas del ZIP proporcionado. No se ejecuta ninguna reimportación desde el cliente, al iniciar el servidor o al desplegar. Así, las ediciones y las eliminaciones se conservan. La importación no modifica datos de clientes, caja, accesos o rutinas.

## Contenido y fotos

Las 99 fotos WebP están en `public/images/recipes/` y se sirven desde el servidor de la app. No se depende de la web del recetario ni de un bucket adicional. Son recursos públicos; ocultar una receta bloquea su contenido en el catálogo y en la API, pero no convierte la foto estática en un archivo privado. Las recetas nuevas pueden usar una URL HTTPS de imagen.

Se conservaron los nombres, ingredientes, macros y pasos del archivo entregado. Se quitaron los prefijos `-1` de cantidades ausentes y se separaron pasos numerados para evitar numeración duplicada. Categorías basadas en el agrupamiento de comidas de origen: Desayunos, Platos principales, Snacks y meriendas. No se infirieron categorías veganas/alérgenos ni calorías. El archivo no especifica porciones y el detalle lo indica.

## Validación

- 83 pruebas unitarias/integración; compilación y auditoría de portabilidad.
- SQL ejecutado bajo el rol `authenticated` con perfiles reales y rollback: creación/edición/eliminación admin, ocultación individual/global, bloqueos de escrituras profesor/alumno, perfil inexistente y acceso anónimo. 16 comprobaciones aprobadas sin conservar cambios de prueba.
- QA de navegador en GitHub: alumno, profesor y admin; filtros, detalle y Atrás, edición, alta, publicación/ocultación, cancelación y confirmación de eliminación; 320 px y escritorio.
