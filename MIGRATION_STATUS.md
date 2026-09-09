# GymFlow · Estado de migraciones

## V.1.07.1 — Permisos (09/09/2026)

`supabase/migrations/20260909025126_gf_audit_role_guards.sql` fue aplicada a `ubfqwmhxkjtqdcfnsmwe` mediante el registro de migraciones de Supabase. No repetirla manualmente.

- Veinte funciones rechazan explícitamente los roles nulos, además de los roles no autorizados.
- Se retiró la ejecución anónima de funciones de cuentas y estado privado; se mantienen las RPC públicas que validan su propia clave de acceso.
- Verificado en transacciones sin cambios de datos: anónimo rechazado, sesión sin perfil rechazada y Admin master autorizado.

## V.1.05 — Cuentas, DNI y rutinas

Migraciones nuevas:

```text
supabase/migrations/20260901_gf_routines_registration_v105.sql
supabase/migrations/20260901_gf_routines_v105_indexes.sql
```

Ambas fueron aplicadas a producción el 1 de septiembre de 2026. No repitas migraciones anteriores.

### Resultado

- `gf_profiles` incorpora DNI para las cuentas PWA.
- Las nuevas cuentas requieren nombre completo + DNI válido.
- Admin Master puede eliminar una cuenta registrada de Supabase Auth sin eliminar la ficha del gimnasio.
- Cliente obtiene lectura del glosario de ejercicios para armar sus propias rutinas.
- Rutinas y asignaciones se almacenan en el esquema privado `private` y se acceden sólo mediante RPCs con validación de rol/propiedad.
- Cliente puede mantener hasta 3 rutinas personales.
- Profesor puede crear rutinas compartidas y asignarlas a uno o varios clientes vinculados.
- La asignación del Profesor permanece hasta que el Cliente la elimina; editar la rutina actualiza lo que ven sus clientes.
- Se agregaron índices de soporte para las claves foráneas nuevas.

## V.1.04 — Biblioteca de ejercicios

```text
supabase/migrations/20260831_gf_exercise_library_v104.sql
```

Aplicada previamente. Crea `gf_exercises` con RLS y ejercicios base.
