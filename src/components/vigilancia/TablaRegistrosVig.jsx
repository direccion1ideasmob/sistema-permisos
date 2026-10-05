import React from 'react';

export default function TablaRegistrosVig({ registros }) {
  if (registros.length === 0) {
    return <p className="text-sm text-slate-400 italic">No hay registros nuevos en esta sesión.</p>;
  }

  return (
    <div className="overflow-x-auto max-h-64 overflow-y-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-700 text-slate-400 text-xs">
            <th className="pb-2">Colaborador</th>
            <th className="pb-2">Hora</th>
            <th className="pb-2">Origen</th>
          </tr>
        </thead>
        <tbody>
          {registros.map((reg) => (
            <tr key={reg.id} className="border-b border-slate-700/50">
              <td className="py-2">
                <p className="font-medium">{reg.nombre}</p>
                <span className="text-[10px] text-slate-400">{reg.motivo}</span>
              </td>
              <td className="py-2 text-slate-300">{reg.hora}</td>
              <td className="py-2">
                {/* Sello discreto casi imperceptible */}
                <span className="px-1.5 py-0.5 text-[10px] rounded bg-slate-700 text-slate-300 font-mono border border-slate-600" title="Generado por Vigilancia">
                  [{reg.origen}]
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}