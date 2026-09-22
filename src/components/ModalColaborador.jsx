import React, { useState, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import imageCompression from 'browser-image-compression';
import { X, Camera, Image, Eye, UserPlus, Info, MapPin, Shield } from 'lucide-react';
import { estandarizar } from '../utils/directorioHelpers';

export default function ModalColaborador({ 
  onClose, onSuccess, departamentos = [], areas = [], puestos = [], sedes = [], modoOscuro 
}) {
  const [formData, setFormData] = useState({
    numero_empleado: '', nombre_completo: '', fecha_ingreso: '', celular: '',
    telefono: '', correo: '', tipo_personal: 'produccion', sede_id: '', departamento_id: '',
    area: '', puesto: '', rol: 'empleado', usuario_login: '', pin: ''
  });

  const [fotoArchivo, setFotoArchivo] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const [mostrarSelectorFoto, setMostrarSelectorFoto] = useState(false);
  const [fotoAmpliada, setFotoAmpliada] = useState(false);

  const camaraInputRef = useRef(null);
  const galeriaInputRef = useRef(null);

  const [creandoNuevo, setCreandoNuevo] = useState({ sede: false, depto: false, area: false, puesto: false });
  const [textosNuevos, setTextosNuevos] = useState({ sede: '', depto: '', area: '', puesto: '' });

  // === PALETA SAAS HIGH-END ===
  const c = {
    overlay: modoOscuro ? 'rgba(0, 0, 0, 0.75)' : 'rgba(15, 23, 42, 0.5)',
    bg: modoOscuro ? '#09090b' : '#ffffff',
    bgHeader: modoOscuro ? '#09090b' : '#ffffff',
    bgBody: modoOscuro ? '#09090b' : '#fcfcfd',
    border: modoOscuro ? '#27272a' : '#e4e4e7',
    text: modoOscuro ? '#fafafa' : '#09090b',
    label: modoOscuro ? '#a1a1aa' : '#52525b',
    inputBg: modoOscuro ? '#121214' : '#ffffff',
    inputBorder: modoOscuro ? '#3f3f46' : '#cbd5e1',
    accent: '#10b981', // Esmeralda elegante
    accentGlow: 'rgba(16, 185, 129, 0.15)',
    danger: '#ef4444'
  };

  const handleNombreChange = (e) => {
    const nombre = e.target.value.toUpperCase();
    const usuarioBase = nombre.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, '.');
    
    setFormData(prev => ({
      ...prev, 
      nombre_completo: nombre,
      usuario_login: usuarioBase,
      correo: prev.correo.includes('@') && !prev.correo.includes('mobiliarium') ? prev.correo : `${usuarioBase}@mobiliarium.com`
    }));
  };

  const handleSeleccionarFoto = async (e) => {
    const archivo = e.target.files[0];
    if (archivo) {
      setFotoPreview(URL.createObjectURL(archivo));
      try {
        const comp = await imageCompression(archivo, { maxSizeMB: 0.2, maxWidthOrHeight: 800, useWebWorker: true });
        setFotoArchivo(comp);
        setFotoPreview(URL.createObjectURL(comp));
      } catch (err) { 
        setFotoArchivo(archivo); 
      }
    }
    setMostrarSelectorFoto(false);
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    
    let sedeFinalId = formData.sede_id;
    let deptoFinalId = formData.departamento_id;
    let areaFinal = formData.area;
    let puestoFinal = formData.puesto;

    if (creandoNuevo.sede && textosNuevos.sede.trim()) {
      const nomLimpio = estandarizar(textosNuevos.sede);
      const { data, error } = await supabase.from('sedes').insert([{ nombre: nomLimpio }]).select().single();
      if (error) return alert("Error creando sede: " + error.message);
      sedeFinalId = data.id;
    }

    if (creandoNuevo.depto && textosNuevos.depto.trim()) {
      const nomLimpio = estandarizar(textosNuevos.depto);
      const { data, error } = await supabase.from('departamentos').insert([{ 
        nombre: nomLimpio,
        clasificacion: formData.tipo_personal
      }]).select().single();
      if (error) return alert("Error creando depto: " + error.message);
      deptoFinalId = data.id;
    }

    if (creandoNuevo.area && textosNuevos.area.trim()) areaFinal = estandarizar(textosNuevos.area);
    if (creandoNuevo.puesto && textosNuevos.puesto.trim()) puestoFinal = estandarizar(textosNuevos.puesto);

    if (!formData.nombre_completo || !formData.numero_empleado || !formData.correo || !areaFinal || !deptoFinalId || !formData.usuario_login || !sedeFinalId) {
      return alert("Faltan campos obligatorios. Revisa Sede, Departamento y Área.");
    }
    if (formData.pin.length < 6) return alert("El PIN requiere mínimo 6 dígitos.");

    setGuardando(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.correo.toLowerCase(), 
        password: formData.pin, 
        options: { data: { nombre_completo: formData.nombre_completo } }
      });
      if (authError) throw authError;

      let fotoUrl = null;
      if (fotoArchivo) {
        const fileName = `perfil_${authData.user.id}.jpg`;
        await supabase.storage.from('fotos_usuarios').upload(fileName, fotoArchivo, { contentType: fotoArchivo.type, upsert: true });
        fotoUrl = `${supabase.storage.from('fotos_usuarios').getPublicUrl(fileName).data.publicUrl}?t=${Date.now()}`;
      }

      const { error: dbError } = await supabase.from('usuarios').upsert([{
        id: authData.user.id, 
        numero_empleado: formData.numero_empleado.toUpperCase(), 
        nombre_completo: formData.nombre_completo,
        fecha_ingreso: formData.fecha_ingreso || null,
        celular: formData.celular || null,
        telefono: formData.telefono || null,
        correo: formData.correo.toLowerCase(),
        tipo_personal: formData.tipo_personal,
        sede_id: sedeFinalId,
        departamento_id: deptoFinalId,
        area: areaFinal,
        puesto: puestoFinal || null,
        rol: formData.rol,
        usuario_login: formData.usuario_login.toLowerCase(),
        pin: formData.pin,
        foto_url: fotoUrl, 
        activo: true
      }]);

      if (dbError) throw dbError;
      onSuccess();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <style>{`
        /* OVERLAY Y CONTENEDOR PRINCIPAL */
        .modal-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: ${c.overlay}; backdrop-filter: blur(5px); -webkit-backdrop-filter: blur(5px);
          display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 16px;
        }

        .modal-box {
          background: ${c.bg};
          border: 1px solid ${c.border};
          border-radius: 16px;
          width: 100%;
          max-width: 740px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          overflow: hidden;
          font-family: -apple-system, BlinkMacSystemFont, "Inter", sans-serif;
        }

        /* HEADER Y FOOTER FIJOS */
        .modal-header {
          padding: 20px 24px;
          border-bottom: 1px solid ${c.border};
          background: ${c.bgHeader};
          display: flex; justify-content: space-between; align-items: center;
          flex-shrink: 0;
        }
        
        .modal-footer {
          padding: 16px 24px;
          border-top: 1px solid ${c.border};
          background: ${c.bgHeader};
          display: flex; justify-content: flex-end; gap: 12px;
          flex-shrink: 0;
        }

        /* CUERPO SCROLLEABLE */
        .modal-body {
          padding: 24px;
          overflow-y: auto;
          background: ${c.bgBody};
          display: flex;
          flex-direction: column;
          gap: 32px;
        }

        /* TIPOGRAFÍA */
        .modal-title { font-size: 18px; font-weight: 700; color: ${c.text}; margin: 0; letter-spacing: -0.02em; }
        .modal-desc { font-size: 13px; color: ${c.label}; margin: 4px 0 0 0; }
        
        .section-title {
          font-size: 14px; font-weight: 600; color: ${c.text};
          display: flex; align-items: center; gap: 8px; margin-bottom: 16px;
        }

        /* FLUID GRIDS (Responsivo sin Media Queries complejos) */
        .form-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px 20px;
        }
        @media (min-width: 600px) {
          .form-grid.cols-2 { grid-template-columns: repeat(2, 1fr); }
          .form-grid.cols-3 { grid-template-columns: repeat(3, 1fr); }
        }

        /* INPUTS MODERNOS */
        .input-group { display: flex; flex-direction: column; gap: 6px; }
        
        .clean-label {
          font-size: 12px; font-weight: 500; color: ${c.label};
        }
        
        .clean-input {
          width: 100%; padding: 10px 12px; border-radius: 8px;
          border: 1px solid ${c.inputBorder}; background: ${c.inputBg}; color: ${c.text};
          font-size: 13.5px; outline: none; transition: all 0.2s; box-sizing: border-box;
        }
        
        .clean-input:focus {
          border-color: ${c.accent};
          box-shadow: 0 0 0 3px ${c.accentGlow};
        }
        
        .clean-input::placeholder { color: ${modoOscuro ? '#52525b' : '#94a3b8'}; }
        .clean-input option { background: ${c.bg}; color: ${c.text}; }

        /* CREAR EN LÍNEA */
        .inline-create-box { display: flex; gap: 8px; align-items: center; }
        .btn-cancel-inline {
          padding: 10px; border-radius: 8px; background: transparent; color: ${c.label};
          border: 1px solid ${c.border}; cursor: pointer; transition: background 0.2s;
          display: flex; align-items: center; justify-content: center;
        }
        .btn-cancel-inline:hover { background: ${c.border}; color: ${c.text}; }

        /* BOTONES PRINCIPALES */
        .btn-secondary {
          padding: 10px 18px; border-radius: 8px; border: 1px solid ${c.border};
          background: transparent; color: ${c.text}; font-size: 13px; font-weight: 500; cursor: pointer;
        }
        .btn-primary {
          padding: 10px 24px; border-radius: 8px; border: none;
          background: ${c.accent}; color: #fff; font-size: 13px; font-weight: 600; cursor: pointer;
          display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px ${c.accentGlow};
        }
        .btn-primary:disabled { opacity: 0.7; cursor: not-allowed; }

        /* AVATAR UPLOADER */
        .avatar-uploader {
          display: flex; align-items: center; gap: 20px;
        }
        .avatar-circle {
          width: 72px; height: 72px; border-radius: 50%; overflow: hidden;
          border: 1px solid ${c.border}; position: relative; cursor: pointer;
          flex-shrink: 0; background: ${c.inputBg};
        }
        .avatar-overlay {
          position: absolute; inset: 0; background: rgba(0,0,0,0.5);
          display: flex; align-items: center; justify-content: center;
          opacity: 0; transition: opacity 0.2s;
        }
        .avatar-circle:hover .avatar-overlay { opacity: 1; }
      `}</style>

      {/* INPUTS OCULTOS DE FOTO */}
      <input ref={camaraInputRef} type="file" accept="image/*" capture="environment" onChange={handleSeleccionarFoto} style={{ display: 'none' }} />
      <input ref={galeriaInputRef} type="file" accept="image/*" onChange={handleSeleccionarFoto} style={{ display: 'none' }} />

      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-box" onClick={e => e.stopPropagation()}>
          
          {/* HEADER */}
          <div className="modal-header">
            <div>
              <h2 className="modal-title">Nuevo Colaborador</h2>
              <p className="modal-desc">Ingresa los datos para registrar un elemento en el directorio.</p>
            </div>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: c.label, cursor: 'pointer', padding: '4px' }}>
              <X size={20} />
            </button>
          </div>

          {/* BODY SCROLLEABLE */}
          <div className="modal-body">
            
            {/* FOTO DE PERFIL */}
            <div className="avatar-uploader">
              <div className="avatar-circle" onClick={() => setMostrarSelectorFoto(true)}>
                <img 
                  src={fotoPreview || `https://ui-avatars.com/api/?name=${formData.nombre_completo || 'N'}&background=10b981&color=fff`} 
                  alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <div className="avatar-overlay"><Camera size={20} color="#fff" /></div>
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '500', color: c.text }}>Fotografía de Perfil</div>
                <div style={{ fontSize: '12px', color: c.label, marginTop: '2px' }}>Formatos JPG, PNG. Máximo 5MB.</div>
              </div>
            </div>

            {/* SECCIÓN 1: DATOS PERSONALES */}
            <div>
              <div className="section-title"><Info size={16} color={c.accent} /> Información Personal</div>
              <div className="form-grid cols-2">
                <div className="input-group">
                  <label className="clean-label">Núm. Empleado *</label>
                  <input type="text" required className="clean-input" placeholder="Ej. 1001" style={{ textTransform: 'uppercase' }} value={formData.numero_empleado} onChange={e => setFormData({...formData, numero_empleado: e.target.value})} />
                </div>
                <div className="input-group">
                  <label className="clean-label">Nombre Completo *</label>
                  <input type="text" required className="clean-input" placeholder="Nombre y apellidos" style={{ textTransform: 'uppercase' }} value={formData.nombre_completo} onChange={handleNombreChange} />
                </div>
              </div>
              <div className="form-grid cols-3" style={{ marginTop: '16px' }}>
                <div className="input-group">
                  <label className="clean-label">Fecha Ingreso</label>
                  <input type="date" className="clean-input" value={formData.fecha_ingreso} onChange={e => setFormData({...formData, fecha_ingreso: e.target.value})} />
                </div>
                <div className="input-group">
                  <label className="clean-label">Celular</label>
                  <input type="tel" className="clean-input" placeholder="10 dígitos" value={formData.celular} onChange={e => setFormData({...formData, celular: e.target.value})} />
                </div>
                <div className="input-group">
                  <label className="clean-label">Teléfono Fijo</label>
                  <input type="tel" className="clean-input" value={formData.telefono} onChange={e => setFormData({...formData, telefono: e.target.value})} />
                </div>
              </div>
            </div>

            {/* SECCIÓN 2: ESTRUCTURA */}
            <div>
              <div className="section-title"><MapPin size={16} color={c.accent} /> Ubicación en la Empresa</div>
              
              <div className="form-grid cols-2">
                <div className="input-group">
                  <label className="clean-label">Sede / Región *</label>
                  {!creandoNuevo.sede ? (
                    <select required className="clean-input" value={formData.sede_id} onChange={e => e.target.value === 'NEW' ? setCreandoNuevo({...creandoNuevo, sede: true}) : setFormData({...formData, sede_id: e.target.value})}>
                      <option value="">Seleccionar sede</option>
                      {sedes?.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                      <option value="NEW" style={{ color: c.accent, fontWeight: '600' }}>+ Crear Nueva Sede...</option>
                    </select>
                  ) : (
                    <div className="inline-create-box">
                      <input autoFocus type="text" className="clean-input" placeholder="Escribe la sede..." value={textosNuevos.sede} onChange={e => setTextosNuevos({...textosNuevos, sede: e.target.value})} />
                      <button type="button" onClick={() => setCreandoNuevo({...creandoNuevo, sede: false})} className="btn-cancel-inline"><X size={16} /></button>
                    </div>
                  )}
                </div>
                <div className="input-group">
                  <label className="clean-label">Tipo de Nómina *</label>
                  <select className="clean-input" value={formData.tipo_personal} onChange={e => setFormData({...formData, tipo_personal: e.target.value})}>
                    <option value="produccion">Producción</option>
                    <option value="administrativo">Administrativo</option>
                    <option value="obra">Obra</option>
                  </select>
                </div>
              </div>

              <div className="form-grid cols-2" style={{ marginTop: '16px' }}>
                <div className="input-group">
                  <label className="clean-label">Departamento *</label>
                  {!creandoNuevo.depto ? (
                    <select required className="clean-input" value={formData.departamento_id} onChange={e => e.target.value === 'NEW' ? setCreandoNuevo({...creandoNuevo, depto: true}) : setFormData({...formData, departamento_id: e.target.value})}>
                      <option value="">Seleccionar departamento</option>
                      {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                      <option value="NEW" style={{ color: c.accent, fontWeight: '600' }}>+ Crear Nuevo Depto...</option>
                    </select>
                  ) : (
                    <div className="inline-create-box">
                      <input autoFocus type="text" className="clean-input" placeholder="Escribe el departamento..." value={textosNuevos.depto} onChange={e => setTextosNuevos({...textosNuevos, depto: e.target.value})} />
                      <button type="button" onClick={() => setCreandoNuevo({...creandoNuevo, depto: false})} className="btn-cancel-inline"><X size={16} /></button>
                    </div>
                  )}
                </div>
                <div className="input-group">
                  <label className="clean-label">Área Física *</label>
                  {!creandoNuevo.area ? (
                    <select required className="clean-input" value={formData.area} onChange={e => e.target.value === 'NEW' ? setCreandoNuevo({...creandoNuevo, area: true}) : setFormData({...formData, area: e.target.value})}>
                      <option value="">Seleccionar área</option>
                      {areas.map(a => <option key={a} value={a}>{a}</option>)}
                      <option value="NEW" style={{ color: c.accent, fontWeight: '600' }}>+ Crear Nueva Área...</option>
                    </select>
                  ) : (
                    <div className="inline-create-box">
                      <input autoFocus type="text" className="clean-input" placeholder="Escribe el área..." value={textosNuevos.area} onChange={e => setTextosNuevos({...textosNuevos, area: e.target.value})} />
                      <button type="button" onClick={() => setCreandoNuevo({...creandoNuevo, area: false})} className="btn-cancel-inline"><X size={16} /></button>
                    </div>
                  )}
                </div>
              </div>

              <div className="input-group" style={{ marginTop: '16px' }}>
                <label className="clean-label">Puesto (Opcional)</label>
                {!creandoNuevo.puesto ? (
                  <select className="clean-input" value={formData.puesto} onChange={e => e.target.value === 'NEW' ? setCreandoNuevo({...creandoNuevo, puesto: true}) : setFormData({...formData, puesto: e.target.value})}>
                    <option value="">Sin puesto especificado</option>
                    {puestos.map(p => <option key={p} value={p}>{p}</option>)}
                    <option value="NEW" style={{ color: c.accent, fontWeight: '600' }}>+ Crear Nuevo Puesto...</option>
                  </select>
                ) : (
                  <div className="inline-create-box">
                    <input autoFocus type="text" className="clean-input" placeholder="Escribe el puesto..." value={textosNuevos.puesto} onChange={e => setTextosNuevos({...textosNuevos, puesto: e.target.value})} />
                    <button type="button" onClick={() => setCreandoNuevo({...creandoNuevo, puesto: false})} className="btn-cancel-inline"><X size={16} /></button>
                  </div>
                )}
              </div>
            </div>

            {/* SECCIÓN 3: SISTEMA Y ACCESOS */}
            <div>
              <div className="section-title"><Shield size={16} color={c.accent} /> Accesos al Sistema ERP</div>
              <div className="form-grid cols-2">
                <div className="input-group">
                  <label className="clean-label">Rol en el Sistema *</label>
                  <select required className="clean-input" value={formData.rol} onChange={e => setFormData({...formData, rol: e.target.value})}>
                    <option value="empleado">Empleado (Operativo)</option>
                    <option value="encargado">Encargado (Sub-jefe / Supervisor)</option>
                    <option value="jefe_area">Jefe de Área (Responsable)</option>
                    <option value="gerente">Gerente (Dirección)</option>
                    <option value="rh_nominas">RH / Nóminas (Admin)</option>
                    <option value="caseta">Caseta (Vigilancia)</option>
                  </select>
                </div>
                <div className="input-group">
                  <label className="clean-label">Correo Institucional *</label>
                  <input type="email" required className="clean-input" value={formData.correo} onChange={e => setFormData({...formData, correo: e.target.value})} />
                </div>
              </div>
              <div className="form-grid cols-2" style={{ marginTop: '16px' }}>
                <div className="input-group">
                  <label className="clean-label">Usuario Login (Auto-generado)</label>
                  <input type="text" required className="clean-input" value={formData.usuario_login} readOnly style={{ background: c.bg, color: c.label, cursor: 'not-allowed' }} />
                </div>
                <div className="input-group">
                  <label className="clean-label">PIN de Seguridad (Mín 6) *</label>
                  <input type="text" minLength={6} maxLength={10} required className="clean-input" placeholder="Ej. 123456" value={formData.pin} onChange={e => setFormData({...formData, pin: e.target.value})} />
                </div>
              </div>
            </div>

          </div>

          {/* FOOTER */}
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="button" onClick={handleGuardar} disabled={guardando} className="btn-primary">
              {guardando ? 'Guardando...' : 'Registrar Colaborador'}
            </button>
          </div>

        </div>
      </div>

      {/* MINI MODAL SELECCIONAR FOTO */}
      {mostrarSelectorFoto && (
        <div onClick={() => setMostrarSelectorFoto(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: '16px', padding: '20px', width: '100%', maxWidth: '300px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '15px', fontWeight: '700', color: c.text, textAlign: 'center' }}>Fotografía de Perfil</h3>
            <button onClick={() => { setMostrarSelectorFoto(false); camaraInputRef.current?.click(); }} style={{ padding: '12px', background: c.accent, color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><Camera size={16} /> Tomar Foto</button>
            <button onClick={() => { setMostrarSelectorFoto(false); galeriaInputRef.current?.click(); }} style={{ padding: '12px', background: 'transparent', color: c.text, border: `1px solid ${c.border}`, borderRadius: '8px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><Image size={16} /> Subir Archivo</button>
            {fotoPreview && <button onClick={() => { setMostrarSelectorFoto(false); setFotoAmpliada(true); }} style={{ padding: '12px', background: 'transparent', color: c.label, border: 'none', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><Eye size={16} /> Ver Actual</button>}
          </div>
        </div>
      )}

      {/* VISOR LIGHTBOX */}
      {fotoAmpliada && fotoPreview && (
        <div onClick={() => setFotoAmpliada(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: '20px' }}>
          <img src={fotoPreview} alt="Foto ampliada" style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: '16px', objectFit: 'contain' }} />
        </div>
      )}
    </>
  );
}