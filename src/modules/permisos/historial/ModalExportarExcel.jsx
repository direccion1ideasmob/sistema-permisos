import React, { useState, useEffect, useMemo } from 'react';
import { X, FileSpreadsheet, Download, Search, Users, Calendar, Filter } from 'lucide-react';
import { supabase } from '../../../core/api/supabaseClient';
import { parsearDatosObservaciones, limpiarMotivo } from './TablaHistorial';

export default function ModalExportarExcel({
  solicitudesPrecargadas = [],
  departamentos = [],
  c,
  modoOscuro = false,
  onClose
}) {
  const [cargando, setCargando] = useState(false);
  const [registrosBase, setRegistrosBase] = useState(solicitudesPrecargadas);

  const [rangoRapido, setRangoRapido] = useState('historico_completo');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [clasificacion, setClasificacion] = useState('todas');
  const [deptoId, setDeptoId] = useState('todos');
  const [tipoPermiso, setTipoPermiso] = useState('todos');
  const [dictamen, setDictamen] = useState('todos');

  const [busquedaEmp, setBusquedaEmp] = useState('');
  const [empleadosSeleccionados, setEmpleadosSeleccionados] = useState([]);

  useEffect(() => {
    if (solicitudesPrecargadas && solicitudesPrecargadas.length > 0) {
      setRegistrosBase(solicitudesPrecargadas);
      return;
    }
    supabase
      .from('permisos')
      .select(`
        *,
        usuarios:usuario_id (
          id, numero_empleado, nombre_completo, area, puesto, tipo_personal, departamento_id,
          departamentos:departamento_id (nombre, clasificacion),
          sedes:sede_id (nombre)
        ),
        firmante1:firma_1_id (nombre_completo),
        firmante2:firma_2_id (nombre_completo),
        firmante3:firma_3_id (nombre_completo)
      `)
      .in('estado_general', ['autorizado', 'aprobado', 'completado_caseta', 'rechazado'])
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setRegistrosBase(data);
      });
  }, [solicitudesPrecargadas]);

  const aplicarRangoRapido = (tipo) => {
    setRangoRapido(tipo);
    const hoy = new Date();
    let inicio = new Date();
    let fin = new Date();

    if (tipo === 'esta_semana') {
      const diaSemana = hoy.getDay() || 7;
      inicio.setDate(hoy.getDate() - diaSemana + 1);
      fin = new Date(inicio);
      fin.setDate(inicio.getDate() + 6);
      setFechaInicio(inicio.toISOString().split('T')[0]);
      setFechaFin(fin.toISOString().split('T')[0]);
    } else if (tipo === 'este_mes') {
      inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
      setFechaInicio(inicio.toISOString().split('T')[0]);
      setFechaFin(fin.toISOString().split('T')[0]);
    } else if (tipo === 'mes_anterior') {
      inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      fin = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
      setFechaInicio(inicio.toISOString().split('T')[0]);
      setFechaFin(fin.toISOString().split('T')[0]);
    } else {
      setFechaInicio('');
      setFechaFin('');
    }
  };

  const coincidenClasificaciones = (p, clasifSeleccionada = '') => {
    if (clasifSeleccionada === 'todas') return true;
    const folio = (p.folio || '').toUpperCase();
    const clasifBD = (p.usuarios?.tipo_personal || p.usuarios?.departamentos?.clasificacion || '').toLowerCase();
    const nomDepto = (p.usuarios?.departamentos?.nombre || '').toLowerCase();

    if (clasifSeleccionada === 'Administración') {
      return folio.startsWith('A-') || clasifBD.includes('admin');
    }
    if (clasifSeleccionada === 'Obra') {
      return folio.startsWith('O-') || clasifBD.includes('obra') || nomDepto.includes('obra');
    }
    if (clasifSeleccionada === 'Producción') {
      return folio.startsWith('P-') || (!folio.startsWith('A-') && !folio.startsWith('O-') && !clasifBD.includes('admin') && !clasifBD.includes('obra'));
    }
    return true;
  };

  const catalogoColaboradores = useMemo(() => {
    const mapa = new Map();
    registrosBase.forEach(p => {
      const u = p.usuarios;
      const uid = p.usuario_id || u?.id || u?.numero_empleado;
      if (uid && u?.nombre_completo && !mapa.has(uid)) {
        mapa.set(uid, {
          id: uid,
          numero: u.numero_empleado || 'S/N',
          nombre: u.nombre_completo,
          depto: u.departamentos?.nombre || 'General'
        });
      }
    });
    return Array.from(mapa.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [registrosBase]);

  const sugerenciasColaboradores = useMemo(() => {
    const q = busquedaEmp.toLowerCase().trim();
    if (!q) return [];
    return catalogoColaboradores
      .filter(emp =>
        !empleadosSeleccionados.some(sel => sel.id === emp.id) &&
        (emp.nombre.toLowerCase().includes(q) || String(emp.numero).toLowerCase().includes(q))
      )
      .slice(0, 6);
  }, [busquedaEmp, catalogoColaboradores, empleadosSeleccionados]);

  const agregarEmpleado = (emp) => {
    setEmpleadosSeleccionados(prev => [...prev, emp]);
    setBusquedaEmp('');
  };

  const quitarEmpleado = (id) => {
    setEmpleadosSeleccionados(prev => prev.filter(e => e.id !== id));
  };

  const datosFiltrados = useMemo(() => {
    return registrosBase.filter(p => {
      const f = String(p.fecha_permiso || p.fecha_elaboracion || '').slice(0, 10);
      if (fechaInicio && f < fechaInicio) return false;
      if (fechaFin && f > fechaFin) return false;

      if (!coincidenClasificaciones(p, clasificacion)) return false;

      if (deptoId !== 'todos' && String(p.usuarios?.departamento_id) !== String(deptoId)) {
        return false;
      }

      if (tipoPermiso !== 'todos' && (p.tipo_permiso || '').toLowerCase() !== tipoPermiso) {
        return false;
      }

      if (dictamen !== 'todos') {
        if (dictamen === 'rechazado') {
          if (p.estado_general !== 'rechazado') return false;
        } else {
          if (p.estado_general === 'rechazado') return false;
          if (!(p.pago || '').toLowerCase().includes(dictamen.toLowerCase())) return false;
        }
      }

      if (empleadosSeleccionados.length > 0) {
        const uid = p.usuario_id || p.usuarios?.id || p.usuarios?.numero_empleado;
        const coincide = empleadosSeleccionados.some(
          sel => sel.id === uid || String(sel.numero) === String(p.usuarios?.numero_empleado)
        );
        if (!coincide) return false;
      }

      return true;
    });
  }, [registrosBase, fechaInicio, fechaFin, clasificacion, deptoId, tipoPermiso, dictamen, empleadosSeleccionados]);

  const descargarCSV = () => {
    if (datosFiltrados.length === 0) {
      alert('No hay registros que coincidan con los filtros seleccionados.');
      return;
    }

    setCargando(true);
    try {
      const encabezados = [
        'FOLIO', 'FECHA ELABORACION', 'NUM EMPLEADO', 'COLABORADOR',
        'NOMINA', 'DEPARTAMENTO', 'SUBAREA', 'PUESTO',
        'TIPO PERMISO', 'NATURALEZA', 'FECHA PERMISO', 'HORARIO SOLICITADO',
        'SALIDA REAL CASETA', 'ENTRADA REAL CASETA',
        'SUPERVISOR / JEFE', 'GERENCIA', 'RECURSOS HUMANOS',
        'DICTAMEN PAGO', 'ESTADO', 'MOTIVO'
      ];

      const filas = datosFiltrados.map(p => {
        const { horarioSolicitado, horaSalidaCaseta, horaEntradaCaseta, supervisorSubarea } = parsearDatosObservaciones(p.observaciones);
        const { categoria, texto: motivoLimpio } = limpiarMotivo(p.asunto_motivo);
        const jefeTxt = [supervisorSubarea, p.firmante1?.nombre_completo].filter(Boolean).join(' / ');

        return [
          `"${p.folio || ''}"`,
          `"${p.fecha_elaboracion || ''}"`,
          `"${p.usuarios?.numero_empleado || ''}"`,
          `"${p.usuarios?.nombre_completo || ''}"`,
          `"${p.usuarios?.tipo_personal || p.usuarios?.departamentos?.clasificacion || ''}"`,
          `"${p.usuarios?.departamentos?.nombre || ''}"`,
          `"${p.usuarios?.area || ''}"`,
          `"${p.usuarios?.puesto || ''}"`,
          `"${(p.tipo_permiso || '').toUpperCase()}"`,
          `"${categoria || 'General'}"`,
          `"${p.fecha_permiso || ''}${p.fecha_fin && p.fecha_fin !== p.fecha_permiso ? ' al ' + p.fecha_fin : ''}"`,
          `"${horarioSolicitado}"`,
          `"${horaSalidaCaseta || ''}"`,
          `"${horaEntradaCaseta || ''}"`,
          `"${jefeTxt}"`,
          `"${p.firmante2?.nombre_completo || ''}"`,
          `"${p.firmante3?.nombre_completo || ''}"`,
          `"${p.pago || ''}"`,
          `"${p.estado_general === 'rechazado' ? 'RECHAZADO' : 'AUTORIZADO'}"`,
          `"${(motivoLimpio || '').replace(/"/g, '""')}"`
        ];
      });

      const contenidoTexto = [encabezados.join(','), ...filas.map(f => f.join(','))].join('\n');
      const dataUri = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(contenidoTexto);

      const link = document.createElement('a');
      link.setAttribute('href', dataUri);
      link.setAttribute('download', `Reporte_Permisos_RH_${clasificacion}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      onClose();
    } catch (err) {
      console.error("Error exportando CSV:", err);
      alert("Error al generar el reporte.");
    } finally {
      setCargando(false);
    }
  };

  const bgCard = c?.surfaceCard || (modoOscuro ? '#18181b' : '#ffffff');
  const bgInput = c?.bg || (modoOscuro ? '#09090b' : '#f8fafc');
  const borderCol = c?.border || (modoOscuro ? '#27272a' : '#cbd5e1');
  const textMain = c?.text || (modoOscuro ? '#f8fafc' : '#0f172a');
  const textSub = c?.textMuted || (modoOscuro ? '#94a3b8' : '#475569');
  const accent = c?.accent || '#16a34a';

  const labelStyle = {
    fontWeight: '800',
    color: textSub,
    display: 'block',
    marginBottom: '7px',
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em'
  };

  const selectInputStyle = {
    width: '100%',
    minWidth: 0,
    maxWidth: '100%',
    height: '42px',
    padding: '0 12px',
    borderRadius: '10px',
    border: `1.5px solid ${borderCol}`,
    backgroundColor: bgInput,
    color: textMain,
    fontSize: '14px',
    fontWeight: '600',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit'
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(5px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 7000, padding: '14px',
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif', boxSizing: 'border-box'
    }}>
      <style>{`
        .modal-excel-card {
          background-color: ${bgCard};
          border: 1.5px solid ${borderCol};
          border-radius: 20px;
          width: 100%;
          max-width: 640px;
          padding: 28px 32px;
          box-shadow: 0 25px 60px rgba(0,0,0,0.55);
          color: ${textMain};
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          gap: 18px;
          max-height: 92vh;
          overflow-y: auto;
        }
        .excel-grid-4 {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
        }
        .excel-grid-2 {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }
        .excel-footer-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 4px;
          padding-top: 16px;
          border-top: 1.5px solid ${borderCol};
        }
        .excel-footer-btns {
          display: flex;
          gap: 10px;
        }
        @media (max-width: 640px) {
          .modal-excel-card {
            padding: 18px 16px;
            border-radius: 16px;
            gap: 14px;
          }
          .excel-grid-4 {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
          }
          .excel-grid-2 {
            grid-template-columns: minmax(0, 1fr);
            gap: 10px;
          }
          .excel-footer-row {
            flex-direction: column;
            align-items: stretch;
          }
          .excel-footer-btns {
            width: 100%;
          }
          .excel-footer-btns button {
            flex: 1;
            justify-content: center;
          }
        }
      `}</style>

      <div className="modal-excel-card">
        {/* CABECERA */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `1.5px solid ${borderCol}`, paddingBottom: '14px', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px', height: '42px', borderRadius: '11px',
              background: 'rgba(22, 163, 74, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              <FileSpreadsheet size={22} color={accent} />
            </div>
            <div>
              <h3 style={{ fontSize: '17.5px', fontWeight: '900', margin: 0, color: textMain, letterSpacing: '-0.01em' }}>
                Exportar Reporte (.CSV / Excel)
              </h3>
              <p style={{ fontSize: '12.5px', color: textSub, margin: '2px 0 0 0', fontWeight: '500' }}>
                Configura el corte por periodo, nómina, departamento o personal.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: bgInput, border: `1.5px solid ${borderCol}`, cursor: 'pointer',
              color: textSub, width: '34px', height: '34px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}
          >
            <X size={17} />
          </button>
        </div>

        {/* 1. PERIODO */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={labelStyle}>
              <Calendar size={13} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '5px' }} />
              1. Periodo del Reporte
            </label>
            <div className="excel-grid-4">
              {[
                { id: 'esta_semana', label: 'Esta Semana' },
                { id: 'este_mes', label: 'Este Mes' },
                { id: 'mes_anterior', label: 'Mes Anterior' },
                { id: 'historico_completo', label: 'Todo el Historial' }
              ].map((btn) => {
                const activo = rangoRapido === btn.id;
                return (
                  <button
                    key={btn.id}
                    type="button"
                    onClick={() => aplicarRangoRapido(btn.id)}
                    style={{
                      height: '38px', padding: '0 8px', borderRadius: '9px', fontSize: '12.5px', fontWeight: '800',
                      border: `1.5px solid ${activo ? accent : borderCol}`,
                      cursor: 'pointer',
                      backgroundColor: activo ? 'rgba(22, 163, 74, 0.12)' : bgInput,
                      color: activo ? accent : textSub
                    }}
                  >
                    {btn.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="excel-grid-2">
            <div>
              <span style={{ fontSize: '11px', color: textSub, fontWeight: '700', display: 'block', marginBottom: '4px' }}>
                DESDE FECHA (OPCIONAL)
              </span>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => { setFechaInicio(e.target.value); setRangoRapido('personalizado'); }}
                style={selectInputStyle}
              />
            </div>
            <div>
              <span style={{ fontSize: '11px', color: textSub, fontWeight: '700', display: 'block', marginBottom: '4px' }}>
                HASTA FECHA (OPCIONAL)
              </span>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => { setFechaFin(e.target.value); setRangoRapido('personalizado'); }}
                style={selectInputStyle}
              />
            </div>
          </div>
        </div>

        {/* 2. FILTROS ORGANIZACIONALES */}
        <div>
          <label style={labelStyle}>
            <Filter size={13} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '5px' }} />
            2. Filtros de Nómina, Área e Incidencia
          </label>
          <div className="excel-grid-2">
            <div>
              <span style={{ fontSize: '11px', color: textSub, fontWeight: '700', display: 'block', marginBottom: '4px' }}>TIPO DE NÓMINA</span>
              <select value={clasificacion} onChange={(e) => setClasificacion(e.target.value)} style={selectInputStyle}>
                <option value="todas">Todas las Nóminas</option>
                <option value="Producción">Nómina Producción</option>
                <option value="Administración">Nómina Administración</option>
                <option value="Obra">Nómina Obra</option>
              </select>
            </div>

            <div>
              <span style={{ fontSize: '11px', color: textSub, fontWeight: '700', display: 'block', marginBottom: '4px' }}>DEPARTAMENTO</span>
              <select value={deptoId} onChange={(e) => setDeptoId(e.target.value)} style={selectInputStyle}>
                <option value="todos">Todos los Departamentos</option>
                {departamentos.map(d => (
                  <option key={d.id} value={d.id}>{d.nombre}</option>
                ))}
              </select>
            </div>

            <div>
              <span style={{ fontSize: '11px', color: textSub, fontWeight: '700', display: 'block', marginBottom: '4px' }}>TIPO DE PERMISO</span>
              <select value={tipoPermiso} onChange={(e) => setTipoPermiso(e.target.value)} style={selectInputStyle}>
                <option value="todos">Todos los Tipos</option>
                <option value="salida">Salidas Anticipadas</option>
                <option value="retardo">Retardos</option>
                <option value="falta">Faltas</option>
                <option value="vacaciones">Vacaciones</option>
              </select>
            </div>

            <div>
              <span style={{ fontSize: '11px', color: textSub, fontWeight: '700', display: 'block', marginBottom: '4px' }}>DICTAMEN DE PAGO</span>
              <select value={dictamen} onChange={(e) => setDictamen(e.target.value)} style={selectInputStyle}>
                <option value="todos">Todos los Dictámenes</option>
                <option value="Con goce">Con Goce de Sueldo</option>
                <option value="Sin goce">Sin Goce de Sueldo</option>
                <option value="tiempo">Reposición de Tiempo</option>
                <option value="regresa">Regresados a Casa</option>
                <option value="rechazado">Rechazados</option>
              </select>
            </div>
          </div>
        </div>

        {/* 3. SELECCIÓN DE PERSONAL */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px', marginBottom: '6px' }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>
              <Users size={13} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '5px' }} />
              3. Alcance de Colaboradores
            </label>
            <span style={{ fontSize: '11.5px', fontWeight: '700', color: empleadosSeleccionados.length === 0 ? accent : textSub }}>
              {empleadosSeleccionados.length === 0 ? '✓ Toda la plantilla filtrada' : `${empleadosSeleccionados.length} seleccionado(s)`}
            </span>
          </div>

          {empleadosSeleccionados.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
              {empleadosSeleccionados.map(emp => (
                <span
                  key={emp.id}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: '700',
                    background: 'rgba(22, 163, 74, 0.12)', color: accent, border: '1px solid rgba(22, 163, 74, 0.3)'
                  }}
                >
                  <span>#{emp.numero} {emp.nombre}</span>
                  <button
                    type="button"
                    onClick={() => quitarEmpleado(emp.id)}
                    style={{ background: 'transparent', border: 'none', color: accent, cursor: 'pointer', padding: 0, display: 'flex' }}
                  >
                    <X size={13} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '13px', color: textSub }} />
            <input
              type="text"
              placeholder="Vacío = TODOS, o escribe para agregar empleados..."
              value={busquedaEmp}
              onChange={(e) => setBusquedaEmp(e.target.value)}
              style={{ ...selectInputStyle, paddingLeft: '36px', fontSize: '13px' }}
            />
          </div>

          {sugerenciasColaboradores.length > 0 && (
            <div style={{
              marginTop: '6px', borderRadius: '10px', border: `1.5px solid ${borderCol}`,
              background: bgCard, overflow: 'hidden'
            }}>
              {sugerenciasColaboradores.map(emp => (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => agregarEmpleado(emp)}
                  style={{
                    width: '100%', padding: '9px 12px', border: 'none', borderBottom: `1px solid ${borderCol}`,
                    background: 'transparent', color: textMain, textAlign: 'left', cursor: 'pointer',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px'
                  }}
                >
                  <span><strong>#{emp.numero}</strong> — {emp.nombre}</span>
                  <span style={{ fontSize: '11.5px', color: accent, fontWeight: '700' }}>+ Agregar</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* PIE DEL MODAL */}
        <div className="excel-footer-row">
          <div style={{ fontSize: '13px', fontWeight: '700', color: textSub }}>
            Registros encontrados:{' '}
            <strong style={{ color: datosFiltrados.length > 0 ? accent : '#ef4444', fontSize: '14.5px' }}>
              {datosFiltrados.length}
            </strong>
          </div>

          <div className="excel-footer-btns">
            <button
              type="button"
              onClick={onClose}
              style={{
                height: '42px', padding: '0 18px', borderRadius: '10px', border: `1.5px solid ${borderCol}`,
                background: 'transparent', color: textSub, fontSize: '14px', fontWeight: '700', cursor: 'pointer'
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={descargarCSV}
              disabled={cargando || datosFiltrados.length === 0}
              style={{
                height: '42px', padding: '0 20px', borderRadius: '10px', border: 'none',
                backgroundColor: datosFiltrados.length === 0 ? borderCol : accent,
                color: '#ffffff', fontSize: '14px', fontWeight: '800',
                cursor: (cargando || datosFiltrados.length === 0) ? 'not-allowed' : 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: '7px'
              }}
            >
              <Download size={16} />
              {cargando ? 'Generando...' : `Descargar (${datosFiltrados.length})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
