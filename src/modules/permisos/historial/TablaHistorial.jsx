import { formatearApellidosNombre, compararPorApellidoPaterno } from '../../../core/utils/ordenNombre';
import React, { useState, useMemo } from 'react';
import { cancelarSolicitudPermiso, tieneSelloFisicoCaseta, depurarPermisosCanceladosRH } from '../services/permisosService';
import {
  Search, ChevronLeft, ChevronRight, Printer, CheckSquare, Square,
  FileSpreadsheet, RotateCcw, CheckCircle2, XCircle, ChevronDown, ChevronUp,
  DoorOpen, CornerUpLeft, MessageSquare, ShieldCheck, FileText,
  User, Stethoscope, Briefcase, Calendar, SlidersHorizontal, X
} from 'lucide-react';

export const parsearDatosObservaciones = (obs = '') => {
  const texto = String(obs || '');
  const segmentos = texto.split('|').map(s => s.trim()).filter(Boolean);

  const segHorario = segmentos.find(s =>
    !/^\[.*\]$/.test(s) &&
    !/llegada en puerta/i.test(s) &&
    !/^⚠️/i.test(s) &&
    !/VoBo /i.test(s) &&
    !/^Nota /i.test(s) &&
    !/^Res:/i.test(s) &&
    !/RECHAZO/i.test(s) &&
    !/CANCELADO/i.test(s) &&
    !/Rechazado por/i.test(s)
  ) || '';

  const limpioHorario = segHorario.replace(/🕒|📅/g, '').trim();
  const horarioSolicitado = /^Para el:\s*\d{4}-\d{2}-\d{2}$/i.test(limpioHorario)
    ? 'Jornada completa'
    : (limpioHorario || 'Jornada completa');

  const mSalida = texto.match(/\[SALIDA CASETA:\s*([^\]]+)\]/i);
  const mEntrada = texto.match(/\[(?:ENTRADA|REINGRESO) CASETA:\s*([^\]]+)\]/i);
  const mLlegadaPuerta = texto.match(/\[LLEGADA EN PUERTA:\s*([^\]]+)\]/i);
  const mRegresado = texto.match(/\[REGRESADO EN PUERTA:\s*([^\]]+)\]/i);

  const mSubarea = texto.match(/VoBo Sub[áa]rea:\s*([^|]+)/i);
  const mRechazo = texto.match(/RECHAZO(?:\s*\([^)]+\))?:\s*([^|]+)/i) || texto.match(/Rechazado por Jefatura:\s*([^|]+)/i);
  const mCancelado = texto.match(/CANCELADO\s+por\s+([^:]+):\s*([^|]+)/i);

  const notasFlujo = [];
  segmentos.forEach(seg => {
    const limpioSeg = seg.replace(/^[💬📝\s]+/, '').trim();
    const mNota = limpioSeg.match(/^Nota\s+([^:]+):\s*([\s\S]+)$/i);
    if (mNota) {
      notasFlujo.push({ autor: mNota[1].trim(), texto: mNota[2].replace(/\s+/g, ' ').trim() });
      return;
    }
    const mComentario = limpioSeg.match(/^Comentario\s*([^:]*):\s*([\s\S]+)$/i);
    if (mComentario) {
      notasFlujo.push({ autor: (mComentario[1] || 'Autorización').trim(), texto: mComentario[2].replace(/\s+/g, ' ').trim() });
      return;
    }
    const mRes = limpioSeg.match(/^Res:\s*([\s\S]+)$/i);
    if (mRes) {
      notasFlujo.push({ autor: 'Autorización', texto: mRes[1].replace(/\s+/g, ' ').trim() });
    }
  });

  return {
    horarioSolicitado: horarioSolicitado || 'Jornada completa',
    horaSalidaCaseta: mSalida ? mSalida[1].trim() : null,
    horaEntradaCaseta: mEntrada ? mEntrada[1].trim() : null,
    horaLlegadaPuerta: mLlegadaPuerta ? mLlegadaPuerta[1].trim() : null,
    horaRegresadoCaseta: mRegresado ? mRegresado[1].trim() : null,
    requiereRegreso: texto.toLowerCase().includes('regresa:'),
    supervisorSubarea: mSubarea ? mSubarea[1].trim() : null,
    motivoRechazo: mRechazo ? mRechazo[1].trim() : (mCancelado ? `Cancelado por ${mCancelado[1].trim()}: ${mCancelado[2].trim()}` : null),
    notasFlujo
  };
};

export const limpiarMotivo = (asunto = '') => {
  const limpio = String(asunto || '').trim();
  const m = limpio.match(/^\[(.*?)\]\s*(.*)$/);
  const rawCat = m ? m[1].replace(/[\[\]]/g, '').trim() : '';
  const rawTxt = m ? m[2].replace(/^\[(.*?)\]\s*/, '').trim() : limpio.replace(/[\[\]]/g, '').trim();

  let catFormateada = '';
  const up = rawCat.toUpperCase();
  if (up.includes('PERSONAL') || up.includes('FAMILIAR')) catFormateada = 'Personal';
  else if (up.includes('CITA') || up.includes('MEDIC') || up.includes('MÉDIC')) catFormateada = 'Cita Médica';
  else if (up.includes('TRABAJO') || up.includes('LABORAL')) catFormateada = 'Trabajo';
  else if (up.includes('VACACIONES')) catFormateada = 'Vacaciones';
  else if (up.includes('CASETA')) catFormateada = 'Apoyo Caseta';
  else if (rawCat) catFormateada = rawCat.charAt(0).toUpperCase() + rawCat.slice(1).toLowerCase();

  return { categoria: catFormateada, texto: rawTxt };
};

const acortarNombre = (nombreCompleto = '') => {
  const partes = String(nombreCompleto || '').trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 2) return partes.join(' ');
  return `${partes[0]} ${partes[partes.length - 2]}`;
};

