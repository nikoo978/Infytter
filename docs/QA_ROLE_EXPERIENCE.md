# QA y experiencia de alumno y profesor — V1.09.4

Fecha: 30/09/2026. Aplicación operativa React/Vite + Node, desplegada en Docker/Coolify.

## Problemas corregidos

| Recorrido | Problema encontrado | Resultado |
|---|---|---|
| Alumno en escritorio | Todo el portal estaba limitado al ancho de un teléfono | Contenido adaptable y resumen en cuatro columnas |
| Inicio del alumno | El día del plan dependía de la zona del dispositivo | Día calculado en Argentina |
| Biblioteca | El mapa ocupaba la pantalla antes de llegar a los resultados | Mapa desplegable, filtros siempre accesibles y botón para limpiar resultados vacíos |
| Cargas fallidas | Mensajes vacíos podían parecer ausencia de datos | Error explícito y acción de reintento |
| Profesor busca un alumno | Las tarjetas terminaban en datos estáticos | Accesos a progreso y rutinas con el alumno seleccionado |
| Profesor cambia de sede | Una ficha seleccionada podía seguir abierta en otra sede | Selección visible sólo si pertenece a la sede activa y está habilitada |
| Profesor cambia rápidamente de alumno | Una respuesta tardía podía reemplazar las rutinas del alumno nuevo | Se descartan respuestas de consultas anteriores |
| Enviar rutina | El botón permitía continuar sin destinatarios nuevos | Contador de destinatarios y botón deshabilitado si no hay nuevos alumnos |
| Guardado con error | El mensaje de error quedaba detrás del diálogo | Mensaje dentro del diálogo de creación, edición o envío |
| Consulta dentro del editor | Teclado y desplazamiento podían alcanzar el fondo | Diálogos en portal, foco limitado, Escape, restauración del foco y bloqueo del fondo |

## Verificación

- Compilación Vite y 72 pruebas de regresión.
- Auditoría de portabilidad y comprobación de diferencias de Git.
- Navegador Chromium: 390 × 844 y 1440 × 1000; se inspeccionaron capturas de ambos roles.
- Alumno: navegación, elegir/desmarcar, consulta anidada, pantalla completa, zoom, cierre con Escape, recuperación de error de biblioteca y limpieza de filtros.
- Profesor: enlace al alumno, cambio de sede, enlace a sus rutinas, respuesta tardía al cambiar de alumno y selección reversible de destinatarios.
- Sin errores JavaScript en los recorridos y sin desbordamiento horizontal en las pantallas comprobadas.

Las solicitudes a Supabase se simulan en estas pruebas de interacción. No prueban la autenticación real, permisos RPC ni persistencia en producción. No se crean cuentas ni se modifican datos del gimnasio.

## Repetir la prueba de interfaz

El script está fuera de la suite de Node porque requiere un navegador:

```bash
npm ci
npm run build
npm test
npm install --no-save --package-lock=false playwright
npx playwright install chromium
node scripts/qa-role-flows.cjs
```

El script inicia y detiene un servidor local en el puerto 5174. Guarda capturas en `/tmp/infytter-role-qa`. Se puede indicar un módulo Playwright ya instalado con `PLAYWRIGHT_MODULE`, un ejecutable Chromium con `QA_BROWSER_PATH` y otra carpeta de capturas con `QA_OUTPUT_DIR`.

Antes de validar persistencia real, utilizar cuentas de prueba y datos temporales. La publicación en GitHub y el despliegue en Coolify se verifican por separado.
