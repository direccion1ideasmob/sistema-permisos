import React, { useState, useRef, useEffect } from 'react';
import { 
  Factory, Building2, HardHat, ChevronDown, ChevronRight, 
  Layers, Edit2, Crown, UserCheck, Lock, Unlock, X, Save 
} from 'lucide-react';
import { obtenerBadgeRol, obtenerClaveOrdenApellido, estandarizar } from './utils/directorioHelpers';
import { actualizarDepartamentoSeguro } from './services/directorioService';
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
  const [nombreEdit, setNombreEdit] = useState('');
  const [clasifEdit, setClasifEdit] = useState('produccion');
  const [guardando, setGuardando] = useState(false);
  const popoverRef = useRef(null);

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

  const iniciarEdicionRapida = (depto, e) => {
    e.stopPropagation();
    setDeptoEditandoId(depto.id);
    setNombreEdit(depto.nombre);
    setClasifEdit((depto.clasificacion || 'produccion').toLowerCase().trim());
  };

  const guardarDepto = async (e) => {
    e.preventDefault();
    if (!nombreEdit.trim()) return alert("Ingresa un nombre para el departamento.");

    setGuardando(true);
    try {
      await actualizarDepartamentoSeguro(deptoEditandoId, nombreEdit, clasifEdit);
      setDeptoEditandoId(null);
      if (recargarDatos) await recargarDatos();
    } catch (err) {
      alert("Error al actualizar: " + err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div style={{ width: '100%', boxSizing: 'border-box', fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          {seguridadDesbloqueada ? (
            <button onClick={() => setSeguridadDesbloqueada(false)} style={{ background: 'transparent', border: 'none', color: c.accent, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '700' }}>
              <Unlock size={14} /> Edición Habilitada
            </button>
          ) : (
            <button onClick={() => setModalPinAbierto(true)} style={{ background: 'transparent', border: 'none', color: c.subText, cursor: 'pointer', opacity: 0.4 }} title="Desbloquear edición de áreas">
              <Lock size={14} />
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
            return esDeEstaRama && usuarios.some(u => u.departamento_id === d.id && u.activo === true);
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

                  // 1. GERENCIA DE DEPARTAMENTO (Cabeza global del departamento)
                  const gerencia = personalDepto.filter(u => ['superadmin', 'gerente_produccion', 'gerente_admin', 'gerente_rh'].includes(u.rol));
                  const restoPersonal = personalDepto.filter(u => !['superadmin', 'gerente_produccion', 'gerente_admin', 'gerente_rh'].includes(u.rol));

                  // 2. AGRUPACIÓN ELÁSTICA POR SUBDEPARTAMENTO (ÁREA)
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
                  // Mostramos etiqueta de Subdepartamento si hay más de 1 sub-área, o si el sub-área se llama distinto al departamento
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
                          <button onClick={(e) => iniciarEdicionRapida(depto, e)} style={{ background: 'transparent', border: 'none', color: c.accent, cursor: 'pointer', padding: '4px' }}>
                            <Edit2 size={13} />
                          </button>
                        )}
                      </div>

                      {estaEditando && (
                        <div ref={popoverRef} onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: '38px', right: '10px', background: c.popoverBg, border: `1.5px solid ${c.popoverBorder}`, borderRadius: '12px', padding: '14px', zIndex: 300, boxShadow: '0 10px 30px rgba(0,0,0,0.5)', width: '260px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', fontWeight: '800', color: c.text }}>Ajustar Departamento</span>
                            <button onClick={() => setDeptoEditandoId(null)} style={{ background: 'none', border: 'none', color: c.subText, cursor: 'pointer' }}><X size={14} /></button>
                          </div>

                          <form onSubmit={guardarDepto} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <input type="text" value={nombreEdit} onChange={e => setNombreEdit(e.target.value)} placeholder="Nombre del depto" autoFocus style={{ width: '100%', height: '32px', padding: '0 8px', borderRadius: '8px', border: `1px solid ${c.popoverBorder}`, background: c.inputBg, color: c.text, fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
                            <div style={{ display: 'flex', gap: '4px' }}>
                              {[ { key: 'produccion', label: 'Prod' }, { key: 'administrativo', label: 'Admón' }, { key: 'obra', label: 'Obra' } ].map(op => (
                                <button key={op.key} type="button" onClick={() => setClasifEdit(op.key)} style={{ flex: 1, padding: '5px 2px', borderRadius: '6px', border: `1px solid ${clasifEdit === op.key ? c.accent : c.popoverBorder}`, background: clasifEdit === op.key ? c.accentSoft : 'transparent', color: clasifEdit === op.key ? c.accent : c.subText, fontSize: '10.5px', fontWeight: '700', cursor: 'pointer' }}>
                                  {op.label}
                                </button>
                              ))}
                            </div>
                            <button type="submit" disabled={guardando} style={{ width: '100%', padding: '7px', borderRadius: '8px', border: 'none', background: c.accent, color: '#fff', fontSize: '11.5px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                              <Save size={12} /> {guardando ? 'Guardando...' : 'Guardar'}
                            </button>
                          </form>
                        </div>
                      )}

                      {abierto && (
                        <div style={{ marginLeft: esMobile ? '10px' : '16px', paddingTop: '6px', paddingBottom: '8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          
                          {/* NIVEL 1: GERENCIA DEL DEPARTAMENTO */}
                          {gerencia.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ fontSize: '10px', fontWeight: '800', color: '#f59e0b', textTransform: 'uppercase', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Crown size={11} /> Gerencia / Dirección
                              </div>
                              {gerencia.map(u => renderItemLista(u, c, setFotoZoom, modoOscuro))}
                            </div>
                          )}

                          {/* NIVEL 2: CÉLULAS / SUBDEPARTAMENTOS INDEPENDIENTES */}
                          {clavesSubdeptos.length > 0 && (
                            <div style={{ 
                              display: 'flex', flexDirection: 'column', gap: '12px',
                              marginLeft: gerencia.length > 0 ? (esMobile ? '12px' : '18px') : '0',
                              borderLeft: gerencia.length > 0 ? `1.5px solid ${c.line}` : 'none',
                              paddingLeft: gerencia.length > 0 ? '12px' : '0'
                            }}>
                              {clavesSubdeptos.map(clave => {
                                const grupo = subdeptosMap[clave];
                                const jefesSubdepto = grupo.miembros.filter(u => u.rol === 'jefe_area');
                                const integrantesSubdepto = grupo.miembros.filter(u => u.rol !== 'jefe_area');

                                return (
                                  <div key={clave} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                    {/* CABECERA DEL SUBDEPARTAMENTO (Solo si aplica) */}
                                    {mostrarCabeceraSubdepto && (
                                      <div style={{ fontSize: '10.5px', fontWeight: '800', color: c.subText, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '5px', letterSpacing: '0.03em' }}>
                                        <Layers size={11} color={c.accent} /> {grupo.etiqueta}
                                      </div>
                                    )}

                                    {/* SI ESTE SUBDEPARTAMENTO TIENE SU PROPIO JEFE (Ej. Mariel en Seguridad Industrial) */}
                                    {jefesSubdepto.length > 0 && (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginLeft: mostrarCabeceraSubdepto ? '8px' : '0' }}>
                                        <div style={{ fontSize: '9.5px', fontWeight: '800', color: '#3b82f6', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                          <UserCheck size={11} /> Responsable / Jefatura
                                        </div>
                                        {jefesSubdepto.map(u => renderItemLista(u, c, setFotoZoom, modoOscuro))}
                                      </div>
                                    )}

                                    {/* INTEGRANTES DE ESTE SUBDEPARTAMENTO (Debajo de su jefe si existe, o directo en el subdepto) */}
                                    {integrantesSubdepto.length > 0 && (
                                      <div style={{ 
                                        display: 'flex', flexDirection: 'column', gap: '4px',
                                        marginLeft: jefesSubdepto.length > 0 ? (esMobile ? '16px' : '22px') : (mostrarCabeceraSubdepto ? '8px' : '0'),
                                        borderLeft: jefesSubdepto.length > 0 ? `1.5px solid ${c.line}` : 'none',
                                        paddingLeft: jefesSubdepto.length > 0 ? '10px' : '0'
                                      }}>
                                        {integrantesSubdepto.map(u => renderItemLista(u, c, setFotoZoom, modoOscuro))}
                                      </div>
                                    )}
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

function renderItemLista(u, c, setFotoZoom, modoOscuro) {
  const badge = obtenerBadgeRol(u.rol, modoOscuro);
  const urlFoto = u.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.nombre_completo)}&background=16a34a&color=fff&bold=true`;

  return (
    <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 0', borderRadius: '6px' }}>
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
  );
}
