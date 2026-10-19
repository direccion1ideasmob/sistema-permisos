import React, { useState, useEffect } from 'react';
import { X, FileSpreadsheet, Download, Search } from 'lucide-react';
import { supabase } from '../../../core/api/supabaseClient';
import { parsearDatosObservaciones, limpiarMotivo } from './TablaHistorial';

export default function ModalExportarExcel({ onClose }) {
  const [cargando, setCargando] = useState(false);
  const [rangoRapido, setRangoRapido] = useState('historico_completo');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [clasificacion, setClasificacion] = useState('todas');
  const [dictamen, setDictamen] = useState('todos');
  const [empleadoBusqueda, setEmpleadoBusqueda] = useState('');

  const aplicarRangoRapido = (tipo) => {
    setRangoRapido(tipo);
    const hoy = new Date();
    let inicio = new Date();
    let fin = new Date();

    if (tipo === 'esta_semana') {
      const diaSemana = hoy.getDay() || 7;
      inicio.setDate(hoy.getDate() - diaSemana + 1);
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

  useEffect(() => {
    aplicarRangoRapido('historico_completo');
  }, []);

  const coincidenClasificaciones = (clasifBD = '', clasifSeleccionada = '') => {
    if (clasifSeleccionada === 'todas') return true;
    const normBD = clasifBD.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const normSel = clasifSeleccionada.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    if (normBD.startsWith('admin') && normSel.startsWith('admin')) return true;
    if (normBD.startsWith('produc') && normSel.startsWith('produc')) return true;
    if (normBD.startsWith('obra') && normSel.startsWith('obra')) return true;
    return normBD.includes(normSel) || normSel.includes(normBD);
  };

  const generarReporteIndependiente = async () => {
    setCargando(true);
    try {
      let query = supabase
        .from('permisos')
        .select(`
          *,
          usuarios:usuario_id (
            numero_empleado, nombre_completo, area, puesto, tipo_personal, departamento_id,
            departamentos:departamento_id (nombre, clasificacion),
            sedes:sede_id (nombre)
          ),
          firmante1:firma_1_id (nombre_completo),
          firmante2:firma_2_id (nombre_completo),
          firmante3:firma_3_id (nombre_completo)
        `)
        .in('estado_general', ['autorizado', 'aprobado', 'completado_caseta', 'rechazado'])
        .order('created_at', { ascending: false });

      if (fechaInicio) query = query.gte('fecha_permiso', fechaInicio);
      if (fechaFin) query = query.lte('fecha_permiso', fechaFin);

      const { data, error } = await query;
      if (error) throw error;

      let datos = data || [];

      if (clasificacion !== 'todas') {
        datos = datos.filter(p =>
          coincidenClasificaciones(p.usuarios?.tipo_personal || p.usuarios?.departamentos?.clasificacion || '', clasificacion)
        );
      }

      if (dictamen !== 'todos') {
        datos = datos.filter(p => (p.pago || '').toLowerCase().includes(dictamen.toLowerCase()));
      }

      if (empleadoBusqueda.trim() !== '') {
        const b = empleadoBusqueda.toLowerCase().trim();
        datos = datos.filter(p =>
          (p.usuarios?.nombre_completo || '').toLowerCase().includes(b) ||
          String(p.usuarios?.numero_empleado || '').toLowerCase().includes(b)
        );
      }

      if (datos.length === 0) {
        alert('No hay registros que coincidan con estos filtros.');
        setCargando(false);
        return;
      }

      const encabezados = [
        'FOLIO', 'FECHA ELABORACION', 'NUM EMPLEADO', 'COLABORADOR',
        'NOMINA', 'DEPARTAMENTO', 'SUBAREA', 'PUESTO',
        'TIPO PERMISO', 'FECHA PERMISO', 'HORARIO SOLICITADO',
        'SALIDA REAL CASETA', 'ENTRADA REAL CASETA',
        'SUPERVISOR / JEFE', 'GERENCIA', 'RECURSOS HUMANOS',
        'DICTAMEN PAGO', 'ESTADO', 'MOTIVO'
      ];

      const filas = datos.map(p => {
        const { horarioSolicitado, horaSalidaCaseta, horaEntradaCaseta, supervisorSubarea } = parsearDatosObservaciones(p.observaciones);
        const { texto: motivoLimpio } = limpiarMotivo(p.asunto_motivo);
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
          `"${p.tipo_permiso || ''}"`,
          `"${p.fecha_permiso || ''}${p.fecha_fin && p.fecha_fin !== p.fecha_permiso ? ' al ' + p.fecha_fin : ''}"`,
          `"${horarioSolicitado}"`,
          `"${horaSalidaCaseta || ''}"`,
          `"${horaEntradaCaseta || ''}"`,
          `"${jefeTxt}"`,
          `"${p.firmante2?.nombre_completo || ''}"`,
          `"${p.firmante3?.nombre_completo || ''}"`,
          `"${p.pago || ''}"`,
          `"${p.estado_general === 'rechazado' ? 'RECHAZADO' : 'AUTORIZADO'}"`,
          `"${motivoLimpio.replace(/"/g, '""')}"`
        ];
      });

      const contenidoTexto = [encabezados.join(','), ...filas.map(f => f.join(','))].join('\n');
      const dataUri = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(contenidoTexto);

      const link = document.createElement('a');
      link.setAttribute('href', dataUri);
      link.setAttribute('download', `Reporte_RH_${clasificacion}_${new Date().toISOString().split('T')[0]}.csv`);
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

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 7000, padding: '16px'
    }}>
      <div style={{
        backgroundColor: '#ffffff', borderRadius: '12px', width: '100%', maxWidth: '520px',
        padding: '20px', boxShadow: '0 20px 40px rgba(0,0,0,0.3)', color: '#0f172a'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#16a34a' }}>
            <FileSpreadsheet size={20} />
            <h3 style={{ fontSize: '15px', fontWeight: '800', margin: 0 }}>Exportar Reporte Excel (.CSV)</h3>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '12.5px' }}>
          <div>
            <label style={{ fontWeight: '800', color: '#475569', display: 'block', marginBottom: '5px', fontSize: '11px' }}>COLABORADOR (Opcional)</label>
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '9px', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Nombre o # de empleado..."
                value={empleadoBusqueda}
                onChange={(e) => setEmpleadoBusqueda(e.target.value)}
                style={{ width: '100%', padding: '8px 10px 8px 32px', borderRadius: '7px', border: '1px solid #cbd5e1', fontSize: '12.5px', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontWeight: '800', color: '#475569', display: 'block', marginBottom: '5px', fontSize: '11px' }}>PERIODO</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
              {[
                { id: 'esta_semana', label: 'Semana' },
                { id: 'este_mes', label: 'Este Mes' },
                { id: 'mes_anterior', label: 'Mes Ant.' },
                { id: 'historico_completo', label: 'Todo' }
              ].map((btn) => (
                <button
                  key={btn.id}
                  onClick={() => aplicarRangoRapido(btn.id)}
                  style={{
                    padding: '7px 8px', borderRadius: '6px', fontSize: '11.5px', fontWeight: '700',
                    border: '1px solid', cursor: 'pointer',
                    borderColor: rangoRapido === btn.id ? '#16a34a' : '#cbd5e1',
                    backgroundColor: rangoRapido === btn.id ? '#f0fdf4' : '#f8fafc',
                    color: rangoRapido === btn.id ? '#16a34a' : '#475569'
                  }}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '700', display: 'block', marginBottom: '4px' }}>DESDE</span>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => { setFechaInicio(e.target.value); setRangoRapido('personalizado'); }}
                style={{ width: '100%', padding: '7px 9px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '700', display: 'block', marginBottom: '4px' }}>HASTA</span>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => { setFechaFin(e.target.value); setRangoRapido('personalizado'); }}
                style={{ width: '100%', padding: '7px 9px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontWeight: '800', color: '#475569', display: 'block', marginBottom: '4px', fontSize: '10.5px' }}>NÓMINA</label>
              <select
                value={clasificacion}
                onChange={(e) => setClasificacion(e.target.value)}
                style={{ width: '100%', padding: '7px 9px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
              >
                <option value="todas">Todas</option>
                <option value="Producción">Producción</option>
                <option value="Administración">Administración</option>
                <option value="Obra">Obra</option>
              </select>
            </div>
            <div>
              <label style={{ fontWeight: '800', color: '#475569', display: 'block', marginBottom: '4px', fontSize: '10.5px' }}>DICTAMEN</label>
              <select
                value={dictamen}
                onChange={(e) => setDictamen(e.target.value)}
                style={{ width: '100%', padding: '7px 9px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
              >
                <option value="todos">Todos</option>
                <option value="Con Goce">Con Goce de Sueldo</option>
                <option value="Sin Goce">Sin Goce de Sueldo</option>
                <option value="Tiempo">Reposición de Tiempo</option>
              </select>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '18px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
          <button
            onClick={onClose}
            style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
          >
            Cancelar
          </button>
          <button
            onClick={generarReporteIndependiente}
            disabled={cargando}
            style={{
              padding: '8px 16px', borderRadius: '6px', border: 'none',
              backgroundColor: '#16a34a', color: '#ffffff', fontSize: '12px', fontWeight: '800',
              cursor: cargando ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <Download size={14} /> {cargando ? 'Generando...' : 'Descargar CSV'}
          </button>
        </div>
      </div>
    </div>
  );
}
