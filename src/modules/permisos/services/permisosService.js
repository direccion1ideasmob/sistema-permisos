import { supabase } from '../../../core/api/supabaseClient';

export const obtenerPermisosUsuario = async (usuarioId) => {
  if (!usuarioId) return [];
  const { data, error } = await supabase
    .from('permisos')
    .select('*')
    .eq('usuario_id', usuarioId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const escalarPermisoAGerencia = async (permiso) => {
  const { error } = await supabase
    .from('permisos')
    .update({ 
      firma_1_estado: 'escalado',
      observaciones: `${permiso.observaciones || ''} | ⚠️ Escalado a Gerencia por inactividad del Jefe.`
    })
    .eq('id', permiso.id);

  if (error) throw error;

  if (permiso.firma_2_id) {
    const { data: subs } = await supabase
      .from('suscripciones_push')
      .select('subscription')
      .eq('usuario_id', permiso.firma_2_id);

    if (subs && subs.length > 0) {
      const envios = subs.map(async (item) => {
        let subLimpia = item.subscription;
        if (typeof subLimpia === 'string') {
          try { subLimpia = JSON.parse(subLimpia); } catch (_) {}
        }
        const res = await fetch('/api/notificar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription: subLimpia,
            titulo: `⚠️ ESCALAMIENTO: ${permiso.tipo_permiso.toUpperCase()}`,
            mensaje: `El Jefe de Área no respondió a tiempo. Se requiere tu autorización para el folio ${permiso.folio}.`,
            urlDestino: '/aprobaciones'
          })
        });
        return res.json();
      });
      await Promise.allSettled(envios);
    }
  }
};

export const contarReincidenciasRetardo = async (usuarioId, permisoId, fechaCreacion) => {
  if (!usuarioId) return 0;
  const fechaLimite = new Date(fechaCreacion);
  fechaLimite.setDate(fechaLimite.getDate() - 15);
  const { count } = await supabase
    .from('permisos')
    .select('id', { count: 'exact', head: true })
    .eq('usuario_id', usuarioId)
    .eq('tipo_permiso', 'retardo')
    .neq('estado_general', 'rechazado')
    .neq('id', permisoId)
    .gte('fecha_permiso', fechaLimite.toISOString().split('T')[0]);
  return count || 0;
};
