import React, { useRef } from 'react';
import { 
  X, Camera, Save, Briefcase, Phone, ShieldCheck, 
  Key, UserX, UserCheck, Mail, Calendar, MessageCircle, Eye
} from 'lucide-react';

export default function DossierLateral({
  colaborador, abierto, onClose, editando, datosEdit, setDatosEdit,
  departamentos = [], sedes = [], subiendoFoto, onCambiarFoto, onGuardar, guardando,
  onRestablecerPin, onAbrirBaja, onReactivar, setFotoZoom, c
}) {
  const fileInputRef = useRef(null);

  if (!colaborador || !abierto) return null;

  const urlFoto = (editando ? datosEdit.foto_url : colaborador.foto_url) || 
    `https://ui-avatars.com/api/?name=${encodeURIComponent(colaborador.nombre_completo)}&background=16a34a&color=fff&bold=true`;
  const sedeNombre = sedes.find(s => s.id === (editando ? datosEdit.sede_id : colaborador.sede_id))?.nombre || 'Sin Sede';

  // FUNCIÓN PARA VER FOTO COMPLETA
  const abrirFotoGrande = (e) => {
    if (e) e.stopPropagation();
    if (setFotoZoom) {
      setFotoZoom({
        url: urlFoto,
        nombre: colaborador.nombre_completo,
        puesto: colaborador.puesto
      });
    }
  };

  return (
    <div className="dossier-overlay" onClick={onClose}>
      <aside className="dossier-drawer" onClick={e => e.stopPropagation()}>
        
        {/* CABECERA */}
        <div style={{
          padding: '14px 18px', borderBottom: `1px solid ${c.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: c.surface, flexShrink: 0
        }}>
          <div>
            <div style={{ fontSize: '11.5px', fontWeight: '800', color: c.accent, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {editando ? 'Modo Edición Habilitado' : 'Expediente Corporativo'}
            </div>
            <div style={{ fontSize: '11px', color: c.textMuted }}>
              #{colaborador.numero_empleado} • {sedeNombre}
            </div>
          </div>

          <button 
            onClick={onClose} 
            style={{ background: 'transparent', border: 'none', color: c.textMuted, cursor: 'pointer', padding: '6px' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* CUERPO DEL EXPEDIENTE */}
        <div className="dossier-body-scroll">
          
          {/* HERO: FOTO Y NOMBRE */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '14px',
            padding: '14px', background: c.surfaceCard, border: `1px solid ${c.border}`,
            borderRadius: '12px'
          }}>
            <div style={{ position: 'relative', width: '64px', height: '64px', flexShrink: 0 }}>
              <img 
                src={urlFoto} alt="" 
                onClick={abrirFotoGrande}
                title="Toca para ver foto ampliada"
                style={{ 
                  width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', 
                  border: `2px solid ${c.accent}`, cursor: 'pointer'
                }} 
              />

              {editando && (
                <label 
                  style={{ 
                    position: 'absolute', bottom: 0, right: 0, 
                    width: '22px', height: '22px', borderRadius: '50%',
                    background: c.accent, display: 'flex', alignItems: 'center', 
                    justifyContent: 'center', cursor: 'pointer', border: '2px solid #fff'
                  }}
                  title="Cambiar fotografía"
                >
                  <Camera size={11} color="#fff" />
                  <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={onCambiarFoto} />
                </label>
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              {editando ? (
                <input 
                  type="text" 
                  value={datosEdit.nombre_completo}
                  onChange={e => setDatosEdit({ ...datosEdit, nombre_completo: e.target.value })}
                  className="touch-field-input"
                  placeholder="Nombre Completo"
                  style={{ fontWeight: '700' }}
                />
              ) : (
                <div style={{ fontSize: '15px', fontWeight: '800', color: c.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {colaborador.nombre_completo}
                </div>
              )}
              
              <div style={{ fontSize: '11.5px', color: c.textMuted, marginTop: '2px' }}>
                {colaborador.puesto || 'Sin puesto asignado'}
              </div>

              {/* BOTÓN EXPLÍCITO PARA VER FOTO */}
              <button 
                type="button" 
                onClick={abrirFotoGrande}
                style={{ background: 'none', border: 'none', color: c.accent, fontSize: '11px', cursor: 'pointer', padding: 0, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}
              >
                <Eye size={12} /> Ver foto completa
              </button>
              {subiendoFoto && <span style={{ fontSize: '10px', color: c.accent, display: 'block' }}>Actualizando foto en Supabase...</span>}
            </div>
          </div>

          {/* ACCIONES TÁCTILES RÁPIDAS (LLAMADA Y WHATSAPP) */}
          {!editando && colaborador.celular && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <a 
                href={`tel:${colaborador.celular}`}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  padding: '10px', borderRadius: '8px', background: c.surfaceCard, border: `1px solid ${c.border}`,
                  color: c.text, textDecoration: 'none', fontSize: '12px', fontWeight: '700'
                }}
              >
                <Phone size={14} color={c.accent} /> Llamar
              </a>
              <a 
                href={`https://wa.me/${colaborador.celular.replace(/\D/g, '')}`} 
                target="_blank" rel="noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  padding: '10px', borderRadius: '8px', background: 'rgba(37, 211, 102, 0.12)', border: '1px solid rgba(37, 211, 102, 0.25)',
                  color: '#25D366', textDecoration: 'none', fontSize: '12px', fontWeight: '700'
                }}
              >
                <MessageCircle size={14} /> WhatsApp
              </a>
            </div>
          )}

          {/* BLOQUE 1: ESTRUCTURA LABORAL */}
          <div style={{ background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '14px' }}>
            <div style={{ fontSize: '11px', fontWeight: '800', color: c.accent, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Briefcase size={13} /> 1. Estructura y Puesto
            </div>

            {editando ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
                <div>
                  <label className="touch-field-label">Nº Empleado</label>
                  <input className="touch-field-input mono-id" value={datosEdit.numero_empleado} onChange={e => setDatosEdit({ ...datosEdit, numero_empleado: e.target.value })} />
                </div>
                <div>
                  <label className="touch-field-label">Nómina</label>
                  <select className="touch-field-input" value={datosEdit.tipo_personal} onChange={e => setDatosEdit({ ...datosEdit, tipo_personal: e.target.value })}>
                    <option value="produccion">PRODUCCIÓN</option>
                    <option value="administrativo">ADMINISTRATIVO</option>
                    <option value="obra">OBRA</option>
                  </select>
                </div>
                <div>
                  <label className="touch-field-label">Sede</label>
                  <select className="touch-field-input" value={datosEdit.sede_id} onChange={e => setDatosEdit({ ...datosEdit, sede_id: e.target.value })}>
                    <option value="">Sin Sede</option>
                    {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="touch-field-label">Departamento</label>
                  <select className="touch-field-input" value={datosEdit.departamento_id} onChange={e => setDatosEdit({ ...datosEdit, departamento_id: e.target.value })}>
                    <option value="">Sin Depto</option>
                    {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="touch-field-label">Área Física</label>
                  <input className="touch-field-input" value={datosEdit.area} onChange={e => setDatosEdit({ ...datosEdit, area: e.target.value })} />
                </div>
                <div>
                  <label className="touch-field-label">Puesto Real</label>
                  <input className="touch-field-input" value={datosEdit.puesto} onChange={e => setDatosEdit({ ...datosEdit, puesto: e.target.value })} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="touch-field-label">Fecha de Ingreso</label>
                  <input type="date" className="touch-field-input" value={datosEdit.fecha_ingreso} onChange={e => setDatosEdit({ ...datosEdit, fecha_ingreso: e.target.value })} />
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                  <span style={{ color: c.textMuted }}>Departamento:</span>
                  <strong style={{ textAlign: 'right' }}>{colaborador.departamentos?.nombre || 'No asignado'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                  <span style={{ color: c.textMuted }}>Área Física:</span>
                  <strong style={{ textAlign: 'right' }}>{colaborador.area || 'General'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                  <span style={{ color: c.textMuted }}>Puesto:</span>
                  <strong style={{ textAlign: 'right' }}>{colaborador.puesto || 'Sin puesto'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: c.textMuted }}>Tipo de Nómina:</span>
                  <strong style={{ color: c.accent, textTransform: 'uppercase' }}>{colaborador.tipo_personal}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: c.textMuted }}>Fecha Alta:</span>
                  <span>{colaborador.fecha_ingreso || 'No registrada'}</span>
                </div>
              </div>
            )}
          </div>

          {/* BLOQUE 2: COMUNICACIÓN Y ACCESOS */}
          <div style={{ background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '14px' }}>
            <div style={{ fontSize: '11px', fontWeight: '800', color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={13} /> 2. Comunicación y Credenciales ERP
            </div>

            {editando ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <label className="touch-field-label">Teléfono Celular</label>
                  <input className="touch-field-input" value={datosEdit.celular} onChange={e => setDatosEdit({ ...datosEdit, celular: e.target.value })} />
                </div>
                <div>
                  <label className="touch-field-label">Teléfono Fijo</label>
                  <input className="touch-field-input" value={datosEdit.telefono} onChange={e => setDatosEdit({ ...datosEdit, telefono: e.target.value })} />
                </div>
                <div>
                  <label className="touch-field-label">Correo Institucional</label>
                  <input type="email" className="touch-field-input" value={datosEdit.correo} onChange={e => setDatosEdit({ ...datosEdit, correo: e.target.value })} />
                </div>
                <div>
                  <label className="touch-field-label">Usuario Login</label>
                  <input className="touch-field-input" value={datosEdit.usuario_login} onChange={e => setDatosEdit({ ...datosEdit, usuario_login: e.target.value })} />
                </div>
                <div>
                  <label className="touch-field-label">PIN</label>
                  <input className="touch-field-input mono-id" value={datosEdit.pin} onChange={e => setDatosEdit({ ...datosEdit, pin: e.target.value })} />
                </div>
                <div>
                  <label className="touch-field-label">Rol en el Sistema</label>
                  <select className="touch-field-input" value={datosEdit.rol} onChange={e => setDatosEdit({ ...datosEdit, rol: e.target.value })}>
                    <option value="empleado">EMPLEADO</option>
                    <option value="encargado">ENCARGADO</option>
                    <option value="jefe_area">JEFE DE ÁREA</option>
                    <option value="gerente">GERENTE</option>
                    <option value="rh_nominas">RH / NÓMINAS</option>
                    <option value="caseta">CASETA</option>
                  </select>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: c.textMuted }}>Celular:</span><span>{colaborador.celular || 'No registrado'}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', wordBreak: 'break-all' }}><span style={{ color: c.textMuted }}>Correo:</span><span>{colaborador.correo || 'No registrado'}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: c.textMuted }}>Usuario ERP:</span><strong style={{ color: c.accent }}>@{colaborador.usuario_login}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: c.textMuted }}>Rol:</span><strong style={{ textTransform: 'capitalize' }}>{colaborador.rol?.replace('_', ' ')}</strong></div>
                
                {/* GESTIÓN EXCLUSIVA DEL PIN */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', paddingTop: '8px', borderTop: `1px solid ${c.borderDivider}` }}>
                  <span style={{ fontSize: '11px', color: c.textMuted }}>PIN: • • • • • •</span>
                  <button onClick={() => onRestablecerPin(colaborador.id, colaborador.nombre_completo)} style={{ background: 'transparent', border: `1px solid ${c.border}`, color: c.text, padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                    Resetear PIN
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* BLOQUE 3: PROTOCOLO DE BAJA O REACTIVACIÓN */}
          {!editando && (
            <div style={{ background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '10px', color: c.textMuted, fontWeight: '800' }}>ESTATUS LABORAL</div>
                {colaborador.activo ? (
                  <span style={{ fontSize: '12px', color: c.accent, fontWeight: '800' }}>● ACTIVO EN NÓMINA</span>
                ) : (
                  <div style={{ fontSize: '11px', color: c.danger, fontWeight: '700' }}>
                    ● BAJA ({colaborador.motivo_baja || 'Separado'})
                  </div>
                )}
              </div>

              {colaborador.activo ? (
                <button onClick={() => onAbrirBaja(colaborador)} style={{ background: c.dangerSoft, color: c.danger, border: 'none', padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}>
                  Tramitar Baja
                </button>
              ) : (
                <button onClick={() => onReactivar(colaborador)} style={{ background: c.accentSoft, color: c.accent, border: 'none', padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}>
                  Reactivar
                </button>
              )}
            </div>
          )}

        </div>

        {/* FOOTER AL EDITAR */}
        {editando && (
          <div style={{
            padding: '14px 18px', borderTop: `1px solid ${c.border}`,
            background: c.surface, display: 'flex', justifyContent: 'flex-end', gap: '8px', flexShrink: 0
          }}>
            <button 
              onClick={onClose}
              style={{
                padding: '8px 14px', borderRadius: '6px', border: `1px solid ${c.border}`,
                background: 'transparent', color: c.textMuted, fontSize: '12px', fontWeight: '600', cursor: 'pointer'
              }}
            >
              Cancelar
            </button>
            <button 
              onClick={onGuardar}
              disabled={guardando}
              style={{
                padding: '8px 18px', borderRadius: '6px', border: 'none',
                background: c.accent, color: '#fff', fontSize: '12px', fontWeight: '800',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px'
              }}
            >
              <Save size={13} /> {guardando ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        )}

      </aside>
    </div>
  );
}