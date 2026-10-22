import React, { useState, useMemo } from 'react';
import {
  Search, ChevronLeft, ChevronRight, Printer, CheckSquare, Square,
  Factory, Building2, HardHat, FileSpreadsheet, RotateCcw, Clock,
  CheckCircle2, XCircle, CalendarDays, ChevronDown, ChevronUp,
  DoorOpen, MinusCircle, CornerUpLeft, MessageSquare, ShieldCheck, FileText
} from 'lucide-react';

export const parsearDatosObservaciones = (obs = '') => {
  const texto = String(obs || '');
  const segmentos = texto.split('|').map(s => s.trim()).filter(Boolean);
  const horarioSolicitado = (segmentos[0] || '')
    .replace(/🕒|📅/g, '')
    .trim();

  const mSalida = texto.match(/\[SALIDA CASETA:\s*([^\]]+)\]/i);
  const mEntrada = texto.match(/\[(?:ENTRADA\vert{}REINGRESO) CASETA:\s*([^\]]+)\]/i) || texto.match(/\[LLEGADA EN PUERTA:\s*([^\]]+)\]/i);
  const mRegresado = texto.match(/\[REGRESADO EN PUERTA:\s*([^\]]+)\]/i);
  const mSubarea = texto.match(/VoBo Sub[áa]rea:\s*([^|]+)/i);
  const mRechazo = texto.match(/RECHAZO:\s*([^|]+)/i) || texto.match(/Rechazado por Jefatura:\s*([^|]+)/i);

  const notasFlujo = [];
  segmentos.slice(1).forEach(seg => {
    const mNota = seg.match(/^Nota\s+([^:]+):\s*(.+)\$/i);
    if (mNota) {
      notasFlujo.push({ autor: mNota[1].trim(), texto: mNota[2].trim() });
      return;
    }
    const mRes = seg.match(/^Res:\s*(.+)\$/i);
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
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [modoPeriodo, setModoPeriodo] = useState('semana');
  const [offsetSemana, setOffsetSemana] = useState(0);
  const [paginaActual, setPaginaActual] = useState(1);
  const [seleccionados, setSeleccionados] = useState([]);
  const [expandidos, setExpandidos] = useState([]);

  const registrosPorPagina = 12;
  const textSecundario = modoOscuro ? '#cbd5e1' : '#475569';

  const infoSemana = useMemo(() => obtenerRangoSemana(offsetSemana), [offsetSemana]);
  const usandoRangoManual = Boolean(fechaInicio || fechaFin);

  const solicitudesEnPeriodo = useMemo(() => {
    return solicitudes.filter(s => {
      const f = s.fecha_permiso || '';
      if (usandoRangoManual) {
        if (fechaInicio && f < fechaInicio) return false;
        if (fechaFin && f > fechaFin) return false;
        return true;
      }
      if (modoPeriodo === 'semana') {
        const fFinPermiso = s.fecha_fin || f;
        return f <= infoSemana.fin && fFinPermiso >= infoSemana.inicio;
      }
      return true;
    });
  }, [solicitudes, usandoRangoManual, fechaInicio, fechaFin, modoPeriodo, infoSemana]);

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
    setFechaInicio('');
    setFechaFin('');
    setModoPeriodo('semana');
    setOffsetSemana(0);
    setPaginaActual(1);
  };

  const hayFiltrosActivos =
    busqueda ||
    deptoFiltro !== 'todos' ||
    tipoFiltro !== 'todos' ||
    filtroEstado !== 'todos' ||
    fechaInicio ||
    fechaFin ||
    modoPeriodo !== 'semana' ||
    offsetSemana !== 0;

  // Chip elegante para el cajón desplegable de firmas
  const ChipFirmaDetalle = ({ rolLabel, nombre, estado }) => {
    const est = (estado || 'pendiente').toLowerCase();
    if (est === 'omitido' || (!nombre && est !== 'rechazado')) return null;

    const ok = ['autorizado', 'aprobado', 'auto_aprobado', 'escalado'].includes(est);
    const rech = est === 'rechazado';
    const color = ok ? '#16a34a' : rech ? '#ef4444' : textSecundario;

    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: '7px',
        padding: '6px 12px', borderRadius: '8px',
        background: c.surfaceCard, border: `1px solid ${c.border}`,
        fontSize: '13px', color: c.text
      }}>
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ color: textSecundario, fontWeight: '700' }}>{rolLabel}:</span>
        <strong style={{ fontWeight: '800' }}>{acortarNombre(nombre || 'Autorizado')}</strong>
      </div>
    );
  };

  const alturaControl = '38px';
  const totalColumnas = esControlRH ? 6 : 4;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>

      {/* 1. BARRA SUPERIOR UNIFICADA (42px) */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        {esControlRH && (
          <div className="tabs-aprobacion-bar" style={{ flex: '1 1 380px', margin: 0, height: '42px', boxSizing: 'border-box' }}>
            <button
              className={`tab-btn ${areaActiva === 'produccion' ? 'active' : ''}`}
              onClick={() => { setAreaActiva('produccion'); setPaginaActual(1); setSeleccionados([]); }}
              style={{ fontSize: '13.5px', height: '100%', padding: '0 14px' }}
            >
              <Factory size={15} />
              <span>Producción</span>
              <span className="tab-badge" style={{ background: areaActiva === 'produccion' ? c.accent : c.border, color: areaActiva === 'produccion' ? '#fff' : c.text, fontSize: '12px' }}>
                {pasesPorArea.produccion?.length || 0}
              </span>
            </button>

            <button
              className={`tab-btn ${areaActiva === 'administracion' ? 'active' : ''}`}
              onClick={() => { setAreaActiva('administracion'); setPaginaActual(1); setSeleccionados([]); }}
              style={{ fontSize: '13.5px', height: '100%', padding: '0 14px' }}
            >
              <Building2 size={15} />
              <span>Administración</span>
              <span className="tab-badge" style={{ background: areaActiva === 'administracion' ? c.accent : c.border, color: areaActiva === 'administracion' ? '#fff' : c.text, fontSize: '12px' }}>
                {pasesPorArea.administracion?.length || 0}
              </span>
            </button>

            <button
              className={`tab-btn ${areaActiva === 'obra' ? 'active' : ''}`}
              onClick={() => { setAreaActiva('obra'); setPaginaActual(1); setSeleccionados([]); }}
              style={{ fontSize: '13.5px', height: '100%', padding: '0 14px' }}
            >
              <HardHat size={15} />
              <span>Obra</span>
              <span className="tab-badge" style={{ background: areaActiva === 'obra' ? c.accent : c.border, color: areaActiva === 'obra' ? '#fff' : c.text, fontSize: '12px' }}>
                {pasesPorArea.obra?.length || 0}
              </span>
            </button>
          </div>
        )}

        {/* SELECTOR SEMANAL */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: c.surfaceCard, border: `1px solid ${c.border}`,
          padding: '0 12px', height: '42px', boxSizing: 'border-box', borderRadius: '10px'
        }}>
          <CalendarDays size={15} color={c.accent} />

          {modoPeriodo === 'semana' && !usandoRangoManual ? (
            <>
              <button
                onClick={() => { setOffsetSemana(prev => prev - 1); setPaginaActual(1); setSeleccionados([]); }}
                title="Semana anterior"
                style={{
                  width: '28px', height: '28px', borderRadius: '6px', border: `1px solid ${c.border}`,
                  background: c.bg, color: c.text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                <ChevronLeft size={15} />
              </button>

              <div style={{ padding: '0 4px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                <span style={{ fontSize: '13.5px', fontWeight: '800', color: c.text }}>
                  Semana {infoSemana.numSemana}
                </span>
                <span style={{ fontSize: '12.5px', fontWeight: '600', color: textSecundario, marginLeft: '6px' }}>
                  ({infoSemana.etiquetaRango})
                </span>
              </div>

              <button
                onClick={() => { setOffsetSemana(prev => prev + 1); setPaginaActual(1); setSeleccionados([]); }}
                title="Semana siguiente"
                style={{
                  width: '28px', height: '28px', borderRadius: '6px', border: `1px solid ${c.border}`,
                  background: c.bg, color: c.text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                <ChevronRight size={15} />
              </button>

              {offsetSemana !== 0 && (
                <button
                  onClick={() => { setOffsetSemana(0); setPaginaActual(1); setSeleccionados([]); }}
                  style={{
                    height: '28px', padding: '0 9px', borderRadius: '6px', border: 'none',
                    background: c.accentSoft, color: c.accent, fontSize: '12px', fontWeight: '800', cursor: 'pointer'
                  }}
                >
                  Actual
                </button>
              )}

              <button
                onClick={() => { setModoPeriodo('todo'); setPaginaActual(1); setSeleccionados([]); }}
                style={{
                  height: '28px', padding: '0 10px', borderRadius: '6px', border: `1px solid ${c.border}`,
                  background: c.bg, color: textSecundario, fontSize: '12px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap'
                }}
              >
                Ver Todo ({solicitudes.length})
              </button>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: '800', color: c.text, whiteSpace: 'nowrap' }}>
                {usandoRangoManual ? 'Rango manual' : `Todo (${solicitudes.length})`}
              </span>
              <button
                onClick={() => {
                  setFechaInicio('');
                  setFechaFin('');
                  setModoPeriodo('semana');
                  setOffsetSemana(0);
                  setPaginaActual(1);
                }}
                style={{
                  height: '28px', padding: '0 10px', borderRadius: '6px', border: 'none',
                  background: c.accent, color: '#fff', fontSize: '12px', fontWeight: '800', cursor: 'pointer', whiteSpace: 'nowrap'
                }}
              >
                Semana Actual
              </button>
            </div>
          )}
        </div>

        {esControlRH && onAbrirExportar && (
          <button
            onClick={onAbrirExportar}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '0 16px', height: '42px', boxSizing: 'border-box', borderRadius: '10px', border: 'none',
              background: c.accent, color: '#fff', fontSize: '13.5px', fontWeight: '800', cursor: 'pointer', whiteSpace: 'nowrap'
            }}
          >
            <FileSpreadsheet size={16} /> Exportar Excel
          </button>
        )}
      </div>

      {/* 2. BARRA DE FILTROS SIMÉTRICA */}
      <div style={{
        background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '10px',
        padding: '10px 12px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap'
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px', background: c.bg,
          border: `1px solid ${c.border}`, borderRadius: '8px', padding: '0 12px',
          height: alturaControl, boxSizing: 'border-box', flex: '1 1 220px'
        }}>
          <Search size={15} color={textSecundario} />
          <input
            type="text"
            placeholder="Buscar por folio, nombre o #empleado..."
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); setPaginaActual(1); }}
            style={{ border: 'none', background: 'transparent', outline: 'none', color: c.text, fontSize: '13.5px', width: '100%' }}
          />
        </div>

        {esControlRH && departamentos.length > 0 && (
          <select
            value={deptoFiltro}
            onChange={(e) => { setDeptoFiltro(e.target.value); setPaginaActual(1); }}
            style={{
              background: c.bg, color: c.text, border: `1px solid ${c.border}`, borderRadius: '8px',
              padding: '0 10px', height: alturaControl, boxSizing: 'border-box', fontSize: '13px', fontWeight: '700', outline: 'none'
            }}
          >
            <option value="todos">Todos los Deptos</option>
            {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
          </select>
        )}

        <select
          value={tipoFiltro}
          onChange={(e) => { setTipoFiltro(e.target.value); setPaginaActual(1); }}
          style={{
            background: c.bg, color: c.text, border: `1px solid ${c.border}`, borderRadius: '8px',
            padding: '0 10px', height: alturaControl, boxSizing: 'border-box', fontSize: '13px', fontWeight: '700', outline: 'none'
          }}
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
          style={{
            background: c.bg, color: c.text, border: `1px solid ${c.border}`, borderRadius: '8px',
            padding: '0 10px', height: alturaControl, boxSizing: 'border-box', fontSize: '13px', fontWeight: '700', outline: 'none'
          }}
        >
          <option value="todos">Autorizados y Rechazados</option>
          <option value="autorizado">Solo Autorizados</option>
          <option value="rechazado">Solo Rechazados</option>
        </select>

        <input
          type="date"
          value={fechaInicio}
          onChange={(e) => { setFechaInicio(e.target.value); setPaginaActual(1); }}
          title="Desde fecha específica"
          style={{
            background: c.bg, color: c.text, border: `1px solid ${c.border}`, borderRadius: '8px',
            padding: '0 10px', height: alturaControl, boxSizing: 'border-box', fontSize: '13px', outline: 'none'
          }}
        />

        <input
          type="date"
          value={fechaFin}
          onChange={(e) => { setFechaFin(e.target.value); setPaginaActual(1); }}
          title="Hasta fecha específica"
          style={{
            background: c.bg, color: c.text, border: `1px solid ${c.border}`, borderRadius: '8px',
            padding: '0 10px', height: alturaControl, boxSizing: 'border-box', fontSize: '13px', outline: 'none'
          }}
        />

        {hayFiltrosActivos && (
          <button
            onClick={limpiarFiltros}
            title="Restablecer a semana actual"
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

      {/* 3. TABLA MAESTRO-DETALLE EXPANSIVA: LIMPIA, GRANDE Y CON ICONOS EN CASETA */}
      {solicitudesPaginadas.length === 0 ? (
        <div style={{
          background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '12px',
          padding: '36px', textAlign: 'center', color: textSecundario, fontSize: '14.5px', fontWeight: '600'
        }}>
          No hay permisos registrados en {modoPeriodo === 'semana' && !usandoRangoManual ? `la Semana ${infoSemana.numSemana} (${infoSemana.etiquetaRango})` : 'el periodo seleccionado'}.
        </div>
      ) : (
        <div style={{ background: c.surfaceCard, borderRadius: '12px', border: `1px solid ${c.border}`, overflow: 'hidden' }}>
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
                  const seRegresoCasa = (s.pago || '').toLowerCase().includes('regresa');
                  const seleccionado = seleccionados.includes(s.id);
                  const expandido = expandidos.includes(s.id);
                  const tipo = (s.tipo_permiso || '').toLowerCase();
                  const aplicaCaseta = tipo === 'salida' || tipo === 'retardo';

                  const {
                    horarioSolicitado,
                    horaSalidaCaseta,
                    horaEntradaCaseta,
                    horaRegresadoCaseta,
                    requiereRegreso,
                    supervisorSubarea,
                    motivoRechazo,
                    notasFlujo
                  } = parsearDatosObservaciones(s.observaciones);

                  const { categoria, texto: motivoTexto } = limpiarMotivo(s.asunto_motivo);

                  // Renderizado de Píldora Visual con Icono para Caseta
                  const renderIconoCaseta = () => {
                    if (!esAut) {
                      return (
                        <span title="Permiso rechazado" style={{
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
                        <span title="Trabajador regresado en puerta" style={{
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
                        <span title="No requiere control de puerta" style={{
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
                        <span title="Sello registrado en vigilancia" style={{
                          display: 'inline-flex', alignItems: 'center', gap: '5px',
                          padding: '4px 10px', borderRadius: '999px', fontSize: '12.5px', fontWeight: '800',
                          background: 'rgba(22,163,74,0.12)', color: '#16a34a', border: '1px solid rgba(22,163,74,0.28)'
                        }}>
                          <DoorOpen size={14} /> {textoHora}
                        </span>
                      );
                    }
                    return (
                      <span title="Sin sello registrado en caseta" style={{
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
                      {/* FILA PRINCIPAL LIMPIA (CLIC PARA EXPANDIR) */}
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

                        {/* 1. COLABORADOR + FOLIO */}
                        <td style={{ padding: '14px', verticalAlign: 'middle', overflow: 'hidden' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                            <span style={{
                              fontFamily: 'ui-monospace, monospace', fontSize: '12.5px', fontWeight: '900',
                              color: esAut ? '#16a34a' : '#ef4444',
                              background: esAut ? 'rgba(22,163,74,0.12)' : 'rgba(239,68,68,0.12)',
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

                        {/* 2. INCIDENCIA + FECHA + HORARIO */}
                        <td style={{ padding: '14px', verticalAlign: 'middle', overflow: 'hidden' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                            <span style={{
                              fontSize: '11.5px', fontWeight: '800', textTransform: 'uppercase',
                              padding: '2px 8px', borderRadius: '5px', background: c.bg, border: `1px solid ${c.border}`, color: c.text
                            }}>
                              {s.tipo_permiso}
                            </span>
                            <span style={{ fontSize: '14px', fontWeight: '800', color: c.text }}>
                              {s.fecha_permiso}{s.fecha_fin && s.fecha_fin !== s.fecha_permiso ? ` al ${s.fecha_fin}` : ''}
                            </span>
                          </div>
                          <div style={{ fontSize: '13.5px', color: textSecundario, fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {horarioSolicitado}
                            {categoria ? ` • ${categoria}` : ''}
                          </div>
                        </td>

                        {/* 3. CASETA CON ICONO LIMPIO */}
                        <td style={{ padding: '14px', verticalAlign: 'middle', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {renderIconoCaseta()}
                        </td>

                        {/* 4. DICTAMEN DE NÓMINA */}
                        <td style={{ padding: '14px 10px', verticalAlign: 'middle', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                            fontSize: '13px', fontWeight: '800', padding: '5px 11px', borderRadius: '7px',
                            backgroundColor: !esAut ? 'rgba(239,68,68,0.12)' : seRegresoCasa ? 'rgba(245,158,11,0.14)' : 'rgba(22,163,74,0.12)',
                            color: !esAut ? '#ef4444' : seRegresoCasa ? '#d97706' : '#16a34a',
                            border: `1px solid ${!esAut ? 'rgba(239,68,68,0.28)' : seRegresoCasa ? 'rgba(245,158,11,0.35)' : 'rgba(22,163,74,0.28)'}`
                          }}>
                            {esAut ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                            {esAut ? (seRegresoCasa ? 'Se regresa' : (s.pago || 'Autorizado')) : 'Rechazado'}
                          </span>
                        </td>

                        {/* 5. BOTÓN EXPANDIR DETALLES + BOTÓN PAPELETA */}
                        {esControlRH && (
                          <td style={{ padding: '14px 16px 14px 8px', verticalAlign: 'middle', textAlign: 'right', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <button
                                onClick={() => toggleExpandir(s.id)}
                                title="Ver motivo, comentarios y cadena de firmas"
                                style={{
                                  padding: '7px 10px', borderRadius: '7px',
                                  border: `1px solid ${expandido ? c.accent : c.border}`,
                                  background: expandido ? c.accentSoft : c.bg,
                                  color: expandido ? c.accent : textSecundario,
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
                                <Printer size={14} color="#16a34a" /> Papeleta
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>

                      {/* CAJÓN DESPLEGABLE (MOTIVO COMPLETO + COMENTARIOS + CADENA DE FIRMAS) */}
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
                              {/* LADO IZQUIERDO: MOTIVO Y COMENTARIOS DE AUTORIZACIÓN */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '12px', borderRight: `1px solid ${c.border}` }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: '800', color: textSecundario, textTransform: 'uppercase' }}>
                                  <FileText size={13} color={c.accent} />
                                  <span>Motivo {categoria ? `• ${categoria}` : ''}</span>
                                </div>
                                <div style={{ fontSize: '14px', fontWeight: '600', color: c.text, lineHeight: 1.45 }}>
                                  {motivoTexto || 'Sin motivo especificado.'}
                                </div>

                                {notasFlujo && notasFlujo.length > 0 && (
                                  <div style={{ marginTop: '4px', paddingTop: '8px', borderTop: `1px dashed ${c.border}`, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: '800', color: textSecundario, textTransform: 'uppercase' }}>
                                      <MessageSquare size={12} color={c.accent} />
                                      <span>Comentarios de Autorización</span>
                                    </div>
                                    {notasFlujo.map((n, idx) => (
                                      <div key={idx} style={{ fontSize: '13px', color: c.text }}>
                                        <strong style={{ color: c.accent }}>{n.autor}:</strong> {n.texto}
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

                              {/* LADO DERECHO: CADENA DE FIRMAS */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: '800', color: textSecundario, textTransform: 'uppercase' }}>
                                  <ShieldCheck size={14} color={c.accent} />
                                  <span>Cadena de Firmas y Aprobación</span>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                  {supervisorSubarea && (
                                    <ChipFirmaDetalle rolLabel="Subárea" nombre={supervisorSubarea} estado="autorizado" />
                                  )}
                                  <ChipFirmaDetalle
                                    rolLabel="Jefe"
                                    nombre={s.firmante1?.nombre_completo}
                                    estado={s.firma_1_estado}
                                  />
                                  <ChipFirmaDetalle
                                    rolLabel="Gerente"
                                    nombre={s.firmante2?.nombre_completo}
                                    estado={s.firma_2_estado}
                                  />
                                  <ChipFirmaDetalle
                                    rolLabel="RH"
                                    nombre={s.firmante3?.nombre_completo}
                                    estado={s.firma_3_estado}
                                  />
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

          {/* PAGINACIÓN */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: `1px solid ${c.border}`, background: c.surface }}>
            <span style={{ fontSize: '13px', color: textSecundario, fontWeight: '600' }}>
              Mostrando {solicitudesPaginadas.length} de {solicitudesProcesadas.length} registros (Haz clic en cualquier fila para ver motivo y firmas)
            </span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={() => setPaginaActual(p => Math.max(p - 1, 1))}
                disabled={paginaActual === 1}
                style={{ padding: '6px 10px', borderRadius: '6px', border: `1px solid ${c.border}`, background: c.bg, color: c.text, cursor: paginaActual === 1 ? 'not-allowed' : 'pointer', opacity: paginaActual === 1 ? 0.5 : 1 }}
              >
                <ChevronLeft size={15} />
              </button>
              <span style={{ fontSize: '13px', fontWeight: '800', color: c.text }}>
                Página {paginaActual} de {totalPaginas}
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
        </div>
      )}
    </div>
  );
}
