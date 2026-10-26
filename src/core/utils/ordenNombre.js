// Utilidad central para formatear "Apellido Paterno Apellido Materno, Nombre(s)"
// y ordenar alfabéticamente por Apellido Paterno en todas las listas del sistema.

const PARTICULAS = new Set([
  'DE', 'DEL', 'LA', 'LAS', 'LOS', 'SAN', 'SANTA', 'VON', 'VAN', 'MC', 'MAC', 'Y'
]);

const aTituloToken = (w = '') => {
  const siglas = ['CNC', 'RH', 'TI', 'IMSS', 'NOM'];
  const up = w.toUpperCase();
  if (siglas.includes(up)) return up;
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
};

export const descomponerNombreMexicano = (nombreCompleto = '') => {
  const limpio = String(nombreCompleto || '').trim().replace(/\s+/g, ' ');
  if (!limpio) return { apellidos: '', nombres: '', completoInvertido: 'Colaborador', claveOrden: '' };

  // Si ya viene con coma ("Pérez López, Juan"), respetarlo
  if (limpio.includes(',')) {
    const [ap, nom] = limpio.split(',').map(s => s.trim());
    const apTit = ap.split(' ').filter(Boolean).map(aTituloToken).join(' ');
    const nomTit = (nom || '').split(' ').filter(Boolean).map(aTituloToken).join(' ');
    const inv = nomTit ? `${apTit}, ${nomTit}` : apTit;
    return {
      apellidos: apTit,
      nombres: nomTit,
      completoInvertido: inv,
      claveOrden: inv.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
    };
  }

  const tokens = limpio.split(' ').filter(Boolean);
  if (tokens.length === 1) {
    const unico = aTituloToken(tokens[0]);
    return {
      apellidos: unico,
      nombres: '',
      completoInvertido: unico,
      claveOrden: unico.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
    };
  }

  if (tokens.length === 2) {
    const nom = aTituloToken(tokens[0]);
    const ap = aTituloToken(tokens[1]);
    const inv = `${ap}, ${nom}`;
    return {
      apellidos: ap,
      nombres: nom,
      completoInvertido: inv,
      claveOrden: inv.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
    };
  }

  // Para 3 o más palabras: extraer los 2 apellidos del final (incluyendo partículas como "De la", "Del")
  let idxFin = tokens.length;
  const extraerUnApellidoHaciaAtras = (hastaIdx) => {
    let i = hastaIdx - 1;
    while (i > 1 && PARTICULAS.has(tokens[i - 1].toUpperCase())) {
      i--;
    }
    return i;
  };

  const inicioApMaterno = extraerUnApellidoHaciaAtras(idxFin);
  let inicioApPaterno = inicioApMaterno;
  if (inicioApMaterno > 1) {
    inicioApPaterno = extraerUnApellidoHaciaAtras(inicioApMaterno);
  }

  const nombresArr = tokens.slice(0, inicioApPaterno).map(aTituloToken);
  const apellidosArr = tokens.slice(inicioApPaterno).map(aTituloToken);

  const apellidos = apellidosArr.join(' ');
  const nombres = nombresArr.join(' ');
  const completoInvertido = nombres ? `${apellidos}, ${nombres}` : apellidos;

  return {
    apellidos,
    nombres,
    completoInvertido,
    claveOrden: completoInvertido.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
  };
};

export const formatearApellidosNombre = (nombreCompleto = '') => {
  return descomponerNombreMexicano(nombreCompleto).completoInvertido;
};

export const compararPorApellidoPaterno = (nombreA = '', nombreB = '') => {
  const a = descomponerNombreMexicano(nombreA).claveOrden;
  const b = descomponerNombreMexicano(nombreB).claveOrden;
  return a.localeCompare(b, 'es', { sensitivity: 'base' });
};
