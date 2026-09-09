# Revisión técnica — 09/09/2026

Versión: V.1.07.1. Operativo: https://infytter.coffeetec.com.ar.

## Correcciones

- Roles nulos rechazados explícitamente en 20 funciones SECURITY DEFINER y ejecución anónima restringida. Migración aplicada: 20260909025126_gf_audit_role_guards.
- La administración de una suscripción Push exige propiedad; cambiar de cuenta en el mismo navegador requiere presentar las claves completas de esa suscripción.
- Las acciones Push tienen métodos HTTP explícitos y sólo aceptan destinos de proveedores conocidos.
- Respuestas API sin caché, límites de cuerpo con respuesta 413 y archivos inexistentes con 404.
- Un worker nuevo no sustituye la copia offline anterior si no pudo descargar sus recursos ejecutables.

## Verificación

Se ejecutaron compilación Vite, pruebas Node (HTTP real, propiedad de Push y componentes), auditoría de portabilidad y comprobaciones transaccionales en Supabase. CI repite compilación y pruebas en cada pull request y actualización de main.

La auditoría npm de dependencias de producción devuelve 0 avisos conocidos. La auditoría completa aún reporta 10 avisos (6 altos y 4 moderados) en herramientas heredadas de desarrollo: cadenas de vinext/image-size, Cloudflare/miniflare/sharp y drizzle-kit/esbuild. Estas herramientas no están en la imagen runtime de Docker, que instala con --omit=dev. No se aplicaron downgrades ni migraciones beta sugeridos por npm audit --force. La retirada o migración de ese scaffold requiere comprobar su flujo heredado por separado.

## Límites

No se ejecutaron pruebas de escritura con datos reales del gimnasio ni envíos de notificaciones a sus usuarios. El cambio de permisos se verificó dentro de transacciones sin modificar datos de negocio. Los controles locales no equivalen a confirmar que Coolify haya desplegado el commit; debe comprobarse la versión pública después del despliegue.
