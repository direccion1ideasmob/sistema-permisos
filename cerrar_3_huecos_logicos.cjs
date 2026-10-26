const fs = require('fs');

// =========================================================================
// 1. permisosService.js:
//    Cerrar los 3 huecos en crearNuevaSolicitudPermiso:
//    - Hueco 1: No permitir pedir Retardo si ya tiene entrada registrada en
//      asistencias_caseta ese día o si ya tiene un pase de Salida activo ese día.
//    - Hueco 2: No permitir duplicar un pase de Salida si ya tiene una Salida
//      activa ese día (salvo que haya sido salida con regreso y YA tenga sello
//      de [REINGRESO CASETA]).
//    - Hueco 3: No permitir pedir Salida si tiene un Retardo aún pendiente de
//      autorización ('en_firmas'). Sí permitir Salida cuando el Retardo ya está
//      autorizado y no fue regresado a casa.
// =========================================================================
const rutaPerm = 'src/modules/permisos/services/permisosService.js';
let perm = fs.readFileSync(rutaPerm, 'utf8');

const inicioCoherencia = `  // === VALIDACIÓN ESTRICTA DE COHERENCIA DIARIA DEL COLABORADOR ===`;
const finCoherencia = `  const [{ data: depto, error: errD }, { data: usuarioSolicitante }, { data: todosEmpDepto }] = await Promise.all([`;

const idx1 = perm.indexOf(inicioCoherencia);
const idx2 = perm.indexOf(finCoherencia);

if (idx1 === -1 || idx2 === -1) {
  throw new Error('No se encontraron los delimitadores en permisosService.js');
}

