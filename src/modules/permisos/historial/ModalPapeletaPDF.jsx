import React, { useRef } from 'react';
import { X, Printer } from 'lucide-react';

export default function ModalPapeletaPDF({ permiso, permisos, onClose }) {
  const contenedorRef = useRef(null);

  let listaPermisos = [];
  if (Array.isArray(permiso)) {
    listaPermisos = permiso;
  } else if (Array.isArray(permisos)) {
    listaPermisos = permisos;
  } else if (permiso) {
    listaPermisos = [permiso];
  }

  if (listaPermisos.length === 0) return null;

  // ESTRATEGIA DE IMPRESIÓN AISLADA
  const imprimir = () => {
    if (!contenedorRef.current) return;

    // 1. Crear ventana independiente aislada de React
    const ventanaImpresion = window.open('', '_blank', 'width=900,height=800');
    if (!ventanaImpresion) {
      alert('Por favor habilita las ventanas emergentes en tu navegador para imprimir.');
      return;
    }

    const contenidoHTML = contenedorRef.current.innerHTML;

    // 2. Inyectar reglas estrictas de 2 papeletas por hoja carta (124mm por pase)
    ventanaImpresion.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Impresión de Permisos - Ideas Mobiliarium</title>
          <style>
            @page {
              size: letter portrait;
              margin: 6mm 8mm;
            }
            * {
              box-sizing: border-box !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif;
            }
            #papeleta-impresion-contenedor {
              display: flex !important;
              flex-direction: column !important;
              gap: 5mm !important;
              width: 100% !important;
            }
            .papeleta-hoja-impresion {
              box-sizing: border-box !important;
              width: 100% !important;
              height: 124mm !important;
              max-height: 124mm !important;
              border: 1px solid #94a3b8 !important;
              border-radius: 6px !important;
              padding: 6mm 10mm !important;
              margin: 0 0 4mm 0 !important;
              background: #ffffff !important;
              display: flex !important;
              flex-direction: column !important;
              justify: space-between !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
          </style>
        </head>
        <body>
          <div id="papeleta-impresion-contenedor">
            ${contenidoHTML}
          </div>
          <script>
            window.onload = () => {
              setTimeout(() => {
                window.print();
                window.close();
              }, 300);
            };
          </script>
        </body>
      </html>
    `);
    ventanaImpresion.document.close();
  };

  const getDictamenPago = (p) => {
    const pago = (p.pago || '').toLowerCase();
    if (pago.includes('con goce')) return 'CON GOCE DE SUELDO';
    if (pago.includes('sin goce')) return 'SIN GOCE DE SUELDO';
    if (pago.includes('tiempo')) return 'REPOSICIÓN DE TIEMPO';
    return 'PENDIENTE DE DICTAMEN';
  };

  const getTextoTiempo = (p) => {
    const tipo = (p.tipo_permiso || '').toLowerCase();
    const esDiaCompleto = tipo === 'falta' || tipo === 'vacaciones';
    if (esDiaCompleto) {
      if (tipo === 'vacaciones') return 'JORNADA COMPLETA (VACACIONES)';
      return 'JORNADA COMPLETA';
    }
    return `${p.total_horas || 0} HR(S)`;
  };

  const formatearHoraReal = (fechaIso) => {
    if (!fechaIso) return null;
    const d = new Date(fechaIso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const procesarMotivo = (textoCrudo = '') => {
    const match = textoCrudo.match(/^(\[\vert{}\{)(.*?)(\]|\})\s*(.*)\$/);
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

  const renderFirmaTradicional = (cargo, nombre, firmaUrl, estado, esSolicitante = false) => {
    const firmado = esSolicitante || estado === 'autorizado' || estado === 'aprobado';
    const rechazado = estado === 'rechazado';

    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justify: 'flex-end',
        alignItems: 'center',
        textAlign: 'center',
        height: '75px',
        boxSizing: 'border-box',
        minWidth: '0'
      }}>
        <div style={{ height: '40px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', width: '100%', marginBottom: '3px' }}>
          {firmado && firmaUrl ? (
            <img 
              src={firmaUrl} 
              alt="Firma" 
              style={{ maxHeight: '38px', maxWidth: '85%', objectFit: 'contain', filter: 'contrast(1.2)' }} 
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
            <span style={{ fontSize: '8.5px', color: '#64748b', fontStyle: 'italic' }}>
              Pendiente
            </span>
          )}
        </div>

        <div style={{ width: '95%', borderTop: '1.5px solid #0f172a', paddingTop: '3px' }}>
          <div style={{ fontSize: '9.5px', fontWeight: '900', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {nombre || 'Por asignar'}
          </div>
          <div style={{ fontSize: '8px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.02em', marginTop: '1px', fontWeight: '700' }}>
            {cargo}
          </div>
        </div>
      </div>
    );
  };

  const debeOcultarFirma = (estado) => {
    const est = (estado || '').toLowerCase();
    return est === 'escalado' || est === 'auto_aprobado' || est === 'omitido';
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 6000, padding: '16px', boxSizing: 'border-box'
    }}>
      
      {/* CONTENEDOR MODAL PANTALLA */}
      <div style={{
        backgroundColor: '#ffffff', color: '#0f172a',
        borderRadius: '14px', width: '100%', maxWidth: '820px',
        maxHeight: '94vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 60px rgba(0,0,0,0.6)', overflow: 'hidden'
      }}>
        
        {/* BARRA ACCIONES */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 18px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc',
          flexWrap: 'wrap', gap: '10px'
        }}>
          <span style={{ fontSize: '12px', fontWeight: '800', color: '#16a34a' }}>
            FORMATO OFICIAL • {listaPermisos.length === 1 ? listaPermisos[0].folio : `${listaPermisos.length} PAPELETAS SELECCIONADAS`}
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

        {/* CONTENEDOR SCROLL PANTALLA */}
        <div style={{ 
          padding: '15px', 
          overflow: 'auto', 
          background: '#f1f5f9',
          WebkitOverflowScrolling: 'touch'
        }}>
          
          <div ref={contenedorRef} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {listaPermisos.map((p, index) => {
              const tipo = (p.tipo_permiso || '').toLowerCase();
              const esDiaCompleto = tipo === 'falta' || tipo === 'vacaciones';
              const { etiqueta: categoriaAsunto, redaccion: justificacionLimpia } = procesarMotivo(p.asunto_motivo);

              return (
                <div 
                  key={p.id || index}
                  className="papeleta-hoja-impresion"
                  style={{
                    background: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    padding: '12px 16px 10px 16px',
                    boxSizing: 'border-box',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif',
                    display: 'flex',
                    flexDirection: 'column',
                    justify: 'space-between', 
                    minHeight: '124mm',
                    width: '100%'
                  }}
                >
                  {/* BANDA 1: MEMBRETE */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '120px 1fr 120px',
                    alignItems: 'center',
                    borderBottom: '2px solid #0f172a',
                    paddingBottom: '6px',
                    marginBottom: '6px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <img 
                        src="/LogoVerde-removebg-preview.png" 
                        alt="Logo" 
                        style={{ height: '36px', maxWidth: '110px', objectFit: 'contain' }} 
                      />
                    </div>

                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '15px', fontWeight: '900', letterSpacing: '0.03em', color: '#0f172a' }}>
                        IDEAS MOBILIARIUM
                      </div>
                      <div style={{ fontSize: '10px', color: '#475569', fontWeight: '700', marginTop: '1px' }}>
                        Formato control de permisos
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        fontFamily: 'ui-monospace, monospace', fontSize: '12px', fontWeight: '900',
                        color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0',
                        padding: '2px 6px', borderRadius: '4px', display: 'inline-block', whiteSpace: 'nowrap'
                      }}>
                        {p.folio}
                      </div>
                      <div style={{ fontSize: '9px', color: '#475569', marginTop: '2px', whiteSpace: 'nowrap' }}>
                        Elab: <strong>{p.fecha_elaboracion || 'N/A'}</strong>
                      </div>
                    </div>
                  </div>

                  {/* BANDA 2: FICHA COLABORADOR */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 0.8fr', gap: '6px',
                    padding: '6px 10px', background: '#f8fafc', border: '1px solid #cbd5e1',
                    borderRadius: '6px', marginBottom: '6px', fontSize: '10.5px'
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontSize: '8px', fontWeight: '900', color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '1px' }}>COLABORADOR</span>
                      <strong style={{ fontSize: '11px', color: '#0f172a', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.usuarios?.nombre_completo || 'N/A'}
                      </strong>
                      <span style={{ fontSize: '9px', color: '#16a34a', fontWeight: '800' }}>#{p.usuarios?.numero_empleado}</span>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontSize: '8px', fontWeight: '900', color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '1px' }}>DEPARTAMENTO</span>
                      <span style={{ fontWeight: '700', fontSize: '10.5px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.usuarios?.departamentos?.nombre || 'GENERAL'}
                      </span>
                      <span style={{ fontSize: '8px', color: '#475569', textTransform: 'uppercase', fontWeight: '600' }}>{p.usuarios?.departamentos?.clasificacion || ''}</span>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontSize: '8px', fontWeight: '900', color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '1px' }}>ÁREA Y PUESTO</span>
                      <span style={{ fontWeight: '600', fontSize: '10.5px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.usuarios?.area || 'GENERAL'}
                      </span>
                      <span style={{ fontSize: '9px', color: '#475569', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.usuarios?.puesto || 'Sin puesto'}
                      </span>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontSize: '8px', fontWeight: '900', color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '1px' }}>SEDE</span>
                      <span style={{ fontWeight: '700', fontSize: '11px', color: '#0f172a', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.usuarios?.sedes?.nombre || 'SANTA CATARINA'}
                      </span>
                    </div>
                  </div>

                  {/* BANDA 3: INCIDENCIA */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px',
                    padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px',
                    marginBottom: '6px', fontSize: '10.5px'
                  }}>
                    <div>
                      <span style={{ fontSize: '8px', fontWeight: '900', color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '1px' }}>TIPO DE PERMISO</span>
                      <strong style={{ textTransform: 'uppercase', color: '#0f172a', fontSize: '10.5px' }}>{p.tipo_permiso || 'Pase'}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '8px', fontWeight: '900', color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '1px' }}>FECHA DE APLICACIÓN</span>
                      <strong style={{ color: '#16a34a', fontSize: '10.5px' }}>
                        {p.fecha_permiso} {p.fecha_fin && ` al ${p.fecha_fin}`}
                      </strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '8px', fontWeight: '900', color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '1px' }}>DURACIÓN / HORARIOS</span>
                      {p.hora_salida_caseta ? (
                        <strong style={{ color: '#16a34a', fontSize: '10px', display: 'block' }}>
                          SALIDA: {formatearHoraReal(p.hora_salida_caseta)}
                          {p.hora_llegada_caseta ? ` | RETORNO: ${formatearHoraReal(p.hora_llegada_caseta)}` : ''}
                        </strong>
                      ) : (
                        <strong style={{ color: esDiaCompleto ? '#0f172a' : '#16a34a', fontSize: '10.5px', display: 'block' }}>
                          {getTextoTiempo(p)}
                        </strong>
                      )}
                    </div>
                    <div>
                      <span style={{ fontSize: '8px', fontWeight: '900', color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '1px' }}>DICTAMEN DE NÓMINA</span>
                      <strong style={{ fontSize: '9.5px', color: '#0f172a', display: 'block', marginTop: '1px' }}>{getDictamenPago(p)}</strong>
                    </div>
                  </div>

                  {/* BANDA 4: MOTIVO */}
                  <div style={{
                    padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px',
                    marginBottom: '8px', background: '#fcfcfd',
                    display: 'flex', flexDirection: 'column', justifyContent: 'flex-start',
                    flex: 1,
                    boxSizing: 'border-box'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}>
                      <span style={{ fontSize: '8.5px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                        MOTIVO DEL PERMISO {categoriaAsunto ? `• ${categoriaAsunto}` : ''}
                      </span>
                    </div>
                    
                    <div style={{ color: '#0f172a', fontSize: '10.5px', lineHeight: 1.35, textAlign: 'left' }}>
                      {justificacionLimpia || 'Sin justificación registrada.'}
                    </div>
                  </div>

                  {/* BANDA 5: FIRMAS */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '0', paddingBottom: '2px' }}>
                    {renderFirmaTradicional(
                      'Solicitante',
                      p.usuarios?.nombre_completo,
                      p.usuarios?.firma_url,
                      'autorizado',
                      true
                    )}
                    
                    {!debeOcultarFirma(p.firma_1_estado) && p.jefe?.nombre_completo && (
                      renderFirmaTradicional(
                        'Jefe de Área',
                        p.jefe?.nombre_completo,
                        p.jefe?.firma_url,
                        p.firma_1_estado
                      )
                    )}

                    {!debeOcultarFirma(p.firma_2_estado) && p.gerente?.nombre_completo && (
                      renderFirmaTradicional(
                        'Gerencia',
                        p.gerente?.nombre_completo,
                        p.gerente?.firma_url,
                        p.firma_2_estado
                      )
                    )}

                    {renderFirmaTradicional(
                      'Recursos Humanos',
                      p.rh?.nombre_completo,
                      p.rh?.firma_url,
                      p.firma_3_estado
                    )}
                  </div>

                </div>
              );
            })}

          </div>
        </div>
      </div>
    </div>
  );
}