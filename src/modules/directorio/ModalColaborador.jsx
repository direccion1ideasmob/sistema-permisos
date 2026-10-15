import React, { useState, useRef } from 'react';
import { X, Camera, Image, Eye, UserPlus, Shield, Briefcase, PenTool, CheckCircle } from 'lucide-react';
import { estandarizar } from './utils/directorioHelpers';
import { registrarNuevoColaborador } from './services/directorioService';
import { obtenerTemaGlobal } from '../../core/theme/temaGlobal';

export default function ModalColaborador({ 
  onClose, onSuccess, departamentos = [], areas = [], puestos = [], sedes = [], modoOscuro 
}) {
  const [formData, setFormData] = useState({
    numero_empleado: '', nombre: '', apellido_paterno: '', apellido_materno: '',
    nombre_completo: '', fecha_nacimiento: '', fecha_ingreso: '', celular: '',
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

  const tema = obtenerTemaGlobal(modoOscuro);
  const c = {
    ...tema,
    overlay: 'rgba(0, 0, 0, 0.7)',
    label: tema.textMuted,
    accentGlow: 'rgba(22, 163, 74, 0.15)',
  };

  const handlePartesNombreChange = (campo, valor) => {
    const valUpper = valor.toUpperCase();
    const nuevoEstado = { ...formData, [campo]: valUpper };

    const nom = (campo === 'nombre' ? valUpper : formData.nombre).trim();
    const pat = (campo === 'apellido_paterno' ? valUpper : formData.apellido_paterno).trim();
    const mat = (campo === 'apellido_materno' ? valUpper : formData.apellido_materno).trim();

    nuevoEstado.nombre_completo = [nom, pat, mat].filter(Boolean).join(' ');

    const primerNombre = nom.split(' ')[0] || '';
    const primerApellido = pat.split(' ')[0] || '';
    const usuarioBase = [primerNombre, primerApellido].filter(Boolean).join('.')
      .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9.]/g, "");

    nuevoEstado.usuario_login = usuarioBase;
    if (!formData.correo || formData.correo.endsWith('@mobiliarium.com')) {
      nuevoEstado.correo = usuarioBase ? `${usuarioBase}@mobiliarium.com` : '';
    }

    setFormData(nuevoEstado);
  };

  const handleSeleccionarFoto = (e) => {
    const archivo = e.target.files[0];
    if (archivo) {
      setFotoArchivo(archivo);
      setFotoPreview(URL.createObjectURL(archivo));
    }
    setMostrarSelectorFoto(false);
  };

  const handleSeleccionarFirma = (e) => {
    const archivo = e.target.files[0];
    if (archivo) {
      setFirmaArchivo(archivo);
      setFirmaPreview(URL.createObjectURL(archivo));
    }
  };

  const limpiarTexto = (txt) => txt ? estandarizar(txt.toUpperCase()) : '';

  const handleGuardar = async (e) => {
    e.preventDefault();
    if (guardando) return;
    try {
      setGuardando(true);
      await registrarNuevoColaborador({
        formData, creandoNuevo, textosNuevos, sedes, departamentos, areas, puestos, fotoArchivo, firmaArchivo
      });
      alert(`✅ Colaborador registrado con éxito.\nUsuario: ${formData.usuario_login}`);
      onSuccess();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setGuardando(false);
    }
  };

  const buscarSugerencias = (texto, lista, tipo) => {
    if (!texto || texto.trim().length < 1) return null;
    const busqueda = limpiarTexto(texto);
    const coincidencias = (tipo === 'sede' || tipo === 'depto')
      ? lista.filter(item => limpiarTexto(item.nombre).includes(busqueda))
      : lista.filter(item => limpiarTexto(item).includes(busqueda));

    if (coincidencias.length === 0) return null;

    return (
      <div style={{ marginTop: '6px', background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '8px', padding: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={{ fontSize: '10px', color: c.label, paddingLeft: '6px', fontWeight: '700', textTransform: 'uppercase' }}>
          Coincidencias encontradas (Clic para usar existente):
        </span>
        {coincidencias.slice(0, 4).map((item, i) => (
          <div 
            key={i} 
            onClick={() => {
              if (tipo === 'sede') { setFormData({...formData, sede_id: item.id}); setCreandoNuevo({...creandoNuevo, sede: false}); setTextosNuevos({...textosNuevos, sede: ''}); }
              else if (tipo === 'depto') { setFormData({...formData, departamento_id: item.id}); setCreandoNuevo({...creandoNuevo, depto: false}); setTextosNuevos({...textosNuevos, depto: ''}); }
              else if (tipo === 'area') { setFormData({...formData, area: item}); setCreandoNuevo({...creandoNuevo, area: false}); setTextosNuevos({...textosNuevos, area: ''}); }
              else if (tipo === 'puesto') { setFormData({...formData, puesto: item}); setCreandoNuevo({...creandoNuevo, puesto: false}); setTextosNuevos({...textosNuevos, puesto: ''}); }
            }}
            style={{ fontSize: '12px', padding: '8px 10px', background: c.bg, borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: c.text, fontWeight: '600', border: `1px solid ${c.border}` }}
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
        .modal-overlay { position: fixed; inset: 0; background: ${c.overlay}; backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 16px; }
        .modal-box { background: ${c.bg}; border: 1px solid ${c.border}; border-radius: 20px; width: 100%; max-width: 760px; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 25px 60px rgba(0, 0, 0, 0.5); overflow: hidden; font-family: "Inter", -apple-system, BlinkMacSystemFont, sans-serif; }
        .modal-header { padding: 20px 28px; background: ${c.surfaceCard}; display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid ${c.border}; }
        .modal-footer { padding: 16px 28px; background: ${c.surfaceCard}; border-top: 1px solid ${c.border}; display: flex; justify-content: flex-end; gap: 12px; }
        .modal-body { padding: 24px 28px; overflow-y: auto; background: ${c.bg}; display: flex; flex-direction: column; gap: 32px; }
        .modal-title { font-size: 19px; font-weight: 800; color: ${c.text}; margin: 0; letter-spacing: -0.02em; }
        .modal-desc { font-size: 13px; color: ${c.label}; margin: 4px 0 0 0; font-weight: 500; }
        .section-header { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; padding-bottom: 10px; border-bottom: 1px solid ${c.border}; }
        .section-title { font-size: 12px; font-weight: 800; color: ${c.text}; text-transform: uppercase; letter-spacing: 0.04em; }
        .form-grid { display: grid; grid-template-columns: 1fr; gap: 14px 18px; }
        @media (min-width: 600px) {
          .form-grid.cols-2 { grid-template-columns: repeat(2, 1fr); }
          .form-grid.cols-3 { grid-template-columns: repeat(3, 1fr); }
          .form-grid.cols-4 { grid-template-columns: repeat(4, 1fr); }
        }
        .input-group { display: flex; flex-direction: column; gap: 6px; }
        .clean-label { font-size: 11px; font-weight: 700; color: ${c.label}; text-transform: uppercase; letter-spacing: 0.02em; }
        .clean-input { width: 100%; padding: 11px 13px; border-radius: 8px; border: 1px solid ${c.inputBorder}; background: ${c.inputBg}; color: ${c.text}; font-size: 13px; font-weight: 500; outline: none; box-sizing: border-box; text-transform: uppercase; font-family: inherit; }
        .clean-input.no-upper { text-transform: none; }
        .clean-input:focus { border-color: ${c.accent}; box-shadow: 0 0 0 3px ${c.accentGlow}; }
        .inline-create-box { display: flex; gap: 8px; align-items: center; }
        .btn-cancel-inline { padding: 11px; border-radius: 8px; background: transparent; color: ${c.label}; border: 1px solid ${c.border}; cursor: pointer; display: flex; align-items: center; }
        .btn-secondary { padding: 10px 16px; border-radius: 8px; border: 1px solid ${c.border}; background: transparent; color: ${c.text}; font-size: 12.5px; font-weight: 700; cursor: pointer; }
        .btn-primary { padding: 10px 20px; border-radius: 8px; border: none; background: ${c.accent}; color: #fff; font-size: 12.5px; font-weight: 800; cursor: pointer; }
        .avatar-squircle { width: 80px; height: 80px; border-radius: 18px; overflow: hidden; border: 1px solid ${c.border}; position: relative; cursor: pointer; background: ${c.inputBg}; }
        .firma-box { width: 190px; height: 80px; border-radius: 12px; border: 1.5px dashed ${c.border}; background: #ffffff; display: flex; align-items: center; justify-content: center; cursor: pointer; overflow: hidden; }
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
            <button onClick={onClose} style={{ background: c.inputBg, border: `1px solid ${c.border}`, borderRadius: '50%', color: c.label, cursor: 'pointer', padding: '6px', display: 'flex' }}><X size={18} /></button>
          </div>

          <div className="modal-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="avatar-squircle" onClick={() => setMostrarSelectorFoto(true)}>
                <img src={fotoPreview || `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.nombre_completo || 'N')}&background=16a34a&color=fff`} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)', opacity: fotoPreview ? 0 : 1 }}><Camera size={22} color="#fff" /></div>
              </div>

              <div className="firma-box" onClick={() => firmaInputRef.current?.click()}>
                {firmaPreview ? <img src={firmaPreview} alt="Firma" style={{ width: '90%', height: '90%', objectFit: 'contain' }} /> : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <PenTool color="#737373" size={20} />
                    <span style={{ fontSize: '10.5px', fontWeight: '800', color: "#737373", textTransform: 'uppercase' }}>Subir Firma</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="section-header">
                <div style={{ background: c.accentSoft, padding: '7px', borderRadius: '8px', color: c.accent, display: 'flex' }}><UserPlus size={15} /></div>
                <span className="section-title">Información Personal</span>
              </div>

              <div className="form-grid cols-3">
                <div className="input-group"><label className="clean-label">Nombre(s) *</label><input type="text" required className="clean-input" placeholder="Ej. Juan Carlos" value={formData.nombre} onChange={e => handlePartesNombreChange('nombre', e.target.value)} /></div>
                <div className="input-group"><label className="clean-label">Apellido Paterno *</label><input type="text" required className="clean-input" placeholder="Ej. Pérez" value={formData.apellido_paterno} onChange={e => handlePartesNombreChange('apellido_paterno', e.target.value)} /></div>
                <div className="input-group"><label className="clean-label">Apellido Materno</label><input type="text" className="clean-input" placeholder="Ej. López" value={formData.apellido_materno} onChange={e => handlePartesNombreChange('apellido_materno', e.target.value)} /></div>
              </div>

              <div className="form-grid cols-4" style={{ marginTop: '14px' }}>
                <div className="input-group"><label className="clean-label">Núm. Empleado *</label><input type="text" required className="clean-input" placeholder="Ej. 540" value={formData.numero_empleado} onChange={e => setFormData({...formData, numero_empleado: e.target.value.toUpperCase()})} /></div>
                <div className="input-group"><label className="clean-label">Fecha Nacimiento</label><input type="date" className="clean-input" value={formData.fecha_nacimiento} onChange={e => setFormData({...formData, fecha_nacimiento: e.target.value})} /></div>
                <div className="input-group"><label className="clean-label">Fecha Ingreso</label><input type="date" className="clean-input" value={formData.fecha_ingreso} onChange={e => setFormData({...formData, fecha_ingreso: e.target.value})} /></div>
                <div className="input-group"><label className="clean-label">Celular</label><input type="tel" className="clean-input" placeholder="10 dígitos" value={formData.celular} onChange={e => setFormData({...formData, celular: e.target.value})} /></div>
              </div>
            </div>

            <div>
              <div className="section-header">
                <div style={{ background: c.accentSoft, padding: '7px', borderRadius: '8px', color: c.accent, display: 'flex' }}><Briefcase size={15} /></div>
                <span className="section-title">Ubicación y Puesto</span>
              </div>
              
              <div className="form-grid cols-2">
                <div className="input-group">
                  <label className="clean-label">Sede / Región *</label>
                  {!creandoNuevo.sede ? (
                    <select required className="clean-input" value={formData.sede_id} onChange={e => e.target.value === 'NEW' ? setCreandoNuevo({...creandoNuevo, sede: true}) : setFormData({...formData, sede_id: e.target.value})}>
                      <option value="">Seleccionar sede</option>
                      {sedes?.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                      <option value="NEW">+ Crear o Buscar Sede...</option>
                    </select>
                  ) : (
                    <div>
                      <div className="inline-create-box">
                        <input autoFocus type="text" className="clean-input" placeholder="Escribe la sede..." value={textosNuevos.sede} onChange={e => setTextosNuevos({...textosNuevos, sede: e.target.value.toUpperCase()})} />
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

              <div className="form-grid cols-2" style={{ marginTop: '14px' }}>
                <div className="input-group">
                  <label className="clean-label">Departamento *</label>
                  {!creandoNuevo.depto ? (
                    <select required className="clean-input" value={formData.departamento_id} onChange={e => e.target.value === 'NEW' ? setCreandoNuevo({...creandoNuevo, depto: true}) : setFormData({...formData, departamento_id: e.target.value})}>
                      <option value="">Seleccionar departamento</option>
                      {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                      <option value="NEW">+ Crear o Buscar Depto...</option>
                    </select>
                  ) : (
                    <div>
                      <div className="inline-create-box">
                        <input autoFocus type="text" className="clean-input" placeholder="Ej. SISTEMAS..." value={textosNuevos.depto} onChange={e => setTextosNuevos({...textosNuevos, depto: e.target.value.toUpperCase()})} />
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
                      <option value="NEW">+ Crear Nueva Área...</option>
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

              <div className="input-group" style={{ marginTop: '14px' }}>
                <label className="clean-label">Puesto Específico (Opcional)</label>
                {!creandoNuevo.puesto ? (
                  <select className="clean-input" value={formData.puesto} onChange={e => e.target.value === 'NEW' ? setCreandoNuevo({...creandoNuevo, puesto: true}) : setFormData({...formData, puesto: e.target.value})}>
                    <option value="">SIN PUESTO ESPECIFICADO</option>
                    {puestos.map(p => <option key={p} value={p}>{p}</option>)}
                    <option value="NEW">+ Crear Nuevo Puesto...</option>
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

            <div>
              <div className="section-header">
                <div style={{ background: c.accentSoft, padding: '7px', borderRadius: '8px', color: c.accent, display: 'flex' }}><Shield size={15} /></div>
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
                <div className="input-group"><label className="clean-label">Correo Institucional *</label><input type="email" required className="clean-input no-upper" value={formData.correo} onChange={e => setFormData({...formData, correo: e.target.value.toLowerCase()})} /></div>
              </div>
              <div className="form-grid cols-2" style={{ marginTop: '14px' }}>
                <div className="input-group"><label className="clean-label">Usuario Login *</label><input type="text" required className="clean-input no-upper" value={formData.usuario_login} onChange={e => setFormData({...formData, usuario_login: e.target.value.toLowerCase().replace(/\s+/g, '')})} /></div>
                <div className="input-group"><label className="clean-label">PIN de Seguridad (Mín 6) *</label><input type="text" minLength={6} maxLength={10} required className="clean-input no-upper" placeholder="Ej. 123456" value={formData.pin} onChange={e => setFormData({...formData, pin: e.target.value})} /></div>
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
        <div onClick={() => setMostrarSelectorFoto(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '20px', padding: '24px', width: '100%', maxWidth: '320px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '800', color: c.text, textAlign: 'center' }}>Fotografía de Perfil</h3>
            <button onClick={() => { setMostrarSelectorFoto(false); camaraInputRef.current?.click(); }} style={{ padding: '14px', background: c.accent, color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}><Camera size={18} /> Tomar Foto</button>
            <button onClick={() => { setMostrarSelectorFoto(false); galeriaInputRef.current?.click(); }} style={{ padding: '14px', background: c.inputBg, color: c.text, border: `1px solid ${c.border}`, borderRadius: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}><Image size={18} /> Subir Archivo</button>
            {fotoPreview && <button onClick={() => { setMostrarSelectorFoto(false); setFotoAmpliada(true); }} style={{ padding: '14px', background: 'transparent', color: c.label, border: 'none', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}><Eye size={18} /> Ver Actual</button>}
          </div>
        </div>
      )}

      {fotoAmpliada && fotoPreview && (
        <div onClick={() => setFotoAmpliada(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: '20px' }}>
          <img src={fotoPreview} alt="Foto ampliada" style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: '20px', objectFit: 'contain' }} />
        </div>
      )}
    </>
  );
}
