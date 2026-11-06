# Reglas de Permisos y Caseta — v1.0 (aprobada)

> Especificación de negocio acordada con el responsable del sistema el 2026-11-06.
> Describe **cómo debe funcionar** el sistema. Donde el código actual difiera, manda este documento
> (ver "Pendientes de código" al final).

---

## 0. Principios

1. **Caseta registra lo que ve. Las firmas deciden. RH tiene la última palabra en todo.**
2. Toda llegada y toda salida física se registra con su **hora real**, aunque la persona termine regresando a su casa.
3. **Nadie entra tarde ni sale antes de la hora sin un pase autorizado.** Si no hay pase, la persona espera en la puerta.
4. RH puede corregir o anular cualquier cosa, también lo que ya tiene sello de Caseta y también días pasados.
   **El sello nunca se borra** y siempre queda una nota de quién hizo el cambio y por qué.
5. Antes de cancelar un pase, el sistema vuelve a leer cómo está en ese momento.
6. Política de la empresa: **en un retardo, el trabajador siempre se presenta en Caseta**, esté autorizado o rechazado.
   La decisión se aplica en la puerta; nadie se regresa desde su casa.

---

## 1. Reloj de RH (lo único que se configura)

| Dato | Ejemplo | Para qué sirve |
|---|---|---|
| **Inicio de turno (I)** | 07:00 | Desde aquí se cuentan las horas de retardo. |
| **Tolerancia (T)** | 15 min | Margen de gracia para entrar. |
| **Entrada límite (E = I + T)** | 07:15 | Si llega a esa hora o antes, llega puntual. Si llega después, es retardo. |
| **Salida oficial (S)** | 17:00 | Antes de esa hora se necesita pase para salir. A esa hora corre el corte del día. |

- Horas de retardo = **hora real de llegada − I**. Ejemplo: llega a las 7:40 → 40 min.
- Si RH mueve el horario (por ejemplo, un día especial), todo se mueve junto. No hay horas fijas en el código.
- Márgenes fijos de Caseta (no se configuran):
  **+15 min** sobre la hora prometida de llegada, **+15 min** sobre la hora prometida de regreso
  y **±20 min** sobre la hora de salida del pase.

---

## 2. Estados del día de una persona

| Estado | Significado |
|---|---|
| **Sin llegar** | Todavía no pasa por Caseta. |
| **En puerta** | Está detenida en Caseta mientras alguien firma. |
| **En planta** | Está trabajando. |
| **Fuera con pase** | Salió con un pase que incluye regreso. |
| **Ausente justificado** | Tiene falta o vacaciones ese día. |
| **Regresado a casa** | Se presentó en Caseta y no lo dejaron pasar. El día se cierra. |
| **Salió** | Ya se fue: terminó su turno o salió con pase definitivo. El día se cierra. |

---

## 3. Qué puede pedir el empleado

| Ya tiene… | Retardo | Salida | Falta / Vacaciones |
|---|---|---|---|
| Nada | ✅ (hora prometida > E) | ✅ (antes de S) | ✅ |
| Retardo (sin sello) | ❌ solo uno por día | ✅ si el retardo ya está autorizado y la salida es después de su hora de llegada | ✅ **reemplaza el retardo** (el sistema avisa antes de enviar) |
| Salida (sin sello) | ✅ si la hora de llegada es antes de la salida | ✅ solo cuando la anterior ya regresó, y **sin cruzarse de horario** | ✅ **reemplaza la salida** (el sistema avisa antes de enviar) |
| Falta / Vacaciones | ❌ | ❌ | ❌ |
| Ya entró a planta | ❌ | ✅ | ❌ |
| Día cerrado (regresado o ya salió) | ❌ | ❌ | ❌ |

- Los pases que ya tienen sello de Caseta no se pueden reemplazar.
- **RH puede crear pases a nombre de cualquier colaborador.** Esos pases nacen autorizados.
  Así se resuelven las salidas de emergencia (ver sección 4).

---

## 4. Eventos en la puerta

### Llegada

