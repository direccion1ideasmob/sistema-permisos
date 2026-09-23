import React from 'react';
import { X, Printer } from 'lucide-react';
import LOGO_EMPRESA from '../../assets/LogoNegro.png';

export default function ModalPapeletaPDF({ permiso, onClose }) {
  if (!permiso) return null;

  const imprimir = () => {
    window.print();
  };

  const getTextoFirma = (estado) => {
    if (estado === 'autorizado' || estado === 'aprobado') return '✓ AUTORIZADO';
    if (estado === 'rechazado') return '✗ RECHAZADO';
    return 'PENDIENTE';
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(5px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 6000, padding: '16px'
    }}>
      <div style={{
        backgroundColor: '#ffffff', color: '#000000',
        borderRadius: '12px', width: '100%', maxWidth: '680px',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 50px rgba(0,0,0,0.5)', overflow: 'hidden'
      }}>
        {/* BARRA SUPERIOR (NO SE IMPRIME) */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <span style={{ fontSize: '12px', fontWeight: '800', color: '#475569' }}>
            FORMATO OFICIAL • {permiso.folio}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={imprimir}
              style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', backgroundColor: '#16a34a', color: '#fff', fontSize: '11.5px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <Printer size={13} /> Imprimir / Guardar PDF
            </button>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* PAPELETA OFICIAL (SE IMPRIME EXACTA) */}
        <div className="seccion-impresion-papeleta" style={{ padding: '24px', overflowY: 'auto', fontFamily: 'Arial, sans-serif' }}>
          
          {/* 1. MEMBRETE */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #000', paddingBottom: '10px', marginBottom: '14px' }}>
            <img src={LOGO_EMPRESA} alt="Logo" style={{ height: '36px', objectFit: 'contain' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '13px', fontWeight: '900', letterSpacing: '1px' }}>FORMATO DE PASE Y PERMISO LABORAL</div>
              <div style={{ fontSize: '10px', color: '#555' }}>CONTROL OFICIAL DE NÓMINA Y ASISTENCIA</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '9px', fontWeight: '700', color: '#666' }}>FOLIO OFICIAL</div>
              <div style={{ fontSize: '15px', fontWeight: '900', color: '#000', fontFamily: 'monospace' }}>{permiso.folio}</div>
            </div>
          </div>

          {/* 2. FICHA DEL TRABAJADOR */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '12px', border: '1px solid #000' }}>
            <tbody>
              <tr style={{ background: '#f5f5f5' }}>
                <td style={{ padding: '4px 6px', border: '1px solid #000', fontWeight: 'bold', width: '15%' }}>COLABORADOR:</td>
                <td colSpan={3} style={{ padding: '4px 6px', border: '1px solid #000' }}>{permiso.usuarios?.nombre_completo || 'N/A'}</td>
                <td style={{ padding: '4px 6px', border: '1px solid #000', fontWeight: 'bold', width: '12%' }}>NO. EMP:</td>
                <td style={{ padding: '4px 6px', border: '1px solid #000', fontWeight: 'bold', width: '15%' }}>#{permiso.usuarios?.numero_empleado}</td>
              </tr>
              <tr>
                <td style={{ padding: '4px 6px', border: '1px solid #000', fontWeight: 'bold' }}>DEPARTAMENTO:</td>
                <td style={{ padding: '4px 6px', border: '1px solid #000' }}>{permiso.departamentos?.nombre || 'GENERAL'}</td>
                <td style={{ padding: '4px 6px', border: '1px solid #000', fontWeight: 'bold' }}>ÁREA:</td>
                <td style={{ padding: '4px 6px', border: '1px solid #000' }}>{permiso.usuarios?.area || 'GENERAL'}</td>
                <td style={{ padding: '4px 6px', border: '1px solid #000', fontWeight: 'bold' }}>PUESTO:</td>
                <td style={{ padding: '4px 6px', border: '1px solid #000' }}>{permiso.usuarios?.puesto || 'N/A'}</td>
              </tr>
            </tbody>
          </table>

          {/* 3. DETALLES DE LA SOLICITUD */}
          <div style={{ fontSize: '11px', border: '1px solid #000', padding: '8px', marginBottom: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '6px' }}>
              <div><strong>TIPO DE MOVIMIENTO:</strong> {(permiso.tipo_permiso || 'Pase').toUpperCase()}</div>
              <div><strong>FECHA DEL PERMISO:</strong> {permiso.fecha_permiso}</div>
              <div><strong>HORAS TOTALES:</strong> {permiso.total_horas || 0} hr(s)</div>
            </div>
            {permiso.hora_inicio && (
              <div style={{ marginBottom: '6px' }}>
                <strong>HORARIO SOLICITADO:</strong> De {permiso.hora_inicio} a {permiso.hora_fin} hrs.
              </div>
            )}
            <div>
              <strong>MOTIVO / JUSTIFICACIÓN:</strong>
              <div style={{ marginTop: '3px', padding: '6px', background: '#fafafa', border: '1px dashed #ccc', minHeight: '30px' }}>
                {permiso.asunto_motivo}
              </div>
            </div>
          </div>

          {/* 4. DICTAMEN DE PAGO */}
          <div style={{ fontSize: '11px', border: '1px solid #000', padding: '8px', marginBottom: '14px', background: '#fcfcfd' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>RESOLUCIÓN DE PAGO Y NÓMINA (JEFATURA Y RH):</div>
            <div style={{ display: 'flex', gap: '20px' }}>
              <span>[ {permiso.pago === 'Con goce' ? 'X' : ' '} ] Con goce de sueldo</span>
              <span>[ {permiso.pago === 'Sin goce' ? 'X' : ' '} ] Sin goce de sueldo</span>
              <span>[ {permiso.pago === 'Con tiempo' ? 'X' : ' '} ] Reposición de tiempo</span>
              <span>[ {permiso.pago?.includes('Pendiente') ? 'X' : ' '} ] En proceso de dictamen</span>
            </div>
          </div>

          {/* 5. CUADRO DE FIRMAS OFICIALES */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', textAlign: 'center', fontSize: '9px' }}>
            {/* EMPLEADO */}
            <div style={{ border: '1px solid #000', padding: '6px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '65px' }}>
              <div style={{ fontWeight: 'bold' }}>SOLICITANTE</div>
              <div style={{ color: '#16a34a', fontWeight: 'bold' }}>✓ FIRMA DIGITAL</div>
              <div>{permiso.usuarios?.nombre_completo}</div>
            </div>

            {/* JEFE */}
            <div style={{ border: '1px solid #000', padding: '6px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '65px' }}>
              <div style={{ fontWeight: 'bold' }}>JEFE DE ÁREA</div>
              <div style={{ fontWeight: 'bold', color: permiso.firma_1_estado === 'autorizado' ? '#16a34a' : '#777' }}>
                {getTextoFirma(permiso.firma_1_estado)}
              </div>
              <div>FIRMA 1</div>
            </div>

            {/* GERENCIA */}
            <div style={{ border: '1px solid #000', padding: '6px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '65px' }}>
              <div style={{ fontWeight: 'bold' }}>GERENCIA</div>
              <div style={{ fontWeight: 'bold', color: permiso.firma_2_estado === 'autorizado' ? '#16a34a' : '#777' }}>
                {getTextoFirma(permiso.firma_2_estado)}
              </div>
              <div>FIRMA 2</div>
            </div>

            {/* RH */}
            <div style={{ border: '1px solid #000', padding: '6px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '65px' }}>
              <div style={{ fontWeight: 'bold' }}>RECURSOS HUMANOS</div>
              <div style={{ fontWeight: 'bold', color: permiso.firma_3_estado === 'autorizado' ? '#16a34a' : '#777' }}>
                {getTextoFirma(permiso.firma_3_estado)}
              </div>
              <div>SELLO PRENÓMINA</div>
            </div>
          </div>

          <div style={{ marginTop: '10px', textAlign: 'center', fontSize: '8px', color: '#666' }}>
            Papeleta oficial digital emitida por el sistema para afectación en Kardex de asistencia.
          </div>
        </div>
      </div>
    </div>
  );
}