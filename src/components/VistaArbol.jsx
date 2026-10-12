import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  Factory, Building2, HardHat, ChevronDown, ChevronRight, 
  MapPin, Edit2, Crown, UserCheck, Shield, Lock, Unlock, X, Save 
} from 'lucide-react';
import { obtenerBadgeRol, estandarizar } from '../utils/directorioHelpers';

// Importamos el mismo modal de seguridad que usas en el DirectorioGrid
import ModalSeguridadPin from './directorio/ModalSeguridadPin';

// === FUNCIÓN DE APOYO PARA ORDENAR POR APELLIDOS ===
const extraerApellidosParaOrden = (nombreCompleto) => {
  if (!nombreCompleto) return '';
  const partes = nombreCompleto.trim().split(/\s+/);
  if (partes.length <= 1) return nombreCompleto;
  if (partes.length === 2) return partes[1]; 
  return partes.slice(-2).join(' '); 
};

export default function VistaArbol({ 
  usuarios = [], departamentos = [], deptosAbiertos = {}, toggleDepto, 
  recargarDatos, setFotoZoom, modoOscuro 
}) {
  const [filtro, setFiltro] = useState('ALL');

  // Detección Responsiva (Celular / Tablet)
  const [esMobile, setEsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setEsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Seguridad y Edición
  const [seguridadDesbloqueada, setSeguridadDesbloqueada] = useState(false);
  const [modalPinAbierto, setModalPinAbierto] = useState(false);

  // Mini-edición flotante de departamentos
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

  // === PALETA ZINC ===
  const c = {
    bg: 'transparent',
    text: modoOscuro ? '#f4f4f5' : '#09090b',
    subText: modoOscuro ? '#a1a1aa' : '#71717a',
    line: modoOscuro ? '#3f3f46' : 'rgba(0, 0, 0, 0.08)',
    hoverBg: modoOscuro ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)',
    popoverBg: modoOscuro ? '#27272a' : '#ffffff',
    popoverBorder: modoOscuro ? '#52525b' : '#e2e8f0',
    inputBg: modoOscuro ? '#18181b' : '#f8fafc',
    accent: '#16a34a'
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
    const nomLimpio = estandarizar(nombreEdit);
    const clasifLimpia = clasifEdit.toLowerCase().trim();

    try {
      const { data, error } = await supabase
        .from('departamentos')
        .update({ nombre: nomLimpio, clasificacion: clasifLimpia })
        .eq('id', deptoEditandoId)
        .select();

      if (error) throw error;
      setDeptoEditandoId(null);
      if (recargarDatos) await recargarDatos();
    } catch (err) {
      alert("Error al actualizar: " + err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div style={{ width: '100%', boxSizing: 'border-box', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", sans-serif' }}>
      
      {/* CABECERA: CANDADO SECRETO Y FILTRO */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        
        {/* CANDADO DISCRETO */}
        <div>
          {seguridadDesbloqueada ? (
            <button 
              onClick={() => setSeguridadDesbloqueada(false)} 
              style={{ background: 'transparent', border: 'none', color: c.accent, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '700' }}
            >
              <Unlock size={14} /> Edición Habilitada
            </button>
          ) : (
            <button 
              onClick={() => setModalPinAbierto(true)} 
              style={{ background: 'transparent', border: 'none', color: c.subText, cursor: 'pointer', opacity: 0.3, transition: 'opacity 0.2s' }} 
              title="Desbloquear edición de áreas"
              onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
              onMouseLeave={(e) => e.currentTarget.style.opacity = 0.3}
            >
              <Lock size={14} />
            </button>
          )}
        </div>

        {/* FILTRO MINIMALISTA */}
        <select 
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          style={{
            background: 'transparent', border: 'none', borderBottom: `1.5px solid ${c.line}`,
            color: c.text, fontSize: '12px', fontWeight: '600', padding: '4px 2px',
            outline: 'none', cursor: 'pointer'
          }}
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
          
          // OCULTAMIENTO: Solo departamentos con personal ACTIVO
          const deptosSec = (departamentos || []).filter(d => {
            const esDeEstaRama = (d.clasificacion || 'produccion').toLowerCase().includes(sec.match);
            if (!esDeEstaRama) return false;
            return usuarios.some(u => u.departamento_id === d.id && u.activo === true);
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

                  // 1. Extraemos solo los activos del departamento y ordenamos por apellidos
                  const personalDepto = (usuarios || [])
                    .filter(u => u.departamento_id === depto.id && u.activo === true)
                    .sort((a, b) => extraerApellidosParaOrden(a.nombre_completo).localeCompare(extraerApellidosParaOrden(b.nombre_completo)));

                  // 2. LÓGICA DE JERARQUÍA POR ROLES (Cascada en 4 niveles)
                  const gerencia = personalDepto.filter(u => ['superadmin', 'gerente_produccion', 'gerente_admin', 'gerente_rh'].includes(u.rol));
                  const jefatura = personalDepto.filter(u => ['jefe_area'].includes(u.rol));
                  const supervision = personalDepto.filter(u => ['encargado', 'rh_nominas', 'caseta'].includes(u.rol));
                  const operativos = personalDepto.filter(u => !['superadmin', 'gerente_produccion', 'gerente_admin', 'gerente_rh', 'jefe_area', 'encargado', 'rh_nominas', 'caseta'].includes(u.rol));

                  // Agrupamos operativos por área
                  const areasMap = operativos.reduce((acc, u) => {
                    const a = u.area?.toUpperCase() || 'GENERAL';
                    if (!acc[a]) acc[a] = [];
                    acc[a].push(u);
                    return acc;
                  }, {});

                  return (
                    <div key={depto.id} style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
                      {/* FILA DEL DEPARTAMENTO */}
                      <div 
                        onClick={() => toggleDepto(depto.id)}
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '8px 12px', borderRadius: '8px', cursor: 'pointer',
                          background: abierto ? c.hoverBg : 'transparent',
                          transition: 'background 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {abierto ? <ChevronDown size={14} color={c.subText} /> : <ChevronRight size={14} color={c.subText} />}
                          <span style={{ fontSize: '13px', fontWeight: '700', color: c.text }}>{depto.nombre}</span>
                          <span style={{ fontSize: '11px', color: c.subText, fontWeight: '500' }}>{personalDepto.length} pers.</span>
                        </div>

                        {/* BOTÓN LÁPIZ (SOLO APARECE SI EL CANDADO ESTÁ DESBLOQUEADO) */}
                        {seguridadDesbloqueada && (
                          <button
                            onClick={(e) => iniciarEdicionRapida(depto, e)}
                            style={{ background: 'transparent', border: 'none', color: c.accent, cursor: 'pointer', padding: '4px' }}
                            title="Renombrar o cambiar clasificación"
                          >
                            <Edit2 size={13} />
                          </button>
                        )}
                      </div>

                      {/* POPOVER EDICIÓN DE DEPARTAMENTO */}
                      {estaEditando && (
                        <div 
                          ref={popoverRef}
                          onClick={e => e.stopPropagation()}
                          style={{
                            position: 'absolute', top: '38px', right: '10px',
                            background: c.popoverBg, border: `1.5px solid ${c.popoverBorder}`,
                            borderRadius: '12px', padding: '14px', zIndex: 300,
                            boxShadow: '0 10px 30px rgba(0,0,0,0.5)', width: '260px',
                            display: 'flex', flexDirection: 'column', gap: '10px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', fontWeight: '800', color: c.text }}>Ajustar Departamento</span>
                            <button onClick={() => setDeptoEditandoId(null)} style={{ background: 'none', border: 'none', color: c.subText, cursor: 'pointer' }}><X size={14} /></button>
                          </div>

                          <form onSubmit={guardarDepto} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <input 
                              type="text" value={nombreEdit} onChange={e => setNombreEdit(e.target.value)}
                              placeholder="Nombre del depto" autoFocus
                              style={{ width: '100%', height: '32px', padding: '0 8px', borderRadius: '8px', border: `1.5px solid ${c.popoverBorder}`, background: c.inputBg, color: c.text, fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}
                            />

                            <div style={{ display: 'flex', gap: '4px' }}>
                              {[ { key: 'produccion', label: 'Prod' }, { key: 'administrativo', label: 'Admón' }, { key: 'obra', label: 'Obra' } ].map(op => (
                                <button
                                  key={op.key} type="button" onClick={() => setClasifEdit(op.key)}
                                  style={{
                                    flex: 1, padding: '5px 2px', borderRadius: '6px', border: `1.5px solid ${clasifEdit === op.key ? c.accent : c.popoverBorder}`,
                                    background: clasifEdit === op.key ? (modoOscuro ? 'rgba(22,163,74,0.15)' : '#dcfce7') : 'transparent',
                                    color: clasifEdit === op.key ? c.accent : c.subText, fontSize: '10.5px', fontWeight: '700', cursor: 'pointer'
                                  }}
                                >
                                  {op.label}
                                </button>
                              ))}
                            </div>

                            <button 
                              type="submit" disabled={guardando}
                              style={{ width: '100%', padding: '7px', borderRadius: '8px', border: 'none', background: c.accent, color: '#fff', fontSize: '11.5px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                            >
                              <Save size={12} /> {guardando ? 'Guardando...' : 'Guardar'}
                            </button>
                          </form>
                        </div>
                      )}

                      {/* ÁRBOL EN CASCADA (NIVELES JERÁRQUICOS ADAPTATIVOS) */}
                      {abierto && (
                        <div style={{ 
                          marginLeft: esMobile ? '10px' : '14px', 
                          paddingTop: '6px', paddingBottom: '8px', 
                          display: 'flex', flexDirection: 'column', gap: '10px' 
                        }}>
                          
                          {/* NIVEL 1: GERENCIA Y DIRECCIÓN */}
                          {gerencia.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ fontSize: '10px', fontWeight: '800', color: '#f59e0b', textTransform: 'uppercase', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Crown size={11} /> Gerencia / Dirección
                              </div>
                              {gerencia.map(u => renderItemLista(u, c, setFotoZoom, modoOscuro))}
                            </div>
                          )}

                          {/* NIVEL 2: JEFATURA DE ÁREA */}
                          {jefatura.length > 0 && (
                            <div style={{ 
                              display: 'flex', flexDirection: 'column', gap: '4px', 
                              marginLeft: gerencia.length > 0 ? (esMobile ? '12px' : '16px') : '0', 
                              borderLeft: gerencia.length > 0 ? `1.5px solid ${c.line}` : 'none', 
                              paddingLeft: gerencia.length > 0 ? '10px' : '0' 
                            }}>
                              <div style={{ fontSize: '10px', fontWeight: '800', color: '#3b82f6', textTransform: 'uppercase', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <UserCheck size={11} /> Jefatura de Área
                              </div>
                              {jefatura.map(u => renderItemLista(u, c, setFotoZoom, modoOscuro))}
                            </div>
                          )}

                          {/* NIVEL 3: SUPERVISIÓN Y ENCARGADOS */}
                          {supervision.length > 0 && (
                            <div style={{ 
                              display: 'flex', flexDirection: 'column', gap: '4px', 
                              marginLeft: (gerencia.length > 0 || jefatura.length > 0) ? (esMobile ? '20px' : '32px') : '0', 
                              borderLeft: (gerencia.length > 0 || jefatura.length > 0) ? `1.5px solid ${c.line}` : 'none', 
                              paddingLeft: (gerencia.length > 0 || jefatura.length > 0) ? '10px' : '0' 
                            }}>
                              <div style={{ fontSize: '10px', fontWeight: '800', color: '#8b5cf6', textTransform: 'uppercase', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Shield size={11} /> Supervisión / Encargados
                              </div>
                              {supervision.map(u => renderItemLista(u, c, setFotoZoom, modoOscuro))}
                            </div>
                          )}

                          {/* NIVEL 4: PERSONAL OPERATIVO POR ÁREA */}
                          {Object.keys(areasMap).length > 0 && (
                            <div style={{ 
                              display: 'flex', flexDirection: 'column', gap: '10px', 
                              marginLeft: (gerencia.length > 0 || jefatura.length > 0 || supervision.length > 0) ? (esMobile ? '30px' : '48px') : '0', 
                              borderLeft: (gerencia.length > 0 || jefatura.length > 0 || supervision.length > 0) ? `1.5px solid ${c.line}` : 'none', 
                              paddingLeft: (gerencia.length > 0 || jefatura.length > 0 || supervision.length > 0) ? '10px' : '0' 
                            }}>
                              {Object.keys(areasMap).sort().map(area => (
                                <div key={area} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <div style={{ fontSize: '10px', fontWeight: '800', color: c.subText, textTransform: 'uppercase', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <MapPin size={11} /> {area}
                                  </div>
                                  {areasMap[area].map(u => renderItemLista(u, c, setFotoZoom, modoOscuro))}
                                </div>
                              ))}
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

      {/* MODAL PIN DE SEGURIDAD (Se abre con el candado) */}
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

// === RENDERIZADO DEL EMPLEADO (Adaptable a celular) ===
function renderItemLista(u, c, setFotoZoom, modoOscuro) {
  const badge = obtenerBadgeRol(u.rol, modoOscuro);
  const urlFoto = u.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.nombre_completo)}&background=16a34a&color=fff&bold=true`;

  return (
    <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 0', transition: 'background 0.15s ease', borderRadius: '6px' }}>
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