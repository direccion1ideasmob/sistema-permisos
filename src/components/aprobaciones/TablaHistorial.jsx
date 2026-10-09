import React, { useState, useMemo } from 'react';
import { 
  Search, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Printer, CheckSquare, Square,
  Factory, Building2, HardHat
} from 'lucide-react';

export default function TablaHistorial({ 
  solicitudes = [], 
  c, 
  modoOscuro, 
  esControlRH = false, 
  onSeleccionarPapeleta 
}) {
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [paginaActual, setPaginaActual] = useState(1);
  const [filaExpandidaId, setFilaExpandidaId] = useState(null);
  
  // Estado para selección múltiple (Solo RH)
  const [seleccionados, setSeleccionados] = useState([]);
  
  // NUEVO: Estado para la pestaña activa de Área (Solo RH)
  const [areaActiva, setAreaActiva] = useState('produccion'); // 'produccion' | 'administracion' | 'obra'

  const registrosPorPagina = 15;

  // NUEVO: Clasificación y Ordenamiento para RH (Producción, Administración, Obra)
  const pasesPorArea = useMemo(() => {
    if (!esControlRH) return { todos: solicitudes };

    const prod = [];
    const admin = [];
    const obra = [];

    solicitudes.forEach(s => {
      const folio = (s.folio || '').toUpperCase();
      const clasifDepto = (s.usuarios?.departamentos?.clasificacion || '').toLowerCase();
      const nombreDepto = (s.usuarios?.departamentos?.nombre || '').toLowerCase();

      if (folio.startsWith('P') || clasifDepto.includes('prod') || nombreDepto.includes('produccion')) {
        prod.push(s);
      } else if (folio.startsWith('O') || clasifDepto.includes('obra') || nombreDepto.includes('obra')) {
        obra.push(s);
      } else {
        admin.push(s); // Prefijo 'A' y resto
      }
    });

    // Función para ordenar estrictamente por folio consecutivo (P-001, P-002, etc.)
    const ordenarPorFolio = (lista) => {
      return [...lista].sort((a, b) => 
        (a.folio || '').localeCompare(b.folio || '', undefined, { numeric: true, sensitivity: 'base' })
      );
    };

    return {
      produccion: ordenarPorFolio(prod),
      administracion: ordenarPorFolio(admin),
      obra: ordenarPorFolio(obra)
    };
  }, [solicitudes, esControlRH]);

  // Lógica de filtrado base
  const solicitudesProcesadas = useMemo(() => {
    // Si es RH, solo tomamos la lista de la pestaña activa. Si no, tomamos todas.
    let listaBase = esControlRH ? (pasesPorArea[areaActiva] || []) : solicitudes;

    let filtradas = listaBase.filter(s => {
      const term = busqueda.toLowerCase().trim();
      const u = s.usuarios || {};
      const coincideTexto = 
        (s.folio || '').toLowerCase().includes(term) ||
        (u.nombre_completo || '').toLowerCase().includes(term) ||
        String(u.numero_empleado || '').includes(term) ||
        (s.tipo_permiso || '').toLowerCase().includes(term) ||
        (s.asunto_motivo || '').toLowerCase().includes(term);

      const coincideEstado = 
        filtroEstado === 'todos' || 
        (filtroEstado === 'autorizado' && s.estado_general === 'autorizado') ||
        (filtroEstado === 'rechazado' && s.estado_general === 'rechazado');

      return coincideTexto && coincideEstado;
    });

    // Si NO es RH, se queda el orden original (los más recientes primero)
    if (!esControlRH) {
      filtradas = filtradas.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    return filtradas;
  }, [solicitudes, busqueda, filtroEstado, esControlRH, areaActiva, pasesPorArea]);

  const totalPaginas = Math.ceil(solicitudesProcesadas.length / registrosPorPagina) || 1;
  const indiceInicio = (paginaActual - 1) * registrosPorPagina;
  const solicitudesPaginadas = solicitudesProcesadas.slice(indiceInicio, indiceInicio + registrosPorPagina);

  const toggleExpandir = (id) => setFilaExpandidaId(prev => prev === id ? null : id);

  // Manejo de Selección Múltiple
  const toggleSeleccion = (id, e) => {
    e.stopPropagation();
    setSeleccionados(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const toggleSeleccionarTodo = () => {
    if (seleccionados.length === solicitudesPaginadas.length) {
      setSeleccionados([]); // Deseleccionar página actual
    } else {
      setSeleccionados(solicitudesPaginadas.map(s => s.id));
    }
  };

  const handleImpresionLote = () => {
    const pasesSeleccionados = solicitudes.filter(s => seleccionados.includes(s.id));
    if (onSeleccionarPapeleta) onSeleccionarPapeleta(pasesSeleccionados); // Mandamos un array
  };

  const renderSelloPunto = (estado, label) => {
    const est = (estado || 'pendiente').toLowerCase();
    let color = '#94a3b8';
    if (['autorizado', 'auto_aprobado'].includes(est)) color = '#22c55e';
    else if (['escalado', 'omitido'].includes(est)) color = '#3b82f6';
    else if (est === 'rechazado') color = '#ef4444';
    return <span title={`${label}: ${est}`} style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color }} />;
  };

  // Configuración de los 3 botones de Área
  const botonesArea = [
    { id: 'produccion', nombre: 'Producción', icon: Factory, color: '#16a34a', bg: 'rgba(22,163,74,0.08)', total: pasesPorArea.produccion?.length || 0 },
    { id: 'administracion', nombre: 'Administración', icon: Building2, color: '#2563eb', bg: 'rgba(37,99,235,0.08)', total: pasesPorArea.administracion?.length || 0 },
    { id: 'obra', nombre: 'Obra', icon: HardHat, color: '#d97706', bg: 'rgba(217,119,6,0.08)', total: pasesPorArea.obra?.length || 0 },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      
      {/* NUEVO: BOTONERA DE LOS 3 APARTADOS (SOLO RH) */}
      {esControlRH && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginBottom: '4px' }}>
          {botonesArea.map(btn => {
            const Icon = btn.icon;
            const activo = areaActiva === btn.id;

            return (
              <button
                key={btn.id}
                onClick={() => {
                  setAreaActiva(btn.id);
                  setPaginaActual(1);
                  setSeleccionados([]); // Limpia selecciones al cambiar de pestaña
                }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', borderRadius: '10px',
                  border: `2px solid ${activo ? btn.color : c.border}`,
                  background: activo ? btn.bg : c.surfaceCard,
                  color: c.text, cursor: 'pointer', transition: 'all 0.2s',
                  boxShadow: activo ? `0 4px 12px ${btn.color}22` : 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Icon size={18} color={activo ? btn.color : c.textMuted} />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '12.5px', fontWeight: '800', color: activo ? btn.color : c.text }}>
                      {btn.nombre}
                    </div>
                    <div style={{ fontSize: '10.5px', color: c.textMuted }}>{btn.total} pases</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* BARRA SUPERIOR DE BÚSQUEDA Y FILTROS */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', background: c.surfaceCard, padding: '10px 14px', borderRadius: '12px', border: `1px solid ${c.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: c.bg, border: `1px solid ${c.border}`, borderRadius: '8px', padding: '6px 12px', flex: '1', minWidth: '220px' }}>
          <Search size={15} color={c.textMuted} />
          <input 
            type="text"
            placeholder={esControlRH ? `Buscar en ${areaActiva} por folio o nombre...` : "Buscar por folio, nombre, #empleado o motivo..."}
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); setPaginaActual(1); }}
            style={{ border: 'none', background: 'transparent', outline: 'none', color: c.text, fontSize: '12px', width: '100%' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <select
            value={filtroEstado}
            onChange={(e) => { setFiltroEstado(e.target.value); setPaginaActual(1); }}
            style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}`, borderRadius: '8px', padding: '6px 10px', fontSize: '12px', fontWeight: '700', outline: 'none', cursor: 'pointer' }}
          >
            <option value="todos">Todos los dictámenes</option>
            <option value="autorizado">🟢 Solo Autorizados</option>
            <option value="rechazado">🔴 Solo Rechazados</option>
          </select>
        </div>
      </div>

      {/* BARRA FLOTANTE DE IMPRESIÓN MÚLTIPLE (SOLO RH) */}
      {esControlRH && seleccionados.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: c.accent, color: '#fff', padding: '10px 16px', borderRadius: '12px', animation: 'fadeIn 0.2s' }}>
          <span style={{ fontSize: '13px', fontWeight: '700' }}>{seleccionados.length} pases seleccionados para impresión</span>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setSeleccionados([])} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', padding: '6px 12px', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>Cancelar</button>
            <button onClick={handleImpresionLote} style={{ background: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', color: c.accent, cursor: 'pointer', fontSize: '12px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Printer size={14} /> Imprimir Lote
            </button>
          </div>
        </div>
      )}

      {/* RENDERIZADO DE TABLA EN MICRO-ROWS */}
      {solicitudesPaginadas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '30px', color: c.textMuted, fontSize: '12px' }}>
          No se encontraron pases históricos con los filtros aplicados en esta sección.
        </div>
      ) : (
        <div style={{ background: c.surfaceCard, borderRadius: '12px', border: `1px solid ${c.border}`, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: c.surface, borderBottom: `1px solid ${c.border}`, color: c.textMuted, fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  
                  {/* CABECERA CHECKBOX SOLO PARA RH */}
                  {esControlRH && (
                    <th style={{ padding: '10px 12px', width: '30px' }}>
                      <div onClick={toggleSeleccionarTodo} style={{ cursor: 'pointer', color: c.textMuted }}>
                        {seleccionados.length > 0 && seleccionados.length === solicitudesPaginadas.length ? <CheckSquare size={16} color={c.accent} /> : <Square size={16} />}
                      </div>
                    </th>
                  )}
                  
                  <th style={{ padding: '10px 12px' }}>Folio</th>
                  <th style={{ padding: '10px 12px' }}>Colaborador</th>
                  <th style={{ padding: '10px 12px' }}>Tipo</th>
                  <th style={{ padding: '10px 12px' }}>Fecha</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Sellos</th>
                  <th style={{ padding: '10px 12px' }}>Dictamen</th>
                  <th style={{ padding: '10px 8px', width: '30px' }}></th>
                </tr>
              </thead>
              <tbody>
                {solicitudesPaginadas.map(s => {
                  const u = s.usuarios || {};
                  const esAutorizado = s.estado_general === 'autorizado';
                  const expandida = filaExpandidaId === s.id;
                  const seleccionado = seleccionados.includes(s.id);

                  return (
                    <React.Fragment key={s.id}>
                      <tr 
                        onClick={() => toggleExpandir(s.id)}
                        style={{ 
                          borderBottom: `1px solid ${c.borderDivider}`, 
                          cursor: 'pointer',
                          background: seleccionado ? (modoOscuro ? 'rgba(22,163,74,0.1)' : 'rgba(22,163,74,0.05)') : expandida ? (modoOscuro ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)') : 'transparent',
                          transition: 'background 0.15s'
                        }}
                      >
                        {/* CELDA CHECKBOX SOLO PARA RH */}
                        {esControlRH && (
                          <td style={{ padding: '10px 12px' }} onClick={(e) => toggleSeleccion(s.id, e)}>
                            {seleccionado ? <CheckSquare size={16} color={c.accent} /> : <Square size={16} color={c.textMuted} style={{ opacity: 0.5 }} />}
                          </td>
                        )}

                        <td style={{ padding: '10px 12px', fontFamily: 'ui-monospace, monospace', fontWeight: '800', color: c.accent }}>
                          {s.folio}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: '700', color: c.text, lineHeight: '1.2' }}>{u.nombre_completo || 'Colaborador'}</div>
                          <div style={{ fontSize: '10.5px', color: c.textMuted }}>#{u.numero_empleado} • {u.departamentos?.nombre || 'General'}</div>
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: '700', textTransform: 'capitalize', color: c.text }}>
                          {s.tipo_permiso}
                        </td>
                        <td style={{ padding: '10px 12px', color: c.textMuted, whiteSpace: 'nowrap' }}>
                          {s.fecha_permiso}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: '5px', alignItems: 'center', background: c.bg, padding: '4px 8px', borderRadius: '12px', border: `1px solid ${c.border}` }}>
                            {renderSelloPunto(s.firma_1_estado, 'Jefe')}
                            {renderSelloPunto(s.firma_2_estado, 'Gerente')}
                            {renderSelloPunto(s.firma_3_estado, 'RH')}
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ 
                            fontSize: '10.5px', fontWeight: '800', padding: '3px 8px', borderRadius: '6px',
                            backgroundColor: esAutorizado ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                            color: esAutorizado ? '#16a34a' : '#ef4444',
                            border: `1px solid ${esAutorizado ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`
                          }}>
                            {esAutorizado ? (s.pago || 'Autorizado') : 'Rechazado'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'center', color: c.textMuted }}>
                          {expandida ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </td>
                      </tr>

                      {/* DESPLEGABLE ACORDEÓN PARA DETALLES */}
                      {expandida && (
                        <tr style={{ background: modoOscuro ? 'rgba(0,0,0,0.2)' : '#f8fafc', borderBottom: `1px solid ${c.border}` }}>
                          <td colSpan={esControlRH ? 8 : 7} style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11.5px', color: c.text }}>
                                <div><strong>Motivo completo:</strong> {s.asunto_motivo}</div>
                                {s.observaciones && <div style={{ color: c.textMuted }}><strong>Observaciones/Historial:</strong> {s.observaciones}</div>}
                                <div style={{ fontSize: '10.5px', color: c.textMuted, marginTop: '2px' }}>
                                  Registro creado: {new Date(s.created_at).toLocaleString('es-MX')}
                                </div>
                              </div>

                              {/* BOTÓN INDIVIDUAL DE PAPELETA (SOLO RH) */}
                              {esControlRH && onSeleccionarPapeleta && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); onSeleccionarPapeleta([s]); }} // Lo enviamos como array de 1
                                  style={{
                                    padding: '6px 12px', borderRadius: '6px', border: `1px solid ${c.border}`,
                                    background: c.surface, color: c.accent, fontSize: '11px', fontWeight: '800',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px'
                                  }}
                                >
                                  <Printer size={13} /> Ver / Imprimir Papeleta
                                </button>
                              )}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderTop: `1px solid ${c.border}`, background: c.surface }}>
            <span style={{ fontSize: '11px', color: c.textMuted }}>
              Mostrando {solicitudesPaginadas.length} de {solicitudesProcesadas.length} pases
            </span>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <button 
                onClick={() => setPaginaActual(p => Math.max(p - 1, 1))} disabled={paginaActual === 1}
                style={{ padding: '4px 8px', borderRadius: '6px', border: `1px solid ${c.border}`, background: c.bg, color: c.text, cursor: paginaActual === 1 ? 'not-allowed' : 'pointer', opacity: paginaActual === 1 ? 0.5 : 1 }}>
                <ChevronLeft size={14} />
              </button>
              <span style={{ fontSize: '11px', fontWeight: '800', color: c.text }}>Página {paginaActual} de {totalPaginas}</span>
              <button 
                onClick={() => setPaginaActual(p => Math.min(p + 1, totalPaginas))} disabled={paginaActual === totalPaginas}
                style={{ padding: '4px 8px', borderRadius: '6px', border: `1px solid ${c.border}`, background: c.bg, color: c.text, cursor: paginaActual === totalPaginas ? 'not-allowed' : 'pointer', opacity: paginaActual === totalPaginas ? 0.5 : 1 }}>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}