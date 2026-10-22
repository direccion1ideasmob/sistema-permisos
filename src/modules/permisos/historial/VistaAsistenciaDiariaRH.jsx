import React, { useState, useEffect, useCallback } from 'react';
import {
  obtenerDatosCaseta,
  registrarAsistenciaLista,
  deshacerEntradaReciente,
  obtenerFechaLocalHoy
} from '../../vigilancia/services/vigilanciaService';
import {
  Calendar, Search, RefreshCw, Download, UserCheck, UserX,
  Clock, ShieldCheck, LogOut, CheckCircle2, X, Undo2
} from 'lucide-react';

export default function VistaAsistenciaDiariaRH({ usuario, departamentos = [], c, modoOscuro }) {
  const hoyStr = obtenerFechaLocalHoy();
  const [fecha, setFecha] = useState(hoyStr);
  const [busqueda, setBusqueda] = useState('');
  const [deptoFiltro, setDeptoFiltro] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('todos'); // 'todos' | 'presentes' | 'ausentes' | 'incidencias'

  const [empleados, setEmpleados] = useState([]);
  const [mapaAsistencias, setMapaAsistencias] = useState({});
  const [mapaIncidencias, setMapaIncidencias] = useState({});
  const [cargando, setCargando] = useState(true);
  const [procesandoId, setProcesandoId] = useState(null);

  const cargarAsistenciaDia = useCallback(async () => {
    setCargando(true);
    try {
      const sedeFiltro = usuario?.rol === 'superadmin' ? null : (usuario?.sede_id || null);
      const data = await obtenerDatosCaseta(sedeFiltro, fecha);
      setEmpleados(data.empleadosSede || []);
      setMapaAsistencias(data.mapaAsistencias || {});
      setMapaIncidencias(data.mapaIncidenciasHoy || {});
    } catch (err) {
      console.error('Error cargando lista de asistencia diaria para RH:', err);
    } finally {
      setCargando(false);
    }
  }, [fecha, usuario?.rol, usuario?.sede_id]);

  useEffect(() => {
    cargarAsistenciaDia();
  }, [cargarAsistenciaDia]);

  const handleMarcarDesdeRH = async (empId, tipoMarca) => {
    setProcesandoId(`${empId}-${tipoMarca}`);
    try {
      await registrarAsistenciaLista(empId, tipoMarca, usuario?.id || null, true);
      await cargarAsistenciaDia();
    } catch (err) {
      alert('Error al registrar desde RH: ' + err.message);
    } finally {
      setProcesandoId(null);
    }
  };

  const handleQuitarEntradaRH = async (empId, nombre) => {
    if (!window.confirm(`¿Deseas eliminar el registro de entrada de hoy de ${nombre}?`)) return;
    setProcesandoId(`${empId}-borrar`);
    try {
      await deshacerEntradaReciente(empId);
      await cargarAsistenciaDia();
    } catch (err) {
      alert('No se pudo quitar la marca: ' + err.message);
    } finally {
      setProcesandoId(null);
    }
  };

  const termino = busqueda.toLowerCase().trim();

  const listaProcesada = empleados.filter((emp) => {
    if (deptoFiltro && String(emp.departamento_id) !== String(deptoFiltro)) return false;
    if (termino) {
      const matchNombre = (emp.nombre_completo || '').toLowerCase().includes(termino);
      const matchNum = String(emp.numero_empleado || '').toLowerCase().includes(termino);
      if (!matchNombre && !matchNum) return false;
    }

    const reg = mapaAsistencias[emp.id];
    const inc = mapaIncidencias[emp.id];
    const tieneEntrada = Boolean(reg?.hora_entrada);

    if (estadoFiltro === 'presentes') return tieneEntrada;
    if (estadoFiltro === 'ausentes') return !tieneEntrada && inc?.tipo !== 'ausencia_autorizada';
    if (estadoFiltro === 'incidencias') return Boolean(inc);
    return true;
  });

  const totalPresentes = empleados.filter(e => Boolean(mapaAsistencias[e.id]?.hora_entrada)).length;
  const totalConPermiso = empleados.filter(e => !mapaAsistencias[e.id]?.hora_entrada && mapaIncidencias[e.id]?.tipo === 'ausencia_autorizada').length;
  const totalSinRegistro = empleados.filter(e => !mapaAsistencias[e.id]?.hora_entrada && mapaIncidencias[e.id]?.tipo !== 'ausencia_autorizada').length;

  const exportarCSV = () => {
    const encabezados = ['FECHA', 'NO. EMPLEADO', 'COLABORADOR', 'DEPARTAMENTO', 'ESTADO ASISTENCIA', 'HORA ENTRADA', 'HORA SALIDA', 'INCIDENCIA / PERMISO'];
    const filas = listaProcesada.map((emp) => {
      const reg = mapaAsistencias[emp.id];
      const inc = mapaIncidencias[emp.id];
      const estado = reg?.hora_entrada
        ? 'ASISTIO'
        : (inc?.tipo === 'ausencia_autorizada' ? 'PERMISO / VACACIONES' : 'SIN REGISTRO');

      return [
        `"${fecha}"`,
        `"${emp.numero_empleado || ''}"`,
        `"${(emp.nombre_completo || '').replace(/"/g, '""')}"`,
        `"${(emp.departamentos?.nombre || 'Sin departamento').replace(/"/g, '""')}"`,
        `"${estado}"`,
        `"${reg?.hora_entrada || '--:--'}"`,
        `"${reg?.hora_salida || '--:--'}"`,
        `"${(inc?.etiqueta || 'Ninguna').replace(/"/g, '""')}"`
      ].join(',');
    });

    const csvContent = '\uFEFF' + [encabezados.join(','), ...filas].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Asistencia_Planta_${fecha}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
      {/* TARJETAS DE RESUMEN DEL DÍA */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
        gap: '10px'
      }}>
        <div
          onClick={() => setEstadoFiltro('todos')}
          style={{
            background: c.surfaceCard,
            border: `1.5px solid ${estadoFiltro === 'todos' ? c.accent : c.border}`,
            borderRadius: '11px',
            padding: '10px 14px',
            cursor: 'pointer'
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: '800', color: c.textMuted, textTransform: 'uppercase' }}>Plantilla Total</div>
          <div style={{ fontSize: '20px', fontWeight: '900', color: c.text, marginTop: '2px' }}>{empleados.length}</div>
        </div>

        <div
          onClick={() => setEstadoFiltro('presentes')}
          style={{
            background: c.surfaceCard,
            border: `1.5px solid ${estadoFiltro === 'presentes' ? '#16a34a' : c.border}`,
            borderRadius: '11px',
            padding: '10px 14px',
            cursor: 'pointer'
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: '800', color: '#16a34a', textTransform: 'uppercase' }}>En Planta / Con Entrada</div>
          <div style={{ fontSize: '20px', fontWeight: '900', color: '#16a34a', marginTop: '2px' }}>{totalPresentes}</div>
        </div>

        <div
          onClick={() => setEstadoFiltro('ausentes')}
          style={{
            background: c.surfaceCard,
            border: `1.5px solid ${estadoFiltro === 'ausentes' ? '#ef4444' : c.border}`,
            borderRadius: '11px',
            padding: '10px 14px',
            cursor: 'pointer'
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: '800', color: '#ef4444', textTransform: 'uppercase' }}>Sin Registro en Caseta</div>
          <div style={{ fontSize: '20px', fontWeight: '900', color: '#ef4444', marginTop: '2px' }}>{totalSinRegistro}</div>
        </div>

        <div
          onClick={() => setEstadoFiltro('incidencias')}
          style={{
            background: c.surfaceCard,
            border: `1.5px solid ${estadoFiltro === 'incidencias' ? '#0284c7' : c.border}`,
            borderRadius: '11px',
            padding: '10px 14px',
            cursor: 'pointer'
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: '800', color: '#0284c7', textTransform: 'uppercase' }}>Permisos / Vacaciones Hoy</div>
          <div style={{ fontSize: '20px', fontWeight: '900', color: '#0284c7', marginTop: '2px' }}>{totalConPermiso}</div>
        </div>
      </div>

      {/* BARRA DE FILTROS Y EXPORTACIÓN */}
      <div style={{
        background: c.surfaceCard,
        border: `1px solid ${c.border}`,
        borderRadius: '12px',
        padding: '10px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, flexWrap: 'wrap' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            background: c.bg, border: `1px solid ${c.border}`, borderRadius: '8px', padding: '0 10px', height: '35px'
          }}>
            <Calendar size={14} color={c.accent} />
            <input
              type="date"
              value={fecha}
              max={hoyStr}
              onChange={(e) => setFecha(e.target.value)}
              style={{
                border: 'none', background: 'transparent', color: c.text,
                fontSize: '12.5px', fontWeight: '800', outline: 'none', cursor: 'pointer'
              }}
            />
          </div>

          <select
            value={deptoFiltro}
            onChange={(e) => setDeptoFiltro(e.target.value)}
            style={{
              height: '35px', padding: '0 10px', borderRadius: '8px',
              border: `1px solid ${c.border}`, background: c.bg, color: c.text,
              fontSize: '12.5px', fontWeight: '700', outline: 'none'
            }}
          >
            <option value="">Todos los departamentos</option>
            {departamentos.map((d) => (
              <option key={d.id} value={d.id}>{d.nombre}</option>
            ))}
          </select>

          <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: c.textMuted }} />
            <input
              type="text"
              placeholder="Buscar colaborador o # de nómina..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{
                width: '100%', height: '35px', padding: '0 28px 0 32px', borderRadius: '8px',
                border: `1px solid ${c.border}`, background: c.bg, color: c.text,
                fontSize: '12.5px', boxSizing: 'border-box', outline: 'none'
              }}
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda('')}
                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: c.textMuted, cursor: 'pointer', display: 'flex' }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            onClick={exportarCSV}
            style={{
              height: '35px', padding: '0 12px', borderRadius: '8px',
              border: `1px solid ${c.accent}`, background: c.accentSoft, color: c.accent,
              fontSize: '12px', fontWeight: '800', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: '6px'
            }}
          >
            <Download size={14} /> Exportar Excel
          </button>

          <button
            type="button"
            onClick={cargarAsistenciaDia}
            title="Actualizar"
            style={{
              width: '35px', height: '35px', borderRadius: '8px',
              border: `1px solid ${c.border}`, background: c.bg, color: c.text,
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* LISTA DE ASISTENCIA DIARIA PARA RH */}
      {cargando ? (
        <div style={{ textAlign: 'center', padding: '40px', color: c.textMuted, fontWeight: '600' }}>
          Cargando registros de asistencia del día...
        </div>
      ) : listaProcesada.length === 0 ? (
        <div style={{
          background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '12px',
          padding: '34px 20px', textAlign: 'center', color: c.textMuted, fontSize: '13.5px', fontWeight: '600'
        }}>
          No se encontraron colaboradores con los filtros seleccionados.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {listaProcesada.map((emp) => {
            const reg = mapaAsistencias[emp.id];
            const inc = mapaIncidencias[emp.id];
            const tieneEntrada = Boolean(reg?.hora_entrada);
            const tieneSalida = Boolean(reg?.hora_salida);
            const avatarUrl = emp?.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(emp?.nombre_completo || 'C')}&background=16a34a&color=fff&bold=true`;

            return (
              <div
                key={emp.id}
                style={{
                  background: c.surfaceCard,
                  border: `1px solid ${c.border}`,
                  borderLeft: `4px solid ${tieneEntrada ? '#16a34a' : (inc?.tipo === 'ausencia_autorizada' ? '#0284c7' : '#ef4444')}`,
                  borderRadius: '10px',
                  padding: '9px 13px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  flexWrap: 'wrap'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '220px', flex: 1 }}>
                  <img
                    src={avatarUrl}
                    alt=""
                    style={{ width: '36px', height: '36px', borderRadius: '8px', objectFit: 'cover', border: `1px solid ${c.border}` }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '13.5px', fontWeight: '800', color: c.text }}>
                      {emp.nombre_completo}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', fontSize: '11px', color: c.textMuted, fontWeight: '600', marginTop: '2px' }}>
                      <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: '700' }}>#{emp.numero_empleado}</span>
                      {emp.departamentos?.nombre && <span>• {emp.departamentos.nombre}</span>}
                      {inc && (
                        <span style={{
                          fontSize: '10.5px', fontWeight: '800', padding: '1px 6px', borderRadius: '4px',
                          color: inc.color, background: inc.bg
                        }}>
                          {inc.etiqueta}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* HORARIOS REALES REGISTRADOS + ACCIONES DE RESCATE RH */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {tieneEntrada ? (
                    <>
                      <span style={{
                        fontSize: '11.5px', fontWeight: '800', color: '#16a34a',
                        background: 'rgba(22,163,74,0.10)', border: '1px solid rgba(22,163,74,0.25)',
                        padding: '4px 9px', borderRadius: '7px', display: 'inline-flex', alignItems: 'center', gap: '4px'
                      }}>
                        <Clock size={12} /> Entrada: {reg.hora_entrada}
                      </span>

                      {tieneSalida ? (
                        <span style={{
                          fontSize: '11.5px', fontWeight: '800', color: '#0284c7',
                          background: 'rgba(2,132,199,0.10)', border: '1px solid rgba(2,132,199,0.25)',
                          padding: '4px 9px', borderRadius: '7px', display: 'inline-flex', alignItems: 'center', gap: '4px'
                        }}>
                          <CheckCircle2 size={12} /> Salida: {reg.hora_salida}
                        </span>
                      ) : fecha === hoyStr && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleMarcarDesdeRH(emp.id, 'salida')}
                            disabled={procesandoId === `${emp.id}-salida`}
                            style={{
                              height: '30px', padding: '0 10px', borderRadius: '7px',
                              border: `1px solid ${c.border}`, background: c.bg, color: c.text,
                              fontSize: '11px', fontWeight: '800', cursor: 'pointer',
                              display: 'inline-flex', alignItems: 'center', gap: '4px'
                            }}
                          >
                            <LogOut size={12} /> Marcar Salida
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuitarEntradaRH(emp.id, emp.nombre_completo)}
                            disabled={procesandoId === `${emp.id}-borrar`}
                            title="Quitar entrada si fue marcada por error"
                            style={{
                              height: '30px', padding: '0 7px', borderRadius: '7px',
                              border: `1px solid ${c.border}`, background: 'transparent', color: c.textMuted,
                              fontSize: '11px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center'
                            }}
                          >
                            <Undo2 size={12} />
                          </button>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <span style={{
                        fontSize: '11px', fontWeight: '700',
                        color: inc?.tipo === 'ausencia_autorizada' ? '#0284c7' : '#ef4444'
                      }}>
                        {inc?.tipo === 'ausencia_autorizada' ? 'Ausencia justificada' : 'Sin marca de entrada'}
                      </span>

                      {fecha === hoyStr && (
                        <button
                          type="button"
                          onClick={() => handleMarcarDesdeRH(emp.id, 'entrada')}
                          disabled={procesandoId === `${emp.id}-entrada`}
                          title="Validar que el colaborador sí está en planta aunque caseta no lo haya marcado"
                          style={{
                            height: '32px', padding: '0 11px', borderRadius: '8px',
                            border: `1px solid ${c.accent}`, background: c.accentSoft, color: c.accent,
                            fontSize: '11.5px', fontWeight: '800', cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center', gap: '5px'
                          }}
                        >
                          <ShieldCheck size={13} /> Validar en Planta
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
