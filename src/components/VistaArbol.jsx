import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  Factory, Building2, HardHat, ChevronDown, ChevronRight, 
  MapPin, Edit2, Crown, Check, X, Save 
} from 'lucide-react';
import { obtenerIconoDepto, obtenerBadgeRol, estandarizar } from '../utils/directorioHelpers';

export default function VistaArbol({ 
  usuarios = [], departamentos = [], deptosAbiertos = {}, toggleDepto, 
  recargarDatos, setFotoZoom, modoOscuro 
}) {
  const [filtro, setFiltro] = useState('ALL');

  // Mini-edición flotante integrada
  const [deptoEditandoId, setDeptoEditandoId] = useState(null);
  const [nombreEdit, setNombreEdit] = useState('');
  const [clasifEdit, setClasifEdit] = useState('produccion');
  const [guardando, setGuardando] = useState(false);
  const popoverRef = useRef(null);

  // Cerrar popover si hace clic fuera
  useEffect(() => {
    const clickFuera = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setDeptoEditandoId(null);
      }
    };
    document.addEventListener('mousedown', clickFuera);
    return () => document.removeEventListener('mousedown', clickFuera);
  }, []);

  const c = {
    bg: 'transparent',
    text: modoOscuro ? '#f8fafc' : '#0f172a',
    subText: modoOscuro ? '#94a3b8' : '#64748b',
    line: modoOscuro ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    hoverBg: modoOscuro ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
    popoverBg: modoOscuro ? '#141418' : '#ffffff',
    popoverBorder: modoOscuro ? '#27272a' : '#e2e8f0',
    inputBg: modoOscuro ? '#18181f' : '#f8fafc',
    accent: '#16a34a'
  };

  const secciones = [
    { key: 'produccion', label: 'Producción', icon: Factory, match: 'prod' },
    { key: 'administrativo', label: 'Administración', icon: Building2, match: 'admin' },
    { key: 'obra', label: 'Obra', icon: HardHat, match: 'obra' }
  ];

  const seccionesVisibles = filtro === 'ALL' ? secciones : secciones.filter(s => s.key === filtro);

  // Abrir mini-edición
  const iniciarEdicionRapida = (depto, e) => {
    e.stopPropagation();
    setDeptoEditandoId(depto.id);
    setNombreEdit(depto.nombre);
    setClasifEdit((depto.clasificacion || 'produccion').toLowerCase().trim());
  };

  // Guardar cambio en Supabase
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
      if (!data || data.length === 0) throw new Error("No se pudo actualizar en Supabase.");

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
      
      {/* FILTRO MINIMALISTA */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>
        <select 
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          style={{
            background: 'transparent', border: 'none', borderBottom: `1px solid ${c.line}`,
            color: c.text, fontSize: '12px', fontWeight: '600', padding: '4px 2px',
            outline: 'none', cursor: 'pointer'
          }}
        >
          <option value="ALL" style={{ background: modoOscuro ? '#000' : '#fff' }}>Estructura Completa</option>
          <option value="produccion" style={{ background: modoOscuro ? '#000' : '#fff' }}>Producción</option>
          <option value="administrativo" style={{ background: modoOscuro ? '#000' : '#fff' }}>Administración</option>
          <option value="obra" style={{ background: modoOscuro ? '#000' : '#fff' }}>Obra</option>
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
        {seccionesVisibles.map(sec => {
          const IconoSec = sec.icon;
          const deptosSec = (departamentos || []).filter(d => (d.clasificacion || 'produccion').toLowerCase().includes(sec.match));

          if (deptosSec.length === 0) return null;

          return (
            <div key={sec.key}>
              {/* TÍTULO DE LA SECCIÓN */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', paddingBottom: '8px', borderBottom: `1px solid ${c.line}` }}>
                <IconoSec size={16} color={c.text} />
                <span style={{ fontSize: '14px', fontWeight: '800', color: c.text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {sec.label}
                </span>
              </div>

              {/* LISTA DE DEPARTAMENTOS */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {deptosSec.map(depto => {
                  const abierto = Boolean(deptosAbiertos[depto.id]);
                  const personalDepto = (usuarios || []).filter(u => u.departamento_id === depto.id);
                  const estaEditando = deptoEditandoId === depto.id;

                  // Jefatura por ID real
                  const jefe = personalDepto.find(u => u.id === depto.jefe_id);
                  const encargado = personalDepto.find(u => u.id === depto.encargado_id && u.id !== depto.jefe_id);
                  const subordinados = personalDepto.filter(u => u.id !== depto.jefe_id && u.id !== depto.encargado_id);

                  const areasMap = subordinados.reduce((acc, u) => {
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
                          padding: '8px 12px', borderRadius: '6px', cursor: 'pointer',
                          background: abierto ? c.hoverBg : 'transparent',
                          transition: 'background 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {abierto ? <ChevronDown size={14} color={c.subText} /> : <ChevronRight size={14} color={c.subText} />}
                          <span style={{ fontSize: '13px', fontWeight: '700', color: c.text }}>{depto.nombre}</span>
                          <span style={{ fontSize: '11px', color: c.subText, fontWeight: '500' }}>{personalDepto.length} pers.</span>
                        </div>

                        {/* BOTÓN LÁPIZ */}
                        <button
                          onClick={(e) => iniciarEdicionRapida(depto, e)}
                          style={{ background: 'transparent', border: 'none', color: c.subText, cursor: 'pointer', padding: '4px' }}
                          title="Renombrar o cambiar clasificación"
                        >
                          <Edit2 size={12} />
                        </button>
                      </div>

                      {/* MINI-POPOVER FLOTANTE INTEGRADO PARA RENOMBRAR O CAMBIAR RAMA */}
                      {estaEditando && (
                        <div 
                          ref={popoverRef}
                          onClick={e => e.stopPropagation()}
                          style={{
                            position: 'absolute', top: '38px', right: '10px',
                            background: c.popoverBg, border: `1px solid ${c.popoverBorder}`,
                            borderRadius: '10px', padding: '14px', zIndex: 300,
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
                              type="text" 
                              value={nombreEdit} 
                              onChange={e => setNombreEdit(e.target.value)}
                              placeholder="Nombre del depto"
                              autoFocus
                              style={{
                                width: '100%', height: '32px', padding: '0 8px', borderRadius: '6px',
                                border: `1px solid ${c.popoverBorder}`, background: c.inputBg, color: c.text,
                                fontSize: '12px', outline: 'none', boxSizing: 'border-box'
                              }}
                            />

                            <div style={{ display: 'flex', gap: '4px' }}>
                              {[
                                { key: 'produccion', label: 'Prod' },
                                { key: 'administrativo', label: 'Admón' },
                                { key: 'obra', label: 'Obra' }
                              ].map(op => (
                                <button
                                  key={op.key}
                                  type="button"
                                  onClick={() => setClasifEdit(op.key)}
                                  style={{
                                    flex: 1, padding: '5px 2px', borderRadius: '5px',
                                    border: `1px solid ${clasifEdit === op.key ? c.accent : c.popoverBorder}`,
                                    background: clasifEdit === op.key ? (modoOscuro ? 'rgba(22,163,74,0.15)' : '#dcfce7') : 'transparent',
                                    color: clasifEdit === op.key ? c.accent : c.subText,
                                    fontSize: '10.5px', fontWeight: '700', cursor: 'pointer'
                                  }}
                                >
                                  {op.label}
                                </button>
                              ))}
                            </div>

                            <button 
                              type="submit" disabled={guardando}
                              style={{
                                width: '100%', padding: '7px', borderRadius: '6px', border: 'none',
                                background: c.accent, color: '#fff', fontSize: '11.5px', fontWeight: '700',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
                              }}
                            >
                              <Save size={12} /> {guardando ? 'Guardando...' : 'Guardar'}
                            </button>
                          </form>
                        </div>
                      )}

                      {/* CONTENIDO DEL DEPARTAMENTO (JERARQUÍA INDENTADA) */}
                      {abierto && (
                        <div style={{ marginLeft: '20px', paddingLeft: '14px', borderLeft: `1px solid ${c.line}`, marginTop: '4px', marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          
                          {/* JEFATURA Y ENCARGADOS */}
                          {(jefe || encargado) && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ fontSize: '10px', fontWeight: '800', color: c.accent, textTransform: 'uppercase', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Crown size={10} /> Jefatura y Liderazgo
                              </div>
                              {jefe && renderItemLista(jefe, c, setFotoZoom, modoOscuro, "Jefe de Área")}
                              {encargado && renderItemLista(encargado, c, setFotoZoom, modoOscuro, "Encargado")}
                            </div>
                          )}

                          {/* SUBORDINADOS POR ÁREA */}
                          {Object.keys(areasMap).sort().map(area => (
                            <div key={area} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ fontSize: '10px', fontWeight: '800', color: c.subText, textTransform: 'uppercase', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <MapPin size={10} /> {area}
                              </div>
                              {areasMap[area].map(u => renderItemLista(u, c, setFotoZoom, modoOscuro, null))}
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
  );
}

function renderItemLista(u, c, setFotoZoom, modoOscuro, rolLider = null) {
  const badge = obtenerBadgeRol(u.rol, modoOscuro);
  const urlFoto = u.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.nombre_completo)}&background=16a34a&color=fff&bold=true`;

  return (
    <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 0', opacity: u.activo ? 1 : 0.5 }}>
      <img 
        src={urlFoto} alt="" 
        onClick={() => setFotoZoom && setFotoZoom({ url: urlFoto, nombre: u.nombre_completo, puesto: u.puesto })}
        style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover', cursor: 'pointer', border: `1px solid ${rolLider ? c.accent : c.line}` }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', fontWeight: '600', color: c.text }}>{u.nombre_completo}</span>
        <span style={{ fontSize: '10.5px', color: c.subText }}>{u.puesto || 'Sin puesto'}</span>
        {rolLider ? (
          <span style={{ fontSize: '8.5px', fontWeight: '800', color: c.accent, background: (modoOscuro ? 'rgba(22,163,74,0.15)' : '#dcfce7'), padding: '1px 5px', borderRadius: '4px' }}>
            ★ {rolLider}
          </span>
        ) : (
          <span style={{ fontSize: '9px', fontWeight: '700', color: badge.text, border: `1px solid ${badge.border}`, padding: '1px 4px', borderRadius: '4px' }}>
            {badge.label}
          </span>
        )}
      </div>
    </div>
  );
}