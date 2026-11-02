export const estandarizar = (texto) => {
  if (!texto) return '';
  return String(texto)
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

export const ROLES_VALIDADOR_SUPERIOR = [
  'gerente_rh',
  'gerente_produccion',
  'gerente_admin',
  'gerente_division',
  'validador_superior'
];

export const ROLES_JEFATURA_DEPARTAMENTO = [
  'jefe_area',
  'encargado',
  'rh_nominas',
  ...ROLES_VALIDADOR_SUPERIOR,
  'superadmin'
];

export const esRolValidadorSuperior = (rol) => {
  const r = (rol || '').toLowerCase().trim();
  return ROLES_VALIDADOR_SUPERIOR.includes(r);
};

export const esRolMando = (rol) => {
  const r = (rol || '').toLowerCase().trim();
  return ROLES_JEFATURA_DEPARTAMENTO.includes(r);
};

// Formateador para el Organigrama: NOMBRE(S) + APELLIDOS
export const formatearNombreNaturalMayus = (u) => {
  if (!u) return '';
  if (typeof u === 'string') return u.trim().toUpperCase();
  const nom = (u.nombre || '').trim();
  const pat = (u.apellido_paterno || '').trim();
  const mat = (u.apellido_materno || '').trim();
  if (nom || pat) {
    return [nom, pat, mat].filter(Boolean).join(' ').toUpperCase();
  }
  return (u.nombre_completo || '').trim().toUpperCase();
};

export const compararPorNombreNatural = (a, b) => {
  const nomA = formatearNombreNaturalMayus(a);
  const nomB = formatearNombreNaturalMayus(b);
  return nomA.localeCompare(nomB, 'es', { sensitivity: 'base' });
};

export const obtenerBadgeRol = (rol, modoOscuro) => {
  const r = (rol || 'empleado').toLowerCase().trim();

  if (r === 'superadmin') {
    return {
      label: 'DIRECCIÓN',
      accentBar: '#eab308',
      bg: modoOscuro ? 'rgba(234, 179, 8, 0.12)' : '#fefce8',
      text: modoOscuro ? '#facc15' : '#a16207',
      border: modoOscuro ? 'rgba(234, 179, 8, 0.3)' : '#fde047'
    };
  }
  if (ROLES_VALIDADOR_SUPERIOR.includes(r)) {
    const etiquetas = {
      gerente_rh: 'GERENCIA RH',
      gerente_produccion: 'GERENCIA PLANTA',
      gerente_admin: 'GERENCIA ADMÓN',
      gerente_division: 'VALIDADOR DIVISIÓN',
      validador_superior: 'VALIDADOR SUPERIOR'
    };
    return {
      label: etiquetas[r] || 'GERENCIA / VALIDADOR',
      accentBar: '#f59e0b',
      bg: modoOscuro ? 'rgba(245, 158, 11, 0.12)' : '#fffbeb',
      text: modoOscuro ? '#fbbf24' : '#b45309',
      border: modoOscuro ? 'rgba(245, 158, 11, 0.3)' : '#fcd34d'
    };
  }
  if (r === 'jefe_area') {
    return {
      label: 'JEFATURA DEPTO',
      accentBar: '#16a34a',
      bg: modoOscuro ? 'rgba(22, 163, 74, 0.12)' : '#f0fdf4',
      text: modoOscuro ? '#4ade80' : '#15803d',
      border: modoOscuro ? 'rgba(22, 163, 74, 0.3)' : '#bbf7d0'
    };
  }
  if (r === 'encargado' || r === 'rh_nominas') {
    const etiquetas = {
      encargado: 'SUPERVISOR SUBÁREA',
      rh_nominas: 'TITULAR NÓMINAS'
    };
    return {
      label: etiquetas[r] || 'SUPERVISOR',
      accentBar: '#0284c7',
      bg: modoOscuro ? 'rgba(2, 132, 199, 0.14)' : '#f0f9ff',
      text: modoOscuro ? '#38bdf8' : '#0369a1',
      border: modoOscuro ? 'rgba(2, 132, 199, 0.32)' : '#bae6fd'
    };
  }
  return {
    label: r === 'caseta' ? 'ACCESOS' : 'COLABORADOR',
    accentBar: modoOscuro ? '#525252' : '#cbd5e1',
    bg: modoOscuro ? '#171717' : '#f5f5f5',
    text: modoOscuro ? '#a3a3a3' : '#525252',
    border: modoOscuro ? '#404040' : '#e5e5e5'
  };
};

export const obtenerNombreCorto = (u) => {
  if (!u) return '';
  if (u.nombre && u.apellido_paterno) {
    const primerNombre = u.nombre.trim().split(/\s+/)[0];
    return `${primerNombre} ${u.apellido_paterno.trim()}`.toUpperCase();
  }
  const partes = String(u.nombre_completo || '').trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 2) return partes.join(' ').toUpperCase();
  return `${partes[0]} ${partes[partes.length - 2]}`.toUpperCase();
};

