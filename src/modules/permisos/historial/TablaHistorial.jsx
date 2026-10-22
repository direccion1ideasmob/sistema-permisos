import React, { useState, useMemo } from 'react';
import {
  Search, ChevronLeft, ChevronRight, Printer, CheckSquare, Square,
  Factory, Building2, HardHat, FileSpreadsheet, RotateCcw, Clock,
  CheckCircle2, XCircle, CalendarDays, ChevronDown, ChevronUp,
  DoorOpen, MinusCircle, CornerUpLeft, MessageSquare, ShieldCheck, FileText,
  User, Stethoscope, Briefcase, Calendar, SlidersHorizontal
} from 'lucide-react';

export const parsearDatosObservaciones = (obs = '') => {
  const texto = String(obs || '');
  const segmentos = texto.split('|').map(s => s.trim()).filter(Boolean);
  const horarioSolicitado = (segmentos[0] || '')
    .replace(/🕒|📅/g, '')
    .trim();

  const mSalida = texto.match(/\[SALIDA CASETA:\s*([^\]]+)\]/i);
  const mEntrada = texto.match(/\[(?:ENTRADA|REINGRESO) CASETA:\s*([^\]]+)\]/i) || texto.match(/\[LLEGADA EN PUERTA:\s*([^\]]+)\]/i);
  const mRegresado = texto.match(/\[REGRESADO EN PUERTA:\s*([^\]]+)\]/i);
  const mSubarea = texto.match(/VoBo Sub[áa]rea:\s*([^|]+)/i);
  const mRechazo = texto.match(/RECHAZO:\s*([^|]+)/i) || texto.match(/Rechazado por Jefatura:\s*([^|]+)/i);

  const notasFlujo = [];
  segmentos.slice(1).forEach(seg => {
    const mNota = seg.match(/^Nota\s+([^:]+):\s*(.+)$/i);
    if (mNota) {
      notasFlujo.push({ autor: mNota[1].trim(), texto: mNota[2].trim() });
      return;
    }
    const mRes = seg.match(/^Res:\s*(.+)$/i);
    if (mRes) {
      notasFlujo.push({ autor: 'Autorización', texto: mRes[1].trim() });
    }
  });

  return {
    horarioSolicitado: horarioSolicitado || 'Jornada completa',
    horaSalidaCaseta: mSalida ? mSalida[1].trim() : null,
    horaEntradaCaseta: mEntrada ? mEntrada[1].trim() : null,
    horaRegresadoCaseta: mRegresado ? mRegresado[1].trim() : null,
    requiereRegreso: texto.toLowerCase().includes('regresa:'),
    supervisorSubarea: mSubarea ? mSubarea[1].trim() : null,
    motivoRechazo: mRechazo ? mRechazo[1].trim() : null,
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

  const etiquetaRango = m1 === m2 ? `${d1} al ${d2} ${m2}` : `${d1} ${m1} - ${d2} ${m2}`;

  return {
    inicio: fmtISO(lunes),
    fin: fmtISO(domingo),
    numSemana,
    etiquetaRango
  };
};

