import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { X, Save, Factory, Building2, HardHat } from 'lucide-react';
import { estandarizar } from '../utils/directorioHelpers';

export default function ModalGestionDepto({ deptoEditando, onClose, onSuccess, modoOscuro }) {
  const [nombre, setNombre] = useState(deptoEditando?.nombre || '');
  // Usa estrictamente el valor guardado en Supabase ('produccion', 'administrativo', 'obra')
  const [clasificacion, setClasificacion] = useState(
    (deptoEditando?.clasificacion || 'produccion').toLowerCase().trim()
  );
  const [guardando, setGuardando] = useState(false);

  const esEdicion = Boolean(deptoEditando?.id);

  const c = {
    modalBg: modoOscuro ? '#09090b' : '#ffffff',
    border: modoOscuro ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    textPrimary: modoOscuro ? '#ffffff' : '#09090b',
    textSecondary: modoOscuro ? '#a1a1aa' : '#64748b',
    inputBg: modoOscuro ? '#18181b' : '#f8fafc',
    inputBorder: modoOscuro ? 'rgba(255, 255, 255, 0.15)' : '#cbd5e1',
    accent: '#16a34a'
  };

  const guardar = async (e) => {
    e.preventDefault();
    if (!nombre.trim()) return alert("Por favor ingresa un nombre para el departamento.");

    setGuardando(true);
    const nombreLimpio = estandarizar(nombre);
    const clasifLimpia = clasificacion.toLowerCase().trim();

    try {
      if (esEdicion) {
        const { data, error } = await supabase
          .from('departamentos')
          .update({ 
            nombre: nombreLimpio, 
            clasificacion: clasifLimpia 
          })
          .eq('id', deptoEditando.id)
          .select();

        if (error) throw error;
        if (!data || data.length === 0) {
          throw new Error("Supabase no permitió actualizar la fila. Verifica las políticas RLS.");
        }
      } else {
        const { data, error } = await supabase
          .from('departamentos')
          .insert([{ 
            nombre: nombreLimpio, 
            clasificacion: clasifLimpia 
          }])
          .select();

        if (error) throw error;
        if (!data || data.length === 0) {
          throw new Error("Supabase no permitió insertar el registro.");
        }
      }

      onSuccess();
    } catch (err) {
      alert("Error al guardar en Supabase: " + err.message);
    } finally {
      setGuardando(false);
    }
  };

  const opciones = [
    { key: 'produccion', label: 'Producción / Taller', icon: Factory },
    { key: 'administrativo', label: 'Administrativo / Oficina', icon: Building2 },
    { key: 'obra', label: 'Obra / Campo', icon: HardHat }
  ];

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 4500, padding: '16px'
    }}>
      <div style={{
        backgroundColor: c.modalBg,
        border: `1px solid ${c.border}`,
        borderRadius: '16px',
        width: '100%', maxWidth: '400px',
        padding: '22px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: c.textPrimary }}>
            {esEdicion ? 'Editar Departamento' : 'Nuevo Departamento'}
          </h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: c.textSecondary, cursor: 'pointer' }}>
            <X size={17} />
          </button>
        </div>

        <form onSubmit={guardar} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '10.5px', fontWeight: '800', color: c.textSecondary, textTransform: 'uppercase', marginBottom: '5px' }}>
              Nombre del Departamento
            </label>
            <input 
              type="text" 
              value={nombre} 
              onChange={e => setNombre(e.target.value)}
              autoFocus
              style={{
                width: '100%', padding: '9px 11px', borderRadius: '7px',
                backgroundColor: c.inputBg, color: c.textPrimary,
                border: `1px solid ${c.inputBorder}`, outline: 'none',
                fontSize: '12.5px', boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '10.5px', fontWeight: '800', color: c.textSecondary, textTransform: 'uppercase', marginBottom: '6px' }}>
              Clasificación en la Estructura
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {opciones.map(op => {
                const Icono = op.icon;
                const seleccionada = clasificacion === op.key;
                return (
                  <div 
                    key={op.key}
                    onClick={() => setClasificacion(op.key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '9px 12px', borderRadius: '8px',
                      border: seleccionada ? `1.5px solid ${c.accent}` : `1px solid ${c.border}`,
                      backgroundColor: seleccionada ? (modoOscuro ? 'rgba(22, 163, 74, 0.15)' : 'rgba(22, 163, 74, 0.08)') : 'transparent',
                      cursor: 'pointer', transition: 'all 0.15s ease'
                    }}
                  >
                    <Icono size={15} color={seleccionada ? c.accent : c.textSecondary} />
                    <span style={{ fontSize: '12px', fontWeight: seleccionada ? '800' : '500', color: seleccionada ? c.accent : c.textPrimary }}>
                      {op.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
            <button 
              type="button" 
              onClick={onClose}
              style={{
                padding: '8px 12px', borderRadius: '7px', border: `1px solid ${c.border}`,
                backgroundColor: 'transparent', color: c.textSecondary,
                fontSize: '11.5px', fontWeight: '600', cursor: 'pointer'
              }}
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={guardando}
              style={{
                padding: '8px 15px', borderRadius: '7px', border: 'none',
                backgroundColor: c.accent, color: '#ffffff',
                fontSize: '11.5px', fontWeight: '800', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '5px'
              }}
            >
              <Save size={13} /> {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}