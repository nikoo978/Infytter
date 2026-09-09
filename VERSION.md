# V.1.07.1 — 09/09/2026

- Veinte RPC validan explícitamente los roles nulos y se restringen permisos anónimos. Migración aplicada y registrada en Supabase.
- Protección de la propiedad de suscripciones Push y métodos HTTP explícitos.
- Archivos inexistentes devuelven 404, errores de entrada controlados y respuestas API sin caché.
- Actualización offline que exige completar los recursos principales antes de sustituir la copia anterior.
- Dependencias de construcción actualizadas y dominio operativo documentado correctamente.

## V.1.07

Actualización de versión para validar el flujo de despliegue actual con Docker + Coolify.

- No modifica lógica funcional ni datos.
- Cambia la versión visible de `V.1.069` a `V.1.07`.
- `package.json` pasa de `1.06.9` a `1.07.0`.

## V.1.069

Registro Cliente automático por DNI + corrección del preview móvil de Profesor.

- Las nuevas cuentas normales continúan creándose directamente con rol `cliente`; el Admin no necesita seleccionar ese rol.
- Si el DNI registrado coincide con una única ficha `Cliente` existente y esa ficha todavía no está vinculada, Supabase crea automáticamente el vínculo de cuenta al momento del alta.
- Si no existe una coincidencia única o la ficha ya está ocupada, la cuenta se conserva como Cliente sin crear un vínculo ambiguo; la vinculación manual sigue disponible como respaldo administrativo.
- La coincidencia automática sólo considera fichas con rol `Cliente` y mantiene la unicidad existente de DNI/cuenta.
- Se corrige la carrera de inicialización de Auth en `/preview-profesor-mobile`: la ruta espera el perfil real de Admin/Coadmin antes de autorizar o redirigir, evitando que el iframe termine mostrando el Dashboard Admin.
- La vista previa de Profesor vuelve a cargar su interfaz móvil real con navegación inferior, encabezado compacto y modo de solo lectura.

## V.1.068

Vista previa de Profesor en viewport móvil real.

- La vista previa de Profesor ahora se renderiza dentro de un viewport móvil aislado, igual que la experiencia de Cliente, incluso cuando el Admin entra desde una PC o netbook.
- Al simular un ancho móvil real, los breakpoints responsive del Profesor usan navegación inferior, encabezado compacto y distribución de celular en lugar de adaptar el diseño al ancho del monitor del Admin.
- Inicio, Alumnos, Progreso, Ejercicios y Rutinas siguen siendo navegables dentro de la vista previa sin cambiar el rol real del Admin/Coadmin.
- La ruta interna de simulación móvil sólo puede abrirse con rol Admin/Coadmin y mantiene bloqueadas las acciones sensibles de Profesor durante el preview.
- La X superior continúa cerrando la simulación y devolviendo al panel de administración.

## V.1.067

Ejercicios únicos con múltiples GIFs de variantes dentro del mismo detalle.

- La biblioteca conserva los 1.336 IDs/GIFs originales, pero deja de mostrarlos como 1.336 ejercicios separados.
- Los 47 nombres que tienen variantes se consolidan visualmente en un único ejercicio; el catálogo queda en 1.281 ejercicios únicos.
- Cada ejercicio mantiene un solo desplegable, una sola descripción, un solo bloque de alias/nombre original y una sola referencia de series/repeticiones.
- Cuando un ejercicio tiene 2, 3 o 4 variantes, todos sus GIFs aparecen juntos dentro de ese mismo desplegable, sin submenús, etiquetas de variante ni descripciones repetidas.
- El buscador sigue indexando todos los IDs, alias y nombres originales asociados a cualquiera de sus variantes.
- El constructor de rutinas también muestra cada ejercicio una sola vez y reconoce IDs antiguos de variantes para evitar duplicados en rutinas existentes.
- Al volver a guardar una rutina antigua, sus referencias de variantes se normalizan al ejercicio canónico sin perder el nombre ni la configuración de la rutina.

## V.1.066

Vista previa inmersiva por rol + menú Admin adaptable a pantallas de poca altura.

