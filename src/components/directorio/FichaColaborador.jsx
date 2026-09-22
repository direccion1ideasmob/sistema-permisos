import React, { useRef } from 'react';
import { Camera, Key, UserX, UserCheck, Briefcase, ShieldCheck, Mail, Phone, Calendar } from 'lucide-react';

export default function FichaColaborador({ 
  user, estaEditando, datosEdit, setDatosEdit, 
  departamentos, sedes, subiendoFoto, onCambiarFoto, 
  onRestablecerPin, onAbrirBaja, onReactivar, c 
}) {
  const fileInputRef = useRef(null);
  const urlFoto = datosEdit.foto_url || user.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.nombre_completo)}&background=16a34a&color=fff&bold=true`;
  const sedeNombre = sedes.find(s => s.id === user.sede_id)?.nombre || 'Sin Sede Asignada';

  return (
    <div style={{ padding: '24px', background: c.surface, borderBottom: `1px solid ${c.border}` }}>
      
      {/* 1. ENCABEZADO DEL EXPEDIENTE */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', paddingBottom: '16px', borderBottom: `1px solid ${c.borderDivider}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          
          {/* FOTO CON TRIGGER DE CÁMARA */}
          <div style={{ position: 'relative', width: '56px', height: '56px', borderRadius: '12px', overflow: 'hidden', border: `1px solid ${c.border}`, flexShrink: 0 }}>
            <img src={urlFoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            {estaEditando && (
              <label style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Camera size={18} color="#ffffff" />
                <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={onCambiarFoto} />
              </label>
            )}
          </div>

          <div>
            <div style={{ fontSize: '15px', fontWeight: '600', color: c.text }}>
              {estaEditando ? 'Editando expediente' : user.nombre_completo}
            </div>
            <div style={{ fontSize: '12px', color: c.textMuted, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="mono-id">#{user.numero_empleado}</span>
              <span>•</span>
              <span>{sedeNombre}</span>
              <span>•</span>
              <span style={{ textTransform: 'capitalize' }}>{user.tipo_personal}</span>
            </div>
            {subiendoFoto && <span style={{ fontSize: '11px', color: c.accent }}>Comprimiendo y subiendo foto...</span>}
          </div>
        </div>

        {/* ESTATUS EN ENCABEZADO */}
        <div>
          {user.activo ? (
            <span style={{ fontSize: '12px', fontWeight: '500', color: c.accent, background: c.accentSoft, padding: '4px 10px', borderRadius: '6px' }}>
              ● Activo en nómina
            </span>
          ) : (
            <span style={{ fontSize: '12px', fontWeight: '500', color: c.danger, background: c.dangerSoft, padding: '4px 10px', borderRadius: '6px' }}>
              ● Baja laboral
            </span>
          )}
        </div>
      </div>

      {/* 2. CUERPO: MODO LECTURA O MODO EDICIÓN */}
      {estaEditando ? (
        /* === MODO EDICIÓN AMPLIO Y ORDENADO === */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <div className="form-field-group">
            <label className="form-field-label">Nº de Empleado</label>
            <input className="form-field-input" value={datosEdit.numero_empleado} onChange={e => setDatosEdit({...datosEdit, numero_empleado: e.target.value})} />
          </div>
          <div className="form-field-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-field-label">Nombre Completo</label>
            <input className="form-field-input" value={datosEdit.nombre_completo} onChange={e => setDatosEdit({...datosEdit, nombre_completo: e.target.value})} />
          </div>
          <div className="form-field-group">
            <label className="form-field-label">Sede / Región</label>
            <select className="form-field-input" value={datosEdit.sede_id} onChange={e => setDatosEdit({...datosEdit, sede_id: e.target.value})}>
              <option value="">Sin Sede</option>
              {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>
          <div className="form-field-group">
            <label className="form-field-label">Departamento</label>
            <select className="form-field-input" value={datosEdit.departamento_id} onChange={e => setDatosEdit({...datosEdit, departamento_id: e.target.value})}>
              <option value="">Sin Departamento</option>
              {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
            </select>
          </div>
          <div className="form-field-group">
            <label className="form-field-label">Área Física</label>
            <input className="form-field-input" value={datosEdit.area} onChange={e => setDatosEdit({...datosEdit, area: e.target.value})} />
          </div>
          <div className="form-field-group">
            <label className="form-field-label">Puesto</label>
            <input className="form-field-input" value={datosEdit.puesto} onChange={e => setDatosEdit({...datosEdit, puesto: e.target.value})} />
          </div>
          <div className="form-field-group">
            <label className="form-field-label">Tipo de Nómina</label>
            <select className="form-field-input" value={datosEdit.tipo_personal} onChange={e => setDatosEdit({...datosEdit, tipo_personal: e.target.value})}>
              <option value="produccion">Producción</option>
              <option value="administrativo">Administrativo</option>
              <option value="obra">Obra</option>
            </select>
          </div>
          <div className="form-field-group">
            <label className="form-field-label">Rol en el Sistema</label>
            <select className="form-field-input" value={datosEdit.rol} onChange={e => setDatosEdit({...datosEdit, rol: e.target.value})}>
              <option value="empleado">Empleado</option>
              <option value="encargado">Encargado (Sub-jefe)</option>
              <option value="jefe_area">Jefe de Área</option>
              <option value="gerente">Gerente</option>
              <option value="rh_nominas">RH / Nóminas</option>
              <option value="caseta">Caseta</option>
            </select>
          </div>
          <div className="form-field-group">
            <label className="form-field-label">Teléfono Celular</label>
            <input className="form-field-input" value={datosEdit.celular} onChange={e => setDatosEdit({...datosEdit, celular: e.target.value})} />
          </div>
          <div className="form-field-group">
            <label className="form-field-label">Correo Institucional</label>
            <input className="form-field-input" value={datosEdit.correo} onChange={e => setDatosEdit({...datosEdit, correo: e.target.value})} />
          </div>
          <div className="form-field-group">
            <label className="form-field-label">Usuario Login</label>
            <input className="form-field-input" value={datosEdit.usuario_login} onChange={e => setDatosEdit({...datosEdit, usuario_login: e.target.value})} />
          </div>
          <div className="form-field-group">
            <label className="form-field-label">PIN de Acceso</label>
            <input className="form-field-input mono-id" value={datosEdit.pin} onChange={e => setDatosEdit({...datosEdit, pin: e.target.value})} />
          </div>
          <div className="form-field-group">
            <label className="form-field-label">Fecha de Ingreso</label>
            <input type="date" className="form-field-input" value={datosEdit.fecha_ingreso} onChange={e => setDatosEdit({...datosEdit, fecha_ingreso: e.target.value})} />
          </div>
        </div>
      ) : (
        /* === MODO LECTURA: 2 BLOQUES SEPARADOS CON ESTILO SAAS === */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          
          {/* BLOQUE 1: ESTRUCTURA LABORAL Y BAJA */}
          <div style={{ background: c.surfaceElevated, border: `1px solid ${c.border}`, borderRadius: '10px', padding: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: c.accent, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Briefcase size={14} /> Estructura de Trabajo & Nómina
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: c.textMuted }}>Departamento:</span>
                <span style={{ fontWeight: '500' }}>{user.departamentos?.nombre || 'No asignado'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: c.textMuted }}>Área Física:</span>
                <span style={{ fontWeight: '500' }}>{user.area || 'General'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: c.textMuted }}>Puesto:</span>
                <span style={{ fontWeight: '500' }}>{user.puesto || 'Sin puesto'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: c.textMuted }}>Fecha de Ingreso:</span>
                <span style={{ fontWeight: '500' }}>{user.fecha_ingreso || 'No registrada'}</span>
              </div>

              {/* GESTIÓN DE BAJA INDEPENDIENTE */}
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${c.borderDivider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '11px', color: c.textSubtle }}>Condición Laboral:</div>
                  {!user.activo && (
                    <div style={{ fontSize: '11.5px', color: c.danger, marginTop: '2px' }}>
                      Baja el {user.fecha_baja} ({user.motivo_baja})
                    </div>
                  )}
                </div>

                {user.activo ? (
                  <button 
                    onClick={() => onAbrirBaja(user)}
                    style={{
                      padding: '6px 12px', borderRadius: '6px', border: `1px solid ${c.dangerSoft}`,
                      background: c.dangerSoft, color: c.danger, fontSize: '12px', fontWeight: '500',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                    }}
                  >
                    <UserX size={13} /> Tramitar Baja
                  </button>
                ) : (
                  <button 
                    onClick={() => onReactivar(user)}
                    style={{
                      padding: '6px 12px', borderRadius: '6px', border: `1px solid ${c.accentSoft}`,
                      background: c.accentSoft, color: c.accent, fontSize: '12px', fontWeight: '500',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                    }}
                  >
                    <UserCheck size={13} /> Reactivar
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* BLOQUE 2: CONTACTO Y SEGURIDAD (SIN REVOLVER NADA) */}
          <div style={{ background: c.surfaceElevated, border: `1px solid ${c.border}`, borderRadius: '10px', padding: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: c.textMuted, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={14} /> Comunicación & Credenciales
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: c.textMuted }}>Celular:</span>
                <span style={{ fontWeight: '500' }}>{user.celular || 'No registrado'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: c.textMuted }}>Correo:</span>
                <span style={{ fontWeight: '500' }}>{user.correo || 'No registrado'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: c.textMuted }}>Usuario ERP:</span>
                <span style={{ fontWeight: '600', color: c.accent }}>@{user.usuario_login}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: c.textMuted }}>Rol en Sistema:</span>
                <span style={{ textTransform: 'capitalize', fontWeight: '500' }}>{user.rol?.replace('_', ' ')}</span>
              </div>

              {/* GESTIÓN EXCLUSIVA DEL PIN */}
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${c.borderDivider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '11px', color: c.textSubtle }}>Clave de Acceso:</div>
                  <div style={{ fontSize: '12px', letterSpacing: '2px', color: c.textMuted }}>••••••</div>
                </div>

                <button 
                  onClick={() => onRestablecerPin(user.id, user.nombre_completo)}
                  style={{
                    padding: '6px 12px', borderRadius: '6px', border: `1px solid ${c.border}`,
                    background: 'transparent', color: c.text, fontSize: '12px', fontWeight: '500',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <Key size={13} /> Cambiar PIN
                </button>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}