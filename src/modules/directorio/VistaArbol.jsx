import React, { useState, useRef, useEffect } from 'react';
import { 
  Factory, Building2, HardHat, ChevronDown, ChevronRight, 
  Edit2, Lock, Unlock, X, Save, Users
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

  const [deptoEditandoId, setDeptoEditandoId] = useState(null);
  const [nombreDeptoAnterior, setNombreDeptoAnterior] = useState('');
  const [nombreEdit, setNombreEdit] = useState('');
  const [clasifEdit, setClasifEdit] = useState('produccion');
  const [guardando, setGuardando] = useState(false);
  const popoverRef = useRef(null);

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
    popoverBg: tema.surfaceCard,
    popoverBorder: tema.border,
  };

  const secciones = [
    { key: 'produccion', label: 'Planta & Producción', icon: Factory, match: 'prod' },
    { key: 'administrativo', label: 'Corporativo & Administración', icon: Building2, match: 'admin' },
    { key: 'obra', label: 'Operaciones en Obra', icon: HardHat, match: 'obra' }
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
      <style>{`
        .credencial-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 14px 16px;
          border-radius: 12px;
          background: ${c.surfaceCard};
          border: 1px solid ${c.border};
          transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
          box-shadow: ${modoOscuro ? '0 4px 14px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.03)'};
        }
        .credencial-card:hover {
          transform: translateY(-1px);
          border-color: ${modoOscuro ? '#525252' : '#cbd5e1'};
          box-shadow: ${modoOscuro ? '0 8px 20px rgba(0,0,0,0.45)' : '0 6px 16px rgba(0,0,0,0.06)'};
        }
        .subdepto-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
          gap: 20px;
          width: 100%;
          align-items: start;
        }
        @media (max-width: 640px) {
          .subdepto-grid { grid-template-columns: 1fr; }
        }
        .subordinados-branch {
          position: relative;
          margin-left: 28px;
          padding-left: 20px;
          border-left: 2px solid ${modoOscuro ? '#404040' : '#d4d4d4'};
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 10px;
        }
        .subordinado-node {
          position: relative;
        }
        .subordinado-node::before {
          content: '';
          position: absolute;
          left: -20px;
          top: 50%;
          width: 16px;
          height: 2px;
          background: ${modoOscuro ? '#404040' : '#d4d4d4'};
        }
      `}</style>

      {/* BARRA SUPERIOR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          {seguridadDesbloqueada ? (
            <button onClick={() => setSeguridadDesbloqueada(false)} style={{ background: c.accentSoft, border: `1px solid ${c.accent}`, padding: '6px 12px', borderRadius: '8px', color: c.accent, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700' }}>
              <Unlock size={14} /> Modo Edición Activo
            </button>
          ) : (
            <button onClick={() => setModalPinAbierto(true)} style={{ background: c.surfaceCard, border: `1px solid ${c.border}`, padding: '6px 14px', borderRadius: '8px', color: c.text, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700' }}>
              <Lock size={13} color="#f59e0b" /> <span>Acomodar Organigrama</span>
            </button>
          )}
        </div>

        <select 
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          style={{ background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '8px', color: c.text, fontSize: '12.5px', fontWeight: '700', padding: '7px 12px', outline: 'none', cursor: 'pointer' }}
        >
          <option value="ALL">Todas las Divisiones</option>
          <option value="produccion">Planta & Producción</option>
          <option value="administrativo">Corporativo & Administración</option>
          <option value="obra">Operaciones en Obra</option>
        </select>
      </div>

      {/* SECCIONES CORPORATIVAS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {seccionesVisibles.map(sec => {
          const IconoSec = sec.icon;
          const deptosSec = (departamentos || []).filter(d => {
            const esDeEstaRama = (d.clasificacion || 'produccion').toLowerCase().includes(sec.match);
            return esDeEstaRama && (seguridadDesbloqueada || usuarios.some(u => u.departamento_id === d.id && u.activo === true));
          });

          if (deptosSec.length === 0) return null;

          return (
            <div key={sec.key}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', paddingBottom: '10px', borderBottom: `1px solid ${c.line}` }}>
                <IconoSec size={17} color={c.subText} />
                <span style={{ fontSize: '13.5px', fontWeight: '800', color: c.subText, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {sec.label}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
                    <div key={depto.id} style={{ background: abierto ? (modoOscuro ? '#1c1c1c' : '#f5f5f5') : c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '14px', position: 'relative' }}>
                      
                      {/* CABECERA DEL DEPARTAMENTO */}
                      <div 
                        onClick={() => toggleDepto(depto.id)}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', cursor: 'pointer', background: c.surfaceCard, borderRadius: abierto ? '13px 13px 0 0' : '13px', borderBottom: abierto ? `1px solid ${c.border}` : 'none' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: abierto ? c.text : c.surface, color: abierto ? c.bg : c.subText, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                            {abierto ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </div>
                          <span style={{ fontSize: '15px', fontWeight: '800', color: c.text, letterSpacing: '-0.01em' }}>{depto.nombre}</span>
                          <span style={{ fontSize: '11.5px', color: c.subText, background: c.surface, border: `1px solid ${c.border}`, padding: '2px 9px', borderRadius: '20px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Users size={11} /> {personalDepto.length}
                          </span>
                        </div>

                        {seguridadDesbloqueada && (
                          <button onClick={(e) => iniciarEdicionRapidaDepto(depto, e)} style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: '8px', color: c.text, cursor: 'pointer', padding: '5px 10px', fontSize: '11px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <Edit2 size={12} /> Editar Depto
                          </button>
                        )}
                      </div>

                      {/* POPOVER EDICIÓN DEPTO */}
                      {estaEditando && (
                        <div ref={popoverRef} onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: '52px', right: '14px', background: c.popoverBg, border: `1px solid ${c.popoverBorder}`, borderRadius: '12px', padding: '14px', zIndex: 300, boxShadow: '0 10px 30px rgba(0,0,0,0.5)', width: '270px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
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

                      {/* CUERPO DEL ORGANIGRAMA */}
                      {abierto && (
                        <div style={{ padding: esMobile ? '16px' : '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                          
                          {/* 1. GERENCIA / DIRECCIÓN */}
                          {gerencia.length > 0 && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '16px' }}>
                              {gerencia.map(u => renderCredencialPersona(u, c, setFotoZoom, modoOscuro, seguridadDesbloqueada, abrirEdicionUsuarioArbol, true))}
                            </div>
                          )}

                          {/* 2. BLOQUES DE SUBDEPARTAMENTOS */}
                          {clavesSubdeptos.length > 0 && (
                            <div className="subdepto-grid">
                              {clavesSubdeptos.map(clave => {
                                const grupo = subdeptosMap[clave];
                                const idsGrupo = new Set(grupo.miembros.map(m => m.id));

                                const tieneJefeArea = grupo.miembros.some(m => m.rol === 'jefe_area');
                                const tieneEmpleadosBase = grupo.miembros.some(m => m.rol === 'empleado');

                                const esTitularDeSubdepto = (m) => {
                                  if (grupo.miembros.some(sub => sub.reporta_a_id === m.id)) return true;
                                  if (m.rol === 'jefe_area') return true;
                                  if (!tieneJefeArea && tieneEmpleadosBase && ['rh_nominas', 'encargado'].includes(m.rol)) return true;
                                  return false;
                                };

                                const liderPrincipal = grupo.miembros.find(esTitularDeSubdepto);

                                const miembrosRaiz = grupo.miembros.filter(m => {
                                  if (m.reporta_a_id && idsGrupo.has(m.reporta_a_id)) return false;
                                  if (liderPrincipal && m.id !== liderPrincipal.id && !esTitularDeSubdepto(m)) return false;
                                  return true;
                                });

                                return (
                                  <div 
                                    key={clave} 
                                    style={{ 
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '10px'
                                    }}
                                  >
                                    {mostrarCabeceraSubdepto && (
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px 4px 4px', borderBottom: `1.5px solid ${c.border}` }}>
                                        <span style={{ fontSize: '11px', fontWeight: '900', color: c.subText, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                          {grupo.etiqueta}
                                        </span>
                                        <span style={{ fontSize: '10.5px', fontWeight: '700', color: c.subText }}>
                                          {grupo.miembros.length}
                                        </span>
                                      </div>
                                    )}

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                      {miembrosRaiz.map(titular => {
                                        const subordinados = grupo.miembros.filter(sub => {
                                          if (sub.id === titular.id) return false;
                                          if (sub.reporta_a_id === titular.id) return true;
                                          if ((!sub.reporta_a_id || !idsGrupo.has(sub.reporta_a_id)) && liderPrincipal && titular.id === liderPrincipal.id && !esTitularDeSubdepto(sub)) {
                                            return true;
                                          }
                                          return false;
                                        });

                                        return (
                                          <div key={titular.id} style={{ display: 'flex', flexDirection: 'column' }}>
                                            {renderCredencialPersona(titular, c, setFotoZoom, modoOscuro, seguridadDesbloqueada, abrirEdicionUsuarioArbol, false)}

                                            {subordinados.length > 0 && (
                                              <div className="subordinados-branch">
                                                {subordinados.map(sub => (
                                                  <div key={sub.id} className="subordinado-node">
                                                    {renderCredencialPersona(sub, c, setFotoZoom, modoOscuro, seguridadDesbloqueada, abrirEdicionUsuarioArbol, false)}
                                                  </div>
                                                ))}
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

      {/* MODAL PARA ACOMODAR COLABORADOR EN EL ORGANIGRAMA */}
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

// === PROPUESTA 3 + 5: CREDENCIAL CON FOTO GRANDE + SOBRIEDAD EJECUTIVO CARBÓN ===
function renderCredencialPersona(u, c, setFotoZoom, modoOscuro, seguridadDesbloqueada, onEditarUsuario, esGerencia = false) {
  const badge = obtenerBadgeRol(u.rol, modoOscuro);
  const urlFoto = u.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.nombre_completo)}&background=262626&color=fff&bold=true`;

  const tamanoFoto = esGerencia ? '60px' : '54px';

  return (
    <div 
      key={u.id} 
      className="credencial-card"
      style={{
        borderLeft: `4px solid ${badge.accentBar}`
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0, flex: 1 }}>
        <img 
          src={urlFoto} 
          alt="" 
          onClick={() => setFotoZoom && setFotoZoom({ url: urlFoto, nombre: u.nombre_completo, puesto: u.puesto })}
          title="Toca para ampliar fotografía"
          style={{ 
            width: tamanoFoto, 
            height: tamanoFoto, 
            borderRadius: '14px', 
            objectFit: 'cover', 
            cursor: 'pointer', 
            border: `1px solid ${c.border}`, 
            flexShrink: 0
          }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <span style={{ fontSize: '10.5px', fontWeight: '800', color: c.subText, letterSpacing: '0.03em' }}>
              ID #{u.numero_empleado}
            </span>
            <span style={{ 
              fontSize: '9.5px', fontWeight: '800', color: badge.text, background: badge.bg,
              border: `1px solid ${badge.border}`, padding: '2px 7px', borderRadius: '6px', whiteSpace: 'nowrap', letterSpacing: '0.03em'
            }}>
              {badge.label}
            </span>
          </div>

          <div style={{ fontSize: esGerencia ? '15px' : '14px', fontWeight: '800', color: c.text, letterSpacing: '-0.01em', lineHeight: '1.25' }}>
            {u.nombre_completo}
          </div>

          <div style={{ fontSize: '12px', color: c.subText, fontWeight: '500', lineHeight: '1.3' }}>
            {u.puesto || 'SIN PUESTO ASIGNADO'}
          </div>
        </div>
      </div>

      {seguridadDesbloqueada && (
        <button
          onClick={(e) => onEditarUsuario(u, e)}
          style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: '8px', color: c.text, cursor: 'pointer', padding: '7px 10px', fontSize: '11px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}
          title="Reacomodar persona en el organigrama"
        >
          <Edit2 size={12} /> Mover
        </button>
      )}
    </div>
  );
}