const bloqueCoherenciaBlindado = `  // === VALIDACIÓN ESTRICTA DE COHERENCIA DIARIA DEL COLABORADOR ===
  const fechaInicioNueva = fechaPermiso;
  const fechaFinNueva = tipoPermiso === 'vacaciones' ? (fechaFinVacaciones || fechaPermiso) : fechaPermiso;

  const [{ data: pasesUsuario }, { data: asistenciaDia }] = await Promise.all([
    supabase
      .from('permisos')
      .select('id, folio, fecha_permiso, fecha_fin, tipo_permiso, estado_general, pago, observaciones')
      .eq('usuario_id', userId)
      .lte('fecha_permiso', fechaFinNueva),
    supabase
      .from('asistencias_caseta')
      .select('hora_entrada, hora_salida')
      .eq('usuario_id', userId)
      .eq('fecha', fechaPermiso)
      .maybeSingle()
  ]);

  const activosMismaFecha = (pasesUsuario || []).filter(p => {
    const finPase = p.fecha_fin || p.fecha_permiso;
    const seTraslapa = p.fecha_permiso <= fechaFinNueva && finPase >= fechaInicioNueva;
    if (!seTraslapa) return false;

    const pagoL = String(p.pago || '').toLowerCase();
    const obsL = String(p.observaciones || '');
    const esCancelado = pagoL === 'cancelado' || /CANCELADO por/i.test(obsL);
    if (esCancelado) return false;

    const esRegresoCasa = pagoL.includes('regresa') || /\\[REGRESADO EN PUERTA:/i.test(obsL);
    if (p.estado_general === 'rechazado' && !esRegresoCasa) return false;

    return true;
  });

  const paseRegresadoACasa = activosMismaFecha.find(p =>
    (p.pago || '').toLowerCase().includes('regresa') || /\\[REGRESADO EN PUERTA:/i.test(p.observaciones || '')
  );
  const paseAusenciaCompleta = activosMismaFecha.find(p =>
    ['falta', 'vacaciones'].includes((p.tipo_permiso || '').toLowerCase())
  );
  const retardoPrevio = activosMismaFecha.find(p => (p.tipo_permiso || '').toLowerCase() === 'retardo');
  const salidasPrevias = activosMismaFecha.filter(p => (p.tipo_permiso || '').toLowerCase() === 'salida');

  // 1) Si ya fue regresado a casa en esa fecha (Falta por retardo) -> Bloquear CUALQUIER solicitud
  if (paseRegresadoACasa) {
    throw new Error(\`No es posible generar otro permiso para esta fecha porque ya existe un dictamen de retiro de planta (Falta por retardo • Folio \${paseRegresadoACasa.folio}).\`);
  }

  // 2) Si ya tiene una Falta o Vacaciones en esa fecha -> Bloquear CUALQUIER solicitud
  if (paseAusenciaCompleta) {
    const etiquetaExistente = (paseAusenciaCompleta.tipo_permiso || '').toUpperCase();
    throw new Error(\`No es posible registrar este permiso porque ya existe un registro de \${etiquetaExistente} (\${paseAusenciaCompleta.folio}) para esta fecha.\`);
  }

  // 3) HUECO 1: Si pide un RETARDO pero YA registró entrada normal en Caseta o YA tiene un pase de Salida ese día
  if (tipoPermiso === 'retardo') {
    if (retardoPrevio) {
      throw new Error(\`Ya existe un registro de retardo (\${retardoPrevio.folio}) para esta fecha. No es posible generar dos retardos el mismo día.\`);
    }
    if (asistenciaDia?.hora_entrada) {
      throw new Error(\`No es posible solicitar un Retardo para esta fecha porque ya cuentas con registro de entrada en planta (\${asistenciaDia.hora_entrada} hrs).\`);
    }
    if (salidasPrevias.length > 0) {
      throw new Error(\`No es posible solicitar un Retardo porque ya tienes un pase de Salida (\${salidasPrevias[0].folio}) registrado para esta fecha.\`);
    }
  }

  // 4) HUECO 2 y HUECO 3: Reglas al solicitar una SALIDA ANTICIPADA
  if (tipoPermiso === 'salida') {
    if (asistenciaDia?.hora_salida) {
      throw new Error(\`No es posible solicitar una Salida porque ya registraste tu salida definitiva de planta hoy (\${asistenciaDia.hora_salida} hrs).\`);
    }
    // HUECO 3: Si tiene un retardo que todavía está en_firmas (esperando autorización), no puede pedir salida hasta que se autorice su entrada
    if (retardoPrevio && retardoPrevio.estado_general === 'en_firmas') {
      throw new Error(\`Tienes un pase de Retardo (\${retardoPrevio.folio}) pendiente de autorización. Podrás solicitar una Salida una vez que tu entrada haya sido autorizada.\`);
    }
    // HUECO 2: No permitir 2 salidas activas el mismo día (a menos que una salida temporal previa ya haya reingresado por Caseta)
    const salidaAbierta = salidasPrevias.find(s => !/\\[REINGRESO CASETA:/i.test(String(s.observaciones || '')));
    if (salidaAbierta) {
      throw new Error(\`Ya cuentas con un pase de Salida activo (\${salidaAbierta.folio}) para esta fecha. No es posible duplicar pases de salida.\`);
    }
  }

  // 5) Si pide FALTA o VACACIONES pero hoy ya entró a planta o ya tiene sello en Caseta -> Bloquear
  if (tipoPermiso === 'falta' || tipoPermiso === 'vacaciones') {
    if (asistenciaDia?.hora_entrada) {
      throw new Error(\`No es posible registrar una \${tipoPermiso} para esta fecha porque ya tienes registro de entrada en planta (\${asistenciaDia.hora_entrada} hrs).\`);
    }
    if (salidasPrevias.some(s => tieneSelloFisicoCaseta(s))) {
      throw new Error(\`No es posible registrar una \${tipoPermiso} porque ya tienes movimientos registrados en Caseta para esta fecha.\`);
    }
    if (retardoPrevio && tieneSelloFisicoCaseta(retardoPrevio)) {
      throw new Error(\`No es posible registrar una \${tipoPermiso} para hoy porque ya tienes un registro de llegada en Caseta (\${retardoPrevio.folio}).\`);
    }
    // Si tenía un retardo o salida previa ese día SIN sello físico de caseta y ahora reporta Falta, cancelar el pase previo no utilizado
    const pasesSinSello = [...(retardoPrevio ? [retardoPrevio] : []), ...salidasPrevias].filter(p => !tieneSelloFisicoCaseta(p));
    for (const pPrev of pasesSinSello) {
      await supabase
        .from('permisos')
        .update({
          estado_general: 'rechazado',
          pago: 'Cancelado',
          observaciones: \`\${pPrev.observaciones || ''} | CANCELADO por Sistema: Sustituido por reporte de \${tipoPermiso.toUpperCase()} del mismo día\`
        })
        .eq('id', pPrev.id);
    }
  }

`;

perm = perm.slice(0, idx1) + bloqueCoherenciaBlindado + perm.slice(idx2);
fs.writeFileSync(rutaPerm, perm, 'utf8');
console.log('✅ permisosService.js: 3 huecos lógicos cerrados.');

// =========================================================================
// 2. FormularioSolicitud.jsx:
//    Reflejar exactamente las mismas 3 reglas en el verificador en vivo
//    para que el usuario vea el aviso desde que selecciona el tipo de permiso.
// =========================================================================
const rutaForm = 'src/modules/permisos/solicitud/FormularioSolicitud.jsx';
let form = fs.readFileSync(rutaForm, 'utf8');

const inicioEffectForm = `  useEffect(() => {
    if (!userId || !fechaPermiso) {
      setBloqueoFechaActiva(null);
      return;
    }`;
const finEffectForm = `  useEffect(() => {
    obtenerHoraLimiteTolerancia().then((h) => {`;

const idxF1 = form.indexOf(inicioEffectForm);
const idxF2 = form.indexOf(finEffectForm);

if (idxF1 === -1 || idxF2 === -1) {
  throw new Error('No se encontraron los delimitadores en FormularioSolicitud.jsx');
}

