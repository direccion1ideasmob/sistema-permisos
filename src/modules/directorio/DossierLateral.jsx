import React, { useState, useRef, useMemo } from 'react';
import { X, Camera, Save, Briefcase, Phone, ShieldCheck, MessageCircle, PenTool, CheckCircle } from 'lucide-react';
import { estandarizar } from './utils/directorioHelpers';
import { actualizarExpedienteColaborador, eliminarColaboradorDefinitivo } from './services/directorioService';
import { subirImagenUsuario } from '../../core/services/storageService';

export default function DossierLateral({
  colaborador, abierto, onClose, editando, datosEdit, setDatosEdit,
  usuarios = [], departamentos = [], sedes = [], areas = [], puestos = [], subiendoFoto, onCambiarFoto,
  recargarDatos, onAbrirBaja, onReactivar, setFotoZoom, c
}) {
  const fileInputRef = useRef(null);
  const firmaInputRef = useRef(null);

  const [guardando, setGuardando] = useState(false);
  const [subiendoFirma, setSubiendoFirma] = useState(false);
  
  // Estados para "+ Crear Nuevo..." en cualquiera de los 4 catálogos
  const [creandoNuevo, setCreandoNuevo] = useState({ sede: false, depto: false, area: false, puesto: false });
  const [textosNuevos, setTextosNuevos] = useState({ sede: '', depto: '', area: '', puesto: '' });

  const limpiarTexto = (txt) => txt ? estandarizar(txt.toUpperCase()) : '';

  // === CASCADA COHERENTE: Filtrar Subdepartamentos, Puestos y Superiores según el Departamento seleccionado ===
  const deptoActualId = datosEdit?.departamento_id || colaborador?.departamento_id || '';
  const deptoActualObj = departamentos.find(d => d.id === deptoActualId);

  const personalMismoDepto = useMemo(() => {
    if (!deptoActualId) return [];
    return usuarios.filter(u => u.departamento_id === deptoActualId && u.activo !== false);
  }, [usuarios, deptoActualId]);

  // Subdepartamentos que existen en este Departamento (+ el actual del empleado por si es único)
  const subdeptosDelDepto = useMemo(() => {
    const conjunto = new Set();
    if (deptoActualObj?.nombre) conjunto.add(deptoActualObj.nombre.trim().toUpperCase());
    personalMismoDepto.forEach(u => {
      if (u.area) conjunto.add(u.area.trim().toUpperCase());
    });
    if (datosEdit?.area) conjunto.add(datosEdit.area.trim().toUpperCase());
    return [...conjunto].filter(Boolean).sort();
  }, [personalMismoDepto, deptoActualObj, datosEdit?.area]);

  // Puestos que existen en este Departamento (+ el actual del empleado)
  const puestosDelDepto = useMemo(() => {
    const conjunto = new Set();
    personalMismoDepto.forEach(u => {
      if (u.puesto) conjunto.add(u.puesto.trim().toUpperCase());
    });
    if (datosEdit?.puesto) conjunto.add(datosEdit.puesto.trim().toUpperCase());
    return [...conjunto].filter(Boolean).sort();
  }, [personalMismoDepto, datosEdit?.puesto]);

  // Posibles superiores en el organigrama dentro de este mismo Departamento
  const posiblesSuperiores = useMemo(() => {
    if (!colaborador) return [];
    return personalMismoDepto.filter(u => u.id !== colaborador.id && !["empleado", "caseta"].includes(u.rol));
  }, [personalMismoDepto, colaborador]);

  if (!colaborador || !abierto) return null;

  const nombreMostrar = (editando ? datosEdit.nombre_completo : colaborador.nombre_completo) || 'Colaborador';
  const urlFoto = (editando ? datosEdit.foto_url : colaborador.foto_url) || 
    `https://ui-avatars.com/api/?name=${encodeURIComponent(nombreMostrar)}&background=16a34a&color=fff&bold=true`;
  const urlFirma = editando ? datosEdit.firma_url : colaborador.firma_url;
  const sedeNombre = sedes.find(s => s.id === (editando ? datosEdit.sede_id : colaborador.sede_id))?.nombre || 'Sin Sede';
  const superiorNombre = usuarios.find(u => u.id === colaborador.reporta_a_id)?.nombre_completo || 'Directo a Gerencia / Titular';

  const handleNombrePartes = (campo, valor) => {
    const valUpper = valor.toUpperCase();
    const nuevo = { ...datosEdit, [campo]: valUpper };
    const nom = (campo === 'nombre' ? valUpper : (datosEdit.nombre || '')).trim();
    const pat = (campo === 'apellido_paterno' ? valUpper : (datosEdit.apellido_paterno || '')).trim();
    const mat = (campo === 'apellido_materno' ? valUpper : (datosEdit.apellido_materno || '')).trim();
    nuevo.nombre_completo = [nom, pat, mat].filter(Boolean).join(' ') || datosEdit.nombre_completo;
    setDatosEdit(nuevo);
  };

  // Buscador de sugerencias globales cuando el usuario elige "+ Crear Nuevo..."
  const renderSugerencias = (texto, lista, tipo) => {
    if (!texto || texto.trim().length < 1) return null;
    const busq = limpiarTexto(texto);
    const coincidencias = lista.filter(item => {
      const nom = typeof item === 'string' ? item : item.nombre;
      return limpiarTexto(nom).includes(busq);
    });
    if (coincidencias.length === 0) return null;

    return (
      <div style={{ marginTop: '6px', background: c.bg, border: `1px solid ${c.border}`, borderRadius: '8px', padding: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={{ fontSize: '9.5px', color: c.textMuted, paddingLeft: '4px', fontWeight: '700' }}>Existentes en la empresa (Toca para usar):</span>
        {coincidencias.slice(0, 4).map((item, idx) => {
          const etiqueta = typeof item === 'string' ? item : item.nombre;
          return (
            <div
              key={item.id || idx}
              onClick={() => {
                if (tipo === 'sede') {
                  setDatosEdit({ ...datosEdit, sede_id: item.id });
                  setCreandoNuevo({ ...creandoNuevo, sede: false });
                  setTextosNuevos({ ...textosNuevos, sede: '' });
                } else if (tipo === 'depto') {
                  setDatosEdit({ ...datosEdit, departamento_id: item.id, area: item.nombre, puesto: '', reporta_a_id: '' });
                  setCreandoNuevo({ ...creandoNuevo, depto: false });
                  setTextosNuevos({ ...textosNuevos, depto: '' });
                } else if (tipo === 'area') {
                  setDatosEdit({ ...datosEdit, area: etiqueta });
                  setCreandoNuevo({ ...creandoNuevo, area: false });
                  setTextosNuevos({ ...textosNuevos, area: '' });
                } else if (tipo === 'puesto') {
                  setDatosEdit({ ...datosEdit, puesto: etiqueta });
                  setCreandoNuevo({ ...creandoNuevo, puesto: false });
                  setTextosNuevos({ ...textosNuevos, puesto: '' });
                }
              }}
              style={{ fontSize: '11.5px', padding: '6px 8px', background: c.surfaceCard, borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: c.text, fontWeight: '600', border: `1px solid ${c.border}` }}
            >
              <CheckCircle size={13} color={c.accent} /> {etiqueta}
            </div>
          );
        })}
      </div>
    );
  };

  const handleCambiarFirma = async (e) => {
    const archivo = e.target.files[0];
    if (!archivo || !colaborador.id) return;
    setSubiendoFirma(true);
    try {
      const urlFinal = await subirImagenUsuario(archivo, colaborador.id, 'firma');
      setDatosEdit(prev => ({ ...prev, firma_url: urlFinal }));
      alert("Firma cargada en vista previa. Presiona Guardar Cambios para confirmar.");
    } catch (err) {
      alert("Error al subir la firma: " + err.message);
    } finally {
      setSubiendoFirma(false);
    }
  };

  const tramitarBajaSegura = (colab) => {
    const palabra = window.prompt('Para continuar con la baja laboral (conservando su historial), escribe "BAJA":');
    if (palabra === 'BAJA') onAbrirBaja(colab);
    else if (palabra !== null) alert('Palabra incorrecta. Operación cancelada.');
  };

  const handleEliminarDefinitivo = async (colab) => {
    const confirmacion = window.prompt(
      `⚠️ ELIMINACIÓN DEFINITIVA DE BASE DE DATOS Y FOTOS\n\nEstás por borrar para siempre a ${colab.nombre_completo}, incluyendo su foto, su firma del servidor y sus registros.\n\nEscribe "ELIMINAR" (en mayúsculas) para confirmar:`
    );
    if (confirmacion !== 'ELIMINAR') {
      if (confirmacion !== null) alert('Cancelado. No se escribió la palabra ELIMINAR.');
      return;
    }
    setGuardando(true);
    try {
      await eliminarColaboradorDefinitivo(colab.id);
      alert('🗑️ Registro, fotografía y firma eliminados permanentemente del servidor.');
      onClose();
      if (recargarDatos) await recargarDatos();
    } catch (err) {
      alert('Error al eliminar registro: ' + err.message);
    } finally {
      setGuardando(false);
    }
  };

  const handleGuardarExpediente = async () => {
    setGuardando(true);
    try {
      const datosFinales = { ...datosEdit };
      if (creandoNuevo.area && textosNuevos.area.trim()) {
        datosFinales.area = limpiarTexto(textosNuevos.area);
      }
      if (creandoNuevo.puesto && textosNuevos.puesto.trim()) {
        datosFinales.puesto = limpiarTexto(textosNuevos.puesto);
      }

      await actualizarExpedienteColaborador({
        colaboradorId: colaborador.id,
        datosEdit: datosFinales,
        creandoNuevo,
        textosNuevos,
        sedes,
        departamentos
      });
      setCreandoNuevo({ sede: false, depto: false, area: false, puesto: false });
      setTextosNuevos({ sede: '', depto: '', area: '', puesto: '' });
      onClose();
      if (recargarDatos) await recargarDatos();
    } catch (err) {
      alert("Error al guardar: " + err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="dossier-overlay" onClick={onClose}>
      <aside className="dossier-drawer" onClick={e => e.stopPropagation()}>
        <div style={{ padding: '16px 20px', borderBottom: `1.5px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: c.surfaceCard, flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: '11.5px', fontWeight: '800', color: c.accent, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {editando ? 'MODO EDICIÓN HABILITADO' : 'EXPEDIENTE CORPORATIVO'}
            </div>
            <div style={{ fontSize: '11px', color: c.textMuted, marginTop: '2px', display: 'flex', gap: '6px' }}>
              <span>#{colaborador.numero_empleado}</span><span>•</span><span>{sedeNombre}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: c.textMuted, cursor: 'pointer', padding: '6px', display: 'flex' }}>
            <X size={20} />
          </button>
        </div>

        <div className="dossier-body-scroll" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', background: c.bg }}>
          <div style={{ background: c.surfaceCard, borderRadius: '16px', border: `1.5px solid ${c.border}`, padding: '20px', display: 'flex', gap: '16px', alignItems: editando ? 'flex-start' : 'center' }}>
            <div style={{ position: 'relative', width: editando ? '76px' : '95px', height: editando ? '76px' : '105px', flexShrink: 0 }}>
              <img 
                src={urlFoto} alt="" 
                onClick={(e) => { e.stopPropagation(); if (setFotoZoom) setFotoZoom({ url: urlFoto, nombre: colaborador.nombre_completo, puesto: colaborador.puesto }); }}
                style={{ width: '100%', height: '100%', borderRadius: '18px', objectFit: 'cover', border: `1.5px solid ${c.border}`, cursor: 'pointer' }} 
              />
              {editando && (
                <label style={{ position: 'absolute', bottom: '-4px', right: '-4px', width: '28px', height: '28px', borderRadius: '50%', background: c.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: `2.5px solid ${c.surfaceCard}` }}>
                  <Camera size={13} color="#fff" />
                  <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={onCambiarFoto} />
                </label>
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: editando ? 'stretch' : 'flex-end' }}>
              {editando ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                  <div>
                    <label className="touch-field-label">Nombre(s) *</label>
                    <input type="text" value={datosEdit.nombre || ''} onChange={e => handleNombrePartes('nombre', e.target.value)} className="touch-field-input" placeholder="Ej. JUAN CARLOS" />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label className="touch-field-label">Apellido Paterno *</label>
                      <input type="text" value={datosEdit.apellido_paterno || ''} onChange={e => handleNombrePartes('apellido_paterno', e.target.value)} className="touch-field-input" placeholder="PÉREZ" />
                    </div>
                    <div>
                      <label className="touch-field-label">Apellido Materno</label>
                      <input type="text" value={datosEdit.apellido_materno || ''} onChange={e => handleNombrePartes('apellido_materno', e.target.value)} className="touch-field-input" placeholder="LÓPEZ" />
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: '17px', fontWeight: '900', color: c.text, lineHeight: '1.2', textTransform: 'uppercase', marginBottom: '4px', textAlign: 'right' }}>
                    {colaborador.nombre_completo}
                  </div>
                  <div style={{ fontSize: '13px', color: c.accent, fontWeight: '800', textTransform: 'uppercase', textAlign: 'right' }}>
                    {colaborador.puesto || 'SIN PUESTO'}
                  </div>
                </>
              )}

              {!editando && colaborador.firma_url && (
                <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
                  <div style={{ background: '#ffffff', padding: '4px 8px', borderRadius: '8px', border: `1.5px solid ${c.border}` }}>
                    <img src={colaborador.firma_url} alt="Firma" onClick={() => setFotoZoom && setFotoZoom({ url: colaborador.firma_url, nombre: `Firma de ${colaborador.nombre_completo}` })} style={{ maxHeight: '50px', maxWidth: '150px', objectFit: 'contain', cursor: 'pointer' }} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {editando && (
            <div style={{ background: c.surfaceCard, borderRadius: '16px', padding: '16px', border: `1.5px solid ${c.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ fontSize: '11px', fontWeight: '800', color: c.accent, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <PenTool size={13} /> Firma Digitalizada
                </div>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 12px', borderRadius: '8px', background: c.accent, color: '#ffffff', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                  <PenTool size={12} /> <span>{urlFirma ? 'Cambiar' : 'Cargar'}</span>
                  <input ref={firmaInputRef} type="file" accept="image/*" hidden onChange={handleCambiarFirma} />
                </label>
              </div>
              <div style={{ width: '100%', height: '85px', borderRadius: '10px', backgroundColor: '#ffffff', border: `2px dashed ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {urlFirma ? <img src={urlFirma} alt="Firma" style={{ maxHeight: '75px', maxWidth: '90%', objectFit: 'contain' }} /> : <div style={{ fontSize: '11px', color: '#737373', textAlign: 'center' }}>Sin firma</div>}
              </div>
              {subiendoFirma && <span style={{ fontSize: '11px', color: c.accent, display: 'block', marginTop: '6px', fontWeight: '700' }}>Subiendo firma...</span>}
            </div>
          )}

          {/* =========================================================
              BLOQUE 1: ESTRUCTURA Y PUESTO (EN CASCADA COHERENTE)
              ========================================================= */}
          <div style={{ background: c.surfaceCard, borderRadius: '16px', padding: '20px', border: `1.5px solid ${c.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', paddingBottom: '16px', borderBottom: `1.5px solid ${c.borderDivider}` }}>
              <div style={{ background: c.accentSoft, padding: '6px', borderRadius: '8px', color: c.accent, display: 'flex' }}><Briefcase size={14} /></div>
              <span style={{ fontSize: '12px', fontWeight: '800', color: c.text, textTransform: 'uppercase' }}>Estructura y Puesto</span>
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

                {/* 1. SEDE */}
                <div>
                  <label className="touch-field-label">Sede / Región</label>
                  {!creandoNuevo.sede ? (
                    <select className="touch-field-input" value={datosEdit.sede_id || ''} onChange={e => e.target.value === 'NEW' ? setCreandoNuevo({ ...creandoNuevo, sede: true }) : setDatosEdit({ ...datosEdit, sede_id: e.target.value })}>
                      <option value="">Sin Sede</option>
                      {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                      <option value="NEW">+ Crear Nueva Sede...</option>
                    </select>
                  ) : (
                    <div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <input type="text" autoFocus className="touch-field-input" placeholder="Nueva sede..." value={textosNuevos.sede} onChange={e => setTextosNuevos({ ...textosNuevos, sede: e.target.value.toUpperCase() })} />
                        <button type="button" onClick={() => { setCreandoNuevo({ ...creandoNuevo, sede: false }); setTextosNuevos({ ...textosNuevos, sede: '' }); }} style={{ padding: '0 8px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}><X size={14} /></button>
                      </div>
                      {renderSugerencias(textosNuevos.sede, sedes, 'sede')}
                    </div>
                  )}
                </div>

                {/* 2. DEPARTAMENTO (Manda sobre Subdepto, Puesto y Superior) */}
                <div>
                  <label className="touch-field-label">Departamento</label>
                  {!creandoNuevo.depto ? (
                    <select 
                      className="touch-field-input" 
                      value={datosEdit.departamento_id || ''} 
                      onChange={e => {
                        if (e.target.value === 'NEW') {
                          setCreandoNuevo({ ...creandoNuevo, depto: true });
                        } else {
                          const nuevoDepto = departamentos.find(d => d.id === e.target.value);
                          // Al cambiar de Departamento, sincronizamos Subdepto al nombre del nuevo depto y limpiamos Superior
                          setDatosEdit({ 
                            ...datosEdit, 
                            departamento_id: e.target.value,
                            area: nuevoDepto ? nuevoDepto.nombre : '',
                            reporta_a_id: ''
                          });
                        }
                      }}
                    >
                      <option value="">Sin Depto</option>
                      {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                      <option value="NEW">+ Crear Nuevo Depto...</option>
                    </select>
                  ) : (
                    <div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <input type="text" autoFocus className="touch-field-input" placeholder="Nuevo depto..." value={textosNuevos.depto} onChange={e => setTextosNuevos({ ...textosNuevos, depto: e.target.value.toUpperCase() })} />
                        <button type="button" onClick={() => { setCreandoNuevo({ ...creandoNuevo, depto: false }); setTextosNuevos({ ...textosNuevos, depto: '' }); }} style={{ padding: '0 8px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}><X size={14} /></button>
                      </div>
                      {renderSugerencias(textosNuevos.depto, departamentos, 'depto')}
                    </div>
                  )}
                </div>

                {/* 3. SUBDEPARTAMENTO / ÁREA (Select filtrado por el Departamento + opción de crear nuevo) */}
                <div>
                  <label className="touch-field-label">Subdepto / Área</label>
                  {!creandoNuevo.area ? (
                    <select 
                      className="touch-field-input" 
                      value={datosEdit.area || ''} 
                      onChange={e => e.target.value === 'NEW' ? setCreandoNuevo({ ...creandoNuevo, area: true }) : setDatosEdit({ ...datosEdit, area: e.target.value })}
                    >
                      <option value="">Seleccionar Subdepto / Área</option>
                      {subdeptosDelDepto.map(sub => <option key={sub} value={sub}>{sub}</option>)}
                      <option value="NEW">+ Crear Nuevo Subdepto...</option>
                    </select>
                  ) : (
                    <div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <input type="text" autoFocus className="touch-field-input" placeholder="Nuevo subdepto..." value={textosNuevos.area} onChange={e => setTextosNuevos({ ...textosNuevos, area: e.target.value.toUpperCase() })} />
                        <button type="button" onClick={() => { setCreandoNuevo({ ...creandoNuevo, area: false }); setTextosNuevos({ ...textosNuevos, area: '' }); }} style={{ padding: '0 8px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}><X size={14} /></button>
                      </div>
                      {renderSugerencias(textosNuevos.area, areas, 'area')}
                    </div>
                  )}
                </div>

                {/* 4. PUESTO REAL (Select filtrado por el Departamento + opción de crear nuevo) */}
                <div>
                  <label className="touch-field-label">Puesto Real</label>
                  {!creandoNuevo.puesto ? (
                    <select 
                      className="touch-field-input" 
                      value={datosEdit.puesto || ''} 
                      onChange={e => e.target.value === 'NEW' ? setCreandoNuevo({ ...creandoNuevo, puesto: true }) : setDatosEdit({ ...datosEdit, puesto: e.target.value })}
                    >
                      <option value="">Sin Puesto Asignado</option>
                      {puestosDelDepto.map(p => <option key={p} value={p}>{p}</option>)}
                      <option value="NEW">+ Crear Nuevo Puesto...</option>
                    </select>
                  ) : (
                    <div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <input type="text" autoFocus className="touch-field-input" placeholder="Nuevo puesto..." value={textosNuevos.puesto} onChange={e => setTextosNuevos({ ...textosNuevos, puesto: e.target.value.toUpperCase() })} />
                        <button type="button" onClick={() => { setCreandoNuevo({ ...creandoNuevo, puesto: false }); setTextosNuevos({ ...textosNuevos, puesto: '' }); }} style={{ padding: '0 8px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}><X size={14} /></button>
                      </div>
                      {renderSugerencias(textosNuevos.puesto, puestos, 'puesto')}
                    </div>
                  )}
                </div>

                {/* 5. SUPERIOR EN EL ORGANIGRAMA (Para acomodar quién está debajo de quién en este Depto) */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="touch-field-label">Superior en Organigrama (De quién depende en el árbol)</label>
                  <select 
                    className="touch-field-input" 
                    value={datosEdit.reporta_a_id || ''} 
                    onChange={e => setDatosEdit({ ...datosEdit, reporta_a_id: e.target.value })}
                  >
                    <option value="">Directo a Gerencia / Titular de su Área</option>
                    {posiblesSuperiores.map(sup => (
                      <option key={sup.id} value={sup.id}>
                        {sup.nombre_completo} — ({sup.puesto || sup.area})
                      </option>
                    ))}
                  </select>
                </div>

                <div><label className="touch-field-label">Fecha de Nacimiento</label><input type="date" className="touch-field-input" value={datosEdit.fecha_nacimiento || ''} onChange={e => setDatosEdit({ ...datosEdit, fecha_nacimiento: e.target.value })} /></div>
                <div><label className="touch-field-label">Fecha de Ingreso</label><input type="date" className="touch-field-input" value={datosEdit.fecha_ingreso || ''} onChange={e => setDatosEdit({ ...datosEdit, fecha_ingreso: e.target.value })} /></div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1.5px solid ${c.borderDivider}` }}><span style={{ color: c.textMuted }}>Sede Fija</span><strong style={{ color: c.text }}>{sedeNombre}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1.5px solid ${c.borderDivider}` }}><span style={{ color: c.textMuted }}>Departamento</span><strong style={{ color: c.text }}>{colaborador.departamentos?.nombre || 'No asignado'}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1.5px solid ${c.borderDivider}` }}><span style={{ color: c.textMuted }}>Subdepto / Área</span><strong style={{ color: c.text }}>{colaborador.area || 'General'}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1.5px solid ${c.borderDivider}` }}><span style={{ color: c.textMuted }}>Superior en Árbol</span><strong style={{ color: c.text }}>{superiorNombre}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1.5px solid ${c.borderDivider}` }}><span style={{ color: c.textMuted }}>Tipo de Nómina</span><strong style={{ color: c.accent, textTransform: 'uppercase' }}>{colaborador.tipo_personal}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1.5px solid ${c.borderDivider}` }}><span style={{ color: c.textMuted }}>Fecha Nacimiento</span><span style={{ fontWeight: '500', color: c.text }}>{colaborador.fecha_nacimiento || 'No registrada'}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}><span style={{ color: c.textMuted }}>Fecha Ingreso</span><span style={{ fontWeight: '500', color: c.text }}>{colaborador.fecha_ingreso || 'No registrada'}</span></div>
              </div>
            )}
          </div>

          <div style={{ background: c.surfaceCard, borderRadius: '16px', padding: '20px', border: `1.5px solid ${c.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', paddingBottom: '16px', borderBottom: `1.5px solid ${c.borderDivider}` }}>
              <div style={{ background: c.accentSoft, padding: '6px', borderRadius: '8px', color: c.accent, display: 'flex' }}><ShieldCheck size={14} /></div>
              <span style={{ fontSize: '12px', fontWeight: '800', color: c.text, textTransform: 'uppercase' }}>Sistemas y Contacto</span>
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
                    <option value="empleado">EMPLEADO / OPERADOR (NIVEL 4)</option>
                    <option value="encargado">ENCARGADO / SUPERVISOR SUBÁREA (NIVEL 3)</option>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1.5px solid ${c.borderDivider}` }}>
                  <span style={{ color: c.textMuted }}>Celular</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <strong style={{ color: c.text }}>{colaborador.celular || 'No registrado'}</strong>
                    {colaborador.celular && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <a href={`tel:${colaborador.celular}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '10px', background: c.bg, border: `1.5px solid ${c.border}`, color: c.text, textDecoration: 'none' }}><Phone size={15} /></a>
                        <a href={`https://wa.me/${colaborador.celular.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '10px', background: '#25D366', color: '#fff', textDecoration: 'none' }}><MessageCircle size={16} /></a>
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1.5px solid ${c.borderDivider}` }}><span style={{ color: c.textMuted }}>Teléfono Fijo</span><span style={{ fontWeight: '500', color: c.text }}>{colaborador.telefono || 'No registrado'}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1.5px solid ${c.borderDivider}` }}><span style={{ color: c.textMuted }}>Correo</span><strong style={{ color: c.text }}>{colaborador.correo || 'No registrado'}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1.5px solid ${c.borderDivider}` }}><span style={{ color: c.textMuted }}>Usuario ERP</span><strong style={{ color: c.accent }}>@{colaborador.usuario_login || 'Sin usuario'}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}><span style={{ color: c.textMuted }}>Permisos</span><strong style={{ color: c.text, textTransform: 'uppercase' }}>{colaborador.rol?.replace(/_/g, ' ')}</strong></div>
              </div>
            )}
          </div>

          {editando && (
            <div style={{ background: c.surfaceCard, border: `1.5px solid ${c.border}`, borderRadius: '16px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '11px', color: c.textMuted, fontWeight: '800', marginBottom: '4px' }}>ESTATUS LABORAL</div>
                {colaborador.activo ? <span style={{ fontSize: '12px', color: c.accent, fontWeight: '800' }}>● ACTIVO EN NÓMINA</span> : <div style={{ fontSize: '12px', color: c.danger, fontWeight: '800' }}>● BAJA ({colaborador.motivo_baja || 'Separado'})</div>}
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {colaborador.activo ? (
                  <button type="button" onClick={() => tramitarBajaSegura(colaborador)} style={{ background: c.warningSoft || 'rgba(245,158,11,0.15)', color: '#d97706', border: '1px solid rgba(245,158,11,0.3)', padding: '8px 14px', borderRadius: '8px', fontSize: '11.5px', fontWeight: '800', cursor: 'pointer' }}>
                    Tramitar Baja
                  </button>
                ) : (
                  <button type="button" onClick={() => onReactivar(colaborador)} style={{ background: c.accentSoft, color: c.accent, border: 'none', padding: '8px 14px', borderRadius: '8px', fontSize: '11.5px', fontWeight: '800', cursor: 'pointer' }}>
                    Reactivar
                  </button>
                )}
                <button type="button" onClick={() => handleEliminarDefinitivo(colaborador)} disabled={guardando} style={{ background: c.dangerSoft, color: c.danger, border: `1px solid ${c.danger}`, padding: '8px 14px', borderRadius: '8px', fontSize: '11.5px', fontWeight: '800', cursor: 'pointer' }}>
                  Eliminar Registro y Fotos
                </button>
              </div>
            </div>
          )}
        </div>

        {editando && (
          <div style={{ padding: '16px 20px', borderTop: `1.5px solid ${c.border}`, background: c.surfaceCard, display: 'flex', justifyContent: 'flex-end', gap: '10px', flexShrink: 0 }}>
            <button onClick={onClose} style={{ padding: '10px 16px', borderRadius: '8px', border: `1.5px solid ${c.border}`, background: 'transparent', color: c.textMuted, fontSize: '12.5px', fontWeight: '600', cursor: 'pointer' }}>Cancelar</button>
            <button onClick={handleGuardarExpediente} disabled={guardando} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: c.accent, color: '#fff', fontSize: '12.5px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Save size={14} /> {guardando ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
