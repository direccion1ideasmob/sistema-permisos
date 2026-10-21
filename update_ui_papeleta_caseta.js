const fs = require('fs');

// ============================================================================
// 1. TablaHistorial.jsx: Extraer todas las notas del flujo y soportar "Se regresa"
// ============================================================================
let th = fs.readFileSync('src/modules/permisos/historial/TablaHistorial.jsx', 'utf8');

const fnParseVieja = `export const parsearDatosObservaciones = (obs = '') => {
  const texto = String(obs || '');
  const horarioSolicitado = (texto.split('|')[0] || '')
    .replace(/🕒|📅/g, '')
    .trim();

  const mSalida = texto.match(/\\[SALIDA CASETA:\\s*([^\\]]+)\\]/i);
  const mEntrada = texto.match(/\\[(?:ENTRADA|REINGRESO) CASETA:\\s*([^\\]]+)\\]/i);
  const mSubarea = texto.match(/VoBo Sub[áa]rea:\\s*([^|]+)/i);
  const mRechazo = texto.match(/RECHAZO:\\s*([^|]+)/i) || texto.match(/Rechazado por Jefatura:\\s*([^|]+)/i);

  return {
    horarioSolicitado: horarioSolicitado || 'Jornada completa',
    horaSalidaCaseta: mSalida ? mSalida[1].trim() : null,
    horaEntradaCaseta: mEntrada ? mEntrada[1].trim() : null,
    requiereRegreso: texto.toLowerCase().includes('regresa:'),
    supervisorSubarea: mSubarea ? mSubarea[1].trim() : null,
    motivoRechazo: mRechazo ? mRechazo[1].trim() : null
  };
};`;

const fnParseNueva = `export const parsearDatosObservaciones = (obs = '') => {
  const texto = String(obs || '');
  const segmentos = texto.split('|').map(s => s.trim()).filter(Boolean);
  const horarioSolicitado = (segmentos[0] || '')
    .replace(/🕒|📅/g, '')
    .trim();

  const mSalida = texto.match(/\\[SALIDA CASETA:\\s*([^\\]]+)\\]/i);
  const mEntrada = texto.match(/\\[(?:ENTRADA|REINGRESO) CASETA:\\s*([^\\]]+)\\]/i);
  const mRegresado = texto.match(/\\[REGRESADO EN PUERTA:\\s*([^\\]]+)\\]/i);
  const mSubarea = texto.match(/VoBo Sub[áa]rea:\\s*([^|]+)/i);
  const mRechazo = texto.match(/RECHAZO:\\s*([^|]+)/i) || texto.match(/Rechazado por Jefatura:\\s*([^|]+)/i);

  const notasFlujo = [];
  segmentos.slice(1).forEach(seg => {
    const mNota = seg.match(/^Nota\\s+([^:]+):\\s*(.+)$/i);
    if (mNota) {
      notasFlujo.push({ autor: mNota[1].trim(), texto: mNota[2].trim() });
      return;
    }
    const mRes = seg.match(/^Res:\\s*(.+)$/i);
    if (mRes) {
      notasFlujo.push({ autor: 'Autorización', texto: mRes[1].trim() });
    }
  });

  return {
    horarioSolicitado: horarioSolicitado || 'Jornada completa',
    horaSalidaCaseta: mSalida ? mSalida[1].trim() : null,
    horaEntradaCaseta: mEntrada ? mEntrada[1].trim() : null,
    horaRegresadoCaseta: mRegresado ? mRegresado[1].trim() : null,
    requiereRegreso: texto.toLowerCase().includes('regresa:'),
    supervisorSubarea: mSubarea ? mSubarea[1].trim() : null,
    motivoRechazo: mRechazo ? mRechazo[1].trim() : null,
    notasFlujo
  };
};`;

th = th.replace(/export const parsearDatosObservaciones = [\s\S]*?^\};/m, fnParseNueva);
fs.writeFileSync('src/modules/permisos/historial/TablaHistorial.jsx', th, 'utf8');
console.log('✅ TablaHistorial.jsx actualizado');

// ============================================================================
// 2. TarjetaAprobacion.jsx: Mostrar comentarios previos y pre-dictamen "Se regresa"
// ============================================================================
let tarj = fs.readFileSync('src/modules/permisos/autorizacion/TarjetaAprobacion.jsx', 'utf8');

tarj = tarj.replace(
  "    let nombreSubarea = null;\n    let nombreJefe = null;\n    let nombreGerente = null;\n\n    for (const s of partes.slice(1)) {",
  "    let nombreSubarea = null;\n    let nombreJefe = null;\n    let nombreGerente = null;\n    const notasPrevias = [];\n\n    for (const s of partes.slice(1)) {\n      const mNota = s.match(/^Nota\\s+([^:]+):\\s*(.+)\$/i);\n      if (mNota) notasPrevias.push({ autor: mNota[1].trim(), texto: mNota[2].trim() });\n      const mRes = s.match(/^Res:\\s*(.+)\$/i);\n      if (mRes) notasPrevias.push({ autor: 'Nota', texto: mRes[1].trim() });"
);

tarj = tarj.replace(
  "    return { horarioRaw, nombreSubarea, nombreJefe, nombreGerente };\n  };\n\n  const { horarioRaw, nombreSubarea, nombreJefe, nombreGerente } = analizarDatos(solicitud.observaciones);",
  "    return { horarioRaw, nombreSubarea, nombreJefe, nombreGerente, notasPrevias };\n  };\n\n  const { horarioRaw, nombreSubarea, nombreJefe, nombreGerente, notasPrevias } = analizarDatos(solicitud.observaciones);"
);

tarj = tarj.replace(
  `        <div style={{ fontSize: '12px', color: c.textSubtle, lineHeight: 1.35 }}>
          {etiqueta && (
            <span style={{ fontWeight: '700', color: c.textMuted }}>
              {etiqueta}:{' '}
            </span>
          )}
          <span style={{ fontWeight: '600', color: c.text }}>"{redaccion}"</span>
        </div>
      </div>`,
  `        <div style={{ fontSize: '12px', color: c.textSubtle, lineHeight: 1.35 }}>
          {etiqueta && (
            <span style={{ fontWeight: '700', color: c.textMuted }}>
              {etiqueta}:{' '}
            </span>
          )}
          <span style={{ fontWeight: '600', color: c.text }}>"{redaccion}"</span>
        </div>

        {notasPrevias && notasPrevias.length > 0 && (
          <div style={{
            marginTop: '4px', paddingTop: '5px', borderTop: \`1px dashed \${c.border}\`,
            display: 'flex', flexDirection: 'column', gap: '2px'
          }}>
            {notasPrevias.map((n, idx) => (
              <div key={idx} style={{ fontSize: '11.5px', color: c.textSubtle }}>
                <strong style={{ color: c.accent }}>💬 {n.autor}:</strong> {n.texto}
              </div>
            ))}
          </div>
        )}
      </div>`
);

fs.writeFileSync('src/modules/permisos/autorizacion/TarjetaAprobacion.jsx', tarj, 'utf8');
console.log('✅ TarjetaAprobacion.jsx actualizado');
