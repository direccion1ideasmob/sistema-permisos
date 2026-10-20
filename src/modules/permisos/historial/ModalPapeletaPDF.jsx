import React, { useRef, useState, useEffect } from 'react';
import { X, Printer, ShieldCheck, Clock, CalendarCheck } from 'lucide-react';
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

  // Formateador de fecha legible: "2026-10-23" -> "23 Oct 2026"
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
              border: 1px solid #94a3b8 !important; border-radius: 6px !important; padding: 6mm 10mm !important; margin: 0 0 4mm 0 !important;
              background: #ffffff !important; display: flex !important; flex-direction: column !important; justify-content: space-between !important;
              page-break-inside: avoid !important; break-inside: avoid !important;
            }
            .logo-impresion-nitido {
              filter: contrast(1.95) brightness(0.68) saturate(1.4) !important;
            }
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
    if (p.estado_general === 'rechazado') return 'RECHAZADO';
    const pago = (p.pago || '').toLowerCase();
    if (pago.includes('con goce')) return 'CON GOCE DE SUELDO';
    if (pago.includes('sin goce')) return 'SIN GOCE DE SUELDO';
    if (pago.includes('tiempo')) return 'REPOSICIÓN DE TIEMPO';
    return 'AUTORIZADO';
  };

  const renderFirmaTradicional = (cargo, nombre, firmaUrl, estado, esSolicitante = false) => {
    const est = (estado || '').toLowerCase();
    const firmado = esSolicitante || ['autorizado', 'aprobado', 'auto_aprobado'].includes(est);
    const rechazado = est === 'rechazado';

    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', textAlign: 'center', height: '72px', minWidth: 0 }}>
        <div style={{ height: '38px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', width: '100%', marginBottom: '3px' }}>
          {firmado && firmaUrl ? (
            <img src={firmaUrl} alt="Firma" style={{ maxHeight: '36px', maxWidth: '85%', objectFit: 'contain', filter: 'contrast(1.35) brightness(0.85)' }} />
          ) : firmado ? (
            <span style={{ fontSize: '9px', fontWeight: '800', color: '#15803d' }}>✓ AUTORIZADO DIGITAL</span>
          ) : rechazado ? (
            <span style={{ fontSize: '9px', fontWeight: '800', color: '#dc2626' }}>✗ RECHAZADO</span>
          ) : (
            <span style={{ fontSize: '8.5px', color: '#64748b' }}>—</span>
          )}
        </div>
        <div style={{ width: '95%', borderTop: '1.5px solid #0f172a', paddingTop: '3px' }}>
          <div style={{ fontSize: '9.5px', fontWeight: '900', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {nombre || 'Autorizado'}
          </div>
          <div style={{ fontSize: '8px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.02em', marginTop: '1px', fontWeight: '700' }}>
            {cargo}
          </div>
        </div>
      </div>
    );
  };

  const debeOcultarFirma = (estado) => ['escalado', 'auto_aprobado', 'omitido'].includes((estado || '').toLowerCase());

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.82)', backdropFilter: 'blur(5px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 6000, padding: '16px', boxSizing: 'border-box'
    }}>
      <div style={{
        backgroundColor: '#ffffff', color: '#0f172a', borderRadius: '14px', width: '100%', maxWidth: '820px',
        maxHeight: '94vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,0.6)', overflow: 'hidden'
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 18px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', flexWrap: 'wrap', gap: '10px'
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

        <div style={{ padding: '15px', overflow: 'auto', background: '#f1f5f9' }}>
          <div ref={contenedorRef} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {listaPermisos.map((p, index) => {
              const tipo = (p.tipo_permiso || '').toLowerCase();
              const {
                horarioSolicitado,
                horaSalidaCaseta,
                horaEntradaCaseta,
                supervisorSubarea
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
                    background: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1',
                    padding: '12px 16px 10px 16px', boxSizing: 'border-box',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif',
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                    minHeight: '124mm', width: '100%'
                  }}
                >
                  {/* MEMBRETE CON LOGO DE ALTO CONTRASTE PARA IMPRESIÓN */}
                  <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 130px', alignItems: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '6px', marginBottom: '6px' }}>
                    <div>
                      <img
                        src="/LogoVerde-removebg-preview.png"
                        alt="Logo"
                        className="logo-impresion-nitido"
                        style={{
                          height: '40px',
                          maxWidth: '120px',
                          objectFit: 'contain',
                          filter: 'contrast(1.85) brightness(0.72) saturate(1.4)'
                        }}
                      />
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '15px', fontWeight: '900', letterSpacing: '0.03em', color: '#0f172a' }}>IDEAS MOBILIARIUM</div>
                      <div style={{ fontSize: '10px', color: '#334155', fontWeight: '700', marginTop: '1px' }}>Formato oficial de control de pases y permisos</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        fontFamily: 'ui-monospace, monospace', fontSize: '12px', fontWeight: '900',
                        color: '#15803d', background: '#f0fdf4', border: '1px solid #86efac',
                        padding: '2px 7px', borderRadius: '4px', display: 'inline-block'
                      }}>
                        {p.folio}
                      </div>
                      <div style={{ fontSize: '9px', color: '#475569', marginTop: '3px', fontWeight: '600' }}>
                        Elab: <strong style={{ color: '#0f172a' }}>{fechaElabBonita}</strong>
                      </div>
                    </div>
                  </div>

                  {/* DATOS DEL COLABORADOR */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 0.8fr', gap: '6px',
                    padding: '6px 10px', background: '#f8fafc', border: '1px solid #cbd5e1',
                    borderRadius: '6px', marginBottom: '6px', fontSize: '10.5px'
                  }}>
                    <div>
                      <span style={{ fontSize: '8px', fontWeight: '900', color: '#475569', display: 'block' }}>COLABORADOR</span>
                      <strong style={{ fontSize: '11px', color: '#0f172a', display: 'block' }}>{p.usuarios?.nombre_completo}</strong>
                      <span style={{ fontSize: '9px', color: '#15803d', fontWeight: '800' }}>#{p.usuarios?.numero_empleado}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '8px', fontWeight: '900', color: '#475569', display: 'block' }}>DEPARTAMENTO</span>
                      <strong style={{ fontSize: '10.5px', display: 'block' }}>{p.usuarios?.departamentos?.nombre || 'GENERAL'}</strong>
                      <span style={{ fontSize: '8px', color: '#475569', textTransform: 'uppercase' }}>{p.usuarios?.departamentos?.clasificacion || ''}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '8px', fontWeight: '900', color: '#475569', display: 'block' }}>ÁREA Y PUESTO</span>
                      <span style={{ fontWeight: '700', fontSize: '10px', display: 'block' }}>{p.usuarios?.area || 'GENERAL'}</span>
                      <span style={{ fontSize: '9px', color: '#475569', display: 'block' }}>{p.usuarios?.puesto || ''}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '8px', fontWeight: '900', color: '#475569', display: 'block' }}>SEDE</span>
                      <strong style={{ fontSize: '10.5px', color: '#0f172a' }}>{p.usuarios?.sedes?.nombre || 'SANTA CATARINA'}</strong>
                    </div>
                  </div>

                  {/* INCIDENCIA + INSIGNIA DISCRETA DE ACCESO/HORARIO */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: '0.85fr 1.05fr 1.25fr 1fr', gap: '6px', alignItems: 'center',
                    padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', marginBottom: '6px', fontSize: '10px'
                  }}>
                    <div>
                      <span style={{ fontSize: '8px', fontWeight: '900', color: '#475569', display: 'block' }}>TIPO DE PASE</span>
                      <strong style={{ textTransform: 'uppercase', color: '#0f172a', fontSize: '10.5px' }}>{p.tipo_permiso}</strong>
                    </div>

                    <div>
                      <span style={{ fontSize: '8px', fontWeight: '900', color: '#475569', display: 'block' }}>FECHA DE APLICACIÓN</span>
                      <strong style={{ color: '#0f172a', display: 'block', fontSize: '10.5px' }}>
                        {fechaPermisoBonita}
                      </strong>
                    </div>

                    <div>
                      <span style={{ fontSize: '8px', fontWeight: '900', color: '#475569', display: 'block', marginBottom: '2px' }}>CONTROL DE ACCESO</span>
                      {tieneSelloCaseta ? (
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: '5px',
                          background: '#f0fdf4', border: '1px solid #86efac', color: '#15803d',
                          padding: '2px 8px', borderRadius: '5px', fontSize: '9.5px', fontWeight: '800'
                        }}>
                          <ShieldCheck size={12} strokeWidth={2.5} />
                          <span>
                            {horaSalidaCaseta ? `Salida ${horaSalidaCaseta}` : ''}
                            {horaSalidaCaseta && horaEntradaCaseta ? ' • ' : ''}
                            {horaEntradaCaseta ? `Entrada ${horaEntradaCaseta}` : ''}
                          </span>
                        </div>
                      ) : (tipo === 'falta' || tipo === 'vacaciones') ? (
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          background: '#f8fafc', border: '1px solid #cbd5e1', color: '#334155',
                          padding: '2px 8px', borderRadius: '5px', fontSize: '9.5px', fontWeight: '700'
                        }}>
                          <CalendarCheck size={11} />
                          <span>Ausencia de jornada</span>
                        </div>
                      ) : (
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          background: '#f8fafc', border: '1px solid #cbd5e1', color: '#475569',
                          padding: '2px 8px', borderRadius: '5px', fontSize: '9.5px', fontWeight: '700'
                        }}>
                          <Clock size={11} />
                          <span>{horarioSolicitado || 'Pendiente en caseta'}</span>
                        </div>
                      )}
                    </div>

                    <div>
                      <span style={{ fontSize: '8px', fontWeight: '900', color: '#475569', display: 'block' }}>DICTAMEN NÓMINA</span>
                      <strong style={{ fontSize: '9.5px', color: '#0f172a' }}>{getDictamenPago(p)}</strong>
                    </div>
                  </div>

                  {/* MOTIVO LIMPIO */}
                  <div style={{
                    padding: '7px 12px', border: '1px solid #cbd5e1', borderRadius: '6px',
                    marginBottom: '8px', background: '#fcfcfd', flex: 1
                  }}>
                    <span style={{ fontSize: '8px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                      MOTIVO {etiquetaMotivo ? `• ${etiquetaMotivo}` : ''}
                    </span>
                    <div style={{ color: '#0f172a', fontSize: '10.5px', lineHeight: 1.35 }}>
                      {justificacionLimpia || 'Sin justificación adicional.'}
                    </div>
                  </div>

                  {/* FIRMAS REALES */}
                  <div style={{ display: 'flex', gap: '8px', paddingBottom: '2px' }}>
                    {renderFirmaTradicional('Solicitante', p.usuarios?.nombre_completo, p.usuarios?.firma_url, 'autorizado', true)}
                    {supervisorSubarea && renderFirmaTradicional('Supervisor Subárea', supervisorSubarea, firmaUrlSubarea, 'autorizado')}
                    {!debeOcultarFirma(p.firma_1_estado) && firmanteJefe?.nombre_completo && (
                      renderFirmaTradicional('Jefe de Área', firmanteJefe.nombre_completo, firmanteJefe.firma_url, p.firma_1_estado)
                    )}
                    {!debeOcultarFirma(p.firma_2_estado) && firmanteGerente?.nombre_completo && (
                      renderFirmaTradicional('Gerencia', firmanteGerente.nombre_completo, firmanteGerente.firma_url, p.firma_2_estado)
                    )}
                    {renderFirmaTradicional('Recursos Humanos', firmanteRH?.nombre_completo, firmanteRH?.firma_url, p.firma_3_estado)}
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
