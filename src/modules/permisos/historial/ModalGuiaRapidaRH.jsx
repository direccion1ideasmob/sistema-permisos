import React, { useState } from 'react';
import {
  X, BookOpen, User, Shield, CheckSquare, FileBarChart,
  Users, Zap, Bell, Lock
} from 'lucide-react';

export default function ModalGuiaRapidaRH({ modoOscuro, onClose }) {
  const [tabActiva, setTabActiva] = useState('rh_autorizaciones');

  const bgCard = modoOscuro ? '#18181b' : '#ffffff';
  const bgSub = modoOscuro ? '#121214' : '#f8fafc';
  const border = modoOscuro ? '#27272a' : '#e2e8f0';
  const text = modoOscuro ? '#f4f4f5' : '#0f172a';
  const textMuted = modoOscuro ? '#a1a1aa' : '#64748b';
  const accent = '#16a34a';
  const bgTabActive = modoOscuro ? '#27272a' : '#0f172a';

  const pestanas = [
    { id: 'rh_autorizaciones', label: '1. Autorizaciones RH', icono: CheckSquare },
    { id: 'rh_historial', label: '2. Control y Asistencia', icono: FileBarChart },
    { id: 'rh_directorio', label: '3. Directorio y Bajas', icono: Users },
    { id: 'vigilancia', label: '4. Caseta / Vigilancia', icono: Shield },
    { id: 'colaboradores', label: '5. Empleados y Jefes', icono: User },
    { id: 'reglas', label: '6. Reglas Automáticas', icono: Zap }
  ];

  const secciones = {
    rh_autorizaciones: [
      {
        titulo: 'Horarios Oficiales de Planta',
        puntos: [
          ['Reloj [07:15 – 17:00]', 'Ubicado arriba en Autorizaciones. Define la hora límite de entrada (tolerancia) y la hora oficial de salida de turno para toda la planta.']
        ]
      },
      {
        titulo: 'Retardos en Puerta (En Vivo)',
        puntos: [
          ['Tarjeta Roja RETARDO', 'Aparece al instante cuando Vigilancia registra en caseta a un trabajador que llegó después de la hora límite. Muestra la hora exacta de llegada a puerta.'],
          ['Botón "✓ Permitir Acceso"', 'Autoriza la entrada (Con goce o Sin goce), asigna Folio Oficial y registra automáticamente su entrada en la lista de Asistencia Diaria.'],
          ['Botón "× Regresar a Casa"', 'Niega el acceso, convierte el registro en Falta por Retardo (Sin goce) con Folio Oficial y ordena a Caseta retirar al colaborador.']
        ]
      },
      {
        titulo: 'Dictamen Final y Folios Oficiales',
        puntos: [
          ['Por Dictaminar / En Tránsito', '"Por Dictaminar" muestra solicitudes listas para resolución de RH. "En Tránsito" muestra las que aún esperan firma de Jefe o Gerente.'],
          ['Condición de Pago', 'Al autorizar Salidas, Faltas o Vacaciones, RH define si aplica "Con goce" o "Sin goce" de sueldo (o Rechazo con motivo).'],
          ['Folios Oficiales', 'Al cerrarse en RH, el folio temporal REQ- cambia por el consecutivo oficial según su nómina: P- (Producción), A- (Administración) u O- (Obra).']
        ]
      }
    ],
    rh_historial: [
      {
        titulo: 'Vista "Permisos" (Historial General)',
        puntos: [
          ['Botón [🎛️ Filtros]', 'Filtra por Periodo (Todo el historial o Por Semana), Tipo de Nómina (Producción, Administración, Obra), Tipo de Incidencia y Resolución.'],
          ['Detalle y Firmas', 'Toca cualquier fila para ver el motivo completo, notas de flujo y quién autorizó (Subárea, Jefe, Gerente, RH).'],
          ['Papeleta PDF', 'Presiona "Papeleta" en la fila para un PDF individual, o marca varias casillas a la izquierda y presiona el icono de impresora (🖨️) arriba.'],
          ['Cancelar Pase desde RH', 'Dentro del detalle desplegado de un permiso autorizado: si el trabajador aún no cruza caseta, RH puede cancelarlo indicando el motivo.'],
          ['Bitácora y Depuración', 'En Filtros → Resolución → "Bitácora de cancelados" puedes ver los pases anulados y usar el botón "Depurar" para borrarlos de la base de datos.'],
          ['Exportar Excel [📥]', 'Abre el generador para descargar el reporte de permisos en Excel filtrado por fechas o nómina.']
        ]
      },
      {
        titulo: 'Vista "Asistencia" (Pase de Lista Diario)',
        puntos: [
          ['Navegador de Fecha (< Hoy >)', 'Consulta la asistencia en tiempo real de hoy o navega a cualquier fecha anterior.'],
          ['Filtros de Asistencia [🎛️]', 'Filtra la lista por Estatus (Todos, En Planta, Justificados, Sin Registro / Faltas) y por Tipo de Nómina.'],
          ['Acciones Rápidas RH (Solo Hoy)', 'Desde la fila del colaborador puedes marcar manualmente "✓ Entrada", registrar "Salida" o deshacer ("↶") una entrada marcada por error.'],
          ['Corte Diario en Excel [📥]', 'Descarga el CSV/Excel con entradas, salidas, retardos y faltas del día. En el día actual se habilita al llegar la hora de salida oficial (17:00) o cuando todos los presentes registraron salida; en días anteriores está siempre disponible.']
        ]
      }
    ],
    rh_directorio: [
      {
        titulo: 'Seguridad y Candado de Edición (🔒 / 🔓)',
        puntos: [
          ['Desbloquear Edición', 'Por protección, el Directorio inicia en modo lectura. Toca el candado (🔒) e ingresa el PIN de administración para habilitar cambios.']
        ]
      },
      {
        titulo: 'Pestaña "Empresa" (Organigrama en Árbol)',
        puntos: [
          ['Estructura por División', 'Agrupa al personal activo en 4 ramas: Planta & Producción, Administración, Capital Humano y Operaciones en Obra.'],
          ['Editar Departamento (✏️)', 'Con el candado abierto (🔓), cambia el nombre del departamento o su clasificación (Planta, Admón, RH, Obra).'],
          ['Reubicar en Árbol (✏️)', 'Con el candado abierto (🔓), toca el lápiz en cualquier colaborador para cambiar su Departamento, Subárea, Puesto, Jefe directo al que reporta y Rol.']
        ]
      },
      {
        titulo: 'Pestaña "Colaboradores" (Expedientes, Altas y Bajas)',
        puntos: [
          ['Botón "+ NUEVO"', 'Registra un nuevo colaborador. Al escribir su nombre y apellido genera en automático su Usuario Login y correo. Permite tomar foto y subir Firma Digital.'],
          ['Expediente Lateral', 'Toca cualquier colaborador para ver sus datos, llamarle por teléfono (📞) o abrir chat directo en WhatsApp (💬).'],
          ['Edición en Cascada y Catálogos', 'Con el candado abierto (🔓), edita cualquier dato del expediente o elige "+ Crear Nueva Sede / Depto / Subárea / Puesto" (incluye detector de nombres similares para no duplicar).'],
          ['Tramitar Baja Laboral', 'Dentro del expediente (con candado 🔓), toca "Tramitar Baja", escribe la palabra BAJA, indica fecha efectiva y motivo. Su estatus pasa a Baja conservando su historial.'],
          ['Reactivar o Eliminar Definitivo', 'Si está dado de baja puedes "Reactivar". El botón rojo "Eliminar Registro y Fotos" (escribiendo ELIMINAR) borra para siempre al usuario, su foto y su firma del servidor.']
        ]
      }
    ],
    vigilancia: [
      {
        titulo: 'Módulo "Pase de Lista" (Entradas y Salidas)',
        puntos: [
          ['Registrar Entrada', 'En la pestaña "Entrada", escribe mínimo 3 letras del apellido o nombre → toca el botón verde (✓) → verifica foto y nombre en la ventana → toca "Confirmar".'],
          ['Trabajador con Retardo', 'Si llega después de la hora límite, el sistema lo pone en "🔔 En Puerta" esperando a RH. Cuando RH autoriza pasa a planta; si RH lo rechaza aparece el botón rojo "Confirmar Retiro".'],
          ['Registrar Salida de Turno', 'En la pestaña "En Planta / Salidas", busca al colaborador → toca "Salida" → "Confirmar".'],
          ['Deshacer Error (↶)', 'Si el guardia marcó entrada o salida por equivocación, en "En Planta / Salidas" toca la flecha curva (↶) junto al trabajador para revertir la marca.']
        ]
      },
      {
        titulo: 'Módulo "Pases de Puerta" (Permisos durante el turno)',
        puntos: [
          ['En Puerta', 'Muestra al personal con pase autorizado listo para cruzar. El guardia toca "Confirmar Salida", "Dar Acceso" o "Confirmar Retiro".'],
          ['Por Regresar', 'Lista a quienes salieron con pase temporal (con regreso). Al volver a planta, el guardia toca "Confirmar Reingreso".'],
          ['Sellados', 'Bitácora de todos los pases que ya fueron sellados físicamente en el día.']
        ]
      }
    ],
    colaboradores: [
      {
        titulo: 'Colaboradores (Solicitar y Consultar Pases)',
        puntos: [
          ['Solicitar Pase', 'Paso 1: Elegir Fecha. Paso 2: Elegir Tipo (Salida, Retardo, Falta, Vacaciones). Paso 3: Categoría (Personal, Cita Médica, Trabajo), horario y motivo.'],
          ['Candados Automáticos', 'El sistema bloquea pedir pases si el trabajador ya tiene el día cerrado (Falta, Vacaciones, Salida definitiva o Regresado en puerta) o pedir Retardo si ya está dentro de planta.'],
          ['Mis Permisos y Cancelación', 'Muestra solicitudes "En Proceso" y "Concluidos". El trabajador puede cancelar su solicitud únicamente si aún no tiene sello físico de caseta.']
        ]
      },
      {
        titulo: 'Encargados, Jefes de Área y Gerentes',
        puntos: [
          ['Cadena de Autorización', 'Nivel 3 (Encargado de Subárea da VoBo) → Nivel 2 (Jefe de Área aprueba) → Nivel 1 (Gerente de División aprueba en Faltas/Vacaciones) → Cierre en RH.'],
          ['Bandeja de Aprobaciones', 'En "Por Dictaminar" aprueban o rechazan (con motivo obligatorio). En "En Tránsito" consultan las solicitudes que ya firmaron y están en manos de RH.']
        ]
      },
      {
        titulo: 'Barra Lateral (Para todos los usuarios)',
        puntos: [
          ['Iconos Superiores (☀️/🌙 y 🔔)', 'El sol/luna cambia entre Modo Claro y Oscuro. La campana (🔔) activa las Alertas Push en el celular o computadora.'],
          ['Foto y PIN de Seguridad (⚙️)', 'Tocando la foto circular se actualiza la fotografía de perfil. El engrane (⚙️) junto al rol permite cambiar la contraseña/PIN personal.']
        ]
      }
    ],
    reglas: [
      {
        titulo: 'Automatizaciones del Sistema (Sin intervención manual)',
        puntos: [
          ['1. Falta sustituye a Retardo', 'Si un trabajador solicita un Retardo temprano pero más tarde reporta una Falta para el mismo día, el sistema cancela el retardo previo en automático y deja solo la Falta.'],
          ['2. Asistencia sustituye a Falta', 'Si un trabajador tenía registrada una Falta para hoy pero sí se presenta a laborar en caseta, el sistema anula la falta previa y registra su asistencia o retardo real.'],
          ['3. Pases de Salida no utilizados (Cierre 17:00 hrs)', 'Al cumplirse la hora oficial de salida de RH, cualquier pase de salida anticipada que no haya sido sellado en caseta se cancela automáticamente como "Sin uso".'],
          ['4. Retardos por App que nunca llegaron (Cierre 17:00 hrs)', 'Si un trabajador pidió permiso de Retardo desde su celular pero nunca registró entrada en caseta en todo el día, al cierre del turno el sistema lo convierte automáticamente en Falta Sin Goce con Folio Oficial.'],
          ['5. Orden Alfabético Universal', 'Todas las listas, tablas, reportes de asistencia y exportaciones a Excel se ordenan automáticamente por Apellido Paterno, Apellido Materno y Nombre.']
        ]
      }
    ]
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(15, 23, 42, 0.72)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px',
        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: bgCard,
          border: `1.5px solid ${border}`,
          borderRadius: '16px',
          width: '100%',
          maxWidth: '720px',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 25px 50px rgba(0,0,0,0.45)'
        }}
      >
        {/* CABECERA */}
        <div style={{
          padding: '14px 18px',
          borderBottom: `1px solid ${border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: bgSub
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <div style={{
              width: '30px', height: '30px', borderRadius: '8px',
              background: 'rgba(22, 163, 74, 0.14)', color: accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <BookOpen size={16} />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '800', color: text, lineHeight: 1.2 }}>
                Manual Operativo del Sistema
              </div>
              <div style={{ fontSize: '11px', fontWeight: '600', color: textMuted }}>
                Guía directa de funciones por módulo y reglas automáticas
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: '30px', height: '30px', borderRadius: '8px',
              border: `1px solid ${border}`, background: bgCard, color: textMuted,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* BARRA DE PESTAÑAS DEL MANUAL (ESTILO NEGRO UNIFICADO) */}
        <div style={{
          display: 'flex',
          gap: '4px',
          padding: '8px 12px',
          background: bgSub,
          borderBottom: `1px solid ${border}`,
          overflowX: 'auto',
          scrollbarWidth: 'none'
        }}>
          {pestanas.map((t) => {
            const Icono = t.icono;
            const activo = tabActiva === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTabActiva(t.id)}
                style={{
                  height: '32px',
                  padding: '0 11px',
                  borderRadius: '7px',
                  border: 'none',
                  background: activo ? bgTabActive : 'transparent',
                  color: activo ? '#ffffff' : textMuted,
                  fontSize: '11.5px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'all 0.15s ease'
                }}
              >
                <Icono size={13} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* CONTENIDO DE LA PESTAÑA ACTIVA */}
        <div style={{
          padding: '16px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          background: bgCard
        }}>
          {(secciones[tabActiva] || []).map((bloque, idx) => (
            <div
              key={idx}
              style={{
                background: bgSub,
                border: `1px solid ${border}`,
                borderRadius: '10px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div style={{
                fontSize: '11.5px',
                fontWeight: '800',
                color: accent,
                textTransform: 'uppercase',
                letterSpacing: '0.03em'
              }}>
                {bloque.titulo}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                {bloque.puntos.map(([accion, descripcion], i) => (
                  <div key={i} style={{ fontSize: '12.5px', lineHeight: 1.45, color: text }}>
                    <strong style={{ fontWeight: '800', color: text }}>• {accion}:</strong>{' '}
                    <span style={{ color: textMuted, fontWeight: '500' }}>{descripcion}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
