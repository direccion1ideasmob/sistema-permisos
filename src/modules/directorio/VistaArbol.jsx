import React, { useState, useRef, useEffect } from 'react';
import { 
  ChevronDown, ChevronRight, Edit2, Lock, Unlock, X, Save, 
  Crown, ShieldCheck, User, CornerDownRight, Briefcase, Hash, 
  ChevronsDown, ChevronsUp
} from 'lucide-react';
import { obtenerBadgeRol, obtenerClaveOrdenApellido, estandarizar } from './utils/directorioHelpers';
import { actualizarDepartamentoSeguro, reubicarColaboradorEnArbol } from './services/directorioService';
import { obtenerTemaGlobal } from '../../core/theme/temaGlobal';
import ModalSeguridadPin from './ModalSeguridadPin';

const normalizar = (txt) => txt ? estandarizar(txt.toUpperCase()) : 'GENERAL';

const capitalizarNombre = (txt = '') =>
  txt
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');

export default function VistaArbol({ 
  usuarios = [], departamentos = [], recargarDatos, setFotoZoom, modoOscuro 
}) {
  const [esMobile, setEsMobile] = useState(window.innerWidth < 768);

  // Todo inicia comprimido para limpieza visual
  const [divisionesAbiertas, setDivisionesAbiertas] = useState({ produccion: true });
  const [deptosAbiertosLocal, setDeptosAbiertosLocal] = useState({});
  const [subareasAbiertas, setSubareasAbiertas] = useState({});

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
    line: modoOscuro ? '#333333' : '#e2e8f0',
    lineStrong: modoOscuro ? '#404040' : '#cbd5e1',
    panelBg: modoOscuro ? '#141414' : '#f8fafc',
    popoverBg: tema.surfaceCard,
    popoverBorder: tema.border,
  };

  const secciones = [
    { key: 'produccion', label: 'PLANTA & PRODUCCIÓN', match: 'prod', rolGerenteDiv: 'gerente_produccion' },
    { key: 'administrativo', label: 'ADMINISTRACIÓN', match: 'admin', rolGerenteDiv: 'gerente_admin' },
    { key: 'rh', label: 'CAPITAL HUMANO', match: 'rh', rolGerenteDiv: 'gerente_rh' },
    { key: 'obra', label: 'OPERACIONES EN OBRA', match: 'obra', rolGerenteDiv: null }
  ];

  const hayAlgoAbierto =
    Object.values(divisionesAbiertas).some(Boolean) ||
    Object.values(deptosAbiertosLocal).some(Boolean) ||
    Object.values(subareasAbiertas).some(Boolean);

  const toggleDivision = (key) => {
    setDivisionesAbiertas(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleDeptoLocal = (id) => {
    setDeptosAbiertosLocal(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleSubarea = (claveUnica) => {
    setSubareasAbiertas(prev => ({ ...prev, [claveUnica]: !prev[claveUnica] }));
  };

  const alternarTodo = () => {
    if (hayAlgoAbierto) {
      setDivisionesAbiertas({});
      setDeptosAbiertosLocal({});
      setSubareasAbiertas({});
    } else {
      const divs = {};
      secciones.forEach(s => { divs[s.key] = true; });
      const deps = {};
      const subs = {};
      (departamentos || []).forEach(d => {
        deps[d.id] = true;
        (usuarios || []).filter(u => u.departamento_id === d.id && u.activo).forEach(u => {
          const claveArea = `${d.id}_${normalizar(u.area || d.nombre)}`;
          subs[claveArea] = true;
        });
      });
      setDivisionesAbiertas(divs);
      setDeptosAbiertosLocal(deps);
      setSubareasAbiertas(subs);
    }
  };

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
    ? usuarios.filter(u => u.departamento_id === userEditando.departamento_id && u.activo && u.id !== userEditando.id && !["empleado", "caseta"].includes(u.rol))
    : [];

  return (
    <div style={{ width: '100%', maxWidth: '100%', overflowX: 'hidden', boxSizing: 'border-box', fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif' }}>
      <style>{`
        .placa-industrial {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 8px 12px;
          border-radius: 9px;
          background: ${c.surfaceCard};
          border: 1px solid ${c.border};
          transition: all 0.15s ease;
          position: relative;
          width: 100%;
          box-sizing: border-box;
        }
        .placa-industrial:hover {
          border-color: ${c.lineStrong};
          box-shadow: ${modoOscuro ? '0 4px 12px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.04)'};
        }

        .industrial-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr));
          gap: 12px;
          width: 100%;
          box-sizing: border-box;
          align-items: start;
        }

        .tronco-gerencia {
          position: relative;
          padding-bottom: 12px;
          width: 100%;
          max-width: 480px;
          box-sizing: border-box;
        }
        .tronco-gerencia::after {
          content: '';
          position: absolute;
          left: 24px;
          bottom: 0;
          width: 1.5px;
          height: 12px;
          background: ${c.lineStrong};
        }

        .rama-subordinados {
          position: relative;
          margin-left: 18px;
          padding-left: 16px;
          border-left: 1.5px solid ${c.lineStrong};
          display: flex;
          flex-direction: column;
          gap: 7px;
          margin-top: 7px;
          padding-top: 2px;
          box-sizing: border-box;
        }
        .nodo-subordinado {
          position: relative;
          width: 100%;
          box-sizing: border-box;
        }
        .nodo-subordinado::before {
          content: '';
          position: absolute;
          left: -16px;
          top: 50%;
          width: 16px;
          height: 1.5px;
          background: ${c.lineStrong};
        }
        .nodo-subordinado::after {
          content: '';
          position: absolute;
          left: -19px;
          top: calc(50% - 2.5px);
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: ${c.lineStrong};
        }

        @media (max-width: 640px) {
          .industrial-grid {
            grid-template-columns: 1fr;
            gap: 8px;
          }
          .placa-industrial {
            padding: 8px 10px;
            gap: 8px;
          }
          .rama-subordinados {
            margin-left: 10px;
            padding-left: 12px;
            gap: 6px;
          }
          .nodo-subordinado::before {
            left: -12px;
            width: 12px;
          }
          .nodo-subordinado::after {
            left: -15px;
          }
        }
      `}</style>

      {/* MICRO-BARRA SUPERIOR MINIMALISTA (Alineada a la derecha, discreta) */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <button 
          onClick={alternarTodo} 
          style={{ 
            background: 'transparent', 
            border: `1px solid ${c.border}`, 
            padding: '5px 10px', 
            borderRadius: '6px', 
            color: c.subText, 
            cursor: 'pointer', 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '5px', 
            fontSize: '10.5px', 
            fontWeight: '700', 
            letterSpacing: '0.03em'
          }}
        >
          {hayAlgoAbierto ? <ChevronsUp size={12} /> : <ChevronsDown size={12} />}
          <span>{hayAlgoAbierto ? 'Comprimir' : 'Expandir'}</span>
        </button>

        <button 
          onClick={() => seguridadDesbloqueada ? setSeguridadDesbloqueada(false) : setModalPinAbierto(true)} 
          title={seguridadDesbloqueada ? 'Bloquear edición de estructura' : 'Acomodar estructura (PIN)'}
          style={{ 
            background: seguridadDesbloqueada ? c.accentSoft : 'transparent', 
            border: `1px solid ${seguridadDesbloqueada ? c.accent : c.border}`, 
            width: '28px',
            height: '28px',
            borderRadius: '6px', 
            color: seguridadDesbloqueada ? c.accent : c.subText, 
            cursor: 'pointer', 
            display: 'inline-flex', 
            alignItems: 'center', 
            justifyContent: 'center'
          }}
        >
          {seguridadDesbloqueada ? <Unlock size={13} /> : <Lock size={13} />}
        </button>
      </div>

      {/* NIVEL 1: ÁREAS DE LA EMPRESA (Limpio, sin palabras redundantes) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {secciones.map(sec => {
          const divAbierta = Boolean(divisionesAbiertas[sec.key]);

          const gerentesDivision = sec.rolGerenteDiv
            ? usuarios.filter(u => u.rol === sec.rolGerenteDiv && u.activo === true)
            : [];
          const idsGerentesDivision = new Set(gerentesDivision.map(g => g.id));

          const deptosSec = (departamentos || []).filter(d => {
            const esDeEstaRama = (d.clasificacion || 'produccion').toLowerCase().includes(sec.match);
            if (!esDeEstaRama) return false;
            const activosSinGerenteDiv = usuarios.filter(u => u.departamento_id === d.id && u.activo === true && !idsGerentesDivision.has(u.id));
            return seguridadDesbloqueada || activosSinGerenteDiv.length > 0;
          });

          if (deptosSec.length === 0 && gerentesDivision.length === 0) return null;

          const idsDeptosSec = new Set(deptosSec.map(d => d.id));
          const totalPersonasDivision = usuarios.filter(u => u.activo && (idsGerentesDivision.has(u.id) || idsDeptosSec.has(u.departamento_id))).length;
          const titularTexto = gerentesDivision.length > 0
            ? gerentesDivision.map(g => capitalizarNombre(g.nombre_completo)).join(' / ')
            : '';

          return (
            <div key={sec.key} style={{ background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '10px', overflow: 'hidden' }}>
              
              {/* CABECERA MINIMALISTA DE LA RAMA */}
              <div 
                onClick={() => toggleDivision(sec.key)}
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  padding: esMobile ? '14px 16px' : '16px 20px', 
                  cursor: 'pointer', 
                  background: divAbierta ? (modoOscuro ? '#1a1a1a' : '#f8fafc') : c.surfaceCard,
                  borderBottom: divAbierta ? `1px solid ${c.border}` : 'none',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                  <div style={{ color: c.subText, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {divAbierta ? <ChevronDown size={17} strokeWidth={2.2} /> : <ChevronRight size={17} strokeWidth={2.2} />}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                    <span style={{ fontSize: esMobile ? '13px' : '13.5px', fontWeight: '800', color: c.text, letterSpacing: '0.04em' }}>
                      {sec.label}
                    </span>
                    {titularTexto && (
                      <span style={{ fontSize: '12px', fontWeight: '500', color: c.subText }}>
                        {titularTexto}
                      </span>
                    )}
                  </div>
                </div>

                <span style={{ fontSize: '12px', fontWeight: '700', color: c.subText, padding: '2px 8px', borderRadius: '6px', background: modoOscuro ? '#222' : '#f1f5f9', flexShrink: 0 }}>
                  {totalPersonasDivision}
                </span>
              </div>

              {/* CONTENIDO EXPANDIBLE */}
              {divAbierta && (
                <div style={{ padding: esMobile ? '12px' : '18px', background: c.panelBg, boxSizing: 'border-box' }}>
                  
                  {/* TARJETA DEL GERENTE DE DIVISIÓN */}
                  {gerentesDivision.length > 0 && (
                    <div className={deptosSec.length > 0 ? "tronco-gerencia" : ""} style={{ marginBottom: deptosSec.length > 0 ? '0' : '10px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {gerentesDivision.map(g => renderPlacaIndustrial(g, c, setFotoZoom, modoOscuro, seguridadDesbloqueada, abrirEdicionUsuarioArbol, 'gerencia', esMobile))}
                      </div>
                    </div>
                  )}

                  {/* NIVEL 2: DEPARTAMENTOS */}
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '8px',
                    marginLeft: gerentesDivision.length > 0 ? (esMobile ? '8px' : '16px') : '0',
                    paddingLeft: gerentesDivision.length > 0 ? (esMobile ? '10px' : '14px') : '0',
                    borderLeft: gerentesDivision.length > 0 ? `1.5px solid ${c.lineStrong}` : 'none'
                  }}>
                    {deptosSec.map(depto => {
                      const abierto = Boolean(deptosAbiertosLocal[depto.id]);
                      const estaEditando = deptoEditandoId === depto.id;
                      const nombreDeptoNorm = normalizar(depto.nombre);

                      const personalDepto = (usuarios || [])
                        .filter(u => u.departamento_id === depto.id && u.activo === true && !idsGerentesDivision.has(u.id))
                        .sort((a, b) => obtenerClaveOrdenApellido(a).localeCompare(obtenerClaveOrdenApellido(b)));

                      const haySubareasEspecificas = personalDepto.some(u => {
                        const a = normalizar(u.area || depto.nombre);
                        return a !== nombreDeptoNorm && a !== 'GENERAL' && !['superadmin', 'gerente_produccion', 'gerente_admin', 'gerente_rh'].includes(u.rol);
                      });

                      const cabezaDepto = personalDepto.filter(u => {
                        if (['superadmin'].includes(u.rol)) return true;
                        if (haySubareasEspecificas && u.rol === 'jefe_area' && normalizar(u.area || depto.nombre) === nombreDeptoNorm) return true;
                        return false;
                      });

                      const idsCabezaDepto = new Set(cabezaDepto.map(g => g.id));
                      const restoPersonal = personalDepto.filter(u => !idsCabezaDepto.has(u.id));

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
                        <div key={depto.id} style={{ background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '8px', position: 'relative', boxSizing: 'border-box', width: '100%' }}>
                          
                          {/* CABECERA DEL DEPARTAMENTO */}
                          <div 
                            onClick={() => toggleDeptoLocal(depto.id)}
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: esMobile ? '11px 13px' : '12px 16px', cursor: 'pointer', borderRadius: abierto ? '8px 8px 0 0' : '8px', borderBottom: abierto ? `1px solid ${c.border}` : 'none', gap: '8px' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
                              <div style={{ color: c.subText, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {abierto ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                              </div>
                              <span style={{ fontSize: '12.5px', fontWeight: '800', color: c.text, letterSpacing: '0.03em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {depto.nombre}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                              {seguridadDesbloqueada && (
                                <button onClick={(e) => iniciarEdicionRapidaDepto(depto, e)} style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: '4px', color: c.text, cursor: 'pointer', padding: '4px 7px', fontSize: '10px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <Edit2 size={10} />
                                </button>
                              )}
                              <span style={{ fontSize: '11px', color: c.subText, fontWeight: '700' }}>
                                {personalDepto.length}
                              </span>
                            </div>
                          </div>

                          {/* POPOVER EDICIÓN DEPTO */}
                          {estaEditando && (
                            <div ref={popoverRef} onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: '46px', right: '10px', background: c.popoverBg, border: `1px solid ${c.popoverBorder}`, borderRadius: '8px', padding: '14px', zIndex: 300, boxShadow: '0 10px 30px rgba(0,0,0,0.4)', width: '250px', maxWidth: 'calc(100vw - 40px)', display: 'flex', flexDirection: 'column', gap: '10px', boxSizing: 'border-box' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '11px', fontWeight: '800', color: c.text }}>Editar Departamento</span>
                                <button onClick={() => setDeptoEditandoId(null)} style={{ background: 'none', border: 'none', color: c.subText, cursor: 'pointer' }}><X size={14} /></button>
                              </div>

                              <form onSubmit={guardarDepto} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <input type="text" value={nombreEdit} onChange={e => setNombreEdit(e.target.value.toUpperCase())} placeholder="Nombre del depto" autoFocus style={{ width: '100%', height: '34px', padding: '0 8px', borderRadius: '4px', border: `1px solid ${c.popoverBorder}`, background: c.inputBg, color: c.text, fontSize: '12px', fontWeight: '700', outline: 'none', boxSizing: 'border-box' }} />
                                <div style={{ display: 'flex', gap: '4px' }}>
                                  {[ { key: 'produccion', label: 'Planta' }, { key: 'administrativo', label: 'Admón' }, { key: 'rh', label: 'RH' }, { key: 'obra', label: 'Obra' } ].map(op => (
                                    <button key={op.key} type="button" onClick={() => setClasifEdit(op.key)} style={{ flex: 1, padding: '5px 2px', borderRadius: '4px', border: `1px solid ${clasifEdit === op.key ? c.accent : c.popoverBorder}`, background: clasifEdit === op.key ? c.accentSoft : 'transparent', color: clasifEdit === op.key ? c.accent : c.subText, fontSize: '10.5px', fontWeight: '700', cursor: 'pointer' }}>
                                      {op.label}
                                    </button>
                                  ))}
                                </div>
                                <button type="submit" disabled={guardando} style={{ width: '100%', padding: '7px', borderRadius: '4px', border: 'none', background: c.accent, color: '#fff', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                  <Save size={13} /> {guardando ? 'Guardando...' : 'Guardar'}
                                </button>
                              </form>
                            </div>
                          )}

                          {/* CONTENIDO DEL DEPARTAMENTO */}
                          {abierto && (
                            <div style={{ padding: esMobile ? '10px' : '14px', boxSizing: 'border-box', width: '100%' }}>
                              
                              {cabezaDepto.length > 0 && (
                                <div className={clavesSubdeptos.length > 0 ? "tronco-gerencia" : ""}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {cabezaDepto.map(u => renderPlacaIndustrial(u, c, setFotoZoom, modoOscuro, seguridadDesbloqueada, abrirEdicionUsuarioArbol, 'lider', esMobile))}
                                  </div>
                                </div>
                              )}

                              {/* NIVEL 3: SUBÁREAS */}
                              {clavesSubdeptos.length > 0 && (
                                <div className="industrial-grid">
                                  {clavesSubdeptos.map(clave => {
                                    const grupo = subdeptosMap[clave];
                                    const idsGrupo = new Set(grupo.miembros.map(m => m.id));
                                    const claveUnicaSub = `${depto.id}_${clave}`;
                                    const subAbierta = !mostrarCabeceraSubdepto || Boolean(subareasAbiertas[claveUnicaSub]);

                                    const tieneJefeArea = grupo.miembros.some(m => m.rol === 'jefe_area');
                                    const tieneEmpleadosBase = grupo.miembros.some(m => m.rol === 'empleado');

                                    const ROLES_MANDO_ARBOL = ['jefe_area', 'encargado', 'rh_nominas', 'gerente_produccion', 'gerente_admin', 'gerente_rh', 'superadmin'];
                                    const esMandoValido = (m) => ROLES_MANDO_ARBOL.includes(m.rol);

                                    const esTitularDeSubdepto = (m) => {
                                      if (!esMandoValido(m)) return false;
                                      if (m.rol === 'jefe_area' || m.rol === 'encargado') return true;
                                      if (grupo.miembros.some(sub => sub.reporta_a_id === m.id)) return true;
                                      if (!tieneJefeArea && tieneEmpleadosBase && m.rol === 'rh_nominas') return true;
                                      return false;
                                    };

                                    const liderPrincipal = grupo.miembros.find(esTitularDeSubdepto);

                                    const miembrosRaiz = grupo.miembros.filter(m => {
                                      const supEnGrupo = m.reporta_a_id ? grupo.miembros.find(x => x.id === m.reporta_a_id) : null;
                                      if (supEnGrupo && esMandoValido(supEnGrupo)) return false;
                                      if (liderPrincipal && m.id !== liderPrincipal.id && !esTitularDeSubdepto(m)) return false;
                                      return true;
                                    });

                                    return (
                                      <div 
                                        key={clave} 
                                        style={{ 
                                          background: mostrarCabeceraSubdepto ? (modoOscuro ? '#181818' : '#f8fafc') : 'transparent',
                                          border: mostrarCabeceraSubdepto ? `1px solid ${c.border}` : 'none',
                                          borderRadius: '7px',
                                          overflow: 'hidden',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          width: '100%',
                                          boxSizing: 'border-box'
                                        }}
                                      >
                                        {mostrarCabeceraSubdepto && (
                                          <div 
                                            onClick={() => toggleSubarea(claveUnicaSub)}
                                            style={{ 
                                              padding: '9px 12px', 
                                              borderBottom: subAbierta ? `1px solid ${c.border}` : 'none',
                                              display: 'flex', 
                                              justifyContent: 'space-between', 
                                              alignItems: 'center',
                                              gap: '8px',
                                              cursor: 'pointer'
                                            }}
                                          >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                                              <div style={{ color: c.subText, display: 'flex', alignItems: 'center' }}>
                                                {subAbierta ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                              </div>
                                              <span style={{ fontSize: '11px', fontWeight: '800', color: c.text, textTransform: 'uppercase', letterSpacing: '0.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {grupo.etiqueta}
                                              </span>
                                            </div>
                                            <span style={{ fontSize: '10.5px', fontWeight: '700', color: c.subText }}>
                                              {grupo.miembros.length}
                                            </span>
                                          </div>
                                        )}

                                        {subAbierta && (
                                          <div style={{ padding: mostrarCabeceraSubdepto ? '10px' : '0', display: 'flex', flexDirection: 'column', gap: '10px', boxSizing: 'border-box', width: '100%' }}>
                                            {miembrosRaiz.map(titular => {
                                              const subordinados = esTitularDeSubdepto(titular)
                                                ? grupo.miembros.filter(sub => {
                                                    if (sub.id === titular.id || esTitularDeSubdepto(sub)) return false;
                                                    if (sub.reporta_a_id === titular.id) return true;
                                                    const supEnGrupo = sub.reporta_a_id ? grupo.miembros.find(x => x.id === sub.reporta_a_id) : null;
                                                    if ((!supEnGrupo || !esMandoValido(supEnGrupo)) && liderPrincipal && titular.id === liderPrincipal.id) {
                                                      return true;
                                                    }
                                                    return false;
                                                  })
                                                : [];

                                              const tipoNodo = (['jefe_area', 'encargado'].includes(titular.rol) || subordinados.length > 0) ? 'lider' : 'operativo';

                                              return (
                                                <div key={titular.id} style={{ display: 'flex', flexDirection: 'column', width: '100%', boxSizing: 'border-box' }}>
                                                  {renderPlacaIndustrial(titular, c, setFotoZoom, modoOscuro, seguridadDesbloqueada, abrirEdicionUsuarioArbol, tipoNodo, esMobile)}

                                                  {subordinados.length > 0 && (
                                                    <div className="rama-subordinados">
                                                      {subordinados.map(sub => (
                                                        <div key={sub.id} className="nodo-subordinado">
                                                          {renderPlacaIndustrial(sub, c, setFotoZoom, modoOscuro, seguridadDesbloqueada, abrirEdicionUsuarioArbol, 'subordinado', esMobile)}
                                                        </div>
                                                      ))}
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            })}
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
              )}
            </div>
          );
        })}
      </div>

      {/* MODAL PARA ACOMODAR COLABORADOR EN EL ORGANIGRAMA */}
      {userEditando && (
        <div onClick={() => setUserEditando(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2500, padding: '16px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '8px', padding: '20px', width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${c.border}`, paddingBottom: '10px' }}>
              <div>
                <div style={{ fontSize: '10.5px', fontWeight: '800', color: c.accent, textTransform: 'uppercase' }}>Reubicación en Estructura</div>
                <div style={{ fontSize: '14px', fontWeight: '800', color: c.text }}>{userEditando.nombre_completo}</div>
              </div>
              <button onClick={() => setUserEditando(null)} style={{ background: 'none', border: 'none', color: c.subText, cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <form onSubmit={guardarReubicacionUsuario} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: c.subText, marginBottom: '4px', textTransform: 'uppercase' }}>1. Departamento</label>
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
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: `1px solid ${c.border}`, background: c.inputBg, color: c.text, fontSize: '12.5px', fontWeight: '600', boxSizing: 'border-box' }}
                >
                  {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: c.subText, marginBottom: '4px', textTransform: 'uppercase' }}>2. Subdepartamento / Área</label>
                <input
                  list="areas-coherentes-arbol"
                  value={userEditando.area}
                  onChange={e => setUserEditando({ ...userEditando, area: e.target.value.toUpperCase() })}
                  placeholder="Ej. CNC LASER, NOMINAS..."
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: `1px solid ${c.border}`, background: c.inputBg, color: c.text, fontSize: '12.5px', fontWeight: '600', boxSizing: 'border-box' }}
                />
                <datalist id="areas-coherentes-arbol">
                  {areasDelDeptoSeleccionado.map(a => <option key={a} value={a} />)}
                </datalist>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: c.subText, marginBottom: '4px', textTransform: 'uppercase' }}>3. Puesto</label>
                <input
                  list="puestos-coherentes-arbol"
                  value={userEditando.puesto}
                  onChange={e => setUserEditando({ ...userEditando, puesto: e.target.value.toUpperCase() })}
                  placeholder="Ej. SUPERVISOR, OPERADOR..."
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: `1px solid ${c.border}`, background: c.inputBg, color: c.text, fontSize: '12.5px', fontWeight: '600', boxSizing: 'border-box' }}
                />
                <datalist id="puestos-coherentes-arbol">
                  {puestosDelDeptoSeleccionado.map(p => <option key={p} value={p} />)}
                </datalist>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: c.subText, marginBottom: '4px', textTransform: 'uppercase' }}>4. Reporta en Organigrama a:</label>
                <select
                  value={userEditando.reporta_a_id || ''}
                  onChange={e => setUserEditando({ ...userEditando, reporta_a_id: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: `1px solid ${c.border}`, background: c.inputBg, color: c.text, fontSize: '12.5px', fontWeight: '600', boxSizing: 'border-box' }}
                >
                  <option value="">Directo en su Área / Gerencia del Depto</option>
                  {posiblesJefesEnDepto.map(j => (
                    <option key={j.id} value={j.id}>{j.nombre_completo} ({j.puesto || j.area})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: c.subText, marginBottom: '4px', textTransform: 'uppercase' }}>5. Rol de Autorización</label>
                <select
                  value={userEditando.rol}
                  onChange={e => setUserEditando({ ...userEditando, rol: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: `1px solid ${c.border}`, background: c.inputBg, color: c.text, fontSize: '12.5px', fontWeight: '600', boxSizing: 'border-box' }}
                >
                  <option value="empleado">EMPLEADO / OPERADOR (Nivel 4)</option>
                  <option value="encargado">ENCARGADO / SUPERVISOR SUBÁREA (Nivel 3)</option>
                  <option value="jefe_area">JEFE DE DEPARTAMENTO / ÁREA (Nivel 2)</option>
                  <option value="rh_nominas">RH / NÓMINAS (Dictamina nómina)</option>
                  <option value="gerente_produccion">GERENTE DE PRODUCCIÓN (Nivel 1)</option>
                  <option value="gerente_admin">GERENTE ADMINISTRATIVO (Nivel 1)</option>
                  <option value="gerente_rh">GERENTE DE RECURSOS HUMANOS (Nivel 1)</option>
                  <option value="caseta">CASETA / VIGILANCIA</option>
                  <option value="superadmin">SUPER ADMINISTRADOR</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <button type="button" onClick={() => setUserEditando(null)} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: `1px solid ${c.border}`, background: 'transparent', color: c.subText, fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" disabled={guardando} style={{ flex: 1.5, padding: '10px', borderRadius: '6px', border: 'none', background: c.accent, color: '#fff', fontWeight: '800', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
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

function renderPlacaIndustrial(u, c, setFotoZoom, modoOscuro, seguridadDesbloqueada, onEditarUsuario, tipoNodo = 'operativo', esMobile = false) {
  const badge = obtenerBadgeRol(u.rol, modoOscuro);
  const urlFoto = u.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.nombre_completo)}&background=262626&color=fff&bold=true`;

  const esGerencia = tipoNodo === 'gerencia';
  const esLider = tipoNodo === 'lider';
  const esSubordinado = tipoNodo === 'subordinado';
  const esMando = esGerencia || esLider || (u.rol && u.rol !== 'empleado');

  const tamanoFoto = esMobile 
    ? (esGerencia ? '38px' : '34px') 
    : (esGerencia ? '42px' : (esLider ? '38px' : '34px'));

  let IconoRango = User;
  if (esGerencia) IconoRango = Crown;
  else if (esLider) IconoRango = ShieldCheck;
  else if (esSubordinado) IconoRango = CornerDownRight;

  return (
    <div 
      key={u.id} 
      className="placa-industrial"
      style={{
        borderLeft: `3.5px solid ${badge.accentBar}`,
        background: esSubordinado ? (modoOscuro ? '#161616' : '#fcfcfd') : c.surfaceCard
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: esMobile ? '9px' : '11px', minWidth: 0, flex: 1 }}>
        <img 
          src={urlFoto} 
          alt="" 
          onClick={() => setFotoZoom && setFotoZoom({ url: urlFoto, nombre: u.nombre_completo, puesto: u.puesto })}
          title="Toca para ampliar fotografía"
          style={{ 
            width: tamanoFoto, 
            height: tamanoFoto, 
            borderRadius: '7px', 
            objectFit: 'cover', 
            cursor: 'pointer', 
            border: `1px solid ${c.border}`, 
            flexShrink: 0
          }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: 1 }}>
          {/* RENGLÓN 1: NOMBRE COMPLETO <---> BADGE DE MANDO (SOLO SI ES LÍDER/GERENCIA) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', minWidth: 0 }}>
            <div style={{
              fontSize: esMobile ? '12.5px' : '13px',
              fontWeight: '800',
              color: c.text,
              lineHeight: '1.2',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              minWidth: 0,
              flex: 1
            }}>
              {u.nombre_completo}
            </div>

            {esMando ? (
              <span style={{ 
                display: 'inline-flex', alignItems: 'center', gap: '3px',
                fontSize: '9px', fontWeight: '800', color: badge.text, background: badge.bg,
                border: `1px solid ${badge.border}`, padding: '1.5px 6px', borderRadius: '4px',
                whiteSpace: 'nowrap', letterSpacing: '0.03em', flexShrink: 0
              }}>
                <IconoRango size={9.5} />
                {badge.label}
              </span>
            ) : (
              <span style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: '10.5px',
                fontWeight: '700',
                color: c.subText,
                flexShrink: 0
              }}>
                #{u.numero_empleado}
              </span>
            )}
          </div>

          {/* RENGLÓN 2: #EMPLEADO (SI ES MANDO) + PUESTO EN 1 SOLA LÍNEA LIMPIA */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '11px',
            color: c.subText,
            fontWeight: '600',
            lineHeight: '1.2',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {esMando && (
              <>
                <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: '700', color: c.subText }}>
                  #{u.numero_empleado}
                </span>
                <span>•</span>
              </>
            )}
            <Briefcase size={10} style={{ flexShrink: 0, opacity: 0.65 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {u.puesto || 'COLABORADOR'}
            </span>
          </div>
        </div>
      </div>

      {seguridadDesbloqueada && (
        <button
          onClick={(e) => onEditarUsuario(u, e)}
          style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: '5px', color: c.text, cursor: 'pointer', padding: '5px 7px', fontSize: '10px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}
          title="Reacomodar en el organigrama"
        >
          <Edit2 size={11} />
        </button>
      )}
    </div>
  );
}
