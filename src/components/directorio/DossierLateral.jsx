import React, { useState, useRef } from 'react';
import { supabase } from '../../services/supabaseClient';
import imageCompression from 'browser-image-compression';
import { 
  X, Camera, Save, Briefcase, Phone, ShieldCheck, 
  MessageCircle, PenTool, CheckCircle
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

  // Estados para creación/búsqueda sobre la marcha al editar
  const [creandoNuevo, setCreandoNuevo] = useState({ sede: false, depto: false });
  const [textosNuevos, setTextosNuevos] = useState({ sede: '', depto: '' });

  if (!colaborador || !abierto) return null;

  const nombreMostrar = (editando ? datosEdit.nombre_completo : colaborador.nombre_completo) || 'Colaborador';
  const urlFoto = (editando ? datosEdit.foto_url : colaborador.foto_url) || 
    `https://ui-avatars.com/api/?name=${encodeURIComponent(nombreMostrar)}&background=16a34a&color=fff&bold=true`;
  const urlFirma = editando ? datosEdit.firma_url : colaborador.firma_url;
  const sedeNombre = sedes.find(s => s.id === (editando ? datosEdit.sede_id : colaborador.sede_id))?.nombre || 'Sin Sede';

  const limpiarTexto = (txt) => {
    if (!txt) return '';
    return typeof estandarizar === 'function' 
      ? estandarizar(txt.toUpperCase()) 
      : txt.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  };

  // Manejador para sincronizar Nombre(s) + Apellidos -> nombre_completo
  const handleNombrePartes = (campo, valor) => {
    const valUpper = valor.toUpperCase();
    const nuevo = { ...datosEdit, [campo]: valUpper };

    const nom = (campo === 'nombre' ? valUpper : (datosEdit.nombre || '')).trim();
    const pat = (campo === 'apellido_paterno' ? valUpper : (datosEdit.apellido_paterno || '')).trim();
    const mat = (campo === 'apellido_materno' ? valUpper : (datosEdit.apellido_materno || '')).trim();

    const completo = [nom, pat, mat].filter(Boolean).join(' ');
    nuevo.nombre_completo = completo || datosEdit.nombre_completo;

    setDatosEdit(nuevo);
  };

  // Buscador de sugerencias mientras escribe Sede o Departamento
  const renderSugerencias = (texto, lista, tipo) => {
    if (!texto || texto.trim().length < 1) return null;
    const busq = limpiarTexto(texto);
    const coincidencias = lista.filter(item => limpiarTexto(item.nombre).includes(busq));

    if (coincidencias.length === 0) return null;

    return (
      <div style={{ marginTop: '6px', background: c.bg, border: `1px solid ${c.border}`, borderRadius: '8px', padding: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={{ fontSize: '10px', color: c.textMuted, paddingLeft: '4px', fontWeight: '700' }}>
          Sugerencias (Toca para elegir):
        </span>
        {coincidencias.slice(0, 3).map(item => (
          <div
            key={item.id}
            onClick={() => {
              if (tipo === 'sede') {
                setDatosEdit({ ...datosEdit, sede_id: item.id });
                setCreandoNuevo({ ...creandoNuevo, sede: false });
                setTextosNuevos({ ...textosNuevos, sede: '' });
              } else {
                setDatosEdit({ ...datosEdit, departamento_id: item.id });
                setCreandoNuevo({ ...creandoNuevo, depto: false });
                setTextosNuevos({ ...textosNuevos, depto: '' });
              }
            }}
            style={{ fontSize: '11.5px', padding: '6px 8px', background: c.surfaceCard, borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: c.text, fontWeight: '600', border: `1px solid ${c.border}` }}
          >
            <CheckCircle size={13} color={c.accent} /> {item.nombre}
          </div>
        ))}
      </div>
    );
  };

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

  // GUARDADO COMPLETO Y BLINDADO (CON NOMBRES SEPARADOS Y ANTI-DUPLICADOS EN BD)
  const handleGuardarExpediente = async () => {
    const nom = (datosEdit.nombre || '').trim().toUpperCase();
    const pat = (datosEdit.apellido_paterno || '').trim().toUpperCase();
    const mat = (datosEdit.apellido_materno || '').trim().toUpperCase();
    const nombreCompletoFinal = [nom, pat, mat].filter(Boolean).join(' ') || (datosEdit.nombre_completo || '').trim().toUpperCase();

    if (!datosEdit.numero_empleado?.trim() || !nombreCompletoFinal || !datosEdit.correo?.trim() || !datosEdit.area?.trim()) {
      return alert("Faltan campos obligatorios: Número de empleado, Nombre, Correo y Área no pueden estar vacíos.");
    }

    setGuardando(true);
    
    let sedeFinalId = datosEdit.sede_id && datosEdit.sede_id !== "" ? datosEdit.sede_id : null;
    let deptoFinalId = datosEdit.departamento_id && datosEdit.departamento_id !== "" ? datosEdit.departamento_id : null;

    try {
      // 1. BLINDAJE ANTI-DUPLICADOS: SEDE (Memoria + Supabase)
      if (creandoNuevo.sede && textosNuevos.sede.trim()) {
        const nomSede = limpiarTexto(textosNuevos.sede);
        const enMemoria = sedes.find(s => limpiarTexto(s.nombre) === nomSede);
        
        if (enMemoria) {
          sedeFinalId = enMemoria.id;
        } else {
          const { data: enDB } = await supabase.from('sedes').select('id').ilike('nombre', nomSede).maybeSingle();
          if (enDB) {
            sedeFinalId = enDB.id;
          } else {
            const { data: nuevaSede, error: errSede } = await supabase.from('sedes').insert([{ nombre: nomSede }]).select('id').single();
            if (errSede) throw new Error("Error creando nueva sede: " + errSede.message);
            sedeFinalId = nuevaSede.id;
          }
        }
      }

      // 2. BLINDAJE ANTI-DUPLICADOS: DEPARTAMENTO (Memoria + Supabase)
      if (creandoNuevo.depto && textosNuevos.depto.trim()) {
        const nomDepto = limpiarTexto(textosNuevos.depto);
        const enMemoria = departamentos.find(d => limpiarTexto(d.nombre) === nomDepto);
        
        if (enMemoria) {
          deptoFinalId = enMemoria.id;
        } else {
          const { data: enDB } = await supabase.from('departamentos').select('id').ilike('nombre', nomDepto).maybeSingle();
          if (enDB) {
            deptoFinalId = enDB.id;
          } else {
            const { data: nuevoDepto, error: errDepto } = await supabase
              .from('departamentos')
              .insert([{ nombre: nomDepto, clasificacion: datosEdit.tipo_personal || 'produccion' }])
              .select('id')
              .single();
            if (errDepto) throw new Error("Error creando nuevo departamento: " + errDepto.message);
            deptoFinalId = nuevoDepto.id;
          }
        }
      }

      // 3. ACTUALIZAR USUARIO EN SUPABASE (INCLUYENDO LAS 4 COLUMNAS NUEVAS)
      const { error: errUpdate } = await supabase
        .from('usuarios')
        .update({
          numero_empleado: datosEdit.numero_empleado.trim().toUpperCase(),
          nombre: nom || null,
          apellido_paterno: pat || null,
          apellido_materno: mat || null,
          nombre_completo: nombreCompletoFinal,
          fecha_nacimiento: datosEdit.fecha_nacimiento || null,
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
          padding: '16px 20px', borderBottom: `1.5px solid ${c.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: c.surfaceCard, flexShrink: 0
        }}>
          <div>
            <div style={{ fontSize: '11.5px', fontWeight: '800', color: c.accent, textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
              {editando ? 'MODO EDICIÓN HABILITADO' : 'EXPEDIENTE CORPORATIVO'}
            </div>
            <div style={{ fontSize: '11px', color: c.textMuted, marginTop: '2px', display: 'flex', gap: '6px' }}>
              <span>#{colaborador.numero_empleado}</span>
              <span>•</span>
              <span>{sedeNombre}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: c.textMuted, cursor: 'pointer', padding: '6px', display: 'flex' }}>
            <X size={20} />
          </button>
        </div>

        {/* ==================== CUERPO DEL EXPEDIENTE ==================== */}
        <div className="dossier-body-scroll" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', background: c.bg }}>
          
          {/* TARJETA 1: IDENTIDAD EJECUTIVA */}
          <div style={{
            position: 'relative',
            background: c.surfaceCard,
            borderRadius: '16px',
            border: `1.5px solid ${c.border}`,
            boxShadow: '0 8px 24px -4px rgba(0,0,0,0.04), 0 4px 8px -2px rgba(0,0,0,0.02)',
            padding: '20px',
            display: 'flex', gap: '16px', alignItems: editando ? 'flex-start' : 'center'
          }}>
            
            {/* FOTO PERFIL */}
            <div style={{ position: 'relative', width: editando ? '76px' : '95px', height: editando ? '76px' : '105px', flexShrink: 0 }}>
              <img 
                src={urlFoto} alt="" 
                onClick={abrirFotoGrande}
                title="Toca para ver foto ampliada"
                style={{ 
                  width: '100%', height: '100%', borderRadius: '18px', objectFit: 'cover', 
                  border: `1.5px solid ${c.border}`, cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
                }} 
              />
              {editando && (
                <label style={{ 
                  position: 'absolute', bottom: '-4px', right: '-4px', 
                  width: '28px', height: '28px', borderRadius: '50%',
                  background: c.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', 
                  cursor: 'pointer', border: `2.5px solid ${c.surfaceCard}`, boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
                }}>
                  <Camera size={13} color="#fff" />
                  <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={onCambiarFoto} />
                </label>
              )}
            </div>

            {/* DATOS E IDENTIDAD (SEPARADOS AL EDITAR) */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: editando ? 'stretch' : 'flex-end' }}>
              {editando ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                  <div>
                    <label className="touch-field-label">Nombre(s) *</label>
                    <input 
                      type="text" 
                      value={datosEdit.nombre || ''}
                      onChange={e => handleNombrePartes('nombre', e.target.value)}
                      className="touch-field-input" placeholder="Ej. JUAN CARLOS"
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label className="touch-field-label">Apellido Paterno *</label>
                      <input 
                        type="text" 
                        value={datosEdit.apellido_paterno || ''}
                        onChange={e => handleNombrePartes('apellido_paterno', e.target.value)}
                        className="touch-field-input" placeholder="PÉREZ"
                      />
                    </div>
                    <div>
                      <label className="touch-field-label">Apellido Materno</label>
                      <input 
                        type="text" 
                        value={datosEdit.apellido_materno || ''}
                        onChange={e => handleNombrePartes('apellido_materno', e.target.value)}
                        className="touch-field-input" placeholder="LÓPEZ"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: '17px', fontWeight: '900', color: c.text, lineHeight: '1.2', textTransform: 'uppercase', marginBottom: '4px', wordBreak: 'break-word', textAlign: 'right' }}>
                    {colaborador.nombre_completo}
                  </div>
                  <div style={{ fontSize: '13px', color: c.accent, fontWeight: '800', letterSpacing: '0.02em', textTransform: 'uppercase', textAlign: 'right' }}>
                    {colaborador.puesto || 'SIN PUESTO'}
                  </div>
                </>
              )}

              {/* FIRMA ALINEADA A LA DERECHA (Con fondo protector blanco) */}
              {!editando && colaborador.firma_url && (
                <div style={{ marginTop: '12px', minHeight: '40px', display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
                  <div style={{ background: '#ffffff', padding: '4px 8px', borderRadius: '8px', border: `1.5px solid ${c.border}` }}>
                    <img 
                      src={colaborador.firma_url} alt="Firma" 
                      onClick={() => setFotoZoom && setFotoZoom({ url: colaborador.firma_url, nombre: `Firma de ${colaborador.nombre_completo}` })}
                      style={{ maxHeight: '50px', maxWidth: '150px', objectFit: 'contain', cursor: 'pointer' }} 
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* =========================================================
              RECUADRO DE FIRMA (SOLO AL EDITAR)
              ========================================================= */}
          {editando && (
            <div style={{ background: c.surfaceCard, borderRadius: '16px', padding: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', border: `1.5px solid ${c.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ fontSize: '11px', fontWeight: '800', color: c.accent, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <PenTool size={13} /> Firma Digitalizada
                </div>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 12px', borderRadius: '8px', background: c.accent, color: '#ffffff', fontSize: '11px', fontWeight: '700', cursor: 'pointer', transition: 'opacity 0.2s' }}>
                  <PenTool size={12} /> <span>{urlFirma ? 'Cambiar' : 'Cargar'}</span>
                  <input ref={firmaInputRef} type="file" accept="image/*" hidden onChange={handleCambiarFirma} />
                </label>
              </div>
              <div style={{ width: '100%', height: '85px', borderRadius: '10px', backgroundColor: '#ffffff', border: `2px dashed ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {urlFirma ? (
                  <img src={urlFirma} alt="Firma" style={{ maxHeight: '75px', maxWidth: '90%', objectFit: 'contain' }} />
                ) : (
                  <div style={{ fontSize: '11px', color: '#737373', textAlign: 'center', fontWeight: '500' }}>
                    Sin firma<br/><span style={{ color: c.accent, fontWeight: '700' }}>Toca en Cargar</span>
                  </div>
                )}
              </div>
              {subiendoFirma && <span style={{ fontSize: '11px', color: c.accent, display: 'block', marginTop: '6px', fontWeight: '700' }}>Subiendo firma...</span>}
            </div>
          )}

          {/* =========================================================
              BLOQUE 1: ESTRUCTURA LABORAL Y NACIMIENTO
              ========================================================= */}
          <div style={{ background: c.surfaceCard, borderRadius: '16px', padding: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', border: `1.5px solid ${c.border}` }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', paddingBottom: '16px', borderBottom: `1.5px solid ${c.borderDivider}` }}>
              <div style={{ background: c.accentSoft, padding: '6px', borderRadius: '8px', color: c.accent, display: 'flex' }}>
                <Briefcase size={14} />
              </div>
              <span style={{ fontSize: '12px', fontWeight: '800', color: c.text, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Estructura y Puesto</span>
            </div>

            {editando ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                <div>
                  <label className="touch-field-label">Nº Empleado</label>
                  <input className="touch-field-input mono-id" value={datosEdit.numero_empleado || ''} onChange={e => setDatosEdit({ ...datosEdit, numero_empleado: e.target.value })} />
                </div>
                <div>
                  <label className="touch-field-label">Nómina</label>
                  <select className="touch-field-input" value={datosEdit.tipo_personal || 'produccion'} onChange={e => setDatosEdit({ ...datosEdit, tipo_personal: e.target.value })}>
                    <option value="produccion">PRODUCCIÓN</option>
                    <option value="administrativo">ADMINISTRATIVO</option>
                    <option value="obra">OBRA</option>
                  </select>
                </div>

                {/* SEDE CON SUGERENCIAS */}
                <div>
                  <label className="touch-field-label">Sede / Región</label>
                  {!creandoNuevo.sede ? (
                    <select className="touch-field-input" value={datosEdit.sede_id || ''} onChange={e => e.target.value === 'NEW' ? setCreandoNuevo({ ...creandoNuevo, sede: true }) : setDatosEdit({ ...datosEdit, sede_id: e.target.value })}>
                      <option value="">Sin Sede</option>
                      {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                      <option value="NEW">+ Crear o Buscar...</option>
                    </select>
                  ) : (
                    <div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <input type="text" autoFocus className="touch-field-input" placeholder="Escribe sede..." value={textosNuevos.sede} onChange={e => setTextosNuevos({ ...textosNuevos, sede: e.target.value.toUpperCase() })} />
                        <button type="button" onClick={() => { setCreandoNuevo({ ...creandoNuevo, sede: false }); setTextosNuevos({ ...textosNuevos, sede: '' }); }} style={{ padding: '0 8px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}><X size={14} /></button>
                      </div>
                      {renderSugerencias(textosNuevos.sede, sedes, 'sede')}
                    </div>
                  )}
                </div>

                {/* DEPARTAMENTO CON SUGERENCIAS EN TIEMPO REAL */}
                <div>
                  <label className="touch-field-label">Departamento</label>
                  {!creandoNuevo.depto ? (
                    <select className="touch-field-input" value={datosEdit.departamento_id || ''} onChange={e => e.target.value === 'NEW' ? setCreandoNuevo({ ...creandoNuevo, depto: true }) : setDatosEdit({ ...datosEdit, departamento_id: e.target.value })}>
                      <option value="">Sin Depto</option>
                      {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                      <option value="NEW">+ Crear o Buscar...</option>
                    </select>
                  ) : (
                    <div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <input type="text" autoFocus className="touch-field-input" placeholder="Ej. SISTEMAS..." value={textosNuevos.depto} onChange={e => setTextosNuevos({ ...textosNuevos, depto: e.target.value.toUpperCase() })} />
                        <button type="button" onClick={() => { setCreandoNuevo({ ...creandoNuevo, depto: false }); setTextosNuevos({ ...textosNuevos, depto: '' }); }} style={{ padding: '0 8px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}><X size={14} /></button>
                      </div>
                      {renderSugerencias(textosNuevos.depto, departamentos, 'depto')}
                    </div>
                  )}
                </div>

                <div>
                  <label className="touch-field-label">Área Física</label>
                  <input list="lista-areas-sugeridas" className="touch-field-input" placeholder="Ej. Planta Alta" value={datosEdit.area || ''} onChange={e => setDatosEdit({ ...datosEdit, area: e.target.value })} />
                  <datalist id="lista-areas-sugeridas">{areas.map(a => <option key={a} value={a} />)}</datalist>
                </div>
                <div>
                  <label className="touch-field-label">Puesto Real</label>
                  <input list="lista-puestos-sugeridos" className="touch-field-input" placeholder="Ej. Estimador" value={datosEdit.puesto || ''} onChange={e => setDatosEdit({ ...datosEdit, puesto: e.target.value })} />
                  <datalist id="lista-puestos-sugeridos">{puestos.map(p => <option key={p} value={p} />)}</datalist>
                </div>

                <div>
                  <label className="touch-field-label">Fecha de Nacimiento</label>
                  <input type="date" className="touch-field-input" value={datosEdit.fecha_nacimiento || ''} onChange={e => setDatosEdit({ ...datosEdit, fecha_nacimiento: e.target.value })} />
                </div>
                <div>
                  <label className="touch-field-label">Fecha de Ingreso</label>
                  <input type="date" className="touch-field-input" value={datosEdit.fecha_ingreso || ''} onChange={e => setDatosEdit({ ...datosEdit, fecha_ingreso: e.target.value })} />
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1.5px solid ${c.borderDivider}` }}><span style={{ color: c.textMuted }}>Sede Fija</span><strong style={{ color: c.text }}>{sedeNombre}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1.5px solid ${c.borderDivider}` }}><span style={{ color: c.textMuted }}>Departamento</span><strong style={{ color: c.text }}>{colaborador.departamentos?.nombre || 'No asignado'}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1.5px solid ${c.borderDivider}` }}><span style={{ color: c.textMuted }}>Área Física</span><strong style={{ color: c.text }}>{colaborador.area || 'General'}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1.5px solid ${c.borderDivider}` }}><span style={{ color: c.textMuted }}>Tipo de Nómina</span><strong style={{ color: c.accent, textTransform: 'uppercase' }}>{colaborador.tipo_personal}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1.5px solid ${c.borderDivider}` }}><span style={{ color: c.textMuted }}>Fecha Nacimiento</span><span style={{ fontWeight: '500', color: c.text }}>{colaborador.fecha_nacimiento || 'No registrada'}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}><span style={{ color: c.textMuted }}>Fecha Ingreso</span><span style={{ fontWeight: '500', color: c.text }}>{colaborador.fecha_ingreso || 'No registrada'}</span></div>
              </div>
            )}
          </div>

          {/* =========================================================
              BLOQUE 2: COMUNICACIÓN Y ACCESOS
              ========================================================= */}
          <div style={{ background: c.surfaceCard, borderRadius: '16px', padding: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', border: `1.5px solid ${c.border}` }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', paddingBottom: '16px', borderBottom: `1.5px solid ${c.borderDivider}` }}>
              <div style={{ background: c.accentSoft, padding: '6px', borderRadius: '8px', color: c.accent, display: 'flex' }}>
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
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', fontSize: '13px' }}>
                
                {/* LÍNEA DE CELULAR CON BOTONES AMPLIADOS */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1.5px solid ${c.borderDivider}` }}>
                  <span style={{ color: c.textMuted, flexShrink: 0 }}>Celular</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <strong style={{ color: c.text }}>{colaborador.celular || 'No registrado'}</strong>
                    {!editando && colaborador.celular && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <a href={`tel:${colaborador.celular}`} title="Llamar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '10px', background: c.bg, border: `1.5px solid ${c.border}`, color: c.text, textDecoration: 'none' }}>
                          <Phone size={15} />
                        </a>
                        <a href={`https://wa.me/${colaborador.celular.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" title="WhatsApp" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '10px', background: '#25D366', color: '#fff', border: 'none', textDecoration: 'none', boxShadow: '0 4px 10px rgba(37,211,102,0.3)' }}>
                          <MessageCircle size={16} />
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1.5px solid ${c.borderDivider}` }}><span style={{ color: c.textMuted }}>Teléfono Fijo</span><span style={{ fontWeight: '500', color: c.text }}>{colaborador.telefono || 'No registrado'}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px 0', borderBottom: `1.5px solid ${c.borderDivider}` }}><span style={{ color: c.textMuted, marginTop: '2px', flexShrink: 0 }}>Correo</span><strong style={{ color: c.text, textAlign: 'right', wordBreak: 'break-word', paddingLeft: '20px' }}>{colaborador.correo || 'No registrado'}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1.5px solid ${c.borderDivider}` }}><span style={{ color: c.textMuted }}>Usuario ERP</span><strong style={{ color: c.accent }}>@{colaborador.usuario_login || 'Sin usuario'}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}><span style={{ color: c.textMuted }}>Permisos</span><strong style={{ color: c.text, textTransform: 'uppercase' }}>{colaborador.rol?.replace(/_/g, ' ')}</strong></div>
              </div>
            )}
          </div>

          {/* PROTOCOLO DE BAJA MANTENIDO INTACTO */}
          {editando && (
            <div style={{ background: c.surfaceCard, border: `1.5px solid ${c.border}`, borderRadius: '16px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
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
            padding: '16px 20px', borderTop: `1.5px solid ${c.border}`,
            background: c.surfaceCard, display: 'flex', justifyContent: 'flex-end', gap: '10px', flexShrink: 0
          }}>
            <button 
              onClick={onClose}
              style={{ padding: '10px 16px', borderRadius: '8px', border: `1.5px solid ${c.border}`, background: 'transparent', color: c.textMuted, fontSize: '12.5px', fontWeight: '600', cursor: 'pointer' }}
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