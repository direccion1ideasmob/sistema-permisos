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
    pasosEmp.push(jefeObj ? nomJefe : 'Sub-jefa Área');
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