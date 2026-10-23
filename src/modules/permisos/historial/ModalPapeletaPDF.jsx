import React, { useRef, useState, useEffect } from 'react';
import { X, Printer, ShieldCheck } from 'lucide-react';
import { supabase } from '../../../core/api/supabaseClient';
import { parsearDatosObservaciones, limpiarMotivo } from './TablaHistorial';

export default function ModalPapeletaPDF({ permiso, permisos, onClose }) {
  const contenedorRef = useRef(null);
  const [mapaFirmasExtra, setMapaFirmasExtra] = useState({});

  let listaPermisos = [];
  if (Array.isArray(permiso)) {
    listaPermisos = permiso;
  } else if (Array.isArray(permisos)) {
    listaPermisos = permisos;
  } else if (permiso) {
    listaPermisos = [permiso];
  }

  useEffect(() => {
    const cargarFirmasSubarea = async () => {
      const nombresBuscar = new Set();
      listaPermisos.forEach(p => {
        const { supervisorSubarea } = parsearDatosObservaciones(p.observaciones);
        if (supervisorSubarea && !p.usuarios?.supervisor?.firma_url) {
          nombresBuscar.add(supervisorSubarea.trim());
        }
      });

      if (nombresBuscar.size === 0) return;

      const { data } = await supabase
        .from('usuarios')
        .select('nombre_completo, firma_url')
        .in('nombre_completo', Array.from(nombresBuscar));

      if (data && data.length > 0) {
        const nuevoMapa = {};
        data.forEach(u => {
          if (u.nombre_completo && u.firma_url) {
            nuevoMapa[u.nombre_completo.trim().toUpperCase()] = u.firma_url;
          }
        });
        setMapaFirmasExtra(nuevoMapa);
      }
    };

    if (listaPermisos.length > 0) {
      cargarFirmasSubarea();
    }
  }, [permiso, permisos]);

  if (listaPermisos.length === 0) return null;

  const formatearFecha = (fechaStr) => {
    if (!fechaStr) return '';
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const partes = String(fechaStr).trim().split('-');
    if (partes.length !== 3) return fechaStr;
    const anio = partes[0];
    const mes = meses[parseInt(partes[1], 10) - 1] || partes[1];
    const dia = parseInt(partes[2], 10);
    return `${dia} ${mes} ${anio}`;
  };

  const imprimir = () => {
    if (!contenedorRef.current) return;
    const ventanaImpresion = window.open('', '_blank', 'width=900,height=800');
    if (!ventanaImpresion) {
      alert('Por favor habilita las ventanas emergentes en tu navegador para imprimir.');
      return;
    }

    const contenidoHTML = contenedorRef.current.innerHTML;

    ventanaImpresion.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Impresión de Permisos - Ideas Mobiliarium</title>
          <style>
            @page { size: letter portrait; margin: 6mm 8mm; }
            * { box-sizing: border-box !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            html, body { margin: 0 !important; padding: 0 !important; background: #ffffff !important; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif; }
            #papeleta-impresion-contenedor { display: flex !important; flex-direction: column !important; gap: 5mm !important; width: 100% !important; }
            .papeleta-hoja-impresion {
              box-sizing: border-box !important; width: 100% !important; height: 124mm !important; max-height: 124mm !important;
              border: 1px solid #94a3b8 !important; border-radius: 8px !important; padding: 7mm 10mm !important; margin: 0 0 4mm 0 !important;
              background: #ffffff !important; display: flex !important; flex-direction: column !important; justify-content: space-between !important;
              page-break-inside: avoid !important; break-inside: avoid !important;
            }
            .papeleta-membrete { display: grid !important; grid-template-columns: 140px 1fr 140px !important; align-items: center !important; }
            .papeleta-grid-4 { display: grid !important; grid-template-columns: 1.35fr 1.05fr 1.15fr 1fr !important; gap: 12px !important; }
            .papeleta-grid-motivo { display: grid !important; grid-template-columns: 1.25fr 1fr !important; gap: 16px !important; }
            .papeleta-firmas-row { display: flex !important; flex-direction: row !important; gap: 14px !important; }
            .logo-impresion-nitido { filter: contrast(1.95) brightness(0.68) saturate(1.4) !important; }
          </style>
        </head>
        <body>
          <div id="papeleta-impresion-contenedor">${contenidoHTML}</div>
          <script>
            window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 300); };
          </script>
        </body>
      </html>
    `);
    ventanaImpresion.document.close();
  };

  const getDictamenPago = (p) => {
    const pago = (p.pago || '').toLowerCase();
    if (pago === 'cancelado' || /CANCELADO por/i.test(p.observaciones || '')) return 'PASE CANCELADO';
    if (pago.includes('regresa') || /\[REGRESADO EN PUERTA:/i.test(p.observaciones || '')) return 'SE REGRESA (SIN ACCESO)';
    if (p.estado_general === 'rechazado') return 'NO AUTORIZADO';
    if (pago.includes('con goce')) return 'CON GOCE DE SUELDO';
    if (pago.includes('sin goce')) return 'SIN GOCE DE SUELDO';
    if (pago.includes('tiempo')) return 'REPOSICIÓN DE TIEMPO';
    return 'AUTORIZADO';
  };

  const renderFirmaTradicional = (cargo, nombre, firmaUrl, estado, esSolicitante = false) => {
    const est = (estado || '').toLowerCase();
    const intervino = esSolicitante || ['autorizado', 'aprobado', 'auto_aprobado', 'rechazado'].includes(est);

    return (
      <div className="papeleta-firma-item" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', textAlign: 'center', height: '100px', minWidth: 0 }}>
        <div style={{ height: '60px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', width: '100%', paddingBottom: '4px' }}>
          {intervino && firmaUrl ? (
            <img
              src={firmaUrl}
              alt="Firma"
              style={{
                maxHeight: '54px',
                maxWidth: '92%',
                objectFit: 'contain',
                filter: 'contrast(1.4)',
                mixBlendMode: 'multiply'
              }}
            />
          ) : intervino ? (
            <span style={{ fontSize: '10px', fontWeight: '800', color: '#0f172a', paddingBottom: '6px' }}>✓ FIRMA DIGITAL</span>
          ) : (
            <span style={{ fontSize: '10px', color: '#64748b', paddingBottom: '6px' }}>—</span>
          )}
        </div>
        <div style={{ width: '92%', borderTop: '1.5px solid #0f172a', paddingTop: '5px' }}>
          <div style={{ fontSize: '10px', fontWeight: '900', color: '#0f172a', lineHeight: 1.15 }}>
            {nombre || 'Autorizado'}
          </div>
          <div style={{ fontSize: '8.5px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.03em', marginTop: '2px', fontWeight: '700' }}>
            {cargo}
          </div>
        </div>
      </div>
    );
  };

  const debeOcultarFirma = (estado, estadoGeneral = '') => {
    const est = (estado || '').toLowerCase();
    if (['escalado', 'auto_aprobado', 'omitido'].includes(est)) return true;
    // Si el permiso ya concluyó (autorizado o rechazado) y una firma quedó en 'pendiente', significa que esa etapa no intervino
    if (est === 'pendiente' && ['autorizado', 'aprobado', 'completado_caseta', 'rechazado'].includes((estadoGeneral || '').toLowerCase())) {
      return true;
    }
    return false;
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.82)', backdropFilter: 'blur(5px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 6000, padding: '14px', boxSizing: 'border-box'
    }}>
      <style>{`
        .papeleta-membrete {
          display: grid;
          grid-template-columns: 150px 1fr 150px;
          align-items: center;
          border-bottom: 2px solid #0f172a;
          padding-bottom: 10px;
          gap: 10px;
        }
        .papeleta-grid-4 {
          display: grid;
          grid-template-columns: 1.35fr 1.05fr 1.15fr 1fr;
          gap: 14px;
        }
        .papeleta-grid-motivo {
          display: grid;
          grid-template-columns: 1.25fr 1fr;
          gap: 16px;
        }
        .papeleta-motivo-left {
          border-right: 1px solid #e2e8f0;
          padding-right: 12px;
        }
        .papeleta-firmas-row {
          display: flex;
          gap: 14px;
          padding-bottom: 2px;
        }
        @media (max-width: 720px) {
          .papeleta-hoja-impresion {
            padding: 16px 14px !important;
            gap: 12px !important;
            min-height: auto !important;
          }
          .papeleta-membrete {
            grid-template-columns: 1fr auto;
            gap: 8px;
          }
          .papeleta-membrete-titulo {
            grid-column: 1 / -1;
            order: 3;
            text-align: left !important;
            padding-top: 4px;
          }
          .papeleta-grid-4 {
            grid-template-columns: 1fr 1fr;
            gap: 10px;
          }
          .papeleta-grid-motivo {
            grid-template-columns: 1fr;
            gap: 12px;
          }
          .papeleta-motivo-left {
            border-right: none;
            border-bottom: 1px solid #e2e8f0;
            padding-right: 0;
            padding-bottom: 10px;
          }
          .papeleta-firmas-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
          }
        }
      `}</style>

      <div style={{
        backgroundColor: '#ffffff', color: '#0f172a', borderRadius: '16px', width: '100%', maxWidth: '920px',
        maxHeight: '94vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,0.6)', overflow: 'hidden'
      }}>
        {/* BARRA SUPERIOR */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 18px', borderBottom: '1px solid #cbd5e1', background: '#f8fafc', flexWrap: 'wrap', gap: '10px'
        }}>
          <span style={{ fontSize: '13px', fontWeight: '900', color: '#0f172a', letterSpacing: '0.02em' }}>
            PAPELETA OFICIAL • <span style={{ color: '#16a34a' }}>{listaPermisos.length === 1 ? listaPermisos[0].folio : `${listaPermisos.length} SELECCIONADAS`}</span>
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={imprimir}
              style={{
                height: '36px', padding: '0 14px', borderRadius: '8px', border: 'none',
                backgroundColor: '#16a34a', color: '#fff', fontSize: '12.5px', fontWeight: '800',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              <Printer size={15} /> Imprimir / PDF
            </button>
            <button
              onClick={onClose}
              style={{
                background: '#e2e8f0', border: 'none', cursor: 'pointer', color: '#334155',
                width: '34px', height: '34px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* CONTENEDOR DE LA HOJA */}
        <div style={{ padding: '16px', overflow: 'auto', background: '#e2e8f0' }}>
          <div ref={contenedorRef} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {listaPermisos.map((p, index) => {
              const tipo = (p.tipo_permiso || '').toLowerCase();
              const seRegresaTrabajador = (p.pago || '').toLowerCase().includes('regresa') || /\[REGRESADO EN PUERTA:/i.test(p.observaciones || '');
              const {
                horarioSolicitado,
                horaSalidaCaseta,
                horaEntradaCaseta,
                horaRegresadoCaseta,
                horaLlegadaPuerta,
                supervisorSubarea,
                motivoRechazo,
                notasFlujo
              } = parsearDatosObservaciones(p.observaciones);
              const { categoria, texto: motivoCrudo } = limpiarMotivo(p.asunto_motivo);

              const esApoyoCaseta = (categoria || '').toUpperCase() === 'APOYO CASETA';
              const etiquetaMotivo = esApoyoCaseta ? 'REGISTRO EN PUERTA' : categoria;
              const justificacionLimpia = esApoyoCaseta
                ? 'Pase de retardo tramitado con apoyo de caseta de vigilancia.'
                : motivoCrudo;

              const firmanteJefe = p.firmante1 || p.jefe;
              const firmanteGerente = p.firmante2 || p.gerente;
              const firmanteRH = p.firmante3 || p.rh;

              const firmaUrlSubarea =
                p.usuarios?.supervisor?.firma_url ||
                (supervisorSubarea ? mapaFirmasExtra[supervisorSubarea.trim().toUpperCase()] : null);

              const tieneSelloCaseta = Boolean(horaSalidaCaseta || horaEntradaCaseta);
              const fechaPermisoBonita = p.fecha_fin && p.fecha_fin !== p.fecha_permiso
                ? `${formatearFecha(p.fecha_permiso)} al ${formatearFecha(p.fecha_fin)}`
                : formatearFecha(p.fecha_permiso);
              const fechaElabBonita = formatearFecha(p.fecha_elaboracion || p.fecha_permiso);

              return (
                <div
                  key={p.id || index}
                  className="papeleta-hoja-impresion"
                  style={{
                    background: '#ffffff', borderRadius: '10px', border: '1px solid #cbd5e1',
                    padding: '22px 26px 18px 26px', boxSizing: 'border-box',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif',
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                    minHeight: '124mm', width: '100%', boxShadow: '0 4px 16px rgba(0,0,0,0.08)'
                  }}
                >
                  {/* 1. MEMBRETE */}
                  <div className="papeleta-membrete">
                    <div>
                      <img
                        src="/LogoVerde-removebg-preview.png"
                        alt="Logo"
                        className="logo-impresion-nitido"
                        style={{
                          height: '42px',
                          maxWidth: '130px',
                          objectFit: 'contain',
                          filter: 'contrast(1.85) brightness(0.72) saturate(1.4)'
                        }}
                      />
                    </div>
                    <div className="papeleta-membrete-titulo" style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '16px', fontWeight: '900', letterSpacing: '0.03em', color: '#0f172a' }}>IDEAS MOBILIARIUM</div>
                      <div style={{ fontSize: '11px', color: '#334155', fontWeight: '700', marginTop: '2px' }}>Formato oficial de control de pases y permisos</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        fontFamily: 'ui-monospace, monospace', fontSize: '13px', fontWeight: '900',
                        color: '#15803d', background: '#f0fdf4', border: '1px solid #86efac',
                        padding: '3px 10px', borderRadius: '6px', display: 'inline-block'
                      }}>
                        {p.folio}
                      </div>
                      <div style={{ fontSize: '10px', color: '#475569', marginTop: '4px', fontWeight: '600' }}>
                        Elab: <strong style={{ color: '#0f172a' }}>{fechaElabBonita}</strong>
                      </div>
                    </div>
                  </div>

                  {/* 2. CAJA COLABORADOR */}
                  <div className="papeleta-grid-4" style={{
                    alignItems: 'start',
                    padding: '12px 16px', background: '#f8fafc', border: '1px solid #cbd5e1',
                    borderRadius: '8px', fontSize: '11.5px'
                  }}>
                    <div>
                      <span style={{ fontSize: '9px', fontWeight: '900', color: '#475569', display: 'block', marginBottom: '2px' }}>COLABORADOR</span>
                      <strong style={{ fontSize: '12px', color: '#0f172a', display: 'block' }}>{p.usuarios?.nombre_completo}</strong>
                      <span style={{ fontSize: '10.5px', color: '#15803d', fontWeight: '800', marginTop: '1px', display: 'block' }}>#{p.usuarios?.numero_empleado}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '9px', fontWeight: '900', color: '#475569', display: 'block', marginBottom: '2px' }}>DEPARTAMENTO</span>
                      <strong style={{ fontSize: '11.5px', display: 'block', color: '#0f172a' }}>{p.usuarios?.departamentos?.nombre || 'GENERAL'}</strong>
                      <span style={{ fontSize: '9px', color: '#475569', textTransform: 'uppercase', marginTop: '1px', display: 'block' }}>{p.usuarios?.departamentos?.clasificacion || ''}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '9px', fontWeight: '900', color: '#475569', display: 'block', marginBottom: '2px' }}>ÁREA Y PUESTO</span>
                      <strong style={{ fontWeight: '800', fontSize: '11.5px', display: 'block', color: '#0f172a' }}>{p.usuarios?.area || 'GENERAL'}</strong>
                      <span style={{ fontSize: '9.5px', color: '#475569', display: 'block', marginTop: '1px' }}>{p.usuarios?.puesto || ''}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '9px', fontWeight: '900', color: '#475569', display: 'block', marginBottom: '2px' }}>SEDE</span>
                      <strong style={{ fontSize: '11.5px', color: '#0f172a', display: 'block' }}>{p.usuarios?.sedes?.nombre || 'SANTA CATARINA'}</strong>
                    </div>
                  </div>

                  {/* 3. CAJA INCIDENCIA (SEPARACIÓN LIMPIA ENTRE HORARIO SOLICITADO Y SELLO REAL DE CASETA) */}
                  <div className="papeleta-grid-4" style={{
                    alignItems: 'center',
                    padding: '12px 16px', background: '#ffffff', border: '1px solid #cbd5e1',
                    borderRadius: '8px', fontSize: '11.5px'
                  }}>
                    <div>
                      <span style={{ fontSize: '9px', fontWeight: '900', color: '#475569', display: 'block', marginBottom: '2px' }}>TIPO Y HORARIO SOLICITADO</span>
                      <strong style={{ textTransform: 'uppercase', color: '#0f172a', fontSize: '11.5px', display: 'block' }}>{p.tipo_permiso}</strong>
                      {(tipo === 'salida' || tipo === 'retardo') && horarioSolicitado && (
                        <span style={{ fontSize: '10px', color: '#475569', fontWeight: '700', display: 'block', marginTop: '1px' }}>
                          {horarioSolicitado}
                        </span>
                      )}
                    </div>

                    <div>
                      <span style={{ fontSize: '9px', fontWeight: '900', color: '#475569', display: 'block', marginBottom: '2px' }}>FECHA DE APLICACIÓN</span>
                      <strong style={{ color: '#0f172a', display: 'block', fontSize: '11.5px' }}>
                        {fechaPermisoBonita}
                      </strong>
                    </div>

                    <div>
                      <span style={{ fontSize: '9px', fontWeight: '900', color: '#475569', display: 'inline-flex', alignItems: 'center', gap: '3px', marginBottom: '2px' }}>
                        <ShieldCheck size={11} strokeWidth={2.5} color="#0f172a" />
                        SELLO CASETA
                      </span>
                      {(tipo === 'falta' || tipo === 'vacaciones') ? (
                        <strong style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>N/A</strong>
                      ) : seRegresaTrabajador ? (
                        <strong style={{ color: '#b45309', fontSize: '11px', display: 'block' }}>
                          {horaRegresadoCaseta ? `Retirado: ${horaRegresadoCaseta}` : 'Sin acceso'}
                        </strong>
                      ) : (horaSalidaCaseta || horaEntradaCaseta) ? (
                        <strong style={{ color: '#15803d', fontSize: '11px', display: 'block' }}>
                          {horaSalidaCaseta && horaEntradaCaseta
                            ? `${horaSalidaCaseta.replace(/\s*hrs/i, '')} → ${horaEntradaCaseta}`
                            : (horaSalidaCaseta ? `Salida: ${horaSalidaCaseta}` : `Entrada: ${horaEntradaCaseta}`)}
                        </strong>
                      ) : horaLlegadaPuerta ? (
                        <strong style={{ color: '#d97706', fontSize: '11px', display: 'block' }}>
                          En puerta: {horaLlegadaPuerta}
                        </strong>
                      ) : (
                        <strong style={{ color: '#94a3b8', fontSize: '11px', display: 'block' }}>Sin sello</strong>
                      )}
                    </div>

                    <div>
                      <span style={{ fontSize: '9px', fontWeight: '900', color: '#475569', display: 'block', marginBottom: '2px' }}>DICTAMEN NÓMINA</span>
                      <strong style={{ fontSize: '11px', color: seRegresaTrabajador ? '#b45309' : '#0f172a' }}>{getDictamenPago(p)}</strong>
                    </div>
                  </div>

                  {/* 4. CAJA MOTIVO | COMENTARIOS */}
                  <div className="papeleta-grid-motivo" style={{
                    padding: '12px 16px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    background: '#fcfcfd',
                    minHeight: '76px'
                  }}>
                    <div className="papeleta-motivo-left">
                      <span style={{ fontSize: '9px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                        MOTIVO {etiquetaMotivo ? `• ${etiquetaMotivo}` : ''}
                      </span>
                      <div style={{ color: '#0f172a', fontSize: '13px', lineHeight: 1.45, fontWeight: '600' }}>
                        {justificacionLimpia || 'Sin justificación adicional.'}
                      </div>
                    </div>

                    <div>
                      <span style={{ fontSize: '9px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                        COMENTARIOS DE AUTORIZACIÓN
                      </span>
                      {(notasFlujo && notasFlujo.length > 0) || motivoRechazo ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {notasFlujo && notasFlujo.map((n, idx) => (
                            <div key={idx} style={{ fontSize: '11px', color: '#0f172a', lineHeight: 1.35 }}>
                              <strong style={{ color: '#334155' }}>{n.autor}:</strong> {n.texto}
                            </div>
                          ))}
                          {motivoRechazo && (
                            <div style={{ fontSize: '11px', color: '#dc2626', lineHeight: 1.35, fontWeight: '700' }}>
                              <strong>{seRegresaTrabajador ? 'Dictamen:' : 'Motivo:'}</strong> {motivoRechazo}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic', marginTop: '4px' }}>
                          Sin observaciones adicionales.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 5. FIRMAS */}
                  <div className="papeleta-firmas-row">
                    {renderFirmaTradicional('Solicitante', p.usuarios?.nombre_completo, p.usuarios?.firma_url, 'autorizado', true)}
                    {supervisorSubarea && renderFirmaTradicional('Supervisor Subárea', supervisorSubarea, firmaUrlSubarea, 'autorizado')}
                    {!debeOcultarFirma(p.firma_1_estado, p.estado_general) && firmanteJefe?.nombre_completo && (
                      renderFirmaTradicional('Jefe de Área', firmanteJefe.nombre_completo, firmanteJefe.firma_url, p.firma_1_estado)
                    )}
                    {!debeOcultarFirma(p.firma_2_estado, p.estado_general) && firmanteGerente?.nombre_completo && (
                      renderFirmaTradicional('Gerencia', firmanteGerente.nombre_completo, firmanteGerente.firma_url, p.firma_2_estado)
                    )}
                    {!debeOcultarFirma(p.firma_3_estado, p.estado_general) && firmanteRH?.nombre_completo && (
                      renderFirmaTradicional('Recursos Humanos', firmanteRH.nombre_completo, firmanteRH.firma_url, p.firma_3_estado)
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