| Situación | Qué hace Caseta |
|---|---|
| Llega puntual (antes de E), con o sin retardo | **Pasa.** Si tenía retardo, se cancela solo. |
| Retardo autorizado y llega a la hora prometida + 15 min o antes | **Pasa.** Se registra su hora real. |
| Retardo autorizado y llega más de 15 min después de lo prometido | **Se queda en puerta.** Se avisa a todas las firmas; cualquiera puede resolver. |
| Retardo pendiente de firma | Se registra su hora de llegada y **se queda en puerta.** Se avisa a todas las firmas. |
| Retardo rechazado | Tiene que presentarse igual. Se registra su llegada y **se regresa a casa.** Ese día cuenta como falta. |
| Llega tarde sin pase (pase de lista → "DETENER") | Se crea un retardo en puerta con su hora real y **se queda en puerta** hasta que firmen. |
| Ayer no tuvo entrada ni justificación (falta sin aviso según el pase de lista) | **Se queda en puerta aunque llegue puntual.** Si lo dejan pasar, se registra como **reincorporación, no como retardo**. |
| Tiene falta o vacaciones ese día | **Se queda en puerta.** Se avisa a RH y **RH decide**: pasa (se cancela ese día), se ajustan los días, o se regresa a casa. |
| Ya fue regresado hoy | No entra. |

### Salida y regreso

| Situación | Qué hace Caseta |
|---|---|
| Pase autorizado, hora de salida dentro de ±20 min | **Sale.** |
| Pase autorizado, pero sale fuera de ±20 min | **Se queda en puerta** hasta que firmen. |
| Pase pendiente de firma | **No sale.** Espera la firma. |
| No tiene pase y todavía no es S | **No sale.** Tiene que hablar con RH; RH genera el pase y, ya autorizado, puede salir. |
| Ya es S o más tarde | Salida normal de turno. |
| Regresa a la hora prometida + 15 min o antes | **Entra.** Se calculan las horas reales que estuvo fuera. |
| Regresa más de 15 min tarde | **Se queda en puerta.** Si rechazan, se regresa a casa. |
| Salió con pase definitivo y quiere volver | **Se queda en puerta.** Si autorizan, entra y su día se reabre: queda en planta y después puede marcar su salida normal. |

---

## 5. Cancelaciones y decisiones

| Quién | Qué puede hacer |
|---|---|
| **Empleado** | **Salida:** la cancela cuando quiera, mientras no tenga sello. **Retardo:** solo antes de E; después tiene que presentarse en Caseta. **Falta / Vacaciones:** solo antes de E del primer día; después lo cancela RH. |
| **Firmas** | Aprueban o rechazan lo que esté pendiente. Si la persona está en la puerta, cualquiera de las firmas puede resolver y se avisa a las demás (excepto falta o vacaciones en puerta, que decide RH). |
| **RH** | Todo y en cualquier momento, también con sello y también en días pasados, siempre con nota. Crea pases a nombre de otros. Corrige el pase de lista de cualquier día. |
| **Caseta** | Solo registra horas. Lo único que cancela por su cuenta es el retardo de quien llega puntual. |

**Si alguien es regresado a casa:** se cancelan sus salidas de ese día que no tengan sello, y ya no puede pedir nada más para ese día.

---

## 6. Corte del día (a la hora S que fije RH)

**El sistema no convierte nada por su cuenta.** Todo lo que quede abierto pasa a una **bandeja de revisión de RH** con una sugerencia:

| Lo que quedó abierto | Sugerencia para RH |
|---|---|
| Retardo sin ninguna llegada registrada | Marcar falta |
| Alguien detenido en puerta que nadie resolvió | RH decide |
| Salió con pase de regreso y no volvió | Tomarlo como salida definitiva a la hora real |
| Salida autorizada que no se usó | Cancelar el pase |
| Pase que sigue pendiente de firma | RH decide |
| Sin entrada y sin justificación | Falta sin aviso (sale del pase de lista) |

---

## Pendientes de código (diferencias con el sistema actual al 2026-11-06)

