import React from 'react';
import { LogOut, LogIn, CheckCircle, Clock, AlertTriangle, ShieldX, UserMinus } from 'lucide-react';

export default function TablaRegistrosVig({ 
  tabActiva, pasesAutorizados, pasesEnEspera, pasesRechazados, 
  personalFuera, faltasProgramadas, completados, 
  registrarMovimiento, procesandoId, theme 
}) {

  const formatearHora = (isoString) => isoString ? new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  const TarjetaPase = ({ pase, accion, tipoAccion, color, icono: Icono, textoBoton }) => {
    const usr = pase.usuarios || {};
    const esSalida = tipoAccion === 'salida';
    
    return (
      <div style={{ background: theme.surface, borderRadius: '12px', border: `2px solid ${color}`, padding: '16px', marginBottom: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
          {usr.foto_url ? (
            <img src={usr.foto_url} alt="foto" style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icono size={24} color={theme.textMuted} />
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: '900', fontSize: '15px', color: theme.text }}>{usr.nombre_completo}</div>
            <div style={{ fontSize: '12px', color: theme.textMuted }}>{usr.departamentos?.nombre || 'Sin Depto'} • #{usr.numero_empleado}</div>
          </div>
          <span style={{ fontSize: '10px', fontWeight: '800', background: '#f1f5f9', padding: '4px 8px', borderRadius: '6px' }}>{pase.folio}</span>
        </div>
        
        <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', fontSize: '13px', color: theme.text, display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '12px' }}>
          <Clock size={16} color={theme.textMuted} style={{ marginTop: '2px' }} />
          <div dangerouslySetInnerHTML={{ __html: pase.observaciones?.replace(/\n/g, '<br/>') || 'Sin horario definido' }} />
        </div>

        {accion && (
          <button 
            onClick={() => accion(pase.id, tipoAccion)} 
            disabled={procesandoId === pase.id} 
            style={{ 
              width: '100%', padding: '14px', borderRadius: '8px', border: 'none', 
              background: color, color: '#fff', fontSize: '14px', fontWeight: '900', 
              cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
              opacity: procesandoId === pase.id ? 0.7 : 1
            }}
          >
            <Icono size={20} />
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
    const salidasPendientes = pasesAutorizados.filter(p => p.tipo_permiso === 'salida');
    const entradasPendientes = pasesAutorizados.filter(p => p.tipo_permiso === 'retardo');

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', alignItems: 'start' }}>
        
        {/* COLUMNA 1: LUZ VERDE (DAR PASO) */}
        <div>
          <h2 style={{ fontSize: '14px', fontWeight: '900', color: '#16a34a', textTransform: 'uppercase', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#16a34a', display: 'inline-block' }}></span>
            Luz Verde - Autorizados ({salidasPendientes.length + entradasPendientes.length})
          </h2>
          {salidasPendientes.map(p => <TarjetaPase key={p.id} pase={p} accion={registrarMovimiento} tipoAccion="salida" color="#ef4444" icono={LogOut} textoBoton="REGISTRAR SALIDA" />)}
          {entradasPendientes.map(p => <TarjetaPase key={p.id} pase={p} accion={registrarMovimiento} tipoAccion="llegada" color="#16a34a" icono={LogIn} textoBoton="REGISTRAR ENTRADA" />)}
          
          {(salidasPendientes.length === 0 && entradasPendientes.length === 0) && (
            <div style={{ padding: '30px', textAlign: 'center', border: '2px dashed #bbf7d0', borderRadius: '12px', color: '#16a34a', fontWeight: '700' }}>No hay nadie con pase autorizado para cruzar.</div>
          )}
        </div>

        {/* COLUMNA 2: ESPERANDO EN PUERTA */}
        <div>
          <h2 style={{ fontSize: '14px', fontWeight: '900', color: '#d97706', textTransform: 'uppercase', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#d97706', display: 'inline-block' }}></span>
            En Espera de Dictamen ({pasesEnEspera.length})
          </h2>
          {pasesEnEspera.map(p => (
            <div key={p.id} style={{ background: '#fffbe3', borderRadius: '12px', border: '2px solid #fde047', padding: '16px', marginBottom: '16px' }}>
              <div style={{ fontWeight: '900', fontSize: '15px', color: '#713f12', marginBottom: '8px' }}>{p.usuarios?.nombre_completo}</div>
              <div style={{ fontSize: '13px', color: '#854d0e', marginBottom: '12px' }}>{p.observaciones}</div>
              <div style={{ background: '#fef9c3', padding: '10px', borderRadius: '8px', fontSize: '12px', fontWeight: '800', color: '#a16207', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={16} /> Falta firma de: {p.nivelEspera}
              </div>
            </div>
          ))}
          {pasesEnEspera.length === 0 && (
            <div style={{ padding: '30px', textAlign: 'center', border: '2px dashed #fef08a', borderRadius: '12px', color: '#ca8a04', fontWeight: '700' }}>Nadie esperando en puerta.</div>
          )}
        </div>

        {/* COLUMNA 3: ACCESO DENEGADO */}
        <div>
          <h2 style={{ fontSize: '14px', fontWeight: '900', color: '#dc2626', textTransform: 'uppercase', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#dc2626', display: 'inline-block' }}></span>
            Accesos Denegados ({pasesRechazados.length})
          </h2>
          {pasesRechazados.map(p => (
            <div key={p.id} style={{ background: '#fef2f2', borderRadius: '12px', border: '2px solid #fca5a5', padding: '16px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#991b1b', fontWeight: '900', fontSize: '13px', marginBottom: '8px' }}>
                <ShieldX size={20} /> RECHAZADO POR SISTEMA
              </div>
              <div style={{ fontWeight: '800', fontSize: '14px', color: '#7f1d1d' }}>{p.usuarios?.nombre_completo}</div>
              <div style={{ marginTop: '12px', background: '#fee2e2', padding: '10px', borderRadius: '8px', fontSize: '13px', color: '#991b1b', fontWeight: '800', textAlign: 'center' }}>
                🚫 RETIRAR DE PLANTA / REGRESAR A CASA
              </div>
            </div>
          ))}
          {pasesRechazados.length === 0 && (
            <div style={{ padding: '30px', textAlign: 'center', border: '2px dashed #fecaca', borderRadius: '12px', color: '#dc2626', fontWeight: '700' }}>Sin incidentes de rechazo.</div>
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
      <div style={{ maxWidth: '600px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: '900', color: '#1e3a8a', marginBottom: '20px' }}>Colaboradores que salieron y deben regresar hoy:</h2>
        {personalFuera.map(p => (
          <TarjetaPase key={p.id} pase={p} accion={registrarMovimiento} tipoAccion="llegada" color="#3b82f6" icono={LogIn} textoBoton="REGISTRAR REINGRESO A PLANTA" />
        ))}
        {personalFuera.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', border: '2px dashed #bfdbfe', borderRadius: '12px', color: '#2563eb', fontWeight: '800' }}>
            Todo el personal se encuentra dentro de planta.
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
        <div>
          <h2 style={{ fontSize: '15px', fontWeight: '900', color: theme.text, marginBottom: '20px' }}>Faltas Programadas y Vacaciones de Hoy:</h2>
          {faltasProgramadas.map(p => (
            <div key={p.id} style={{ background: theme.surface, padding: '16px', borderRadius: '12px', border: `1px solid ${theme.border}`, marginBottom: '12px' }}>
              <div style={{ fontWeight: '800', fontSize: '14px', color: theme.text }}>{p.usuarios?.nombre_completo}</div>
              <div style={{ fontSize: '12px', color: theme.textMuted, marginTop: '4px' }}>{p.tipo_permiso.toUpperCase()} • {p.asunto_motivo}</div>
            </div>
          ))}
          {faltasProgramadas.length === 0 && <div style={{ padding: '20px', color: theme.textMuted, fontSize: '13px' }}>Sin inasistencias programadas.</div>}
        </div>

        <div>
          <h2 style={{ fontSize: '15px', fontWeight: '900', color: '#64748b', marginBottom: '20px' }}>Historial Completados Hoy:</h2>
          {completados.slice(0, 15).map(p => (
            <div key={p.id} style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '12px', borderBottom: `1px solid ${theme.border}` }}>
              <CheckCircle size={18} color="#64748b" />
              <div>
                <div style={{ fontWeight: '700', fontSize: '13px', color: theme.text }}>{p.usuarios?.nombre_completo}</div>
                <div style={{ fontSize: '11px', color: theme.textMuted }}>{p.tipo_permiso === 'retardo' ? `Entró a las ${formatearHora(p.hora_llegada_caseta)}` : `Salió a las ${formatearHora(p.hora_salida_caseta)}`}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}