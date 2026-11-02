import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronDown, ChevronRight, Edit2, Lock, Unlock, X, Save,
  Crown, ShieldCheck, User, CornerDownRight, Briefcase,
  ChevronsDown, ChevronsUp, Sliders, Plus, GitBranch
} from 'lucide-react';
import {
  obtenerBadgeRol,
  estandarizar,
  esRolValidadorSuperior,
  describirRutaEcualizador,
  describirRutaColaborador,
  obtenerNombreCorto,
  formatearNombreNaturalMayus,
  compararPorNombreNatural
} from './utils/directorioHelpers';
import {
  actualizarDepartamentoSeguro,
  crearDepartamentoConEcualizador,
  reubicarColaboradorEnArbol
} from './services/directorioService';
import { obtenerTemaGlobal } from '../../core/theme/temaGlobal';
import ModalSeguridadPin from './ModalSeguridadPin';

const normalizar = (txt) => txt ? estandarizar(txt.toUpperCase()) : 'GENERAL';

export default function VistaArbol({
  usuarios = [], departamentos = [], recargarDatos, setFotoZoom, modoOscuro
}) {
  const [esMobile, setEsMobile] = useState(window.innerWidth < 768);

  const [divisionesAbiertas, setDivisionesAbiertas] = useState({});
  const [deptosAbiertosLocal, setDeptosAbiertosLocal] = useState({});
  const [subareasAbiertas, setSubareasAbiertas] = useState({});

  useEffect(() => {
    const handleResize = () => setEsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [seguridadDesbloqueada, setSeguridadDesbloqueada] = useState(false);
  const [modalPinAbierto, setModalPinAbierto] = useState(false);

  const [modalDepto, setModalDepto] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const [userEditando, setUserEditando] = useState(null);

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

  const ramasOrganigrama = useMemo(() => {
    const usuariosActivos = (usuarios || []).filter(u => u.activo !== false);

    const idsGerentesEnDeptos = new Set((departamentos || []).map(d => d.gerente_id).filter(Boolean));
    const validadoresSuperiores = usuariosActivos.filter(
      u => esRolValidadorSuperior(u.rol) || idsGerentesEnDeptos.has(u.id)
    );

    const pesoRol = (u) => {
      if (u.rol === 'gerente_produccion') return 1;
      if (u.rol === 'gerente_admin') return 2;
      if (u.rol === 'gerente_rh') return 3;
      return 4;
    };
    validadoresSuperiores.sort((a, b) => pesoRol(a) - pesoRol(b) || compararPorNombreNatural(a, b));

    const etiquetaDivisionParaGerente = (g) => {
      if (g.rol === 'gerente_produccion') return 'PLANTA & PRODUCCIÓN';
      if (g.rol === 'gerente_admin') return 'DIRECCIÓN & ADMINISTRACIÓN';
      if (g.rol === 'gerente_rh') return 'CAPITAL HUMANO & ACCESOS';
      return `DIVISIÓN ${g.area || g.puesto || obtenerNombreCorto(g)}`.toUpperCase();
    };

    const ramas = validadoresSuperiores.map(gerente => {
      const deptosDeEsteGerente = (departamentos || []).filter(d => {
        if (d.gerente_id === gerente.id) return true;
        if (!d.gerente_id) {
          const clas = (d.clasificacion || '').toLowerCase();
          if (gerente.rol === 'gerente_produccion' && clas.includes('prod')) return true;
          if (gerente.rol === 'gerente_admin' && clas.includes('admin')) return true;
          if (gerente.rol === 'gerente_rh' && clas.includes('rh')) return true;
        }
        return false;
      });

      return {
        key: `ger_${gerente.id}`,
        label: etiquetaDivisionParaGerente(gerente),
        gerentesDivision: [gerente],
        departamentos: deptosDeEsteGerente
      };
    });

    const idsDeptosAsignados = new Set(ramas.flatMap(r => r.departamentos.map(d => d.id)));
    const deptosAutonomos = (departamentos || []).filter(d => !idsDeptosAsignados.has(d.id));

    if (deptosAutonomos.length > 0) {
      ramas.push({
        key: 'autonomos_directo_rh',
        label: 'DEPARTAMENTOS AUTÓNOMOS (DIRECTO A RH)',
        gerentesDivision: [],
        departamentos: deptosAutonomos
      });
    }

    return ramas;
  }, [usuarios, departamentos]);

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
      ramasOrganigrama.forEach(r => { divs[r.key] = true; });
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

  const abrirEcualizadorDepto = (depto, e) => {
    e.stopPropagation();
    setModalDepto({
      modo: 'editar',
      id: depto.id,
      nombreAnterior: depto.nombre,
      nombre: depto.nombre,
      clasificacion: depto.clasificacion || 'produccion',
      gerente_id: depto.gerente_id || '',
      jefe_id: depto.jefe_id || '',
      emp_requiere_jefe: Boolean(depto.jefe_id) || depto.nombre === 'RECURSOS HUMANOS',
      emp_requiere_gerente: Boolean(depto.emp_requiere_gerente),
      jefe_requiere_gerente: Boolean(depto.gerente_id)
    });
  };

  const abrirNuevoDepartamento = () => {
    const primerGerente = usuarios.find(u => u.rol === 'gerente_produccion' && u.activo) || usuarios.find(u => esRolValidadorSuperior(u.rol) && u.activo);
    setModalDepto({
      modo: 'crear',
      id: null,
      nombreAnterior: '',
      nombre: '',
      clasificacion: 'produccion',
      gerente_id: primerGerente?.id || '',
      jefe_id: '',
      emp_requiere_jefe: false,
      emp_requiere_gerente: true,
      jefe_requiere_gerente: true
    });
  };

  const guardarEcualizadorDepto = async (e) => {
    e.preventDefault();
    if (!modalDepto?.nombre?.trim()) return alert("Ingresa un nombre para el departamento.");
    setGuardando(true);
    try {
      const tieneJefe = Boolean(modalDepto.jefe_id) || modalDepto.nombre.trim().toUpperCase() === 'RECURSOS HUMANOS';
      const tieneGerente = Boolean(modalDepto.gerente_id);

      if (modalDepto.modo === 'crear') {
        await crearDepartamentoConEcualizador({
          nombre: modalDepto.nombre,
          jefe_id: modalDepto.jefe_id || null,
          gerente_id: modalDepto.gerente_id || null,
          emp_requiere_jefe: tieneJefe,
          emp_requiere_gerente: tieneGerente ? Boolean(modalDepto.emp_requiere_gerente) : false,
          jefe_requiere_gerente: tieneGerente
        });
      } else {
        await actualizarDepartamentoSeguro(
          modalDepto.id,
          modalDepto.nombre,
          modalDepto.clasificacion,
          modalDepto.nombreAnterior,
          {
            jefe_id: modalDepto.jefe_id || null,
            gerente_id: modalDepto.gerente_id || null,
            emp_requiere_jefe: tieneJefe,
            emp_requiere_gerente: tieneGerente ? Boolean(modalDepto.emp_requiere_gerente) : false,
            jefe_requiere_gerente: tieneGerente
          }
        );
      }
      setModalDepto(null);
      if (recargarDatos) await recargarDatos();
    } catch (err) {
      alert("Error al guardar departamento: " + err.message);
    } finally {
      setGuardando(false);
    }
  };

  const abrirEdicionUsuarioArbol = (u, e) => {
    e.stopPropagation();
    const deptoUser = departamentos.find(d => d.id === u.departamento_id);
    setUserEditando({
      id: u.id,
      nombre_completo: formatearNombreNaturalMayus(u),
      departamento_id: u.departamento_id || '',
      area: u.area || '',
      puesto: u.puesto || '',
      rol: u.rol || 'empleado',
      reporta_a_id: u.reporta_a_id || '',
      es_titular_depto: Boolean(deptoUser && deptoUser.jefe_id === u.id)
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
        reportaAId: userEditando.reporta_a_id || null,
        esTitularDepto: Boolean(userEditando.es_titular_depto)
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

  const posiblesJefesParaUsuario = useMemo(() => {
    if (!userEditando) return [];
    return usuarios
      .filter(u => u.activo !== false && u.id !== userEditando.id && !["empleado", "caseta"].includes(u.rol))
      .sort((a, b) => {
        const aMismo = a.departamento_id === userEditando.departamento_id ? 0 : 1;
        const bMismo = b.departamento_id === userEditando.departamento_id ? 0 : 1;
        if (aMismo !== bMismo) return aMismo - bMismo;
        return compararPorNombreNatural(a, b);
      });
  }, [usuarios, userEditando]);

  const candidatosGerenteDivision = useMemo(() => {
    return (usuarios || [])
      .filter(u => u.activo !== false && !['empleado', 'caseta'].includes(u.rol))
      .sort((a, b) => {
        const aVal = esRolValidadorSuperior(a.rol) ? 0 : 1;
        const bVal = esRolValidadorSuperior(b.rol) ? 0 : 1;
        if (aVal !== bVal) return aVal - bVal;
        return compararPorNombreNatural(a, b);
      });
  }, [usuarios]);

  const candidatosJefeDepto = useMemo(() => {
    if (!modalDepto) return [];
    return (usuarios || [])
      .filter(u => u.activo !== false && u.rol !== 'caseta')
      .sort((a, b) => {
        const aMismoDepto = modalDepto.id && a.departamento_id === modalDepto.id ? 0 : 1;
        const bMismoDepto = modalDepto.id && b.departamento_id === modalDepto.id ? 0 : 1;
        if (aMismoDepto !== bMismoDepto) return aMismoDepto - bMismoDepto;
        const aMando = a.rol !== 'empleado' ? 0 : 1;
        const bMando = b.rol !== 'empleado' ? 0 : 1;
        if (aMando !== bMando) return aMando - bMando;
        return compararPorNombreNatural(a, b);
      });
  }, [usuarios, modalDepto]);

  const vistaPreviaEcualizador = useMemo(() => {
    if (!modalDepto) return null;
    const tieneJefe = Boolean(modalDepto.jefe_id) || modalDepto.nombre.trim().toUpperCase() === 'RECURSOS HUMANOS';
    const tieneGerente = Boolean(modalDepto.gerente_id);
    return describirRutaEcualizador(
      {
        ...modalDepto,
        emp_requiere_jefe: tieneJefe,
        emp_requiere_gerente: tieneGerente ? Boolean(modalDepto.emp_requiere_gerente) : false,
        jefe_requiere_gerente: tieneGerente
      },
      usuarios
    );
  }, [modalDepto, usuarios]);

  const rutaEnVivoUserEditando = useMemo(() => {
    if (!userEditando) return '';
    const dObj = departamentos.find(d => d.id === userEditando.departamento_id);
    return describirRutaColaborador(userEditando, dObj, usuarios);
  }, [userEditando, departamentos, usuarios]);

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

      {/* MICRO-BARRA SUPERIOR */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        {seguridadDesbloqueada && (
          <button
            onClick={abrirNuevoDepartamento}
            style={{
              background: c.accentSoft,
              border: `1px solid ${c.accent}`,
              padding: '5px 11px',
              borderRadius: '6px',
              color: c.accent,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '10.5px',
              fontWeight: '800',
              letterSpacing: '0.03em'
            }}
          >
            <Plus size={12} strokeWidth={2.5} />
            <span>Nuevo Departamento</span>
          </button>
        )}

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
          title={seguridadDesbloqueada ? 'Bloquear edición' : 'Desbloquear edición (PIN)'}
          style={{
            background: seguridadDesbloqueada ? c.accentSoft : 'transparent',
            border: `1px solid ${seguridadDesbloqueada ? c.accent : c.border}`,
            height: '28px',
            padding: '0 9px',
            borderRadius: '6px',
            color: seguridadDesbloqueada ? c.accent : c.subText,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '5px',
            fontSize: '10.5px',
            fontWeight: '700'
          }}
        >
          {seguridadDesbloqueada ? <Unlock size={13} /> : <Lock size={13} />}
          {!esMobile && <span>{seguridadDesbloqueada ? 'Edición Activa' : 'Editar Organigrama'}</span>}
        </button>
      </div>

      {/* NIVEL 1: DIVISIONES */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {ramasOrganigrama.map(sec => {
          const divAbierta = Boolean(divisionesAbiertas[sec.key]);
          const gerentesDivision = sec.gerentesDivision || [];
          const idsGerentesDivision = new Set(gerentesDivision.map(g => g.id));

          const deptosSec = (sec.departamentos || []).filter(d => {
            const activosSinGerenteDiv = usuarios.filter(u => u.departamento_id === d.id && u.activo === true && !idsGerentesDivision.has(u.id));
            return seguridadDesbloqueada || activosSinGerenteDiv.length > 0;
          });

          if (deptosSec.length === 0 && gerentesDivision.length === 0) return null;

          const idsDeptosSec = new Set((sec.departamentos || []).map(d => d.id));
          const totalPersonasDivision = usuarios.filter(u => u.activo && (idsGerentesDivision.has(u.id) || idsDeptosSec.has(u.departamento_id))).length;
          const titularTexto = gerentesDivision.length > 0
            ? gerentesDivision.map(g => formatearNombreNaturalMayus(g)).join(' / ')
            : 'Reporte directo a Recursos Humanos';

          return (
            <div key={sec.key} style={{ background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '10px', overflow: 'hidden' }}>
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
                    <span style={{ fontSize: esMobile ? '13.5px' : '15px', fontWeight: '800', color: c.text, letterSpacing: '0.03em' }}>
                      {sec.label}
                    </span>
                    {titularTexto && (
                      <span style={{ fontSize: '12px', fontWeight: '600', color: c.subText }}>
                        {titularTexto}
                      </span>
                    )}
                  </div>
                </div>

                <span style={{ fontSize: '12px', fontWeight: '700', color: c.subText, padding: '2px 8px', borderRadius: '6px', background: modoOscuro ? '#222' : '#f1f5f9', flexShrink: 0 }}>
                  {totalPersonasDivision}
                </span>
              </div>

              {divAbierta && (
                <div style={{ padding: esMobile ? '8px' : '18px', background: c.panelBg, boxSizing: 'border-box' }}>
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
                    marginLeft: gerentesDivision.length > 0 ? (esMobile ? '4px' : '16px') : '0',
                    paddingLeft: gerentesDivision.length > 0 ? (esMobile ? '6px' : '14px') : '0',
                    borderLeft: gerentesDivision.length > 0 ? `1.5px solid ${c.lineStrong}` : 'none'
                  }}>
                    {deptosSec.map(depto => {
                      const abierto = Boolean(deptosAbiertosLocal[depto.id]);
                      const nombreDeptoNorm = normalizar(depto.nombre);
                      const infoRuta = describirRutaEcualizador(depto, usuarios);

                      const personalDepto = (usuarios || [])
                        .filter(u => u.departamento_id === depto.id && u.activo === true && !idsGerentesDivision.has(u.id))
                        .sort((a, b) => compararPorNombreNatural(a, b));

                      const haySubareasEspecificas = personalDepto.some(u => {
                        const a = normalizar(u.area || depto.nombre);
                        return a !== nombreDeptoNorm && a !== 'GENERAL' && !esRolValidadorSuperior(u.rol);
                      });

                      const cabezaDepto = personalDepto.filter(u => {
                        if (u.rol === 'superadmin') return true;
                        if (depto.jefe_id && u.id === depto.jefe_id && haySubareasEspecificas) return true;
                        if (!depto.jefe_id && haySubareasEspecificas && u.rol === 'jefe_area' && normalizar(u.area || depto.nombre) === nombreDeptoNorm) return true;
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
                          <div
                            onClick={() => toggleDeptoLocal(depto.id)}
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: esMobile ? '11px 13px' : '12px 16px', cursor: 'pointer', borderRadius: abierto ? '8px 8px 0 0' : '8px', borderBottom: abierto ? `1px solid ${c.border}` : 'none', gap: '8px', flexWrap: 'wrap' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0, flex: 1 }}>
                              <div style={{ color: c.subText, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {abierto ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                                <span style={{ fontSize: esMobile ? '13px' : '14px', fontWeight: '800', color: c.text, letterSpacing: '0.03em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {depto.nombre}
                                </span>
                                <span style={{ fontSize: '10.5px', color: c.subText, fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                                  <GitBranch size={10} color={c.accent} />
                                  <span>Firmas: <strong>{infoRuta.rutaEmpleados}</strong></span>
                                </span>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                              {seguridadDesbloqueada && (
                                <button
                                  onClick={(e) => abrirEcualizadorDepto(depto, e)}
                                  title="Editar Departamento"
                                  style={{ background: c.accentSoft, border: `1px solid ${c.accent}`, borderRadius: '6px', color: c.accent, cursor: 'pointer', padding: '4px 8px', fontSize: '10.5px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px' }}
                                >
                                  <Edit2 size={11} />
                                  {!esMobile && <span>Editar Depto</span>}
                                </button>
                              )}
                              <span style={{ fontSize: '11px', color: c.subText, fontWeight: '700', padding: '2px 7px', borderRadius: '5px', background: modoOscuro ? '#222' : '#f1f5f9' }}>
                                {personalDepto.length}
                              </span>
                            </div>
                          </div>

                          {abierto && (
                            <div style={{ padding: esMobile ? '8px' : '14px', boxSizing: 'border-box', width: '100%' }}>
                              {cabezaDepto.length > 0 && (
                                <div className={clavesSubdeptos.length > 0 ? "tronco-gerencia" : ""}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {cabezaDepto.map(u => renderPlacaIndustrial(u, c, setFotoZoom, modoOscuro, seguridadDesbloqueada, abrirEdicionUsuarioArbol, 'lider', esMobile))}
                                  </div>
                                </div>
                              )}

                              {clavesSubdeptos.length > 0 && (
                                <div className="industrial-grid">
                                  {clavesSubdeptos.map(clave => {
                                    const grupo = subdeptosMap[clave];
                                    const claveUnicaSub = `${depto.id}_${clave}`;
                                    const subAbierta = !mostrarCabeceraSubdepto || Boolean(subareasAbiertas[claveUnicaSub]);

                                    const ROLES_MANDO_ARBOL = ['jefe_area', 'encargado', 'rh_nominas', 'gerente_produccion', 'gerente_admin', 'gerente_rh', 'gerente_division', 'validador_superior', 'superadmin'];
                                    const esMandoValido = (m) => ROLES_MANDO_ARBOL.includes(m.rol) || depto.jefe_id === m.id;

                                    const esTitularDeSubdepto = (m) => {
                                      if (depto.jefe_id === m.id) return true;
                                      if (!esMandoValido(m)) return false;
                                      if (m.rol === 'jefe_area' || m.rol === 'encargado') return true;
                                      if (grupo.miembros.some(sub => sub.reporta_a_id === m.id)) return true;
                                      return false;
                                    };

                                    const liderPrincipal =
                                      grupo.miembros.find(m => depto.jefe_id === m.id) ||
                                      grupo.miembros.find(esTitularDeSubdepto);

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
                                              <span style={{ fontSize: esMobile ? '11.5px' : '12.5px', fontWeight: '800', color: c.text, textTransform: 'uppercase', letterSpacing: '0.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {grupo.etiqueta}
                                              </span>
                                            </div>
                                            <span style={{ fontSize: '10.5px', fontWeight: '700', color: c.subText }}>
                                              {grupo.miembros.length}
                                            </span>
                                          </div>
                                        )}

                                        {subAbierta && (
                                          <div style={{ padding: mostrarCabeceraSubdepto ? (esMobile ? '7px' : '10px') : '0', display: 'flex', flexDirection: 'column', gap: '10px', boxSizing: 'border-box', width: '100%' }}>
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

                                              const tipoNodo = (depto.jefe_id === titular.id || ['jefe_area', 'encargado'].includes(titular.rol) || subordinados.length > 0) ? 'lider' : 'operativo';

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

      {/* =====================================================================
          MODAL LIMPIO Y DIRECTO DE DEPARTAMENTO (SIN DIAGRAMA REDUNDANTE)
         ===================================================================== */}
      {modalDepto && (() => {
        const gerenteSelObj = modalDepto.gerente_id ? usuarios.find(u => u.id === modalDepto.gerente_id) : null;
        const nombreGerente = gerenteSelObj ? obtenerNombreCorto(gerenteSelObj) : 'Gerencia';
        const mostrarOpcionGerencia = Boolean(modalDepto.gerente_id) && Boolean(modalDepto.jefe_id) && gerenteSelObj?.rol !== 'gerente_rh';

        return (
          <div onClick={() => setModalDepto(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2600, padding: '16px' }}>
            <div onClick={e => e.stopPropagation()} style={{ background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '14px', padding: '20px', width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: '0 20px 50px rgba(0,0,0,0.55)', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${c.border}`, paddingBottom: '10px' }}>
                <div>
                  <div style={{ fontSize: '10.5px', fontWeight: '800', color: c.accent, textTransform: 'uppercase' }}>
                    {modalDepto.modo === 'crear' ? 'Nuevo Departamento' : 'Configurar Departamento'}
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: '900', color: c.text }}>
                    {modalDepto.nombre || 'SIN NOMBRE'}
                  </div>
                </div>
                <button onClick={() => setModalDepto(null)} style={{ background: 'none', border: 'none', color: c.subText, cursor: 'pointer' }}><X size={18} /></button>
              </div>

              <form onSubmit={guardarEcualizadorDepto} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: c.subText, marginBottom: '4px', textTransform: 'uppercase' }}>
                    1. Nombre del Departamento
                  </label>
                  <input
                    type="text"
                    required
                    value={modalDepto.nombre}
                    onChange={e => setModalDepto({ ...modalDepto, nombre: e.target.value.toUpperCase() })}
                    placeholder="Ej. ARMADO MADERA, COMPRAS..."
                    style={{ width: '100%', padding: '10px', borderRadius: '7px', border: `1px solid ${c.border}`, background: c.inputBg, color: c.text, fontSize: '13px', fontWeight: '800', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: c.subText, marginBottom: '4px', textTransform: 'uppercase' }}>
                    2. Jefe del Departamento (Firma 1)
                  </label>
                  <select
                    value={modalDepto.jefe_id || ''}
                    onChange={e => {
                      const nuevoJefe = e.target.value;
                      setModalDepto({
                        ...modalDepto,
                        jefe_id: nuevoJefe,
                        emp_requiere_jefe: Boolean(nuevoJefe),
                        emp_requiere_gerente: nuevoJefe ? modalDepto.emp_requiere_gerente : true
                      });
                    }}
                    style={{ width: '100%', padding: '10px', borderRadius: '7px', border: `1px solid ${c.border}`, background: c.inputBg, color: c.text, fontSize: '12.5px', fontWeight: '700', boxSizing: 'border-box' }}
                  >
                    <option value="">Sin Jefe de Área (Pasan directo a Gerencia)</option>
                    {candidatosJefeDepto.map(j => (
                      <option key={j.id} value={j.id}>
                        {formatearNombreNaturalMayus(j)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: c.subText, marginBottom: '4px', textTransform: 'uppercase' }}>
                    3. Gerencia / División (Firma 2)
                  </label>
                  <select
                    value={modalDepto.gerente_id || ''}
                    onChange={e => setModalDepto({ ...modalDepto, gerente_id: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '7px', border: `1px solid ${c.border}`, background: c.inputBg, color: c.text, fontSize: '12.5px', fontWeight: '700', boxSizing: 'border-box' }}
                  >
                    <option value="">Directo a Recursos Humanos (Sin Gerencia)</option>
                    {candidatosGerenteDivision.map(g => (
                      <option key={g.id} value={g.id}>
                        {formatearNombreNaturalMayus(g)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* UNA SOLA CASILLA SIMPLE SOLO CUANDO HAY JEFE Y GERENTE */}
                {mostrarOpcionGerencia && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', background: modoOscuro ? '#161616' : '#f8fafc', border: `1px solid ${c.border}`, cursor: 'pointer', fontSize: '12px', fontWeight: '700', color: c.text }}>
                    <input
                      type="checkbox"
                      checked={Boolean(modalDepto.emp_requiere_gerente)}
                      onChange={e => setModalDepto({ ...modalDepto, emp_requiere_gerente: e.target.checked })}
                      style={{ width: '16px', height: '16px', accentColor: c.accent, cursor: 'pointer' }}
                    />
                    <span>Incluir también la firma de <strong>{nombreGerente}</strong> en los permisos de los empleados</span>
                  </label>
                )}

                {/* RESUMEN FINAL LIMPIO */}
                {vistaPreviaEcualizador && (
                  <div style={{ padding: '10px 12px', borderRadius: '8px', background: c.accentSoft, border: `1px solid ${c.accent}`, fontSize: '12px', color: c.text, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div>• <strong>Ruta Personal:</strong> <span style={{ color: c.accent, fontWeight: '800' }}>{vistaPreviaEcualizador.rutaEmpleados}</span></div>
                    {modalDepto.jefe_id && (
                      <div>• <strong>Ruta del Jefe:</strong> <span style={{ color: c.accent, fontWeight: '800' }}>{vistaPreviaEcualizador.rutaJefe}</span></div>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <button type="button" onClick={() => setModalDepto(null)} style={{ flex: 1, padding: '10px', borderRadius: '7px', border: `1px solid ${c.border}`, background: 'transparent', color: c.subText, fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>
                    Cancelar
                  </button>
                  <button type="submit" disabled={guardando} style={{ flex: 1.5, padding: '10px', borderRadius: '7px', border: 'none', background: c.accent, color: '#fff', fontWeight: '800', fontSize: '12.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <Save size={14} /> {guardando ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* MODAL PARA EDITAR COLABORADOR INDIVIDUAL DESDE EL ÁRBOL */}
      {userEditando && (
        <div onClick={() => setUserEditando(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2500, padding: '16px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '10px', padding: '20px', width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${c.border}`, paddingBottom: '10px' }}>
              <div>
                <div style={{ fontSize: '10.5px', fontWeight: '800', color: c.accent, textTransform: 'uppercase' }}>Ubicación Individual</div>
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
                      reporta_a_id: dObj?.jefe_id && dObj.jefe_id !== userEditando.id ? dObj.jefe_id : ''
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
                  placeholder="Ej. ARMADO MADERA, NOMINAS..."
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
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: c.subText, marginBottom: '4px', textTransform: 'uppercase' }}>4. Jefe Inmediato:</label>
                <select
                  value={userEditando.reporta_a_id || ''}
                  onChange={e => setUserEditando({ ...userEditando, reporta_a_id: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: `1px solid ${c.border}`, background: c.inputBg, color: c.text, fontSize: '12.5px', fontWeight: '600', boxSizing: 'border-box' }}
                >
                  <option value="">Automático (El Jefe del Departamento)</option>
                  {posiblesJefesParaUsuario.map(j => (
                    <option key={j.id} value={j.id}>{formatearNombreNaturalMayus(j)} ({j.area || j.puesto})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: c.subText, marginBottom: '4px', textTransform: 'uppercase' }}>5. Nivel en el Sistema</label>
                <select
                  value={userEditando.rol}
                  onChange={e => setUserEditando({ ...userEditando, rol: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: `1px solid ${c.border}`, background: c.inputBg, color: c.text, fontSize: '12.5px', fontWeight: '600', boxSizing: 'border-box' }}
                >
                  <option value="empleado">EMPLEADO / OPERADOR</option>
                  <option value="jefe_area">JEFE DE ÁREA / SUPERVISOR</option>
                  <option value="gerente_division">GERENTE DE DIVISIÓN / VALIDADOR</option>
                  <option value="gerente_produccion">GERENTE DE PRODUCCIÓN</option>
                  <option value="gerente_admin">GERENTE ADMINISTRATIVO</option>
                  <option value="gerente_rh">GERENTE DE RECURSOS HUMANOS</option>
                  <option value="rh_nominas">TITULAR RH / NÓMINAS</option>
                  <option value="caseta">CASETA / VIGILANCIA</option>
                  <option value="superadmin">SUPER ADMINISTRADOR</option>
                </select>
              </div>

              {userEditando.rol === 'jefe_area' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: '700', color: c.text, cursor: 'pointer', padding: '8px 10px', borderRadius: '6px', background: c.accentSoft, border: `1px solid ${c.accent}` }}>
                  <input
                    type="checkbox"
                    checked={Boolean(userEditando.es_titular_depto)}
                    onChange={e => setUserEditando({ ...userEditando, es_titular_depto: e.target.checked })}
                  />
                  <span>Es el Jefe Titular de todo el departamento</span>
                </label>
              )}

              <div style={{ padding: '9px 12px', borderRadius: '8px', background: c.accentSoft, border: `1px solid ${c.accent}`, fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <span style={{ color: c.text, fontWeight: '700' }}>• Ruta Personal:</span>
                <strong style={{ color: c.accent }}>{rutaEnVivoUserEditando}</strong>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button type="button" onClick={() => setUserEditando(null)} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: `1px solid ${c.border}`, background: 'transparent', color: c.subText, fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" disabled={guardando} style={{ flex: 1.5, padding: '10px', borderRadius: '6px', border: 'none', background: c.accent, color: '#fff', fontWeight: '800', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <Save size={14} /> {guardando ? 'Guardando...' : 'Guardar'}
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
  const nombreNatural = formatearNombreNaturalMayus(u);
  const urlFoto = u.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(nombreNatural)}&background=262626&color=fff&bold=true`;

  const esGerencia = tipoNodo === 'gerencia';
  const esLider = tipoNodo === 'lider';
  const esSubordinado = tipoNodo === 'subordinado';
  const esMando = esGerencia || esLider || (u.rol && u.rol !== 'empleado');

  const tamanoFoto = esMobile
    ? (esGerencia ? '40px' : '36px')
    : (esGerencia ? '46px' : (esLider ? '42px' : '38px'));

  let IconoRango = User;
  if (esGerencia) IconoRango = Crown;
  else if (esLider) IconoRango = ShieldCheck;
  else if (esSubordinado) IconoRango = CornerDownRight;

  return (
    <div
      key={u.id}
      className="placa-industrial"
      style={{
        padding: esMobile ? '9px 10px' : '11px 14px',
        borderLeft: `4px solid ${badge.accentBar}`,
        background: esSubordinado ? (modoOscuro ? '#161616' : '#fcfcfd') : c.surfaceCard
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: esMobile ? '10px' : '12px', minWidth: 0, flex: 1 }}>
        <img
          src={urlFoto}
          alt=""
          onClick={() => setFotoZoom && setFotoZoom({ url: urlFoto, nombre: nombreNatural, puesto: u.puesto })}
          title="Toca para ampliar fotografía"
          style={{
            width: tamanoFoto,
            height: tamanoFoto,
            borderRadius: '8px',
            objectFit: 'cover',
            cursor: 'pointer',
            border: `1px solid ${c.border}`,
            flexShrink: 0
          }}
        />

        {esMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0, flex: 1 }}>
            {esMando && (
              <div>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '3px',
                  fontSize: '9px', fontWeight: '800', color: badge.text, background: badge.bg,
                  border: `1px solid ${badge.border}`, padding: '1.5px 6px', borderRadius: '4px',
                  whiteSpace: 'nowrap', letterSpacing: '0.02em'
                }}>
                  <IconoRango size={9} />
                  {badge.label}
                </span>
              </div>
            )}

            <div style={{
              fontSize: '13px',
              fontWeight: '800',
              color: c.text,
              lineHeight: '1.22',
              wordBreak: 'break-word'
            }}>
              {nombreNatural}
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              fontSize: '11px', color: c.subText, fontWeight: '600',
              lineHeight: '1.2'
            }}>
              <Briefcase size={10} style={{ flexShrink: 0, opacity: 0.65 }} />
              <span>{u.puesto || 'COLABORADOR'}</span>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', minWidth: 0 }}>
              <div style={{
                fontSize: (esGerencia || esLider) ? '15px' : '14.5px',
                fontWeight: '800',
                color: c.text,
                lineHeight: '1.22',
                minWidth: 0,
                flex: 1
              }}>
                {nombreNatural}
              </div>

              {esMando && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  fontSize: '10.5px', fontWeight: '800', color: badge.text, background: badge.bg,
                  border: `1px solid ${badge.border}`, padding: '2px 8px', borderRadius: '5px',
                  whiteSpace: 'nowrap', letterSpacing: '0.03em', flexShrink: 0
                }}>
                  <IconoRango size={11} />
                  {badge.label}
                </span>
              )}
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12.5px',
              color: c.subText,
              fontWeight: '600',
              lineHeight: '1.2'
            }}>
              <Briefcase size={11.5} style={{ flexShrink: 0, opacity: 0.65 }} />
              <span>{u.puesto || 'COLABORADOR'}</span>
            </div>
          </div>
        )}
      </div>

      {seguridadDesbloqueada && (
        <button
          onClick={(e) => onEditarUsuario(u, e)}
          style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: '5px', color: c.text, cursor: 'pointer', padding: '5px 7px', fontSize: '10.5px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}
          title="Reacomodar en el organigrama"
        >
          <Edit2 size={12} />
        </button>
      )}
    </div>
  );
}