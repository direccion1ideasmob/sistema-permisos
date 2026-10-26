import React, { useState } from 'react';
import {
  X, BookOpen, User, Shield, CheckSquare, FileBarChart,
  Users, Zap
} from 'lucide-react';

export default function ModalGuiaRapidaRH({ modoOscuro, onClose }) {
  const [tabActiva, setTabActiva] = useState('rh_aprobaciones');

  const bgCard = modoOscuro ? '#18181b' : '#ffffff';
  const bgSub = modoOscuro ? '#121214' : '#f8fafc';
  const border = modoOscuro ? '#27272a' : '#e2e8f0';
  const text = modoOscuro ? '#f4f4f5' : '#0f172a';
  const textMuted = modoOscuro ? '#a1a1aa' : '#64748b';
  const accent = '#16a34a';
  const bgTabActive = modoOscuro ? '#27272a' : '#0f172a';

  const pestanas = [
    { id: 'rh_aprobaciones', label: '1. Aprobaciones', icono: CheckSquare },
    { id: 'rh_historial', label: '2. Control / Historial', icono: FileBarChart },
    { id: 'rh_directorio', label: '3. Directorio RH', icono: Users },
    { id: 'caseta', label: '4. Caseta', icono: Shield },
    { id: 'empleados', label: '5. Pases y Perfil', icono: User },
    { id: 'reglas', label: '6. Reglas Automáticas', icono: Zap }
  ];

  const secciones = {
    rh_aprobaciones: [
      {
        titulo: 'Relojes de Turno RH (Configurables en Vivo)',
        puntos: [
          ['Botón [🕒 HH:MM – HH:MM]', 'Ubicado arriba a la derecha en "Aprobaciones". Muestra la Tolerancia de Entrada y la Salida Oficial vigentes (por defecto 07:15 y 17:00, pero RH puede cambiarlas en cualquier momento).'],
          ['Cómo cambiar los horarios', '1) Toca el botón del reloj. 2) Toca el botón "🔒 Candado" para que cambie a "🔓 Abierto". 3) Modifica "Tolerancia Entrada" y/o "Salida Oficial". 4) Presiona "Guardar horarios". Si deseas volver al estándar, usa "Restaurar (07:15 / 17:00)".']
        ]
      },
      {
        titulo: 'Pestañas: "Por Dictaminar" y "En Tránsito"',
        puntos: [
          ['Por Dictaminar', 'Solicitudes que ya cumplieron las firmas previas de su área y están listas para la resolución final de RH.'],
          ['En Tránsito y botón "Saltar Firma"', 'Muestra solicitudes que aún esperan firma de Jefe de Área o Gerencia. Si un jefe no está disponible, RH puede entrar a "En Tránsito" y presionar el botón rojo "Saltar Firma" en la tarjeta para hacer avanzar el pase de inmediato.'],
          ['Vista de Jefes y Gerentes', 'A diferencia de RH, los Jefes y Gerentes ven las pestañas "Por Autorizar" e "Historial de mi Área".']
        ]
      },
      {
        titulo: 'Cómo Resolver Solicitudes y Retardos',
        puntos: [
          ['En Retardos ("Permitir Acceso" / "Regresar a Casa")', 'La tarjeta muestra la hora de llegada a caseta y cuántos retardos previos tiene el trabajador. • Si presionas "Permitir Acceso": eliges la condición de pago y el sistema registra automáticamente su entrada en la asistencia del día. • Si presionas "Regresar a Casa": escribes el motivo, el registro se convierte en "Falta (Retardo) Sin goce" con Folio Oficial y ordena a Caseta retirar al colaborador.'],
          ['En Salidas, Faltas y Vacaciones ("Evaluar" / "Rechazar")', 'Al tocar "Evaluar" se abre la ventana "Resolución de Pase" con las opciones: "Con Goce", "Sin Goce" y "Repone Tiempo" (los Jefes/Gerentes tienen además el botón "Delegar a RH" para dejar la decisión de pago a RH; en Vacaciones sólo aplica "Con Goce"). Puedes escribir una nota opcional y presionar "Firmar y Autorizar".'],
          ['Asignación de Folio Oficial', 'Mientras está en firmas el pase tiene un folio temporal "REQ-XXXXXX". Al autorizarlo RH, recibe su Folio Oficial consecutivo según la nómina del empleado: "P-26-XXXX" (Producción), "A-26-XXXX" (Administración) u "O-26-XXXX" (Obra).']
        ]
      }
    ],
    rh_historial: [
      {
        titulo: 'Switch Superior: [ Permisos | Asistencia ]',
        puntos: [
          ['Cambio de Vista', 'Ubicado arriba a la izquierda en "Control / Historial". Alterna entre la tabla histórica de permisos y el pase de lista diario.']
        ]
      },
      {
        titulo: '1. Vista "Permisos"',
        puntos: [
          ['Buscador y Botón [🎛️ Filtros]', 'Busca por apellido, nombre, folio o # de empleado. Al tocar "[🎛️ Filtros]" puedes filtrar por: • Periodo ("Todo el historial" o "Filtrar por semana..." navegando con < Sem X >). • Tipo de Nómina (Todas, Producción, Administración, Obra). • Tipo de incidencia (Salida anticipada, Retardo, Falta, Falta por retardo, Vacaciones). • Resolución (Activos/Oficiales, Solo autorizados, Solo rechazados/regresados, Bitácora de cancelados).'],
          ['Ver Detalle y "Cancelar pase"', 'Toca cualquier fila para desplegar el motivo, comentarios y quiénes firmaron (Subárea, Jefe, Gerente, RH). Si el pase está autorizado pero aún NO tiene sello físico de caseta, aparece el botón rojo "Cancelar pase" para anularlo indicando el motivo.'],
          ['Bitácora de Cancelados y "Depurar"', 'Los pases cancelados se ocultan de la vista principal para no ensuciar nómina. Para verlos o borrarlos definitivamente de la base de datos, abre "[🎛️ Filtros]" → Resolución → "Bitácora de cancelados" y presiona el botón rojo "Depurar".'],
          ['Papeleta PDF Individual o Masiva', '• Individual: presiona el botón "Papeleta" en la fila del registro. • Masiva: marca las casillas cuadradas a la izquierda de varios registros y presiona el botón de impresora "🖨️ (N)" arriba a la derecha. Dentro de la vista previa presiona "Imprimir / PDF".'],
          ['Generador de Excel [📥 Exportar]', 'Abre la ventana "Exportar Reporte (.CSV / Excel)" donde puedes: 1) Elegir periodo rápido (Esta Semana, Este Mes, Mes Anterior, Todo el Historial) o fechas exactas Desde/Hasta. 2) Filtrar por Tipo de Nómina, Departamento, Tipo de Permiso y Dictamen de Pago. 3) En "Alcance de Colaboradores" dejarlo vacío para exportar a todos, o buscar y "+ Agregar" empleados específicos.']
        ]
      },
      {
        titulo: '2. Vista "Asistencia"',
        puntos: [
          ['Navegador de Fecha (< Fecha >)', 'Muestra el pase de lista del día. Usa las flechas "<" ">" o toca la fecha para abrir el calendario y consultar días anteriores.'],
          ['Botón [🎛️ Filtros] en Asistencia', 'Permite filtrar la lista por: • Estatus de Asistencia (Todos, En Planta, Justificados, Sin Registro / Faltas). • Tipo de Nómina (Todas, Producción, Administración, Obra). • También incluye los "Relojes de Turno RH" y el botón "Actualizar".'],
          ['Marcar o Deshacer desde RH (Solo en fecha HOY)', 'En la fila de cada colaborador RH puede: • Presionar "✓ Entrada" (si llegó y no se registró en caseta). • Presionar "Salida" (para cerrar su jornada). • Presionar la flecha curva "↶" para deshacer una entrada marcada por error hoy.'],
          ['Descargar Corte Diario [📥 Exportar / Al cierre]', 'Descarga el Excel con Hora de Entrada, Hora de Salida, Estatus (Puntual, Retardo, Falta, Justificado) y Folio de cada trabajador. • En el día de HOY: el botón dice "Al cierre" y se desbloquea cuando el reloj alcanza la Hora de Salida Oficial configurada por RH o cuando todos los presentes ya tienen salida registrada. • En fechas anteriores: siempre está habilitado como "Exportar".']
        ]
      }
    ],
    rh_directorio: [
      {
        titulo: 'Candado de Seguridad (🔒 Desbloquear Edición)',
        puntos: [
          ['Modo Lectura vs Edición', 'Para evitar cambios accidentales, tanto la vista "Empresa" como "Colaboradores" inician bloqueadas. Toca el botón del candado ("🔒" / "Desbloquear Edición") e ingresa el PIN de administración para habilitar el modo "🔓 Edición Habilitada".']
        ]
      },
      {
        titulo: 'Vista "Empresa" (Organigrama por División)',
        puntos: [
          ['Expandir / Comprimir', 'Muestra las 4 divisiones: Planta & Producción, Administración, Capital Humano y Operaciones en Obra. Usa el botón superior "Expandir / Comprimir" o toca cada barra para abrir departamentos y subáreas.'],
          ['Editar Departamento (Botón ✏️)', 'Con el candado abierto (🔓), toca el icono de lápiz (✏️) junto al nombre de cualquier departamento para cambiar su nombre o moverlo de clasificación (Planta, Admón, RH, Obra).'],
          ['Reubicar Colaborador en el Árbol (Botón ✏️)', 'Con el candado abierto (🔓), toca el lápiz (✏️) en la tarjeta de cualquier persona para abrir "Reubicación en Estructura" y cambiar: 1. Departamento, 2. Subdepartamento / Área, 3. Puesto, 4. A quién reporta en el organigrama y 5. Rol de Autorización.']
        ]
      },
      {
        titulo: 'Vista "Colaboradores" (Tabla, Altas, Expediente y Bajas)',
        puntos: [
          ['Ordenar Columnas y Filtrar', 'En computadora puedes hacer clic sobre cualquier encabezado de la tabla (Nº EMP, COLABORADOR, SEDE, NÓMINA, DEPARTAMENTO, PUESTO, ESTATUS) para ordenar ascendente o descendente. El botón "Filtrar" abre el buscador y filtros por Sede, Nómina, Depto y Estatus (Solo Activos / Solo Bajas / Todos).'],
          ['Dar de Alta (Botón "+ NUEVO")', 'Abre la ventana "Nuevo Colaborador". • Al escribir Nombre y Apellido Paterno, el sistema autocompleta el "Usuario Login" (ej. juan.perez) y el "Correo Institucional" (@mobiliarium.com), pero ambos campos se pueden borrar y editar manualmente. • Permite tomar foto con cámara o subir archivo, cargar imagen de "Subir Firma" (para las papeletas PDF) y definir su PIN (mínimo 6 caracteres).'],
          ['Crear Nuevas Sedes, Deptos, Áreas o Puestos', 'Tanto al crear un colaborador como al editar su expediente, en los selectores de Sede, Departamento, Subdepto/Área y Puesto puedes elegir la última opción "+ Crear Nueva..." para registrar uno nuevo en el momento (el sistema muestra coincidencias existentes para evitar duplicados).'],
          ['Expediente Lateral y Contacto Directo', 'Al tocar a cualquier colaborador en la lista se abre su expediente a la derecha. En modo lectura incluye botones directos para llamarle por teléfono (📞) o abrirle chat en WhatsApp (💬), además de ver su foto y firma en zoom.'],
          ['Tramitar Baja, Reactivar o Eliminar Definitivo', 'Con el candado abierto (🔓), al final del expediente lateral tienes 3 acciones laborales: • "Tramitar Baja": pide escribir la palabra BAJA, elegir Fecha Efectiva y Motivo de Separación (pasa a inactivo pero conserva todo su historial de permisos y asistencias). • "Reactivar": disponible si el colaborador está en baja. • "Eliminar Registro y Fotos": pide escribir ELIMINAR y borra permanentemente al usuario, su foto y su firma de la base de datos.']
        ]
      }
    ],
    caseta: [
      {
        titulo: 'Módulo 1: "Pase de Lista" (Menú lateral de Caseta)',
        puntos: [
          ['Pestaña "Entrada" (Regla de 3 letras)', 'El guardia debe escribir al menos 3 letras del apellido, nombre o # de empleado. Por seguridad, si hay más de 3 coincidencias el sistema pide escribir una letra más. Luego toca el botón verde "✓" y en la ventana con fotografía presiona "Confirmar".'],
          ['Si el trabajador llega tarde (Recuadro "🔔 En puerta")', 'Si pasa después de la Tolerancia de Entrada configurada por RH, el sistema no lo mete a planta y lo coloca arriba en "🔔 En puerta (En espera y Resoluciones)" con leyenda "En espera de RH". • Si RH autoriza: aparece el botón verde "Dar Paso a Planta" (o se registra su entrada si RH ya lo dictaminó en vivo). • Si RH ordena regresarlo: aparece el botón rojo "Confirmar Retiro".'],
          ['Pestaña "En Planta / Salidas"', 'Muestra a todo el personal que está dentro de planta. • Cuando el trabajador se retira al final de su jornada, el guardia toca "Salida" → "Confirmar". • Si el trabajador salió con pase temporal y regresa, muestra el botón azul "Reingreso".'],
          ['Corregir Errores en Caseta (Botón Deshacer "↶")', 'En la pestaña "En Planta / Salidas", cada trabajador tiene a la derecha un botón con flecha curva ("↶"): si aún no tiene salida, deshace la entrada marcada por error; si ya se le marcó salida, deshace la salida para devolverlo a planta.']
        ]
      },
      {
        titulo: 'Módulo 2: "Pases de Puerta" (Menú lateral de Caseta)',
        puntos: [
          ['Pestaña "En Puerta"', 'Muestra los permisos autorizados listos para cruzar y los retenidos en espera de RH. Según el caso, el guardia presiona: • "Confirmar Salida" (azul, para pases de salida anticipada). • "Dar Acceso" (verde, para entradas/retardos autorizados). • "Confirmar Retiro" (rojo, cuando RH ordena que se regrese a casa).'],
          ['Pestaña "Por Regresar"', 'Lista a los colaboradores que salieron con un pase temporal (con regreso el mismo día). Cuando vuelven a caseta, el guardia presiona "Confirmar Reingreso".'],
          ['Pestaña "Sellados"', 'Bitácora de todos los pases que ya fueron sellados físicamente en caseta durante el día.']
        ]
      }
    ],
    empleados: [
      {
        titulo: 'Módulo "Solicitar Pase" (Colaboradores, Jefes y RH)',
        puntos: [
          ['Paso 1: Fecha', 'Selecciona primero la fecha (permite hasta 7 días hacia atrás o fechas futuras). El sistema revisa en tiempo real si en esa fecha ya tienes incidencias o registros en caseta.'],
          ['Paso 2: Tipo de Movimiento / Permiso', 'Son 4 botones: "Salida Anticipada", "Llegada Tarde", "Falta Programada" y "Vacaciones". • Si en la fecha elegida ya tienes jornada cerrada (Falta, Vacaciones, Salida definitiva o Retiro en puerta) o si ya tienes entrada en planta y quieres pedir "Llegada Tarde" o "Falta", el botón correspondiente aparece bloqueado con candado ("🔒 No disponible") explicando el motivo.'],
          ['Paso 3: Naturaleza, Horarios y Envío', '• En Salida, Llegada Tarde y Falta debes elegir "3. Naturaleza del Asunto": "Personal / Familiar", "Cita Médica" o "Asunto de Trabajo". • En "Salida Anticipada" puedes marcar la casilla "¿Regresas a laborar en el mismo turno? (Salida y reingreso)" e indicar la hora de retorno. • Si pides "Llegada Tarde" para hoy con menos de 1 hora y media de anticipación al límite de entrada (y no es Asunto de Trabajo), se envía como "AVISO DE URGENCIA".']
        ]
      },
      {
        titulo: 'Módulo "Mis Permisos"',
        puntos: [
          ['Pestaña "En Proceso"', 'Muestra tus solicitudes activas con el avance de las 3 firmas (Jefatura, Gerencia, R. Humanos). • Botón "Cancelar solicitud (Ya no la ocuparé)": disponible siempre que el pase aún NO tenga sello físico de caseta. • Botón "Escalar por inactividad": aparece automáticamente cuando la solicitud cumple más de 1 hora pendiente en la firma 1 (Jefatura), permitiendo pasarla a Gerencia.'],
          ['Pestaña "Concluidos"', 'Agrupa tu historial por mes y año mostrando el Folio Oficial asignado, el dictamen de pago y los sellos de entrada/salida de caseta.']
        ]
      },
      {
        titulo: 'Opciones del Menú Lateral (Perfil, Alertas y PIN)',
        puntos: [
          ['Modo Claro/Oscuro (☀️/🌙) y Alertas Push (🔔)', 'En la parte superior del menú lateral: el sol/luna cambia el tema visual y la campana (🔔) activa las notificaciones en el navegador del celular o PC.'],
          ['Foto de Perfil, Nombre y Seguridad (⚙️)', '• Toca tu fotografía circular para abrir "Tomar foto" o "Elegir imagen". • Solo usuarios con rol de RH o Superadmin pueden hacer clic sobre su propio nombre en el menú lateral para editarlo. • El botón del engrane (⚙️) junto a tu rol abre la configuración de Seguridad y PIN personal.']
        ]
      }
    ],
    reglas: [
      {
        titulo: 'Reglas y Cierres Automáticos del Sistema',
        puntos: [
          ['1. Cadena Jerárquica de Firmas', '• Empleado de Subárea con Encargado (Nivel 3): el Encargado da VoBo → pasa al Jefe de Área (Firma 1) → en Faltas/Vacaciones pasa al Gerente de División (Firma 2) → cierra RH (Firma 3). • En Salidas y Retardos normales la Firma 2 (Gerencia) se omite automáticamente para agilizar el flujo.'],
          ['2. Reporte de Falta cancela Retardo previo', 'Si un colaborador solicitó una "Llegada Tarde" para hoy pero antes de entrar a planta registra una "Falta Programada" para el mismo día, el sistema cancela automáticamente el retardo previo ("Sustituido por reporte de FALTA").'],
          ['3. Entrada física en Caseta cancela Falta previa', 'Si el colaborador tenía una Falta registrada para hoy pero sí se presenta en Caseta y se registra su entrada (o retardo en puerta), el sistema cancela la falta previa en automático.'],
          ['4. Depuración al cumplir la Hora de Salida Oficial de RH', 'Cuando el reloj alcanza la "Salida Oficial" configurada en Relojes de Turno RH (ej. 17:00 hrs): • Todo pase de "Salida Anticipada" del día que nunca fue sellado en caseta se cancela automáticamente por falta de uso. • Todo pase de "Llegada Tarde" solicitado por app que nunca registró entrada en caseta durante toda la jornada se convierte automáticamente en "Falta Sin Goce" con su Folio Oficial.'],
          ['5. Ordenamiento Alfabético Estándar', 'En todas las pantallas del sistema, buscadores, papeletas y archivos Excel descargables, los nombres se muestran y ordenan siempre por Apellido Paterno, Apellido Materno y Nombre.']
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
        background: 'rgba(15, 23, 42, 0.75)',
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
          maxWidth: '780px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 25px 50px rgba(0,0,0,0.5)'
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: 'rgba(22, 163, 74, 0.14)', color: accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0
            }}>
              <BookOpen size={17} />
            </div>
            <div>
              <div style={{ fontSize: '14.5px', fontWeight: '800', color: text, lineHeight: 1.2 }}>
                Guía Operativa del Sistema (RH)
              </div>
              <div style={{ fontSize: '11.5px', fontWeight: '600', color: textMuted, marginTop: '2px' }}>
                Referencia exacta de botones, opciones configurables y reglas automáticas
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: '30px', height: '30px', borderRadius: '8px',
              border: `1px solid ${border}`, background: bgCard, color: textMuted,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* PESTAÑAS (MISMO DISEÑO NEGRO UNIFICADO) */}
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

        {/* CONTENIDO DE LA SECCIÓN */}
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

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {bloque.puntos.map(([accion, descripcion], i) => (
                  <div key={i} style={{ fontSize: '12.5px', lineHeight: 1.48, color: text }}>
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
