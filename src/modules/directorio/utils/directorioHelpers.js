export const estandarizar = (texto) => {
  if (!texto) return '';
  return String(texto)
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

export const obtenerBadgeRol = (rol, modoOscuro) => {
  const r = (rol || 'empleado').toLowerCase().trim();

  if (r === 'superadmin') {
    return {
      label: 'DIRECCIÓN GENERAL',
      bg: modoOscuro ? 'rgba(234, 179, 8, 0.15)' : '#fef9c3',
      text: modoOscuro ? '#facc15' : '#a16207',
      border: modoOscuro ? 'rgba(234, 179, 8, 0.35)' : '#fde047'
    };
  }
  if (['gerente_rh', 'gerente_produccion', 'gerente_admin'].includes(r)) {
    const etiquetas = {
      gerente_rh: 'GERENCIA RH',
      gerente_produccion: 'GERENCIA PLANTA',
      gerente_admin: 'GERENCIA ADMÓN'
    };
    return {
      label: etiquetas[r] || 'GERENCIA',
      bg: modoOscuro ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7',
      text: modoOscuro ? '#fbbf24' : '#b45309',
      border: modoOscuro ? 'rgba(245, 158, 11, 0.35)' : '#fcd34d'
    };
  }
  if (r === 'jefe_area') {
    return {
      label: 'JEFE DE ÁREA',
      bg: modoOscuro ? 'rgba(59, 130, 246, 0.15)' : '#dbeafe',
      text: modoOscuro ? '#60a5fa' : '#1d4ed8',
      border: modoOscuro ? 'rgba(59, 130, 246, 0.35)' : '#93c5fd'
    };
  }
  if (r === 'rh_nominas') {
    return {
      label: 'TITULAR NÓMINAS',
      bg: modoOscuro ? 'rgba(139, 92, 246, 0.15)' : '#ede9fe',
      text: modoOscuro ? '#a78bfa' : '#6d28d9',
      border: modoOscuro ? 'rgba(139, 92, 246, 0.35)' : '#c4b5fd'
    };
  }
  if (r === 'caseta') {
    return {
      label: 'CONTROL ACCESOS',
      bg: modoOscuro ? 'rgba(14, 165, 233, 0.15)' : '#e0f2fe',
      text: modoOscuro ? '#38bdf8' : '#0369a1',
      border: modoOscuro ? 'rgba(14, 165, 233, 0.35)' : '#7dd3fc'
    };
  }
  return {
    label: 'COLABORADOR',
    bg: modoOscuro ? 'rgba(22, 163, 74, 0.12)' : '#dcfce7',
    text: modoOscuro ? '#4ade80' : '#15803d',
    border: modoOscuro ? 'rgba(22, 163, 74, 0.3)' : '#86efac'
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
