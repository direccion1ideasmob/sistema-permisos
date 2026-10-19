import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../core/auth/AuthContext';
import { obtenerTemaAprobaciones, generarEstilosAprobaciones } from '../permisos/aprobacionesStyles';
import {
  obtenerDatosCaseta,
  registrarCheckCaseta,
  registrarRetardoEnPuerta,
  registrarAsistenciaLista,
  obtenerFechaLocalHoy
} from './services/vigilanciaService';
import {
  DoorOpen, RotateCcw, CheckCircle2, LogOut, LogIn,
  Clock, Search, Calendar, RefreshCw, UserCheck
} from 'lucide-react';
import BuscadorPersonal from './BuscadorPersonal';

export default function Caseta() {
  const { usuario } = useAuth();
  const location = useLocation();

  const rutaActual = location.pathname;
  const vista = rutaActual.includes('/asistencia')
    ? 'asistencia'
    : rutaActual.includes('/retardo')
    ? 'retardo'
    : 'pases';

  const [modoOscuro, setModoOscuro] = useState(() => localStorage.getItem('tema_sistema') === 'oscuro');
  useEffect(() => {
    const syncTema = () => setModoOscuro(localStorage.getItem('tema_sistema') === 'oscuro');
    window.addEventListener('storage', syncTema);
    const timer = setInterval(syncTema, 800);
    return () => {
      window.removeEventListener('storage', syncTema);
      clearInterval(timer);
    };
  }, []);

  const c = obtenerTemaAprobaciones(modoOscuro);

  const [subTabPases, setSubTabPases] = useState('por_cruzar');

  const [pasesPorCruzar, setPasesPorCruzar] = useState([]);
  const [personalFuera, setPersonalFuera] = useState([]);
  const [crucesCompletadosHoy, setCrucesCompletadosHoy] = useState([]);
  const [empleadosSede, setEmpleadosSede] = useState([]);
  const [mapaAsistencias, setMapaAsistencias] = useState({});

  const [busquedaTexto, setBusquedaTexto] = useState('');
  const [fechaAsistencia, setFechaAsistencia] = useState(obtenerFechaLocalHoy());
  const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState('');

  const [cargando, setCargando] = useState(true);
  const [procesandoId, setProcesandoId] = useState(null);

  const sedeGuardia = usuario?.sede_id || null;
  const hoyStr = obtenerFechaLocalHoy();
  const esFechaHoy = fechaAsistencia === hoyStr;

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    try {
      const data = await obtenerDatosCaseta(sedeGuardia, fechaAsistencia);
      setPasesPorCruzar(data.pasesPorCruzar);
      setPersonalFuera(data.personalFuera);
      setCrucesCompletadosHoy(data.crucesCompletadosHoy);
      setEmpleadosSede(data.empleadosSede);
      setMapaAsistencias(data.mapaAsistencias);
    } catch (err) {
      console.error('Error cargando datos de vigilancia:', err);
    } finally {
      setCargando(false);
    }
  }, [sedeGuardia, fechaAsistencia]);

  useEffect(() => {
    cargarDatos();
    const intervalo = setInterval(cargarDatos, 12000);
    return () => clearInterval(intervalo);
  }, [cargarDatos]);

  const handleSellarPase = async (id, tipoMovimiento) => {
    setProcesandoId(id);
    try {
      await registrarCheckCaseta(id, tipoMovimiento);
      await cargarDatos();
    } catch (err) {
      alert('Error al sellar cruce: ' + err.message);
    } finally {
      setProcesandoId(null);
    }
  };

  const handleMarcarAsistencia = async (empleadoId, tipoMarca) => {
    setProcesandoId(`${empleadoId}-${tipoMarca}`);
    try {
      await registrarAsistenciaLista(empleadoId, tipoMarca, usuario?.id || null);
      await cargarDatos();
    } catch (err) {
      alert('Error al registrar asistencia: ' + err.message);
    } finally {
      setProcesandoId(null);
    }
  };

  const handleGenerarRetardo = async () => {
    if (!empleadoSeleccionado) return;
    setProcesandoId('nuevo-retardo');
    try {
      await registrarRetardoEnPuerta(empleadoSeleccionado);
      setEmpleadoSeleccionado('');
      await cargarDatos();
      alert('✅ Solicitud de retardo enviada a autorización y hora de entrada registrada.');
    } catch (err) {
      alert('Error al generar retardo: ' + err.message);
    } finally {
      setProcesandoId(null);
    }
  };

  const BadgeNomina = ({ numero }) => (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: '52px', height: '34px', padding: '0 8px', borderRadius: '8px',
      background: c.accentSoft, color: c.accent, border: `1px solid ${c.border}`,
      fontWeight: '800', fontSize: '12px', fontFamily: 'monospace', flexShrink: 0
    }}>
      #{numero || 'S/N'}
    </span>
  );

  // ====================================================================
  // MÓDULO 1 DEL SIDEBAR: PASES DE PUERTA (/caseta)
  // ====================================================================
  if (vista === 'pases') {
    const listaActiva = subTabPases === 'por_cruzar'
      ? pasesPorCruzar
      : subTabPases === 'reingresos'
      ? personalFuera
      : crucesCompletadosHoy;

    return (
      <div className="aprobaciones-container">
        <style>{generarEstilosAprobaciones(c, modoOscuro)}</style>

        <div className="tabs-aprobacion-bar">
          <button
            className={`tab-btn ${subTabPases === 'por_cruzar' ? 'active' : ''}`}
            onClick={() => setSubTabPases('por_cruzar')}
          >
            <DoorOpen size={15} />
            <span>Por Cruzar</span>
            {pasesPorCruzar.length > 0 && (
              <span className="tab-badge" style={{ background: c.accent, color: '#fff' }}>
                {pasesPorCruzar.length}
              </span>
            )}
          </button>

          <button
            className={`tab-btn ${subTabPases === 'reingresos' ? 'active' : ''}`}
            onClick={() => setSubTabPases('reingresos')}
          >
            <RotateCcw size={15} />
            <span>Por Reingresar</span>
            {personalFuera.length > 0 && (
              <span className="tab-badge" style={{ background: '#f59e0b', color: '#fff' }}>
                {personalFuera.length}
              </span>
            )}
          </button>

          <button
            className={`tab-btn ${subTabPases === 'sellados' ? 'active' : ''}`}
            onClick={() => setSubTabPases('sellados')}
          >
            <CheckCircle2 size={15} />
            <span>Sellados Hoy</span>
            {crucesCompletadosHoy.length > 0 && (
              <span className="tab-badge" style={{ background: c.border, color: c.text }}>
                {crucesCompletadosHoy.length}
              </span>
            )}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
          {listaActiva.length === 0 ? (
            <div style={{
              background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '12px',
              padding: '36px 20px', textAlign: 'center', color: c.textMuted, fontSize: '13px', fontWeight: '600'
            }}>
              {subTabPases === 'por_cruzar' && 'No hay pases autorizados pendientes de cruzar puerta.'}
              {subTabPases === 'reingresos' && 'No hay personal fuera de planta pendiente de reingreso.'}
              {subTabPases === 'sellados' && 'Aún no se han sellado cruces de pases el día de hoy.'}
            </div>
          ) : (
            listaActiva.map((p) => {
              const esSalida = p.tipo_permiso === 'salida';
              return (
                <div
                  key={p.id}
                  style={{
                    background: c.surfaceCard,
                    border: `1px solid ${c.border}`,
                    borderRadius: '12px',
                    padding: '13px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '14px',
                    flexWrap: 'wrap'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '220px', flex: '1.2 1 240px' }}>
                    <BadgeNomina numero={p.usuarios?.numero_empleado} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '13.5px', fontWeight: '800', color: c.text }}>
                        {p.usuarios?.nombre_completo}
                      </div>
                      <div style={{ fontSize: '11px', color: c.textMuted, fontFamily: 'monospace', fontWeight: '700', marginTop: '2px' }}>
                        Folio: {p.folio}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 220px', flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: '10px', fontWeight: '800', padding: '3px 8px', borderRadius: '6px',
                      background: esSalida ? 'rgba(14,165,233,0.12)' : 'rgba(22,163,74,0.12)',
                      color: esSalida ? '#0284c7' : '#16a34a',
                      border: `1px solid ${esSalida ? 'rgba(14,165,233,0.3)' : 'rgba(22,163,74,0.3)'}`,
                      textTransform: 'uppercase'
                    }}>
                      {esSalida ? 'Salida Autorizada' : 'Entrada Autorizada'}
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: c.textSubtle, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <Clock size={13} color={c.textMuted} />
                      {p.horarioProgramado}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                    {subTabPases === 'por_cruzar' && (
                      <button
                        onClick={() => handleSellarPase(p.id, esSalida ? 'salida' : 'entrada')}
                        disabled={procesandoId === p.id}
                        style={{
                          padding: '8px 15px', borderRadius: '8px', border: 'none',
                          background: c.accent, color: '#fff', fontSize: '12px', fontWeight: '800',
                          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px'
                        }}
                      >
                        {esSalida ? <LogOut size={14} /> : <LogIn size={14} />}
                        {procesandoId === p.id ? 'Sellando...' : (esSalida ? 'Sellar Salida' : 'Sellar Entrada')}
                      </button>
                    )}

                    {subTabPases === 'reingresos' && (
                      <>
                        <span style={{ fontSize: '11.5px', fontWeight: '700', color: c.textMuted }}>
                          Salió: {p.horaSalidaCaseta}
                        </span>
                        <button
                          onClick={() => handleSellarPase(p.id, 'reingreso')}
                          disabled={procesandoId === p.id}
                          style={{
                            padding: '8px 15px', borderRadius: '8px', border: 'none',
                            background: '#2563eb', color: '#fff', fontSize: '12px', fontWeight: '800',
                            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px'
                          }}
                        >
                          <LogIn size={14} />
                          {procesandoId === p.id ? 'Sellando...' : 'Sellar Reingreso'}
                        </button>
                      </>
                    )}

                    {subTabPases === 'sellados' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11.5px', fontWeight: '800', color: c.accent }}>
                        {p.horaSalidaCaseta && (
                          <span style={{ background: c.accentSoft, padding: '4px 9px', borderRadius: '6px' }}>
                            Salida: {p.horaSalidaCaseta}
                          </span>
                        )}
                        {p.horaEntradaCaseta && (
                          <span style={{ background: c.accentSoft, padding: '4px 9px', borderRadius: '6px' }}>
                            Entrada: {p.horaEntradaCaseta}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // ====================================================================
  // MÓDULO 2 DEL SIDEBAR: APOYO RETARDO (/caseta/retardo)
  // ====================================================================
  if (vista === 'retardo') {
    const horaActual = new Date().toTimeString().slice(0, 5);
    return (
      <div className="aprobaciones-container">
        <style>{generarEstilosAprobaciones(c, modoOscuro)}</style>

        <div style={{
          background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '12px',
          padding: '22px', width: '100%', boxSizing: 'border-box'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '15px', fontWeight: '800', color: c.text }}>
                Generar Pase de Retardo en Puerta
              </div>
              <div style={{ fontSize: '12px', color: c.textMuted, marginTop: '2px' }}>
                Apoyo para colaboradores que llegan a caseta sin acceso a internet. Se sellará la hora actual de llegada y se enviará a autorización.
              </div>
            </div>
            <span style={{
              fontSize: '12px', fontWeight: '800', color: c.accent, background: c.accentSoft,
              border: `1px solid ${c.border}`, padding: '6px 12px', borderRadius: '8px',
              display: 'inline-flex', alignItems: 'center', gap: '6px'
            }}>
              <Clock size={14} /> Hora actual: {horaActual} hrs
            </span>
          </div>

          <BuscadorPersonal
            empleados={empleadosSede}
            seleccionado={empleadoSeleccionado}
            setSeleccionado={setEmpleadoSeleccionado}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleGenerarRetardo}
              disabled={!empleadoSeleccionado || procesandoId === 'nuevo-retardo'}
              style={{
                padding: '11px 22px', borderRadius: '9px', border: 'none',
                background: c.accent, color: '#fff', fontSize: '13px', fontWeight: '800',
                cursor: (!empleadoSeleccionado || procesandoId === 'nuevo-retardo') ? 'not-allowed' : 'pointer',
                opacity: (!empleadoSeleccionado || procesandoId === 'nuevo-retardo') ? 0.5 : 1,
                display: 'inline-flex', alignItems: 'center', gap: '7px'
              }}
            >
              <Clock size={15} />
              {procesandoId === 'nuevo-retardo' ? 'Registrando llegada...' : 'Sellar Hora de Llegada y Enviar'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ====================================================================
  // MÓDULO 3 DEL SIDEBAR: PASE DE LISTA Y CONSULTA HISTÓRICA (/caseta/asistencia)
  // ====================================================================
  const termino = (busquedaTexto || '').toLowerCase().trim();
  const personalFiltrado = empleadosSede.filter(emp => {
    if (!termino) return true;
    return (
      (emp.nombre_completo || '').toLowerCase().includes(termino) ||
      String(emp.numero_empleado || '').toLowerCase().includes(termino)
    );
  });

  const totalPresentes = empleadosSede.filter(e => Boolean(mapaAsistencias[e.id]?.hora_entrada)).length;

  return (
    <div className="aprobaciones-container">
      <style>{generarEstilosAprobaciones(c, modoOscuro)}</style>

      <div style={{
        background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '12px',
        padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '12px', flexWrap: 'wrap'
      }}>
        <div style={{ position: 'relative', flex: '1 1 240px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '10px', color: c.textMuted }} />
          <input
            type="text"
            placeholder="Buscar colaborador por # de nómina o nombre..."
            value={busquedaTexto}
            onChange={(e) => setBusquedaTexto(e.target.value)}
            style={{
              width: '100%', padding: '8px 12px 8px 34px', borderRadius: '8px',
              border: `1px solid ${c.border}`, background: c.bg, color: c.text,
              fontSize: '12.5px', boxSizing: 'border-box', outline: 'none'
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            background: c.bg, border: `1px solid ${c.border}`, borderRadius: '8px', padding: '5px 10px'
          }}>
            <Calendar size={14} color={c.accent} />
            <input
              type="date"
              value={fechaAsistencia}
              max={hoyStr}
              onChange={(e) => setFechaAsistencia(e.target.value)}
              style={{
                border: 'none', background: 'transparent', color: c.text,
                fontSize: '12px', fontWeight: '800', outline: 'none', cursor: 'pointer'
              }}
            />
          </div>

          <span style={{
            fontSize: '11.5px', fontWeight: '800', color: c.accent, background: c.accentSoft,
            padding: '6px 10px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '5px'
          }}>
            <UserCheck size={14} /> Presentes: {totalPresentes} / {empleadosSede.length}
          </span>

          <button
            onClick={cargarDatos}
            title="Actualizar lista"
            style={{
              padding: '7px 10px', borderRadius: '8px', border: `1px solid ${c.border}`,
              background: c.bg, color: c.text, cursor: 'pointer', display: 'inline-flex', alignItems: 'center'
            }}
          >
            <RefreshCw size={14} className={cargando ? 'spin' : ''} />
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
        {personalFiltrado.map((emp) => {
          const reg = mapaAsistencias[emp.id];
          const tieneEntrada = Boolean(reg?.hora_entrada);
          const tieneSalida = Boolean(reg?.hora_salida);

          return (
            <div
              key={emp.id}
              style={{
                background: c.surfaceCard,
                border: `1px solid ${c.border}`,
                borderRadius: '10px',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 220px', minWidth: 0 }}>
                <BadgeNomina numero={emp.numero_empleado} />
                <span style={{ fontSize: '13px', fontWeight: '800', color: c.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {emp.nombre_completo}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto', flexWrap: 'wrap' }}>
                {tieneEntrada ? (
                  <span style={{
                    fontSize: '11.5px', fontWeight: '800', color: '#16a34a',
                    background: 'rgba(22,163,74,0.10)', border: '1px solid rgba(22,163,74,0.3)',
                    padding: '5px 10px', borderRadius: '7px', display: 'inline-flex', alignItems: 'center', gap: '5px'
                  }}>
                    <CheckCircle2 size={13} /> Entrada: {reg.hora_entrada}
                  </span>
                ) : esFechaHoy ? (
                  <button
                    onClick={() => handleMarcarAsistencia(emp.id, 'entrada')}
                    disabled={procesandoId === `${emp.id}-entrada`}
                    style={{
                      padding: '6px 13px', borderRadius: '7px', border: 'none',
                      background: c.accent, color: '#fff', fontSize: '11.5px',
                      fontWeight: '800', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px'
                    }}
                  >
                    <LogIn size={13} />
                    {procesandoId === `${emp.id}-entrada` ? '...' : 'Entrada'}
                  </button>
                ) : (
                  <span style={{
                    fontSize: '11.5px', fontWeight: '700', color: c.textMuted,
                    background: c.bg, border: `1px solid ${c.border}`,
                    padding: '4px 9px', borderRadius: '7px'
                  }}>
                    Sin registro de asistencia
                  </span>
                )}

                {tieneEntrada && (
                  tieneSalida ? (
                    <span style={{
                      fontSize: '11.5px', fontWeight: '800', color: '#0284c7',
                      background: 'rgba(2,132,199,0.10)', border: '1px solid rgba(2,132,199,0.3)',
                      padding: '5px 10px', borderRadius: '7px', display: 'inline-flex', alignItems: 'center', gap: '5px'
                    }}>
                      <LogOut size={13} /> Salida: {reg.hora_salida}
                    </span>
                  ) : esFechaHoy ? (
                    <button
                      onClick={() => handleMarcarAsistencia(emp.id, 'salida')}
                      disabled={procesandoId === `${emp.id}-salida`}
                      style={{
                        padding: '6px 12px', borderRadius: '7px', border: `1px solid ${c.border}`,
                        background: 'transparent', color: c.text, fontSize: '11.5px',
                        fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px'
                      }}
                    >
                      <LogOut size={13} />
                      {procesandoId === `${emp.id}-salida` ? '...' : 'Salida'}
                    </button>
                  ) : (
                    <span style={{ fontSize: '11px', color: c.textMuted, fontWeight: '600' }}>
                      Salida s/r
                    </span>
                  )
                )}
              </div>
            </div>
          );
        })}

        {personalFiltrado.length === 0 && (
          <div style={{
            background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '12px',
            padding: '28px', textAlign: 'center', color: c.textMuted, fontSize: '13px'
          }}>
            No se encontraron colaboradores con ese criterio.
          </div>
        )}
      </div>
    </div>
  );
}
