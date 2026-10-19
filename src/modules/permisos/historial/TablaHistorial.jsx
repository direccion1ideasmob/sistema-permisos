import React, { useState, useMemo } from 'react';
import {
  Search, ChevronLeft, ChevronRight, Printer, CheckSquare, Square,
  Factory, Building2, HardHat, FileSpreadsheet, RotateCcw, Clock, CheckCircle2, XCircle
} from 'lucide-react';

// Helpers limpios para extraer datos reales de observaciones sin texto basura
export const parsearDatosObservaciones = (obs = '') => {
  const texto = String(obs || '');
  const horarioSolicitado = (texto.split('|')[0] || '')
    .replace(/🕒|📅/g, '')
    .trim();

  const mSalida = texto.match(/\[SALIDA CASETA:\s*([^\]]+)\]/i);
  const mEntrada = texto.match(/\[(?:ENTRADA|REINGRESO) CASETA:\s*([^\]]+)\]/i);
  const mSubarea = texto.match(/VoBo Sub[áa]rea:\s*([^|]+)/i);
  const mRechazo = texto.match(/RECHAZO:\s*([^|]+)/i) || texto.match(/Rechazado por Jefatura:\s*([^|]+)/i);

  return {
    horarioSolicitado: horarioSolicitado || 'Jornada completa',
    horaSalidaCaseta: mSalida ? mSalida[1].trim() : null,
    horaEntradaCaseta: mEntrada ? mEntrada[1].trim() : null,
    requiereRegreso: texto.toLowerCase().includes('regresa:'),
    supervisorSubarea: mSubarea ? mSubarea[1].trim() : null,
    motivoRechazo: mRechazo ? mRechazo[1].trim() : null
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
  const [paginaActual, setPaginaActual] = useState(1);
  const [seleccionados, setSeleccionados] = useState([]);

  const registrosPorPagina = 15;

  const pasesPorArea = useMemo(() => {
    if (!esControlRH) return { todos: solicitudes };

    const prod = [];
    const admin = [];
    const obra = [];

    solicitudes.forEach(s => {
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
  }, [solicitudes, esControlRH]);

  const solicitudesProcesadas = useMemo(() => {
    const base = esControlRH ? (pasesPorArea[areaActiva] || []) : solicitudes;
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
      if (fechaInicio && s.fecha_permiso < fechaInicio) return false;
      if (fechaFin && s.fecha_permiso > fechaFin) return false;

      return true;
    });
  }, [solicitudes, esControlRH, pasesPorArea, areaActiva, busqueda, deptoFiltro, tipoFiltro, filtroEstado, fechaInicio, fechaFin]);

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
    setPaginaActual(1);
  };

  const hayFiltrosActivos = busqueda || deptoFiltro !== 'todos' || tipoFiltro !== 'todos' || filtroEstado !== 'todos' || fechaInicio || fechaFin;

  const ChipFirma = ({ rolLabel, nombre, estado }) => {
    const est = (estado || 'pendiente').toLowerCase();
    if (est === 'omitido' || (!nombre && est !== 'rechazado')) return null;

    const ok = ['autorizado', 'aprobado', 'auto_aprobado', 'escalado'].includes(est);
    const rech = est === 'rechazado';
    const color = ok ? '#16a34a' : rech ? '#ef4444' : c.textMuted;

    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        fontSize: '10.5px', fontWeight: '700', padding: '2px 7px', borderRadius: '6px',
        background: c.bg, border: `1px solid ${c.border}`, color: c.text, whiteSpace: 'nowrap'
      }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: color }} />
        <span style={{ color: c.textMuted }}>{rolLabel}:</span>
        <strong>{acortarNombre(nombre || 'Autorizado')}</strong>
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>

      {/* 1. BARRA SUPERIOR UNIFICADA (PESTAÑAS NÓMINA + EXPORTAR EXCEL) */}
      {esControlRH && (
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="tabs-aprobacion-bar" style={{ flex: 1 }}>
            <button
              className={`tab-btn ${areaActiva === 'produccion' ? 'active' : ''}`}
              onClick={() => { setAreaActiva('produccion'); setPaginaActual(1); setSeleccionados([]); }}
            >
              <Factory size={15} />
              <span>Producción</span>
              <span className="tab-badge" style={{ background: areaActiva === 'produccion' ? c.accent : c.border, color: areaActiva === 'produccion' ? '#fff' : c.text }}>
                {pasesPorArea.produccion?.length || 0}
              </span>
            </button>

            <button
              className={`tab-btn ${areaActiva === 'administracion' ? 'active' : ''}`}
              onClick={() => { setAreaActiva('administracion'); setPaginaActual(1); setSeleccionados([]); }}
            >
              <Building2 size={15} />
              <span>Administración</span>
              <span className="tab-badge" style={{ background: areaActiva === 'administracion' ? c.accent : c.border, color: areaActiva === 'administracion' ? '#fff' : c.text }}>
                {pasesPorArea.administracion?.length || 0}
              </span>
            </button>

            <button
              className={`tab-btn ${areaActiva === 'obra' ? 'active' : ''}`}
              onClick={() => { setAreaActiva('obra'); setPaginaActual(1); setSeleccionados([]); }}
            >
              <HardHat size={15} />
              <span>Obra</span>
              <span className="tab-badge" style={{ background: areaActiva === 'obra' ? c.accent : c.border, color: areaActiva === 'obra' ? '#fff' : c.text }}>
                {pasesPorArea.obra?.length || 0}
              </span>
            </button>
          </div>

          {onAbrirExportar && (
            <button
              onClick={onAbrirExportar}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '9px 14px', borderRadius: '9px', border: 'none',
                background: c.accent, color: '#fff', fontSize: '12px', fontWeight: '800', cursor: 'pointer'
              }}
            >
              <FileSpreadsheet size={15} /> Exportar Excel
            </button>
          )}
        </div>
      )}

      {/* 2. BARRA ÚNICA DE FILTROS EN UNA SOLA LÍNEA */}
      <div style={{
        background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '11px',
        padding: '10px 12px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', background: c.bg, border: `1px solid ${c.border}`, borderRadius: '8px', padding: '6px 10px', flex: '1.5 1 200px' }}>
          <Search size={14} color={c.textMuted} />
          <input
            type="text"
            placeholder="Folio, nombre o #empleado..."
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); setPaginaActual(1); }}
            style={{ border: 'none', background: 'transparent', outline: 'none', color: c.text, fontSize: '12px', width: '100%' }}
          />
        </div>

        {esControlRH && departamentos.length > 0 && (
          <select
            value={deptoFiltro}
            onChange={(e) => { setDeptoFiltro(e.target.value); setPaginaActual(1); }}
            style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}`, borderRadius: '8px', padding: '6px 9px', fontSize: '11.5px', fontWeight: '700', outline: 'none' }}
          >
            <option value="todos">Todos los Deptos</option>
            {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
          </select>
        )}

        <select
          value={tipoFiltro}
          onChange={(e) => { setTipoFiltro(e.target.value); setPaginaActual(1); }}
          style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}`, borderRadius: '8px', padding: '6px 9px', fontSize: '11.5px', fontWeight: '700', outline: 'none' }}
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
          style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}`, borderRadius: '8px', padding: '6px 9px', fontSize: '11.5px', fontWeight: '700', outline: 'none' }}
        >
          <option value="todos">Autorizados y Rechazados</option>
          <option value="autorizado">Solo Autorizados</option>
          <option value="rechazado">Solo Rechazados</option>
        </select>

        <input
          type="date"
          value={fechaInicio}
          onChange={(e) => { setFechaInicio(e.target.value); setPaginaActual(1); }}
          title="Desde fecha"
          style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}`, borderRadius: '8px', padding: '5px 8px', fontSize: '11.5px', outline: 'none' }}
        />

        <input
          type="date"
          value={fechaFin}
          onChange={(e) => { setFechaFin(e.target.value); setPaginaActual(1); }}
          title="Hasta fecha"
          style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}`, borderRadius: '8px', padding: '5px 8px', fontSize: '11.5px', outline: 'none' }}
        />

        {hayFiltrosActivos && (
          <button
            onClick={limpiarFiltros}
            title="Limpiar filtros"
            style={{
              padding: '6px 10px', borderRadius: '8px', border: `1px solid ${c.border}`,
              background: c.bg, color: c.textMuted, fontSize: '11.5px', fontWeight: '700',
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px'
            }}
          >
            <RotateCcw size={12} /> Limpiar
          </button>
        )}

        {esControlRH && seleccionados.length > 0 && (
          <button
            onClick={() => onSeleccionarPapeleta(solicitudes.filter(s => seleccionados.includes(s.id)))}
            style={{
              padding: '6px 12px', borderRadius: '8px', border: 'none',
              background: c.accent, color: '#fff', fontSize: '11.5px', fontWeight: '800',
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', marginLeft: 'auto'
            }}
          >
            <Printer size={13} /> Imprimir ({seleccionados.length})
          </button>
        )}
      </div>

      {/* 3. TABLA LIMPIA CON HORAS DE CASETA Y FIRMAS REALES VISIBLES */}
      {solicitudesPaginadas.length === 0 ? (
        <div style={{
          background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '12px',
          padding: '32px', textAlign: 'center', color: c.textMuted, fontSize: '12.5px'
        }}>
          No hay registros con los filtros seleccionados.
        </div>
      ) : (
        <div style={{ background: c.surfaceCard, borderRadius: '12px', border: `1px solid ${c.border}`, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: c.surface, borderBottom: `1px solid ${c.border}`, color: c.textMuted, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {esControlRH && (
                    <th style={{ padding: '10px 12px', width: '28px' }}>
                      <div onClick={toggleSeleccionarTodo} style={{ cursor: 'pointer', display: 'flex' }}>
                        {seleccionados.length > 0 && seleccionados.length === solicitudesPaginadas.length
                          ? <CheckSquare size={15} color={c.accent} />
                          : <Square size={15} />}
                      </div>
                    </th>
                  )}
                  <th style={{ padding: '10px 12px' }}>Folio / Colaborador</th>
                  <th style={{ padding: '10px 12px' }}>Incidencia / Horario</th>
                  <th style={{ padding: '10px 12px' }}>Sello Vigilancia (Caseta)</th>
                  <th style={{ padding: '10px 12px' }}>Cadena de Firmas</th>
                  <th style={{ padding: '10px 12px' }}>Dictamen</th>
                  {esControlRH && <th style={{ padding: '10px 12px', textAlign: 'right' }}>Papeleta</th>}
                </tr>
              </thead>
              <tbody>
                {solicitudesPaginadas.map(s => {
                  const u = s.usuarios || {};
                  const esAut = ['autorizado', 'aprobado', 'completado_caseta'].includes(s.estado_general);
                  const seleccionado = seleccionados.includes(s.id);
                  const tipo = (s.tipo_permiso || '').toLowerCase();
                  const aplicaCaseta = tipo === 'salida' || tipo === 'retardo';

                  const {
                    horarioSolicitado,
                    horaSalidaCaseta,
                    horaEntradaCaseta,
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
                        background: seleccionado ? (modoOscuro ? 'rgba(22,163,74,0.1)' : 'rgba(22,163,74,0.05)') : 'transparent'
                      }}
                    >
                      {esControlRH && (
                        <td style={{ padding: '11px 12px' }} onClick={() => toggleSeleccion(s.id)}>
                          <div style={{ cursor: 'pointer', display: 'flex' }}>
                            {seleccionado
                              ? <CheckSquare size={15} color={c.accent} />
                              : <Square size={15} color={c.textMuted} style={{ opacity: 0.5 }} />}
                          </div>
                        </td>
                      )}

                      {/* 1. FOLIO + COLABORADOR */}
                      <td style={{ padding: '11px 12px', minWidth: '210px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                          <span style={{
                            fontFamily: 'ui-monospace, monospace', fontSize: '11px', fontWeight: '900',
                            color: esAut ? c.accent : '#ef4444', background: esAut ? c.accentSoft : 'rgba(239,68,68,0.1)',
                            padding: '1px 6px', borderRadius: '4px'
                          }}>
                            {s.folio}
                          </span>
                          <span style={{ fontSize: '10.5px', fontWeight: '800', color: c.textMuted }}>
                            #{u.numero_empleado}
                          </span>
                        </div>
                        <div style={{ fontWeight: '800', color: c.text, fontSize: '12.5px' }}>
                          {u.nombre_completo || 'Colaborador'}
                        </div>
                        <div style={{ fontSize: '10.5px', color: c.textMuted, fontWeight: '600' }}>
                          {u.departamentos?.nombre || 'General'}{u.area && u.area !== u.departamentos?.nombre ? ` • ${u.area}` : ''}
                        </div>
                      </td>

                      {/* 2. INCIDENCIA + FECHA + MOTIVO CORTO */}
                      <td style={{ padding: '11px 12px', minWidth: '190px', maxWidth: '260px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                          <span style={{
                            fontSize: '10px', fontWeight: '800', textTransform: 'uppercase',
                            padding: '1px 6px', borderRadius: '4px', background: c.bg, border: `1px solid ${c.border}`, color: c.text
                          }}>
                            {s.tipo_permiso}
                          </span>
                          <span style={{ fontSize: '11px', fontWeight: '700', color: c.text }}>
                            {s.fecha_permiso}{s.fecha_fin && s.fecha_fin !== s.fecha_permiso ? ` al ${s.fecha_fin}` : ''}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: c.textMuted, fontWeight: '600' }}>
                          {horarioSolicitado}
                        </div>
                        {motivoTexto && (
                          <div style={{ fontSize: '10.5px', color: c.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }} title={motivoTexto}>
                            {categoria ? `${categoria}: ` : ''}{motivoTexto}
                          </div>
                        )}
                      </td>

                      {/* 3. OJOS DE VIGILANCIA (HORA REAL EN PUERTA) */}
                      <td style={{ padding: '11px 12px', minWidth: '155px' }}>
                        {!esAut ? (
                          <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: '700' }}>Cancelado / Rechazado</span>
                        ) : !aplicaCaseta ? (
                          <span style={{ fontSize: '11px', color: c.textMuted, fontWeight: '600' }}>No requiere caseta</span>
                        ) : (horaSalidaCaseta || horaEntradaCaseta) ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            {horaSalidaCaseta && (
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                fontSize: '11px', fontWeight: '800', color: '#0284c7'
                              }}>
                                <CheckCircle2 size={12} /> Salida: {horaSalidaCaseta}
                              </span>
                            )}
                            {horaEntradaCaseta ? (
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                fontSize: '11px', fontWeight: '800', color: '#16a34a'
                              }}>
                                <CheckCircle2 size={12} /> {tipo === 'retardo' ? 'Entrada' : 'Reingreso'}: {horaEntradaCaseta}
                              </span>
                            ) : (tipo === 'salida' && requiereRegreso) ? (
                              <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#d97706' }}>
                                • Pendiente reingreso
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            fontSize: '11px', fontWeight: '700', color: c.textMuted
                          }}>
                            <Clock size={12} /> Sin sello en puerta
                          </span>
                        )}
                      </td>

                      {/* 4. CADENA DE FIRMAS CON NOMBRES REALES */}
                      <td style={{ padding: '11px 12px', minWidth: '220px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
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
                          <div style={{ fontSize: '10.5px', color: '#ef4444', fontWeight: '700', marginTop: '3px' }}>
                            Motivo rechazo: {motivoRechazo}
                          </div>
                        )}
                      </td>

                      {/* 5. DICTAMEN DE NÓMINA */}
                      <td style={{ padding: '11px 12px', whiteSpace: 'nowrap' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          fontSize: '10.5px', fontWeight: '800', padding: '4px 8px', borderRadius: '6px',
                          backgroundColor: esAut ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                          color: esAut ? '#16a34a' : '#ef4444',
                          border: `1px solid ${esAut ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`
                        }}>
                          {esAut ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                          {esAut ? (s.pago || 'Autorizado') : 'Rechazado'}
                        </span>
                      </td>

                      {/* 6. BOTÓN DIRECTO DE PAPELETA */}
                      {esControlRH && (
                        <td style={{ padding: '11px 12px', textAlign: 'right' }}>
                          <button
                            onClick={() => onSeleccionarPapeleta && onSeleccionarPapeleta([s])}
                            style={{
                              padding: '6px 10px', borderRadius: '7px', border: `1px solid ${c.border}`,
                              background: c.bg, color: c.text, fontSize: '11px', fontWeight: '800',
                              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px'
                            }}
                          >
                            <Printer size={13} color={c.accent} /> Papeleta
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderTop: `1px solid ${c.border}`, background: c.surface }}>
            <span style={{ fontSize: '11px', color: c.textMuted, fontWeight: '600' }}>
              Mostrando {solicitudesPaginadas.length} de {solicitudesProcesadas.length} registros
            </span>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <button
                onClick={() => setPaginaActual(p => Math.max(p - 1, 1))}
                disabled={paginaActual === 1}
                style={{ padding: '4px 8px', borderRadius: '6px', border: `1px solid ${c.border}`, background: c.bg, color: c.text, cursor: paginaActual === 1 ? 'not-allowed' : 'pointer', opacity: paginaActual === 1 ? 0.5 : 1 }}
              >
                <ChevronLeft size={14} />
              </button>
              <span style={{ fontSize: '11px', fontWeight: '800', color: c.text }}>
                Página {paginaActual} de {totalPaginas}
              </span>
              <button
                onClick={() => setPaginaActual(p => Math.min(p + 1, totalPaginas))}
                disabled={paginaActual === totalPaginas}
                style={{ padding: '4px 8px', borderRadius: '6px', border: `1px solid ${c.border}`, background: c.bg, color: c.text, cursor: paginaActual === totalPaginas ? 'not-allowed' : 'pointer', opacity: paginaActual === totalPaginas ? 0.5 : 1 }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
