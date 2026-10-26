// Utilidad central para formatear "Apellido Paterno Apellido Materno, Nombre(s)"
// y ordenar alfabéticamente por Apellido Paterno en todas las listas del sistema.

const PARTICULAS = new Set([
  'DE', 'DEL', 'LA', 'LAS', 'LOS', 'SAN', 'SANTA', 'VON', 'VAN', 'MC', 'MAC', 'Y'
]);

// Segundos nombres frecuentes en México: evita que en personas con 2 nombres y 1 solo apellido
// (ej. "Ricardo Israel Morua") se tome el segundo nombre ("Israel") como apellido paterno.
const SEGUNDOS_NOMBRES_COMUNES = new Set([
  'ISRAEL', 'ANGEL', 'MIGUEL', 'CESAR', 'JULIO', 'CARMEN', 'IRENE', 'BERENICE',
  'GUADALUPE', 'MARIA', 'JOSE', 'JUAN', 'CARLOS', 'LUIS', 'FERNANDO', 'FERNANDA',
  'ALEJANDRO', 'ALEJANDRA', 'ANTONIO', 'MANUEL', 'FRANCISCO', 'JAVIER', 'JESUS',
  'DAVID', 'DANIEL', 'EDUARDO', 'ENRIQUE', 'ALBERTO', 'ROBERTO', 'RICARDO',
  'ARTURO', 'SERGIO', 'JORGE', 'ARMANDO', 'RAUL', 'OMAR', 'IVAN', 'OSCAR',
  'ADRIAN', 'GERARDO', 'GUSTAVO', 'HUGO', 'MAURICIO', 'PATRICIA', 'VERONICA',
  'ELIZABETH', 'LETICIA', 'GABRIELA', 'DANIELA', 'ANDREA', 'PAOLA', 'KARLA',
  'LAURA', 'MONICA', 'CLAUDIA', 'SANDRA', 'ADRIANA', 'BEATRIZ', 'ROCIO',
  'ESMERALDA', 'VALERIA', 'VALERI', 'JAZMIN', 'JOANA', 'VICTORIA', 'NORA'
]);

const aTituloToken = (w = '') => {
  const siglas = ['CNC', 'RH', 'TI', 'IMSS', 'NOM'];
  const up = w.toUpperCase();
  if (siglas.includes(up)) return up;
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
};

const normalizarClave = (str = '') =>
  String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();

export const descomponerNombreMexicano = (entrada = '', objUsuario = null) => {
  const u = (entrada && typeof entrada === 'object') ? entrada : objUsuario;

  // 1. Si tenemos las columnas explícitas apellido_paterno y nombre de la BD, son 100% exactas
  if (u && u.apellido_paterno && u.nombre) {
    const apPat = String(u.apellido_paterno || '').trim().split(/\s+/).filter(Boolean).map(aTituloToken).join(' ');
    const apMat = String(u.apellido_materno || '').trim().split(/\s+/).filter(Boolean).map(aTituloToken).join(' ');
    const nom = String(u.nombre || '').trim().split(/\s+/).filter(Boolean).map(aTituloToken).join(' ');
    const apellidos = [apPat, apMat].filter(Boolean).join(' ');
    const completoInvertido = nom ? `${apellidos}, ${nom}` : apellidos;
    return {
      apellidos,
      nombres: nom,
      completoInvertido,
      completoInvertidoUpper: completoInvertido.toUpperCase(),
      claveOrden: normalizarClave(`${apPat} ${apMat} ${nom}`)
    };
  }

  const rawStr = (entrada && typeof entrada === 'object')
    ? (entrada.nombre_completo || '')
    : String(entrada || '');

  const limpio = rawStr.trim().replace(/\s+/g, ' ');
  if (!limpio) {
    return { apellidos: '', nombres: '', completoInvertido: 'Colaborador', completoInvertidoUpper: 'COLABORADOR', claveOrden: '' };
  }

  // 2. Si ya viene con coma ("Pérez López, Juan")
  if (limpio.includes(',')) {
    const [ap, nom] = limpio.split(',').map(s => s.trim());
    const apTit = ap.split(' ').filter(Boolean).map(aTituloToken).join(' ');
    const nomTit = (nom || '').split(' ').filter(Boolean).map(aTituloToken).join(' ');
    const inv = nomTit ? `${apTit}, ${nomTit}` : apTit;
    return {
      apellidos: apTit,
      nombres: nomTit,
      completoInvertido: inv,
      completoInvertidoUpper: inv.toUpperCase(),
      claveOrden: normalizarClave(inv)
    };
  }

  const tokens = limpio.split(' ').filter(Boolean);
  if (tokens.length === 1) {
    const unico = aTituloToken(tokens[0]);
    return {
      apellidos: unico,
      nombres: '',
      completoInvertido: unico,
      completoInvertidoUpper: unico.toUpperCase(),
      claveOrden: normalizarClave(unico)
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
      completoInvertidoUpper: inv.toUpperCase(),
      claveOrden: normalizarClave(`${ap} ${nom}`)
    };
  }

  // Si tiene 3 palabras y la segunda palabra es un nombre propio común (ej. "Ricardo Israel Morua"),
  // entonces tiene 2 nombres y 1 solo apellido.
  if (tokens.length === 3 && SEGUNDOS_NOMBRES_COMUNES.has(normalizarClave(tokens[1]))) {
    const nombres = `${aTituloToken(tokens[0])} ${aTituloToken(tokens[1])}`;
    const apellidos = aTituloToken(tokens[2]);
    const inv = `${apellidos}, ${nombres}`;
    return {
      apellidos,
      nombres,
      completoInvertido: inv,
      completoInvertidoUpper: inv.toUpperCase(),
      claveOrden: normalizarClave(`${apellidos} ${nombres}`)
    };
  }

  // Para 3 o más palabras estándar (Nombre[s] + ApellidoPaterno + ApellidoMaterno)
  const extraerUnApellidoHaciaAtras = (hastaIdx) => {
    let i = hastaIdx - 1;
    while (i > 1 && PARTICULAS.has(normalizarClave(tokens[i - 1]))) {
      i--;
    }
    return i;
  };

  const inicioApMaterno = extraerUnApellidoHaciaAtras(tokens.length);
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
    completoInvertidoUpper: completoInvertido.toUpperCase(),
    claveOrden: normalizarClave(`${apellidos} ${nombres}`)
  };
};

export const formatearApellidosNombre = (entrada = '', objUsuario = null) => {
  return descomponerNombreMexicano(entrada, objUsuario).completoInvertido;
};

export const formatearApellidosNombreMayus = (entrada = '', objUsuario = null) => {
  return descomponerNombreMexicano(entrada, objUsuario).completoInvertidoUpper;
};

export const compararPorApellidoPaterno = (a = '', b = '') => {
  const ca = descomponerNombreMexicano(a).claveOrden;
  const cb = descomponerNombreMexicano(b).claveOrden;
  return ca.localeCompare(cb, 'es', { sensitivity: 'base' });
};
