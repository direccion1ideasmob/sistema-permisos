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
      label: 'DIRECCIÓN',
      accentBar: '#eab308',
      bg: modoOscuro ? 'rgba(234, 179, 8, 0.12)' : '#fefce8',
      text: modoOscuro ? '#facc15' : '#a16207',
      border: modoOscuro ? 'rgba(234, 179, 8, 0.3)' : '#fde047'
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
      accentBar: '#f59e0b',
      bg: modoOscuro ? 'rgba(245, 158, 11, 0.12)' : '#fffbeb',
      text: modoOscuro ? '#fbbf24' : '#b45309',
      border: modoOscuro ? 'rgba(245, 158, 11, 0.3)' : '#fcd34d'
    };
  }
  if (r === 'jefe_area' || r === 'rh_nominas' || r === 'encargado') {
    const etiquetas = {
      jefe_area: 'JEFATURA',
      rh_nominas: 'TITULAR NÓMINAS',
      encargado: 'ENCARGADO'
    };
    return {
      label: etiquetas[r] || 'JEFATURA',
      accentBar: '#16a34a',
      bg: modoOscuro ? 'rgba(22, 163, 74, 0.12)' : '#f0fdf4',
      text: modoOscuro ? '#4ade80' : '#15803d',
      border: modoOscuro ? 'rgba(22, 163, 74, 0.3)' : '#bbf7d0'
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
