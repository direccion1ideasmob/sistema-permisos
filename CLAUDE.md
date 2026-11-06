# Mobiliarium — Sistema de Permisos

App React + Vite sobre Supabase. Verificar cambios con `npm run build` (debe quedar en 0 errores).

## Reglas sagradas (NO romper)

Viven principalmente en `src/modules/permisos/services/permisosService.js` y `src/modules/directorio/services/directorioService.js`. Cualquier cambio en estos flujos debe preservar lo siguiente.

### 1. Restricción CHECK en `permisos.pago` (Supabase)
- La columna `pago` tiene una restricción CHECK que **puede rechazar el valor `'Cancelado'`**.
- Patrón obligatorio al cancelar: intentar primero `pago: 'Cancelado'` y, **si Supabase devuelve error**, reintentar el mismo update con `pago: 'Sin goce'` (manteniendo `estado_general: 'rechazado'` y la marca `CANCELADO por ...` en `observaciones`).
- Usado en: `cancelarSalidasMismoDiaPorRetiro`, `cancelarSolicitudPermiso` y la sustitución de pases por falta del mismo día.
- Por eso un permiso cancelado se detecta por **cualquiera** de: `pago === 'cancelado'`, `/CANCELADO por/i` o `/\[PASE CANCELADO/i` en `observaciones`. Nunca dependas solo del valor de `pago`.

### 2. Regla Pedro Simón (retardos del mismo día)
- En `resolverCadenaFirmasPorEcualizador`, si `tipoPermiso === 'retardo'` **y** `esMismoDia`, se elimina de la cadena cualquier firmante (jefe o gerente) que sea Pedro Simón (`esUsuarioPedroSimon`: rol `gerente_admin` o nombre normalizado que contenga PEDRO y SIMON).
- En retardos anticipados (días futuros) y en otros tipos de permiso **sí** firma.

### 3. Regla José Coca (no triplicar firmas)
- Si el solicitante es gerente/validador superior (`esRolValidadorSuperior` o `superadmin`; p. ej. Pedro, Reynaldo, Coca), la solicitud va **directo a RH**: sin firma 1 ni firma 2.
- Un mismo usuario nunca debe ocupar dos casillas: el gerente del depto se omite si coincide con el solicitante, con el jefe (`jefeFinalId`) o con RH (`rhFinalId`); el supervisor individual (`reporta_a_id`) se ignora si es `gerente_rh` o el propio RH.
- Las firmas sin firmante quedan en estado `omitido`; las del propio solicitante, en `auto_aprobado`.

### 4. Retardo del día / en puerta vs. retardo anticipado futuro
- **Retardo del día o en puerta**: `tipo === 'retardo'` y (`fecha_permiso <= hoy` o hay `[LLEGADA EN PUERTA:` en observaciones). También aplica a una falta con `FALTA PREVIA SIN AVISO`.
  - Al rechazar se dictamina **"Regresar a Casa"**: se convierte en `tipo_permiso: 'falta'`, `pago: 'Sin goce (Se regresa)'`, `total_horas: 8`, `estado_general: 'autorizado'`, se genera folio oficial si era `REQ-`, se cancelan las salidas del mismo día y se notifica a Caseta.
- **Retardo anticipado futuro**: `tipo === 'retardo'` que no es del día ni en puerta.
  - Al rechazar es un **rechazo simple, "Rechazar (Entra puntual)"**: `estado_general: 'rechazado'`; el colaborador debe presentarse en su horario normal.
- Esta distinción debe ser consistente en `rechazarSolicitudPermiso` (service), `TarjetaAprobacion.jsx` (etiqueta del botón) y `ModalRechazoPermiso.jsx` (título, texto y botón).

### 5. Bloqueo de cancelación con sello físico de Caseta
- `tieneSelloFisicoCaseta(permiso)` es `true` si: el folio empieza con `CAS-`, `estado_general === 'completado_caseta'`, o las observaciones contienen `[LLEGADA EN PUERTA:`, `[SALIDA CASETA:`, `[ENTRADA CASETA:`, `[REINGRESO CASETA:` o `[REGRESADO EN PUERTA:`.
- Con sello físico **no se puede cancelar** (`cancelarSolicitudPermiso` lanza error) y la UI (`MisPermisos.jsx`, `TablaHistorial.jsx`) oculta el botón de cancelar.
- Un retardo con sello tampoco puede sustituirse por una falta del mismo día.

## Convenciones
- Fecha "hoy" siempre en hora local: `obtenerFechaLocalHoyISO()` (no `new Date().toISOString()` directo).
- Antes de dictaminar, re-leer el estado del permiso en BD y abortar si ya está en `autorizado/aprobado/completado_caseta/rechazado/cancelado`.
- En cada función, nombrar con sufijo propio las variables locales (p. ej. `partesNomRech` en `rechazarSolicitudPermiso`) y no referenciar variables declaradas en otra función.