// Ruta general del departamento (para cabeceras del árbol y vista previa del departamento)
export const describirRutaEcualizador = (depto, usuarios = []) => {
  if (!depto) {
    return {
      rutaEmpleados: 'Directo a RH',
      rutaJefe: 'Directo a RH',
      jefeObj: null,
      gerenteObj: null
    };
  }

  const jefeObj = depto.jefe_id ? usuarios.find(u => u.id === depto.jefe_id) : null;
  const gerenteObj = depto.gerente_id ? usuarios.find(u => u.id === depto.gerente_id) : null;
  const rhObj = usuarios.find(u => u.rol === 'gerente_rh' && u.activo !== false);

  const nomJefe = jefeObj ? obtenerNombreCorto(jefeObj) : 'Jefe Directo';
  const nomGerente = gerenteObj ? obtenerNombreCorto(gerenteObj) : 'Gerencia';
  const esGerenteMismoRH = gerenteObj && (gerenteObj.rol === 'gerente_rh' || (rhObj && gerenteObj.id === rhObj.id));

  const pasosEmp = [];
  if (depto.emp_requiere_jefe !== false && (jefeObj || depto.nombre === 'RECURSOS HUMANOS')) {
    pasosEmp.push(jefeObj ? nomJefe : 'Jefe Inmediato');
  }
  if (depto.emp_requiere_gerente === true && gerenteObj && !esGerenteMismoRH && (!jefeObj || gerenteObj.id !== jefeObj.id)) {
    pasosEmp.push(nomGerente);
  }
  pasosEmp.push('RH');

  const pasosJefe = [];
  if (depto.jefe_requiere_gerente !== false && gerenteObj && !esGerenteMismoRH && (!jefeObj || gerenteObj.id !== jefeObj.id)) {
    pasosJefe.push(nomGerente);
  }
  pasosJefe.push('RH');

  return {
    rutaEmpleados: pasosEmp.join(' → '),
    rutaJefe: pasosJefe.join(' → '),
    jefeObj,
    gerenteObj
  };
};

