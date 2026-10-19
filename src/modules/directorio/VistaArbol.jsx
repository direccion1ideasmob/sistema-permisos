import React, { useState, useRef, useEffect } from 'react';
import { 
  Factory, Building2, HardHat, ChevronDown, ChevronRight, 
  Edit2, Lock, Unlock, X, Save, Users, Crown, ShieldCheck, 
  User, CornerDownRight, Briefcase, Hash, Banknote, UserPlus,
  Cpu, Compass, Wrench, Package, FileText, ShieldAlert, Layers
} from 'lucide-react';
import { obtenerBadgeRol, obtenerClaveOrdenApellido, estandarizar } from './utils/directorioHelpers';
import { actualizarDepartamentoSeguro, reubicarColaboradorEnArbol } from './services/directorioService';
import { obtenerTemaGlobal } from '../../core/theme/temaGlobal';
import ModalSeguridadPin from './ModalSeguridadPin';

const normalizar = (txt) => txt ? estandarizar(txt.toUpperCase()) : 'GENERAL';

const obtenerIconoSubarea = (nombreArea = '') => {
  const n = normalizar(nombreArea);
  if (n.includes('NOMINA') || n.includes('FINANZA') || n.includes('CONTAB') || n.includes('TESORERIA') || n.includes('PAGO')) return Banknote;
  if (n.includes('SEGURIDAD') || n.includes('HIGIENE') || n.includes('INDUSTRIAL') || n.includes('EHS') || n.includes('MEDICO') || n.includes('SALUD')) return ShieldAlert;
  if (n.includes('RECLUTAMIENTO') || n.includes('SELECCION') || n.includes('TALENTO') || n.includes('CONTRATACION')) return UserPlus;
  if (n.includes('SISTEMA') || n.includes('DESARROLLO') || n.includes('TI') || n.includes('INFORMATICA') || n.includes('SOPORTE') || n.includes('CNC') || n.includes('LASER')) return Cpu;
  if (n.includes('ESTIMACION') || n.includes('INGENIERIA') || n.includes('PROYECTO') || n.includes('DISENO') || n.includes('ARQUITECT')) return Compass;
  if (n.includes('CARPINTERIA') || n.includes('PRODUCCION') || n.includes('MAQUINADO') || n.includes('ARMADO') || n.includes('BARNIZ') || n.includes('HERRERIA') || n.includes('METAL') || n.includes('MANTENIMIENTO')) return Wrench;
  if (n.includes('ALMACEN') || n.includes('COMPRA') || n.includes('LOGISTICA') || n.includes('INVENTARIO') || n.includes('EMBARQUE')) return Package;
  if (n.includes('OBRA') || n.includes('INSTALACION') || n.includes('RESIDENTE') || n.includes('CAMPO')) return HardHat;
  if (n.includes('VIGILANCIA') || n.includes('CASETA') || n.includes('BUNKER') || n.includes('ACCESO')) return ShieldCheck;
  if (n.includes('ADMIN') || n.includes('DOCUMENT') || n.includes('AUXILIAR') || n.includes('RECEPCION')) return FileText;
  return Layers;
};

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
    line: modoOscuro ? '#404040' : '#cbd5e1',
    lineStrong: modoOscuro ? '#525252' : '#94a3b8',
    panelBg: modoOscuro ? '#141414' : '#f1f5f9',
    popoverBg: tema.surfaceCard,
    popoverBorder: tema.border,
  };

  const secciones = [
    { key: 'produccion', label: 'PLANTA & PRODUCCIÓN', icon: Factory, match: 'prod', rolGerenteDiv: 'gerente_produccion' },
    { key: 'administrativo', label: 'CORPORATIVO & ADMINISTRACIÓN', icon: Building2, match: 'admin', rolGerenteDiv: 'gerente_admin' },
    { key: 'obra', label: 'OPERACIONES EN OBRA', icon: HardHat, match: 'obra', rolGerenteDiv: null }
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
    <div style={{ width: '100%', maxWidth: '100%', overflowX: 'hidden', boxSizing: 'border-box', fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif' }}>
      <style>{`
        .placa-industrial {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 14px;
          border-radius: 6px;
          background: ${c.surfaceCard};
          border: 1.5px solid ${c.border};
          transition: border-color 0.15s ease, background 0.15s ease;
          position: relative;
          width: 100%;
          box-sizing: border-box;
        }
        .placa-industrial:hover {
          border-color: ${c.lineStrong};
        }

        .industrial-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr));
          gap: 24px;
          width: 100%;
          box-sizing: border-box;
          align-items: start;
        }

        .tronco-gerencia {
          position: relative;
          padding-bottom: 22px;
          width: 100%;
          max-width: 480px;
          box-sizing: border-box;
        }
        .tronco-gerencia::after {
          content: '';
          position: absolute;
          left: 32px;
          bottom: 0;
          width: 2px;
          height: 22px;
          background: ${c.lineStrong};
        }

        .rama-subordinados {
          position: relative;
          margin-left: 28px;
          padding-left: 24px;
          border-left: 2px solid ${c.lineStrong};
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 12px;
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
          left: -24px;
          top: 50%;
          width: 24px;
          height: 2px;
          background: ${c.lineStrong};
        }
        .nodo-subordinado::after {
          content: '';
          position: absolute;
          left: -28px;
          top: calc(50% - 3px);
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: ${c.lineStrong};
        }

        @media (max-width: 640px) {
          .industrial-grid {
            grid-template-columns: 1fr;
            gap: 16px;
          }
          .placa-industrial {
            padding: 10px 12px;
            gap: 10px;
          }
          .tronco-gerencia {
            padding-bottom: 16px;
          }
          .tronco-gerencia::after {
            left: 22px;
            height: 16px;
          }
          .rama-subordinados {
            margin-left: 14px;
            padding-left: 16px;
            gap: 10px;
            margin-top: 10px;
          }
          .nodo-subordinado::before {
            left: -16px;
            width: 16px;
          }
          .nodo-subordinado::after {
            left: -20px;
          }
        }
      `}</style>

      {/* BARRA DE CONTROL SUPERIOR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          {seguridadDesbloqueada ? (
            <button onClick={() => setSeguridadDesbloqueada(false)} style={{ background: c.accentSoft, border: `1.5px solid ${c.accent}`, padding: '7px 12px', borderRadius: '6px', color: c.accent, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              <Unlock size={13} /> Edición Activa
            </button>
          ) : (
            <button onClick={() => setModalPinAbierto(true)} style={{ background: c.surfaceCard, border: `1.5px solid ${c.border}`, padding: '7px 12px', borderRadius: '6px', color: c.text, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              <Lock size={13} color="#f59e0b" /> <span>Acomodar Estructura</span>
            </button>
          )}
        </div>

        <select 
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          style={{ background: c.surfaceCard, border: `1.5px solid ${c.border}`, borderRadius: '6px', color: c.text, fontSize: '11.5px', fontWeight: '800', padding: '7px 10px', outline: 'none', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.02em', maxWidth: '100%' }}
        >
          <option value="ALL">Todas las Divisiones</option>
          <option value="produccion">Planta & Producción</option>
          <option value="administrativo">Corporativo & Administración</option>
          <option value="obra">Operaciones en Obra</option>
        </select>
      </div>

      {/* SECCIONES POR DIVISIÓN */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '36px' }}>
        {seccionesVisibles.map(sec => {
          const IconoSec = sec.icon;

          // Identificar al Gerente General de esta División (Reynaldo en Producción, Pedro Simón en Administración)
          const gerentesDivision = sec.rolGerenteDiv
            ? usuarios.filter(u => u.rol === sec.rolGerenteDiv && u.activo === true)
            : [];
          const idsGerentesDivision = new Set(gerentesDivision.map(g => g.id));

          // Filtrar departamentos de la división (ocultando cajas donde solo estaba el gerente de división solito, ej. "PRODUCCION" o "DIRECCION")
          const deptosSec = (departamentos || []).filter(d => {
            const esDeEstaRama = (d.clasificacion || 'produccion').toLowerCase().includes(sec.match);
            if (!esDeEstaRama) return false;
            const activosSinGerenteDiv = usuarios.filter(u => u.departamento_id === d.id && u.activo === true && !idsGerentesDivision.has(u.id));
            return seguridadDesbloqueada || activosSinGerenteDiv.length > 0;
          });

          if (deptosSec.length === 0 && gerentesDivision.length === 0) return null;

          return (
            <div key={sec.key}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', paddingBottom: '8px', borderBottom: `2px solid ${c.border}` }}>
                <IconoSec size={16} color={c.text} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: '12.5px', fontWeight: '900', color: c.text, letterSpacing: '0.06em' }}>
                  {sec.label}
                </span>
              </div>

              {/* CABEZA DE LA DIVISIÓN (Ej. REYNALDO ORTIZ arriba de todos los departamentos de Producción) */}
              {gerentesDivision.length > 0 && (
                <div className={deptosSec.length > 0 ? "tronco-gerencia" : ""} style={{ marginBottom: deptosSec.length > 0 ? '0' : '14px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {gerentesDivision.map(g => renderPlacaIndustrial(g, c, setFotoZoom, modoOscuro, seguridadDesbloqueada, abrirEdicionUsuarioArbol, 'gerencia', esMobile))}
                  </div>
                </div>
              )}

              {/* DEPARTAMENTOS QUE CUELGAN DE ESTA DIVISIÓN */}
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '12px',
                marginLeft: gerentesDivision.length > 0 ? (esMobile ? '10px' : '20px') : '0',
                paddingLeft: gerentesDivision.length > 0 ? (esMobile ? '10px' : '16px') : '0',
                borderLeft: gerentesDivision.length > 0 ? `2px solid ${c.lineStrong}` : 'none'
              }}>
                {deptosSec.map(depto => {
                  const abierto = Boolean(deptosAbiertos[depto.id]);
                  const estaEditando = deptoEditandoId === depto.id;
                  const nombreDeptoNorm = normalizar(depto.nombre);

                  const personalDepto = (usuarios || [])
                    .filter(u => u.departamento_id === depto.id && u.activo === true && !idsGerentesDivision.has(u.id))
                    .sort((a, b) => obtenerClaveOrdenApellido(a).localeCompare(obtenerClaveOrdenApellido(b)));

                  // Detectar si existen subáreas específicas distintas al nombre del departamento (ej. CNC LASER dentro de METAL)
                  const haySubareasEspecificas = personalDepto.some(u => {
                    const a = normalizar(u.area || depto.nombre);
                    return a !== nombreDeptoNorm && a !== 'GENERAL' && !['superadmin', 'gerente_produccion', 'gerente_admin', 'gerente_rh'].includes(u.rol);
                  });

                  // CABEZA DEL DEPARTAMENTO:
                  // 1) Gerente propio del depto (ej. José Coca en RH)
                  // 2) O el Jefe General del Departamento (jefe_area cuya área es el nombre del Depto, ej. René Morales en METAL)
                  const cabezaDepto = personalDepto.filter(u => {
                    if (['superadmin', 'gerente_rh'].includes(u.rol)) return true;
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
                    <div key={depto.id} style={{ background: c.panelBg, border: `1.5px solid ${c.border}`, borderRadius: '8px', position: 'relative', boxSizing: 'border-box', width: '100%' }}>
                      
                      {/* CABECERA DEL DEPARTAMENTO */}
                      <div 
                        onClick={() => toggleDepto(depto.id)}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: esMobile ? '12px 14px' : '14px 18px', cursor: 'pointer', background: c.surfaceCard, borderRadius: abierto ? '7px 7px 0 0' : '7px', borderBottom: abierto ? `1.5px solid ${c.border}` : 'none', gap: '8px' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                          <div style={{ width: '26px', height: '26px', borderRadius: '4px', background: abierto ? '#171717' : c.surface, color: abierto ? '#ffffff' : c.subText, border: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {abierto ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                          </div>
                          <span style={{ fontSize: esMobile ? '13.5px' : '14.5px', fontWeight: '900', color: c.text, letterSpacing: '0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {depto.nombre}
                          </span>
                          <span style={{ fontSize: '11px', color: c.subText, background: c.surface, border: `1px solid ${c.border}`, padding: '2px 7px', borderRadius: '4px', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                            <Users size={11} /> {personalDepto.length}
                          </span>
                        </div>

                        {seguridadDesbloqueada && (
                          <button onClick={(e) => iniciarEdicionRapidaDepto(depto, e)} style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: '4px', color: c.text, cursor: 'pointer', padding: '5px 8px', fontSize: '10.5px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'uppercase', flexShrink: 0 }}>
                            <Edit2 size={11} /> Depto
                          </button>
                        )}
                      </div>

                      {/* POPOVER EDICIÓN DEPTO */}
                      {estaEditando && (
                        <div ref={popoverRef} onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: '50px', right: '10px', background: c.popoverBg, border: `1.5px solid ${c.popoverBorder}`, borderRadius: '8px', padding: '14px', zIndex: 300, boxShadow: '0 10px 30px rgba(0,0,0,0.5)', width: '260px', maxWidth: 'calc(100vw - 40px)', display: 'flex', flexDirection: 'column', gap: '10px', boxSizing: 'border-box' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', fontWeight: '800', color: c.text, textTransform: 'uppercase' }}>Ajustar Departamento</span>
                            <button onClick={() => setDeptoEditandoId(null)} style={{ background: 'none', border: 'none', color: c.subText, cursor: 'pointer' }}><X size={14} /></button>
                          </div>

                          <form onSubmit={guardarDepto} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <input type="text" value={nombreEdit} onChange={e => setNombreEdit(e.target.value.toUpperCase())} placeholder="Nombre del depto" autoFocus style={{ width: '100%', height: '34px', padding: '0 8px', borderRadius: '4px', border: `1px solid ${c.popoverBorder}`, background: c.inputBg, color: c.text, fontSize: '12px', fontWeight: '700', outline: 'none', boxSizing: 'border-box' }} />
                            <div style={{ display: 'flex', gap: '4px' }}>
                              {[ { key: 'produccion', label: 'Producción' }, { key: 'administrativo', label: 'Admón' }, { key: 'obra', label: 'Obra' } ].map(op => (
                                <button key={op.key} type="button" onClick={() => setClasifEdit(op.key)} style={{ flex: 1, padding: '6px 2px', borderRadius: '4px', border: `1px solid ${clasifEdit === op.key ? c.accent : c.popoverBorder}`, background: clasifEdit === op.key ? c.accentSoft : 'transparent', color: clasifEdit === op.key ? c.accent : c.subText, fontSize: '10.5px', fontWeight: '800', cursor: 'pointer' }}>
                                  {op.label}
                                </button>
                              ))}
                            </div>
                            <button type="submit" disabled={guardando} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: 'none', background: c.accent, color: '#fff', fontSize: '12px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                              <Save size={13} /> {guardando ? 'Guardando...' : 'Guardar'}
                            </button>
                          </form>
                        </div>
                      )}

                      {/* DIAGRAMA ESTRUCTURAL DEL DEPARTAMENTO */}
                      {abierto && (
                        <div style={{ padding: esMobile ? '12px' : '22px', boxSizing: 'border-box', width: '100%' }}>
                          
                          {/* 1. CABEZA DEL DEPARTAMENTO (Ej. José Coca en RH, o René Morales en METAL) */}
                          {cabezaDepto.length > 0 && (
                            <div className={clavesSubdeptos.length > 0 ? "tronco-gerencia" : ""}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {cabezaDepto.map(u => renderPlacaIndustrial(u, c, setFotoZoom, modoOscuro, seguridadDesbloqueada, abrirEdicionUsuarioArbol, u.rol === 'jefe_area' ? 'lider' : 'gerencia', esMobile))}
                              </div>
                            </div>
                          )}

                          {/* 2. MÓDULOS DE SUBDEPARTAMENTOS / CÉLULAS (Ej. CNC LASER, NOMINAS, SEGURIDAD) */}
                          {clavesSubdeptos.length > 0 && (
                            <div style={{ 
                              borderTop: cabezaDepto.length > 0 && clavesSubdeptos.length > 1 ? `2px solid ${c.lineStrong}` : 'none',
                              paddingTop: cabezaDepto.length > 0 && clavesSubdeptos.length > 1 ? (esMobile ? '14px' : '20px') : '0',
                              width: '100%',
                              boxSizing: 'border-box'
                            }}>
                              <div className="industrial-grid">
                                {clavesSubdeptos.map(clave => {
                                  const grupo = subdeptosMap[clave];
                                  const idsGrupo = new Set(grupo.miembros.map(m => m.id));
                                  const IconoArea = obtenerIconoSubarea(grupo.etiqueta);

                                  const tieneJefeArea = grupo.miembros.some(m => m.rol === 'jefe_area');
                                  const tieneEmpleadosBase = grupo.miembros.some(m => m.rol === 'empleado');

                                  const esTitularDeSubdepto = (m) => {
                                    if (grupo.miembros.some(sub => sub.reporta_a_id === m.id)) return true;
                                    if (m.rol === 'jefe_area' || m.rol === 'encargado') return true;
                                    if (!tieneJefeArea && tieneEmpleadosBase && m.rol === 'rh_nominas') return true;
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
                                        background: mostrarCabeceraSubdepto ? (modoOscuro ? '#1f1f1f' : '#ffffff') : 'transparent',
                                        border: mostrarCabeceraSubdepto ? `1.5px solid ${c.border}` : 'none',
                                        borderRadius: '6px',
                                        overflow: 'hidden',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        width: '100%',
                                        boxSizing: 'border-box'
                                      }}
                                    >
                                      {mostrarCabeceraSubdepto && (
                                        <div style={{ 
                                          background: modoOscuro ? '#262626' : '#e2e8f0', 
                                          padding: esMobile ? '8px 12px' : '9px 14px', 
                                          borderBottom: `1.5px solid ${c.border}`,
                                          display: 'flex', 
                                          justifyContent: 'space-between', 
                                          alignItems: 'center',
                                          gap: '8px'
                                        }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                            <div style={{ background: c.surfaceCard, border: `1px solid ${c.border}`, padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                              <IconoArea size={13} color={c.text} />
                                            </div>
                                            <span style={{ fontSize: '11.5px', fontWeight: '900', color: c.text, textTransform: 'uppercase', letterSpacing: '0.05em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                              {grupo.etiqueta}
                                            </span>
                                          </div>
                                          <span style={{ fontSize: '10.5px', fontWeight: '800', color: c.subText, background: c.surfaceCard, padding: '1px 7px', borderRadius: '4px', border: `1px solid ${c.border}`, flexShrink: 0 }}>
                                            {grupo.miembros.length}
                                          </span>
                                        </div>
                                      )}

                                      <div style={{ padding: mostrarCabeceraSubdepto ? (esMobile ? '10px' : '16px') : '0', display: 'flex', flexDirection: 'column', gap: '12px', boxSizing: 'border-box', width: '100%' }}>
                                        {miembrosRaiz.map(titular => {
                                          const subordinados = grupo.miembros.filter(sub => {
                                            if (sub.id === titular.id) return false;
                                            if (sub.reporta_a_id === titular.id) return true;
                                            if ((!sub.reporta_a_id || !idsGrupo.has(sub.reporta_a_id)) && liderPrincipal && titular.id === liderPrincipal.id && !esTitularDeSubdepto(sub)) {
                                              return true;
                                            }
                                            return false;
                                          });

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
                                    </div>
                                  );
                                })}
                              </div>
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
        <div onClick={() => setUserEditando(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2500, padding: '16px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: c.surfaceCard, border: `1.5px solid ${c.border}`, borderRadius: '8px', padding: '20px', width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${c.border}`, paddingBottom: '10px' }}>
              <div>
                <div style={{ fontSize: '10.5px', fontWeight: '800', color: c.accent, textTransform: 'uppercase' }}>Reubicación Técnica</div>
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
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: c.subText, marginBottom: '4px', textTransform: 'uppercase' }}>4. Reporta en Organigrama a (Superior):</label>
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

  const tamanoFoto = esMobile 
    ? (esGerencia ? '46px' : '42px') 
    : (esGerencia ? '58px' : (esLider ? '52px' : '46px'));

  let IconoRango = User;
  if (esGerencia) IconoRango = Crown;
  else if (esLider) IconoRango = ShieldCheck;
  else if (esSubordinado) IconoRango = CornerDownRight;

  return (
    <div 
      key={u.id} 
      className="placa-industrial"
      style={{
        borderLeft: `4px solid ${badge.accentBar}`,
        background: esSubordinado ? (modoOscuro ? '#181818' : '#f8fafc') : c.surfaceCard
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: esMobile ? '10px' : '14px', minWidth: 0, flex: 1 }}>
        <img 
          src={urlFoto} 
          alt="" 
          onClick={() => setFotoZoom && setFotoZoom({ url: urlFoto, nombre: u.nombre_completo, puesto: u.puesto })}
          title="Toca para ampliar fotografía"
          style={{ 
            width: tamanoFoto, 
            height: tamanoFoto, 
            borderRadius: '6px', 
            objectFit: 'cover', 
            cursor: 'pointer', 
            border: `1.5px solid ${c.border}`, 
            flexShrink: 0
          }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', fontSize: '10px', fontWeight: '800', color: c.subText, background: modoOscuro ? '#262626' : '#f1f5f9', padding: '1px 6px', borderRadius: '4px', border: `1px solid ${c.border}` }}>
              <Hash size={10} /> {u.numero_empleado}
            </span>

            <span style={{ 
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              fontSize: '9px', fontWeight: '800', color: badge.text, background: badge.bg,
              border: `1px solid ${badge.border}`, padding: '2px 6px', borderRadius: '4px', whiteSpace: 'nowrap', letterSpacing: '0.03em'
            }}>
              <IconoRango size={10} />
              {badge.label}
            </span>
          </div>

          <div style={{ fontSize: esMobile ? '13px' : (esGerencia ? '14.5px' : '13.5px'), fontWeight: '900', color: c.text, letterSpacing: '-0.01em', lineHeight: '1.25', marginTop: '1px', wordBreak: 'break-word' }}>
            {u.nombre_completo}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: c.subText, fontWeight: '600', lineHeight: '1.2' }}>
            <Briefcase size={11} style={{ flexShrink: 0, opacity: 0.7 }} />
            <span style={{ wordBreak: 'break-word' }}>{u.puesto || 'SIN PUESTO ASIGNADO'}</span>
          </div>
        </div>
      </div>

      {seguridadDesbloqueada && (
        <button
          onClick={(e) => onEditarUsuario(u, e)}
          style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: '4px', color: c.text, cursor: 'pointer', padding: esMobile ? '6px 7px' : '6px 10px', fontSize: '10px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, textTransform: 'uppercase' }}
          title="Reacomodar en el organigrama"
        >
          <Edit2 size={11} /> {!esMobile && 'Mover'}
        </button>
      )}
    </div>
  );
}
