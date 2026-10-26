import { formatearApellidosNombreMayus, compararPorApellidoPaterno } from '../../core/utils/ordenNombre';
import React, { useState, useMemo, useEffect } from 'react';
import { Lock, Unlock, ArrowUpDown, ArrowUp, ArrowDown, ChevronRight, Search, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import { obtenerTemaGrid, generarEstilosCSS } from './utils/gridStyles';
import { obtenerClaveOrdenApellido, desglosarNombreExistente } from './utils/directorioHelpers';
import { tramitarBajaColaborador, reactivarColaborador } from './services/directorioService';
import { subirImagenUsuario } from '../../core/services/storageService';
import ModalSeguridadPin from './ModalSeguridadPin';
import ModalBajaColaborador from './ModalBajaColaborador';
import DossierLateral from './DossierLateral';

export default function DirectorioGrid({ 
  usuarios = [], departamentos = [], sedes = [], areas = [], puestos = [], 
  recargarDatos, setFotoZoom, modoOscuro 
}) {
  const c = obtenerTemaGrid(modoOscuro);
  const [esMobile, setEsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setEsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [busqueda, setBusqueda] = useState('');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [filtroSede, setFiltroSede] = useState('ALL');
  const [filtroNomina, setFiltroNomina] = useState('ALL');
  const [filtroDepto, setFiltroDepto] = useState('ALL');
  const [filtroEstatus, setFiltroEstatus] = useState('activos');
  
  const [columnaOrden, setColumnaOrden] = useState('nombre_completo');
  const [direccionOrden, setDireccionOrden] = useState('asc');

  const [colaboradorDossier, setColaboradorDossier] = useState(null);
  const [dossierAbierto, setDossierAbierto] = useState(false);
  const [datosEdit, setDatosEdit] = useState({});
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  const [seguridadDesbloqueada, setSeguridadDesbloqueada] = useState(false);
  const [modalPinAbierto, setModalPinAbierto] = useState(false);
  const [usuarioParaBaja, setUsuarioParaBaja] = useState(null);
  const [procesandoBaja, setProcesandoBaja] = useState(false);

  const departamentosConPersonal = useMemo(() => {
    const idsEnUso = new Set(usuarios.map(u => u.departamento_id).filter(Boolean));
    return departamentos.filter(d => idsEnUso.has(d.id));
  }, [usuarios, departamentos]);

  const cambiarOrden = (columna) => {
    if (columnaOrden === columna) setDireccionOrden(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setColumnaOrden(columna); setDireccionOrden('asc'); }
  };

  const limpiarFiltros = () => {
    setBusqueda('');
    setFiltroSede('ALL');
    setFiltroNomina('ALL');
    setFiltroDepto('ALL');
    setFiltroEstatus('activos');
  };

  const hayFiltros = busqueda !== '' || filtroSede !== 'ALL' || filtroNomina !== 'ALL' || filtroDepto !== 'ALL' || filtroEstatus !== 'activos';
  
  const usuariosFiltrados = useMemo(() => {
    return [...usuarios]
      .filter(u => {
        if (busqueda.trim()) {
          const q = busqueda.toLowerCase().trim();
          const match = (
            u.nombre_completo?.toLowerCase().includes(q) ||
            u.nombre?.toLowerCase().includes(q) ||
            u.apellido_paterno?.toLowerCase().includes(q) ||
            u.apellido_materno?.toLowerCase().includes(q) ||
            u.numero_empleado?.toLowerCase().includes(q) ||
            u.puesto?.toLowerCase().includes(q) ||
            u.area?.toLowerCase().includes(q)
          );
          if (!match) return false;
        }
        if (filtroSede !== 'ALL' && u.sede_id !== filtroSede) return false;
        if (filtroNomina !== 'ALL' && u.tipo_personal?.toLowerCase() !== filtroNomina.toLowerCase()) return false;
        if (filtroDepto !== 'ALL' && u.departamento_id !== filtroDepto) return false;
        if (filtroEstatus === 'activos' && !u.activo) return false;
        if (filtroEstatus === 'bajas' && u.activo) return false;
        return true;
      })
      .sort((a, b) => {
        if (columnaOrden === 'nombre_completo') {
          const res = compararPorApellidoPaterno(a, b);
          return direccionOrden === 'asc' ? res : -res;
        }
        if (columnaOrden === 'numero_empleado') {
          return direccionOrden === 'asc' 
            ? (a.numero_empleado || '').localeCompare(b.numero_empleado || '', undefined, { numeric: true, sensitivity: 'base' })
            : (b.numero_empleado || '').localeCompare(a.numero_empleado || '', undefined, { numeric: true, sensitivity: 'base' });
        }
        let vA = a[columnaOrden] || '';
        let vB = b[columnaOrden] || '';
        if (columnaOrden === 'sede') {
          vA = sedes.find(s => s.id === a.sede_id)?.nombre || '';
          vB = sedes.find(s => s.id === b.sede_id)?.nombre || '';
        } else if (columnaOrden === 'departamento') {
          vA = a.departamentos?.nombre || '';
          vB = b.departamentos?.nombre || '';
        }
        const res = String(vA).localeCompare(String(vB));
        return direccionOrden === 'asc' ? res : -res;
      });
  }, [usuarios, busqueda, filtroSede, filtroNomina, filtroDepto, filtroEstatus, columnaOrden, direccionOrden, sedes]);

  const abrirDossier = (user) => {
    const partes = desglosarNombreExistente(user);
    setColaboradorDossier(user);
    setDatosEdit({
      id: user.id,
      numero_empleado: user.numero_empleado || '',
      nombre: partes.nombre,
      apellido_paterno: partes.apellido_paterno,
      apellido_materno: partes.apellido_materno,
      nombre_completo: user.nombre_completo || '',
      fecha_nacimiento: user.fecha_nacimiento || '',
      sede_id: user.sede_id || '',
      departamento_id: user.departamento_id || '',
      area: user.area || '',
      puesto: user.puesto || '',
      tipo_personal: user.tipo_personal || 'produccion',
      rol: user.rol || 'empleado',
      reporta_a_id: user.reporta_a_id || '',
      celular: user.celular || '',
      telefono: user.telefono || '',
      correo: user.correo || '',
      usuario_login: user.usuario_login || '',
      pin: user.pin || '',
      fecha_ingreso: user.fecha_ingreso || '',
      foto_url: user.foto_url || null,
      firma_url: user.firma_url || null
    });
    setDossierAbierto(true);
  };

  const handleCambiarFoto = async (e) => {
    const archivo = e.target.files[0];
    if (!archivo || !colaboradorDossier) return;
    setSubiendoFoto(true);
    try {
      const nuevaUrl = await subirImagenUsuario(archivo, colaboradorDossier.id, 'perfil');
      setDatosEdit(prev => ({ ...prev, foto_url: nuevaUrl }));
    } catch (err) {
      alert("Error al subir foto: " + err.message);
    } finally {
      setSubiendoFoto(false);
    }
  };

  const confirmarBaja = async (id, fechaBaja, motivoBaja) => {
    setProcesandoBaja(true);
    try {
      await tramitarBajaColaborador(id, fechaBaja, motivoBaja);
      setUsuarioParaBaja(null);
      setDossierAbierto(false);
      if (recargarDatos) await recargarDatos();
    } catch (err) {
      alert("Error en baja: " + err.message);
    } finally {
      setProcesandoBaja(false);
    }
  };

  const reactivar = async (user) => {
    if (!window.confirm(`¿Reactivar a ${user.nombre_completo}?`)) return;
    try {
      await reactivarColaborador(user.id);
      setDossierAbierto(false);
      if (recargarDatos) await recargarDatos();
    } catch (err) {
      alert("Error al reactivar: " + err.message);
    }
  };

  const renderIconoOrden = (col) => {
    if (columnaOrden !== col) return <ArrowUpDown size={11} style={{ opacity: 0.25 }} />;
    return direccionOrden === 'asc' ? <ArrowUp size={11} color={c.accent} /> : <ArrowDown size={11} color={c.accent} />;
  };

  return (
    <div className="grid-wrapper">
      <style>{generarEstilosCSS(c, modoOscuro)}</style>

      {/* BARRA SUPERIOR MINIMALISTA: CONTADOR A LA IZQ <---> BOTONES DISCRETOS A LA DER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '8px' }}>
        <div style={{ fontSize: '13px', fontWeight: '600', color: c.textMuted }}>
          <strong style={{ color: c.text, fontWeight: '800' }}>{usuariosFiltrados.length}</strong> de {usuarios.length} colaboradores
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* BOTÓN DISCRETO DE BÚSQUEDA Y FILTROS */}
          <button
            type="button"
            onClick={() => setMostrarFiltros(prev => !prev)}
            title="Buscar y filtrar colaboradores"
            style={{
              height: '32px',
              padding: esMobile ? '0 9px' : '0 11px',
              borderRadius: '8px',
              border: `1px solid ${(mostrarFiltros || hayFiltros) ? c.accent : c.border}`,
              background: (mostrarFiltros || hayFiltros) ? c.accentSoft : c.surfaceCard,
              color: (mostrarFiltros || hayFiltros) ? c.accent : c.text,
              fontSize: '11.5px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              position: 'relative'
            }}
          >
            <Search size={13.5} />
            <SlidersHorizontal size={13} />
            {!esMobile && <span>Filtrar</span>}
            {hayFiltros && (
              <span style={{
                width: '6px', height: '6px', borderRadius: '50%', background: c.accent
              }} />
            )}
          </button>

          {/* BOTÓN DISCRETO DE BLOQUEO / EDICIÓN */}
          {seguridadDesbloqueada ? (
            <button
              type="button"
              onClick={() => setSeguridadDesbloqueada(false)}
              title="Bloquear edición"
              style={{
                height: '32px',
                padding: '0 10px',
                borderRadius: '8px',
                border: `1px solid ${c.accent}`,
                background: c.accentSoft,
                color: c.accent,
                fontSize: '11.5px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <Unlock size={13} />
              <span>{esMobile ? 'Activo' : 'Edición Habilitada'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setModalPinAbierto(true)}
              title="Desbloquear edición (PIN)"
              style={{
                height: '32px',
                width: esMobile ? '32px' : 'auto',
                padding: esMobile ? '0' : '0 11px',
                borderRadius: '8px',
                border: `1px solid ${c.border}`,
                background: c.surfaceCard,
                color: c.textMuted,
                fontSize: '11.5px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px'
              }}
            >
              <Lock size={13} color="#f59e0b" />
              {!esMobile && <span>Desbloquear Edición</span>}
            </button>
          )}
        </div>
      </div>

      {/* PANEL DESPLEGABLE DE BÚSQUEDA Y FILTROS (OCULTO POR DEFECTO) */}
      {mostrarFiltros && (
        <div style={{
          background: c.surfaceCard,
          border: `1px solid ${c.border}`,
          borderRadius: '12px',
          padding: '10px',
          marginBottom: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          boxSizing: 'border-box'
        }}>
          <div style={{ position: 'relative' }}>
            <input 
              type="text" 
              placeholder="Buscar por nombre, apellidos, # empleado, puesto..." 
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              style={{
                width: '100%', height: '36px', padding: '0 30px 0 32px',
                borderRadius: '8px', border: `1px solid ${c.border}`,
                background: c.bg, color: c.text, fontSize: '13px', outline: 'none', boxSizing: 'border-box'
              }}
            />
            <Search size={14} color={c.textMuted} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda('')}
                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: c.textMuted, cursor: 'pointer', display: 'flex', padding: '2px' }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="pills-scroll-container" style={{ marginBottom: 0, paddingBottom: 0 }}>
            <div className={`filter-pill ${filtroSede !== 'ALL' ? 'active' : ''}`}>
              <span>📍</span>
              <select className="pill-select" value={filtroSede} onChange={e => setFiltroSede(e.target.value)}>
                <option value="ALL">Sede: Todas</option>
                {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>

            <div className={`filter-pill ${filtroNomina !== 'ALL' ? 'active' : ''}`}>
              <span>💼</span>
              <select className="pill-select" value={filtroNomina} onChange={e => setFiltroNomina(e.target.value)}>
                <option value="ALL">Nómina: Todas</option>
                <option value="produccion">Producción</option>
                <option value="administrativo">Administrativo</option>
                <option value="obra">Obra</option>
              </select>
            </div>

            <div className={`filter-pill ${filtroDepto !== 'ALL' ? 'active' : ''}`}>
              <span>🏢</span>
              <select className="pill-select" value={filtroDepto} onChange={e => setFiltroDepto(e.target.value)}>
                <option value="ALL">Depto: Todos</option>
                {departamentosConPersonal.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
              </select>
            </div>

            <div className={`filter-pill ${filtroEstatus !== 'ALL' ? 'active' : ''}`}>
              <span>●</span>
              <select className="pill-select" value={filtroEstatus} onChange={e => setFiltroEstatus(e.target.value)}>
                <option value="ALL">Estatus: Todos</option>
                <option value="activos">Solo Activos</option>
                <option value="bajas">Solo Bajas</option>
              </select>
            </div>

            {hayFiltros && (
              <button onClick={limpiarFiltros} className="filter-pill" style={{ color: c.danger, borderColor: c.dangerSoft, gridColumn: esMobile ? '1 / -1' : 'auto', justifyContent: 'center' }}>
                <RotateCcw size={11} /> Restablecer filtros
              </button>
            )}
          </div>
        </div>
      )}

      {esMobile ? (
        <div className="mobile-contact-list">
          {usuariosFiltrados.map(user => {
            const sedeObj = sedes.find(s => s.id === user.sede_id);
            const urlFoto = user.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.nombre_completo)}&background=16a34a&color=fff&bold=true`;

            return (
              <div key={user.id} className="mobile-contact-card" onClick={() => abrirDossier(user)} style={{ opacity: user.activo ? 1 : 0.5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1, overflow: 'hidden' }}>
                  <img 
                    src={urlFoto} alt="" 
                    onClick={(e) => { e.stopPropagation(); if (setFotoZoom) setFotoZoom({ url: urlFoto, nombre: user.nombre_completo, puesto: user.puesto }); }}
                    style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: `1px solid ${c.border}` }} 
                  />
                  <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontSize: '13.5px', fontWeight: '700', color: c.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {formatearApellidosNombreMayus(user)}
                    </div>
                    <div style={{ fontSize: '11px', color: c.textMuted, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.puesto || user.area || 'Sin puesto'}</span>
                      <span>•</span>
                      <span style={{ flexShrink: 0 }}>{sedeObj?.nombre || 'Sin Sede'}</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, marginLeft: '8px' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: user.activo ? c.accent : c.danger }}></span>
                  <ChevronRight size={16} color={c.textSubtle} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="desktop-table-container">
          <table className="desktop-table">
            <thead>
              <tr>
                <th className="sortable" onClick={() => cambiarOrden('numero_empleado')} style={{ width: '90px' }}>Nº EMP {renderIconoOrden('numero_empleado')}</th>
                <th className="sortable" onClick={() => cambiarOrden('nombre_completo')}>COLABORADOR {renderIconoOrden('nombre_completo')}</th>
                <th className="sortable" onClick={() => cambiarOrden('sede')} style={{ width: '130px' }}>SEDE {renderIconoOrden('sede')}</th>
                <th className="sortable" onClick={() => cambiarOrden('tipo_personal')} style={{ width: '120px' }}>NÓMINA {renderIconoOrden('tipo_personal')}</th>
                <th className="sortable" onClick={() => cambiarOrden('departamento')} style={{ width: '150px' }}>DEPARTAMENTO {renderIconoOrden('departamento')}</th>
                <th className="sortable" onClick={() => cambiarOrden('puesto')}>PUESTO {renderIconoOrden('puesto')}</th>
                <th className="sortable" onClick={() => cambiarOrden('activo')} style={{ width: '90px', textAlign: 'center' }}>ESTATUS {renderIconoOrden('activo')}</th>
                <th style={{ width: '30px' }}></th>
              </tr>
            </thead>
            <tbody>
              {usuariosFiltrados.map(user => {
                const sedeObj = sedes.find(s => s.id === user.sede_id);
                const urlFoto = user.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.nombre_completo)}&background=16a34a&color=fff&bold=true`;
                const esActivoFila = colaboradorDossier?.id === user.id && dossierAbierto;

                return (
                  <tr key={user.id} className={`row-item ${esActivoFila ? 'active-row' : ''}`} onClick={() => abrirDossier(user)} style={{ opacity: user.activo ? 1 : 0.45 }}>
                    <td className="mono-id">#{user.numero_empleado}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                        <img src={urlFoto} alt="" onClick={(e) => { e.stopPropagation(); if (setFotoZoom) setFotoZoom({ url: urlFoto, nombre: user.nombre_completo }); }} style={{ width: '26px', height: '26px', borderRadius: '50%', objectFit: 'cover' }} />
                        <span style={{ fontWeight: '600' }}>{formatearApellidosNombreMayus(user)}</span>
                      </div>
                    </td>
                    <td><span style={{ fontSize: '12px' }}>{sedeObj?.nombre || 'Sin Sede'}</span></td>
                    <td>
                      <span style={{ fontSize: '10.5px', fontWeight: '700', textTransform: 'uppercase', padding: '2px 6px', borderRadius: '4px', background: c.surface, color: c.textMuted }}>
                        {user.tipo_personal}
                      </span>
                    </td>
                    <td style={{ fontWeight: '500' }}>{user.departamentos?.nombre || '-'}</td>
                    <td style={{ color: c.textMuted }}>{user.puesto || '-'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: user.activo ? c.accent : c.danger }}>
                        {user.activo ? '● Activo' : '● Baja'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}><ChevronRight size={14} color={c.textSubtle} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <DossierLateral 
        colaborador={colaboradorDossier}
        abierto={dossierAbierto}
        onClose={() => setDossierAbierto(false)}
        editando={seguridadDesbloqueada}
        datosEdit={datosEdit}
        setDatosEdit={setDatosEdit}
        usuarios={usuarios}
        departamentos={departamentos}
        sedes={sedes}
        areas={areas}     
        puestos={puestos} 
        subiendoFoto={subiendoFoto}
        onCambiarFoto={handleCambiarFoto}
        recargarDatos={recargarDatos}
        onAbrirBaja={(u) => setUsuarioParaBaja(u)}
        onReactivar={reactivar}
        setFotoZoom={setFotoZoom}
        c={c}
      />

      <ModalSeguridadPin 
        abierto={modalPinAbierto}
        onClose={() => setModalPinAbierto(false)}
        onAutorizado={() => setSeguridadDesbloqueada(true)}
        c={c}
        modoOscuro={modoOscuro}
      />

      <ModalBajaColaborador 
        usuario={usuarioParaBaja}
        onClose={() => setUsuarioParaBaja(null)}
        onConfirmarBaja={confirmarBaja}
        procesando={procesandoBaja}
        c={c}
      />
    </div>
  );
}
