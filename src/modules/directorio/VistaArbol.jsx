import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronDown, ChevronRight, Lock, Unlock, X, Save,
  Crown, ShieldCheck, User, CornerDownRight, Briefcase,
  ChevronsDown, ChevronsUp, Plus, Sliders, Edit2
} from 'lucide-react';
import {
  obtenerBadgeRol,
  estandarizar,
  esRolValidadorSuperior,
  obtenerNombreCorto,
  formatearNombreNaturalMayus,
  compararPorNombreNatural
} from './utils/directorioHelpers';
import {
  actualizarDepartamentoSeguro,
  crearDepartamentoConEcualizador,
  reubicarColaboradorEnArbol,
  alternarSwitchFirmaDepartamento
} from './services/directorioService';
import { obtenerTemaGlobal } from '../../core/theme/temaGlobal';
import ModalSeguridadPin from './ModalSeguridadPin';

const normalizar = (txt) => txt ? estandarizar(txt.toUpperCase()) : 'GENERAL';

export default function VistaArbol({
  usuarios = [], departamentos = [], recargarDatos, setFotoZoom, modoOscuro,
  seguridadDesbloqueada: propSeguridad,
  setSeguridadDesbloqueada: propSetSeguridad
}) {
  const [esMobile, setEsMobile] = useState(window.innerWidth < 768);

  // Copias locales para que al editar NO se desmonte la vista ni se cierren las pestañas
  const [listaDeptosLocal, setListaDeptosLocal] = useState(departamentos);
  const [listaUsuariosLocal, setListaUsuariosLocal] = useState(usuarios);

  useEffect(() => { setListaDeptosLocal(departamentos); }, [departamentos]);
  useEffect(() => { setListaUsuariosLocal(usuarios); }, [usuarios]);

  // Persistir qué divisiones están abiertas
  const [divisionesAbiertas, setDivisionesAbiertas] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('arbol_divs_abiertas') || '{}'); } catch { return {}; }
  });
  const [deptosAbiertosLocal, setDeptosAbiertosLocal] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('arbol_deptos_abiertos') || '{}'); } catch { return {}; }
  });
  const [subareasAbiertas, setSubareasAbiertas] = useState({});

  // Candado en memoria: compartido con la Tabla, pero se cierra solo al recargar (F5) o salir
  const [seguridadLocal, setSeguridadLocal] = useState(false);
  const seguridadDesbloqueada = propSeguridad !== undefined ? propSeguridad : seguridadLocal;
  const cambiarEstadoSeguridad = (estado) => {
    if (propSetSeguridad) propSetSeguridad(Boolean(estado));
    else setSeguridadLocal(Boolean(estado));
  };

  useEffect(() => {
    const handleResize = () => setEsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [modalPinAbierto, setModalPinAbierto] = useState(false);
  const [modalMatrizAbierto, setModalMatrizAbierto] = useState(false);
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
  };

  const ramasOrganigrama = useMemo(() => {
    const usuariosActivos = (listaUsuariosLocal || []).filter(u => u.activo !== false);

    const idsGerentesEnDeptos = new Set((listaDeptosLocal || []).map(d => d.gerente_id).filter(Boolean));
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
      const deptosDeEsteGerente = (listaDeptosLocal || []).filter(d => {
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
    const deptosAutonomos = (listaDeptosLocal || []).filter(d => !idsDeptosAsignados.has(d.id));

    if (deptosAutonomos.length > 0) {
      ramas.push({
        key: 'autonomos_directo_rh',
        label: 'DEPARTAMENTOS AUTÓNOMOS (DIRECTO A RH)',
        gerentesDivision: [],
        departamentos: deptosAutonomos
      });
    }

    return ramas;
  }, [listaUsuariosLocal, listaDeptosLocal]);

  const hayAlgoAbierto =
    Object.values(divisionesAbiertas).some(Boolean) ||
    Object.values(deptosAbiertosLocal).some(Boolean) ||
    Object.values(subareasAbiertas).some(Boolean);

  const toggleDivision = (key) => {
    setDivisionesAbiertas(prev => {
      const nuevo = { ...prev, [key]: !prev[key] };
      sessionStorage.setItem('arbol_divs_abiertas', JSON.stringify(nuevo));
      return nuevo;
    });
  };

  const toggleDeptoLocal = (id) => {
    setDeptosAbiertosLocal(prev => {
      const nuevo = { ...prev, [id]: !prev[id] };
      sessionStorage.setItem('arbol_deptos_abiertos', JSON.stringify(nuevo));
      return nuevo;
    });
  };

  const toggleSubarea = (claveUnica) => {
    setSubareasAbiertas(prev => ({ ...prev, [claveUnica]: !prev[claveUnica] }));
  };

  const alternarTodo = () => {
    if (hayAlgoAbierto) {
      setDivisionesAbiertas({});
      setDeptosAbiertosLocal({});
      setSubareasAbiertas({});
      sessionStorage.removeItem('arbol_divs_abiertas');
      sessionStorage.removeItem('arbol_deptos_abiertos');
    } else {
      const divs = {};
      ramasOrganigrama.forEach(r => { divs[r.key] = true; });
      const deps = {};
      const subs = {};
      (listaDeptosLocal || []).forEach(d => {
        deps[d.id] = true;
        (listaUsuariosLocal || []).filter(u => u.departamento_id === d.id && u.activo).forEach(u => {
          const claveArea = `${d.id}_${normalizar(u.area || d.nombre)}`;
          subs[claveArea] = true;
        });
      });
      setDivisionesAbiertas(divs);
      setDeptosAbiertosLocal(deps);
      setSubareasAbiertas(subs);
      sessionStorage.setItem('arbol_divs_abiertas', JSON.stringify(divs));
      sessionStorage.setItem('arbol_deptos_abiertos', JSON.stringify(deps));
    }
  };

  // Cambiar switch en la Matriz General SIN recargar toda la pantalla ni cerrar nada
  const cambiarSwitchEnMatriz = async (deptoId, campo, nuevoValor) => {
    // Actualizar en memoria inmediatamente (instantáneo en pantalla)
    setListaDeptosLocal(prev =>
      prev.map(d => d.id === deptoId ? { ...d, [campo]: Boolean(nuevoValor) } : d)
    );
    try {
      await alternarSwitchFirmaDepartamento(deptoId, campo, Boolean(nuevoValor));
    } catch (err) {
      alert("Error al guardar cambio: " + err.message);
    }
  };

  // Cambiar el Jefe o el Gerente de un departamento directo desde la Matriz General
  const cambiarTitularEnMatriz = async (depto, campoId, nuevoUsuarioId) => {
    const actualizado = {
      ...depto,
      [campoId]: nuevoUsuarioId || null,
      emp_requiere_jefe: campoId === 'jefe_id' ? Boolean(nuevoUsuarioId) : depto.emp_requiere_jefe
    };
    setListaDeptosLocal(prev => prev.map(d => d.id === depto.id ? actualizado : d));

    try {
      await actualizarDepartamentoSeguro(
        depto.id,
        depto.nombre,
        depto.clasificacion,
        depto.nombre,
        {
          jefe_id: actualizado.jefe_id,
          gerente_id: actualizado.gerente_id,
          emp_requiere_jefe: actualizado.emp_requiere_jefe,
          emp_requiere_gerente: actualizado.emp_requiere_gerente,
          jefe_requiere_gerente: actualizado.jefe_requiere_gerente
        }
      );
    } catch (err) {
      alert("Error al asignar responsable: " + err.message);
    }
  };

  const abrirNuevoDepartamento = () => {
    const primerGerente = listaUsuariosLocal.find(u => u.rol === 'gerente_produccion' && u.activo) || '';
    setModalDepto({
      modo: 'crear',
      id: null,
      nombreAnterior: '',
      nombre: '',
      clasificacion: 'produccion',
      jefe_id: '',
      gerente_id: primerGerente?.id || ''
    });
  };

  const guardarModalDepto = async (e) => {
    e.preventDefault();
    if (!modalDepto?.nombre?.trim()) return alert("Ingresa un nombre para el departamento.");
    setGuardando(true);
    try {
      await crearDepartamentoConEcualizador({
        nombre: modalDepto.nombre,
        jefe_id: modalDepto.jefe_id || null,
        gerente_id: modalDepto.gerente_id || null,
        emp_requiere_jefe: Boolean(modalDepto.jefe_id),
        emp_requiere_gerente: Boolean(modalDepto.gerente_id),
        jefe_requiere_gerente: Boolean(modalDepto.gerente_id)
      });
      setModalDepto(null);
      if (recargarDatos) await recargarDatos();
    } catch (err) {
      alert("Error al crear departamento: " + err.message);
    } finally {
      setGuardando(false);
    }
  };

  const abrirEdicionUsuarioArbol = (u, e) => {
    e.stopPropagation();
    setUserEditando({
      id: u.id,
      nombre_completo: formatearNombreNaturalMayus(u),
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
      // Actualizar en memoria local sin recargar ni cerrar acordeones
      setListaUsuariosLocal(prev =>
        prev.map(u => u.id === userEditando.id
          ? {
              ...u,
              departamento_id: userEditando.departamento_id,
              area: (userEditando.area || '').toUpperCase(),
              puesto: (userEditando.puesto || '').toUpperCase(),
              rol: userEditando.rol,
              reporta_a_id: userEditando.reporta_a_id || null
            }
          : u
        )
      );
      setUserEditando(null);
    } catch (err) {
      alert("Error al guardar: " + err.message);
    } finally {
      setGuardando(false);
    }
  };

  const areasDelDeptoSeleccionado = userEditando
    ? [...new Set(listaUsuariosLocal.filter(u => u.departamento_id === userEditando.departamento_id && u.area).map(u => u.area.trim().toUpperCase()))].sort()
    : [];

  const puestosDelDeptoSeleccionado = userEditando
    ? [...new Set(listaUsuariosLocal.filter(u => u.departamento_id === userEditando.departamento_id && u.puesto).map(u => u.puesto.trim().toUpperCase()))].sort()
    : [];

  const posiblesJefesParaUsuario = useMemo(() => {
    if (!userEditando) return [];
    return listaUsuariosLocal
      .filter(u => u.activo !== false && u.id !== userEditando.id && !["empleado", "caseta"].includes(u.rol))
      .sort((a, b) => {
        const aMismo = a.departamento_id === userEditando.departamento_id ? 0 : 1;
        const bMismo = b.departamento_id === userEditando.departamento_id ? 0 : 1;
        if (aMismo !== bMismo) return aMismo - bMismo;
        return compararPorNombreNatural(a, b);
      });
  }, [listaUsuariosLocal, userEditando]);

  const candidatosGerenteDivision = useMemo(() => {
    return (listaUsuariosLocal || [])
      .filter(u => u.activo !== false && !['empleado', 'caseta'].includes(u.rol))
      .sort((a, b) => {
        const aVal = esRolValidadorSuperior(a.rol) ? 0 : 1;
        const bVal = esRolValidadorSuperior(b.rol) ? 0 : 1;
        if (aVal !== bVal) return aVal - bVal;
        return compararPorNombreNatural(a, b);
      });
  }, [listaUsuariosLocal]);

  const candidatosJefeGeneral = useMemo(() => {
    return (listaUsuariosLocal || [])
      .filter(u => u.activo !== false && u.rol !== 'caseta')
      .sort((a, b) => {
        const aMando = a.rol !== 'empleado' ? 0 : 1;
        const bMando = b.rol !== 'empleado' ? 0 : 1;
        if (aMando !== bMando) return aMando - bMando;
        return compararPorNombreNatural(a, b);
      });
  }, [listaUsuariosLocal]);

  // Resuelve el Jefe de Área real del departamento (sea por d.jefe_id o por el Jefe de Depto que aparece en el Organigrama)
  const obtenerJefeEfectivoId = (depto) => {
    if (!depto) return '';
    if (depto.jefe_id) {
      const existeActivo = (listaUsuariosLocal || []).some(u => u.id === depto.jefe_id && u.activo !== false);
      if (existeActivo) return depto.jefe_id;
    }
    const personalActivo = (listaUsuariosLocal || []).filter(
      u => u.departamento_id === depto.id && u.activo !== false && !esRolValidadorSuperior(u.rol)
    );
    const nombreDeptoNorm = normalizar(depto.nombre);
    const jefeDirecto =
      personalActivo.find(u => u.rol === 'jefe_area' && normalizar(u.area || depto.nombre) === nombreDeptoNorm) ||
      personalActivo.find(u => u.rol === 'jefe_area') ||
      personalActivo.find(u => u.rol === 'encargado' && normalizar(u.area || depto.nombre) === nombreDeptoNorm);
    return jefeDirecto ? jefeDirecto.id : '';
  };

  // Auto-sincronizar en segundo plano cualquier departamento donde el Organigrama tenía Jefe pero d.jefe_id estaba vacío
  useEffect(() => {
    if (!listaDeptosLocal?.length || !listaUsuariosLocal?.length) return;
    const desincronizados = listaDeptosLocal.filter(d => !d.jefe_id && obtenerJefeEfectivoId(d));
    if (desincronizados.length === 0) return;

    setListaDeptosLocal(prev =>
      prev.map(d => {
        if (!d.jefe_id) {
          const idDetectado = obtenerJefeEfectivoId(d);
          if (idDetectado) return { ...d, jefe_id: idDetectado, emp_requiere_jefe: true };
        }
        return d;
      })
    );

    desincronizados.forEach(d => {
      const idDetectado = obtenerJefeEfectivoId(d);
      if (idDetectado) {
        actualizarDepartamentoSeguro(d.id, d.nombre, d.clasificacion, d.nombre, {
          jefe_id: idDetectado,
          gerente_id: d.gerente_id,
          emp_requiere_jefe: true,
          emp_requiere_gerente: d.emp_requiere_gerente,
          jefe_requiere_gerente: d.jefe_requiere_gerente !== false
        }).catch(() => {});
      }
    });
  }, [listaUsuariosLocal, listaDeptosLocal.length]);

  // Departamentos que tienen personal activo (para no mostrar departamentos vacíos)
  const deptosConPersonal = useMemo(() => {
    return (listaDeptosLocal || []).filter(d =>
      listaUsuariosLocal.some(u => u.departamento_id === d.id && u.activo !== false)
    );
  }, [listaDeptosLocal, listaUsuariosLocal]);

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

        .btn-toggle-yn {
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
          border: none;
          transition: all 0.15s ease;
          min-width: 90px;
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

      {/* BARRA SUPERIOR */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        {seguridadDesbloqueada && (
          <>
            <button
              onClick={() => setModalMatrizAbierto(true)}
              style={{
                background: c.accent,
                border: 'none',
                padding: '6px 13px',
                borderRadius: '6px',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                fontWeight: '800',
                letterSpacing: '0.02em',
                boxShadow: '0 2px 8px rgba(22, 163, 74, 0.35)'
              }}
            >
              <Sliders size={13} strokeWidth={2.5} />
              <span>Tabla de Firmas (Todos los Deptos)</span>
            </button>

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
                fontWeight: '800'
              }}
            >
              <Plus size={12} strokeWidth={2.5} />
              <span>Nuevo Depto</span>
            </button>
          </>
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
            fontWeight: '700'
          }}
        >
          {hayAlgoAbierto ? <ChevronsUp size={12} /> : <ChevronsDown size={12} />}
          <span>{hayAlgoAbierto ? 'Comprimir' : 'Expandir'}</span>
        </button>

        <button
          onClick={() => seguridadDesbloqueada ? cambiarEstadoSeguridad(false) : setModalPinAbierto(true)}
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
          {!esMobile && <span>{seguridadDesbloqueada ? 'Bloquear' : 'Desbloquear'}</span>}
        </button>
      </div>

      {/* NIVEL 1: DIVISIONES LIMPIAS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {ramasOrganigrama.map(sec => {
          const divAbierta = Boolean(divisionesAbiertas[sec.key]);
          const gerentesDivision = sec.gerentesDivision || [];
          const idsGerentesDivision = new Set(gerentesDivision.map(g => g.id));

          const deptosSec = (sec.departamentos || []).filter(d => {
            const activosSinGerenteDiv = listaUsuariosLocal.filter(u => u.departamento_id === d.id && u.activo === true && !idsGerentesDivision.has(u.id));
            return activosSinGerenteDiv.length > 0;
          });

          if (deptosSec.length === 0 && gerentesDivision.length === 0) return null;

          const idsDeptosSec = new Set(deptosSec.map(d => d.id));
          const totalPersonasDivision = listaUsuariosLocal.filter(u => u.activo && (idsGerentesDivision.has(u.id) || idsDeptosSec.has(u.departamento_id))).length;
          const titularTexto = gerentesDivision.length > 0
            ? gerentesDivision.map(g => formatearNombreNaturalMayus(g)).join(' / ')
            : '';

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

                  {/* NIVEL 2: DEPARTAMENTOS LIMPIOS */}
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

                      const personalDepto = (listaUsuariosLocal || [])
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
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: esMobile ? '11px 13px' : '12px 16px', cursor: 'pointer', borderRadius: abierto ? '8px 8px 0 0' : '8px', borderBottom: abierto ? `1px solid ${c.border}` : 'none', gap: '8px' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0, flex: 1 }}>
                              <div style={{ color: c.subText, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {abierto ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                              </div>
                              <span style={{ fontSize: esMobile ? '13px' : '14px', fontWeight: '800', color: c.text, letterSpacing: '0.03em' }}>
                                {depto.nombre}
                              </span>
                            </div>

                            <span style={{ fontSize: '11px', color: c.subText, fontWeight: '700', padding: '2px 7px', borderRadius: '5px', background: modoOscuro ? '#222' : '#f1f5f9' }}>
                              {personalDepto.length}
                            </span>
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
                                              <span style={{ fontSize: esMobile ? '11.5px' : '12.5px', fontWeight: '800', color: c.text, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
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
          TABLA GENERAL DE FIRMAS (TODOS LOS DEPARTAMENTOS EN UNA SOLA VENTANA)
         ===================================================================== */}
      {modalMatrizAbierto && (
        <div onClick={() => { setModalMatrizAbierto(false); if (recargarDatos) recargarDatos(); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2700, padding: '14px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '14px', padding: '20px', width: '100%', maxWidth: '880px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: '0 25px 60px rgba(0,0,0,0.6)', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${c.border}`, paddingBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: '900', color: c.text }}>
                  Tabla General de Firmas por Departamento
                </div>
                <div style={{ fontSize: '12px', color: c.subText, marginTop: '2px' }}>
                  Cambia cualquier opción aquí mismo; se guarda al instante sin cerrar la ventana. (RH siempre recibe el pase al final).
                </div>
              </div>
              <button onClick={() => { setModalMatrizAbierto(false); if (recargarDatos) recargarDatos(); }} style={{ background: 'none', border: 'none', color: c.subText, cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <div style={{ overflowY: 'auto', overflowX: 'auto', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${c.border}`, textAlign: 'left', color: c.subText, fontSize: '11px', textTransform: 'uppercase' }}>
                    <th style={{ padding: '10px 8px' }}>Departamento</th>
                    <th style={{ padding: '10px 8px' }}>Jefe de Área (Firma 1)</th>
                    <th style={{ padding: '10px 8px' }}>Gerente (Firma 2)</th>
                    <th style={{ padding: '10px 8px', textAlign: 'center' }}>¿El Jefe requiere firma del Gerente?</th>
                    <th style={{ padding: '10px 8px', textAlign: 'center' }}>¿Los Empleados requieren firma del Gerente?</th>
                  </tr>
                </thead>
                <tbody>
                  {deptosConPersonal.map(d => {
                    const jefeEfectivoId = d.jefe_id || obtenerJefeEfectivoId(d);
                    const tieneJefe = Boolean(jefeEfectivoId);
                    const tieneGerente = Boolean(d.gerente_id);
                    const jefePideGerente = tieneGerente && d.jefe_requiere_gerente !== false;
                    const empPidenGerente = tieneGerente && Boolean(d.emp_requiere_gerente);

                    return (
                      <tr key={d.id} style={{ borderBottom: `1px solid ${c.border}` }}>
                        <td style={{ padding: '10px 8px', fontWeight: '800', color: c.text }}>
                          {d.nombre}
                        </td>

                        {/* Selector de Jefe del Departamento */}
                        <td style={{ padding: '10px 8px' }}>
                          <select
                            value={jefeEfectivoId}
                            onChange={e => cambiarTitularEnMatriz(d, 'jefe_id', e.target.value)}
                            style={{ width: '100%', padding: '7px 8px', borderRadius: '6px', border: `1px solid ${c.border}`, background: c.inputBg, color: c.text, fontSize: '12px', fontWeight: '600' }}
                          >
                            <option value="">-- Sin Jefe de Área --</option>
                            {candidatosJefeGeneral.map(u => (
                              <option key={u.id} value={u.id}>{formatearNombreNaturalMayus(u)}</option>
                            ))}
                          </select>
                        </td>

                        {/* Selector de Gerente */}
                        <td style={{ padding: '10px 8px' }}>
                          <select
                            value={d.gerente_id || ''}
                            onChange={e => cambiarTitularEnMatriz(d, 'gerente_id', e.target.value)}
                            style={{ width: '100%', padding: '7px 8px', borderRadius: '6px', border: `1px solid ${c.border}`, background: c.inputBg, color: c.text, fontSize: '12px', fontWeight: '600' }}
                          >
                            <option value="">-- Directo a RH --</option>
                            {candidatosGerenteDivision.map(g => (
                              <option key={g.id} value={g.id}>{formatearNombreNaturalMayus(g)}</option>
                            ))}
                          </select>
                        </td>

                        {/* Botón SÍ/NO: ¿El Jefe necesita firma del Gerente? */}
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                          {tieneJefe && tieneGerente ? (
                            <button
                              type="button"
                              className="btn-toggle-yn"
                              onClick={() => cambiarSwitchEnMatriz(d.id, 'jefe_requiere_gerente', !jefePideGerente)}
                              style={{
                                background: jefePideGerente ? '#16a34a' : (modoOscuro ? '#262626' : '#e2e8f0'),
                                color: jefePideGerente ? '#ffffff' : c.subText
                              }}
                            >
                              {jefePideGerente ? 'SÍ (Pasa al Gerente)' : 'NO (Directo a RH)'}
                            </button>
                          ) : (
                            <span style={{ fontSize: '11px', color: c.subText }}>—</span>
                          )}
                        </td>

                        {/* Botón SÍ/NO: ¿Los Empleados necesitan firma del Gerente? */}
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                          {tieneGerente ? (
                            <button
                              type="button"
                              className="btn-toggle-yn"
                              onClick={() => cambiarSwitchEnMatriz(d.id, 'emp_requiere_gerente', !empPidenGerente)}
                              style={{
                                background: empPidenGerente ? '#16a34a' : (modoOscuro ? '#262626' : '#e2e8f0'),
                                color: empPidenGerente ? '#ffffff' : c.subText
                              }}
                            >
                              {empPidenGerente ? 'SÍ (Pasan al Gerente)' : 'NO (Solo Jefe → RH)'}
                            </button>
                          ) : (
                            <span style={{ fontSize: '11px', color: c.subText }}>Directo a RH</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '8px', borderTop: `1px solid ${c.border}` }}>
              <button
                type="button"
                onClick={() => { setModalMatrizAbierto(false); if (recargarDatos) recargarDatos(); }}
                style={{ padding: '10px 22px', borderRadius: '8px', border: 'none', background: c.accent, color: '#fff', fontWeight: '800', fontSize: '13px', cursor: 'pointer' }}
              >
                Listo, cerrar tabla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PARA CREAR NUEVO DEPARTAMENTO */}
      {modalDepto && (
        <div onClick={() => setModalDepto(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2600, padding: '16px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '14px', padding: '20px', width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: '0 20px 50px rgba(0,0,0,0.55)', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${c.border}`, paddingBottom: '10px' }}>
              <div style={{ fontSize: '15px', fontWeight: '900', color: c.text }}>Nuevo Departamento</div>
              <button onClick={() => setModalDepto(null)} style={{ background: 'none', border: 'none', color: c.subText, cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <form onSubmit={guardarModalDepto} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: c.subText, marginBottom: '4px', textTransform: 'uppercase' }}>Nombre del Departamento</label>
                <input
                  type="text"
                  required
                  value={modalDepto.nombre}
                  onChange={e => setModalDepto({ ...modalDepto, nombre: e.target.value.toUpperCase() })}
                  placeholder="Ej. COMPRAS, LOGISTICA..."
                  style={{ width: '100%', padding: '10px', borderRadius: '7px', border: `1px solid ${c.border}`, background: c.inputBg, color: c.text, fontSize: '13px', fontWeight: '800', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: c.subText, marginBottom: '4px', textTransform: 'uppercase' }}>Jefe de Área</label>
                <select
                  value={modalDepto.jefe_id || ''}
                  onChange={e => setModalDepto({ ...modalDepto, jefe_id: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '7px', border: `1px solid ${c.border}`, background: c.inputBg, color: c.text, fontSize: '12.5px', fontWeight: '700', boxSizing: 'border-box' }}
                >
                  <option value="">Sin Jefe</option>
                  {candidatosJefeGeneral.map(j => (
                    <option key={j.id} value={j.id}>{formatearNombreNaturalMayus(j)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: c.subText, marginBottom: '4px', textTransform: 'uppercase' }}>Gerente</label>
                <select
                  value={modalDepto.gerente_id || ''}
                  onChange={e => setModalDepto({ ...modalDepto, gerente_id: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '7px', border: `1px solid ${c.border}`, background: c.inputBg, color: c.text, fontSize: '12.5px', fontWeight: '700', boxSizing: 'border-box' }}
                >
                  <option value="">Directo a RH</option>
                  {candidatosGerenteDivision.map(g => (
                    <option key={g.id} value={g.id}>{formatearNombreNaturalMayus(g)}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <button type="button" onClick={() => setModalDepto(null)} style={{ flex: 1, padding: '10px', borderRadius: '7px', border: `1px solid ${c.border}`, background: 'transparent', color: c.subText, fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" disabled={guardando} style={{ flex: 1.5, padding: '10px', borderRadius: '7px', border: 'none', background: c.accent, color: '#fff', fontWeight: '800', fontSize: '12.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <Save size={14} /> {guardando ? 'Guardando...' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PARA EDITAR COLABORADOR INDIVIDUAL */}
      {userEditando && (() => {
        const esCabezaDivision = ['gerente_produccion', 'gerente_admin', 'gerente_rh'].includes(userEditando.rol);
        return (
          <div onClick={() => setUserEditando(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2500, padding: '16px' }}>
            <div onClick={e => e.stopPropagation()} style={{ background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '10px', padding: '20px', width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${c.border}`, paddingBottom: '10px' }}>
                <div style={{ fontSize: '14px', fontWeight: '800', color: c.text }}>{userEditando.nombre_completo}</div>
                <button onClick={() => setUserEditando(null)} style={{ background: 'none', border: 'none', color: c.subText, cursor: 'pointer' }}><X size={18} /></button>
              </div>

              <form onSubmit={guardarReubicacionUsuario} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {!esCabezaDivision && (
                  <>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: c.subText, marginBottom: '4px', textTransform: 'uppercase' }}>Departamento</label>
                      <select
                        value={userEditando.departamento_id}
                        onChange={e => {
                          const nuevoDeptoId = e.target.value;
                          const dObj = listaDeptosLocal.find(d => d.id === nuevoDeptoId);
                          setUserEditando({
                            ...userEditando,
                            departamento_id: nuevoDeptoId,
                            area: dObj ? dObj.nombre : '',
                            reporta_a_id: dObj?.jefe_id && dObj.jefe_id !== userEditando.id ? dObj.jefe_id : ''
                          });
                        }}
                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: `1px solid ${c.border}`, background: c.inputBg, color: c.text, fontSize: '12.5px', fontWeight: '600', boxSizing: 'border-box' }}
                      >
                        {listaDeptosLocal.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: c.subText, marginBottom: '4px', textTransform: 'uppercase' }}>Subárea (Opcional)</label>
                      <input
                        list="areas-coherentes-arbol"
                        value={userEditando.area}
                        onChange={e => setUserEditando({ ...userEditando, area: e.target.value.toUpperCase() })}
                        placeholder="Ej. HERRAJES, NOMINAS..."
                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: `1px solid ${c.border}`, background: c.inputBg, color: c.text, fontSize: '12.5px', fontWeight: '600', boxSizing: 'border-box' }}
                      />
                      <datalist id="areas-coherentes-arbol">
                        {areasDelDeptoSeleccionado.map(a => <option key={a} value={a} />)}
                      </datalist>
                    </div>
                  </>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: c.subText, marginBottom: '4px', textTransform: 'uppercase' }}>Puesto</label>
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

                {!esCabezaDivision && (
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: c.subText, marginBottom: '4px', textTransform: 'uppercase' }}>
                      Jefe Inmediato Personalizado
                    </label>
                    <select
                      value={userEditando.reporta_a_id || ''}
                      onChange={e => setUserEditando({ ...userEditando, reporta_a_id: e.target.value })}
                      style={{ width: '100%', padding: '10px', borderRadius: '6px', border: `1px solid ${c.border}`, background: c.inputBg, color: c.text, fontSize: '12.5px', fontWeight: '600', boxSizing: 'border-box' }}
                    >
                      <option value="">Automático según la Tabla de Firmas</option>
                      {posiblesJefesParaUsuario.map(j => (
                        <option key={j.id} value={j.id}>{formatearNombreNaturalMayus(j)}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: c.subText, marginBottom: '4px', textTransform: 'uppercase' }}>Rol en el Sistema</label>
                  <select
                    value={userEditando.rol}
                    onChange={e => setUserEditando({ ...userEditando, rol: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: `1px solid ${c.border}`, background: c.inputBg, color: c.text, fontSize: '12.5px', fontWeight: '600', boxSizing: 'border-box' }}
                  >
                    <option value="empleado">EMPLEADO / OPERADOR</option>
                    <option value="jefe_area">JEFE DE ÁREA / SUPERVISOR</option>
                    <option value="gerente_produccion">GERENTE DE PRODUCCIÓN</option>
                    <option value="gerente_admin">GERENTE ADMINISTRATIVO</option>
                    <option value="gerente_rh">GERENTE DE RECURSOS HUMANOS</option>
                    <option value="rh_nominas">TITULAR RH / NÓMINAS</option>
                    <option value="caseta">CASETA / VIGILANCIA</option>
                    <option value="superadmin">SUPER ADMINISTRADOR</option>
                  </select>
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
        );
      })()}

      <ModalSeguridadPin
        abierto={modalPinAbierto}
        onClose={() => setModalPinAbierto(false)}
        onAutorizado={() => cambiarEstadoSeguridad(true)}
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
          style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: '6px', color: c.subText, cursor: 'pointer', padding: '5px 8px', fontSize: '10.5px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}
          title="Editar colaborador"
        >
          <Edit2 size={12} />
        </button>
      )}
    </div>
  );
}