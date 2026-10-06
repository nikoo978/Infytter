# Fotos de perfil en el servidor — 1.14.0

## Activar en Coolify (Dockerfile)

1. Abrir Projects → Infytter → Persistent Storage. Agregar un Volume con nombre `infytter-avatars` y Destination Path `/app/data/avatars`. Es un volumen persistente; no usar el directorio de recursos públicos de la web.
2. Agregar variables **runtime**: `AVATAR_DIR=/app/data/avatars` y `AVATAR_STORAGE_READY=1`.
3. Redeploy la versión 1.14.0. El volumen debe ser escribible por el usuario `node` (UID/GID 1000). El Dockerfile crea el directorio con ese propietario; un volumen nuevo hereda esos permisos. Para bind mount existente, ajustar permisos en el host a UID/GID 1000.
4. Cambiar dos veces una foto desde Perfil. Debe verse la última y debe existir un único `<UUID>.jpg` por cuenta en el volumen. Reiniciar o redeploy y verificar que la imagen continúa visible.
5. Admin master → Permisos de profesores → habilitar “Consultar alumnos” y “Ver fotos de alumnos” sólo para los profesores elegidos. Verán fotos circulares en Alumnos. Revocar el permiso bloquea futuras lecturas en la API inmediatamente (una imagen ya descargada no puede recuperarse).

La app no puede verificar desde dentro que una ruta es un volumen persistente: activar la variable **sólo después de montar el volumen**. Sin activar, el endpoint devuelve 503 y las fotos previas siguen visibles; las nuevas subidas quedan bloqueadas. El docker-compose incluido monta un volumen con nombre y habilita la variable; configurar una app Dockerfile en Coolify no adopta automáticamente ese compose.

## Protección y privacidad

- `/api/avatar`: GET/PUT autenticados. No hay directorio público ni URL de archivo accesible sin sesión.
- Sólo el titular puede subir. Para consultar otro alumno se resuelve la cuenta vinculada por RPC, verificando rol admin o profesor con ambos permisos. Coadmin no recibe permiso implícito.
- Un archivo final por cuenta, sustitución atómica. Máximo 2.000 fotos, hasta 256 KiB cada una (aproximadamente 500 MiB); requiere al menos 100 MiB libres para escribir. Estos límites son del proceso Node único de esta aplicación.
- Máximo 512 KiB recibidos, JPG real, como máximo 1 megapíxel, recorte a 512×512 y recompresión sin metadatos. El cliente prepara JPG/PNG/WebP originales de hasta 5 MB antes de enviarlos.
- Un upload concurrente por proceso, tres intentos por cuenta/minuto. Fallos de validación cuentan también. Tamaño y admisión se controlan antes de acumular el cuerpo. Mantener las protecciones de tráfico de Cloudflare para el límite exterior.
- Los uploads antiguos a Supabase Storage quedan cerrados mediante migración. Fotos existentes se transfieren al abrir el perfil una vez montado el volumen; se eliminan de Storage sólo tras guardado confirmado. Si la limpieza de la foto antigua falla, su metadata permanece para reintentar, sin perder la foto nueva.
- Fotos de alumnos sin cuenta vinculada o sin foto migrada: icono de persona. No se crean ni modifican cuentas para esta función.
- Incluir el volumen privado en los backups del servidor. No eliminarlo al redeploy.

## Validación realizada

Pruebas de imagen corrupta, formatos, límites, reemplazo sin acumulación, cuotas y autorización de lecturas/subidas. Verificación de interfaz por los workflows existentes. El montaje real y persistencia tras un redeploy requieren comprobación en Coolify.
