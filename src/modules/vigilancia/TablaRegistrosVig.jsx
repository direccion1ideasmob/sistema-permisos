import React from 'react';
import { LogOut, LogIn, CheckCircle, Clock, ShieldX } from 'lucide-react';

export default function TablaRegistrosVig({ 
  tabActiva, pasesAutorizados, pasesEnEspera, pasesRechazados, 
  personalFuera, faltasProgramadas, completados, 
  registrarMovimiento, procesandoId, theme 
}) {

  const TarjetaPase = ({ pase, accion, tipoAccion, color, icono: Icono, textoBoton }) => {
    const usr = pase.usuarios || {};
    const urlFoto = usr.foto_url || `https://ui-avatars.com/api/?name=\${encodeURIComponent(usr.nombre_completo || 'U')}&background=16a34a&color=fff&bold=true`;
    
    return (
      <div style={{ background: theme.surface, borderRadius: '12px', border: `2px solid \${color}`, padding: '16px', marginBottom: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
          <img src={urlFoto} alt="foto" style={{ width: '46px', height: '46px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: '900', fontSize: '14.5px', color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {usr.nombre_completo}
            </div>
            <div style={{ fontSize: '11.5px', color: theme.textMuted, fontWeight: '600' }}>
              {usr.departamentos?.nombre || usr.area || 'General'} • {usr.puesto || 'Colaborador'} • #{usr.numero_empleado}
            </div>
          </div>
          <span style={{ fontSize: '10.5px', fontWeight: '800', background: '#f1f5f9', color: '#0f172a', padding: '4px 8px', borderRadius: '6px', fontFamily: 'monospace' }}>
            {pase.folio}
          </span>
        </div>
        
        <div style={{ background: '#f8fafc', padding: '11px 12px', borderRadius: '8px', fontSize: '12.5px', color: '#0f172a', fontWeight: '600', display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
          <Clock size={16} color={color} style={{ flexShrink: 0 }} />
          <span>{pase.horarioLimpio || 'Horario autorizado'}</span>
        </div>

        {accion && (
          <button 
            onClick={() => accion(pase.id, tipoAccion)} 
            disabled={procesandoId === pase.id} 
            style={{ 
              width: '100%', padding: '13px', borderRadius: '8px', border: 'none', 
              background: color, color: '#fff', fontSize: '13.5px', fontWeight: '900', 
              cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
              opacity: procesandoId === pase.id ? 0.7 : 1
            }}
          >
            <Icono size={19} />
            {procesandoId === pase.id ? 'REGISTRANDO...' : textoBoton}
          </button>
        )}
      </div>
    );
  };

  // ==========================================
  // PESTAÑA 1: CONTROL EN VIVO (TORNIQUETE)
  // ==========================================
  if (tabActiva === 'en_vivo') {
    const salidasPendientes = pasesAutorizados.filter(p => (p.tipo_permiso || '').toLowerCase() === 'salida');
    const entradasPendientes = pasesAutorizados.filter(p => (p.tipo_permiso || '').toLowerCase() === 'retardo');

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', alignItems: 'start' }}>
        
        {/* COLUMNA 1: LUZ VERDE (DAR PASO) */}
        <div>
          <h2 style={{ fontSize: '13.5px', fontWeight: '900', color: '#16a34a', textTransform: 'uppercase', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#16a34a', display: 'inline-block' }}></span>
            Luz Verde - Autorizados ({salidasPendientes.length + entradasPendientes.length})
          </h2>
          {salidasPendientes.map(p => <TarjetaPase key={p.id} pase={p} accion={registrarMovimiento} tipoAccion="salida" color="#ef4444" icono={LogOut} textoBoton="SELLAR SALIDA DE PLANTA" />)}
          {entradasPendientes.map(p => <TarjetaPase key={p.id} pase={p} accion={registrarMovimiento} tipoAccion="llegada" color="#16a34a" icono={LogIn} textoBoton="SELLAR ENTRADA A PLANTA" />)}
          
          {(salidasPendientes.length === 0 && entradasPendientes.length === 0) && (
            <div style={{ padding: '28px', textAlign: 'center', border: '2px dashed #bbf7d0', borderRadius: '12px', color: '#16a34a', fontWeight: '700', fontSize: '13px' }}>
              No hay pases autorizados pendientes de cruzar.
            </div>
          )}
        </div>

        {/* COLUMNA 2: ESPERANDO EN PUERTA */}
        <div>
          <h2 style={{ fontSize: '13.5px', fontWeight: '900', color: '#d97706', textTransform: 'uppercase', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#d97706', display: 'inline-block' }}></span>
            En Espera de Firmas ({pasesEnEspera.length})
          </h2>
          {pasesEnEspera.map(p => (
            <div key={p.id} style={{ background: '#fffbeb', borderRadius: '12px', border: '2px solid #fde047', padding: '16px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <div style={{ fontWeight: '900', fontSize: '14.5px', color: '#713f12' }}>{p.usuarios?.nombre_completo}</div>
                <span style={{ fontSize: '10px', fontWeight: '800', background: '#fef08a', color: '#854d0e', padding: '2px 7px', borderRadius: '5px', textTransform: 'uppercase' }}>
                  {p.tipo_permiso}
                </span>
              </div>
              <div style={{ fontSize: '11.5px', color: '#92400e', fontWeight: '600', marginBottom: '8px' }}>
                {p.usuarios?.departamentos?.nombre || p.usuarios?.area || 'General'} • #{p.usuarios?.numero_empleado}
              </div>
              <div style={{ fontSize: '12.5px', color: '#854d0e', marginBottom: '10px' }}>{p.horarioLimpio}</div>
              <div style={{ background: '#fef9c3', padding: '9px 11px', borderRadius: '8px', fontSize: '12px', fontWeight: '800', color: '#a16207', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={15} style={{ flexShrink: 0 }} />
                <span>Esperando firma de: {p.nivelEspera}</span>
              </div>
            </div>
          ))}
          {pasesEnEspera.length === 0 && (
            <div style={{ padding: '28px', textAlign: 'center', border: '2px dashed #fef08a', borderRadius: '12px', color: '#ca8a04', fontWeight: '700', fontSize: '13px' }}>
              Nadie en espera de autorización.
            </div>
          )}
        </div>

        {/* COLUMNA 3: ACCESO DENEGADO */}
        <div>
          <h2 style={{ fontSize: '13.5px', fontWeight: '900', color: '#dc2626', textTransform: 'uppercase', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#dc2626', display: 'inline-block' }}></span>
            Accesos Denegados ({pasesRechazados.length})
          </h2>
          {pasesRechazados.map(p => (
            <div key={p.id} style={{ background: '#fef2f2', borderRadius: '12px', border: '2px solid #fca5a5', padding: '16px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#991b1b', fontWeight: '900', fontSize: '12.5px', marginBottom: '6px' }}>
                <ShieldX size={18} /> PASE RECHAZADO ({p.tipo_permiso?.toUpperCase()})
              </div>
              <div style={{ fontWeight: '800', fontSize: '14px', color: '#7f1d1d' }}>{p.usuarios?.nombre_completo}</div>
              <div style={{ fontSize: '11.5px', color: '#991b1b', marginTop: '2px' }}>{p.usuarios?.departamentos?.nombre} • #{p.usuarios?.numero_empleado}</div>
              <div style={{ marginTop: '10px', background: '#fee2e2', padding: '9px', borderRadius: '8px', fontSize: '12px', color: '#991b1b', fontWeight: '800', textAlign: 'center' }}>
                🚫 NO AUTORIZADO PARA CRUZAR
              </div>
            </div>
          ))}
          {pasesRechazados.length === 0 && (
            <div style={{ padding: '28px', textAlign: 'center', border: '2px dashed #fecaca', borderRadius: '12px', color: '#dc2626', fontWeight: '700', fontSize: '13px' }}>
              Sin incidentes de rechazo hoy.
            </div>
          )}
        </div>

      </div>
    );
  }

  // ==========================================
  // PESTAÑA 2: FUERA DE PLANTA (REINGRESOS)
  // ==========================================
  if (tabActiva === 'fuera_planta') {
    return (
      <div style={{ maxWidth: '620px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: '900', color: '#1e3a8a', marginBottom: '16px' }}>
          Colaboradores actualmente fuera de planta con regreso programado:
        </h2>
        {personalFuera.map(p => (
          <TarjetaPase key={p.id} pase={p} accion={registrarMovimiento} tipoAccion="llegada" color="#3b82f6" icono={LogIn} textoBoton="SELLAR REINGRESO A PLANTA" />
        ))}
        {personalFuera.length === 0 && (
          <div style={{ padding: '36px', textAlign: 'center', border: '2px dashed #bfdbfe', borderRadius: '12px', color: '#2563eb', fontWeight: '800', fontSize: '13.5px' }}>
            Ningún colaborador pendiente de reingresar en este momento.
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // PESTAÑA 3: FALTAS Y CIERRE DE TURNO
  // ==========================================
  if (tabActiva === 'faltas') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        <div>
          <h2 style={{ fontSize: '15px', fontWeight: '900', color: theme.text, marginBottom: '16px' }}>
            Inasistencias y Vacaciones Vigentes Hoy ({faltasProgramadas.length}):
          </h2>
          {faltasProgramadas.map(p => (
            <div key={p.id} style={{ background: theme.surface, padding: '14px 16px', borderRadius: '12px', border: `1px solid \${theme.border}`, marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: '800', fontSize: '14px', color: theme.text }}>{p.usuarios?.nombre_completo}</div>
                <span style={{ fontSize: '10px', fontWeight: '800', padding: '2px 8px', borderRadius: '6px', background: '#f1f5f9', color: '#334155', textTransform: 'uppercase' }}>
                  {p.tipo_permiso} • {p.estado_general}
                </span>
              </div>
              <div style={{ fontSize: '11.5px', color: theme.textMuted, marginTop: '4px', fontWeight: '600' }}>
                {p.usuarios?.departamentos?.nombre || 'General'} • #{p.usuarios?.numero_empleado} • {p.fecha_permiso}{p.fecha_fin ? ` al \${p.fecha_fin}` : ''}
              </div>
            </div>
          ))}
          {faltasProgramadas.length === 0 && <div style={{ padding: '20px', color: theme.textMuted, fontSize: '13px' }}>Sin inasistencias ni vacaciones registradas para hoy.</div>}
        </div>

        <div>
          <h2 style={{ fontSize: '15px', fontWeight: '900', color: '#16a34a', marginBottom: '16px' }}>
            Movimientos Concluidos Hoy en Caseta ({completados.length}):
          </h2>
          {completados.map(p => (
            <div key={p.id} style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '12px 14px', background: theme.surface, borderRadius: '10px', border: `1px solid \${theme.border}`, marginBottom: '8px' }}>
              <CheckCircle size={18} color="#16a34a" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '800', fontSize: '13.5px', color: theme.text }}>
                  {p.usuarios?.nombre_completo} <span style={{ fontSize: '11px', color: theme.textMuted, fontWeight: '600' }}>({p.folio})</span>
                </div>
                <div style={{ fontSize: '11.5px', color: theme.textMuted, fontWeight: '600', marginTop: '2px' }}>
                  {p.horaSalidaCaseta && `Salió: \${p.horaSalidaCaseta} `}
                  {p.horaEntradaCaseta && `• Entró: \${p.horaEntradaCaseta}`}
                </div>
              </div>
            </div>
          ))}
          {completados.length === 0 && <div style={{ padding: '20px', color: theme.textMuted, fontSize: '13px' }}>Aún no se han sellado salidas o entradas hoy.</div>}
        </div>
      </div>
    );
  }

  return null;
}
