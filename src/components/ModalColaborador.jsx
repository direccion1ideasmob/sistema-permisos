import React, { useState, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import imageCompression from 'browser-image-compression';
import { X, Camera, Image, Eye, UserPlus, Info, MapPin, Shield, Briefcase, PenTool, CheckCircle } from 'lucide-react';
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
  const [firmaArchivo, setFirmaArchivo] = useState(null);
  const [firmaPreview, setFirmaPreview] = useState(null);
  
  const firmaInputRef = useRef(null);
  const camaraInputRef = useRef(null);
  const galeriaInputRef = useRef(null);

  const [guardando, setGuardando] = useState(false);
  const [mostrarSelectorFoto, setMostrarSelectorFoto] = useState(false);
  const [fotoAmpliada, setFotoAmpliada] = useState(false);

  const [creandoNuevo, setCreandoNuevo] = useState({ sede: false, depto: false, area: false, puesto: false });
  const [textosNuevos, setTextosNuevos] = useState({ sede: '', depto: '', area: '', puesto: '' });

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
    accent: '#10b981',
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
      } catch (err) { setFotoArchivo(archivo); }
    }
    setMostrarSelectorFoto(false);
  };

  const handleSeleccionarFirma = async (e) => {
    const archivo = e.target.files[0];
    if (archivo) {
      setFirmaPreview(URL.createObjectURL(archivo));
      try {
        const comp = await imageCompression(archivo, { maxSizeMB: 0.2, maxWidthOrHeight: 700, useWebWorker: true });
        setFirmaArchivo(comp);
        setFirmaPreview(URL.createObjectURL(comp));
      } catch (err) { setFirmaArchivo(archivo); }
    }
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    
    let sedeFinalId = formData.sede_id;
    let deptoFinalId = formData.departamento_id;
    let areaFinal = formData.area;
    let puestoFinal = formData.puesto;

    try {
      setGuardando(true);

      // VALIDACIÓN Y CREACIÓN DE SEDE (Con filtro Anti-Duplicados)
      if (creandoNuevo.sede && textosNuevos.sede.trim()) {
        const nomLimpio = estandarizar(textosNuevos.sede.toUpperCase());
        const existente = sedes.find(s => s.nombre === nomLimpio);
        if (existente) {
          sedeFinalId = existente.id; // Reutiliza si ya existe
        } else {
          const { data, error } = await supabase.from('sedes').insert([{ nombre: nomLimpio }]).select().single();
          if (error) throw new Error("Error creando sede: " + error.message);
          sedeFinalId = data.id;
        }
      }

      // VALIDACIÓN Y CREACIÓN DE DEPTO (Con filtro Anti-Duplicados)
      if (creandoNuevo.depto && textosNuevos.depto.trim()) {
        const nomLimpio = estandarizar(textosNuevos.depto.toUpperCase());
        const existente = departamentos.find(d => d.nombre === nomLimpio);
        if (existente) {
          deptoFinalId = existente.id;
        } else {
          const { data, error } = await supabase.from('departamentos').insert([{ 
            nombre: nomLimpio, clasificacion: formData.tipo_personal
          }]).select().single();
          if (error) throw new Error("Error creando departamento: " + error.message);
          deptoFinalId = data.id;
        }
      }

      // VALIDACIÓN DE ÁREA Y PUESTO
      if (creandoNuevo.area && textosNuevos.area.trim()) {
        const nomLimpio = estandarizar(textosNuevos.area.toUpperCase());
        const existente = areas.find(a => a === nomLimpio);
        areaFinal = existente || nomLimpio;
      }
      
      if (creandoNuevo.puesto && textosNuevos.puesto.trim()) {
        const nomLimpio = estandarizar(textosNuevos.puesto.toUpperCase());
        const existente = puestos.find(p => p === nomLimpio);
        puestoFinal = existente || nomLimpio;
      }

      if (!formData.nombre_completo || !formData.numero_empleado || !formData.correo || !areaFinal || !deptoFinalId || !formData.usuario_login || !sedeFinalId) {
        throw new Error("Faltan campos obligatorios. Revisa Sede, Departamento y Área.");
      }
      if (formData.pin.length < 6) throw new Error("El PIN requiere mínimo 6 dígitos.");

      // AUTENTICACIÓN
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.correo.toLowerCase(), 
        password: formData.pin, 
        options: { data: { nombre_completo: formData.nombre_completo } }
      });
      if (authError) throw authError;

      // SUBIDA DE IMÁGENES
      let fotoUrl = null;
      let firmaUrl = null;

      if (fotoArchivo) {
        const fileName = `perfil_${authData.user.id}.jpg`;
        await supabase.storage.from('fotos_usuarios').upload(fileName, fotoArchivo, { contentType: fotoArchivo.type, upsert: true });
        fotoUrl = `${supabase.storage.from('fotos_usuarios').getPublicUrl(fileName).data.publicUrl}?t=${Date.now()}`;
      }

      if (firmaArchivo) {
        const fileFirmaName = `firma_${authData.user.id}.png`;
        await supabase.storage.from('fotos_usuarios').upload(fileFirmaName, firmaArchivo, { contentType: firmaArchivo.type, upsert: true });
        firmaUrl = `${supabase.storage.from('fotos_usuarios').getPublicUrl(fileFirmaName).data.publicUrl}?t=${Date.now()}`;
      }

      // GUARDADO FINAL DE USUARIO
      const nuevoUsuarioId = authData.user.id;
      const { error: dbError } = await supabase.from('usuarios').upsert([{
        id: nuevoUsuarioId, 
        numero_empleado: formData.numero_empleado.toUpperCase(), 
        nombre_completo: formData.nombre_completo.toUpperCase(),
        fecha_ingreso: formData.fecha_ingreso || null,
        celular: formData.celular || null,
        telefono: formData.telefono || null,
        correo: formData.correo.toLowerCase(),
        tipo_personal: formData.tipo_personal,
        sede_id: sedeFinalId,
        departamento_id: deptoFinalId,
        area: areaFinal.toUpperCase(),
        puesto: puestoFinal ? puestoFinal.toUpperCase() : null,
        rol: formData.rol,
        usuario_login: formData.usuario_login.toLowerCase(),
        pin: formData.pin,
        foto_url: fotoUrl, 
        firma_url: firmaUrl,
        activo: true
      }]);

      if (dbError) throw dbError;

      // ACTUALIZACIÓN DE JEFATURAS EN DEPTOS
      const actualizacionDepto = {};
      if (formData.rol === 'jefe_area') actualizacionDepto.jefe_id = nuevoUsuarioId;
      else if (['gerente_produccion', 'gerente_admin'].includes(formData.rol)) actualizacionDepto.gerente_id = nuevoUsuarioId;
      else if (['gerente_rh', 'rh_nominas'].includes(formData.rol)) actualizacionDepto.rh_id = nuevoUsuarioId;

      if (Object.keys(actualizacionDepto).length > 0 && deptoFinalId) {
        await supabase.from('departamentos').update(actualizacionDepto).eq('id', deptoFinalId);
      }

      alert(`✅ Colaborador registrado con éxito.\nUsuario: ${formData.usuario_login}`);
      onSuccess();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setGuardando(false);
    }
  };

  // BUSCADOR DE SUGERENCIAS EN TIEMPO REAL
  const buscarSugerencias = (texto, lista, tipo) => {
    if (!texto.trim() || texto.length < 2) return null;
    const busqueda = texto.toUpperCase();
    
    let coincidencias = [];
    if (tipo === 'sede' || tipo === 'depto') {
      coincidencias = lista.filter(item => item.nombre.toUpperCase().includes(busqueda));
    } else {
      coincidencias = lista.filter(item => item.toUpperCase().includes(busqueda));
    }

    if (coincidencias.length === 0) return null;

    return (
      <div style={{ marginTop: '6px', background: c.inputBg, border: `1px solid ${c.border}`, borderRadius: '8px', padding: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={{ fontSize: '10px', color: c.label, paddingLeft: '6px', fontWeight: 'bold' }}>Sugerencias (Clic para seleccionar):</span>
        {coincidencias.slice(0, 3).map((item, i) => (
          <div 
            key={i} 
            onClick={() => {
              if (tipo === 'sede') { setFormData({...formData, sede_id: item.id}); setCreandoNuevo({...creandoNuevo, sede: false}); }
              else if (tipo === 'depto') { setFormData({...formData, departamento_id: item.id}); setCreandoNuevo({...creandoNuevo, depto: false}); }
              else if (tipo === 'area') { setFormData({...formData, area: item}); setCreandoNuevo({...creandoNuevo, area: false}); }
              else if (tipo === 'puesto') { setFormData({...formData, puesto: item}); setCreandoNuevo({...creandoNuevo, puesto: false}); }
            }}
            style={{ fontSize: '12px', padding: '6px 10px', background: c.bg, borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: c.text, fontWeight: '600' }}
          >
            <CheckCircle size={14} color={c.accent} /> {tipo === 'sede' || tipo === 'depto' ? item.nombre : item}
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      <style>{`
        .modal-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: ${c.overlay}; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
          display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 16px;
        }

        .modal-box {
          background: ${c.bg}; border: 1px solid ${c.border}; border-radius: 24px;
          width: 100%; max-width: 740px; max-height: 90vh; display: flex; flex-direction: column;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4); overflow: hidden;
          font-family: -apple-system, BlinkMacSystemFont, "Inter", sans-serif;
        }

        .modal-header {
          padding: 24px 32px 16px 32px; background: ${c.bg};
          display: flex; justify-content: space-between; align-items: flex-start; flex-shrink: 0;
        }
        
        .modal-footer {
          padding: 16px 32px 24px 32px; background: ${c.bg}; border-top: 1px solid ${c.border};
          display: flex; justify-content: flex-end; gap: 12px; flex-shrink: 0;
        }

        .modal-body {
          padding: 16px 32px 32px 32px; overflow-y: auto; background: ${c.bg};
          display: flex; flex-direction: column; gap: 36px;
        }

        .modal-title { font-size: 20px; font-weight: 800; color: ${c.text}; margin: 0; letter-spacing: -0.02em; }
        .modal-desc { font-size: 13.5px; color: ${c.label}; margin: 4px 0 0 0; font-weight: 500; }
        
        .section-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid ${c.border}; }
        .section-title { font-size: 12.5px; font-weight: 800; color: ${c.text}; text-transform: uppercase; letter-spacing: 0.04em; }

        .form-grid { display: grid; grid-template-columns: 1fr; gap: 16px 20px; }
        @media (min-width: 600px) {
          .form-grid.cols-2 { grid-template-columns: repeat(2, 1fr); }
          .form-grid.cols-3 { grid-template-columns: repeat(3, 1fr); }
        }

        .input-group { display: flex; flex-direction: column; gap: 8px; }
        .clean-label { font-size: 11.5px; font-weight: 700; color: ${c.label}; text-transform: uppercase; letter-spacing: 0.02em; }
        .clean-input {
          width: 100%; padding: 12px 14px; border-radius: 10px; border: 1px solid ${c.inputBorder};
          background: ${c.inputBg}; color: ${c.text}; font-size: 13.5px; outline: none; transition: all 0.2s; box-sizing: border-box;
          text-transform: uppercase; /* FORZADO VISUAL A MAYÚSCULAS */
        }
        .clean-input.no-upper { text-transform: none; }
        .clean-input:focus { border-color: ${c.accent}; box-shadow: 0 0 0 3px ${c.accentGlow}; }
        .clean-input::placeholder { color: ${modoOscuro ? '#52525b' : '#94a3b8'}; text-transform: none; }
        .clean-input option { background: ${c.bg}; color: ${c.text}; }

        .inline-create-box { display: flex; gap: 8px; align-items: center; }
        .btn-cancel-inline {
          padding: 12px; border-radius: 10px; background: transparent; color: ${c.label}; border: 1px solid ${c.border};
          cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .btn-cancel-inline:hover { background: ${c.border}; color: ${c.text}; }

        .btn-secondary {
          padding: 12px 20px; border-radius: 10px; border: 1px solid ${c.border}; background: transparent; color: ${c.text};
          font-size: 13.5px; font-weight: 700; cursor: pointer; transition: background 0.2s;
        }
        .btn-secondary:hover { background: ${c.inputBg}; }
        
        .btn-primary {
          padding: 12px 24px; border-radius: 10px; border: none; background: ${c.accent}; color: #fff;
          font-size: 13.5px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 8px;
          box-shadow: 0 4px 12px ${c.accentGlow}; transition: transform 0.1s, opacity 0.2s;
        }
        .btn-primary:disabled { opacity: 0.7; cursor: not-allowed; }
        .btn-primary:active:not(:disabled) { transform: scale(0.98); }

        .avatar-squircle {
          width: 86px; height: 86px; border-radius: 20px; overflow: hidden; border: 2px solid ${c.border};
          position: relative; cursor: pointer; flex-shrink: 0; background: ${c.inputBg}; box-shadow: 0 8px 16px rgba(0,0,0,0.06);
        }
        .firma-box {
          width: 200px; height: 86px; border-radius: 20px; border: 2px dashed ${c.border}; background: ${c.inputBg};
          display: flex; align-items: center; justify-content: center; cursor: pointer; position: relative; overflow: hidden;
          transition: border-color 0.2s;
        }
        .firma-box:hover { border-color: ${c.accent}; }
      `}</style>

      <input ref={camaraInputRef} type="file" accept="image/*" capture="environment" onChange={handleSeleccionarFoto} style={{ display: 'none' }} />
      <input ref={galeriaInputRef} type="file" accept="image/*" onChange={handleSeleccionarFoto} style={{ display: 'none' }} />
      <input ref={firmaInputRef} type="file" accept="image/*" onChange={handleSeleccionarFirma} style={{ display: 'none' }} />

      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-box" onClick={e => e.stopPropagation()}>
          
          <div className="modal-header">
            <div>
              <h2 className="modal-title">Nuevo Colaborador</h2>
              <p className="modal-desc">Completa los datos para registrar un elemento en el directorio corporativo.</p>
            </div>
            <button onClick={onClose} style={{ background: c.inputBg, border: `1px solid ${c.border}`, borderRadius: '50%', color: c.label, cursor: 'pointer', padding: '6px', display: 'flex' }}>
              <X size={18} />
            </button>
          </div>

          <div className="modal-body">
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              
              <div className="avatar-squircle" onClick={() => setMostrarSelectorFoto(true)} title="Subir Foto de Perfil">
                <img 
                  src={fotoPreview || `https://ui-avatars.com/api/?name=${formData.nombre_completo || 'N'}&background=10b981&color=fff`} 
                  alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
                <div className="avatar-overlay" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)', opacity: fotoPreview ? 0 : 1, transition: 'opacity 0.2s' }}>
                  <Camera size={24} color="#fff" />
                </div>
              </div>

              <div className="firma-box" onClick={() => firmaInputRef.current?.click()} title="Subir Firma Digital">
                {firmaPreview ? (
                  <img src={firmaPreview} alt="Firma" style={{ width: '90%', height: '90%', objectFit: 'contain' }} />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <PenTool color={c.label} size={22} />
                    <span style={{ fontSize: '11px', fontWeight: '800', color: c.label, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Subir Firma
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* SECCIÓN 1: DATOS PERSONALES */}
            <div>
              <div className="section-header">
                <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '8px', borderRadius: '10px', color: '#3b82f6', display: 'flex' }}><UserPlus size={16} /></div>
                <span className="section-title">Información Personal</span>
              </div>
              <div className="form-grid cols-2">
                <div className="input-group">
                  <label className="clean-label">Núm. Empleado *</label>
                  <input type="text" required className="clean-input" placeholder="EJ. 1001" style={{ fontFamily: 'monospace', letterSpacing: '1px' }} value={formData.numero_empleado} onChange={e => setFormData({...formData, numero_empleado: e.target.value.toUpperCase()})} />
                </div>
                <div className="input-group">
                  <label className="clean-label">Nombre Completo *</label>
                  <input type="text" required className="clean-input" placeholder="Nombre y apellidos" value={formData.nombre_completo} onChange={handleNombreChange} />
                </div>
              </div>
              <div className="form-grid cols-3" style={{ marginTop: '20px' }}>
                <div className="input-group">
                  <label className="clean-label">Fecha Ingreso</label>
                  <input type="date" className="clean-input" value={formData.fecha_ingreso} onChange={e => setFormData({...formData, fecha_ingreso: e.target.value})} />
                </div>
                <div className="input-group">
                  <label className="clean-label">Celular</label>
                  <input type="tel" className="clean-input" placeholder="10 DÍGITOS" value={formData.celular} onChange={e => setFormData({...formData, celular: e.target.value})} />
                </div>
                <div className="input-group">
                  <label className="clean-label">Teléfono Fijo</label>
                  <input type="tel" className="clean-input" value={formData.telefono} onChange={e => setFormData({...formData, telefono: e.target.value})} />
                </div>
              </div>
            </div>

            {/* SECCIÓN 2: ESTRUCTURA */}
            <div>
              <div className="section-header">
                <div style={{ background: 'rgba(22, 163, 74, 0.1)', padding: '8px', borderRadius: '10px', color: c.accent, display: 'flex' }}><Briefcase size={16} /></div>
                <span className="section-title">Ubicación y Puesto</span>
              </div>
              
              <div className="form-grid cols-2">
                <div className="input-group">
                  <label className="clean-label">Sede / Región *</label>
                  {!creandoNuevo.sede ? (
                    <select required className="clean-input" value={formData.sede_id} onChange={e => e.target.value === 'NEW' ? setCreandoNuevo({...creandoNuevo, sede: true}) : setFormData({...formData, sede_id: e.target.value})}>
                      <option value="">Seleccionar sede</option>
                      {sedes?.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                      <option value="NEW" style={{ color: c.accent, fontWeight: '700' }}>+ Crear Nueva Sede...</option>
                    </select>
                  ) : (
                    <div>
                      <div className="inline-create-box">
                        <input autoFocus type="text" className="clean-input" placeholder="Nombre de la sede..." value={textosNuevos.sede} onChange={e => setTextosNuevos({...textosNuevos, sede: e.target.value.toUpperCase()})} />
                        <button type="button" onClick={() => { setCreandoNuevo({...creandoNuevo, sede: false}); setTextosNuevos({...textosNuevos, sede: ''}) }} className="btn-cancel-inline"><X size={16} /></button>
                      </div>
                      {buscarSugerencias(textosNuevos.sede, sedes, 'sede')}
                    </div>
                  )}
                </div>
                <div className="input-group">
                  <label className="clean-label">Tipo de Nómina *</label>
                  <select className="clean-input" value={formData.tipo_personal} onChange={e => setFormData({...formData, tipo_personal: e.target.value})}>
                    <option value="produccion">PRODUCCIÓN</option><option value="administrativo">ADMINISTRATIVO</option><option value="obra">OBRA</option>
                  </select>
                </div>
              </div>

              <div className="form-grid cols-2" style={{ marginTop: '20px' }}>
                <div className="input-group">
                  <label className="clean-label">Departamento *</label>
                  {!creandoNuevo.depto ? (
                    <select required className="clean-input" value={formData.departamento_id} onChange={e => e.target.value === 'NEW' ? setCreandoNuevo({...creandoNuevo, depto: true}) : setFormData({...formData, departamento_id: e.target.value})}>
                      <option value="">Seleccionar departamento</option>
                      {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                      <option value="NEW" style={{ color: c.accent, fontWeight: '700' }}>+ Crear Nuevo Depto...</option>
                    </select>
                  ) : (
                    <div>
                      <div className="inline-create-box">
                        <input autoFocus type="text" className="clean-input" placeholder="Nombre del depto..." value={textosNuevos.depto} onChange={e => setTextosNuevos({...textosNuevos, depto: e.target.value.toUpperCase()})} />
                        <button type="button" onClick={() => { setCreandoNuevo({...creandoNuevo, depto: false}); setTextosNuevos({...textosNuevos, depto: ''}) }} className="btn-cancel-inline"><X size={16} /></button>
                      </div>
                      {buscarSugerencias(textosNuevos.depto, departamentos, 'depto')}
                    </div>
                  )}
                </div>
                <div className="input-group">
                  <label className="clean-label">Área Física *</label>
                  {!creandoNuevo.area ? (
                    <select required className="clean-input" value={formData.area} onChange={e => e.target.value === 'NEW' ? setCreandoNuevo({...creandoNuevo, area: true}) : setFormData({...formData, area: e.target.value})}>
                      <option value="">Seleccionar área</option>
                      {areas.map(a => <option key={a} value={a}>{a}</option>)}
                      <option value="NEW" style={{ color: c.accent, fontWeight: '700' }}>+ Crear Nueva Área...</option>
                    </select>
                  ) : (
                    <div>
                      <div className="inline-create-box">
                        <input autoFocus type="text" className="clean-input" placeholder="Nombre del área..." value={textosNuevos.area} onChange={e => setTextosNuevos({...textosNuevos, area: e.target.value.toUpperCase()})} />
                        <button type="button" onClick={() => { setCreandoNuevo({...creandoNuevo, area: false}); setTextosNuevos({...textosNuevos, area: ''}) }} className="btn-cancel-inline"><X size={16} /></button>
                      </div>
                      {buscarSugerencias(textosNuevos.area, areas, 'area')}
                    </div>
                  )}
                </div>
              </div>

              <div className="input-group" style={{ marginTop: '20px' }}>
                <label className="clean-label">Puesto Especifico (Opcional)</label>
                {!creandoNuevo.puesto ? (
                  <select className="clean-input" value={formData.puesto} onChange={e => e.target.value === 'NEW' ? setCreandoNuevo({...creandoNuevo, puesto: true}) : setFormData({...formData, puesto: e.target.value})}>
                    <option value="">SIN PUESTO ESPECIFICADO</option>
                    {puestos.map(p => <option key={p} value={p}>{p}</option>)}
                    <option value="NEW" style={{ color: c.accent, fontWeight: '700' }}>+ Crear Nuevo Puesto...</option>
                  </select>
                ) : (
                  <div>
                    <div className="inline-create-box">
                      <input autoFocus type="text" className="clean-input" placeholder="Nombre del puesto..." value={textosNuevos.puesto} onChange={e => setTextosNuevos({...textosNuevos, puesto: e.target.value.toUpperCase()})} />
                      <button type="button" onClick={() => { setCreandoNuevo({...creandoNuevo, puesto: false}); setTextosNuevos({...textosNuevos, puesto: ''}) }} className="btn-cancel-inline"><X size={16} /></button>
                    </div>
                    {buscarSugerencias(textosNuevos.puesto, puestos, 'puesto')}
                  </div>
                )}
              </div>
            </div>

            {/* SECCIÓN 3: SISTEMA Y ACCESOS */}
            <div>
              <div className="section-header">
                <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '8px', borderRadius: '10px', color: '#6366f1', display: 'flex' }}><Shield size={16} /></div>
                <span className="section-title">Accesos al Sistema ERP</span>
              </div>
              
              <div className="form-grid cols-2">
                <div className="input-group">
                  <label className="clean-label">Rol en el Sistema *</label>
                  <select required className="clean-input" value={formData.rol} onChange={e => setFormData({...formData, rol: e.target.value})}>
                    <option value="empleado">EMPLEADO (OPERATIVO)</option>
                    <option value="jefe_area">JEFE DE ÁREA (PRIMER FILTRO)</option>
                    <option value="gerente_produccion">GERENTE DE PRODUCCIÓN (PLANTA)</option>
                    <option value="gerente_admin">GERENTE ADMINISTRATIVO (OFICINA)</option>
                    <option value="gerente_rh">GERENTE DE RECURSOS HUMANOS</option>
                    <option value="rh_nominas">RH / NÓMINAS (OPERATIVO)</option>
                    <option value="caseta">CASETA / VIGILANCIA</option>
                    <option value="superadmin">SUPER ADMINISTRADOR</option>
                  </select>
                </div>
                <div className="input-group">
                  <label className="clean-label">Correo Institucional *</label>
                  <input type="email" required className="clean-input no-upper" value={formData.correo} onChange={e => setFormData({...formData, correo: e.target.value.toLowerCase()})} />
                </div>
              </div>
              <div className="form-grid cols-2" style={{ marginTop: '20px' }}>
                <div className="input-group">
                  <label className="clean-label">Usuario Login *</label>
                  <input type="text" required className="clean-input no-upper" value={formData.usuario_login} onChange={e => setFormData({...formData, usuario_login: e.target.value.toLowerCase().replace(/\s+/g, '')})} title="Puedes editarlo manualmente" />
                </div>
                <div className="input-group">
                  <label className="clean-label">PIN de Seguridad (Mín 6) *</label>
                  <input type="text" minLength={6} maxLength={10} required className="clean-input no-upper" placeholder="Ej. 123456" style={{ fontFamily: 'monospace', letterSpacing: '2px', fontSize: '15px' }} value={formData.pin} onChange={e => setFormData({...formData, pin: e.target.value})} />
                </div>
              </div>
            </div>

          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="button" onClick={handleGuardar} disabled={guardando} className="btn-primary">
              {guardando ? 'Guardando...' : 'Registrar Colaborador'}
            </button>
          </div>

        </div>
      </div>

      {mostrarSelectorFoto && (
        <div onClick={() => setMostrarSelectorFoto(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: '20px', padding: '24px', width: '100%', maxWidth: '320px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '800', color: c.text, textAlign: 'center' }}>Fotografía de Perfil</h3>
            <button onClick={() => { setMostrarSelectorFoto(false); camaraInputRef.current?.click(); }} style={{ padding: '14px', background: c.accent, color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}><Camera size={18} /> Tomar Foto</button>
            <button onClick={() => { setMostrarSelectorFoto(false); galeriaInputRef.current?.click(); }} style={{ padding: '14px', background: c.inputBg, color: c.text, border: `1px solid ${c.border}`, borderRadius: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}><Image size={18} /> Subir Archivo</button>
            {fotoPreview && <button onClick={() => { setMostrarSelectorFoto(false); setFotoAmpliada(true); }} style={{ padding: '14px', background: 'transparent', color: c.label, border: 'none', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}><Eye size={18} /> Ver Actual</button>}
          </div>
        </div>
      )}

      {fotoAmpliada && fotoPreview && (
        <div onClick={() => setFotoAmpliada(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: '20px' }}>
          <img src={fotoPreview} alt="Foto ampliada" style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: '20px', objectFit: 'contain', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }} />
        </div>
      )}
    </>
  );
}