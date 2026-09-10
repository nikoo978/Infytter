# Infytter: lectores biométricos y molinete

Estado revisado: 10/09/2026. Sitio operativo: https://infytter.coffeetec.com.ar.

## Qué existe

- Alta y gestión de clientes y profesores, consulta por DNI y registro de autorizaciones/rechazos.
- Reglas de membresía y plan de tres días, con calendario argentino desde V.1.07.2.
- Segunda pantalla `/pantalla-acceso`, con nombre, rol, DNI, plan, vencimiento, último pago y resultado. Recibe eventos locales o por Supabase Realtime.
- Campos `biometricMethod` y `biometricStatus` en las fichas. Son descriptivos: todavía no capturan ni reconocen huellas o rostros.

No hay SDK de lectores, enrolamiento biométrico, conexión al controlador del molinete ni confirmación de paso físico. Los accesos actuales registran la decisión de la aplicación, no una señal del molinete.

## Datos necesarios antes de implementar el controlador

1. Marca y modelo exactos de ambos lectores, enlaces/manuales y SDK disponible. Confirmar captura, enrolamiento, identificación entre usuarios (1:N), licencia y soporte del sistema operativo.
2. Marca y modelo del molinete/controladora y manual de interfaces de apertura y sensores.
3. Sistema operativo y versión de la PC de recepción; confirmar si la segunda pantalla está conectada a esa PC.

USB describe la conexión, no garantiza que un lector exponga datos biométricos a Infytter. Una cámara requiere además un motor de reconocimiento y comprobaciones de presencia real. No se han seleccionado equipos ni validado compatibilidad física.

## Propuesta pendiente de validar con el hardware

Un servicio local en la PC de recepción conectará los SDK de los lectores y la controladora. Infytter seguirá gestionando personas, permisos, historial y pantalla. Si el equipo ofrece una API de red adecuada, revisar esta arquitectura antes de instalar un agente innecesario.

- Enrolamiento por personal autorizado: vincular una o ambas modalidades al identificador estable de cliente/profesor; permitir revocación y nuevo enrolamiento. Proteger las plantillas y no incluirlas en el estado JSON general, localStorage, logs ni eventos de pantalla.
- Identificación: recibir el resultado del SDK, comprobar dispositivo, usuario, calidad y presencia real según las capacidades del fabricante.
- Autorización: aplicar las reglas en un servicio confiable; la decisión actual del navegador no debe convertirse directamente en una orden física. Definir antigüedad máxima del estado local y comportamiento sin conexión.
- Apertura: orden autenticada, identificador único por intento y pulso acotado según el manual. Reintentos o eventos duplicados no deben abrir de nuevo.
- Historial: distinguir identidad reconocida, autorización, orden enviada, confirmación del controlador y paso detectado cuando exista sensor.
- Segunda pantalla: mostrar identidad y resultado; añadir foto, estado del dispositivo y confirmación de paso cuando estén disponibles. No usar el canal de visualización como canal de apertura.
- Respaldo: mantener atención manual con operador y motivo; validar el procedimiento de emergencia con el instalador del molinete.

## Verificación necesaria con equipos reales

Probar enrolamiento y reconocimiento de clientes y profesores, rechazo de desconocidos, vencimientos, límite semanal, duplicados, desconexión/reconexión USB, cortes de red, reinicio del servicio, fallo del controlador y caducidad del estado offline. Comprobar apertura y paso por separado, además de la segunda pantalla.

## Revisión funcional siguiente

Priorizar operación de recepción, matrícula y renovaciones, caja, profesores/rutinas y notificaciones. En accesos, revisar concurrencia entre recepciones y trazabilidad de anulaciones. El portal recibe un historial limitado: aunque comparte el calendario con recepción, su contador semanal deberá obtener un agregado completo del servidor para historiales con muchos reingresos.

Referencias de compatibilidad: [WebUSB](https://developer.mozilla.org/en-US/docs/Web/API/WebUSB_API), [Microsoft Windows Biometric Framework](https://learn.microsoft.com/en-us/windows/win32/secbiomet/biometric-service-api-reference), [ejemplo de integración local de fabricante](https://secugen.com/products/webapi/). Estas referencias no implican una recomendación de compra ni compatibilidad confirmada.