- Al entrar en `Vista previa`, el Admin/Coadmin primero elige `Profesor` o `Cliente`.
- Al elegir un rol, el panel administrativo desaparece temporalmente y la pantalla pasa a mostrar el interfaz de ese rol a pantalla completa.
- Una X fija arriba a la derecha cierra la vista previa y devuelve exactamente al área de administración.
- La vista previa mantiene el rol y permisos reales del Admin; las áreas de Profesor que podrían escribir datos se muestran en modo visual/solo lectura.
- La vista Profesor permite recorrer Inicio, Alumnos, Progreso, Ejercicios y Rutinas desde su misma navegación responsive.
- La vista Cliente mantiene su navegación móvil interna y puede consultar la biblioteca real de ejercicios sin cambiar de rol.
- El menú lateral Admin ahora reserva siempre el bloque de usuario/Cerrar sesión y hace scroll sólo sobre las opciones cuando la pantalla tiene poca altura.
- En netbooks de baja altura se compactan logo, separación y alto de las opciones para que `Vista previa` y `Cerrar sesión` sigan siendo accesibles.

## V.1.065

Nombres de ejercicios adaptados a Argentina con alias y nombre original como referencias secundarias.

- Usa exactamente el archivo `ID; nombre más común en Argentina; alias; nombre original` como fuente de nomenclatura para las 1.336 variantes.
- El nombre más común en Argentina pasa a ser el único título principal visible en glosario, PWA y constructor de rutinas.
- Los alias y el nombre original se muestran al abrir el ejercicio, inmediatamente debajo de la explicación breve.
- El ID de la variante queda disponible de forma discreta dentro del mismo bloque informativo para distinguir GIFs cuando dos variantes comparten nombre.
- El buscador de Admin, Profesor, Cliente y constructor de rutinas indexa nombre argentino, todos los alias, nombre original, músculo, equipamiento, descripción e ID.
- Las rutinas existentes muestran el nombre argentino actual cuando el ejercicio sigue vinculado por ID y lo actualizan al volver a guardarse.

## V.1.064

Variantes de ejercicios separadas por ID.

- Corrige la consolidación anterior: cada ID de la biblioteca vuelve a representar una variante independiente, aunque comparta nombre con otra.
- La biblioteca oficial queda en exactamente 1.336 ejercicios, con 1.336 IDs distintos.
- Cada variante usa exclusivamente su propio GIF de Cloudinary mediante `https://res.cloudinary.com/po0pnxfc/image/upload/ID.gif`.
- Se elimina la unicidad por nombre + músculo y se protege la unicidad del ID de biblioteca para impedir futuras consolidaciones accidentales.
- Las 47 familias que tienen nombres repetidos se identifican visualmente como `Variante · ID N` en glosario y constructor de rutinas.
- Los alias siguen asociados por ID, por lo que cada variante conserva las búsquedas que le correspondan.
- Los 11 ejercicios de ejemplo iniciales, no usados por ninguna rutina, se retiran para que el catálogo oficial coincida exactamente con las 1.336 referencias proporcionadas.

## V.1.063

Búsqueda por alias y nombres de ejercicios completamente legibles.

- Integra los alias entregados para 752 IDs de la biblioteca, separados originalmente por `;`, y los agrupa automáticamente cuando un ejercicio tiene varios códigos.
- El buscador de Profesor, Cliente, Admin y constructor de rutinas reconoce nombre, alias, músculo, categoría, equipamiento, descripción y código.
- La búsqueda normaliza mayúsculas, acentos, signos y espacios, por lo que variantes como `biceps` también encuentran `Bíceps`.
- Los nombres dejan de cortarse con una sola línea en la PWA: las tarjetas crecen lo necesario para mostrar el nombre completo.
- Al abrir un ejercicio se vuelve a mostrar el nombre completo junto con sus alias principales, descripción y GIF.
- El constructor de rutinas también muestra nombres completos y permite localizar ejercicios usando cualquiera de sus alias.

## V.1.062

GIFs demostrativos de ejercicios vinculados por ID desde Cloudinary.

- Cada ejercicio importado usa su código original para cargar `https://res.cloudinary.com/po0pnxfc/image/upload/ID.gif`.
- Los ejercicios consolidados que tienen varios códigos conservan fallback automático entre sus IDs si un GIF no está disponible.
- Los GIFs se muestran tanto en el glosario móvil de Profesor/Cliente como en la biblioteca de Admin.
- Las imágenes usan carga diferida y `object-contain` para mostrar el movimiento completo sin recortes innecesarios.
- Los ejercicios personalizados pueden seguir usando una URL de imagen/GIF manual.

