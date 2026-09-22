import React, { useState } from 'react';
import { Factory, Building2, HardHat, ChevronDown, ChevronRight, MapPin, Edit2, Crown } from 'lucide-react';
import { obtenerIconoDepto, obtenerBadgeRol } from '../utils/directorioHelpers';

export default function VistaArbol({ 
  usuarios = [], departamentos = [], deptosAbiertos = {}, toggleDepto, 
  onEditarDepto, setFotoZoom, modoOscuro 
}) {
  const [filtro, setFiltro] = useState('ALL');

  const c = {
    bg: 'transparent',
    text: modoOscuro ? '#f8fafc' : '#0f172a',
    subText: modoOscuro ? '#94a3b8' : '#64748b',
    line: modoOscuro ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    hoverBg: modoOscuro ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
    accent: '#16a34a'
  };

  const secciones = [
    { key: 'produccion', label: 'Producción', icon: Factory, match: 'prod' },
    { key: 'administrativo', label: 'Administración', icon: Building2, match: 'admin' },
    { key: 'obra', label: 'Obra', icon: HardHat, match: 'obra' }
  ];

  const seccionesVisibles = filtro === 'ALL' ? secciones : secciones.filter(s => s.key === filtro);

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
              {/* TÍTULO DE LA SECCIÓN (MUY LIMPIO) */}
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

                  const jefes = personalDepto.filter(u => ['jefe_area', 'gerente', 'gerente_rh'].includes(u.rol));
                  const subordinados = personalDepto.filter(u => !['jefe_area', 'gerente', 'gerente_rh'].includes(u.rol));

                  const areasMap = subordinados.reduce((acc, u) => {
                    const a = u.area?.toUpperCase() || 'GENERAL';
                    if (!acc[a]) acc[a] = [];
                    acc[a].push(u);
                    return acc;
                  }, {});

                  return (
                    <div key={depto.id} style={{ display: 'flex', flexDirection: 'column' }}>
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
                        <button
                          onClick={(e) => { e.stopPropagation(); onEditarDepto(depto); }}
                          style={{ background: 'transparent', border: 'none', color: c.subText, cursor: 'pointer', padding: '4px' }}
                          title="Editar Departamento"
                        >
                          <Edit2 size={12} />
                        </button>
                      </div>

                      {/* CONTENIDO DEL DEPARTAMENTO (JERARQUÍA INDENTADA) */}
                      {abierto && (
                        <div style={{ marginLeft: '20px', paddingLeft: '14px', borderLeft: `1px solid ${c.line}`, marginTop: '4px', marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          
                          {/* JEFES */}
                          {jefes.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ fontSize: '10px', fontWeight: '800', color: c.subText, textTransform: 'uppercase', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Crown size={10} /> Jefatura
                              </div>
                              {jefes.map(u => renderItemLista(u, c, setFotoZoom, modoOscuro, true))}
                            </div>
                          )}

                          {/* SUBORDINADOS */}
                          {Object.keys(areasMap).sort().map(area => (
                            <div key={area} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ fontSize: '10px', fontWeight: '800', color: c.subText, textTransform: 'uppercase', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <MapPin size={10} /> {area}
                              </div>
                              {areasMap[area].map(u => renderItemLista(u, c, setFotoZoom, modoOscuro, false))}
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

// RENDER DE FILA DE COLABORADOR (MUY LIMPIA, SIN CAJAS)
function renderItemLista(u, c, setFotoZoom, modoOscuro, esJefe) {
  const badge = obtenerBadgeRol(u.rol, modoOscuro);
  const urlFoto = u.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.nombre_completo)}&background=16a34a&color=fff&bold=true`;

  return (
    <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 0', opacity: u.activo ? 1 : 0.5 }}>
      <img 
        src={urlFoto} alt="" 
        onClick={() => setFotoZoom && setFotoZoom({ url: urlFoto, nombre: u.nombre_completo, puesto: u.puesto })}
        style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover', cursor: 'pointer', border: `1px solid ${c.line}` }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', fontWeight: '600', color: c.text }}>{u.nombre_completo}</span>
        <span style={{ fontSize: '10.5px', color: c.subText }}>{u.puesto || 'Sin puesto'}</span>
        <span style={{ fontSize: '9px', fontWeight: '700', color: badge.text, border: `1px solid ${badge.border}`, padding: '1px 4px', borderRadius: '4px' }}>
          {badge.label}
        </span>
      </div>
    </div>
  );
}