export default function TablaHistorial({
  solicitudes = [],
  departamentos = [],
  c,
  modoOscuro,
  esControlRH = false,
  onAbrirExportar,
  onSeleccionarPapeleta
}) {
  const [areaActiva, setAreaActiva] = useState('produccion');
  const [busqueda, setBusqueda] = useState('');
  const [deptoFiltro, setDeptoFiltro] = useState('todos');
  const [tipoFiltro, setTipoFiltro] = useState('todos');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [modoPeriodo, setModoPeriodo] = useState('semana');
  const [offsetSemana, setOffsetSemana] = useState(0);
  const [paginaActual, setPaginaActual] = useState(1);
  const [seleccionados, setSeleccionados] = useState([]);
  const [expandidos, setExpandidos] = useState([]);
  const [mostrarFiltrosMovil, setMostrarFiltrosMovil] = useState(false);

  const registrosPorPagina = 12;
  const textSecundario = modoOscuro ? '#cbd5e1' : '#475569';

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

  const pasesPorArea = useMemo(() => {
    if (!esControlRH) return { todos: solicitudesEnPeriodo };

    const prod = [];
    const admin = [];
    const obra = [];

    solicitudesEnPeriodo.forEach(s => {
      const folio = (s.folio || '').toUpperCase();
      const clasif = (s.usuarios?.tipo_personal || s.usuarios?.departamentos?.clasificacion || '').toLowerCase();
      const nomDepto = (s.usuarios?.departamentos?.nombre || '').toLowerCase();

      if (folio.startsWith('A-') || clasif.includes('admin')) {
        admin.push(s);
      } else if (folio.startsWith('O-') || clasif.includes('obra') || nomDepto.includes('obra')) {
        obra.push(s);
      } else {
        prod.push(s);
      }
    });

    const ordenar = (lista) =>
      [...lista].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return {
      produccion: ordenar(prod),
      administracion: ordenar(admin),
      obra: ordenar(obra)
    };
  }, [solicitudesEnPeriodo, esControlRH]);

  const solicitudesProcesadas = useMemo(() => {
    const base = esControlRH ? (pasesPorArea[areaActiva] || []) : solicitudesEnPeriodo;
    const term = busqueda.toLowerCase().trim();

    return base.filter(s => {
      const u = s.usuarios || {};
      const esAut = ['autorizado', 'aprobado', 'completado_caseta'].includes(s.estado_general);

      if (term) {
        const match =
          (s.folio || '').toLowerCase().includes(term) ||
          (u.nombre_completo || '').toLowerCase().includes(term) ||
          String(u.numero_empleado || '').toLowerCase().includes(term) ||
          (u.departamentos?.nombre || '').toLowerCase().includes(term);
        if (!match) return false;
      }

      if (deptoFiltro !== 'todos' && String(u.departamento_id) !== String(deptoFiltro)) return false;
      if (tipoFiltro !== 'todos' && (s.tipo_permiso || '').toLowerCase() !== tipoFiltro) return false;
      if (filtroEstado === 'autorizado' && !esAut) return false;
      if (filtroEstado === 'rechazado' && s.estado_general !== 'rechazado') return false;

      return true;
    });
  }, [solicitudesEnPeriodo, esControlRH, pasesPorArea, areaActiva, busqueda, deptoFiltro, tipoFiltro, filtroEstado]);

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

  const limpiarFiltros = () => {
    setBusqueda('');
    setDeptoFiltro('todos');
    setTipoFiltro('todos');
    setFiltroEstado('todos');
    setModoPeriodo('semana');
    setOffsetSemana(0);
    setPaginaActual(1);
  };

  const hayFiltrosActivos =
    busqueda ||
    deptoFiltro !== 'todos' ||
    tipoFiltro !== 'todos' ||
    filtroEstado !== 'todos' ||
    modoPeriodo !== 'semana' ||
    offsetSemana !== 0;

  const getEstiloTipo = (tipoRaw = '') => {
    const t = tipoRaw.toLowerCase();
    if (t === 'retardo') return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.09)', border: 'rgba(239, 68, 68, 0.28)', label: 'RETARDO' };
    if (t === 'falta') return { color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.09)', border: 'rgba(139, 92, 246, 0.28)', label: 'FALTA' };
    if (t === 'vacaciones') return { color: '#10b981', bg: 'rgba(16, 185, 129, 0.09)', border: 'rgba(16, 185, 129, 0.28)', label: 'VACACIONES' };
    if (t === 'salida') return { color: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.09)', border: 'rgba(14, 165, 233, 0.28)', label: 'SALIDA' };
    return { color: c.text, bg: c.bg, border: c.border, label: (tipoRaw || 'PERMISO').toUpperCase() };
  };

  const renderIconoNaturaleza = (cat = '') => {
    if (!cat) return null;
    const low = cat.toLowerCase();
    let Icono = User;
    if (low.includes('cita') || low.includes('médic')) Icono = Stethoscope;
    else if (low.includes('trabajo')) Icono = Briefcase;
    else if (low.includes('vacaciones')) Icono = Calendar;

    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: textSecundario, fontWeight: '700' }}>
        <Icono size={13} color={textSecundario} />
        <span>{cat}</span>
      </span>
    );
  };

  const ChipFirmaDetalle = ({ rolLabel, nombre, estado }) => {
    const est = (estado || 'pendiente').toLowerCase();
    if (est === 'omitido' || (!nombre && est !== 'rechazado')) return null;

    const ok = ['autorizado', 'aprobado', 'auto_aprobado', 'escalado'].includes(est);
    const rech = est === 'rechazado';
    const color = ok ? '#16a34a' : rech ? '#ef4444' : textSecundario;

    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: '5px 10px', borderRadius: '8px',
        background: c.surfaceCard, border: `1px solid ${c.border}`,
        fontSize: '12.5px', color: c.text
      }}>
        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ color: textSecundario, fontWeight: '700' }}>{rolLabel}:</span>
        <strong style={{ fontWeight: '800' }}>{acortarNombre(nombre || 'Autorizado')}</strong>
      </div>
    );
  };

  const alturaControl = '40px';
  const totalColumnas = esControlRH ? 6 : 4;

  return (
    <div className="th-main-wrapper">
      <style>{`
        .th-main-wrapper {
          display: flex;
          flex-direction: column;
          gap: 14px;
          width: 100%;
          box-sizing: border-box;
        }
        .th-top-bar {
          display: flex;
          gap: 12px;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
        }
        .th-tabs-area {
          flex: 0 1 520px;
          margin: 0;
          height: 44px;
          box-sizing: border-box;
        }
        .th-right-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          margin-left: auto;
        }
        .th-week-box {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          background: ${c.surfaceCard};
          border: 1.5px solid ${c.border};
          padding: 0 12px;
          height: 44px;
          box-sizing: border-box;
          border-radius: 11px;
        }
        .th-btn-export-desktop {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 0 18px;
          height: 44px;
          box-sizing: border-box;
          border-radius: 11px;
          border: none;
          background: ${c.accent};
          color: #fff;
          font-size: 13.5px;
          font-weight: 800;
          cursor: pointer;
          white-space: nowrap;
        }
        .th-filters-container {
          background: ${c.surfaceCard};
          border: 1.5px solid ${c.border};
          border-radius: 12px;
          padding: 10px 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          box-sizing: border-box;
        }
        .th-search-row {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          flex-wrap: wrap;
        }
        .th-search-box {
          display: flex;
          align-items: center;
          gap: 8px;
          background: ${c.bg};
          border: 1px solid ${c.border};
          border-radius: 9px;
          padding: 0 12px;
          height: ${alturaControl};
          box-sizing: border-box;
          flex: 1 1 240px;
          min-width: 0;
        }
        .th-desktop-selects {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .th-mobile-actions-btns {
          display: none;
        }
        .th-mobile-selects-drawer {
          display: none;
        }
        .th-select-filter {
          background: ${c.bg};
          color: ${c.text};
          border: 1px solid ${c.border};
          border-radius: 9px;
          padding: 0 12px;
          height: ${alturaControl};
          box-sizing: border-box;
          font-size: 13px;
          font-weight: 700;
          outline: none;
        }
        .th-desktop-table-view {
          display: block;
        }
        .th-mobile-cards-view {
          display: none;
        }

        /* =========================================================
           DISEÑO MÓVIL (< 768PX): DESPEJADO, CUADRADO Y SIN DESBORDES
           ========================================================= */
        @media (max-width: 768px) {
          .th-main-wrapper {
            padding-top: 44px;
            gap: 10px;
          }
          .th-top-bar {
            flex-direction: column;
            align-items: stretch;
            gap: 10px;
          }
          .th-tabs-area {
            flex: none;
            width: 100%;
            height: 42px;
            padding: 4px !important;
            display: grid !important;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 4px;
            box-sizing: border-box;
          }
          .th-tabs-area .tab-btn {
            padding: 0 6px !important;
            font-size: 12.5px !important;
            gap: 5px !important;
            min-width: 0 !important;
            justify-content: center !important;
          }
          .th-tabs-area .tab-btn svg {
            display: none !important;
          }
          .th-tabs-area .tab-badge {
            padding: 1px 6px !important;
            font-size: 11px !important;
          }
          .th-right-actions {
            width: 100%;
            margin-left: 0;
            display: block;
          }
          .th-week-box {
            width: 100%;
            height: 44px;
            padding: 0 10px;
            box-sizing: border-box;
          }
          .th-btn-export-desktop {
            display: none !important;
          }
          .th-filters-container {
            padding: 10px;
            gap: 10px;
          }
          .th-search-row {
            flex-wrap: nowrap;
            gap: 6px;
          }
          .th-search-box {
            height: 38px;
            padding: 0 10px;
            flex: 1;
          }
          .th-desktop-selects {
            display: none !important;
          }
          .th-mobile-actions-btns {
            display: flex;
            align-items: center;
            gap: 6px;
            flex-shrink: 0;
          }
          .th-mobile-selects-drawer {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            padding-top: 8px;
            border-top: 1px dashed ${c.border};
          }
          .th-select-filter {
            width: 100%;
            min-width: 0;
            height: 38px;
            font-size: 12.5px;
            padding: 0 8px;
          }
          .th-select-full-mobile {
            grid-column: 1 / -1;
          }
          .th-desktop-table-view {
            display: none !important;
          }
          .th-mobile-cards-view {
            display: flex !important;
            flex-direction: column;
            gap: 10px;
            width: 100%;
          }
        }
      `}</style>

      {/* 1. BARRA SUPERIOR: PESTAÑAS DE ÁREA Y NAVEGADOR DE SEMANA */}
      <div className="th-top-bar">
        {esControlRH && (
          <div className="tabs-aprobacion-bar th-tabs-area">
            <button
              className={`tab-btn ${areaActiva === 'produccion' ? 'active' : ''}`}
              onClick={() => { setAreaActiva('produccion'); setPaginaActual(1); setSeleccionados([]); }}
              style={{ fontSize: '13.5px', height: '100%', padding: '0 14px' }}
            >
              <Factory size={14} />
              <span>Producción</span>
              <span className="tab-badge" style={{ background: areaActiva === 'produccion' ? c.accent : c.border, color: areaActiva === 'produccion' ? '#fff' : c.text, fontSize: '11.5px' }}>
                {pasesPorArea.produccion?.length || 0}
              </span>
            </button>

            <button
              className={`tab-btn ${areaActiva === 'administracion' ? 'active' : ''}`}
              onClick={() => { setAreaActiva('administracion'); setPaginaActual(1); setSeleccionados([]); }}
              style={{ fontSize: '13.5px', height: '100%', padding: '0 14px' }}
            >
              <Building2 size={14} />
              <span>Admin</span>
              <span className="tab-badge" style={{ background: areaActiva === 'administracion' ? c.accent : c.border, color: areaActiva === 'administracion' ? '#fff' : c.text, fontSize: '11.5px' }}>
                {pasesPorArea.administracion?.length || 0}
              </span>
            </button>

            <button
              className={`tab-btn ${areaActiva === 'obra' ? 'active' : ''}`}
              onClick={() => { setAreaActiva('obra'); setPaginaActual(1); setSeleccionados([]); }}
              style={{ fontSize: '13.5px', height: '100%', padding: '0 14px' }}
            >
              <HardHat size={14} />
              <span>Obra</span>
              <span className="tab-badge" style={{ background: areaActiva === 'obra' ? c.accent : c.border, color: areaActiva === 'obra' ? '#fff' : c.text, fontSize: '11.5px' }}>
                {pasesPorArea.obra?.length || 0}
              </span>
            </button>
          </div>
        )}

        <div className="th-right-actions">
          <div className="th-week-box">
            {modoPeriodo === 'semana' ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                  <button
                    onClick={() => { setOffsetSemana(prev => prev - 1); setPaginaActual(1); setSeleccionados([]); }}
                    title="Semana anterior"
                    style={{
                      width: '28px', height: '28px', borderRadius: '7px', border: `1px solid ${c.border}`,
                      background: c.bg, color: c.text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}
                  >
                    <ChevronLeft size={15} />
                  </button>

                  <div style={{ padding: '0 2px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '13px', fontWeight: '800', color: c.text }}>
                      Sem {infoSemana.numSemana}
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: textSecundario, marginLeft: '5px' }}>
                      ({infoSemana.etiquetaRango})
                    </span>
                  </div>

                  <button
                    onClick={() => { setOffsetSemana(prev => prev + 1); setPaginaActual(1); setSeleccionados([]); }}
                    title="Semana siguiente"
                    style={{
                      width: '28px', height: '28px', borderRadius: '7px', border: `1px solid ${c.border}`,
                      background: c.bg, color: c.text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  {offsetSemana !== 0 && (
                    <button
                      onClick={() => { setOffsetSemana(0); setPaginaActual(1); setSeleccionados([]); }}
                      style={{
                        height: '28px', padding: '0 8px', borderRadius: '7px', border: 'none',
                        background: c.accentSoft, color: c.accent, fontSize: '11.5px', fontWeight: '800', cursor: 'pointer'
                      }}
                    >
                      Hoy
                    </button>
                  )}

                  <button
                    onClick={() => { setModoPeriodo('todo'); setPaginaActual(1); setSeleccionados([]); }}
                    style={{
                      height: '28px', padding: '0 9px', borderRadius: '7px', border: `1px solid ${c.border}`,
                      background: c.bg, color: textSecundario, fontSize: '11.5px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap'
                    }}
                  >
                    Todo ({solicitudes.length})
                  </button>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: '800', color: c.text, whiteSpace: 'nowrap' }}>
                  Mostrando Todo ({solicitudes.length})
                </span>
                <button
                  onClick={() => {
                    setModoPeriodo('semana');
                    setOffsetSemana(0);
                    setPaginaActual(1);
                  }}
                  style={{
                    height: '28px', padding: '0 10px', borderRadius: '7px', border: `1px solid ${c.border}`,
                    background: c.bg, color: c.text, fontSize: '12px', fontWeight: '800', cursor: 'pointer', whiteSpace: 'nowrap'
                  }}
                >
                  Volver a Sem {infoSemana.numSemana}
                </button>
              </div>
            )}
          </div>

          {esControlRH && onAbrirExportar && (
            <button onClick={onAbrirExportar} className="th-btn-export-desktop">
              <FileSpreadsheet size={16} /> Exportar Excel
            </button>
          )}
        </div>
      </div>

      {/* 2. BARRA DE BÚSQUEDA + FILTROS COLAPSABLES EN MÓVIL */}
      <div className="th-filters-container">
        <div className="th-search-row">
          <div className="th-search-box">
            <Search size={15} color={textSecundario} style={{ flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Buscar folio, nombre o #..."
              value={busqueda}
              onChange={(e) => { setBusqueda(e.target.value); setPaginaActual(1); }}
              style={{ border: 'none', background: 'transparent', outline: 'none', color: c.text, fontSize: '13.5px', width: '100%', fontWeight: '500', minWidth: 0 }}
            />
          </div>

          {/* BOTONES COMPACTOS EN MÓVIL: FILTROS Y EXCEL */}
          <div className="th-mobile-actions-btns">
            <button
              type="button"
              onClick={() => setMostrarFiltrosMovil(prev => !prev)}
              style={{
                height: '38px', padding: '0 11px', borderRadius: '9px',
                border: `1px solid ${(mostrarFiltrosMovil || deptoFiltro !== 'todos' || tipoFiltro !== 'todos' || filtroEstado !== 'todos') ? c.accent : c.border}`,
                background: (mostrarFiltrosMovil || deptoFiltro !== 'todos' || tipoFiltro !== 'todos' || filtroEstado !== 'todos') ? c.accentSoft : c.bg,
                color: (mostrarFiltrosMovil || deptoFiltro !== 'todos' || tipoFiltro !== 'todos' || filtroEstado !== 'todos') ? c.accent : c.text,
                fontSize: '12.5px', fontWeight: '800', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: '5px'
              }}
            >
              <SlidersHorizontal size={14} />
              <span>Filtros</span>
            </button>

            {esControlRH && onAbrirExportar && (
              <button
                type="button"
                onClick={onAbrirExportar}
                style={{
                  height: '38px', padding: '0 12px', borderRadius: '9px', border: 'none',
                  background: c.accent, color: '#fff', fontSize: '12.5px', fontWeight: '800',
                  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px'
                }}
              >
                <FileSpreadsheet size={14} />
                <span>Excel</span>
              </button>
            )}
          </div>

          {/* SELECTORES VISIBLES EN ESCRITORIO */}
          <div className="th-desktop-selects">
            {esControlRH && departamentos.length > 0 && (
              <select
                value={deptoFiltro}
                onChange={(e) => { setDeptoFiltro(e.target.value); setPaginaActual(1); }}
                className="th-select-filter"
              >
                <option value="todos">Todos los Deptos</option>
                {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
              </select>
            )}

            <select
              value={tipoFiltro}
              onChange={(e) => { setTipoFiltro(e.target.value); setPaginaActual(1); }}
              className="th-select-filter"
            >
              <option value="todos">Todos los Tipos</option>
              <option value="salida">Salida</option>
              <option value="retardo">Retardo</option>
              <option value="falta">Falta</option>
              <option value="vacaciones">Vacaciones</option>
            </select>

            <select
              value={filtroEstado}
              onChange={(e) => { setFiltroEstado(e.target.value); setPaginaActual(1); }}
              className="th-select-filter"
            >
              <option value="todos">Autorizados y Rechazados</option>
              <option value="autorizado">Solo Autorizados</option>
              <option value="rechazado">Solo Rechazados</option>
            </select>

            {hayFiltrosActivos && (
              <button
                onClick={limpiarFiltros}
                style={{
                  padding: '0 12px', height: alturaControl, boxSizing: 'border-box', borderRadius: '8px',
                  border: `1px solid ${c.border}`, background: c.bg, color: textSecundario,
                  fontSize: '13px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px'
                }}
              >
                <RotateCcw size={13} /> Limpiar
              </button>
            )}

            {esControlRH && seleccionados.length > 0 && (
              <button
                onClick={() => onSeleccionarPapeleta(solicitudes.filter(s => seleccionados.includes(s.id)))}
                style={{
                  padding: '0 14px', height: alturaControl, boxSizing: 'border-box', borderRadius: '8px',
                  border: 'none', background: c.accent, color: '#fff', fontSize: '13px', fontWeight: '800',
                  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px'
                }}
              >
                <Printer size={14} /> Imprimir ({seleccionados.length})
              </button>
            )}
          </div>
        </div>

        {/* CAJÓN PLEGABLE DE FILTROS EN CELULAR */}
        {mostrarFiltrosMovil && (
          <div className="th-mobile-selects-drawer">
            {esControlRH && departamentos.length > 0 && (
              <select
                value={deptoFiltro}
                onChange={(e) => { setDeptoFiltro(e.target.value); setPaginaActual(1); }}
                className="th-select-filter"
              >
                <option value="todos">Depto: Todos</option>
                {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
              </select>
            )}

            <select
              value={tipoFiltro}
              onChange={(e) => { setTipoFiltro(e.target.value); setPaginaActual(1); }}
              className="th-select-filter"
            >
              <option value="todos">Tipo: Todos</option>
              <option value="salida">Salida</option>
              <option value="retardo">Retardo</option>
              <option value="falta">Falta</option>
              <option value="vacaciones">Vacaciones</option>
            </select>

            <select
              value={filtroEstado}
              onChange={(e) => { setFiltroEstado(e.target.value); setPaginaActual(1); }}
              className="th-select-filter th-select-full-mobile"
            >
              <option value="todos">Dictamen: Autorizados y Rechazados</option>
              <option value="autorizado">Solo Autorizados</option>
              <option value="rechazado">Solo Rechazados</option>
            </select>

            {hayFiltrosActivos && (
              <button
                onClick={limpiarFiltros}
                className="th-select-full-mobile"
                style={{
                  height: '36px', borderRadius: '8px', border: `1px solid ${c.border}`,
                  background: c.bg, color: textSecundario, fontSize: '12.5px', fontWeight: '700',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px'
                }}
              >
                <RotateCcw size={13} /> Restablecer filtros
              </button>
            )}
          </div>
        )}

        {esControlRH && seleccionados.length > 0 && (
          <div className="th-mobile-actions-btns" style={{ width: '100%' }}>
            <button
              onClick={() => onSeleccionarPapeleta(solicitudes.filter(s => seleccionados.includes(s.id)))}
              style={{
                width: '100%', height: '38px', borderRadius: '9px', border: 'none',
                background: c.accent, color: '#fff', fontSize: '13px', fontWeight: '800',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
              }}
            >
              <Printer size={14} /> Imprimir seleccionadas ({seleccionados.length})
            </button>
          </div>
        )}
      </div>

      {/* 3. LISTADO */}
      {solicitudesPaginadas.length === 0 ? (
        <div style={{
          background: c.surfaceCard, border: `1.5px solid ${c.border}`, borderRadius: '12px',
          padding: '42px 20px', textAlign: 'center', color: textSecundario, fontSize: '14px', fontWeight: '600'
        }}>
          <div>
            No hay permisos de <strong>{areaActiva === 'produccion' ? 'Producción' : areaActiva === 'administracion' ? 'Administración' : 'Obra'}</strong> en {modoPeriodo === 'semana' ? `la Semana ${infoSemana.numSemana} (${infoSemana.etiquetaRango})` : 'el periodo seleccionado'}.
          </div>
          {esControlRH && solicitudesEnPeriodo.length > 0 && (
            <div style={{ marginTop: '8px', fontSize: '13px', color: c.accent }}>
              (Hay {solicitudesEnPeriodo.length} permiso(s) en las otras pestañas de área en esta misma semana).
            </div>
          )}
        </div>
      ) : (
        <>
          {/* A) TABLA DE ESCRITORIO / LAPTOP 14" */}
          <div className="th-desktop-table-view" style={{ background: c.surfaceCard, borderRadius: '12px', border: `1px solid ${c.border}`, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                <colgroup>
                  {esControlRH && <col style={{ width: '42px' }} />}
                  <col style={{ width: esControlRH ? '30%' : '36%' }} />
                  <col style={{ width: esControlRH ? '27%' : '32%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '13%' }} />
                  {esControlRH && <col style={{ width: '195px' }} />}
                </colgroup>
                <thead>
                  <tr style={{
                    background: c.surface, borderBottom: `1px solid ${c.border}`,
                    color: textSecundario, fontSize: '12px', fontWeight: '800',
                    textTransform: 'uppercase', letterSpacing: '0.04em'
                  }}>
                    {esControlRH && (
                      <th style={{ padding: '12px 10px 12px 16px', verticalAlign: 'middle' }}>
                        <div onClick={toggleSeleccionarTodo} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                          {seleccionados.length > 0 && seleccionados.length === solicitudesPaginadas.length
                            ? <CheckSquare size={17} color={c.accent} />
                            : <Square size={17} />}
                        </div>
                      </th>
                    )}
                    <th style={{ padding: '12px 14px', verticalAlign: 'middle' }}>Colaborador / Folio</th>
                    <th style={{ padding: '12px 14px', verticalAlign: 'middle' }}>Incidencia y Horario</th>
                    <th style={{ padding: '12px 14px', verticalAlign: 'middle', textAlign: 'center' }}>Caseta</th>
                    <th style={{ padding: '12px 14px', verticalAlign: 'middle', textAlign: 'center' }}>Dictamen</th>
                    {esControlRH && <th style={{ padding: '12px 16px 12px 10px', verticalAlign: 'middle', textAlign: 'right' }}>Detalle / Papeleta</th>}
                  </tr>
                </thead>
                <tbody>
                  {solicitudesPaginadas.map(s => {
                    const u = s.usuarios || {};
                    const esAut = ['autorizado', 'aprobado', 'completado_caseta'].includes(s.estado_general);
                    const pagoLow = (s.pago || '').toLowerCase();
                    const seRegresoCasa = pagoLow.includes('regresa');
                    const esAlertaPago = seRegresoCasa || pagoLow.includes('sin goce');
                    const seleccionado = seleccionados.includes(s.id);
                    const expandido = expandidos.includes(s.id);
                    const tipo = (s.tipo_permiso || '').toLowerCase();
                    const aplicaCaseta = tipo === 'salida' || tipo === 'retardo';
                    const estiloTipo = getEstiloTipo(s.tipo_permiso);

                    const {
                      horarioSolicitado,
                      horaSalidaCaseta,
                      horaEntradaCaseta,
                      horaRegresadoCaseta,
                      supervisorSubarea,
                      motivoRechazo,
                      notasFlujo
                    } = parsearDatosObservaciones(s.observaciones);

                    const { categoria, texto: motivoTexto } = limpiarMotivo(s.asunto_motivo);

                    const renderIconoCaseta = () => {
                      if (!esAut) {
                        return (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            padding: '4px 10px', borderRadius: '999px', fontSize: '12.5px', fontWeight: '800',
                            background: 'rgba(239,68,68,0.1)', color: '#ef4444'
                          }}>
                            <XCircle size={14} /> Cancelado
                          </span>
                        );
                      }
                      if (seRegresoCasa) {
                        return (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            padding: '4px 10px', borderRadius: '999px', fontSize: '12.5px', fontWeight: '800',
                            background: 'rgba(245,158,11,0.14)', color: '#d97706'
                          }}>
                            <CornerUpLeft size={14} /> {horaRegresadoCaseta || 'Regresado'}
                          </span>
                        );
                      }
                      if (!aplicaCaseta) {
                        return (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            padding: '4px 10px', borderRadius: '999px', fontSize: '12.5px', fontWeight: '700',
                            background: c.bg, color: textSecundario, border: `1px solid ${c.border}`
                          }}>
                            <MinusCircle size={13} /> N/A
                          </span>
                        );
                      }
                      if (horaSalidaCaseta || horaEntradaCaseta) {
                        const textoHora = horaSalidaCaseta && horaEntradaCaseta
                          ? `${horaSalidaCaseta.replace(/\s*hrs/i, '')} → ${horaEntradaCaseta.replace(/\s*hrs/i, '')}`
                          : (horaSalidaCaseta || horaEntradaCaseta);
                        return (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            padding: '4px 10px', borderRadius: '999px', fontSize: '12.5px', fontWeight: '800',
                            background: c.bg, color: c.text, border: `1px solid ${c.border}`
                          }}>
                            <DoorOpen size={14} color={textSecundario} /> {textoHora}
                          </span>
                        );
                      }
                      return (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '5px',
                          padding: '4px 10px', borderRadius: '999px', fontSize: '12.5px', fontWeight: '700',
                          background: c.bg, color: textSecundario, border: `1px dashed ${c.border}`
                        }}>
                          <Clock size={13} /> Sin sello
                        </span>
                      );
                    };

                    return (
                      <React.Fragment key={s.id}>
                        <tr
                          onClick={() => toggleExpandir(s.id)}
                          style={{
                            cursor: 'pointer',
                            borderBottom: expandido ? 'none' : `1px solid ${c.borderDivider}`,
                            background: seleccionado
                              ? (modoOscuro ? 'rgba(22,163,74,0.14)' : 'rgba(22,163,74,0.06)')
                              : expandido
                                ? (modoOscuro ? 'rgba(255,255,255,0.03)' : '#f8fafc')
                                : 'transparent',
                            transition: 'background 0.15s ease'
                          }}
                        >
                          {esControlRH && (
                            <td style={{ padding: '14px 10px 14px 16px', verticalAlign: 'middle' }} onClick={(e) => toggleSeleccion(s.id, e)}>
                              <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                {seleccionado
                                  ? <CheckSquare size={17} color={c.accent} />
                                  : <Square size={17} color={textSecundario} style={{ opacity: 0.6 }} />}
                              </div>
                            </td>
                          )}

                          <td style={{ padding: '14px', verticalAlign: 'middle', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                              <span style={{
                                fontFamily: 'ui-monospace, monospace', fontSize: '12.5px', fontWeight: '800',
                                color: c.text, background: c.bg, border: `1px solid ${c.border}`,
                                padding: '2px 8px', borderRadius: '5px'
                              }}>
                                {s.folio}
                              </span>
                              <span style={{ fontSize: '13px', fontWeight: '800', color: textSecundario }}>
                                #{u.numero_empleado}
                              </span>
                              <span style={{ fontSize: '12.5px', color: textSecundario, fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                • {u.departamentos?.nombre || 'General'}{u.area && u.area !== u.departamentos?.nombre ? ` (${u.area})` : ''}
                              </span>
                            </div>
                            <div style={{
                              fontWeight: '800', color: c.text, fontSize: '15.5px',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                            }}>
                              {u.nombre_completo || 'Colaborador'}
                            </div>
                          </td>

                          <td style={{ padding: '14px', verticalAlign: 'middle', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                minWidth: '82px', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase',
                                padding: '2px 8px', borderRadius: '5px',
                                background: estiloTipo.bg, border: `1px solid ${estiloTipo.border}`, color: estiloTipo.color
                              }}>
                                {estiloTipo.label}
                              </span>
                              <span style={{ fontSize: '14px', fontWeight: '800', color: c.text }}>
                                {s.fecha_permiso}{s.fecha_fin && s.fecha_fin !== s.fecha_permiso ? ` al ${s.fecha_fin}` : ''}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: textSecundario, fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              <span>{horarioSolicitado}</span>
                              {categoria && (
                                <>
                                  <span>•</span>
                                  {renderIconoNaturaleza(categoria)}
                                </>
                              )}
                            </div>
                          </td>

                          <td style={{ padding: '14px', verticalAlign: 'middle', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {renderIconoCaseta()}
                          </td>

                          <td style={{ padding: '14px 10px', verticalAlign: 'middle', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                              minWidth: '108px', fontSize: '12.5px', fontWeight: '800', padding: '5px 10px', borderRadius: '7px',
                              backgroundColor: !esAut ? 'rgba(239,68,68,0.12)' : esAlertaPago ? 'rgba(245,158,11,0.14)' : 'rgba(22,163,74,0.12)',
                              color: !esAut ? '#ef4444' : esAlertaPago ? '#d97706' : '#16a34a',
                              border: `1px solid ${!esAut ? 'rgba(239,68,68,0.28)' : esAlertaPago ? 'rgba(245,158,11,0.35)' : 'rgba(22,163,74,0.28)'}`
                            }}>
                              {esAut ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                              {esAut ? (seRegresoCasa ? 'Se regresa' : (s.pago || 'Autorizado')) : 'Rechazado'}
                            </span>
                          </td>

                          {esControlRH && (
                            <td style={{ padding: '14px 16px 14px 8px', verticalAlign: 'middle', textAlign: 'right', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <button
                                  onClick={() => toggleExpandir(s.id)}
                                  style={{
                                    padding: '7px 10px', borderRadius: '7px',
                                    border: `1px solid ${expandido ? c.text : c.border}`,
                                    background: expandido ? c.surface : c.bg,
                                    color: expandido ? c.text : textSecundario,
                                    fontSize: '12.5px', fontWeight: '800', cursor: 'pointer',
                                    display: 'inline-flex', alignItems: 'center', gap: '4px'
                                  }}
                                >
                                  {expandido ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                                  {expandido ? 'Ocultar' : 'Detalles'}
                                </button>

                                <button
                                  onClick={() => onSeleccionarPapeleta && onSeleccionarPapeleta([s])}
                                  style={{
                                    padding: '7px 12px', borderRadius: '7px', border: `1px solid ${c.border}`,
                                    background: c.bg, color: c.text, fontSize: '12.5px', fontWeight: '800',
                                    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px'
                                  }}
                                >
                                  <Printer size={14} color={textSecundario} /> Papeleta
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>

                        {expandido && (
                          <tr style={{
                            borderBottom: `1px solid ${c.borderDivider}`,
                            background: modoOscuro ? 'rgba(255,255,255,0.025)' : '#f8fafc'
                          }}>
                            <td colSpan={totalColumnas} style={{ padding: '0 18px 16px 18px' }}>
                              <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1.2fr 1fr',
                                gap: '16px',
                                padding: '14px 16px',
                                borderRadius: '10px',
                                background: c.bg,
                                border: `1px solid ${c.border}`
                              }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '12px', borderRight: `1px solid ${c.border}` }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: '800', color: textSecundario, textTransform: 'uppercase' }}>
                                    <FileText size={13} color={textSecundario} />
                                    <span>Motivo {categoria ? `• ${categoria}` : ''}</span>
                                  </div>
                                  <div style={{ fontSize: '14px', fontWeight: '600', color: c.text, lineHeight: 1.45 }}>
                                    {motivoTexto || 'Sin motivo especificado.'}
                                  </div>

                                  {notasFlujo && notasFlujo.length > 0 && (
                                    <div style={{ marginTop: '4px', paddingTop: '8px', borderTop: `1px dashed ${c.border}`, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: '800', color: textSecundario, textTransform: 'uppercase' }}>
                                        <MessageSquare size={12} color={textSecundario} />
                                        <span>Comentarios de Autorización</span>
                                      </div>
                                      {notasFlujo.map((n, idx) => (
                                        <div key={idx} style={{ fontSize: '13px', color: c.text }}>
                                          <strong>{n.autor}:</strong> {n.texto}
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {!esAut && motivoRechazo && (
                                    <div style={{ fontSize: '13px', color: '#ef4444', fontWeight: '700', marginTop: '4px' }}>
                                      Motivo de rechazo: {motivoRechazo}
                                    </div>
                                  )}
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: '800', color: textSecundario, textTransform: 'uppercase' }}>
                                    <ShieldCheck size={14} color={textSecundario} />
                                    <span>Cadena de Firmas y Aprobación</span>
                                  </div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {supervisorSubarea && (
                                      <ChipFirmaDetalle rolLabel="Subárea" nombre={supervisorSubarea} estado="autorizado" />
                                    )}
                                    <ChipFirmaDetalle rolLabel="Jefe" nombre={s.firmante1?.nombre_completo} estado={s.firma_1_estado} />
                                    <ChipFirmaDetalle rolLabel="Gerente" nombre={s.firmante2?.nombre_completo} estado={s.firma_2_estado} />
                                    <ChipFirmaDetalle rolLabel="RH" nombre={s.firmante3?.nombre_completo} estado={s.firma_3_estado} />
                                  </div>
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

          {/* B) TARJETAS MÓVILES PERFECTAMENTE ENCUADRADAS (SIN DESBORDE DERECHO) */}
          <div className="th-mobile-cards-view">
            {solicitudesPaginadas.map(s => {
              const u = s.usuarios || {};
              const esAut = ['autorizado', 'aprobado', 'completado_caseta'].includes(s.estado_general);
              const pagoLow = (s.pago || '').toLowerCase();
              const seRegresoCasa = pagoLow.includes('regresa');
              const esAlertaPago = seRegresoCasa || pagoLow.includes('sin goce');
              const seleccionado = seleccionados.includes(s.id);
              const expandido = expandidos.includes(s.id);
              const estiloTipo = getEstiloTipo(s.tipo_permiso);
              const tipoLow = (s.tipo_permiso || '').toLowerCase();

              const {
                horarioSolicitado,
                horaSalidaCaseta,
                horaEntradaCaseta,
                horaRegresadoCaseta,
                supervisorSubarea,
                motivoRechazo,
                notasFlujo
              } = parsearDatosObservaciones(s.observaciones);
              const { categoria, texto: motivoTexto } = limpiarMotivo(s.asunto_motivo);

              const fechaBonita = (s.fecha_fin && s.fecha_fin !== s.fecha_permiso)
                ? `${formatearFechaCorta(s.fecha_permiso)} al ${formatearFechaCorta(s.fecha_fin)}`
                : formatearFechaCorta(s.fecha_permiso);

              let horarioLimpio = String(horarioSolicitado || '')
                .replace(/^Llegada estimada:\s*/i, 'Llegada: ')
                .replace(/^Salida definitiva:\s*/i, 'Salida: ')
                .replace(/^Para el:\s*.*$/i, 'Día completo');

              if (tipoLow === 'vacaciones' || horarioLimpio.toLowerCase().startsWith('del ')) {
                horarioLimpio = 'Periodo vacacional';
              }

              return (
                <div
                  key={s.id}
                  style={{
                    background: c.surfaceCard,
                    border: `1.5px solid ${seleccionado ? c.accent : c.border}`,
                    borderLeft: `5px solid ${estiloTipo.color}`,
                    borderRadius: '14px',
                    padding: '13px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '9px',
                    boxSizing: 'border-box',
                    overflow: 'hidden'
                  }}
                >
                  {/* FILA 1: CHECKBOX + FOLIO A LA IZQ <---> DICTAMEN + FLECHA A LA DER (JAMÁS SE DESBORDA) */}
                  <div
                    onClick={() => toggleExpandir(s.id)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', cursor: 'pointer', width: '100%' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {esControlRH && (
                        <div onClick={(e) => toggleSeleccion(s.id, e)} style={{ display: 'flex', alignItems: 'center' }}>
                          {seleccionado
                            ? <CheckSquare size={18} color={c.accent} />
                            : <Square size={18} color={textSecundario} />}
                        </div>
                      )}
                      <span style={{
                        fontFamily: 'ui-monospace, monospace', fontSize: '12px', fontWeight: '800',
                        color: c.text, background: c.bg, border: `1px solid ${c.border}`,
                        padding: '2px 8px', borderRadius: '6px', whiteSpace: 'nowrap'
                      }}>
                        {s.folio}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontSize: '11px', fontWeight: '800', padding: '3px 9px', borderRadius: '6px',
                        textTransform: 'uppercase', whiteSpace: 'nowrap',
                        backgroundColor: !esAut ? 'rgba(239,68,68,0.12)' : esAlertaPago ? 'rgba(245,158,11,0.14)' : 'rgba(22,163,74,0.12)',
                        color: !esAut ? '#ef4444' : esAlertaPago ? '#d97706' : '#16a34a',
                        border: `1px solid ${!esAut ? 'rgba(239,68,68,0.28)' : esAlertaPago ? 'rgba(245,158,11,0.35)' : 'rgba(22,163,74,0.28)'}`
                      }}>
                        {esAut ? (seRegresoCasa ? 'Se regresa' : (s.pago || 'Autorizado')) : 'Rechazado'}
                      </span>
                      {expandido ? <ChevronUp size={18} color={textSecundario} /> : <ChevronDown size={18} color={textSecundario} />}
                    </div>
                  </div>

                  {/* FILA 2: NOMBRE DEL COLABORADOR Y DEPARTAMENTO */}
                  <div onClick={() => toggleExpandir(s.id)} style={{ cursor: 'pointer' }}>
                    <div style={{ fontSize: '14.5px', fontWeight: '800', color: c.text, lineHeight: 1.25 }}>
                      {u.nombre_completo || 'Colaborador'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '3px', fontSize: '12px', color: textSecundario, fontWeight: '600' }}>
                      <span>#{u.numero_empleado} • {u.departamentos?.nombre || 'General'}</span>
                      {renderIconoNaturaleza(categoria)}
                    </div>
                  </div>

                  {/* FILA 3: PÍLDORA DEL TIPO DE PERMISO + FECHA + HORARIO */}
                  <div
                    onClick={() => toggleExpandir(s.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      fontSize: '12.5px', color: c.text, fontWeight: '700', cursor: 'pointer',
                      paddingTop: '7px', borderTop: `1px solid ${c.border}`
                    }}
                  >
                    <span style={{
                      fontSize: '10.5px', fontWeight: '800', textTransform: 'uppercase',
                      padding: '2px 8px', borderRadius: '5px', whiteSpace: 'nowrap', flexShrink: 0,
                      background: estiloTipo.bg, border: `1px solid ${estiloTipo.border}`, color: estiloTipo.color
                    }}>
                      {estiloTipo.label}
                    </span>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {fechaBonita} <span style={{ color: textSecundario, fontWeight: '600' }}>• {horarioLimpio}</span>
                    </span>
                  </div>

                  {/* CAJÓN DESPLEGABLE */}
                  {expandido && (
                    <div style={{
                      paddingTop: '10px', borderTop: `1px dashed ${c.border}`,
                      display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px'
                    }}>
                      <div style={{ background: c.bg, padding: '9px 12px', borderRadius: '8px', border: `1px solid ${c.border}`, color: c.text }}>
                        <strong style={{ display: 'block', fontSize: '11px', color: textSecundario, textTransform: 'uppercase', marginBottom: '2px' }}>
                          Motivo:
                        </strong>
                        {motivoTexto || 'Sin motivo especificado.'}
                      </div>

                      {(horaSalidaCaseta || horaEntradaCaseta || horaRegresadoCaseta) && (
                        <div style={{ fontSize: '12px', fontWeight: '700', color: textSecundario }}>
                          Caseta: {horaSalidaCaseta ? `Salida ${horaSalidaCaseta}` : ''} {horaEntradaCaseta ? `• Entrada ${horaEntradaCaseta}` : ''} {horaRegresadoCaseta ? `• Regresado ${horaRegresadoCaseta}` : ''}
                        </div>
                      )}

                      {notasFlujo && notasFlujo.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          {notasFlujo.map((n, idx) => (
                            <div key={idx} style={{ fontSize: '12.5px', color: c.text }}>
                              <strong>💬 {n.autor}:</strong> {n.texto}
                            </div>
                          ))}
                        </div>
                      )}

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {supervisorSubarea && <ChipFirmaDetalle rolLabel="Subárea" nombre={supervisorSubarea} estado="autorizado" />}
                        <ChipFirmaDetalle rolLabel="Jefe" nombre={s.firmante1?.nombre_completo} estado={s.firma_1_estado} />
                        <ChipFirmaDetalle rolLabel="Gerente" nombre={s.firmante2?.nombre_completo} estado={s.firma_2_estado} />
                        <ChipFirmaDetalle rolLabel="RH" nombre={s.firmante3?.nombre_completo} estado={s.firma_3_estado} />
                      </div>

                      {esControlRH && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onSeleccionarPapeleta && onSeleccionarPapeleta([s]); }}
                          style={{
                            width: '100%', height: '38px', borderRadius: '8px', border: `1px solid ${c.border}`,
                            background: c.bg, color: c.text, fontSize: '13px', fontWeight: '800',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                          }}
                        >
                          <Printer size={15} color={c.accent} /> Ver / Imprimir Papeleta Oficial
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* PAGINACIÓN COMPARTIDA */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px',
            padding: '12px 16px', borderRadius: '12px', border: `1px solid ${c.border}`, background: c.surfaceCard
          }}>
            <span style={{ fontSize: '12.5px', color: textSecundario, fontWeight: '600' }}>
              Mostrando {solicitudesPaginadas.length} de {solicitudesProcesadas.length} registros
            </span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={() => setPaginaActual(p => Math.max(p - 1, 1))}
                disabled={paginaActual === 1}
                style={{ padding: '6px 10px', borderRadius: '6px', border: `1px solid ${c.border}`, background: c.bg, color: c.text, cursor: paginaActual === 1 ? 'not-allowed' : 'pointer', opacity: paginaActual === 1 ? 0.5 : 1 }}
              >
                <ChevronLeft size={15} />
              </button>
              <span style={{ fontSize: '12.5px', fontWeight: '800', color: c.text }}>
                Pág {paginaActual} / {totalPaginas}
              </span>
              <button
                onClick={() => setPaginaActual(p => Math.min(p + 1, totalPaginas))}
                disabled={paginaActual === totalPaginas}
                style={{ padding: '6px 10px', borderRadius: '6px', border: `1px solid ${c.border}`, background: c.bg, color: c.text, cursor: paginaActual === totalPaginas ? 'not-allowed' : 'pointer', opacity: paginaActual === totalPaginas ? 0.5 : 1 }}
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