## V.1.061

Biblioteca masiva de ejercicios clasificada y optimizada para móvil.

- Importa las 1.336 referencias de la biblioteca proporcionada y conserva sus identificadores originales para asociar GIFs más adelante.
- Las referencias duplicadas se consolidan en ejercicios canónicos sin perder los códigos de origen.
- Clasifica los ejercicios por Pecho, Espalda, Hombros, Bíceps, Tríceps, Antebrazos, Core, Glúteos, Cuádriceps, Isquiotibiales, Gemelos, Cadera, Cuello, Cuerpo completo, Cardio y Movilidad.
- Cada ejercicio incorpora una explicación breve de ejecución generada según el movimiento y grupo muscular.
- El buscador incluye nombre, músculo, categoría, equipamiento, descripción y código de biblioteca.
- Profesor, Cliente y Admin usan la misma biblioteca completa.
- El glosario muestra resultados de forma progresiva para evitar renderizar más de mil tarjetas simultáneamente en iOS/Android.
- El constructor de rutinas busca sobre toda la biblioteca y limita los resultados visibles para mantener una interacción fluida.
- `image_url` continúa preparado para enlazar los GIFs cuando se defina su alojamiento.

## V.1.06

Interfaces móviles completas para Profesor y Cliente + seguimiento corporal + permisos de acceso por profesor.

- Profesor elimina “Accesos” de su navegación y usa Inicio / Alumnos / Progreso / Ejercicios / Rutinas.
- El botón “Permitir acceso” aparece en Inicio sólo a profesores habilitados individualmente por el Admin Master.
- El permiso se valida también en Supabase; ocultar el botón no es la única protección.
- El acceso manual se registra en la sucursal seleccionada por el profesor y se refleja en todas las segundas pantallas.
- Profesor puede registrar y consultar su progreso corporal y el de sus alumnos.
- Cliente incorpora Inicio / Progreso / Ejercicios / Mis rutinas / Profe.
- Cliente puede registrar peso, altura, cintura, cuello, cadera opcional y notas.
- El sistema calcula IMC y, cuando hay medidas suficientes, porcentaje de grasa corporal estimado mediante fórmula Navy. Se presenta como estimación orientativa, no diagnóstico médico.
- Las mediciones se almacenan en una tabla privada, indexada y sin acceso directo desde el navegador.
- Profesor y Cliente tienen acceso al glosario completo de ejercicios para consultar técnica, músculo, equipamiento, referencias y material visual.
- Los portales usan navegación inferior, áreas seguras y objetivos táctiles adecuados para iOS y Android.

## V.1.051

Sincronización global de segunda pantalla de accesos.

- La segunda pantalla se sincroniza entre PC, celular, tablet o TV mediante Supabase Realtime.
- Todos los dispositivos muestran el mismo resultado cuando ingresa un Cliente o Profesor.
- El último evento puede recuperarse durante 30 segundos al abrir o reconectar una segunda pantalla.
- Se mantiene BroadcastChannel/localStorage como respaldo local en la PC.
- Accesos permite copiar un enlace seguro para abrir la misma segunda pantalla en otro dispositivo.

## V.1.05

Rutinas + glosario de ejercicios + registro reforzado.

- Admin Master puede eliminar definitivamente cuentas/mail PWA sin borrar la ficha del gimnasio.
- El registro solicita nombre completo, DNI, email y contraseña; el DNI queda asociado al perfil de cuenta.
- Ejercicios funciona como glosario filtrable por músculo; cada ejercicio despliega una explicación breve y material visual opcional.
- Profesor puede crear y editar rutinas, asignarlas a uno o varios clientes vinculados y revisar las rutinas enviadas por cliente.
- Una rutina enviada por Profesor permanece en el Cliente hasta que el propio Cliente la elimine; los cambios posteriores del Profesor se reflejan automáticamente.
- Cliente puede crear, editar y eliminar hasta 3 rutinas personales desde su interfaz móvil.
- Portal Cliente separa Inicio, Mis rutinas y Rutinas del profe.