Se irán marcando conforme se corrijan. Cuando un punto toque una regla sagrada de `CLAUDE.md`,
esa regla se actualiza en el mismo cambio.

### Prioridad 1 — hoy pueden marcar falta a quien sí vino o dejar ausencias sin registro
- [x] Un retardo pendiente bloquea la tarjeta de Caseta todo el día y no se registra la llegada (`Caseta.jsx:124`, `vigilanciaService.js:187-203, 316-318`).
- [x] "DEJAR PASAR" con retardo autorizado se salta la revisión de llegada puntual y de +15 min (`Caseta.jsx:175-186, 284-287`).
- [x] El corte convierte retardos en falta automáticamente y nunca corre antes de las 17:00. Debe mandar todo a la bandeja de RH y respetar S (`vigilanciaService.js:760, 802-866`).
- [x] El empleado puede cancelar su retardo a cualquier hora; debe ser solo antes de E (`permisosService.js` → `cancelarSolicitudPermiso`, `MisPermisos.jsx`).
- [x] Caseta registra la salida de turno a cualquier hora sin pase (`Caseta.jsx:228`, `registrarAsistenciaLista`).
- [x] Regla sagrada 1: `pago: 'Cancelado'` sin reintento con `'Sin goce'` (`vigilanciaService.js:640, 893`).

### Prioridad 2 — control de RH
- [x] RH no puede crear pases a nombre de otro colaborador (`Solicitar.jsx` / `FormularioSolicitud.jsx`).
- [x] RH no puede cancelar ni corregir pases con sello; el Historial ya envía su rol (hecho junto con el punto 4 de P1); falta permitir sello en `cancelarSolicitudPermiso`. Implica actualizar la regla sagrada 5.
- [ ] El pase de lista de RH solo permite marcar el día de hoy (`VistaAsistenciaDiariaRH.jsx:731`, `registrarAsistenciaLista`).
- [ ] Cuando RH marca la entrada, se cancela el retardo aunque la persona haya llegado tarde (`forzarDirectoRH`).
- [ ] La falta sin aviso de ayer busca un permiso con `SIN AVISO` que nadie crea; debe usar el pase de lista. Además debe registrarse como reincorporación y no como retardo, y solo marcar esa falta (`vigilanciaService.js:84-93, 1104-1125`, `permisosService.js:740-757`).
- [ ] Falta o vacaciones en puerta: hoy decide cualquier firma; debe decidir RH. Al rechazar se pierde el pago original (`permisosService.js:904`) y las vacaciones se cancelan completas (`vigilanciaService.js:636-644`).
- [ ] Reloj de RH: agregar inicio de turno y tolerancia; contar las horas de retardo desde I (`FormularioSolicitud.jsx:253-262`, `vigilanciaService.js:625, 1018`).

### Prioridad 3 — consistencia
- [ ] Reingreso después de una salida definitiva: se vuelve a retener en bucle y no limpia `hora_salida` (`permisosService.js:721-724`, `vigilanciaService.js:564-578, 662`).
- [ ] Una salida retenida por horario deja una hora congelada que contamina el reingreso, y la reautorización desactiva la revisión de +15 min (`vigilanciaService.js:479, 547, 597`).
- [ ] Validar que no se crucen los horarios entre salidas, ni entre retardo y salida. Que vacaciones reemplace igual que falta.
- [ ] Una salida pendiente de firma debe aparecer en Caseta como "espera firma".
- [ ] Folios oficiales duplicados por calcular el consecutivo ordenando por `created_at` (`permisosService.js:400-418`, `vigilanciaService.js:811-818`).
- [ ] Retardo rechazado: el aviso al empleado debe decir "preséntate en Caseta" (política, principio 6).
- [ ] `AprobarDirecto.jsx:214` dice "Regresar a Casa" para cualquier retardo, aunque sea anticipado.
- [ ] Quitar código muerto: `ControlCaseta.jsx`, `TablaRegistrosVig.jsx`, `FormularioAsistencia.jsx`.
