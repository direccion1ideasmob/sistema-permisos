import React, { useState, useMemo } from 'react';
import {
  Search, ChevronLeft, ChevronRight, Printer, CheckSquare, Square,
  Factory, Building2, HardHat, FileSpreadsheet, RotateCcw, Clock,
  CheckCircle2, XCircle, CalendarDays
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
  const m = String(asunto || '').match(/^\[(.*?)\]\s*(.*)$/);
  if (m) return { categoria: m[1].trim(), texto: m[2].trim() };
  return { categoria: '', texto: String(asunto || '').trim() };
};

const acortarNombre = (nombre = '') => {
  const partes = String(nombre || '').trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 2) return partes.join(' ');
  return `${partes[0]} ${partes[partes.length - 2]}`;
};

const obtenerRangoSemana = (offsetSemanas = 0) => {
  const hoy = new Date();
  hoy.setHours(12, 0, 0, 0);
  const diaSemana = hoy.getDay();
  const diffLunes = (diaSemana === 0 ? -6 : 1 - diaSemana) + (offsetSemanas * 7);

  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() + diffLunes);

  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);

  const aYMD = (d) => {
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
  const etiquetaRango = `${lunes.getDate()} ${meses[lunes.getMonth()]} – ${domingo.getDate()} ${meses[domingo.getMonth()]} ${domingo.getFullYear()}`;

  return {
    inicio: aYMD(lunes),
    fin: aYMD(domingo),
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
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [modoPeriodo, setModoPeriodo] = useState('semana');
  const [offsetSemana, setOffsetSemana] = useState(0);
  const [paginaActual, setPaginaActual] = useState(1);
  const [seleccionados, setSeleccionados] = useState([]);

  const registrosPorPagina = 12;

  // Color secundario de alto contraste para que en laptop de 14" (modo oscuro) no se vea apagado
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

  const toggleSeleccion = (id) => {
    setSeleccionados(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
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

  const ChipFirma = ({ rolLabel, nombre, estado }) => {
    const est = (estado || 'pendiente').toLowerCase();
    if (est === 'omitido' || (!nombre && est !== 'rechazado')) return null;

    const ok = ['autorizado', 'aprobado', 'auto_aprobado', 'escalado'].includes(est);
    const rech = est === 'rechazado';
    const color = ok ? '#22c55e' : rech ? '#ef4444' : textSecundario;

    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '5px',
        fontSize: '15.5px', fontWeight: '700', padding: '4px 9px', borderRadius: '6px',
        background: c.bg, border: `1px solid ${c.border}`, color: c.text, whiteSpace: 'nowrap'
      }}>
        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: color }} />
        <span style={{ color: textSecundario }}>{rolLabel}:</span>
        <strong>{acortarNombre(nombre || 'Autorizado')}</strong>
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>

      {/* 1. BARRA SUPERIOR UNIFICADA (PESTAÑAS NÓMINA + NAVEGADOR DE SEMANA + EXPORTAR EXCEL) */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        {esControlRH && (
          <div className="tabs-aprobacion-bar" style={{ flex: '1 1 360px' }}>
            <button
              className={`tab-btn ${areaActiva === 'produccion' ? 'active' : ''}`}
              onClick={() => { setAreaActiva('produccion'); setPaginaActual(1); setSeleccionados([]); }}
              style={{ fontSize: '16.5px', padding: '10px 14px' }}
            >
              <Factory size={16} />
              <span>Producción</span>
              <span className="tab-badge" style={{ background: areaActiva === 'produccion' ? c.accent : c.border, color: areaActiva === 'produccion' ? '#fff' : c.text, fontSize: '16.5px' }}>
                {pasesPorArea.produccion?.length || 0}
              </span>
            </button>

            <button
              className={`tab-btn ${areaActiva === 'administracion' ? 'active' : ''}`}
              onClick={() => { setAreaActiva('administracion'); setPaginaActual(1); setSeleccionados([]); }}
              style={{ fontSize: '16.5px', padding: '10px 14px' }}
            >
              <Building2 size={16} />
              <span>Administración</span>
              <span className="tab-badge" style={{ background: areaActiva === 'administracion' ? c.accent : c.border, color: areaActiva === 'administracion' ? '#fff' : c.text, fontSize: '16.5px' }}>
                {pasesPorArea.administracion?.length || 0}
              </span>
            </button>

            <button
              className={`tab-btn ${areaActiva === 'obra' ? 'active' : ''}`}
              onClick={() => { setAreaActiva('obra'); setPaginaActual(1); setSeleccionados([]); }}
              style={{ fontSize: '16.5px', padding: '10px 14px' }}
            >
              <HardHat size={16} />
              <span>Obra</span>
              <span className="tab-badge" style={{ background: areaActiva === 'obra' ? c.accent : c.border, color: areaActiva === 'obra' ? '#fff' : c.text, fontSize: '16.5px' }}>
                {pasesPorArea.obra?.length || 0}
              </span>
            </button>
          </div>
        )}

        {/* SELECTOR EJECUTIVO DE CORTE SEMANAL */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: c.surfaceCard, border: `1px solid ${c.border}`,
          padding: '6px 12px', borderRadius: '10px', flexWrap: 'wrap'
        }}>
          <CalendarDays size={16} color={c.accent} />

          {modoPeriodo === 'semana' && !usandoRangoManual ? (
            <>
              <button
                onClick={() => { setOffsetSemana(prev => prev - 1); setPaginaActual(1); setSeleccionados([]); }}
                title="Semana anterior"
                style={{
                  padding: '5px 8px', borderRadius: '6px', border: `1px solid ${c.border}`,
                  background: c.bg, color: c.text, cursor: 'pointer', display: 'flex', alignItems: 'center'
                }}
              >
                <ChevronLeft size={15} />
              </button>

              <div style={{ padding: '0 8px', textAlign: 'center', minWidth: '190px' }}>
                <div style={{ fontSize: '14.5px', fontWeight: '800', color: c.text }}>
                  Semana {infoSemana.numSemana} {offsetSemana === 0 ? '(Actual)' : offsetSemana === -1 ? '(Pasada)' : ''}
                </div>
                <div style={{ fontSize: '11.5px', fontWeight: '600', color: textSecundario }}>
                  {infoSemana.etiquetaRango}
                </div>
              </div>

              <button
                onClick={() => { setOffsetSemana(prev => prev + 1); setPaginaActual(1); setSeleccionados([]); }}
                title="Semana siguiente"
                style={{
                  padding: '5px 8px', borderRadius: '6px', border: `1px solid ${c.border}`,
                  background: c.bg, color: c.text, cursor: 'pointer', display: 'flex', alignItems: 'center'
                }}
              >
                <ChevronRight size={15} />
              </button>

              {offsetSemana !== 0 && (
                <button
                  onClick={() => { setOffsetSemana(0); setPaginaActual(1); setSeleccionados([]); }}
                  style={{
                    padding: '5px 10px', borderRadius: '6px', border: 'none',
                    background: c.accentSoft, color: c.accent, fontSize: '16.5px', fontWeight: '800', cursor: 'pointer'
                  }}
                >
                  Hoy
                </button>
              )}

              <button
                onClick={() => { setModoPeriodo('todo'); setPaginaActual(1); setSeleccionados([]); }}
                style={{
                  padding: '5px 10px', borderRadius: '6px', border: `1px solid ${c.border}`,
                  background: c.bg, color: textSecundario, fontSize: '16.5px', fontWeight: '700', cursor: 'pointer'
                }}
              >
                Ver Todo ({solicitudes.length})
              </button>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14.5px', fontWeight: '800', color: c.text }}>
                {usandoRangoManual ? 'Rango personalizado activo' : `Mostrando todo (${solicitudes.length})`}
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
                  padding: '5px 10px', borderRadius: '6px', border: 'none',
                  background: c.accent, color: '#fff', fontSize: '16.5px', fontWeight: '800', cursor: 'pointer'
                }}
              >
                Volver a Semana Actual
              </button>
            </div>
          )}
        </div>

        {esControlRH && onAbrirExportar && (
          <button
            onClick={onAbrirExportar}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '10px 16px', borderRadius: '9px', border: 'none',
              background: c.accent, color: '#fff', fontSize: '16.5px', fontWeight: '800', cursor: 'pointer'
            }}
          >
            <FileSpreadsheet size={16} /> Exportar Excel
          </button>
        )}
      </div>

      {/* 2. BARRA ÚNICA DE FILTROS EN UNA SOLA LÍNEA */}
      <div style={{
        background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '11px',
        padding: '12px 14px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: c.bg, border: `1px solid ${c.border}`, borderRadius: '8px', padding: '8px 12px', flex: '1.5 1 220px' }}>
          <Search size={16} color={textSecundario} />
          <input
            type="text"
            placeholder="Folio, nombre o #empleado..."
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); setPaginaActual(1); }}
            style={{ border: 'none', background: 'transparent', outline: 'none', color: c.text, fontSize: '16.5px', width: '100%' }}
          />
        </div>

        {esControlRH && departamentos.length > 0 && (
          <select
            value={deptoFiltro}
            onChange={(e) => { setDeptoFiltro(e.target.value); setPaginaActual(1); }}
            style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}`, borderRadius: '8px', padding: '8px 10px', fontSize: '14.5px', fontWeight: '700', outline: 'none' }}
          >
            <option value="todos">Todos los Deptos</option>
            {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
          </select>
        )}

        <select
          value={tipoFiltro}
          onChange={(e) => { setTipoFiltro(e.target.value); setPaginaActual(1); }}
          style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}`, borderRadius: '8px', padding: '8px 10px', fontSize: '14.5px', fontWeight: '700', outline: 'none' }}
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
          style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}`, borderRadius: '8px', padding: '8px 10px', fontSize: '14.5px', fontWeight: '700', outline: 'none' }}
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
          style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}`, borderRadius: '8px', padding: '7px 10px', fontSize: '14.5px', outline: 'none' }}
        />

        <input
          type="date"
          value={fechaFin}
          onChange={(e) => { setFechaFin(e.target.value); setPaginaActual(1); }}
          title="Hasta fecha específica"
          style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}`, borderRadius: '8px', padding: '7px 10px', fontSize: '14.5px', outline: 'none' }}
        />

        {hayFiltrosActivos && (
          <button
            onClick={limpiarFiltros}
            title="Restablecer a semana actual"
            style={{
              padding: '8px 12px', borderRadius: '8px', border: `1px solid ${c.border}`,
              background: c.bg, color: textSecundario, fontSize: '14.5px', fontWeight: '700',
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px'
            }}
          >
            <RotateCcw size={14} /> Limpiar
          </button>
        )}

        {esControlRH && seleccionados.length > 0 && (
          <button
            onClick={() => onSeleccionarPapeleta(solicitudes.filter(s => seleccionados.includes(s.id)))}
            style={{
              padding: '8px 14px', borderRadius: '8px', border: 'none',
              background: c.accent, color: '#fff', fontSize: '14.5px', fontWeight: '800',
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', marginLeft: 'auto'
            }}
          >
            <Printer size={15} /> Imprimir ({seleccionados.length})
          </button>
        )}
      </div>

      {/* 3. TABLA CON TIPOGRAFÍA GRANDE Y ALTO CONTRASTE PARA LAPTOP DE 14" */}
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
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '15.5px' }}>
              <thead>
                <tr style={{ background: c.surface, borderBottom: `1px solid ${c.border}`, color: textSecundario, fontSize: '16.5px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {esControlRH && (
                    <th style={{ padding: '13px 14px', width: '32px' }}>
                      <div onClick={toggleSeleccionarTodo} style={{ cursor: 'pointer', display: 'flex' }}>
                        {seleccionados.length > 0 && seleccionados.length === solicitudesPaginadas.length
                          ? <CheckSquare size={17} color={c.accent} />
                          : <Square size={17} />}
                      </div>
                    </th>
                  )}
                  <th style={{ padding: '13px 14px' }}>Folio / Colaborador</th>
                  <th style={{ padding: '13px 14px' }}>Incidencia / Horario</th>
                  <th style={{ padding: '13px 14px' }}>Sello Vigilancia (Caseta)</th>
                  <th style={{ padding: '13px 14px' }}>Cadena de Firmas</th>
                  <th style={{ padding: '13px 14px' }}>Dictamen</th>
                  {esControlRH && <th style={{ padding: '13px 14px', textAlign: 'right' }}>Papeleta</th>}
                </tr>
              </thead>
              <tbody>
                {solicitudesPaginadas.map(s => {
                  const u = s.usuarios || {};
                  const esAut = ['autorizado', 'aprobado', 'completado_caseta'].includes(s.estado_general);
                  const seRegresoCasa = (s.pago || '').toLowerCase().includes('regresa');
                  const seleccionado = seleccionados.includes(s.id);
                  const tipo = (s.tipo_permiso || '').toLowerCase();
                  const aplicaCaseta = tipo === 'salida' || tipo === 'retardo';

                  const {
                    horarioSolicitado,
                    horaSalidaCaseta,
                    horaEntradaCaseta,
                    horaRegresadoCaseta,
                    requiereRegreso,
                    supervisorSubarea,
                    motivoRechazo
                  } = parsearDatosObservaciones(s.observaciones);

                  const { categoria, texto: motivoTexto } = limpiarMotivo(s.asunto_motivo);

                  return (
                    <tr
                      key={s.id}
                      style={{
                        borderBottom: `1px solid ${c.borderDivider}`,
                        background: seleccionado ? (modoOscuro ? 'rgba(22,163,74,0.12)' : 'rgba(22,163,74,0.06)') : 'transparent'
                      }}
                    >
                      {esControlRH && (
                        <td style={{ padding: '14px' }} onClick={() => toggleSeleccion(s.id)}>
                          <div style={{ cursor: 'pointer', display: 'flex' }}>
                            {seleccionado
                              ? <CheckSquare size={17} color={c.accent} />
                              : <Square size={17} color={textSecundario} style={{ opacity: 0.6 }} />}
                          </div>
                        </td>
                      )}

                      {/* 1. FOLIO + COLABORADOR */}
                      <td style={{ padding: '14px', minWidth: '230px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{
                            fontFamily: 'ui-monospace, monospace', fontSize: '14.5px', fontWeight: '900',
                            color: esAut ? '#22c55e' : '#ef4444', background: esAut ? 'rgba(34,197,94,0.14)' : 'rgba(239,68,68,0.14)',
                            padding: '2px 8px', borderRadius: '5px'
                          }}>
                            {s.folio}
                          </span>
                          <span style={{ fontSize: '14.5px', fontWeight: '800', color: textSecundario }}>
                            #{u.numero_empleado}
                          </span>
                        </div>
                        <div style={{ fontWeight: '800', color: c.text, fontSize: '16.5px', lineHeight: 1.25 }}>
                          {u.nombre_completo || 'Colaborador'}
                        </div>
                        <div style={{ fontSize: '15.5px', color: textSecundario, fontWeight: '600', marginTop: '2px' }}>
                          {u.departamentos?.nombre || 'General'}{u.area && u.area !== u.departamentos?.nombre ? ` • ${u.area}` : ''}
                        </div>
                      </td>

                      {/* 2. INCIDENCIA + FECHA + MOTIVO */}
                      <td style={{ padding: '14px', minWidth: '220px', maxWidth: '300px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{
                            fontSize: '11.5px', fontWeight: '800', textTransform: 'uppercase',
                            padding: '2px 8px', borderRadius: '5px', background: c.bg, border: `1px solid ${c.border}`, color: c.text
                          }}>
                            {s.tipo_permiso}
                          </span>
                          <span style={{ fontSize: '16.5px', fontWeight: '800', color: c.text }}>
                            {s.fecha_permiso}{s.fecha_fin && s.fecha_fin !== s.fecha_permiso ? ` al ${s.fecha_fin}` : ''}
                          </span>
                        </div>
                        <div style={{ fontSize: '14.5px', color: textSecundario, fontWeight: '600' }}>
                          {horarioSolicitado}
                        </div>
                        {motivoTexto && (
                          <div style={{ fontSize: '15.5px', color: textSecundario, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '3px' }} title={motivoTexto}>
                            {categoria ? `${categoria}: ` : ''}{motivoTexto}
                          </div>
                        )}
                      </td>

                      {/* 3. SELLO DE VIGILANCIA */}
                      <td style={{ padding: '14px', minWidth: '175px' }}>
                        {!esAut ? (
                          <span style={{ fontSize: '14.5px', color: '#ef4444', fontWeight: '700' }}>Cancelado / Rechazado</span>
                        ) : seRegresoCasa ? (
                          <span style={{ fontSize: '14.5px', color: '#f59e0b', fontWeight: '800' }}>
                            ↩️ Regresado {horaRegresadoCaseta ? `(${horaRegresadoCaseta})` : 'a casa'}
                          </span>
                        ) : !aplicaCaseta ? (
                          <span style={{ fontSize: '14.5px', color: textSecundario, fontWeight: '600' }}>No requiere caseta</span>
                        ) : (horaSalidaCaseta || horaEntradaCaseta) ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {horaSalidaCaseta && (
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: '5px',
                                fontSize: '14.5px', fontWeight: '800', color: '#38bdf8'
                              }}>
                                <CheckCircle2 size={14} /> Salida: {horaSalidaCaseta}
                              </span>
                            )}
                            {horaEntradaCaseta ? (
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: '5px',
                                fontSize: '14.5px', fontWeight: '800', color: '#22c55e'
                              }}>
                                <CheckCircle2 size={14} /> {tipo === 'retardo' ? 'Entrada' : 'Reingreso'}: {horaEntradaCaseta}
                              </span>
                            ) : (tipo === 'salida' && requiereRegreso) ? (
                              <span style={{ fontSize: '15.5px', fontWeight: '800', color: '#f59e0b' }}>
                                • Pendiente reingreso
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            fontSize: '14.5px', fontWeight: '700', color: textSecundario
                          }}>
                            <Clock size={14} /> Sin sello en puerta
                          </span>
                        )}
                      </td>

                      {/* 4. CADENA DE FIRMAS */}
                      <td style={{ padding: '14px', minWidth: '240px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {supervisorSubarea && (
                            <ChipFirma rolLabel="Subárea" nombre={supervisorSubarea} estado="autorizado" />
                          )}
                          <ChipFirma
                            rolLabel="Jefe"
                            nombre={s.firmante1?.nombre_completo}
                            estado={s.firma_1_estado}
                          />
                          <ChipFirma
                            rolLabel="Gerente"
                            nombre={s.firmante2?.nombre_completo}
                            estado={s.firma_2_estado}
                          />
                          <ChipFirma
                            rolLabel="RH"
                            nombre={s.firmante3?.nombre_completo}
                            estado={s.firma_3_estado}
                          />
                        </div>
                        {!esAut && motivoRechazo && (
                          <div style={{ fontSize: '15.5px', color: '#ef4444', fontWeight: '700', marginTop: '4px' }}>
                            Motivo rechazo: {motivoRechazo}
                          </div>
                        )}
                      </td>

                      {/* 5. DICTAMEN DE NÓMINA */}
                      <td style={{ padding: '14px', whiteSpace: 'nowrap' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '5px',
                          fontSize: '15.5px', fontWeight: '800', padding: '5px 10px', borderRadius: '7px',
                          backgroundColor: !esAut ? 'rgba(239,68,68,0.14)' : seRegresoCasa ? 'rgba(245,158,11,0.16)' : 'rgba(34,197,94,0.14)',
                          color: !esAut ? '#ef4444' : seRegresoCasa ? '#f59e0b' : '#22c55e',
                          border: `1px solid ${!esAut ? 'rgba(239,68,68,0.3)' : seRegresoCasa ? 'rgba(245,158,11,0.4)' : 'rgba(34,197,94,0.3)'}`
                        }}>
                          {esAut ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                          {esAut ? (seRegresoCasa ? 'Se regresa' : (s.pago || 'Autorizado')) : 'Rechazado'}
                        </span>
                      </td>

                      {/* 6. BOTÓN DIRECTO DE PAPELETA */}
                      {esControlRH && (
                        <td style={{ padding: '14px', textAlign: 'right' }}>
                          <button
                            onClick={() => onSeleccionarPapeleta && onSeleccionarPapeleta([s])}
                            style={{
                              padding: '8px 13px', borderRadius: '8px', border: `1px solid ${c.border}`,
                              background: c.bg, color: c.text, fontSize: '14.5px', fontWeight: '800',
                              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px'
                            }}
                          >
                            <Printer size={15} color="#22c55e" /> Papeleta
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* PAGINACIÓN */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: `1px solid ${c.border}`, background: c.surface }}>
            <span style={{ fontSize: '14.5px', color: textSecundario, fontWeight: '600' }}>
              Mostrando {solicitudesPaginadas.length} de {solicitudesProcesadas.length} registros
            </span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={() => setPaginaActual(p => Math.max(p - 1, 1))}
                disabled={paginaActual === 1}
                style={{ padding: '6px 10px', borderRadius: '6px', border: `1px solid ${c.border}`, background: c.bg, color: c.text, cursor: paginaActual === 1 ? 'not-allowed' : 'pointer', opacity: paginaActual === 1 ? 0.5 : 1 }}
              >
                <ChevronLeft size={16} />
              </button>
              <span style={{ fontSize: '14.5px', fontWeight: '800', color: c.text }}>
                Página {paginaActual} de {totalPaginas}
              </span>
              <button
                onClick={() => setPaginaActual(p => Math.min(p + 1, totalPaginas))}
                disabled={paginaActual === totalPaginas}
                style={{ padding: '6px 10px', borderRadius: '6px', border: `1px solid ${c.border}`, background: c.bg, color: c.text, cursor: paginaActual === totalPaginas ? 'not-allowed' : 'pointer', opacity: paginaActual === totalPaginas ? 0.5 : 1 }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
