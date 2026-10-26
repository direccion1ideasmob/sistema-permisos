import { formatearApellidosNombre, compararPorApellidoPaterno } from '../../../core/utils/ordenNombre';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  obtenerDatosCaseta,
  registrarAsistenciaLista,
  deshacerEntradaReciente,
  obtenerFechaLocalHoy,
  obtenerHoraLimiteTolerancia,
  obtenerHoraSalidaOficial
} from '../../vigilancia/services/vigilanciaService';
import ControlHoraCorteRH from '../autorizacion/ControlHoraCorteRH';
import {
  Calendar, Search, RefreshCw, Download,
  Clock, CheckCircle2, X, Undo2, ChevronLeft, ChevronRight, Check, LogOut, SlidersHorizontal, RotateCcw
} from 'lucide-react';

const formatearFechaCorta = (fechaYYYYMMDD) => {
  if (!fechaYYYYMMDD) return '';
  const [y, m, d] = fechaYYYYMMDD.split('-').map(Number);
  const fechaObj = new Date(y, m - 1, d);
  const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${dias[fechaObj.getDay()]}, ${String(d).padStart(2, '0')} ${meses[m - 1]} ${y}`;
};

const moverFechaDias = (fechaYYYYMMDD, dias) => {
  const [y, m, d] = fechaYYYYMMDD.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0);
  dt.setDate(dt.getDate() + dias);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
};

export default function VistaAsistenciaDiariaRH({ usuario, departamentos = [], c, modoOscuro, selectorModo = null }) {
  const hoyStr = obtenerFechaLocalHoy();
  const [fecha, setFecha] = useState(hoyStr);
  const [busqueda, setBusqueda] = useState('');
  const [deptoFiltro, setDeptoFiltro] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('todos');
  const [mostrarOpcionesRH, setMostrarOpcionesRH] = useState(false);
  const inputFechaRef = useRef(null);

  const [empleados, setEmpleados] = useState([]);
  const [mapaAsistencias, setMapaAsistencias] = useState({});
  const [mapaIncidencias, setMapaIncidencias] = useState({});
  const [cargando, setCargando] = useState(true);
  const [procesandoId, setProcesandoId] = useState(null);
  const [horaLimiteCorte, setHoraLimiteCorte] = useState(() => localStorage.getItem('hora_limite_retardo_rh') || '07:15');
  const [horaSalidaOficial, setHoraSalidaOficial] = useState(() => localStorage.getItem('hora_salida_oficial_rh') || '17:00');

  const cargarAsistenciaDia = useCallback(async () => {
    setCargando(true);
    try {
      const sedeFiltro = usuario?.rol === 'superadmin' ? null : (usuario?.sede_id || null);
      obtenerHoraLimiteTolerancia().then(h => h && setHoraLimiteCorte(h));
      obtenerHoraSalidaOficial().then(hSal => hSal && setHoraSalidaOficial(hSal));
      const data = await obtenerDatosCaseta(sedeFiltro, fecha);
      setEmpleados(data.empleadosSede || []);
      setMapaAsistencias(data.mapaAsistencias || {});
      setMapaIncidencias(data.mapaIncidenciasHoy || {});
    } catch (err) {
      console.error('Error cargando lista de asistencia diaria para RH:', err);
    } finally {
      setCargando(false);
    }
  }, [fecha, usuario?.rol, usuario?.sede_id]);

  useEffect(() => {
    cargarAsistenciaDia();
  }, [cargarAsistenciaDia]);

  const handleMarcarDesdeRH = async (empId, tipoMarca) => {
    setProcesandoId(`${empId}-${tipoMarca}`);
    try {
      await registrarAsistenciaLista(empId, tipoMarca, usuario?.id || null, true);
      await cargarAsistenciaDia();
    } catch (err) {
      alert('Error al registrar desde RH: ' + err.message);
    } finally {
      setProcesandoId(null);
    }
  };

  const handleQuitarEntradaRH = async (empId, nombre) => {
    if (!window.confirm(`¿Deseas eliminar el registro de entrada de ${nombre}?`)) return;
    setProcesandoId(`${empId}-borrar`);
    try {
      await deshacerEntradaReciente(empId);
      await cargarAsistenciaDia();
    } catch (err) {
      alert('No se pudo quitar la marca: ' + err.message);
    } finally {
      setProcesandoId(null);
    }
  };

  // Clasificación coherente de cada colaborador en el día
  const clasificarEmpleado = (emp) => {
    const reg = mapaAsistencias[emp.id];
    const inc = mapaIncidencias[emp.id];
    if (reg?.hora_entrada) return 'presentes';
    if (inc?.tipo === 'ausencia_autorizada') return 'justificados';
    return 'ausentes';
  };

  const basePorDeptoYBusqueda = [...empleados]
    .sort((a, b) => compararPorApellidoPaterno(a, b))
    .filter((emp) => {
    if (deptoFiltro && String(emp.departamento_id) !== String(deptoFiltro)) return false;
    const termino = busqueda.toLowerCase().trim();
    if (termino) {
      const matchNombre = (emp.nombre_completo || '').toLowerCase().includes(termino) || formatearApellidosNombre(emp.nombre_completo).toLowerCase().includes(termino);
      const matchNum = String(emp.numero_empleado || '').toLowerCase().includes(termino);
      if (!matchNombre && !matchNum) return false;
    }
    return true;
  });

  const totalPresentes = basePorDeptoYBusqueda.filter(e => clasificarEmpleado(e) === 'presentes').length;
  const totalJustificados = basePorDeptoYBusqueda.filter(e => clasificarEmpleado(e) === 'justificados').length;
  const totalAusentes = basePorDeptoYBusqueda.filter(e => clasificarEmpleado(e) === 'ausentes').length;
  const totalConSalida = basePorDeptoYBusqueda.filter(e => Boolean(mapaAsistencias[e.id]?.hora_entrada && mapaAsistencias[e.id]?.hora_salida)).length;

  const listaProcesada = basePorDeptoYBusqueda.filter((emp) => {
    if (estadoFiltro === 'todos') return true;
    return clasificarEmpleado(emp) === estadoFiltro;
  });

  // Regla de cierre de día para exportar
  const esDiaAnterior = fecha < hoyStr;
  const ahoraReloj = new Date();
  const minActuales = ahoraReloj.getHours() * 60 + ahoraReloj.getMinutes();
  const [hSalOf, mSalOf] = (horaSalidaOficial || '17:00').split(':').map(Number);
  const minSalOficial = (isNaN(hSalOf) ? 17 : hSalOf) * 60 + (isNaN(mSalOf) ? 0 : mSalOf);
  const jornadaHoyCerrada = minActuales >= minSalOficial || (totalPresentes > 0 && totalConSalida === totalPresentes);
  const puedeExportarDia = esDiaAnterior || jornadaHoyCerrada;

  const exportarCSV = () => {
    if (!puedeExportarDia) {
      alert(
        totalPresentes === 0
          ? '⏳ Aún no hay registros de asistencia cerrados el día de hoy.\n\nPara descargar un reporte completo, selecciona una fecha anterior o espera al cierre de la jornada.'
          : `⏳ La jornada de hoy sigue en curso (${totalConSalida} de ${totalPresentes} en planta han registrado salida).\n\nEl reporte se habilitará al concluir las salidas, o puedes consultar cualquier día anterior con las flechas de fecha.`
      );
      return;
    }

    const encabezados = [
      'FECHA', 'NO. EMPLEADO', 'COLABORADOR', 'DEPARTAMENTO', 'PUESTO',
      'ESTATUS DEL DIA', 'HORA ENTRADA', 'HORA SALIDA', 'INCIDENCIA / PERMISO'
    ];

    const filas = listaProcesada.map((emp) => {
      const reg = mapaAsistencias[emp.id];
      const inc = mapaIncidencias[emp.id];
      const horaEnt = reg?.hora_entrada || inc?.horaLlegadaPuerta || '';
      const horaSal = reg?.hora_salida || '';

      let estado = 'SIN REGISTRO / FALTA';
      if (reg?.hora_entrada) {
        estado = reg.hora_entrada > horaLimiteCorte ? 'ASISTIO (RETARDO)' : 'ASISTIO PUNTUAL';
      } else if (inc?.tipo === 'retardo_regresa') {
        estado = 'FALTA (REGRESADO EN PUERTA POR RETARDO)';
      } else if (inc?.tipo === 'ausencia_autorizada') {
        estado = 'AUSENCIA JUSTIFICADA';
      }

      const etiquetaLimpia = (inc?.etiqueta || 'Sin incidencia')
        .replace(/[✅🚫⏳↩️🕒📅•]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      return [
        `"${fecha}"`,
        `"${emp.numero_empleado || ''}"`,
        `"${(emp.nombre_completo || '').replace(/"/g, '""')}"`,
        `"${(emp.departamentos?.nombre || 'General').replace(/"/g, '""')}"`,
        `"${(emp.puesto || emp.area || '').replace(/"/g, '""')}"`,
        `"${estado}"`,
        `"${horaEnt || '--:--'}"`,
        `"${horaSal || '--:--'}"`,
        `"${etiquetaLimpia.replace(/"/g, '""')}"`
      ].join(',');
    });

    const csvContent = '\uFEFF' + [encabezados.join(','), ...filas].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Asistencia_${fecha}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
      <style>{`
        .vad-toolbar-card {
          background: ${c.surfaceCard};
          border: 1px solid ${c.border};
          border-radius: 12px;
          padding: 8px 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          box-sizing: border-box;
        }
        .vad-top-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          width: 100%;
        }
        .vad-middle-controls {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
          justify-content: center;
          min-width: 0;
        }
        .vad-date-bar {
          display: inline-flex;
          align-items: center;
          justify-content: space-between;
          gap: 4px;
          background: ${c.bg};
          border: 1px solid ${c.border};
          border-radius: 8px;
          padding: 2px 4px;
          height: 34px;
          box-sizing: border-box;
          flex-shrink: 0;
        }
        .vad-search-box {
          position: relative;
          flex: 1;
          max-width: 340px;
          min-width: 180px;
        }
        .vad-actions-pack {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }
        .vad-btn-neutral {
          height: 34px;
          padding: 0 11px;
          border-radius: 8px;
          border: 1px solid ${c.border};
          background: ${c.bg};
          color: ${c.text};
          font-size: 12.5px;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          white-space: nowrap;
          box-sizing: border-box;
        }
        .vad-drawer-panel {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 10px;
          background: ${c.surfaceCard};
          border: 1px solid ${c.border};
          border-radius: 10px;
          padding: 12px;
          box-sizing: border-box;
        }
        .vad-select-clean {
          width: 100%;
          height: 34px;
          padding: 0 10px;
          border-radius: 7px;
          border: 1px solid ${c.border};
          background: ${c.bg};
          color: ${c.text};
          font-size: 12.5px;
          font-weight: 600;
          outline: none;
          box-sizing: border-box;
        }
        .vad-table-container {
          background: ${c.surfaceCard};
          border: 1px solid ${c.border};
          border-radius: 12px;
          overflow: hidden;
        }
        .vad-item-row {
          display: grid;
          grid-template-columns: minmax(220px, 1.8fr) minmax(130px, 1fr) minmax(180px, 1.3fr) auto;
          align-items: center;
          gap: 12px;
          padding: 9px 16px;
          border-bottom: 1px solid ${c.border};
          transition: background 0.12s ease;
        }
        .vad-item-row:last-child {
          border-bottom: none;
        }
        .vad-item-row:hover {
          background: ${modoOscuro ? 'rgba(255,255,255,0.02)' : '#f8fafc'};
        }
        .vad-mobile-only {
          display: none;
        }
        @media (max-width: 768px) {
          .vad-toolbar-card {
            padding: 10px !important;
            gap: 8px !important;
          }
          .vad-desktop-only {
            display: none !important;
          }
          .vad-mobile-only {
            display: flex !important;
          }
          .vad-btn-label-hide-mobile {
            display: none !important;
          }
          .vad-icon-only-mobile {
            padding: 0 !important;
            width: 34px !important;
            height: 34px !important;
          }
          .vad-date-bar-mobile {
            width: 100% !important;
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            background: ${c.bg};
            border: 1px solid ${c.border};
            border-radius: 8px;
            padding: 2px 6px;
            height: 36px;
            box-sizing: border-box;
          }
          .vad-drawer-panel {
            grid-template-columns: 1fr !important;
            padding: 10px !important;
          }
          .vad-item-row {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 8px !important;
            padding: 9px 12px !important;
          }
          .vad-col-depto {
            display: none !important;
          }
          .vad-col-status {
            display: none !important;
          }
          .vad-mobile-inline-status {
            display: inline !important;
          }
        }
        .vad-mobile-inline-status {
          display: none;
        }
      `}</style>

      {/* BARRA PRINCIPAL LIMPIA Y SIMÉTRICA (IDÉNTICA A PERMISOS) */}
      <div className="vad-toolbar-card">
        {/* RENGLÓN 1: [Permisos | Asistencia] <---> (En 14": Fecha + Buscador) <---> [Filtros] + [Exportar] */}
        <div className="vad-top-row">
          {selectorModo}

          {/* Controles centrales en Laptop 14" (Fecha + Buscador en la misma línea) */}
          <div className="vad-middle-controls vad-desktop-only">
            <div className="vad-date-bar">
              <button
                type="button"
                onClick={() => setFecha(moverFechaDias(fecha, -1))}
                title="Día anterior"
                style={{ width: '26px', height: '28px', borderRadius: '5px', border: 'none', background: 'transparent', color: c.text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <ChevronLeft size={15} />
              </button>

              <button
                type="button"
                onClick={() => {
                  if (inputFechaRef.current?.showPicker) inputFechaRef.current.showPicker();
                  else inputFechaRef.current?.focus();
                }}
                style={{ height: '28px', padding: '0 8px', border: 'none', background: 'transparent', color: c.text, fontSize: '12px', fontWeight: '800', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
              >
                <Calendar size={13} color={c.accent} />
                <span>{formatearFechaCorta(fecha)}</span>
                {fecha === hoyStr && (
                  <span style={{ fontSize: '9.5px', fontWeight: '800', color: c.accent, background: c.accentSoft, padding: '1px 5px', borderRadius: '4px' }}>
                    HOY
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => fecha < hoyStr && setFecha(moverFechaDias(fecha, 1))}
                disabled={fecha >= hoyStr}
                title="Día siguiente"
                style={{ width: '26px', height: '28px', borderRadius: '5px', border: 'none', background: 'transparent', color: c.text, opacity: fecha >= hoyStr ? 0.3 : 1, cursor: fecha >= hoyStr ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <ChevronRight size={15} />
              </button>
            </div>

            <div className="vad-search-box">
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: c.textMuted }} />
              <input
                type="text"
                placeholder="Buscar apellido, nombre o #nómina..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                style={{
                  width: '100%', height: '34px', padding: '0 28px 0 31px', borderRadius: '8px',
                  border: `1px solid ${c.border}`, background: c.bg, color: c.text,
                  fontSize: '12.5px', boxSizing: 'border-box', outline: 'none'
                }}
              />
              {busqueda && (
                <button
                  type="button"
                  onClick={() => setBusqueda('')}
                  style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: c.textMuted, cursor: 'pointer', display: 'flex' }}
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          <input
            ref={inputFechaRef}
            type="date"
            value={fecha}
            max={hoyStr}
            onChange={(e) => e.target.value && setFecha(e.target.value)}
            style={{ position: 'absolute', opacity: 0, width: '1px', height: '1px', pointerEvents: 'none' }}
          />

          <div className="vad-actions-pack">
            <button
              type="button"
              onClick={() => setMostrarOpcionesRH(prev => !prev)}
              className="vad-btn-neutral"
              title="Filtros de asistencia y horarios RH"
              style={{
                borderColor: (mostrarOpcionesRH || deptoFiltro || estadoFiltro !== 'todos') ? c.accent : c.border,
                background: (mostrarOpcionesRH || deptoFiltro || estadoFiltro !== 'todos') ? c.accentSoft : c.bg,
                color: (mostrarOpcionesRH || deptoFiltro || estadoFiltro !== 'todos') ? c.accent : c.text
              }}
            >
              <SlidersHorizontal size={14} />
              <span className="vad-btn-label-hide-mobile">Filtros</span>
              {(deptoFiltro || estadoFiltro !== 'todos') && (
                <span style={{
                  background: c.accent, color: '#fff', fontSize: '10.5px',
                  fontWeight: '800', padding: '1px 5px', borderRadius: '999px'
                }}>
                  {[Boolean(deptoFiltro), estadoFiltro !== 'todos'].filter(Boolean).length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={exportarCSV}
              className="vad-btn-neutral vad-icon-only-mobile"
              title={puedeExportarDia ? 'Descargar corte en Excel' : 'Disponible al concluir la jornada o en días anteriores'}
              style={{
                borderColor: puedeExportarDia ? c.accent : c.border,
                background: puedeExportarDia ? c.accent : c.bg,
                color: puedeExportarDia ? '#fff' : c.textMuted,
                cursor: puedeExportarDia ? 'pointer' : 'not-allowed'
              }}
            >
              <Download size={14} />
              <span className="vad-btn-label-hide-mobile">{puedeExportarDia ? 'Exportar' : 'Al cierre'}</span>
            </button>
          </div>
        </div>

        {/* RENGLÓN 2 EN CELULAR: Navegador de Fecha bien distribuido de lado a lado */}
        <div className="vad-date-bar-mobile vad-mobile-only">
          <button
            type="button"
            onClick={() => setFecha(moverFechaDias(fecha, -1))}
            style={{ width: '32px', height: '30px', border: 'none', background: 'transparent', color: c.text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <ChevronLeft size={16} />
          </button>

          <button
            type="button"
            onClick={() => {
              if (inputFechaRef.current?.showPicker) inputFechaRef.current.showPicker();
              else inputFechaRef.current?.focus();
            }}
            style={{ flex: 1, height: '30px', border: 'none', background: 'transparent', color: c.text, fontSize: '12.5px', fontWeight: '800', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            <Calendar size={13.5} color={c.accent} />
            <span>{formatearFechaCorta(fecha)}</span>
            {fecha === hoyStr && (
              <span style={{ fontSize: '10px', fontWeight: '800', color: c.accent, background: c.accentSoft, padding: '1px 6px', borderRadius: '4px' }}>
                HOY
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => fecha < hoyStr && setFecha(moverFechaDias(fecha, 1))}
            disabled={fecha >= hoyStr}
            style={{ width: '32px', height: '30px', border: 'none', background: 'transparent', color: c.text, opacity: fecha >= hoyStr ? 0.3 : 1, cursor: fecha >= hoyStr ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* RENGLÓN 3 EN CELULAR: Buscador de ancho completo */}
        <div className="vad-mobile-only" style={{ position: 'relative', width: '100%' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: c.textMuted }} />
          <input
            type="text"
            placeholder="Buscar apellido, nombre o #nómina..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{
              width: '100%', height: '36px', padding: '0 28px 0 31px', borderRadius: '8px',
              border: `1px solid ${c.border}`, background: c.bg, color: c.text,
              fontSize: '12.5px', boxSizing: 'border-box', outline: 'none'
            }}
          />
          {busqueda && (
            <button
              type="button"
              onClick={() => setBusqueda('')}
              style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: c.textMuted, cursor: 'pointer', display: 'flex' }}
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* CAJÓN DESPLEGABLE DE FILTROS (ESTATUS DE ASISTENCIA + DEPARTAMENTO + RELOJES RH) */}
      {mostrarOpcionesRH && (
        <div className="vad-drawer-panel">
          <div>
            <label style={{ display: 'block', fontSize: '10.5px', fontWeight: '700', color: c.textMuted, marginBottom: '4px', textTransform: 'uppercase' }}>
              Estatus de Asistencia
            </label>
            <select
              value={estadoFiltro}
              onChange={(e) => setEstadoFiltro(e.target.value)}
              className="vad-select-clean"
            >
              <option value="todos">Todos los colaboradores ({basePorDeptoYBusqueda.length})</option>
              <option value="presentes">En Planta ({totalPresentes})</option>
              <option value="justificados">Justificados ({totalJustificados})</option>
              <option value="ausentes">Sin Registro / Faltas ({totalAusentes})</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '10.5px', fontWeight: '700', color: c.textMuted, marginBottom: '4px', textTransform: 'uppercase' }}>
              Departamento
            </label>
            <select
              value={deptoFiltro}
              onChange={(e) => setDeptoFiltro(e.target.value)}
              className="vad-select-clean"
            >
              <option value="">Todos los departamentos</option>
              {departamentos.map((d) => (
                <option key={d.id} value={d.id}>{d.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '10.5px', fontWeight: '700', color: c.textMuted, marginBottom: '4px', textTransform: 'uppercase' }}>
              Horarios y Sincronización
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <ControlHoraCorteRH usuario={usuario} c={c} />

              <button
                type="button"
                onClick={cargarAsistenciaDia}
                className="vad-btn-neutral"
                style={{ flex: 1 }}
              >
                <RefreshCw size={13.5} /> Actualizar
              </button>

              {(deptoFiltro || estadoFiltro !== 'todos') && (
                <button
                  type="button"
                  onClick={() => { setDeptoFiltro(''); setEstadoFiltro('todos'); }}
                  className="vad-btn-neutral"
                  style={{ color: c.textMuted }}
                >
                  <RotateCcw size={13} /> Limpiar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* LISTA EMPAQUETADA EN TABLA COMPACTA */}
      {cargando ? (
        <div style={{ textAlign: 'center', padding: '36px', color: c.textMuted, fontSize: '13.5px', fontWeight: '600' }}>
          Cargando asistencia...
        </div>
      ) : listaProcesada.length === 0 ? (
        <div style={{
          background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '12px',
          padding: '32px 20px', textAlign: 'center', color: c.textMuted, fontSize: '13px', fontWeight: '600'
        }}>
          No hay colaboradores en este filtro.
        </div>
      ) : (
        <div className="vad-table-container">
          {listaProcesada.map((emp) => {
            const reg = mapaAsistencias[emp.id];
            const inc = mapaIncidencias[emp.id];
            const tieneEntrada = Boolean(reg?.hora_entrada);
            const tieneSalida = Boolean(reg?.hora_salida);
            const esTarde = tieneEntrada && reg.hora_entrada > horaLimiteCorte;
            const avatarUrl = emp?.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(emp?.nombre_completo || 'C')}&background=334155&color=fff&bold=true`;

            const etiquetaIncLimpia = inc?.etiqueta
              ? inc.etiqueta.replace(/[✅🚫⏳↩️🕒📅]/g, '').trim()
              : null;

            return (
              <div key={emp.id} className="vad-item-row">
                {/* COLUMNA 1: COLABORADOR */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <img
                    src={avatarUrl}
                    alt=""
                    style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: `1px solid ${c.border}` }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: c.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {formatearApellidosNombre(emp.nombre_completo, emp)}
                    </div>
                    <div style={{ fontSize: '11px', color: c.textMuted, fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: '700' }}>#{emp.numero_empleado}</span>
                      {!etiquetaIncLimpia && (
                        <span className="vad-mobile-inline-status" style={{ fontWeight: '700', color: tieneEntrada ? (esTarde ? '#d97706' : '#16a34a') : c.textMuted }}>
                          · {tieneEntrada ? `Ent: ${reg.hora_entrada}${tieneSalida ? ' / Sal: ' + reg.hora_salida : ''}` : 'Sin entrada'}
                        </span>
                      )}
                      {etiquetaIncLimpia && (
                        <span style={{ color: inc.color, fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          · {etiquetaIncLimpia}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* COLUMNA 2: DEPARTAMENTO */}
                <div className="vad-col-depto" style={{ fontSize: '12px', color: c.textMuted, fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {emp.departamentos?.nombre || 'General'}
                </div>

                {/* COLUMNA 3: RELOJ / ESTATUS */}
                <div className="vad-col-status" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  {tieneEntrada ? (
                    <>
                      <span style={{
                        fontSize: '11.5px', fontWeight: '700',
                        color: esTarde ? '#d97706' : '#16a34a',
                        background: esTarde ? 'rgba(245,158,11,0.10)' : 'rgba(22,163,74,0.10)',
                        padding: '3px 8px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px'
                      }}>
                        <Clock size={11.5} /> {reg.hora_entrada}
                      </span>

                      {tieneSalida && (
                        <span style={{
                          fontSize: '11.5px', fontWeight: '700', color: '#0284c7',
                          background: 'rgba(2,132,199,0.10)', padding: '3px 8px', borderRadius: '6px',
                          display: 'inline-flex', alignItems: 'center', gap: '4px'
                        }}>
                          <CheckCircle2 size={11.5} /> {reg.hora_salida}
                        </span>
                      )}
                    </>
                  ) : inc?.tipo === 'ausencia_autorizada' ? (
                    <span style={{ fontSize: '11.5px', fontWeight: '700', color: '#0284c7', background: 'rgba(2,132,199,0.10)', padding: '3px 8px', borderRadius: '6px' }}>
                      Justificado
                    </span>
                  ) : inc?.tipo === 'retardo_regresa' ? (
                    <span style={{ fontSize: '11.5px', fontWeight: '700', color: '#ef4444', background: 'rgba(239,68,68,0.10)', padding: '3px 8px', borderRadius: '6px' }}>
                      Falta (Se regresó)
                    </span>
                  ) : (
                    <span style={{ fontSize: '11.5px', fontWeight: '600', color: c.textMuted }}>
                      Sin entrada
                    </span>
                  )}
                </div>

                {/* COLUMNA 4: ACCIONES RÁPIDAS RH (Solo para el día de hoy) */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '5px' }}>
                  {fecha === hoyStr && (
                    tieneEntrada ? (
                      !tieneSalida && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleMarcarDesdeRH(emp.id, 'salida')}
                            disabled={procesandoId === `${emp.id}-salida`}
                            title="Registrar salida"
                            style={{
                              height: '28px', padding: '0 9px', borderRadius: '6px',
                              border: `1px solid ${c.border}`, background: c.bg, color: c.text,
                              fontSize: '11px', fontWeight: '700', cursor: 'pointer',
                              display: 'inline-flex', alignItems: 'center', gap: '4px'
                            }}
                          >
                            <LogOut size={11.5} /> Salida
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuitarEntradaRH(emp.id, emp.nombre_completo)}
                            disabled={procesandoId === `${emp.id}-borrar`}
                            title="Deshacer entrada"
                            style={{
                              width: '28px', height: '28px', borderRadius: '6px',
                              border: `1px solid ${c.border}`, background: 'transparent', color: c.textMuted,
                              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                            }}
                          >
                            <Undo2 size={12} />
                          </button>
                        </>
                      )
                    ) : (
                      inc?.tipo !== 'ausencia_autorizada' && inc?.tipo !== 'retardo_regresa' && (
                        <button
                          type="button"
                          onClick={() => handleMarcarDesdeRH(emp.id, 'entrada')}
                          disabled={procesandoId === `${emp.id}-entrada`}
                          title="Marcar asistencia en planta"
                          style={{
                            height: '28px', padding: '0 10px', borderRadius: '6px',
                            border: `1px solid ${c.border}`, background: c.bg, color: c.text,
                            fontSize: '11px', fontWeight: '700', cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center', gap: '4px'
                          }}
                        >
                          <Check size={12} color={c.accent} strokeWidth={2.5} /> Entrada
                        </button>
                      )
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