// Ruta exacta e individual de un colaborador (respeta si se le cambió el Jefe Inmediato en su tarjeta)
export const describirRutaColaborador = (colaborador, depto, usuarios = []) => {
  if (!colaborador) return 'Directo a RH';

  const userId = colaborador.id;
  const rolSol = (colaborador.rol || 'empleado').toLowerCase().trim();
  const reportaAId = colaborador.reporta_a_id || null;

  const rhObj = usuarios.find(u => u.rol === 'gerente_rh' && u.activo !== false);
  const gerenteObj = depto?.gerente_id ? usuarios.find(u => u.id === depto.gerente_id) : null;
  const esGerenteMismoRH = gerenteObj && (gerenteObj.rol === 'gerente_rh' || (rhObj && gerenteObj.id === rhObj.id));

  // 1. Si el colaborador es un Gerente / Validador Superior
  const esValidador =
    esRolValidadorSuperior(rolSol) ||
    rolSol === 'superadmin' ||
    (depto?.gerente_id && depto.gerente_id === userId);

  if (esValidador) {
    return rolSol === 'gerente_rh' ? 'Autorización Directa RH' : 'RH';
  }

  // 2. Si el colaborador es el Jefe Titular del Departamento (o tiene subordinados a su cargo)
  const tieneSubordinados = usuarios.some(u => u.activo !== false && u.reporta_a_id === userId && u.id !== userId);
  const esJefe =
    (depto?.jefe_id && depto.jefe_id === userId) ||
    rolSol === 'jefe_area' ||
    rolSol === 'rh_nominas' ||
    tieneSubordinados;

  if (esJefe) {
    const pasosJefe = [];
    // Si a este jefe se le asignó un superior específico distinto al gerente del depto, mostrarlo
    if (reportaAId && reportaAId !== userId) {
      const supJefe = usuarios.find(u => u.id === reportaAId);
      if (supJefe && supJefe.rol !== 'gerente_rh' && (!rhObj || supJefe.id !== rhObj.id)) {
        if (depto?.jefe_requiere_gerente !== false) {
          pasosJefe.push(obtenerNombreCorto(supJefe));
        }
      }
    } else if (depto?.jefe_requiere_gerente !== false && gerenteObj && !esGerenteMismoRH && gerenteObj.id !== userId) {
      pasosJefe.push(obtenerNombreCorto(gerenteObj));
    }
    pasosJefe.push('RH');
    return pasosJefe.join(' → ');
  }

  // 3. Es un Empleado / Operador: priorizar SIEMPRE su reporta_a_id individual si lo tiene
  const pasosEmp = [];
  const swEmpRequiereJefe = depto ? depto.emp_requiere_jefe !== false : true;
  const swEmpRequiereGerente = depto ? Boolean(depto.emp_requiere_gerente) : false;

  let jefeEfectivoObj = null;
  if (reportaAId && reportaAId !== userId) {
    jefeEfectivoObj = usuarios.find(u => u.id === reportaAId) || null;
  } else if (swEmpRequiereJefe && depto?.jefe_id && depto.jefe_id !== userId) {
    jefeEfectivoObj = usuarios.find(u => u.id === depto.jefe_id) || null;
  }

  if (jefeEfectivoObj) {
    const esSuJefeDirectoRH = jefeEfectivoObj.rol === 'gerente_rh' || (rhObj && jefeEfectivoObj.id === rhObj.id);
    const esSuJefeDirectoElGerente = gerenteObj && jefeEfectivoObj.id === gerenteObj.id;

    if (!esSuJefeDirectoRH) {
      // Si su jefe inmediato individual o de depto está activo
      if (reportaAId || swEmpRequiereJefe) {
        pasosEmp.push(obtenerNombreCorto(jefeEfectivoObj));
      }
      // Agregar Gerencia en Firma 2 si el switch de empleados->gerente está activo y no es la misma persona
      if (swEmpRequiereGerente && gerenteObj && !esGerenteMismoRH && !esSuJefeDirectoElGerente) {
        pasosEmp.push(obtenerNombreCorto(gerenteObj));
      }
    }
  } else if (swEmpRequiereGerente && gerenteObj && !esGerenteMismoRH) {
    pasosEmp.push(obtenerNombreCorto(gerenteObj));
  }

  pasosEmp.push('RH');
  return pasosEmp.join(' → ');
};

export const obtenerClaveOrdenApellido = (u) => {
  if (u?.apellido_paterno) {
    return `${u.apellido_paterno} ${u.apellido_materno || ''} ${u.nombre || ''}`.trim().toUpperCase();
  }
  const nombreCompleto = u?.nombre_completo || '';
  const partes = nombreCompleto.trim().split(/\s+/);
  if (partes.length <= 1) return nombreCompleto.toUpperCase();
  if (partes.length === 2) return `${partes[1]} ${partes[0]}`.toUpperCase();
  return `${partes.slice(-2).join(' ')} ${partes.slice(0, -2).join(' ')}`.toUpperCase();
};

export const desglosarNombreExistente = (user = {}) => {
  if (user.nombre || user.apellido_paterno) {
    return {
      nombre: user.nombre || '',
      apellido_paterno: user.apellido_paterno || '',
      apellido_materno: user.apellido_materno || ''
    };
  }
  const partes = (user.nombre_completo || '').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return { nombre: '', apellido_paterno: '', apellido_materno: '' };
  if (partes.length === 1) return { nombre: partes[0], apellido_paterno: '', apellido_materno: '' };
  if (partes.length === 2) return { nombre: partes[0], apellido_paterno: partes[1], apellido_materno: '' };
  return {
    nombre: partes.slice(0, -2).join(' '),
    apellido_paterno: partes[partes.length - 2],
    apellido_materno: partes[partes.length - 1]
  };
};