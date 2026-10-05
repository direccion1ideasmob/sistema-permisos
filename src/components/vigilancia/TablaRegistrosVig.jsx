import React from 'react';
import { User, LogOut, LogIn, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

export default function TablaRegistrosVig({ pases, registrarMovimiento, procesandoId, theme }) {
  const porSalir = pases.filter(p => p.tipo_permiso === 'salida' && !p.hora_salida_caseta);
  const retardosEsperados = pases.filter(p => p.tipo_permiso === 'retardo' && !p.hora_llegada_caseta);
  const fueraDePlanta = pases.filter(p => p.tipo_permiso === 'salida' && p.hora_salida_caseta && p.observaciones?.includes('Regresa') && !p.hora_llegada_caseta);
  const completados = pases.filter(p => (p.tipo_permiso === 'retardo' && p.hora_llegada_caseta) || (p.tipo_permiso === 'salida' && p.hora_salida_caseta && !p.observaciones?.includes('Regresa')) || (p.tipo_permiso === 'salida' && p.hora_salida_caseta && p.hora_llegada_caseta));

  const formatearHora = (isoString) => isoString ? new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  const TarjetaEmpleado = ({ pase, accion, tipoAccion }) => {
    const usr = pase.usuarios || {};
    return (
      <div style={{ background: theme.surface, borderRadius: '12px', border: `1px solid ${theme.border}`, padding: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {usr.foto_url ? <img src={usr.foto_url} alt="foto" style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.textMuted }}><User size={20} /></div>}
            <div>
              <div style={{ fontWeight: '800', fontSize: '13px', color: theme.text, lineHeight: '1.2' }}>{usr.nombre_completo}</div>
              <div style={{ fontSize: '11px', color: theme.textMuted, marginTop: '2px' }}>{usr.departamentos?.nombre} • #{usr.numero_empleado}</div>
            </div>
          </div>
          {pase.creado_por_vigilancia ? (
             <span style={{ fontSize: '9px', fontWeight: '800', background: '#fee2e2', color: '#dc2626', padding: '4px 6px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={10}/> EMERGENCIA</span>
          ) : (
             <span style={{ fontSize: '10px', fontWeight: '800', background: '#f1f5f9', color: '#475569', padding: '4px 8px', borderRadius: '4px' }}>{pase.folio || 'N/A'}</span>
          )}
        </div>
        
        {!pase.creado_por_vigilancia && (
          <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', fontSize: '11.5px', color: theme.text, display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Clock size={14} color={theme.textMuted} />
            <span dangerouslySetInnerHTML={{ __html: pase.observaciones?.split('\n')[0] || 'Sin horario definido' }} />
          </div>
        )}

        {accion && (
          <button onClick={() => accion(pase.id, tipoAccion)} disabled={procesandoId === pase.id} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', background: tipoAccion === 'salida' ? '#ef4444' : '#16a34a', color: '#fff', fontSize: '12px', fontWeight: '800', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', opacity: procesandoId === pase.id ? 0.7 : 1 }}>
            {tipoAccion === 'salida' ? <LogOut size={16} /> : <LogIn size={16} />}
            {procesandoId === pase.id ? 'Registrando...' : tipoAccion === 'salida' ? 'REGISTRAR SALIDA' : 'REGISTRAR LLEGADA'}
          </button>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', alignItems: 'start' }}>
      {/* Columna 1 */}
      <div>
        <h2 style={{ fontSize: '12px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>Acciones Pendientes <span style={{ background: '#e2e8f0', padding: '2px 8px', borderRadius: '12px', color: '#0f172a' }}>{porSalir.length + retardosEsperados.length}</span></h2>
        {porSalir.map(p => <TarjetaEmpleado key={p.id} pase={p} accion={registrarMovimiento} tipoAccion="salida" />)}
        {retardosEsperados.map(p => <TarjetaEmpleado key={p.id} pase={p} accion={registrarMovimiento} tipoAccion="llegada" />)}
        {(porSalir.length === 0 && retardosEsperados.length === 0) && <div style={{ textAlign: 'center', padding: '30px', color: theme.textMuted, fontSize: '12px', border: `1px dashed ${theme.border}`, borderRadius: '12px' }}>Pizarra limpia.</div>}
      </div>

      {/* Columna 2 */}
      <div>
        <h2 style={{ fontSize: '12px', fontWeight: '800', color: '#eab308', textTransform: 'uppercase', marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>Fuera de Planta <span style={{ background: '#fef08a', padding: '2px 8px', borderRadius: '12px', color: '#854d0e' }}>{fueraDePlanta.length}</span></h2>
        {fueraDePlanta.map(p => <TarjetaEmpleado key={p.id} pase={p} accion={registrarMovimiento} tipoAccion="llegada" />)}
        {fueraDePlanta.length === 0 && <div style={{ textAlign: 'center', padding: '30px', color: theme.textMuted, fontSize: '12px', border: `1px dashed ${theme.border}`, borderRadius: '12px' }}>Nadie afuera.</div>}
      </div>

      {/* Columna 3 */}
      <div>
        <h2 style={{ fontSize: '12px', fontWeight: '800', color: '#16a34a', textTransform: 'uppercase', marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>Completados Hoy <span style={{ background: '#dcfce3', padding: '2px 8px', borderRadius: '12px', color: '#14532d' }}>{completados.length}</span></h2>
        {completados.map(p => (
          <div key={p.id} style={{ background: theme.surface, borderRadius: '12px', border: `1px solid ${theme.border}`, padding: '12px 16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '12px', opacity: 0.8 }}>
            <CheckCircle size={20} color="#16a34a" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: '700', fontSize: '12px', color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.usuarios?.nombre_completo}</div>
              <div style={{ fontSize: '11px', color: theme.textMuted }}>{p.tipo_permiso === 'retardo' ? `Llegó: ${formatearHora(p.hora_llegada_caseta)}` : `Salió: ${formatearHora(p.hora_salida_caseta)}`}</div>
            </div>
          </div>
        ))}
        {completados.length === 0 && <div style={{ textAlign: 'center', padding: '30px', color: theme.textMuted, fontSize: '12px', border: `1px dashed ${theme.border}`, borderRadius: '12px' }}>Sin registros aún.</div>}
      </div>
    </div>
  );
}