const nuevoEffectForm = `  useEffect(() => {
    if (!userId || !fechaPermiso) {
      setBloqueoFechaActiva(null);
      return;
    }
    let cancelado = false;
    (async () => {
      try {
        const finConsulta = tipoPermiso === 'vacaciones' && fechaFinVacaciones ? fechaFinVacaciones : fechaPermiso;
        const [{ data }, { data: asistHoy }] = await Promise.all([
          supabase
            .from('permisos')
            .select('id, folio, fecha_permiso, fecha_fin, tipo_permiso, estado_general, pago, observaciones')
            .eq('usuario_id', userId)
            .lte('fecha_permiso', finConsulta),
          supabase
            .from('asistencias_caseta')
            .select('hora_entrada, hora_salida')
            .eq('usuario_id', userId)
            .eq('fecha', fechaPermiso)
            .maybeSingle()
        ]);

        if (cancelado) return;
        const activos = (data || []).filter(p => {
          const finP = p.fecha_fin || p.fecha_permiso;
          if (!(p.fecha_permiso <= finConsulta && finP >= fechaPermiso)) return false;
          const pagoL = String(p.pago || '').toLowerCase();
          const obsL = String(p.observaciones || '');
          if (pagoL === 'cancelado' || /CANCELADO por/i.test(obsL)) return false;
          const esRegreso = pagoL.includes('regresa') || /\\[REGRESADO EN PUERTA:/i.test(obsL);
          if (p.estado_general === 'rechazado' && !esRegreso) return false;
          return true;
        });

        const regCasa = activos.find(p => (p.pago || '').toLowerCase().includes('regresa') || /\\[REGRESADO EN PUERTA:/i.test(p.observaciones || ''));
        const faltaOVac = activos.find(p => ['falta', 'vacaciones'].includes((p.tipo_permiso || '').toLowerCase()));
        const retardoHoy = activos.find(p => (p.tipo_permiso || '').toLowerCase() === 'retardo');
        const salidasHoy = activos.filter(p => (p.tipo_permiso || '').toLowerCase() === 'salida');
        const salidaAbierta = salidasHoy.find(s => !/\\[REINGRESO CASETA:/i.test(String(s.observaciones || '')));

        if (regCasa) {
          setBloqueoFechaActiva(\`Jornada cerrada para el \${fechaPermiso}: Ya cuentas con un dictamen de retiro en puerta (Falta por retardo • Folio \${regCasa.folio}). No es posible solicitar otro permiso ni salida en esta fecha.\`);
        } else if (faltaOVac) {
          setBloqueoFechaActiva(\`Ya cuentas con un registro de \${(faltaOVac.tipo_permiso || '').toUpperCase()} (\${faltaOVac.folio}) para el \${fechaPermiso}. No es posible registrar otro permiso en la misma fecha.\`);
        } else if (tipoPermiso === 'retardo' && retardoHoy) {
          setBloqueoFechaActiva(\`Ya tienes un pase de Retardo (\${retardoHoy.folio}) registrado para el \${fechaPermiso}.\`);
        } else if (tipoPermiso === 'retardo' && asistHoy?.hora_entrada) {
          setBloqueoFechaActiva(\`Ya cuentas con registro de entrada en planta (\${asistHoy.hora_entrada} hrs) el \${fechaPermiso}. No es posible solicitar un Retardo.\`);
        } else if (tipoPermiso === 'retardo' && salidasHoy.length > 0) {
          setBloqueoFechaActiva(\`Ya tienes un pase de Salida (\${salidasHoy[0].folio}) para el \${fechaPermiso}. No es posible solicitar un Retardo.\`);
        } else if (tipoPermiso === 'salida' && asistHoy?.hora_salida) {
          setBloqueoFechaActiva(\`Ya registraste tu salida definitiva de planta (\${asistHoy.hora_salida} hrs) el \${fechaPermiso}.\`);
        } else if (tipoPermiso === 'salida' && retardoHoy && retardoHoy.estado_general === 'en_firmas') {
          setBloqueoFechaActiva(\`Tienes un pase de Retardo (\${retardoHoy.folio}) pendiente de autorización. Podrás solicitar una Salida una vez que se autorice tu acceso.\`);
        } else if (tipoPermiso === 'salida' && salidaAbierta) {
          setBloqueoFechaActiva(\`Ya cuentas con un pase de Salida activo (\${salidaAbierta.folio}) para el \${fechaPermiso}.\`);
        } else if ((tipoPermiso === 'falta' || tipoPermiso === 'vacaciones') && asistHoy?.hora_entrada) {
          setBloqueoFechaActiva(\`No es posible registrar \${tipoPermiso.toUpperCase()} para el \${fechaPermiso} porque ya tienes registro de entrada en planta (\${asistHoy.hora_entrada} hrs).\`);
        } else {
          setBloqueoFechaActiva(null);
        }
      } catch (_) {}
    })();
    return () => { cancelado = true; };
  }, [userId, fechaPermiso, fechaFinVacaciones, tipoPermiso]);

`;

form = form.slice(0, idxF1) + nuevoEffectForm + form.slice(idxF2);
fs.writeFileSync(rutaForm, form, 'utf8');
console.log('✅ FormularioSolicitud.jsx: validación en vivo sincronizada con los 3 huecos.');
