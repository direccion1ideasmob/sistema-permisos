import React, { useState, useRef } from 'react';
import { supabase } from '../../services/supabaseClient';
import imageCompression from 'browser-image-compression';
import { 
  X, Camera, Save, Briefcase, Phone, ShieldCheck, 
  MessageCircle, Eye, PenTool
} from 'lucide-react';
import { estandarizar } from '../../utils/directorioHelpers';

export default function DossierLateral({
  colaborador, abierto, onClose, editando, datosEdit, setDatosEdit,
  departamentos = [], sedes = [], areas = [], puestos = [], subiendoFoto, onCambiarFoto,
  recargarDatos, onAbrirBaja, onReactivar, setFotoZoom, c
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

  // FUNCIÓN PARA TRAMITAR BAJA CON PALABRA CLAVE
  const tramitarBajaSegura = (colab) => {
    const palabra = window.prompt('Para continuar con la baja, escribe la palabra "BAJA" (en mayúsculas):');
    if (palabra === 'BAJA') {
      onAbrirBaja(colab);
    } else if (palabra !== null) {
      alert('Palabra incorrecta. Operación cancelada.');
    }
  };

  // GUARDADO COMPLETO Y BLINDADO
  const handleGuardarExpediente = async () => {
    if (!datosEdit.numero_empleado?.trim() || !datosEdit.nombre_completo?.trim() || !datosEdit.correo?.trim() || !datosEdit.area?.trim()) {
      return alert("Faltan campos obligatorios: Número de empleado, Nombre, Correo y Área no pueden estar vacíos.");
    }

    setGuardando(true);
    
    let sedeFinalId = datosEdit.sede_id && datosEdit.sede_id !== "" ? datosEdit.sede_id : null;
    let deptoFinalId = datosEdit.departamento_id && datosEdit.departamento_id !== "" ? datosEdit.departamento_id : null;

    try {
      if (creandoNuevo.sede && textosNuevos.sede.trim()) {
        const nomSede = estandarizar(textosNuevos.sede);
        const { data: nuevaSede, error: errSede } = await supabase.from('sedes').insert([{ nombre: nomSede }]).select().single();
        if (errSede) throw new Error("Error creando nueva sede: " + errSede.message);
        sedeFinalId = nuevaSede.id;
      }

      if (creandoNuevo.depto && textosNuevos.depto.trim()) {
        const nomDepto = estandarizar(textosNuevos.depto);
        const { data: nuevoDepto, error: errDepto } = await supabase.from('departamentos').insert([{ nombre: nomDepto, clasificacion: datosEdit.tipo_personal || 'produccion' }]).select().single();
        if (errDepto) throw new Error("Error creando nuevo departamento: " + errDepto.message);
        deptoFinalId = nuevoDepto.id;
      }

      const { error: errUpdate } = await supabase
        .from('usuarios')
        .update({
          numero_empleado: datosEdit.numero_empleado.trim().toUpperCase(),
          nombre_completo: datosEdit.nombre_completo.trim().toUpperCase(),
          sede_id: sedeFinalId,
          departamento_id: deptoFinalId,
          area: datosEdit.area.trim().toUpperCase(),
          puesto: datosEdit.puesto ? datosEdit.puesto.trim().toUpperCase() : null,
          tipo_personal: datosEdit.tipo_personal || 'produccion',
          rol: datosEdit.rol || 'empleado',
          celular: datosEdit.celular ? datosEdit.celular.trim() : null,
          telefono: datosEdit.telefono ? datosEdit.telefono.trim() : null,
          correo: datosEdit.correo.trim().toLowerCase(),
          usuario_login: datosEdit.usuario_login && datosEdit.usuario_login.trim() !== "" ? datosEdit.usuario_login.trim().toLowerCase() : null,
          pin: datosEdit.pin && datosEdit.pin.trim() !== "" ? datosEdit.pin.trim() : null,
          fecha_ingreso: datosEdit.fecha_ingreso || null,
          foto_url: datosEdit.foto_url || null,
          firma_url: datosEdit.firma_url || null
        })
        .eq('id', colaborador.id);

      if (errUpdate) throw errUpdate;

      setCreandoNuevo({ sede: false, depto: false });
      setTextosNuevos({ sede: '', depto: '' });
      onClose();
      if (recargarDatos) await recargarDatos();
    } catch (err) {
      console.error(err);
      alert("Error al guardar: " + err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="dossier-overlay" onClick={onClose}>
      <aside className="dossier-drawer" onClick={e => e.stopPropagation()}>
        
        {/* ==================== CABECERA LIMPIA ==================== */}
        <div style={{
          padding: '16px 20px', borderBottom: `1px solid ${c.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: c.surface, flexShrink: 0
        }}>
          <div>
            <div style={{ fontSize: '11.5px', fontWeight: '800', color: c.accent, textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
              {editando ? 'MODO EDICIÓN HABILITADO' : 'EXPEDIENTE CORPORATIVO'}
            </div>
            <div style={{ fontSize: '11px', color: c.textMuted, marginTop: '2px' }}>
              #{colaborador.numero_empleado} • {sedeNombre}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: c.textMuted, cursor: 'pointer', padding: '6px', display: 'flex' }}>
            <X size={20} />
          </button>
        </div>

        {/* ==================== CUERPO DEL EXPEDIENTE ==================== */}
        <div className="dossier-body-scroll" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', background: c.surface }}>
          
          {/* TARJETA 1: IDENTIDAD EJECUTIVA */}
          <div style={{
            position: 'relative',
            background: c.surfaceCard,
            borderRadius: '20px',
            border: `1px solid ${c.border}`,
            boxShadow: '0 8px 24px -4px rgba(0,0,0,0.04), 0 4px 8px -2px rgba(0,0,0,0.02)',
            padding: '24px',
            display: 'flex', gap: '20px', alignItems: 'center'
          }}>
            
            {/* FOTO PERFIL */}
            <div style={{ position: 'relative', width: editando ? '80px' : '95px', height: editando ? '80px' : '105px', flexShrink: 0 }}>
              <img 
                src={urlFoto} alt="" 
                onClick={abrirFotoGrande}
                title="Toca para ver foto ampliada"
                style={{ 
                  width: '100%', height: '100%', borderRadius: '20px', objectFit: 'cover', 
                  border: `1px solid rgba(0,0,0,0.06)`, cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
                }} 
              />
              {editando && (
                <label style={{ 
                  position: 'absolute', bottom: '-4px', right: '-4px', 
                  width: '30px', height: '30px', borderRadius: '50%',
                  background: c.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', 
                  cursor: 'pointer', border: '3px solid #fff', boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
                }}>
                  <Camera size={14} color="#fff" />
                  <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={onCambiarFoto} />
                </label>
              )}
            </div>

          {/* DATOS E IDENTIDAD */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              {editando ? (
                <input 
                  type="text" 
                  value={datosEdit.nombre_completo || ''}
                  onChange={e => setDatosEdit({ ...datosEdit, nombre_completo: e.target.value })}
                  className="touch-field-input" placeholder="Nombre Completo"
                  style={{ fontWeight: '900', fontSize: '15px', width: '100%', marginBottom: '4px', textAlign: 'right' }}
                />
              ) : (
                <div style={{ fontSize: '17px', fontWeight: '900', color: c.text, lineHeight: '1.2', textTransform: 'uppercase', marginBottom: '4px', wordBreak: 'break-word', textAlign: 'right' }}>
                  {colaborador.nombre_completo}
                </div>
              )}
              
              <div style={{ fontSize: '13px', color: c.accent, fontWeight: '800', letterSpacing: '0.02em', textTransform: 'uppercase', textAlign: 'right' }}>
                {colaborador.puesto || 'SIN PUESTO'}
              </div>

              {/* FIRMA ALINEADA A LA DERECHA */}
              {!editando && colaborador.firma_url && (
                <div style={{ marginTop: '12px', minHeight: '40px', display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
                  <img 
                    src={colaborador.firma_url} alt="Firma" 
                    onClick={() => setFotoZoom && setFotoZoom({ url: colaborador.firma_url, nombre: `Firma de ${colaborador.nombre_completo}` })}
                    style={{ maxHeight: '55px', maxWidth: '160px', objectFit: 'contain', cursor: 'pointer', mixBlendMode: 'darken' }} 
                  />
                </div>
              )}
            </div>
          </div>

          {/* =========================================================
              RECUADRO DE FIRMA (SOLO AL EDITAR)
              ========================================================= */}
          {editando && (
            <div style={{ background: c.surfaceCard, borderRadius: '16px', padding: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', border: `1px solid ${c.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ fontSize: '11px', fontWeight: '800', color: c.accent, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <PenTool size={13} /> Firma Digitalizada
                </div>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 12px', borderRadius: '8px', background: c.accent, color: '#ffffff', fontSize: '11px', fontWeight: '700', cursor: 'pointer', transition: 'opacity 0.2s' }}>
                  <PenTool size={12} /> <span>{urlFirma ? 'Cambiar' : 'Cargar'}</span>
                  <input ref={firmaInputRef} type="file" accept="image/*" hidden onChange={handleCambiarFirma} />
                </label>
              </div>
              <div style={{ width: '100%', height: '85px', borderRadius: '10px', backgroundColor: c.surface, border: `2px dashed ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {urlFirma ? (
                  <img src={urlFirma} alt="Firma" style={{ maxHeight: '75px', maxWidth: '90%', objectFit: 'contain' }} />
                ) : (
                  <div style={{ fontSize: '11px', color: c.textMuted, textAlign: 'center', fontWeight: '500' }}>
                    Sin firma<br/><span style={{ color: c.accent, fontWeight: '700' }}>Toca en Cargar</span>
                  </div>
                )}
              </div>
              {subiendoFirma && <span style={{ fontSize: '11px', color: c.accent, display: 'block', marginTop: '6px', fontWeight: '700' }}>Subiendo firma...</span>}
            </div>
          )}

          {/* =========================================================
              BLOQUE 1: ESTRUCTURA LABORAL
              ========================================================= */}
          <div style={{ background: c.surfaceCard, borderRadius: '16px', padding: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', border: `1px solid ${c.border}` }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', paddingBottom: '16px', borderBottom: `1px solid ${c.borderDivider || '#f1f5f9'}` }}>
              <div style={{ background: 'rgba(22, 163, 74, 0.1)', padding: '6px', borderRadius: '8px', color: c.accent, display: 'flex' }}>
                <Briefcase size={14} />
              </div>
              <span style={{ fontSize: '12px', fontWeight: '800', color: c.text, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Estructura y Puesto</span>
            </div>

            {editando ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                <div><label className="touch-field-label">Nº Empleado</label><input className="touch-field-input mono-id" value={datosEdit.numero_empleado || ''} onChange={e => setDatosEdit({ ...datosEdit, numero_empleado: e.target.value })} /></div>
                <div>
                  <label className="touch-field-label">Nómina</label>
                  <select className="touch-field-input" value={datosEdit.tipo_personal || 'produccion'} onChange={e => setDatosEdit({ ...datosEdit, tipo_personal: e.target.value })}>
                    <option value="produccion">PRODUCCIÓN</option><option value="administrativo">ADMINISTRATIVO</option><option value="obra">OBRA</option>
                  </select>
                </div>
                <div>
                  <label className="touch-field-label">Sede / Región</label>
                  {!creandoNuevo.sede ? (
                    <select className="touch-field-input" value={datosEdit.sede_id || ''} onChange={e => e.target.value === 'NEW' ? setCreandoNuevo({ ...creandoNuevo, sede: true }) : setDatosEdit({ ...datosEdit, sede_id: e.target.value })}>
                      <option value="">Sin Sede</option>{sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}<option value="NEW" style={{ color: c.accent, fontWeight: '700' }}>+ Crear Nueva...</option>
                    </select>
                  ) : (
                    <div style={{ display: 'flex', gap: '4px' }}><input type="text" autoFocus className="touch-field-input" placeholder="Nueva Sede..." value={textosNuevos.sede} onChange={e => setTextosNuevos({ ...textosNuevos, sede: e.target.value })} /><button type="button" onClick={() => setCreandoNuevo({ ...creandoNuevo, sede: false })} style={{ padding: '0 8px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}><X size={14} /></button></div>
                  )}
                </div>
                <div>
                  <label className="touch-field-label">Departamento</label>
                  {!creandoNuevo.depto ? (
                    <select className="touch-field-input" value={datosEdit.departamento_id || ''} onChange={e => e.target.value === 'NEW' ? setCreandoNuevo({ ...creandoNuevo, depto: true }) : setDatosEdit({ ...datosEdit, departamento_id: e.target.value })}>
                      <option value="">Sin Depto</option>{departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}<option value="NEW" style={{ color: c.accent, fontWeight: '700' }}>+ Crear Nuevo...</option>
                    </select>
                  ) : (
                    <div style={{ display: 'flex', gap: '4px' }}><input type="text" autoFocus className="touch-field-input" placeholder="Nuevo Depto..." value={textosNuevos.depto} onChange={e => setTextosNuevos({ ...textosNuevos, depto: e.target.value })} /><button type="button" onClick={() => setCreandoNuevo({ ...creandoNuevo, depto: false })} style={{ padding: '0 8px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}><X size={14} /></button></div>
                  )}
                </div>
                <div><label className="touch-field-label">Área Física</label><input list="lista-areas-sugeridas" className="touch-field-input" placeholder="Ej. Planta Alta" value={datosEdit.area || ''} onChange={e => setDatosEdit({ ...datosEdit, area: e.target.value })} /><datalist id="lista-areas-sugeridas">{areas.map(a => <option key={a} value={a} />)}</datalist></div>
                <div><label className="touch-field-label">Puesto Real</label><input list="lista-puestos-sugeridos" className="touch-field-input" placeholder="Ej. Estimador" value={datosEdit.puesto || ''} onChange={e => setDatosEdit({ ...datosEdit, puesto: e.target.value })} /><datalist id="lista-puestos-sugeridos">{puestos.map(p => <option key={p} value={p} />)}</datalist></div>
                <div style={{ gridColumn: '1 / -1' }}><label className="touch-field-label">Fecha de Ingreso</label><input type="date" className="touch-field-input" value={datosEdit.fecha_ingreso || ''} onChange={e => setDatosEdit({ ...datosEdit, fecha_ingreso: e.target.value })} /></div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${c.borderDivider || '#f1f5f9'}` }}><span style={{ color: c.textMuted }}>Sede Fija</span><strong style={{ color: c.text }}>{sedeNombre}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${c.borderDivider || '#f1f5f9'}` }}><span style={{ color: c.textMuted }}>Departamento</span><strong style={{ color: c.text }}>{colaborador.departamentos?.nombre || 'No asignado'}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${c.borderDivider || '#f1f5f9'}` }}><span style={{ color: c.textMuted }}>Área Física</span><strong style={{ color: c.text }}>{colaborador.area || 'General'}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${c.borderDivider || '#f1f5f9'}` }}><span style={{ color: c.textMuted }}>Tipo de Nómina</span><strong style={{ color: c.accent, textTransform: 'uppercase' }}>{colaborador.tipo_personal}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}><span style={{ color: c.textMuted }}>Fecha Ingreso</span><span style={{ fontWeight: '500', color: c.text }}>{colaborador.fecha_ingreso || 'No registrada'}</span></div>
              </div>
            )}
          </div>

          {/* =========================================================
              BLOQUE 2: COMUNICACIÓN Y ACCESOS
              ========================================================= */}
          <div style={{ background: c.surfaceCard, borderRadius: '16px', padding: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', border: `1px solid ${c.border}` }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', paddingBottom: '16px', borderBottom: `1px solid ${c.borderDivider || '#f1f5f9'}` }}>
              <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '6px', borderRadius: '8px', color: '#6366f1', display: 'flex' }}>
                <ShieldCheck size={14} />
              </div>
              <span style={{ fontSize: '12px', fontWeight: '800', color: c.text, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sistemas y Contacto</span>
            </div>

            {editando ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                <div><label className="touch-field-label">Celular</label><input className="touch-field-input" value={datosEdit.celular || ''} onChange={e => setDatosEdit({ ...datosEdit, celular: e.target.value })} /></div>
                <div><label className="touch-field-label">Teléfono Fijo</label><input className="touch-field-input" value={datosEdit.telefono || ''} onChange={e => setDatosEdit({ ...datosEdit, telefono: e.target.value })} /></div>
                <div style={{ gridColumn: '1 / -1' }}><label className="touch-field-label">Correo Institucional</label><input type="email" className="touch-field-input" value={datosEdit.correo || ''} onChange={e => setDatosEdit({ ...datosEdit, correo: e.target.value })} /></div>
                <div><label className="touch-field-label">Usuario ERP</label><input className="touch-field-input" value={datosEdit.usuario_login || ''} onChange={e => setDatosEdit({ ...datosEdit, usuario_login: e.target.value })} /></div>
                <div><label className="touch-field-label">PIN</label><input className="touch-field-input mono-id" placeholder="****" value={datosEdit.pin || ''} onChange={e => setDatosEdit({ ...datosEdit, pin: e.target.value })} /></div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="touch-field-label">Rol en ERP</label>
                  <select className="touch-field-input" value={datosEdit.rol || 'empleado'} onChange={e => setDatosEdit({ ...datosEdit, rol: e.target.value })}>
                    <option value="empleado">EMPLEADO</option><option value="encargado">ENCARGADO</option><option value="jefe_area">JEFE DE ÁREA</option><option value="gerente">GERENTE</option><option value="rh_nominas">RH / NÓMINAS</option><option value="caseta">CASETA</option>
                  </select>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', fontSize: '13px' }}>
                
                {/* LÍNEA DE CELULAR CON ICONOS INCORPORADOS AQUÍ ABAJO */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${c.borderDivider || '#f1f5f9'}` }}>
                  <span style={{ color: c.textMuted, flexShrink: 0 }}>Celular</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <strong style={{ color: c.text }}>{colaborador.celular || 'No registrado'}</strong>
                    {!editando && colaborador.celular && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <a href={`tel:${colaborador.celular}`} title="Llamar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '8px', background: c.surface, border: `1px solid ${c.border}`, color: c.text, textDecoration: 'none' }}>
                          <Phone size={13} />
                        </a>
                        <a href={`https://wa.me/${colaborador.celular.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" title="WhatsApp" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '8px', background: '#25D366', color: '#fff', border: 'none', textDecoration: 'none', boxShadow: '0 2px 6px rgba(37,211,102,0.2)' }}>
                          <MessageCircle size={13} />
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${c.borderDivider || '#f1f5f9'}` }}><span style={{ color: c.textMuted }}>Teléfono Fijo</span><span style={{ fontWeight: '500', color: c.text }}>{colaborador.telefono || 'No registrado'}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px 0', borderBottom: `1px solid ${c.borderDivider || '#f1f5f9'}` }}><span style={{ color: c.textMuted, marginTop: '2px', flexShrink: 0 }}>Correo</span><strong style={{ color: c.text, textAlign: 'right', wordBreak: 'break-word', paddingLeft: '20px' }}>{colaborador.correo || 'No registrado'}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${c.borderDivider || '#f1f5f9'}` }}><span style={{ color: c.textMuted }}>Usuario ERP</span><strong style={{ color: '#6366f1' }}>{colaborador.usuario_login || 'Sin usuario'}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}><span style={{ color: c.textMuted }}>Permisos</span><strong style={{ color: c.text, textTransform: 'uppercase' }}>{colaborador.rol?.replace('_', ' ')}</strong></div>
              </div>
            )}
          </div>

          {/* PROTOCOLO DE BAJA MANTENIDO INTACTO */}
          {editando && (
            <div style={{ background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '16px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '11px', color: c.textMuted, fontWeight: '800', marginBottom: '4px' }}>ESTATUS LABORAL</div>
                {colaborador.activo ? (
                  <span style={{ fontSize: '12px', color: c.accent, fontWeight: '800' }}>● ACTIVO EN NÓMINA</span>
                ) : (
                  <div style={{ fontSize: '12px', color: c.danger, fontWeight: '800' }}>● BAJA ({colaborador.motivo_baja || 'Separado'})</div>
                )}
              </div>
              {colaborador.activo ? (
                <button onClick={() => tramitarBajaSegura(colaborador)} style={{ background: c.dangerSoft || '#fee2e2', color: c.danger || '#ef4444', border: 'none', padding: '8px 16px', borderRadius: '10px', fontSize: '12px', fontWeight: '800', cursor: 'pointer', transition: 'background 0.2s' }}>Tramitar Baja</button>
              ) : (
                <button onClick={() => onReactivar(colaborador)} style={{ background: c.accentSoft || '#dcfce7', color: c.accent, border: 'none', padding: '8px 16px', borderRadius: '10px', fontSize: '12px', fontWeight: '800', cursor: 'pointer', transition: 'background 0.2s' }}>Reactivar</button>
              )}
            </div>
          )}

        </div>

        {/* ==================== FOOTER AL EDITAR ==================== */}
        {editando && (
          <div style={{
            padding: '16px 20px', borderTop: `1px solid ${c.border}`,
            background: c.surface, display: 'flex', justifyContent: 'flex-end', gap: '10px', flexShrink: 0
          }}>
            <button 
              onClick={onClose}
              style={{ padding: '10px 16px', borderRadius: '8px', border: `1px solid ${c.border}`, background: 'transparent', color: c.textMuted, fontSize: '12.5px', fontWeight: '600', cursor: 'pointer' }}
            >
              Cancelar
            </button>
            <button 
              onClick={handleGuardarExpediente}
              disabled={guardando}
              style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: c.accent, color: '#fff', fontSize: '12.5px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 10px rgba(22, 163, 74, 0.25)' }}
            >
              <Save size={14} /> {guardando ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        )}

      </aside>
    </div>
  );
}