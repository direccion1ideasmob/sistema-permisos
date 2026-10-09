import React, { useState, useEffect } from 'react';
import { X, FileSpreadsheet, Download, Search } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';

export default function ModalExportarExcel({ onClose }) {
  const [cargando, setCargando] = useState(false);
  
  // 1. ESTADO DE FECHAS
  const [rangoRapido, setRangoRapido] = useState('historico_completo');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  
  // 2. ESTADO DE FILTROS AVANZADOS
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
    } else if (tipo === 'historico_completo') {
      setFechaInicio('');
      setFechaFin('');
    }
  };

  useEffect(() => {
    aplicarRangoRapido('historico_completo');
  }, []);

  // Normalizador para empatar "ADMINISTRATIVO" con "Administración", etc.
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
      // Consulta directa a Supabase (independiente de los filtros de la tabla)
      let query = supabase
        .from('permisos')
        .select(`
          *,
          usuarios:usuario_id (
            numero_empleado, nombre_completo, area, puesto, departamento_id,
            departamentos:departamento_id (nombre, clasificacion),
            sedes:sede_id (nombre)
          )
        `)
        .order('created_at', { ascending: false });

      if (fechaInicio) query = query.gte('fecha_permiso', fechaInicio);
      if (fechaFin) query = query.lte('fecha_permiso', fechaFin);

      const { data, error } = await query;
      if (error) throw error;

      let datos = data || [];

      // 1. Filtrar por clasificación con normalización de sinónimos
      if (clasificacion !== 'todas') {
        datos = datos.filter(p => 
          coincidenClasificaciones(p.usuarios?.departamentos?.clasificacion || '', clasificacion)
        );
      }

      // 2. Filtrar por dictamen de pago
      if (dictamen !== 'todos') {
        datos = datos.filter(p => 
          (p.pago || '').toLowerCase().includes(dictamen.toLowerCase())
        );
      }

      // 3. Filtrar por búsqueda por persona
      if (empleadoBusqueda.trim() !== '') {
        const busqueda = empleadoBusqueda.toLowerCase().trim();
        datos = datos.filter(p => 
          (p.usuarios?.nombre_completo || '').toLowerCase().includes(busqueda) ||
          (p.usuarios?.numero_empleado || '').toLowerCase().includes(busqueda)
        );
      }

      if (datos.length === 0) {
        alert('No hay registros en la Base de Datos que coincidan con estos filtros específicos.');
        setCargando(false);
        return;
      }

      // Generar archivo CSV
      const encabezados = [
        'FOLIO', 'FECHA ELABORACION', 'NUM EMPLEADO', 'COLABORADOR', 
        'CLASIFICACION', 'DEPARTAMENTO', 'AREA', 'PUESTO', 'SEDE', 
        'TIPO PERMISO', 'FECHA INICIO', 'FECHA FIN', 'DURACION', 
        'SALIDA CASETA', 'RETORNO CASETA', 'DICTAMEN PAGO', 'ESTADO', 'MOTIVO'
      ];

      const filas = datos.map(p => {
        const motivoLimpio = (p.asunto_motivo || '').replace(/^(\[\vert{}\{)(.*?)(\]|\})\s*/, '');
        return [
          `"${p.folio || ''}"`,
          `"${p.fecha_elaboracion || ''}"`,
          `"${p.usuarios?.numero_empleado || ''}"`,
          `"${p.usuarios?.nombre_completo || ''}"`,
          `"${p.usuarios?.departamentos?.clasificacion || ''}"`,
          `"${p.usuarios?.departamentos?.nombre || ''}"`,
          `"${p.usuarios?.area || ''}"`,
          `"${p.usuarios?.puesto || ''}"`,
          `"${p.usuarios?.sedes?.nombre || ''}"`,
          `"${p.tipo_permiso || ''}"`,
          `"${p.fecha_permiso || ''}"`,
          `"${p.fecha_fin || p.fecha_permiso || ''}"`,
          `"${p.total_horas || 0} HR(S)"`,
          `"${p.hora_salida_caseta ? new Date(p.hora_salida_caseta).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}"`,
          `"${p.hora_llegada_caseta ? new Date(p.hora_llegada_caseta).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}"`,
          `"${p.pago || ''}"`,
          `"${p.estado_general || ''}"`,
          `"${motivoLimpio.replace(/"/g, '""')}"`
        ];
      });

      // CÓDIGO CON DATA URI (Sin advertencias de blob en HTTP)
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
      console.error("Error consultando BD:", err);
      alert("Error al generar el reporte desde la Base de Datos.");
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
        backgroundColor: '#ffffff', borderRadius: '12px', width: '100%', maxWidth: '560px', 
        padding: '22px', boxShadow: '0 20px 40px rgba(0,0,0,0.3)', color: '#0f172a'
      }}>
        
        {/* ENCABEZADO */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#16a34a' }}>
            <FileSpreadsheet size={24} />
            <h3 style={{ fontSize: '17px', fontWeight: '800', margin: 0 }}>Exportar Reporte Excel (.CSV)</h3>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}>
            <X size={22} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px' }}>
          
          {/* BUSCADOR POR PERSONA */}
          <div>
            <label style={{ fontWeight: '800', color: '#475569', display: 'block', marginBottom: '6px' }}>POR PERSONA (Opcional)</label>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '9px', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Escribe el nombre o # de empleado..."
                value={empleadoBusqueda}
                onChange={(e) => setEmpleadoBusqueda(e.target.value)}
                style={{ width: '100%', padding: '8px 10px 8px 32px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* RANGOS RÁPIDOS */}
          <div>
            <label style={{ fontWeight: '800', color: '#475569', display: 'block', marginBottom: '6px' }}>PERIODO</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
              {[
                { id: 'esta_semana', label: 'Esta Semana' },
                { id: 'este_mes', label: 'Este Mes' },
                { id: 'mes_anterior', label: 'Mes Anterior' },
                { id: 'historico_completo', label: 'Todo el Histórico' }
              ].map((btn) => (
                <button
                  key={btn.id}
                  onClick={() => aplicarRangoRapido(btn.id)}
                  style={{
                    padding: '8px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '700',
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

          {/* FECHAS DESDE/HASTA */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', display: 'block', marginBottom: '4px' }}>FECHA INICIO</span>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => { setFechaInicio(e.target.value); setRangoRapido('personalizado'); }}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', display: 'block', marginBottom: '4px' }}>FECHA FIN</span>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => { setFechaFin(e.target.value); setRangoRapido('personalizado'); }}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* FILTROS EXTRAS */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontWeight: '800', color: '#475569', display: 'block', marginBottom: '4px' }}>CLASIFICACIÓN (ÁREA)</label>
              <select
                value={clasificacion}
                onChange={(e) => setClasificacion(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              >
                <option value="todas">Todas</option>
                <option value="Administración">Administración</option>
                <option value="Producción">Producción</option>
                <option value="Obra">Obra</option>
              </select>
            </div>
            <div>
              <label style={{ fontWeight: '800', color: '#475569', display: 'block', marginBottom: '4px' }}>DICTAMEN NÓMINA</label>
              <select
                value={dictamen}
                onChange={(e) => setDictamen(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              >
                <option value="todos">Todos</option>
                <option value="Con Goce">Con Goce de Sueldo</option>
                <option value="Sin Goce">Sin Goce de Sueldo</option>
                <option value="Tiempo">Reposición de Tiempo</option>
              </select>
            </div>
          </div>
        </div>

        {/* BOTONES FINALES */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '22px', paddingTop: '14px', borderTop: '1px solid #e2e8f0' }}>
          <button
            onClick={onClose}
            style={{ padding: '10px 18px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', fontWeight: '800', cursor: 'pointer' }}
          >
            Cancelar
          </button>
          <button
            onClick={generarReporteIndependiente}
            disabled={cargando}
            style={{
              padding: '10px 20px', borderRadius: '6px', border: 'none',
              backgroundColor: '#16a34a', color: '#ffffff', fontWeight: '800',
              cursor: cargando ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
            }}
          >
            <Download size={16} /> {cargando ? 'Consultando BD...' : 'Descargar Excel'}
          </button>
        </div>

      </div>
    </div>
  );
}