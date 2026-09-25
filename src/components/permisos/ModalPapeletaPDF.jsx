import React from 'react';
import { X, Printer } from 'lucide-react';

export default function ModalPapeletaPDF({ permiso, onClose }) {
  if (!permiso) return null;

  const imprimir = () => {
    window.print();
  };

  const tipo = (permiso.tipo_permiso || '').toLowerCase();
  const esDiaCompleto = tipo === 'falta' || tipo === 'vacaciones';

  // Resolución de Nómina
  const getDictamenPago = () => {
    const p = (permiso.pago || '').toLowerCase();
    if (p.includes('con goce')) return 'CON GOCE DE SUELDO';
    if (p.includes('sin goce')) return 'SIN GOCE DE SUELDO';
    if (p.includes('tiempo')) return 'REPOSICIÓN DE TIEMPO';
    return 'PENDIENTE DE DICTAMEN';
  };

  // Duración limpia: sin la palabra "solicitadas"
  const getTextoTiempo = () => {
    if (esDiaCompleto) {
      if (tipo === 'vacaciones') {
        return 'JORNADA COMPLETA (VACACIONES)';
      }
      return 'JORNADA COMPLETA';
    }
    return `${permiso.total_horas || 0} HR(S)`;
  };

  // Limpieza del motivo
  const procesarMotivo = (textoCrudo = '') => {
    const match = textoCrudo.match(/^(\[|\{)(.*?)(\]|\})\s*(.*)$/);
    if (match) {
      return {
        etiqueta: match[2].trim(),
        redaccion: match[4].trim()
      };
    }
    return {
      etiqueta: null,
      redaccion: textoCrudo.trim()
    };
  };

  const { etiqueta: categoriaAsunto, redaccion: justificacionLimpia } = procesarMotivo(permiso.asunto_motivo);

  // Render de firma tradicional
  const renderFirmaTradicional = (cargo, nombre, firmaUrl, estado, esSolicitante = false) => {
    const firmado = esSolicitante || estado === 'autorizado' || estado === 'aprobado';
    const rechazado = estado === 'rechazado';

    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        alignItems: 'center',
        textAlign: 'center',
        height: '72px',
        boxSizing: 'border-box'
      }}>
        {/* IMAGEN DE FIRMA REAL */}
        <div style={{ height: '38px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', width: '100%', marginBottom: '3px' }}>
          {firmado && firmaUrl ? (
            <img 
              src={firmaUrl} 
              alt="Firma" 
              style={{ maxHeight: '36px', maxWidth: '85%', objectFit: 'contain' }} 
            />
          ) : firmado ? (
            <span style={{ fontSize: '9px', fontWeight: '800', color: '#16a34a' }}>
              ✓ FIRMA DIGITAL
            </span>
          ) : rechazado ? (
            <span style={{ fontSize: '9px', fontWeight: '800', color: '#dc2626' }}>
              ✗ RECHAZADO
            </span>
          ) : (
            <span style={{ fontSize: '9px', color: '#94a3b8', fontStyle: 'italic' }}>
              Pendiente
            </span>
          )}
        </div>

        {/* LÍNEA Y NOMBRE */}
        <div style={{ width: '90%', borderTop: '1px solid #475569', paddingTop: '3px' }}>
          <div style={{ fontSize: '10px', fontWeight: '800', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {nombre || 'Por asignar'}
          </div>
          <div style={{ fontSize: '8.5px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '1px' }}>
            {cargo}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 6000, padding: '16px', boxSizing: 'border-box'
    }}>
      <style>{`
        /* IMPRESIÓN EXACTA EN MEDIA CARTA (216mm x 140mm) */
        @media print {
          @page {
            size: letter portrait;
            margin: 0;
          }
          html, body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          body * {
            visibility: hidden !important;
          }
          #papeleta-impresion-oficial, #papeleta-impresion-oficial * {
            visibility: visible !important;
          }
          #papeleta-impresion-oficial {
            position: absolute !important;
            left: 10mm !important;
            top: 8mm !important;
            width: calc(100% - 20mm) !important;
            max-width: 196mm !important;
            height: 125mm !important;
            max-height: 127mm !important;
            box-shadow: none !important;
            border: 1px solid #94a3b8 !important;
            border-radius: 6px !important;
            padding: 8mm 12mm !important;
            margin: 0 !important;
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      <div style={{
        backgroundColor: '#ffffff', color: '#0f172a',
        borderRadius: '14px', width: '100%', maxWidth: '750px',
        maxHeight: '94vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 60px rgba(0,0,0,0.6)', overflow: 'hidden'
      }}>
        
        {/* BARRA SUPERIOR (NO SE IMPRIME) */}
        <div className="no-print" style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 18px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc'
        }}>
          <span style={{ fontSize: '12px', fontWeight: '800', color: '#16a34a' }}>
            FORMATO OFICIAL • {permiso.folio}
          </span>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={imprimir}
              style={{
                padding: '6px 14px', borderRadius: '6px', border: 'none',
                backgroundColor: '#16a34a', color: '#fff', fontSize: '11.5px', fontWeight: '800',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px'
              }}
            >
              <Printer size={14} /> Imprimir / Guardar PDF
            </button>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* CONTENEDOR CON SCROLL */}
        <div style={{ padding: '20px', overflowY: 'auto', background: '#f1f5f9' }}>
          
          <div 
            id="papeleta-impresion-oficial"
            style={{
              background: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              padding: '16px 20px 14px 20px',
              boxSizing: 'border-box',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: '125mm'
            }}
          >
            {/* BANDA 1: MEMBRETE */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '130px 1fr 130px',
              alignItems: 'center',
              borderBottom: '1.5px solid #0f172a',
              paddingBottom: '8px',
              marginBottom: '8px'
            }}>
              {/* IZQUIERDA: LOGO */}
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <img 
                  src="/LogoVerde-removebg-preview.png" 
                  alt="Logo" 
                  style={{ height: '36px', maxWidth: '120px', objectFit: 'contain' }} 
                />
              </div>

              {/* CENTRO: TÍTULO Y SUBTÍTULO */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '15.5px', fontWeight: '900', letterSpacing: '0.04em', color: '#0f172a' }}>
                  IDEAS MOBILIARIUM
                </div>
                <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '600', letterSpacing: '0.02em', marginTop: '2px' }}>
                  Formato control de permisos
                </div>
              </div>

              {/* DERECHA: FOLIO Y FECHA */}
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontFamily: 'ui-monospace, monospace', fontSize: '13px', fontWeight: '900',
                  color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0',
                  padding: '3px 8px', borderRadius: '4px', display: 'inline-block'
                }}>
                  {permiso.folio}
                </div>
                <div style={{ fontSize: '9.5px', color: '#64748b', marginTop: '3px' }}>
                  Elaboración: <strong>{permiso.fecha_elaboracion || 'N/A'}</strong>
                </div>
              </div>
            </div>

            {/* BANDA 2: FICHA DEL TRABAJADOR */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1.8fr 1fr 1.1fr 0.8fr', gap: '10px',
              padding: '7px 10px', background: '#f8fafc', border: '1px solid #e2e8f0',
              borderRadius: '6px', marginBottom: '8px', fontSize: '11px'
            }}>
              <div style={{ minWidth: 0, paddingRight: '6px' }}>
                <span style={{ fontSize: '8.5px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>COLABORADOR</span>
                <strong style={{ fontSize: '12px', color: '#0f172a', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {permiso.usuarios?.nombre_completo || 'N/A'}
                </strong>
                <span style={{ fontSize: '10px', color: '#16a34a', fontWeight: '800' }}>#{permiso.usuarios?.numero_empleado}</span>
              </div>
              <div style={{ minWidth: 0 }}>
                <span style={{ fontSize: '8.5px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>DEPARTAMENTO</span>
                <span style={{ fontWeight: '700', fontSize: '11px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {permiso.usuarios?.departamentos?.nombre || 'GENERAL'}
                </span>
                <span style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase' }}>{permiso.usuarios?.departamentos?.clasificacion || ''}</span>
              </div>
              <div style={{ minWidth: 0 }}>
                <span style={{ fontSize: '8.5px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>ÁREA Y PUESTO</span>
                <span style={{ fontWeight: '600', fontSize: '11px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {permiso.usuarios?.area || 'GENERAL'}
                </span>
                <span style={{ fontSize: '9.5px', color: '#64748b', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {permiso.usuarios?.puesto || 'Sin puesto'}
                </span>
              </div>
              <div style={{ minWidth: 0 }}>
                <span style={{ fontSize: '8.5px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>SEDE</span>
                <span style={{ fontWeight: '700', fontSize: '11px', color: '#0f172a', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {permiso.usuarios?.sedes?.nombre || 'SANTA CATARINA'}
                </span>
              </div>
            </div>

            {/* BANDA 3: DATOS DE LA INCIDENCIA (DURACIÓN LIMPIA) */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px',
              padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: '6px',
              marginBottom: '8px', fontSize: '11px'
            }}>
              <div>
                <span style={{ fontSize: '8.5px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>TIPO DE PERMISO</span>
                <strong style={{ textTransform: 'uppercase', color: '#0f172a', fontSize: '11px' }}>{permiso.tipo_permiso || 'Pase'}</strong>
              </div>
              <div>
                <span style={{ fontSize: '8.5px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>FECHA DE APLICACIÓN</span>
                <strong style={{ color: '#16a34a', fontSize: '11px' }}>
                  {permiso.fecha_permiso} {permiso.fecha_fin && ` al ${permiso.fecha_fin}`}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: '8.5px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>DURACIÓN</span>
                <strong style={{ color: esDiaCompleto ? '#0f172a' : '#16a34a', fontSize: '11px' }}>
                  {getTextoTiempo()}
                </strong>
                {permiso.observaciones && !esDiaCompleto && (
                  <span style={{ fontSize: '9px', color: '#64748b', display: 'block', marginTop: '1px' }}>{permiso.observaciones}</span>
                )}
              </div>
              <div>
                <span style={{ fontSize: '8.5px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>DICTAMEN DE NÓMINA</span>
                <strong style={{ fontSize: '10px', color: '#0f172a', display: 'block', marginTop: '1px' }}>{getDictamenPago()}</strong>
              </div>
            </div>

            {/* BANDA 4: MOTIVO / JUSTIFICACIÓN */}
            <div style={{
              padding: '8px 14px', border: '1px solid #e2e8f0', borderRadius: '6px',
              marginBottom: '10px', fontSize: '10.5px', background: '#fcfcfd',
              textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              minHeight: '40px', boxSizing: 'border-box'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                <span style={{ fontSize: '9px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  MOTIVO DEL PERMISO
                </span>
                {categoriaAsunto && (
                  <span style={{ fontSize: '9px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>
                    • {categoriaAsunto}
                  </span>
                )}
              </div>
              
              <div style={{ color: '#1e293b', fontStyle: 'italic', lineHeight: 1.4, maxWidth: '94%', textAlign: 'center', fontSize: '10.5px' }}>
                {justificacionLimpia || 'Sin justificación registrada.'}
              </div>
            </div>

            {/* BANDA 5: FIRMAS OFICIALES */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '0', paddingBottom: '2px' }}>
              {renderFirmaTradicional(
                'Solicitante',
                permiso.usuarios?.nombre_completo,
                permiso.usuarios?.firma_url,
                'autorizado',
                true
              )}
              {renderFirmaTradicional(
                'Jefe de Área',
                permiso.jefe?.nombre_completo,
                permiso.jefe?.firma_url,
                permiso.firma_1_estado
              )}
              {renderFirmaTradicional(
                'Gerencia',
                permiso.gerente?.nombre_completo,
                permiso.gerente?.firma_url,
                permiso.firma_2_estado
              )}
              {renderFirmaTradicional(
                'Recursos Humanos',
                permiso.rh?.nombre_completo,
                permiso.rh?.firma_url,
                permiso.firma_3_estado
              )}
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}