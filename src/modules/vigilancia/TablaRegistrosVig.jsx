import React from 'react';
import { LogOut, LogIn, CheckCircle2, Clock } from 'lucide-react';

export default function TablaRegistrosVig({
  tabActiva,
  pasesPorCruzar,
  personalFuera,
  crucesCompletadosHoy,
  empleadosSede,
  mapaAsistencias,
  busquedaTexto,
  registrarMovimientoPase,
  marcarAsistencia,
  procesandoId,
  theme
}) {

  // Renglón compacto sin foto y sin departamento: solo #Empleado + Nombre Completo
  const BadgeNomina = ({ numero }) => (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: '46px', padding: '4px 7px', borderRadius: '7px',
      background: '#f1f5f9', color: '#0f172a', fontWeight: '900',
      fontSize: '11.5px', fontFamily: 'monospace', flexShrink: 0
    }}>
      #{numero || 'S/N'}
    </span>
  );

  // ==========================================================
  // PESTAÑA 1: PASES AUTORIZADOS EN PUERTA (SALIDAS / RETARDOS)
  // ==========================================================
  if (tabActiva === 'pases') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* 1. AUTORIZADOS POR CRUZAR */}
        <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '11px 14px', borderBottom: `1px solid ${theme.border}`, fontSize: '12px', fontWeight: '900', color: theme.text, display: 'flex', justifyContent: 'space-between' }}>
            <span>PASES AUTORIZADOS LISTOS PARA CRUZAR</span>
            <span style={{ color: theme.accent }}>{pasesPorCruzar.length}</span>
          </div>

          {pasesPorCruzar.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: theme.textMuted, fontSize: '12.5px', fontWeight: '600' }}>
              No hay pases pendientes de salida o entrada en este momento.
            </div>
          ) : (
            pasesPorCruzar.map((p) => {
              const esSalida = p.tipo_permiso === 'salida';
              return (
                <div
                  key={p.id}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: '10px', padding: '11px 14px', borderBottom: `1px solid ${theme.border}`,
                    flexWrap: 'wrap'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '200px', flex: '1 1 220px' }}>
                    <BadgeNomina numero={p.usuarios?.numero_empleado} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '13.5px', fontWeight: '800', color: theme.text }}>
                        {p.usuarios?.nombre_completo}
                      </div>
                      <div style={{ fontSize: '11.5px', color: theme.textMuted, fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                        <span style={{
                          fontSize: '10px', fontWeight: '800', padding: '1px 6px', borderRadius: '4px',
                          background: esSalida ? 'rgba(14,165,233,0.12)' : 'rgba(22,163,74,0.12)',
                          color: esSalida ? '#0284c7' : '#16a34a', textTransform: 'uppercase'
                        }}>
                          {esSalida ? 'Salida Autorizada' : 'Entrada Autorizada'}
                        </span>
                        <span>•</span>
                        <span>{p.horarioProgramado}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => registrarMovimientoPase(p.id, esSalida ? 'salida' : 'entrada')}
                    disabled={procesandoId === p.id}
                    style={{
                      padding: '8px 14px', borderRadius: '8px', border: 'none',
                      background: esSalida ? '#0284c7' : '#16a34a', color: '#fff',
                      fontSize: '12px', fontWeight: '800', cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: '6px', marginLeft: 'auto'
                    }}
                  >
                    {esSalida ? <LogOut size={14} /> : <LogIn size={14} />}
                    {procesandoId === p.id ? 'Sellando...' : (esSalida ? 'Sellar Salida' : 'Sellar Entrada')}
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* 2. PENDIENTES DE REINGRESO HOY */}
        {personalFuera.length > 0 && (
          <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '11px 14px', borderBottom: `1px solid ${theme.border}`, fontSize: '12px', fontWeight: '900', color: '#2563eb', display: 'flex', justifyContent: 'space-between' }}>
              <span>PENDIENTES DE REINGRESO A PLANTA</span>
              <span>{personalFuera.length}</span>
            </div>

            {personalFuera.map((p) => (
              <div
                key={p.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: '10px', padding: '11px 14px', borderBottom: `1px solid ${theme.border}`,
                  flexWrap: 'wrap'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 220px' }}>
                  <BadgeNomina numero={p.usuarios?.numero_empleado} />
                  <div>
                    <div style={{ fontSize: '13.5px', fontWeight: '800', color: theme.text }}>
                      {p.usuarios?.nombre_completo}
                    </div>
                    <div style={{ fontSize: '11.5px', color: theme.textMuted, fontWeight: '600' }}>
                      Salió: {p.horaSalidaCaseta}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => registrarMovimientoPase(p.id, 'reingreso')}
                  disabled={procesandoId === p.id}
                  style={{
                    padding: '8px 14px', borderRadius: '8px', border: 'none',
                    background: '#2563eb', color: '#fff', fontSize: '12px', fontWeight: '800',
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
          <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: `1px solid ${theme.border}`, fontSize: '11.5px', fontWeight: '800', color: theme.textMuted }}>
              CRUCES CON PASE REGISTRADOS HOY ({crucesCompletadosHoy.length})
            </div>
            {crucesCompletadosHoy.map((p) => (
              <div
                key={p.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: '10px', padding: '9px 14px', borderBottom: `1px solid ${theme.border}`,
                  fontSize: '12.5px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BadgeNomina numero={p.usuarios?.numero_empleado} />
                  <span style={{ fontWeight: '700', color: theme.text }}>{p.usuarios?.nombre_completo}</span>
                </div>
                <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#16a34a' }}>
                  {p.horaSalidaCaseta && `Salida: ${p.horaSalidaCaseta}`}
                  {p.horaSalidaCaseta && p.horaEntradaCaseta && ' • '}
                  {p.horaEntradaCaseta && `Entrada: ${p.horaEntradaCaseta}`}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Filtrar lista de personal por # de empleado o nombre
  const termino = (busquedaTexto || '').toLowerCase().trim();
  const personalFiltrado = empleadosSede.filter(emp => {
    if (!termino) return true;
    return (
      (emp.nombre_completo || '').toLowerCase().includes(termino) ||
      String(emp.numero_empleado || '').toLowerCase().includes(termino)
    );
  });

  // ==========================================================
  // PESTAÑA 2: PASE DE LISTA DIARIO (SELLAR ENTRADA / SALIDA)
  // ==========================================================
  if (tabActiva === 'lista') {
    return (
      <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: '12px', overflow: 'hidden' }}>
        {personalFiltrado.map((emp) => {
          const reg = mapaAsistencias[emp.id];
          const tieneEntrada = Boolean(reg?.hora_entrada);
          const tieneSalida = Boolean(reg?.hora_salida);

          return (
            <div
              key={emp.id}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: '10px', padding: '10px 14px', borderBottom: `1px solid ${theme.border}`,
                flexWrap: 'wrap'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 200px', minWidth: 0 }}>
                <BadgeNomina numero={emp.numero_empleado} />
                <div style={{ fontSize: '13px', fontWeight: '800', color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {emp.nombre_completo}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
                {tieneEntrada ? (
                  <span style={{
                    fontSize: '11px', fontWeight: '800', color: '#16a34a',
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
                      padding: '6px 12px', borderRadius: '7px', border: 'none',
                      background: '#16a34a', color: '#fff', fontSize: '11.5px',
                      fontWeight: '800', cursor: 'pointer'
                    }}
                  >
                    {procesandoId === `${emp.id}-entrada` ? '...' : 'Marcar Entrada'}
                  </button>
                )}

                {tieneEntrada && (
                  tieneSalida ? (
                    <span style={{
                      fontSize: '11px', fontWeight: '800', color: '#0284c7',
                      background: 'rgba(2,132,199,0.1)', padding: '5px 9px', borderRadius: '7px'
                    }}>
                      Salida: {reg.hora_salida}
                    </span>
                  ) : (
                    <button
                      onClick={() => marcarAsistencia(emp.id, 'salida')}
                      disabled={procesandoId === `${emp.id}-salida`}
                      style={{
                        padding: '6px 11px', borderRadius: '7px', border: `1px solid ${theme.border}`,
                        background: 'transparent', color: theme.text, fontSize: '11.5px',
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
          <div style={{ padding: '24px', textAlign: 'center', color: theme.textMuted, fontSize: '13px' }}>
            No se encontraron coincidencias.
          </div>
        )}
      </div>
    );
  }

  // ==========================================================
  // PESTAÑA 3: CONSULTA DE ASISTENCIA (SOLO SI VINO Y A QUÉ HORA)
  // ==========================================================
  if (tabActiva === 'consulta') {
    return (
      <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: '12px', overflow: 'hidden' }}>
        {personalFiltrado.map((emp) => {
          const reg = mapaAsistencias[emp.id];
          const asistio = Boolean(reg?.hora_entrada || reg?.hora_salida);

          return (
            <div
              key={emp.id}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: '10px', padding: '10px 14px', borderBottom: `1px solid ${theme.border}`,
                flexWrap: 'wrap'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 200px' }}>
                <BadgeNomina numero={emp.numero_empleado} />
                <span style={{ fontSize: '13px', fontWeight: '800', color: theme.text }}>
                  {emp.nombre_completo}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11.5px', fontWeight: '800' }}>
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
