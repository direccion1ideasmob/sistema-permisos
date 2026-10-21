import React from 'react';
import { LogOut, LogIn, CheckCircle2, Clock, Hourglass, MapPin } from 'lucide-react';

export default function TablaRegistrosVig({
  tabActiva,
  retenidosEnEspera = [],
  pasesPorCruzar = [],
  personalFuera = [],
  crucesCompletadosHoy = [],
  empleadosSede = [],
  mapaAsistencias = {},
  busquedaTexto,
  registrarMovimientoPase,
  marcarAsistencia,
  procesandoId,
  theme
}) {

  const BadgeNomina = ({ numero }) => (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: '46px', padding: '4px 7px', borderRadius: '7px',
      background: '#f1f5f9', color: '#0f172a', fontWeight: '900',
      fontSize: '13.5px', fontFamily: 'monospace', flexShrink: 0
    }}>
      #{numero || 'S/N'}
    </span>
  );

  const calcularMinutosEspera = (createdAt) => {
    if (!createdAt) return null;
    const diffMs = Date.now() - new Date(createdAt).getTime();
    const min = Math.max(1, Math.floor(diffMs / 60000));
    return min < 60 ? `${min} min` : `${Math.floor(min / 60)}h ${min % 60}m`;
  };

  // ==========================================================
  // PESTAÑA 1: PASES Y RETARDOS EN PUERTA
  // ==========================================================
  if (tabActiva === 'pases') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* 0. RETENIDOS EN PUERTA ESPERANDO AUTORIZACIÓN (MODELO A) */}
        {retenidosEnEspera.length > 0 && (
          <div style={{
            background: theme.surface,
            border: '1.5px solid #f59e0b',
            borderRadius: '14px',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '13px 16px',
              background: 'rgba(245, 158, 11, 0.1)',
              borderBottom: '1px solid rgba(245, 158, 11, 0.3)',
              fontSize: '14px',
              fontWeight: '900',
              color: '#b45309',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Hourglass size={14} /> RETENIDOS EN PUERTA • ESPERANDO RESPUESTA DE JEFE
              </span>
              <span>{retenidosEnEspera.length}</span>
            </div>

            {retenidosEnEspera.map((p) => {
              const tiempoEspera = calcularMinutosEspera(p.created_at);
              return (
                <div
                  key={p.id}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: '12px', padding: '14px 16px', borderBottom: `1px solid ${theme.border}`,
                    flexWrap: 'wrap'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '210px', flex: '1 1 240px' }}>
                    <BadgeNomina numero={p.usuarios?.numero_empleado} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '15.5px', fontWeight: '800', color: theme.text }}>
                        {p.usuarios?.nombre_completo}
                      </div>
                      <div style={{ fontSize: '13.5px', color: theme.textMuted, fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '3px' }}>
                        <span style={{
                          fontSize: '12px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px',
                          background: 'rgba(245, 158, 11, 0.15)', color: '#b45309'
                        }}>
                          ⏳ Esperando a: {p.esperandoFirmaDe}
                        </span>
                        {tiempoEspera && (
                          <span style={{ fontSize: '12.5px', fontWeight: '700', color: '#64748b' }}>
                            • Hace {tiempoEspera}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {p.horaLlegadaPuerta ? (
                    <span style={{
                      fontSize: '13px', fontWeight: '800', color: '#15803d',
                      background: '#f0fdf4', border: '1px solid #86efac',
                      padding: '6px 12px', borderRadius: '8px',
                      display: 'inline-flex', alignItems: 'center', gap: '5px', marginLeft: 'auto'
                    }}>
                      <CheckCircle2 size={13} /> Llegada congelada: {p.horaLlegadaPuerta}
                    </span>
                  ) : (
                    <button
                      onClick={() => registrarMovimientoPase(p.id, 'congelar_llegada')}
                      disabled={procesandoId === p.id}
                      style={{
                        padding: '8px 14px', borderRadius: '8px', border: '1px solid #f59e0b',
                        background: '#fffbeb', color: '#b45309',
                        fontSize: '13.5px', fontWeight: '800', cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', gap: '5px', marginLeft: 'auto'
                      }}
                    >
                      <MapPin size={13} />
                      {procesandoId === p.id ? 'Guardando...' : 'Congelar Hora de Llegada'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 1. AUTORIZADOS O DICTAMINADOS LISTOS PARA ACCIÓN EN CASETA */}
        <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: '14px', overflow: 'hidden' }}>
          <div style={{ padding: '13px 16px', borderBottom: `1px solid ${theme.border}`, fontSize: '14px', fontWeight: '900', color: theme.text, display: 'flex', justifyContent: 'space-between' }}>
            <span>PASES CON INSTRUCCIÓN PARA CASETA</span>
            <span style={{ color: theme.accent }}>{pasesPorCruzar.length}</span>
          </div>

          {pasesPorCruzar.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: theme.textMuted, fontSize: '14.5px', fontWeight: '600' }}>
              No hay pases pendientes de salida o entrada en este momento.
            </div>
          ) : (
            pasesPorCruzar.map((p) => {
              const esSalida = p.tipo_permiso === 'salida';
              const esRegresoCasa = Boolean(p.seRegresaACasa);
              return (
                <div
                  key={p.id}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: '12px', padding: '13px 16px', borderBottom: `1px solid ${theme.border}`,
                    background: esRegresoCasa ? 'rgba(239,68,68,0.04)' : 'transparent',
                    flexWrap: 'wrap'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '200px', flex: '1 1 220px' }}>
                    <BadgeNomina numero={p.usuarios?.numero_empleado} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '15.5px', fontWeight: '800', color: theme.text }}>
                        {p.usuarios?.nombre_completo}
                      </div>
                      <div style={{ fontSize: '13.5px', color: theme.textMuted, fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '12px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px',
                          background: esRegresoCasa ? 'rgba(239,68,68,0.14)' : (esSalida ? 'rgba(14,165,233,0.12)' : 'rgba(22,163,74,0.12)'),
                          color: esRegresoCasa ? '#dc2626' : (esSalida ? '#0284c7' : '#16a34a'), textTransform: 'uppercase'
                        }}>
                          {esRegresoCasa ? '🚫 SE REGRESA A CASA (NO DAR ACCESO)' : (esSalida ? 'Salida Autorizada' : '✅ Acceso Autorizado')}
                        </span>
                        <span>•</span>
                        <span>{p.horaLlegadaPuerta ? `Llegó a puerta: ${p.horaLlegadaPuerta}` : p.horarioProgramado}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => registrarMovimientoPase(p.id, esRegresoCasa ? 'retiro' : (esSalida ? 'salida' : 'entrada'))}
                    disabled={procesandoId === p.id}
                    style={{
                      padding: '8px 16px', borderRadius: '8px', border: 'none',
                      background: esRegresoCasa ? '#dc2626' : (esSalida ? '#0284c7' : '#16a34a'), color: '#fff',
                      fontSize: '14px', fontWeight: '800', cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: '6px', marginLeft: 'auto'
                    }}
                  >
                    {esRegresoCasa || esSalida ? <LogOut size={14} /> : <LogIn size={14} />}
                    {procesandoId === p.id ? 'Sellando...' : (esRegresoCasa ? 'Confirmar Retiro' : (esSalida ? 'Sellar Salida' : 'Sellar Entrada'))}
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* 2. PENDIENTES DE REINGRESO HOY */}
        {personalFuera.length > 0 && (
          <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: '14px', overflow: 'hidden' }}>
            <div style={{ padding: '13px 16px', borderBottom: `1px solid ${theme.border}`, fontSize: '14px', fontWeight: '900', color: '#2563eb', display: 'flex', justifyContent: 'space-between' }}>
              <span>PENDIENTES DE REINGRESO A PLANTA</span>
              <span>{personalFuera.length}</span>
            </div>

            {personalFuera.map((p) => (
              <div
                key={p.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: '12px', padding: '13px 16px', borderBottom: `1px solid ${theme.border}`,
                  flexWrap: 'wrap'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 220px' }}>
                  <BadgeNomina numero={p.usuarios?.numero_empleado} />
                  <div>
                    <div style={{ fontSize: '15.5px', fontWeight: '800', color: theme.text }}>
                      {p.usuarios?.nombre_completo}
                    </div>
                    <div style={{ fontSize: '13.5px', color: theme.textMuted, fontWeight: '600' }}>
                      Salió: {p.horaSalidaCaseta}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => registrarMovimientoPase(p.id, 'reingreso')}
                  disabled={procesandoId === p.id}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', border: 'none',
                    background: '#2563eb', color: '#fff', fontSize: '14px', fontWeight: '800',
                    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', marginLeft: 'auto'
                  }}
                >
                  <LogIn size={14} />
                  {procesandoId === p.id ? 'Sellando...' : 'Sellar Reingreso'}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 3. CRUCES DE PASE YA SELLADOS HOY */}
        {crucesCompletadosHoy.length > 0 && (
          <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: '14px', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${theme.border}`, fontSize: '13.5px', fontWeight: '800', color: theme.textMuted }}>
              CRUCES CON PASE REGISTRADOS HOY ({crucesCompletadosHoy.length})
            </div>
            {crucesCompletadosHoy.map((p) => (
              <div
                key={p.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: '12px', padding: '9px 16px', borderBottom: `1px solid ${theme.border}`,
                  fontSize: '14.5px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BadgeNomina numero={p.usuarios?.numero_empleado} />
                  <span style={{ fontWeight: '700', color: theme.text }}>{p.usuarios?.nombre_completo}</span>
                </div>
                <div style={{ fontSize: '13.5px', fontWeight: '700', color: p.seRegresaACasa ? '#dc2626' : '#16a34a' }}>
                  {p.seRegresaACasa && p.horaRetiroCaseta && `↩️ Se regresó a casa: ${p.horaRetiroCaseta}`}
                  {!p.seRegresaACasa && p.horaSalidaCaseta && `Salida: ${p.horaSalidaCaseta}`}
                  {!p.seRegresaACasa && p.horaSalidaCaseta && p.horaEntradaCaseta && ' • '}
                  {!p.seRegresaACasa && p.horaEntradaCaseta && `Entrada: ${p.horaEntradaCaseta}`}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const termino = (busquedaTexto || '').toLowerCase().trim();
  const personalFiltrado = empleadosSede.filter(emp => {
    if (!termino) return true;
    return (
      (emp.nombre_completo || '').toLowerCase().includes(termino) ||
      String(emp.numero_empleado || '').toLowerCase().includes(termino)
    );
  });

  if (tabActiva === 'lista') {
    return (
      <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: '14px', overflow: 'hidden' }}>
        {personalFiltrado.map((emp) => {
          const reg = mapaAsistencias[emp.id];
          const tieneEntrada = Boolean(reg?.hora_entrada);
          const tieneSalida = Boolean(reg?.hora_salida);

          return (
            <div
              key={emp.id}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: '12px', padding: '12px 16px', borderBottom: `1px solid ${theme.border}`,
                flexWrap: 'wrap'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 200px', minWidth: 0 }}>
                <BadgeNomina numero={emp.numero_empleado} />
                <div style={{ fontSize: '15px', fontWeight: '800', color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {emp.nombre_completo}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
                {tieneEntrada ? (
                  <span style={{
                    fontSize: '13px', fontWeight: '800', color: '#16a34a',
                    background: 'rgba(22,163,74,0.1)', padding: '5px 9px', borderRadius: '7px',
                    display: 'inline-flex', alignItems: 'center', gap: '4px'
                  }}>
                    <CheckCircle2 size={13} /> Entrada: {reg.hora_entrada}
                  </span>
                ) : (
                  <button
                    onClick={() => marcarAsistencia(emp.id, 'entrada')}
                    disabled={procesandoId === `${emp.id}-entrada`}
                    style={{
                      padding: '6px 14px', borderRadius: '7px', border: 'none',
                      background: '#16a34a', color: '#fff', fontSize: '13.5px',
                      fontWeight: '800', cursor: 'pointer'
                    }}
                  >
                    {procesandoId === `${emp.id}-entrada` ? '...' : 'Marcar Entrada'}
                  </button>
                )}

                {tieneEntrada && (
                  tieneSalida ? (
                    <span style={{
                      fontSize: '13px', fontWeight: '800', color: '#0284c7',
                      background: 'rgba(2,132,199,0.1)', padding: '5px 9px', borderRadius: '7px'
                    }}>
                      Salida: {reg.hora_salida}
                    </span>
                  ) : (
                    <button
                      onClick={() => marcarAsistencia(emp.id, 'salida')}
                      disabled={procesandoId === `${emp.id}-salida`}
                      style={{
                        padding: '6px 13px', borderRadius: '7px', border: `1px solid ${theme.border}`,
                        background: 'transparent', color: theme.text, fontSize: '13.5px',
                        fontWeight: '700', cursor: 'pointer'
                      }}
                    >
                      {procesandoId === `${emp.id}-salida` ? '...' : 'Marcar Salida'}
                    </button>
                  )
                )}
              </div>
            </div>
          );
        })}

        {personalFiltrado.length === 0 && (
          <div style={{ padding: '24px', textAlign: 'center', color: theme.textMuted, fontSize: '15px' }}>
            No se encontraron coincidencias.
          </div>
        )}
      </div>
    );
  }

  if (tabActiva === 'consulta') {
    return (
      <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: '14px', overflow: 'hidden' }}>
        {personalFiltrado.map((emp) => {
          const reg = mapaAsistencias[emp.id];
          const asistio = Boolean(reg?.hora_entrada || reg?.hora_salida);

          return (
            <div
              key={emp.id}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: '12px', padding: '12px 16px', borderBottom: `1px solid ${theme.border}`,
                flexWrap: 'wrap'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 200px' }}>
                <BadgeNomina numero={emp.numero_empleado} />
                <span style={{ fontSize: '15px', fontWeight: '800', color: theme.text }}>
                  {emp.nombre_completo}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', fontWeight: '800' }}>
                {asistio ? (
                  <>
                    <span style={{ color: '#16a34a', background: 'rgba(22,163,74,0.1)', padding: '4px 8px', borderRadius: '6px' }}>
                      Asistió • Entrada: {reg.hora_entrada || '--:--'}
                    </span>
                    {reg.hora_salida && (
                      <span style={{ color: '#0284c7', background: 'rgba(2,132,199,0.1)', padding: '4px 8px', borderRadius: '6px' }}>
                        Salida: {reg.hora_salida}
                      </span>
                    )}
                  </>
                ) : (
                  <span style={{ color: theme.textMuted, background: '#f1f5f9', padding: '4px 8px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={12} /> Sin registro
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return null;
}