const formatearFechaCorta = (fechaStr = '') => {
  if (!fechaStr) return '';
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const partes = String(fechaStr).slice(0, 10).split('-');
  if (partes.length !== 3) return fechaStr;
  return `${String(parseInt(partes[2], 10)).padStart(2, '0')} ${meses[parseInt(partes[1], 10) - 1] || partes[1]} ${partes[0]}`;
};

const obtenerRangoSemana = (offset = 0, fechaReferenciaStr = null) => {
  const numOffset = typeof offset === 'number' && !isNaN(offset) ? offset : 0;
  let base = new Date();
  if (fechaReferenciaStr) {
    const partes = String(fechaReferenciaStr).slice(0, 10).split('-').map(Number);
    if (partes.length === 3 && !partes.some(isNaN)) {
      base = new Date(partes[0], partes[1] - 1, partes[2], 12, 0, 0);
    }
  }
  base.setHours(12, 0, 0, 0);

  const diaSemana = base.getDay();
  const diffLunes = diaSemana === 0 ? -6 : 1 - diaSemana;

  const lunes = new Date(base);
  lunes.setDate(base.getDate() + diffLunes + (numOffset * 7));

  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);

  const fmtISO = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const temp = new Date(Date.UTC(lunes.getFullYear(), lunes.getMonth(), lunes.getDate()));
  const dayNum = temp.getUTCDay() || 7;
  temp.setUTCDate(temp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
  const numSemana = Math.ceil((((temp - yearStart) / 86400000) + 1) / 7);

  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const d1 = String(lunes.getDate()).padStart(2, '0');
  const m1 = meses[lunes.getMonth()];
  const d2 = String(domingo.getDate()).padStart(2, '0');
  const m2 = meses[domingo.getMonth()];

  const etiquetaRango = m1 === m2 ? `${d1}–${d2} ${m2}` : `${d1} ${m1}–${d2} ${m2}`;

  return {
    inicio: fmtISO(lunes),
    fin: fmtISO(domingo),
    numSemana,
    etiquetaRango
  };
};

const obtenerNominaPermiso = (s) => {
  const folio = (s.folio || '').toUpperCase();
  const clasif = (s.usuarios?.tipo_personal || s.usuarios?.departamentos?.clasificacion || '').toLowerCase();
  const nomDepto = (s.usuarios?.departamentos?.nombre || '').toLowerCase();
  if (folio.startsWith('A-') || clasif.includes('admin')) return 'administracion';
  if (folio.startsWith('O-') || clasif.includes('obra') || nomDepto.includes('obra')) return 'obra';
  return 'produccion';
};

