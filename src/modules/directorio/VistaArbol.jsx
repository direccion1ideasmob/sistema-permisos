import React, { useState, useRef, useEffect } from 'react';
import { 
  Factory, Building2, HardHat, ChevronDown, ChevronRight, 
  Layers, Edit2, Crown, UserCheck, Lock, Unlock, X, Save, CornerDownRight
} from 'lucide-react';
import { obtenerBadgeRol, obtenerClaveOrdenApellido, estandarizar } from './utils/directorioHelpers';
import { actualizarDepartamentoSeguro, reubicarColaboradorEnArbol } from './services/directorioService';
import { obtenerTemaGlobal } from '../../core/theme/temaGlobal';
import ModalSeguridadPin from './ModalSeguridadPin';

const normalizar = (txt) => txt ? estandarizar(txt.toUpperCase()) : 'GENERAL';

export default function VistaArbol({ 
  usuarios = [], departamentos = [], deptosAbiertos = {}, toggleDepto, 
  recargarDatos, setFotoZoom, modoOscuro 
}) {
  const [filtro, setFiltro] = useState('ALL');
  const [esMobile, setEsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setEsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [seguridadDesbloqueada, setSeguridadDesbloqueada] = useState(false);
  const [modalPinAbierto, setModalPinAbierto] = useState(false);

  // Estado para editar Departamento
  const [deptoEditandoId, setDeptoEditandoId] = useState(null);
  const [nombreDeptoAnterior, setNombreDeptoAnterior] = useState('');
  const [nombreEdit, setNombreEdit] = useState('');
  const [clasifEdit, setClasifEdit] = useState('produccion');
  const [guardando, setGuardando] = useState(false);
  const popoverRef = useRef(null);

  // Estado para reacomodar Empleado en el Árbol
  const [userEditando, setUserEditando] = useState(null);

  useEffect(() => {
    const clickFuera = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setDeptoEditandoId(null);
      }
    };
    document.addEventListener('mousedown', clickFuera);
    return () => document.removeEventListener('mousedown', clickFuera);
  }, []);

  const tema = obtenerTemaGlobal(modoOscuro);
  const c = {
    ...tema,
    subText: tema.textMuted,
    line: tema.border,
    hoverBg: modoOscuro ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)',
    popoverBg: tema.surfaceCard,
    popoverBorder: tema.border,
  };

  const secciones = [
    { key: 'produccion', label: 'Producción', icon: Factory, match: 'prod' },
    { key: 'administrativo', label: 'Administración', icon: Building2, match: 'admin' },
    { key: 'obra', label: 'Obra', icon: HardHat, match: 'obra' }
  ];

  const seccionesVisibles = filtro === 'ALL' ? secciones : secciones.filter(s => s.key === filtro);

  const iniciarEdicionRapidaDepto = (depto, e) => {
    e.stopPropagation();
    setDeptoEditandoId(depto.id);
    setNombreDeptoAnterior(depto.nombre);
    setNombreEdit(depto.nombre);
    setClasifEdit((depto.clasificacion || 'produccion').toLowerCase().trim());
  };

  const guardarDepto = async (e) => {
    e.preventDefault();
    if (!nombreEdit.trim()) return alert("Ingresa un nombre para el departamento.");

    setGuardando(true);
    try {
      await actualizarDepartamentoSeguro(deptoEditandoId, nombreEdit, clasifEdit, nombreDeptoAnterior);
      setDeptoEditandoId(null);
      if (recargarDatos) await recargarDatos();
    } catch (err) {
      alert("Error al actualizar: " + err.message);
    } finally {
      setGuardando(false);
    }
  };

  const abrirEdicionUsuarioArbol = (u, e) => {
    e.stopPropagation();
    setUserEditando({
      id: u.id,
      nombre_completo: u.nombre_completo,
      departamento_id: u.departamento_id || '',
      area: u.area || '',
      puesto: u.puesto || '',
      rol: u.rol || 'empleado',
      reporta_a_id: u.reporta_a_id || ''
    });
  };

  const guardarReubicacionUsuario = async (e) => {
    e.preventDefault();
    if (!userEditando) return;
    setGuardando(true);
    try {
      await reubicarColaboradorEnArbol({
        colaboradorId: userEditando.id,
        departamentoId: userEditando.departamento_id,
        area: userEditando.area,
        puesto: userEditando.puesto,
        rol: userEditando.rol,
        reportaAId: userEditando.reporta_a_id || null
      });
      setUserEditando(null);
      if (recargarDatos) await recargarDatos();
    } catch (err) {
      alert("Error al reubicar colaborador: " + err.message);
    } finally {
      setGuardando(false);
    }
  };

  // Filtrado en cascada para el modal de reubicación rápida
  const areasDelDeptoSeleccionado = userEditando
    ? [...new Set(usuarios.filter(u => u.departamento_id === userEditando.departamento_id && u.area).map(u => u.area.trim().toUpperCase()))].sort()
    : [];

  const puestosDelDeptoSeleccionado = userEditando
    ? [...new Set(usuarios.filter(u => u.departamento_id === userEditando.departamento_id && u.puesto).map(u => u.puesto.trim().toUpperCase()))].sort()
    : [];

  const posiblesJefesEnDepto = userEditando
    ? usuarios.filter(u => u.departamento_id === userEditando.departamento_id && u.activo && u.id !== userEditando.id)
    : [];

  return (
    <div style={{ width: '100%', boxSizing: 'border-box', fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          {seguridadDesbloqueada ? (
            <button onClick={() => setSeguridadDesbloqueada(false)} style={{ background: c.accentSoft, border: `1px solid ${c.accent}`, padding: '5px 10px', borderRadius: '6px', color: c.accent, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: '700' }}>
              <Unlock size={14} /> Modo Acomodo de Organigrama Activo (Toca el lápiz en cualquier depto o persona)
            </button>
          ) : (
            <button onClick={() => setModalPinAbierto(true)} style={{ background: c.surfaceCard, border: `1px solid ${c.border}`, padding: '5px 12px', borderRadius: '6px', color: c.text, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '600' }} title="Desbloquear acomodo de organigrama">
              <Lock size={13} color="#f59e0b" /> <span>Editar Organigrama</span>
            </button>
          )}
        </div>

        <select 
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          style={{ background: 'transparent', border: 'none', borderBottom: `1.5px solid ${c.line}`, color: c.text, fontSize: '12px', fontWeight: '600', padding: '4px 2px', outline: 'none', cursor: 'pointer' }}
        >
          <option value="ALL" style={{ background: c.popoverBg }}>Estructura Completa</option>
          <option value="produccion" style={{ background: c.popoverBg }}>Producción</option>
          <option value="administrativo" style={{ background: c.popoverBg }}>Administración</option>
          <option value="obra" style={{ background: c.popoverBg }}>Obra</option>
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
        {seccionesVisibles.map(sec => {
          const IconoSec = sec.icon;
          const deptosSec = (departamentos || []).filter(d => {
            const esDeEstaRama = (d.clasificacion || 'produccion').toLowerCase().includes(sec.match);
            return esDeEstaRama && (seguridadDesbloqueada || usuarios.some(u => u.departamento_id === d.id && u.activo === true));
          });

          if (deptosSec.length === 0) return null;

          return (
            <div key={sec.key}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', paddingBottom: '8px', borderBottom: `1.5px solid ${c.line}` }}>
                <IconoSec size={16} color={c.text} />
                <span style={{ fontSize: '14px', fontWeight: '800', color: c.text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {sec.label}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {deptosSec.map(depto => {
                  const abierto = Boolean(deptosAbiertos[depto.id]);
                  const estaEditando = deptoEditandoId === depto.id;
                  const nombreDeptoNorm = normalizar(depto.nombre);

                  const personalDepto = (usuarios || [])
                    .filter(u => u.departamento_id === depto.id && u.activo === true)
                    .sort((a, b) => obtenerClaveOrdenApellido(a).localeCompare(obtenerClaveOrdenApellido(b)));

                  const gerencia = personalDepto.filter(u => ['superadmin', 'gerente_produccion', 'gerente_admin', 'gerente_rh'].includes(u.rol));
                  const idsGerencia = new Set(gerencia.map(g => g.id));
                  const restoPersonal = personalDepto.filter(u => !idsGerencia.has(u.id));

                  const subdeptosMap = restoPersonal.reduce((acc, u) => {
                    const claveArea = normalizar(u.area || depto.nombre);
                    const etiquetaArea = (u.area || depto.nombre).trim().toUpperCase();
                    if (!acc[claveArea]) {
                      acc[claveArea] = { etiqueta: etiquetaArea, miembros: [] };
                    }
                    acc[claveArea].miembros.push(u);
                    return acc;
                  }, {});

                  const clavesSubdeptos = Object.keys(subdeptosMap).sort();
                  const mostrarCabeceraSubdepto = clavesSubdeptos.length > 1 || (clavesSubdeptos.length === 1 && clavesSubdeptos[0] !== nombreDeptoNorm && clavesSubdeptos[0] !== 'GENERAL');

                  return (
                    <div key={depto.id} style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
                      <div 
                        onClick={() => toggleDepto(depto.id)}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', background: abierto ? c.hoverBg : 'transparent' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {abierto ? <ChevronDown size={14} color={c.subText} /> : <ChevronRight size={14} color={c.subText} />}
                          <span style={{ fontSize: '13px', fontWeight: '700', color: c.text }}>{depto.nombre}</span>
                          <span style={{ fontSize: '11px', color: c.subText, fontWeight: '500' }}>{personalDepto.length} pers.</span>
                        </div>

                        {seguridadDesbloqueada && (
                          <button onClick={(e) => iniciarEdicionRapidaDepto(depto, e)} style={{ background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '6px', color: c.accent, cursor: 'pointer', padding: '4px 8px', fontSize: '11px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Edit2 size={12} /> Editar Depto
                          </button>
                        )}
                      </div>

                      {estaEditando && (
                        <div ref={popoverRef} onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: '38px', right: '10px', background: c.popoverBg, border: `1.5px solid ${c.popoverBorder}`, borderRadius: '12px', padding: '14px', zIndex: 300, boxShadow: '0 10px 30px rgba(0,0,0,0.5)', width: '270px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', fontWeight: '800', color: c.text }}>Renombrar / Reclasificar Depto</span>
                            <button onClick={() => setDeptoEditandoId(null)} style={{ background: 'none', border: 'none', color: c.subText, cursor: 'pointer' }}><X size={14} /></button>
                          </div>

                          <form onSubmit={guardarDepto} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <input type="text" value={nombreEdit} onChange={e => setNombreEdit(e.target.value.toUpperCase())} placeholder="Nombre del depto" autoFocus style={{ width: '100%', height: '34px', padding: '0 8px', borderRadius: '8px', border: `1px solid ${c.popoverBorder}`, background: c.inputBg, color: c.text, fontSize: '12px', fontWeight: '700', outline: 'none', boxSizing: 'border-box' }} />
                            <div style={{ display: 'flex', gap: '4px' }}>
                              {[ { key: 'produccion', label: 'Producción' }, { key: 'administrativo', label: 'Admón' }, { key: 'obra', label: 'Obra' } ].map(op => (
                                <button key={op.key} type="button" onClick={() => setClasifEdit(op.key)} style={{ flex: 1, padding: '6px 2px', borderRadius: '6px', border: `1px solid ${clasifEdit === op.key ? c.accent : c.popoverBorder}`, background: clasifEdit === op.key ? c.accentSoft : 'transparent', color: clasifEdit === op.key ? c.accent : c.subText, fontSize: '10.5px', fontWeight: '700', cursor: 'pointer' }}>
                                  {op.label}
                                </button>
                              ))}
                            </div>
                            <button type="submit" disabled={guardando} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: 'none', background: c.accent, color: '#fff', fontSize: '12px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                              <Save size={13} /> {guardando ? 'Guardando...' : 'Guardar Cambios'}
                            </button>
                          </form>
                        </div>
                      )}

                      {abierto && (
                        <div style={{ marginLeft: esMobile ? '10px' : '16px', paddingTop: '6px', paddingBottom: '8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          
                          {gerencia.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ fontSize: '10px', fontWeight: '800', color: '#f59e0b', textTransform: 'uppercase', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Crown size={11} /> Gerencia / Dirección
                              </div>
                              {gerencia.map(u => renderItemLista(u, c, setFotoZoom, modoOscuro, seguridadDesbloqueada, abrirEdicionUsuarioArbol))}
                            </div>
                          )}

                          {clavesSubdeptos.length > 0 && (
                            <div style={{ 
                              display: 'flex', flexDirection: 'column', gap: '14px',
                              marginLeft: gerencia.length > 0 ? (esMobile ? '12px' : '18px') : '0',
                              borderLeft: gerencia.length > 0 ? `1.5px solid ${c.line}` : 'none',
                              paddingLeft: gerencia.length > 0 ? '12px' : '0'
                            }}>
                              {clavesSubdeptos.map(clave => {
                                const grupo = subdeptosMap[clave];
                                const idsGrupo = new Set(grupo.miembros.map(m => m.id));

                                // Detectar subordinados explícitos (por reporta_a_id dentro del mismo subdepto) o por rol jefe_area
                                const tieneSubordinadosExplicitos = new Set(
                                  grupo.miembros.filter(m => m.reporta_a_id && idsGrupo.has(m.reporta_a_id)).map(m => m.reporta_a_id)
                                );

                                // Cabezas del subdepartamento: quienes no reportan a nadie dentro de este mismo subdepto
                                const cabezasSubdepto = grupo.miembros.filter(
                                  m => !m.reporta_a_id || !idsGrupo.has(m.reporta_a_id)
                                );

                                // Si no se ha configurado reporta_a_id pero hay un jefe_area en el subdepto, los demás cuelgan de él por defecto
                                const jefePorRol = cabezasSubdepto.find(m => m.rol === 'jefe_area');

                                return (
                                  <div key={clave} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                    {mostrarCabeceraSubdepto && (
                                      <div style={{ fontSize: '10.5px', fontWeight: '800', color: c.subText, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '5px', letterSpacing: '0.03em' }}>
                                        <Layers size={11} color={c.accent} /> {grupo.etiqueta}
                                      </div>
                                    )}

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginLeft: mostrarCabeceraSubdepto ? '8px' : '0' }}>
                                      {cabezasSubdepto.map(titular => {
                                        // Si hay un jefe_area por rol y este miembro no es el jefe ni tiene subordinados propios, se mostrará abajo del jefe_area
                                        if (jefePorRol && titular.id !== jefePorRol.id && !tieneSubordinadosExplicitos.has(titular.id)) {
                                          return null;
                                        }

                                        const subordinadosDeEsteTitular = grupo.miembros.filter(sub => {
                                          if (sub.id === titular.id) return false;
                                          if (sub.reporta_a_id === titular.id) return true;
                                          if (!sub.reporta_a_id && jefePorRol && titular.id === jefePorRol.id && sub.rol !== 'jefe_area') return true;
                                          return false;
                                        });

                                        const mostrarEtiquetaResponsable = titular.rol === 'jefe_area' || subordinadosDeEsteTitular.length > 0;

                                        return (
                                          <div key={titular.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            {mostrarEtiquetaResponsable && (
                                              <div style={{ fontSize: '9.5px', fontWeight: '800', color: '#3b82f6', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <UserCheck size={11} /> {titular.rol === 'jefe_area' ? 'Jefatura de Área' : 'Titular / Responsable'}
                                              </div>
                                            )}

                                            {renderItemLista(titular, c, setFotoZoom, modoOscuro, seguridadDesbloqueada, abrirEdicionUsuarioArbol)}

                                            {subordinadosDeEsteTitular.length > 0 && (
                                              <div style={{
                                                display: 'flex', flexDirection: 'column', gap: '4px',
                                                marginLeft: esMobile ? '14px' : '20px',
                                                borderLeft: `1.5px solid ${c.line}`,
                                                paddingLeft: '10px', marginTop: '2px'
                                              }}>
                                                {subordinadosDeEsteTitular.map(sub => renderItemLista(sub, c, setFotoZoom, modoOscuro, seguridadDesbloqueada, abrirEdicionUsuarioArbol, true))}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL PARA ACOMODAR COLABORADOR EN EL ORGANIGRAMA CON CASCADA COHERENTE */}
      {userEditando && (
        <div onClick={() => setUserEditando(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2500, padding: '16px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '16px', padding: '20px', width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${c.border}`, paddingBottom: '10px' }}>
              <div>
                <div style={{ fontSize: '10.5px', fontWeight: '800', color: c.accent, textTransform: 'uppercase' }}>Acomodar en Organigrama</div>
                <div style={{ fontSize: '14px', fontWeight: '800', color: c.text }}>{userEditando.nombre_completo}</div>
              </div>
              <button onClick={() => setUserEditando(null)} style={{ background: 'none', border: 'none', color: c.subText, cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <form onSubmit={guardarReubicacionUsuario} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: c.subText, marginBottom: '4px', textTransform: 'uppercase' }}>1. Departamento</label>
                <select
                  value={userEditando.departamento_id}
                  onChange={e => {
                    const nuevoDeptoId = e.target.value;
                    const dObj = departamentos.find(d => d.id === nuevoDeptoId);
                    setUserEditando({
                      ...userEditando,
                      departamento_id: nuevoDeptoId,
                      area: dObj ? dObj.nombre : '',
                      reporta_a_id: ''
                    });
                  }}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${c.border}`, background: c.inputBg, color: c.text, fontSize: '12.5px', fontWeight: '600' }}
                >
                  {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: c.subText, marginBottom: '4px', textTransform: 'uppercase' }}>2. Subdepartamento / Área</label>
                <input
                  list="areas-coherentes-arbol"
                  value={userEditando.area}
                  onChange={e => setUserEditando({ ...userEditando, area: e.target.value.toUpperCase() })}
                  placeholder="Ej. NOMINAS, SEGURIDAD INDUSTRIAL..."
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${c.border}`, background: c.inputBg, color: c.text, fontSize: '12.5px', fontWeight: '600', boxSizing: 'border-box' }}
                />
                <datalist id="areas-coherentes-arbol">
                  {areasDelDeptoSeleccionado.map(a => <option key={a} value={a} />)}
                </datalist>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: c.subText, marginBottom: '4px', textTransform: 'uppercase' }}>3. Puesto</label>
                <input
                  list="puestos-coherentes-arbol"
                  value={userEditando.puesto}
                  onChange={e => setUserEditando({ ...userEditando, puesto: e.target.value.toUpperCase() })}
                  placeholder="Ej. AUXILIAR DE RH..."
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${c.border}`, background: c.inputBg, color: c.text, fontSize: '12.5px', fontWeight: '600', boxSizing: 'border-box' }}
                />
                <datalist id="puestos-coherentes-arbol">
                  {puestosDelDeptoSeleccionado.map(p => <option key={p} value={p} />)}
                </datalist>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: c.subText, marginBottom: '4px', textTransform: 'uppercase' }}>4. En el Organigrama está debajo de (Superior):</label>
                <select
                  value={userEditando.reporta_a_id || ''}
                  onChange={e => setUserEditando({ ...userEditando, reporta_a_id: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${c.border}`, background: c.inputBg, color: c.text, fontSize: '12.5px', fontWeight: '600' }}
                >
                  <option value="">Directo en su Área / Gerencia del Depto</option>
                  {posiblesJefesEnDepto.map(j => (
                    <option key={j.id} value={j.id}>{j.nombre_completo} ({j.puesto || j.area})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: c.subText, marginBottom: '4px', textTransform: 'uppercase' }}>5. Rol de Permisos en Sistema</label>
                <select
                  value={userEditando.rol}
                  onChange={e => setUserEditando({ ...userEditando, rol: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${c.border}`, background: c.inputBg, color: c.text, fontSize: '12.5px', fontWeight: '600' }}
                >
                  <option value="empleado">EMPLEADO / AUXILIAR (No autoriza pases)</option>
                  <option value="jefe_area">JEFE DE ÁREA (Sí autoriza pases de su equipo)</option>
                  <option value="rh_nominas">RH / NÓMINAS (Dictamina nómina)</option>
                  <option value="gerente_produccion">GERENTE DE PRODUCCIÓN</option>
                  <option value="gerente_admin">GERENTE ADMINISTRATIVO</option>
                  <option value="gerente_rh">GERENTE DE RECURSOS HUMANOS</option>
                  <option value="caseta">CASETA / VIGILANCIA</option>
                  <option value="superadmin">SUPER ADMINISTRADOR</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <button type="button" onClick={() => setUserEditando(null)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: `1px solid ${c.border}`, background: 'transparent', color: c.subText, fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" disabled={guardando} style={{ flex: 1.5, padding: '10px', borderRadius: '8px', border: 'none', background: c.accent, color: '#fff', fontWeight: '800', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <Save size={14} /> {guardando ? 'Guardando...' : 'Guardar Ubicación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ModalSeguridadPin 
        abierto={modalPinAbierto}
        onClose={() => setModalPinAbierto(false)}
        onAutorizado={() => setSeguridadDesbloqueada(true)}
        c={c}
        modoOscuro={modoOscuro}
      />
    </div>
  );
}

function renderItemLista(u, c, setFotoZoom, modoOscuro, seguridadDesbloqueada, onEditarUsuario, esSubordinado = false) {
  const badge = obtenerBadgeRol(u.rol, modoOscuro);
  const urlFoto = u.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.nombre_completo)}&background=16a34a&color=fff&bold=true`;

  return (
    <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '4px 6px', borderRadius: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
        {esSubordinado && <CornerDownRight size={12} color={c.subText} style={{ flexShrink: 0 }} />}
        <img 
          src={urlFoto} alt="" 
          onClick={() => setFotoZoom && setFotoZoom({ url: urlFoto, nombre: u.nombre_completo, puesto: u.puesto })}
          style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover', cursor: 'pointer', border: `1.5px solid ${c.line}`, flexShrink: 0 }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: 0 }}>
          <span style={{ fontSize: '12px', fontWeight: '600', color: c.text }}>{u.nombre_completo}</span>
          <span style={{ fontSize: '10.5px', color: c.subText }}>{u.puesto || 'Sin puesto'}</span>
          <span style={{ fontSize: '9px', fontWeight: '700', color: badge.text, border: `1px solid ${badge.border}`, padding: '1px 4px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
            {badge.label}
          </span>
        </div>
      </div>

      {seguridadDesbloqueada && (
        <button
          onClick={(e) => onEditarUsuario(u, e)}
          style={{ background: 'transparent', border: `1px solid ${c.line}`, borderRadius: '6px', color: c.accent, cursor: 'pointer', padding: '3px 7px', fontSize: '10px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}
          title="Reacomodar persona en el organigrama"
        >
          <Edit2 size={11} /> Mover
        </button>
      )}
    </div>
  );
}
