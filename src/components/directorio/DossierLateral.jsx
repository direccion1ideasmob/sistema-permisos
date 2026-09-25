import React, { useState, useRef } from 'react';
import { supabase } from '../../services/supabaseClient';
import imageCompression from 'browser-image-compression';
import { 
  X, Camera, Save, Briefcase, Phone, ShieldCheck, 
  Key, UserX, UserCheck, Mail, Calendar, MessageCircle, Eye, PenTool
} from 'lucide-react';
import { estandarizar } from '../../utils/directorioHelpers';

export default function DossierLateral({
  colaborador, abierto, onClose, editando, datosEdit, setDatosEdit,
  departamentos = [], sedes = [], areas = [], puestos = [], subiendoFoto, onCambiarFoto,
  recargarDatos, onRestablecerPin, onAbrirBaja, onReactivar, setFotoZoom, c
}) {
  const fileInputRef = useRef(null);
  const firmaInputRef = useRef(null);

  const [guardando, setGuardando] = useState(false);
  const [subiendoFirma, setSubiendoFirma] = useState(false);

  // Estados para creación "sobre la marcha" al editar
  const [creandoNuevo, setCreandoNuevo] = useState({ sede: false, depto: false });
  const [textosNuevos, setTextosNuevos] = useState({ sede: '', depto: '' });

  if (!colaborador || !abierto) return null;

  const urlFoto = (editando ? datosEdit.foto_url : colaborador.foto_url) || 
    `https://ui-avatars.com/api/?name=${encodeURIComponent(colaborador.nombre_completo)}&background=16a34a&color=fff&bold=true`;
  const urlFirma = editando ? datosEdit.firma_url : colaborador.firma_url;
  const sedeNombre = sedes.find(s => s.id === (editando ? datosEdit.sede_id : colaborador.sede_id))?.nombre || 'Sin Sede';

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

  // SUBIDA Y COMPRESIÓN DE FIRMA
  const handleCambiarFirma = async (e) => {
    const archivo = e.target.files[0];
    if (!archivo || !colaborador.id) return;

    setSubiendoFirma(true);
    try {
      const options = { maxSizeMB: 0.2, maxWidthOrHeight: 700, useWebWorker: true };
      const comp = await imageCompression(archivo, options);
      const fileName = `firma_${colaborador.id}.png`;

      const { error: uploadErr } = await supabase.storage
        .from('fotos_usuarios')
        .upload(fileName, comp, { contentType: comp.type, upsert: true });

      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from('fotos_usuarios').getPublicUrl(fileName);
      const urlFinal = `${urlData.publicUrl}?t=${Date.now()}`;

      setDatosEdit(prev => ({ ...prev, firma_url: urlFinal }));
      alert("Firma cargada correctamente en vista previa. Recuerda presionar Guardar Cambios para confirmar.");
    } catch (err) {
      alert("Error al subir la firma: " + err.message);
    } finally {
      setSubiendoFirma(false);
    }
  };

  // GUARDADO COMPLETO
  const handleGuardarExpediente = async () => {
    if (!datosEdit.numero_empleado?.trim() || !datosEdit.nombre_completo?.trim()) {
      return alert("El número de empleado y el nombre son obligatorios.");
    }

    setGuardando(true);
    let sedeFinalId = datosEdit.sede_id;
    let deptoFinalId = datosEdit.departamento_id;

    try {
      // 1. Sede nueva sobre la marcha
      if (creandoNuevo.sede && textosNuevos.sede.trim()) {
        const nomSede = estandarizar(textosNuevos.sede);
        const { data: nuevaSede, error: errSede } = await supabase
          .from('sedes')
          .insert([{ nombre: nomSede }])
          .select()
          .single();
        if (errSede) throw new Error("Error creando nueva sede: " + errSede.message);
        sedeFinalId = nuevaSede.id;
      }

      // 2. Departamento nuevo sobre la marcha
      if (creandoNuevo.depto && textosNuevos.depto.trim()) {
        const nomDepto = estandarizar(textosNuevos.depto);
        const { data: nuevoDepto, error: errDepto } = await supabase
          .from('departamentos')
          .insert([{ 
            nombre: nomDepto,
            clasificacion: datosEdit.tipo_personal || 'produccion'
          }])
          .select()
          .single();
        if (errDepto) throw new Error("Error creando nuevo departamento: " + errDepto.message);
        deptoFinalId = nuevoDepto.id;
      }

      // 3. Actualizar usuario en Supabase (INCLUYE firma_url)
      const { error: errUpdate } = await supabase
        .from('usuarios')
        .update({
          numero_empleado: datosEdit.numero_empleado.trim().toUpperCase(),
          nombre_completo: datosEdit.nombre_completo.trim().toUpperCase(),
          sede_id: sedeFinalId || null,
          departamento_id: deptoFinalId || null,
          area: (datosEdit.area || '').trim().toUpperCase(),
          puesto: datosEdit.puesto ? datosEdit.puesto.trim().toUpperCase() : null,
          tipo_personal: datosEdit.tipo_personal,
          rol: datosEdit.rol,
          celular: datosEdit.celular ? datosEdit.celular.trim() : null,
          telefono: datosEdit.telefono ? datosEdit.telefono.trim() : null,
          correo: datosEdit.correo.trim().toLowerCase(),
          usuario_login: datosEdit.usuario_login.trim().toLowerCase(),
          pin: datosEdit.pin.trim(),
          fecha_ingreso: datosEdit.fecha_ingreso || null,
          foto_url: datosEdit.foto_url,
          firma_url: datosEdit.firma_url || null
        })
        .eq('id', colaborador.id);

      if (errUpdate) throw errUpdate;

      setCreandoNuevo({ sede: false, depto: false });
      setTextosNuevos({ sede: '', depto: '' });
      onClose();
      if (recargarDatos) await recargarDatos();
    } catch (err) {
      alert("Error al actualizar colaborador: " + err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="dossier-overlay" onClick={onClose}>
      <aside className="dossier-drawer" onClick={e => e.stopPropagation()}>
        
        {/* CABECERA */}
        <div style={{
          padding: '16px 20px', borderBottom: `1px solid ${c.border}`,
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
          
          {/* FOTO Y NOMBRE */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '16px',
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

              <button 
                type="button" 
                onClick={abrirFotoGrande}
                style={{ background: 'none', border: 'none', color: c.accent, fontSize: '11px', cursor: 'pointer', padding: 0, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}
              >
                <Eye size={12} /> Ver foto completa
              </button>
              {subiendoFoto && <span style={{ fontSize: '10px', color: c.accent, display: 'block' }}>Subiendo foto...</span>}
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

          {/* =========================================================
              RECUADRO: FIRMA DIGITALIZADA OFICIAL
              ========================================================= */}
          <div style={{ background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ fontSize: '11px', fontWeight: '800', color: c.accent, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <PenTool size={13} /> Firma Autógrafa Digitalizada
              </div>

              {editando && (
                <label style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  padding: '4px 10px', borderRadius: '6px',
                  background: c.accent, color: '#ffffff',
                  fontSize: '11px', fontWeight: '700', cursor: 'pointer'
                }}>
                  <PenTool size={11} />
                  <span>{urlFirma ? 'Cambiar Firma' : 'Cargar Firma'}</span>
                  <input ref={firmaInputRef} type="file" accept="image/*" hidden onChange={handleCambiarFirma} />
                </label>
              )}
            </div>

            {/* LIENZO BLANCO PARA QUE LA TINTA SIEMPRE SE VEA NÍTIDA */}
            <div style={{
              width: '100%', height: '85px', borderRadius: '8px',
              backgroundColor: '#ffffff', border: '1px dashed #cbd5e1',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', position: 'relative'
            }}>
              {urlFirma ? (
                <img 
                  src={urlFirma} 
                  alt="Firma del colaborador" 
                  style={{ maxHeight: '75px', maxWidth: '90%', objectFit: 'contain' }} 
                />
              ) : (
                <div style={{ fontSize: '11.5px', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center' }}>
                  Sin firma digitalizada registrada
                  {editando && <div style={{ fontSize: '10px', color: '#16a34a', fontWeight: '600', marginTop: '2px' }}>Toca arriba en "Cargar Firma" para subir una foto</div>}
                </div>
              )}
            </div>
            {subiendoFirma && <span style={{ fontSize: '10.5px', color: c.accent, display: 'block', marginTop: '4px' }}>Subiendo firma a Supabase...</span>}
          </div>

          {/* BLOQUE 1: ESTRUCTURA LABORAL */}
          <div style={{ background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '14px', padding: '14px' }}>
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
                  <label className="touch-field-label">Sede / Región</label>
                  {!creandoNuevo.sede ? (
                    <select 
                      className="touch-field-input" 
                      value={datosEdit.sede_id} 
                      onChange={e => e.target.value === 'NEW' ? setCreandoNuevo({ ...creandoNuevo, sede: true }) : setDatosEdit({ ...datosEdit, sede_id: e.target.value })}
                    >
                      <option value="">Sin Sede</option>
                      {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                      <option value="NEW" style={{ color: c.accent, fontWeight: '700' }}>+ Crear Nueva Sede...</option>
                    </select>
                  ) : (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <input 
                        type="text" autoFocus
                        className="touch-field-input" 
                        placeholder="Nueva Sede..." 
                        value={textosNuevos.sede} 
                        onChange={e => setTextosNuevos({ ...textosNuevos, sede: e.target.value })} 
                      />
                      <button 
                        type="button" 
                        onClick={() => setCreandoNuevo({ ...creandoNuevo, sede: false })}
                        style={{ padding: '0 8px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="touch-field-label">Departamento</label>
                  {!creandoNuevo.depto ? (
                    <select 
                      className="touch-field-input" 
                      value={datosEdit.departamento_id} 
                      onChange={e => e.target.value === 'NEW' ? setCreandoNuevo({ ...creandoNuevo, depto: true }) : setDatosEdit({ ...datosEdit, departamento_id: e.target.value })}
                    >
                      <option value="">Sin Depto</option>
                      {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                      <option value="NEW" style={{ color: c.accent, fontWeight: '700' }}>+ Crear Nuevo Depto...</option>
                    </select>
                  ) : (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <input 
                        type="text" autoFocus
                        className="touch-field-input" 
                        placeholder="Nuevo Depto..." 
                        value={textosNuevos.depto} 
                        onChange={e => setTextosNuevos({ ...textosNuevos, depto: e.target.value })} 
                      />
                      <button 
                        type="button" 
                        onClick={() => setCreandoNuevo({ ...creandoNuevo, depto: false })}
                        style={{ padding: '0 8px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="touch-field-label">Área Física</label>
                  <input 
                    list="lista-areas-sugeridas"
                    className="touch-field-input" 
                    placeholder="Escribe o selecciona..."
                    value={datosEdit.area} 
                    onChange={e => setDatosEdit({ ...datosEdit, area: e.target.value })} 
                  />
                  <datalist id="lista-areas-sugeridas">
                    {areas.map(a => <option key={a} value={a} />)}
                  </datalist>
                </div>

                <div>
                  <label className="touch-field-label">Puesto Real</label>
                  <input 
                    list="lista-puestos-sugeridos"
                    className="touch-field-input" 
                    placeholder="Escribe o selecciona..."
                    value={datosEdit.puesto} 
                    onChange={e => setDatosEdit({ ...datosEdit, puesto: e.target.value })} 
                  />
                  <datalist id="lista-puestos-sugeridos">
                    {puestos.map(p => <option key={p} value={p} />)}
                  </datalist>
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
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', paddingTop: '8px', borderTop: `1px solid ${c.borderDivider}` }}>
                  <span style={{ fontSize: '11px', color: c.textMuted }}>PIN: • • • • • •</span>
                  <button onClick={() => onRestablecerPin(colaborador.id, colaborador.nombre_completo)} style={{ background: 'transparent', border: `1px solid ${c.border}`, color: c.text, padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                    Resetear PIN
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* BLOQUE 3: PROTOCOLO DE BAJA */}
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
              onClick={handleGuardarExpediente}
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