export default function TablaHistorial({
  solicitudes = [],
  departamentos = [],
  c,
  modoOscuro,
  esControlRH = false,
  selectorModo = null,
  onRecargar,
  onAbrirExportar,
  onSeleccionarPapeleta
}) {
  const [busqueda, setBusqueda] = useState('');
  const [nominaFiltro, setNominaFiltro] = useState('todas'); // 'todas' | 'produccion' | 'administracion' | 'obra'
  const [deptoFiltro, setDeptoFiltro] = useState('todos');
  const [tipoFiltro, setTipoFiltro] = useState('todos');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [modoPeriodo, setModoPeriodo] = useState('todo'); // Por defecto muestra TODOS para no esconder registros
  const [offsetSemana, setOffsetSemana] = useState(0);
  const [paginaActual, setPaginaActual] = useState(1);
  const [seleccionados, setSeleccionados] = useState([]);
  const [expandidos, setExpandidos] = useState([]);
  const [mostrarPanelFiltros, setMostrarPanelFiltros] = useState(false);

  const registrosPorPagina = 14;
  const textSecundario = modoOscuro ? '#94a3b8' : '#64748b';

  const fechaAncla = useMemo(() => {
    const hoyISO = new Date().toISOString().slice(0, 10);
    const rHoy = obtenerRangoSemana(0, hoyISO);
    const hayEnHoy = solicitudes.some(s => {
      const f = String(s.fecha_permiso || '').slice(0, 10);
      return f >= rHoy.inicio && f <= rHoy.fin;
    });
    if (hayEnHoy || solicitudes.length === 0) return hoyISO;
    const fechasOrdenadas = solicitudes
      .map(s => String(s.fecha_permiso || s.fecha_elaboracion || '').slice(0, 10))
      .filter(Boolean)
      .sort();
    return fechasOrdenadas[fechasOrdenadas.length - 1] || hoyISO;
  }, [solicitudes]);

  const infoSemana = useMemo(() => obtenerRangoSemana(offsetSemana, fechaAncla), [offsetSemana, fechaAncla]);

  const solicitudesEnPeriodo = useMemo(() => {
    return solicitudes.filter(s => {
      const f = String(s.fecha_permiso || s.fecha_elaboracion || (s.created_at ? s.created_at.slice(0, 10) : '')).slice(0, 10);
      if (modoPeriodo === 'semana') {
        const fFinPermiso = String(s.fecha_fin || f).slice(0, 10);
        return f <= infoSemana.fin && fFinPermiso >= infoSemana.inicio;
      }
      return true;
    });
  }, [solicitudes, modoPeriodo, infoSemana]);

  const solicitudesProcesadas = useMemo(() => {
    const term = busqueda.toLowerCase().trim();
    const ordenadas = [...solicitudesEnPeriodo].sort((a, b) => {
      const fa = String(a.fecha_permiso || '').slice(0, 10);
      const fb = String(b.fecha_permiso || '').slice(0, 10);
      if (fa !== fb) return fb.localeCompare(fa);
      return compararPorApellidoPaterno(a.usuarios || a.usuarios?.nombre_completo, b.usuarios || b.usuarios?.nombre_completo);
    });

    return ordenadas.filter(s => {
      const u = s.usuarios || {};
      const esCancelado = (s.pago || '').toLowerCase() === 'cancelado' || /CANCELADO por/i.test(s.observaciones || '') || /\[PASE CANCELADO/i.test(s.observaciones || '');
      const esRegresadoFiltro = (s.pago || '').toLowerCase().includes('regresa') || /\[REGRESADO EN PUERTA:/i.test(s.observaciones || '');
      const esAut = !esCancelado && ['autorizado', 'aprobado', 'completado_caseta'].includes(s.estado_general);

      if (term) {
        const match =
          (s.folio || '').toLowerCase().includes(term) ||
          (u.nombre_completo || '').toLowerCase().includes(term) ||
          String(u.numero_empleado || '').toLowerCase().includes(term) ||
          (u.departamentos?.nombre || '').toLowerCase().includes(term);
        if (!match) return false;
      }

      if (nominaFiltro !== 'todas' && obtenerNominaPermiso(s) !== nominaFiltro) return false;
      if (deptoFiltro !== 'todos' && String(u.departamento_id) !== String(deptoFiltro)) return false;
      if (tipoFiltro !== 'todos') {
        const tPerm = (s.tipo_permiso || '').toLowerCase();
        const esRegCasa = (s.pago || '').toLowerCase().includes('regresa') || /\[REGRESADO EN PUERTA:/i.test(s.observaciones || '');
        if (tipoFiltro === 'falta_retardo') {
          if (!(tPerm === 'falta' && esRegCasa)) return false;
        } else if (tipoFiltro === 'falta') {
          if (tPerm !== 'falta' || esRegCasa) return false;
        } else if (tPerm !== tipoFiltro) {
          return false;
        }
      }
      const tieneFolioOficialConsecutivo = Boolean(s.folio && !String(s.folio).startsWith('REQ-') && !String(s.folio).startsWith('CAS-'));
      if (filtroEstado === 'cancelado') {
        if (!esCancelado) return false;
      } else if (filtroEstado === 'todos') {
        // Ocultar únicamente borradores REQ-/CAS- cancelados, pero MANTENER visibles los Folios Oficiales cancelados para que nunca se salte un número en el consecutivo (ej. 0004, 0005 Cancelado, 0006)
        if (esCancelado && !tieneFolioOficialConsecutivo) return false;
      } else {
        if (esCancelado) return false;
        if (filtroEstado === 'autorizado' && !esAut) return false;
        if (filtroEstado === 'rechazado' && (s.estado_general !== 'rechazado' && !esRegresadoFiltro)) return false;
      }

      return true;
    });
  }, [solicitudesEnPeriodo, busqueda, nominaFiltro, deptoFiltro, tipoFiltro, filtroEstado]);

  const totalPaginas = Math.ceil(solicitudesProcesadas.length / registrosPorPagina) || 1;
  const indiceInicio = (paginaActual - 1) * registrosPorPagina;
  const solicitudesPaginadas = solicitudesProcesadas.slice(indiceInicio, indiceInicio + registrosPorPagina);

  const toggleSeleccion = (id, e) => {
    if (e) e.stopPropagation();
    setSeleccionados(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleExpandir = (id) => {
    setExpandidos(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSeleccionarTodo = () => {
    if (seleccionados.length === solicitudesPaginadas.length) {
      setSeleccionados([]);
    } else {
      setSeleccionados(solicitudesPaginadas.map(s => s.id));
    }
  };

  const cantidadFiltrosSecundarios = [
    modoPeriodo === 'semana',
    nominaFiltro !== 'todas',
    deptoFiltro !== 'todos',
    tipoFiltro !== 'todos',
    filtroEstado !== 'todos'
  ].filter(Boolean).length;

  const hayFiltrosActivos = Boolean(busqueda || cantidadFiltrosSecundarios > 0 || modoPeriodo === 'semana');

  const limpiarFiltros = () => {
    setBusqueda('');
    setNominaFiltro('todas');
    setDeptoFiltro('todos');
    setTipoFiltro('todos');
    setFiltroEstado('todos');
    setModoPeriodo('todo');
    setOffsetSemana(0);
    setPaginaActual(1);
  };

  const getEstiloTipo = (tipoRaw = '') => {
    const t = tipoRaw.toLowerCase();
    if (t === 'retardo') return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.08)', border: 'rgba(239, 68, 68, 0.22)', label: 'Retardo' };
    if (t === 'falta') return { color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.08)', border: 'rgba(139, 92, 246, 0.22)', label: 'Falta' };
    if (t === 'vacaciones') return { color: '#10b981', bg: 'rgba(16, 185, 129, 0.08)', border: 'rgba(16, 185, 129, 0.22)', label: 'Vacaciones' };
    if (t === 'salida') return { color: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.08)', border: 'rgba(14, 165, 233, 0.22)', label: 'Salida' };
    return { color: c.text, bg: c.bg, border: c.border, label: (tipoRaw || 'Permiso') };
  };

  const renderIconoNaturaleza = (cat = '') => {
    if (!cat) return null;
    const low = cat.toLowerCase();
    let Icono = User;
    if (low.includes('cita') || low.includes('médic')) Icono = Stethoscope;
    else if (low.includes('trabajo')) Icono = Briefcase;
    else if (low.includes('vacaciones')) Icono = Calendar;

    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: textSecundario, fontWeight: '600' }}>
        <Icono size={12.5} color={textSecundario} />
        <span>{cat}</span>
      </span>
    );
  };

  const ChipFirmaDetalle = ({ rolLabel, nombre, estado, cerrado = true }) => {
    const est = (estado || 'pendiente').toLowerCase();
    if (['omitido', 'no_aplica'].includes(est) || (cerrado && est === 'pendiente') || (!nombre && est !== 'rechazado')) return null;

    const ok = ['autorizado', 'aprobado', 'auto_aprobado', 'escalado'].includes(est);
    const rech = est === 'rechazado';
    const color = ok ? '#16a34a' : rech ? '#ef4444' : textSecundario;

    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: '4px 9px', borderRadius: '7px',
        background: c.surfaceCard, border: `1px solid ${c.border}`,
        fontSize: '12px', color: c.text
      }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ color: textSecundario, fontWeight: '600' }}>{rolLabel}:</span>
        <strong style={{ fontWeight: '700' }}>{acortarNombre(nombre || 'Autorizado')}</strong>
      </div>
    );
  };

  const totalColumnas = esControlRH ? 6 : 4;

  return (
    <div className="th-main-wrapper">
      <style>{`
        .th-main-wrapper {
          display: flex;
          flex-direction: column;
          gap: 10px;
          width: 100%;
          box-sizing: border-box;
        }
        /* BARRA COMPACTA Y EMPAQUETADA (1 FILA EN 14", 2 FILAS EN CELULAR) */
        .th-single-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          background: ${c.surfaceCard};
          border: 1px solid ${c.border};
          border-radius: 12px;
          padding: 8px 12px;
          box-sizing: border-box;
        }
        .th-top-bar-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          width: 100%;
        }
        .th-actions-pack {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }
        .th-search-minimal {
          display: flex;
          align-items: center;
          gap: 7px;
          background: ${c.bg};
          border: 1px solid ${c.border};
          border-radius: 8px;
          padding: 0 10px;
          height: 34px;
          flex: 1;
          max-width: 360px;
          min-width: 180px;
          box-sizing: border-box;
        }
        .th-neutral-btn {
          height: 34px;
          padding: 0 11px;
          border-radius: 8px;
          border: 1px solid ${c.border};
          background: ${c.bg};
          color: ${c.text};
          font-size: 12.5px;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          white-space: nowrap;
          box-sizing: border-box;
          transition: all 0.15s ease;
        }
        .th-neutral-btn:hover {
          border-color: ${textSecundario};
        }
        /* PANEL GRADUAL DE FILTROS (OCULTO POR DEFECTO) */
        .th-gradual-filters {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 8px;
          background: ${c.surfaceCard};
          border: 1px solid ${c.border};
          border-radius: 10px;
          padding: 10px 12px;
          box-sizing: border-box;
        }
        .th-gradual-select {
          width: 100%;
          height: 34px;
          padding: 0 10px;
          border-radius: 7px;
          border: 1px solid ${c.border};
          background: ${c.bg};
          color: ${c.text};
          font-size: 12.5px;
          font-weight: 600;
          outline: none;
          box-sizing: border-box;
        }
        .th-desktop-table-view {
          display: block;
        }
        .th-mobile-cards-view {
          display: none;
        }
        @media (max-width: 768px) {
          .th-single-toolbar {
            display: flex !important;
            flex-direction: column !important;
            align-items: stretch !important;
            padding: 10px !important;
            gap: 8px !important;
          }
          .th-top-bar-row {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 6px !important;
            width: 100% !important;
          }
          .th-search-minimal {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            height: 36px !important;
          }
          .th-btn-label-hide-mobile {
            display: none !important;
          }
          .th-icon-only-mobile {
            padding: 0 !important;
            width: 34px !important;
            height: 34px !important;
          }
          .th-gradual-filters {
            grid-template-columns: 1fr !important;
            padding: 10px !important;
          }
          .th-desktop-table-view {
            display: none !important;
          }
          .th-mobile-cards-view {
            display: flex !important;
            flex-direction: column;
            gap: 7px;
            width: 100%;
          }
          .th-mcard {
            background: ${c.surfaceCard};
            border: 1px solid ${c.border};
            border-radius: 10px;
            padding: 10px 12px;
            display: flex;
            flex-direction: column;
            gap: 4px;
          }
        }
      `}</style>

      {/* 1. BARRA EMPAQUETADA Y SIMÉTRICA */}
      <div className="th-single-toolbar">
        <div className="th-top-bar-row">
          {selectorModo}

          {/* Buscador en medio para laptop 14", baja al renglón 2 en móvil */}
          <div className="th-search-minimal" style={{ display: window.innerWidth <= 768 ? 'none' : 'flex' }}>
            <Search size={14} color={textSecundario} style={{ flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Buscar colaborador, folio o #nómina..."
              value={busqueda}
              onChange={(e) => { setBusqueda(e.target.value); setPaginaActual(1); }}
              style={{ border: 'none', background: 'transparent', outline: 'none', color: c.text, fontSize: '12.5px', width: '100%', fontWeight: '500' }}
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda('')}
                style={{ background: 'none', border: 'none', color: textSecundario, cursor: 'pointer', display: 'flex', padding: 0 }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="th-actions-pack">
            {esControlRH && seleccionados.length > 0 && (
              <button
                type="button"
                onClick={() => onSeleccionarPapeleta(solicitudes.filter(s => seleccionados.includes(s.id)))}
                className="th-neutral-btn"
                style={{ color: c.accent, borderColor: c.accent }}
                title="Imprimir papeletas seleccionadas"
              >
                <Printer size={14} />
                <span>({seleccionados.length})</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setMostrarPanelFiltros(prev => !prev)}
              className="th-neutral-btn"
              title="Abrir filtros y periodo"
              style={{
                borderColor: (mostrarPanelFiltros || cantidadFiltrosSecundarios > 0) ? c.accent : c.border,
                background: (mostrarPanelFiltros || cantidadFiltrosSecundarios > 0) ? c.accentSoft : c.bg,
                color: (mostrarPanelFiltros || cantidadFiltrosSecundarios > 0) ? c.accent : c.text
              }}
            >
              <SlidersHorizontal size={14} />
              <span className="th-btn-label-hide-mobile">Filtros</span>
              {cantidadFiltrosSecundarios > 0 && (
                <span style={{
                  background: c.accent, color: '#fff', fontSize: '10.5px',
                  fontWeight: '800', padding: '1px 5px', borderRadius: '999px'
                }}>
                  {cantidadFiltrosSecundarios}
                </span>
              )}
            </button>

            {esControlRH && onAbrirExportar && (
              <button
                type="button"
                onClick={onAbrirExportar}
                className="th-neutral-btn th-icon-only-mobile"
                title="Exportar a Excel"
              >
                <FileSpreadsheet size={15} color={c.accent} />
                <span className="th-btn-label-hide-mobile">Exportar</span>
              </button>
            )}
          </div>
        </div>

        {/* Renglón 2 exclusivo para celular: Buscador de ancho completo */}
        <div className="th-search-minimal" style={{ display: window.innerWidth <= 768 ? 'flex' : 'none' }}>
          <Search size={14} color={textSecundario} style={{ flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Buscar colaborador, folio o #nómina..."
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); setPaginaActual(1); }}
            style={{ border: 'none', background: 'transparent', outline: 'none', color: c.text, fontSize: '12.5px', width: '100%', fontWeight: '500' }}
          />
          {busqueda && (
            <button
              type="button"
              onClick={() => setBusqueda('')}
              style={{ background: 'none', border: 'none', color: textSecundario, cursor: 'pointer', display: 'flex', padding: 0 }}
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* 2. PANEL EMPAQUETADO DE FILTROS (INCLUYE PERIODO POR SEMANA, NÓMINA, DEPTO, TIPO, RESOLUCIÓN Y LIMPIAR) */}
      {mostrarPanelFiltros && (
        <div className="th-gradual-filters">
          <div>
            <label style={{ display: 'block', fontSize: '10.5px', fontWeight: '700', color: textSecundario, marginBottom: '4px', textTransform: 'uppercase' }}>
              Periodo ({solicitudesProcesadas.length} reg.)
            </label>
            {modoPeriodo === 'semana' ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px', height: '34px', padding: '0 6px', borderRadius: '7px', background: c.bg, border: `1px solid ${c.border}` }}>
                <button
                  type="button"
                  onClick={() => { setOffsetSemana(prev => prev - 1); setPaginaActual(1); }}
                  style={{ width: '24px', height: '24px', border: 'none', background: 'transparent', color: c.text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <ChevronLeft size={14} />
                </button>
                <span style={{ fontSize: '11.5px', fontWeight: '700', color: c.text, whiteSpace: 'nowrap' }}>
                  Sem {infoSemana.numSemana} ({infoSemana.etiquetaRango})
                </span>
                <button
                  type="button"
                  onClick={() => { setOffsetSemana(prev => prev + 1); setPaginaActual(1); }}
                  style={{ width: '24px', height: '24px', border: 'none', background: 'transparent', color: c.text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <ChevronRight size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => { setModoPeriodo('todo'); setPaginaActual(1); }}
                  style={{ height: '22px', padding: '0 6px', borderRadius: '5px', border: `1px solid ${c.border}`, background: c.surfaceCard, color: textSecundario, fontSize: '10.5px', fontWeight: '700', cursor: 'pointer' }}
                >
                  Todos
                </button>
              </div>
            ) : (
              <select
                value="todo"
                onChange={(e) => {
                  if (e.target.value === 'semana') {
                    setModoPeriodo('semana');
                    setOffsetSemana(0);
                    setPaginaActual(1);
                  }
                }}
                className="th-gradual-select"
              >
                <option value="todo">Todo el historial ({solicitudesProcesadas.length})</option>
                <option value="semana">Filtrar por semana...</option>
              </select>
            )}
          </div>

          {esControlRH && (
            <div>
              <label style={{ display: 'block', fontSize: '10.5px', fontWeight: '700', color: textSecundario, marginBottom: '4px', textTransform: 'uppercase' }}>
                Tipo de Nómina
              </label>
              <select
                value={nominaFiltro}
                onChange={(e) => { setNominaFiltro(e.target.value); setPaginaActual(1); }}
                className="th-gradual-select"
              >
                <option value="todas">Todas las nóminas</option>
                <option value="produccion">Producción</option>
                <option value="administracion">Administración</option>
                <option value="obra">Obra</option>
              </select>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '10.5px', fontWeight: '700', color: textSecundario, marginBottom: '4px', textTransform: 'uppercase' }}>
              Tipo de incidencia
            </label>
            <select
              value={tipoFiltro}
              onChange={(e) => { setTipoFiltro(e.target.value); setPaginaActual(1); }}
              className="th-gradual-select"
            >
              <option value="todos">Todos los tipos</option>
              <option value="salida">Salida anticipada</option>
              <option value="retardo">Retardo</option>
              <option value="falta">Falta</option>
              <option value="falta_retardo">Falta por retardo (Se regresa)</option>
              <option value="vacaciones">Vacaciones</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '10.5px', fontWeight: '700', color: textSecundario, marginBottom: '4px', textTransform: 'uppercase' }}>
              Resolución
            </label>
            <select
              value={filtroEstado}
              onChange={(e) => { setFiltroEstado(e.target.value); setPaginaActual(1); }}
              className="th-gradual-select"
            >
              <option value="todos">Activos / Oficiales (Sin cancelados)</option>
              <option value="autorizado">Solo autorizados</option>
              <option value="rechazado">Solo rechazados / regresados</option>
              <option value="cancelado">Bitácora de cancelados</option>
            </select>
          </div>

          {(hayFiltrosActivos || (esControlRH && filtroEstado === 'cancelado' && solicitudesProcesadas.length > 0)) && (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px' }}>
              {hayFiltrosActivos && (
                <button
                  type="button"
                  onClick={limpiarFiltros}
                  className="th-neutral-btn"
                  style={{ flex: 1, color: textSecundario }}
                >
                  <RotateCcw size={13} /> Restablecer filtros
                </button>
              )}
              {esControlRH && filtroEstado === 'cancelado' && solicitudesProcesadas.length > 0 && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!window.confirm(`¿Deseas eliminar definitivamente de la base de datos los ${solicitudesProcesadas.length} registros cancelados que se muestran en pantalla?\n\nEsta acción limpia los folios REQ- cancelados que no afectan nómina.`)) return;
                    try {
                      await depurarPermisosCanceladosRH(solicitudesProcesadas.map(x => x.id));
                      if (onRecargar) onRecargar();
                    } catch (err) {
                      alert('Error al depurar cancelados: ' + err.message);
                    }
                  }}
                  className="th-neutral-btn"
                  style={{ flex: 1, color: '#ef4444', borderColor: 'rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.08)' }}
                >
                  <XCircle size={13.5} />
                  <span>Depurar ({solicitudesProcesadas.length})</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3. CONTENIDO PRINCIPAL */}
      {solicitudesPaginadas.length === 0 ? (
        <div style={{
          background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '11px',
          padding: '40px 20px', textAlign: 'center', color: textSecundario, fontSize: '13.5px', fontWeight: '500'
        }}>
          No hay permisos registrados que coincidan con la vista actual.
        </div>
      ) : (
        <>
          {/* TABLA LIMPIA DE ESCRITORIO */}
          <div className="th-desktop-table-view" style={{ background: c.surfaceCard, borderRadius: '11px', border: `1px solid ${c.border}`, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
                <colgroup>
                  {esControlRH && <col style={{ width: '38px' }} />}
                  <col style={{ width: esControlRH ? '32%' : '38%' }} />
                  <col style={{ width: esControlRH ? '28%' : '32%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '13%' }} />
                  {esControlRH && <col style={{ width: '170px' }} />}
                </colgroup>
                <thead>
                  <tr style={{
                    background: c.surface, borderBottom: `1px solid ${c.border}`,
                    color: textSecundario, fontSize: '11px', fontWeight: '700',
                    textTransform: 'uppercase', letterSpacing: '0.04em'
                  }}>
                    {esControlRH && (
                      <th style={{ padding: '10px 8px 10px 14px', verticalAlign: 'middle' }}>
                        <div onClick={toggleSeleccionarTodo} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                          {seleccionados.length > 0 && seleccionados.length === solicitudesPaginadas.length
                            ? <CheckSquare size={15} color={c.accent} />
                            : <Square size={15} />}
                        </div>
                      </th>
                    )}
                    <th style={{ padding: '10px 14px', verticalAlign: 'middle' }}>Colaborador</th>
                    <th style={{ padding: '10px 14px', verticalAlign: 'middle' }}>Incidencia</th>
                    <th style={{ padding: '10px 14px', verticalAlign: 'middle', textAlign: 'center' }}>Caseta</th>
                    <th style={{ padding: '10px 14px', verticalAlign: 'middle', textAlign: 'center' }}>Dictamen</th>
                    {esControlRH && <th style={{ padding: '10px 14px', verticalAlign: 'middle', textAlign: 'right' }}>Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {solicitudesPaginadas.map(s => {
                    const u = s.usuarios || {};
                    const pagoLow = (s.pago || '').toLowerCase();
                    const esCancelado = pagoLow === 'cancelado' || /CANCELADO por/i.test(s.observaciones || '') || /\[PASE CANCELADO/i.test(s.observaciones || '');
                    const esAut = !esCancelado && ['autorizado', 'aprobado', 'completado_caseta'].includes(s.estado_general);
                    const seRegresoCasa = pagoLow.includes('regresa');
                    const esAlertaPago = seRegresoCasa || pagoLow.includes('sin goce');
                    const seleccionado = seleccionados.includes(s.id);
                    const expandido = expandidos.includes(s.id);
                    const {
                      horarioSolicitado,
                      horaSalidaCaseta,
                      horaEntradaCaseta,
                      horaLlegadaPuerta,
                      horaRegresadoCaseta,
                      supervisorSubarea,
                      motivoRechazo,
                      notasFlujo
                    } = parsearDatosObservaciones(s.observaciones);

                    const tipo = (s.tipo_permiso || '').toLowerCase();
                    const esFaltaPorRetardo = tipo === 'falta' && (seRegresoCasa || Boolean(horaRegresadoCaseta));
                    const aplicaCaseta = tipo === 'salida' || tipo === 'retardo' || esFaltaPorRetardo;
                    const baseEstiloTipo = getEstiloTipo(s.tipo_permiso);
                    const estiloTipo = esFaltaPorRetardo
                      ? { ...baseEstiloTipo, label: 'Falta (Retardo)' }
                      : baseEstiloTipo;

                    const { categoria, texto: motivoTexto } = limpiarMotivo(s.asunto_motivo);

                    const renderSelloCaseta = () => {
                      if (!aplicaCaseta || esCancelado) {
                        return <span style={{ fontSize: '12px', color: textSecundario }}>—</span>;
                      }
                      if (horaRegresadoCaseta || seRegresoCasa) {
                        const horaMostrar = horaRegresadoCaseta || horaLlegadaPuerta || 'Se retiró';
                        return (
                          <span style={{ fontSize: '12px', fontWeight: '700', color: '#d97706', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <CornerUpLeft size={12.5} /> {horaMostrar}
                          </span>
                        );
                      }
                      if (horaSalidaCaseta || horaEntradaCaseta) {
                        const textoHora = horaSalidaCaseta && horaEntradaCaseta
                          ? `${horaSalidaCaseta.replace(/\s*hrs/i, '')} → ${horaEntradaCaseta.replace(/\s*hrs/i, '')}`
                          : (horaSalidaCaseta || horaEntradaCaseta);
                        return (
                          <span style={{ fontSize: '12px', fontWeight: '700', color: '#16a34a', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <DoorOpen size={12.5} /> {textoHora}
                          </span>
                        );
                      }
                      return <span style={{ fontSize: '12px', color: textSecundario }}>Pendiente</span>;
                    };

                    return (
                      <React.Fragment key={s.id}>
                        <tr
                          onClick={() => toggleExpandir(s.id)}
                          style={{
                            cursor: 'pointer',
                            borderBottom: expandido ? 'none' : `1px solid ${c.borderDivider}`,
                            background: seleccionado
                              ? (modoOscuro ? 'rgba(22,163,74,0.12)' : 'rgba(22,163,74,0.05)')
                              : expandido
                                ? (modoOscuro ? 'rgba(255,255,255,0.02)' : '#f8fafc')
                                : 'transparent',
                            transition: 'background 0.12s ease'
                          }}
                        >
                          {esControlRH && (
                            <td style={{ padding: '11px 8px 11px 14px', verticalAlign: 'middle' }} onClick={(e) => toggleSeleccion(s.id, e)}>
                              <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                {seleccionado
                                  ? <CheckSquare size={15} color={c.accent} />
                                  : <Square size={15} color={textSecundario} style={{ opacity: 0.5 }} />}
                              </div>
                            </td>
                          )}

                          <td style={{ padding: '11px 14px', verticalAlign: 'middle', overflow: 'hidden' }}>
                            <div style={{ fontWeight: '700', color: c.text, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {formatearApellidosNombre(u.nombre_completo || 'Colaborador', u)}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', fontSize: '12px', color: textSecundario }}>
                              <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: '700', color: c.text }}>
                                {s.folio}
                              </span>
                              <span>·</span>
                              <span>#{u.numero_empleado}</span>
                              <span>·</span>
                              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {u.departamentos?.nombre || 'General'}
                              </span>
                            </div>
                          </td>

                          <td style={{ padding: '11px 14px', verticalAlign: 'middle', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                              <span style={{
                                fontSize: '11px', fontWeight: '700', padding: '1px 7px', borderRadius: '5px',
                                background: estiloTipo.bg, border: `1px solid ${estiloTipo.border}`, color: estiloTipo.color
                              }}>
                                {estiloTipo.label}
                              </span>
                              <span style={{ fontSize: '13px', fontWeight: '700', color: c.text }}>
                                {formatearFechaCorta(s.fecha_permiso)}{s.fecha_fin && s.fecha_fin !== s.fecha_permiso ? ` al ${formatearFechaCorta(s.fecha_fin)}` : ''}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', fontSize: '12px', color: textSecundario, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              <span>{horarioSolicitado}</span>
                              {categoria && (
                                <>
                                  <span>·</span>
                                  {renderIconoNaturaleza(categoria)}
                                </>
                              )}
                            </div>
                          </td>

                          <td style={{ padding: '11px 14px', verticalAlign: 'middle', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {renderSelloCaseta()}
                          </td>

                          <td style={{ padding: '11px 10px', verticalAlign: 'middle', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                              fontSize: '12px', fontWeight: '700', padding: '3px 9px', borderRadius: '6px',
                              backgroundColor: esCancelado ? c.bg : seRegresoCasa ? 'rgba(245,158,11,0.12)' : !esAut ? 'rgba(239,68,68,0.10)' : esAlertaPago ? 'rgba(245,158,11,0.12)' : 'rgba(22,163,74,0.10)',
                              color: esCancelado ? textSecundario : seRegresoCasa ? '#d97706' : !esAut ? '#ef4444' : esAlertaPago ? '#d97706' : '#16a34a',
                              border: `1px solid ${esCancelado ? c.border : seRegresoCasa ? 'rgba(245,158,11,0.28)' : !esAut ? 'rgba(239,68,68,0.22)' : esAlertaPago ? 'rgba(245,158,11,0.28)' : 'rgba(22,163,74,0.22)'}`
                            }}>
                              {esCancelado ? 'Cancelado' : seRegresoCasa ? 'Se regresa' : esAut ? (s.pago || 'Autorizado') : 'No autorizado'}
                            </span>
                          </td>

                          {esControlRH && (
                            <td style={{ padding: '11px 14px 11px 8px', verticalAlign: 'middle', textAlign: 'right', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                {!esCancelado && (
                                <button
                                  onClick={() => onSeleccionarPapeleta && onSeleccionarPapeleta([s])}
                                  style={{
                                    height: '28px', padding: '0 10px', borderRadius: '6px', border: `1px solid ${c.border}`,
                                    background: c.bg, color: c.text, fontSize: '12px', fontWeight: '700',
                                    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px'
                                  }}
                                >
                                  <Printer size={13} color={textSecundario} /> Papeleta
                                </button>
                                )}
                                <button
                                  onClick={() => toggleExpandir(s.id)}
                                  title="Ver detalles"
                                  style={{
                                    width: '28px', height: '28px', borderRadius: '6px',
                                    border: `1px solid ${expandido ? c.text : c.border}`,
                                    background: expandido ? c.surface : 'transparent',
                                    color: textSecundario, cursor: 'pointer',
                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                                  }}
                                >
                                  {expandido ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>

                        {expandido && (
                          <tr style={{
                            borderBottom: `1px solid ${c.borderDivider}`,
                            background: modoOscuro ? 'rgba(255,255,255,0.015)' : '#f8fafc'
                          }}>
                            <td colSpan={totalColumnas} style={{ padding: '0 16px 14px 16px' }}>
                              <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1.2fr 1fr',
                                gap: '16px',
                                padding: '12px 14px',
                                borderRadius: '9px',
                                background: c.bg,
                                border: `1px solid ${c.border}`
                              }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '12px', borderRight: `1px solid ${c.border}` }}>
                                  <div style={{ fontSize: '11px', fontWeight: '700', color: textSecundario, textTransform: 'uppercase' }}>
                                    Motivo {categoria ? `· ${categoria}` : ''}
                                  </div>
                                  <div style={{ fontSize: '13.5px', fontWeight: '500', color: c.text, lineHeight: 1.45 }}>
                                    {motivoTexto || 'Sin motivo especificado.'}
                                  </div>

                                  {notasFlujo && notasFlujo.length > 0 && (
                                    <div style={{ marginTop: '4px', paddingTop: '6px', borderTop: `1px dashed ${c.border}`, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                      {notasFlujo.map((n, idx) => (
                                        <div key={idx} style={{ fontSize: '12.5px', color: c.text }}>
                                          <strong style={{ color: textSecundario }}>{n.autor}:</strong> {n.texto}
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {!esAut && motivoRechazo && (
                                    <div style={{ fontSize: '12.5px', color: esCancelado ? textSecundario : '#ef4444', fontWeight: '600', marginTop: '2px' }}>
                                      {motivoRechazo}
                                    </div>
                                  )}
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '8px' }}>
                                  <div>
                                    <div style={{ fontSize: '11px', fontWeight: '700', color: textSecundario, textTransform: 'uppercase', marginBottom: '6px' }}>
                                      Autorizaciones
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                      {supervisorSubarea && <ChipFirmaDetalle rolLabel="Subárea" nombre={supervisorSubarea} estado="autorizado" />}
                                      <ChipFirmaDetalle rolLabel="Jefe" nombre={s.firmante1?.nombre_completo} estado={s.firma_1_estado} />
                                      <ChipFirmaDetalle rolLabel="Gerente" nombre={s.firmante2?.nombre_completo} estado={s.firma_2_estado} />
                                      <ChipFirmaDetalle rolLabel="RH" nombre={s.firmante3?.nombre_completo} estado={s.firma_3_estado} />
                                    </div>
                                  </div>

                                  {esControlRH && !esCancelado && s.estado_general !== 'rechazado' && !tieneSelloFisicoCaseta(s) && (
                                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                      <button
                                        type="button"
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          const mot = window.prompt('Motivo de cancelación del pase (ej. Vacaciones pospuestas / Ya no se ocupó):');
                                          if (!mot || !mot.trim()) return;
                                          try {
                                            await cancelarSolicitudPermiso({ permiso: s, usuario: { nombre_completo: 'Recursos Humanos' }, motivoCancelacion: mot });
                                            if (onRecargar) onRecargar();
                                          } catch (err) {
                                            alert(err.message);
                                          }
                                        }}
                                        style={{
                                          padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.3)',
                                          background: 'transparent', color: '#ef4444', fontSize: '11.5px', fontWeight: '700', cursor: 'pointer'
                                        }}
                                      >
                                        Cancelar pase
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* TARJETAS MÓVILES COMPACTAS */}
          <div className="th-mobile-cards-view">
            {solicitudesPaginadas.map(s => {
              const u = s.usuarios || {};
              const pagoLow = (s.pago || '').toLowerCase();
              const esCancelado = pagoLow === 'cancelado' || /CANCELADO por/i.test(s.observaciones || '') || /\[PASE CANCELADO/i.test(s.observaciones || '');
              const esAut = !esCancelado && ['autorizado', 'aprobado', 'completado_caseta'].includes(s.estado_general);
              const seRegresoCasa = pagoLow.includes('regresa');
              const expandido = expandidos.includes(s.id);
              const baseEstiloM = getEstiloTipo(s.tipo_permiso);
              const estiloTipo = (s.tipo_permiso || '').toLowerCase() === 'falta' && seRegresoCasa
                ? { ...baseEstiloM, label: 'Falta (Retardo)' }
                : baseEstiloM;
              const { horarioSolicitado, motivoRechazo, notasFlujo } = parsearDatosObservaciones(s.observaciones);
              const { texto: motivoTexto } = limpiarMotivo(s.asunto_motivo);

              return (
                <div
                  key={s.id}
                  className="th-mcard"
                  onClick={() => toggleExpandir(s.id)}
                  style={{ borderLeft: `3px solid ${estiloTipo.color}`, cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13.5px', fontWeight: '700', color: c.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {formatearApellidosNombre(u.nombre_completo || 'Colaborador', u)}
                    </span>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      color: esCancelado
                        ? textSecundario
                        : seRegresoCasa
                        ? '#d97706'
                        : !esAut
                        ? '#ef4444'
                        : pagoLow.includes('sin goce')
                        ? '#d97706'
                        : '#16a34a'
                    }}>
                      {esCancelado ? 'Cancelado' : seRegresoCasa ? 'Se regresa' : esAut ? (s.pago || 'Autorizado') : 'Rechazado'}
                    </span>
                  </div>
                  <div style={{ fontSize: '11.5px', color: textSecundario, display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: '700' }}>{s.folio}</span>
                    <span>·</span>
                    <span style={{ color: estiloTipo.color, fontWeight: '700' }}>{estiloTipo.label}</span>
                    <span>·</span>
                    <span>{formatearFechaCorta(s.fecha_permiso)}</span>
                    <span>({horarioSolicitado})</span>
                  </div>
                  {expandido && (
                    <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: `1px dashed ${c.border}`, fontSize: '12px', color: c.text }}>
                      <div>{motivoTexto}</div>
                      {notasFlujo.map((n, i) => <div key={i} style={{ color: textSecundario }}><strong>{n.autor}:</strong> {n.texto}</div>)}
                      {motivoRechazo && <div style={{ color: '#ef4444' }}>{motivoRechazo}</div>}
                      {esControlRH && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onSeleccionarPapeleta && onSeleccionarPapeleta([s]); }}
                          style={{ marginTop: '6px', width: '100%', height: '30px', borderRadius: '6px', border: `1px solid ${c.border}`, background: c.bg, color: c.text, fontSize: '12px', fontWeight: '700' }}
                        >
                          Ver Papeleta
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* PAGINACIÓN DISCRETA */}
          {totalPaginas > 1 && (
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 12px', borderRadius: '9px', border: `1px solid ${c.border}`, background: c.surfaceCard
            }}>
              <span style={{ fontSize: '12px', color: textSecundario }}>
                Mostrando {solicitudesPaginadas.length} de {solicitudesProcesadas.length}
              </span>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button
                  onClick={() => setPaginaActual(p => Math.max(p - 1, 1))}
                  disabled={paginaActual === 1}
                  style={{ padding: '4px 7px', borderRadius: '5px', border: `1px solid ${c.border}`, background: c.bg, color: c.text, cursor: paginaActual === 1 ? 'not-allowed' : 'pointer', opacity: paginaActual === 1 ? 0.4 : 1 }}
                >
                  <ChevronLeft size={13} />
                </button>
                <span style={{ fontSize: '12px', fontWeight: '700', color: c.text }}>
                  {paginaActual} / {totalPaginas}
                </span>
                <button
                  onClick={() => setPaginaActual(p => Math.min(p + 1, totalPaginas))}
                  disabled={paginaActual === totalPaginas}
                  style={{ padding: '4px 7px', borderRadius: '5px', border: `1px solid ${c.border}`, background: c.bg, color: c.text, cursor: paginaActual === totalPaginas ? 'not-allowed' : 'pointer', opacity: paginaActual === totalPaginas ? 0.4 : 1 }}
                >
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
