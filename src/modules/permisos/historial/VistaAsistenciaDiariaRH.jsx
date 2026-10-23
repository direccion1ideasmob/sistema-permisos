import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  obtenerDatosCaseta,
  registrarAsistenciaLista,
  deshacerEntradaReciente,
  obtenerFechaLocalHoy,
  obtenerHoraLimiteTolerancia
} from '../../vigilancia/services/vigilanciaService';
import ControlHoraCorteRH from '../autorizacion/ControlHoraCorteRH';
import {
  Calendar, Search, RefreshCw, Download,
  Clock, ShieldCheck, LogOut, CheckCircle2, X, Undo2
} from 'lucide-react';

const formatearFechaBonita = (fechaYYYYMMDD) => {
  if (!fechaYYYYMMDD) return '';
  const [y, m, d] = fechaYYYYMMDD.split('-').map(Number);
  const fechaObj = new Date(y, m - 1, d);
  const texto = fechaObj.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

export default function VistaAsistenciaDiariaRH({ usuario, departamentos = [], c }) {
  const hoyStr = obtenerFechaLocalHoy();
  const [fecha, setFecha] = useState(hoyStr);
  const [busqueda, setBusqueda] = useState('');
  const [deptoFiltro, setDeptoFiltro] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('todos');
  const inputFechaRef = useRef(null);

  const [empleados, setEmpleados] = useState([]);
  const [mapaAsistencias, setMapaAsistencias] = useState({});
  const [mapaIncidencias, setMapaIncidencias] = useState({});
  const [cargando, setCargando] = useState(true);
  const [procesandoId, setProcesandoId] = useState(null);
  const [horaLimiteCorte, setHoraLimiteCorte] = useState(() => localStorage.getItem('hora_limite_retardo_rh') || '07:15');

  const cargarAsistenciaDia = useCallback(async () => {
    setCargando(true);
    try {
      const sedeFiltro = usuario?.rol === 'superadmin' ? null : (usuario?.sede_id || null);
      obtenerHoraLimiteTolerancia().then(h => h && setHoraLimiteCorte(h));
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
    if (!window.confirm(`¿Deseas eliminar el registro de entrada de ${nombre}?`)) return;
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
      {/* CABECERA UNIFICADA: FECHA EN LETRA GRANDE + PÍLDORAS DE RESUMEN + FILTROS Y RELOJ */}
      <div style={{
        background: c.surfaceCard,
        border: `1px solid ${c.border}`,
        borderRadius: '14px',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        {/* RENGLÓN 1: FECHA BONITA ("Viernes, 23 de octubre de 2026") + PÍLDORAS DE FILTRO */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={() => {
                if (inputFechaRef.current?.showPicker) inputFechaRef.current.showPicker();
                else inputFechaRef.current?.focus();
              }}
              title="Cambiar fecha de consulta"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '9px',
                background: 'transparent',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <div style={{
                width: '36px', height: '36px', borderRadius: '10px',
                background: c.accentSoft, color: c.accent,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                <Calendar size={18} />
              </div>
              <div>
                <div style={{ fontSize: '17px', fontWeight: '900', color: c.text, letterSpacing: '-0.01em' }}>
                  {formatearFechaBonita(fecha)}
                </div>
                <div style={{ fontSize: '11px', fontWeight: '700', color: c.textMuted }}>
                  {fecha === hoyStr ? 'Lista de asistencia de hoy (Clic para cambiar día)' : 'Consulta histórica (Clic para cambiar día)'}
                </div>
              </div>
            </button>

            <input
              ref={inputFechaRef}
              type="date"
              value={fecha}
              max={hoyStr}
              onChange={(e) => e.target.value && setFecha(e.target.value)}
              style={{ position: 'absolute', opacity: 0, width: '1px', height: '1px', pointerEvents: 'none' }}
            />
          </div>

          {/* PÍLDORAS COMPACTAS DE FILTRO */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {[
              { id: 'todos', label: 'Todos', count: empleados.length, color: c.text, activeBg: c.bg },
              { id: 'presentes', label: 'En Planta', count: totalPresentes, color: '#16a34a', activeBg: 'rgba(22,163,74,0.10)' },
              { id: 'ausentes', label: 'Sin Registro', count: totalSinRegistro, color: '#ef4444', activeBg: 'rgba(239,68,68,0.10)' },
              { id: 'incidencias', label: 'Permisos Hoy', count: totalConPermiso, color: '#0284c7', activeBg: 'rgba(2,132,199,0.10)' }
            ].map((f) => {
              const activo = estadoFiltro === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setEstadoFiltro(f.id)}
                  style={{
                    height: '32px',
                    padding: '0 11px',
                    borderRadius: '999px',
                    border: `1.5px solid ${activo ? f.color : c.border}`,
                    background: activo ? f.activeBg : 'transparent',
                    color: activo ? f.color : c.textMuted,
                    fontSize: '12px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span>{f.label}</span>
                  <span style={{
                    padding: '1px 6px',
                    borderRadius: '999px',
                    background: activo ? f.color : c.bg,
                    color: activo ? '#fff' : f.color,
                    fontSize: '11px',
                    fontWeight: '900'
                  }}>
                    {f.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* RENGLÓN 2: BUSCADOR + DEPARTAMENTO + EXPORTAR + RELOJ DE CORTE A LA DERECHA */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          flexWrap: 'wrap',
          paddingTop: '10px',
          borderTop: `1px solid ${c.border}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '210px' }}>
              <Search size={14} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: c.textMuted }} />
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
              title="Actualizar lista"
              style={{
                width: '35px', height: '35px', borderRadius: '8px',
                border: `1px solid ${c.border}`, background: c.bg, color: c.text,
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <RefreshCw size={14} />
            </button>

            <ControlHoraCorteRH usuario={usuario} c={c} />
          </div>
        </div>
      </div>

      {/* LISTA DE COLABORADORES */}
      {cargando ? (
        <div style={{ textAlign: 'center', padding: '40px', color: c.textMuted, fontWeight: '600' }}>
          Cargando registros de asistencia...
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

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {tieneEntrada ? (
                    <>
                      {(() => {
                        const esTarde = reg.hora_entrada > horaLimiteCorte;
                        const col = esTarde ? '#d97706' : '#16a34a';
                        const bg = esTarde ? 'rgba(245,158,11,0.12)' : 'rgba(22,163,74,0.10)';
                        const bd = esTarde ? 'rgba(245,158,11,0.32)' : 'rgba(22,163,74,0.25)';
                        return (
                          <span style={{
                            fontSize: '11.5px', fontWeight: '800', color: col,
                            background: bg, border: `1px solid ${bd}`,
                            padding: '4px 9px', borderRadius: '7px', display: 'inline-flex', alignItems: 'center', gap: '4px'
                          }}>
                            <Clock size={12} /> {esTarde ? `Retardo: ${reg.hora_entrada}` : `Entrada: ${reg.hora_entrada}`}
                          </span>
                        );
                      })()}

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
                          title="Validar que el colaborador sí está en planta"
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
