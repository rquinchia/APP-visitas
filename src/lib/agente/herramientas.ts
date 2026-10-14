// Herramientas que el asistente puede usar sobre la app. Cada acción que modifica datos devuelve
// cómo deshacerla, para que el usuario pueda revertir con un toque.
//
// Límites deliberados (reglas del proyecto): el asistente NO cambia el estado de la visita (enviar a
// aprobación, iniciar, terminar), NO crea ni elimina actividades del plan y NO adjunta fotos; eso lo
// hace el usuario en la app con confirmación explícita.

import { eliminarPendiente, guardarActividad, guardarPendiente, obtenerActividad, obtenerPendiente } from '../../db'
import type { CategoriaPendiente, EstadoActividad, EstadoPendiente, Pendiente, PrioridadPendiente } from '../../types'
import {
  CATEGORIAS_PENDIENTE,
  ESTADOS_PENDIENTE,
  ETIQUETA_ESTADO_ACTIVIDAD,
  FECHA_POR_DEFECTO,
  PRIORIDADES_PENDIENTE,
  RESPONSABLE_POR_DEFECTO,
} from '../../types'
import { ahoraISO, generarId, hoyLocal } from '../id'
import { codigosHallazgos } from '../hallazgos'
import { avisarCambios } from '../eventos'
import { refActividad, type DatosContexto } from './contexto'
import { informeActivo } from './informeActivo'
import { listarPendientesPorVisita, siguienteNumeroHallazgo } from '../../db'

const ESTADOS_ACTIVIDAD = Object.keys(ETIQUETA_ESTADO_ACTIVIDAD) as EstadoActividad[]

export interface Pregunta {
  texto: string
  opciones: string[]
  multiple: boolean
}

export interface AccionRealizada {
  resumen: string
  deshacer?: () => Promise<void>
  /** Ruta de la app para ver/completar (p.ej. agregar fotos al hallazgo). */
  enlace?: string
  enlaceTexto?: string
}

export interface ResultadoHerramienta {
  respuesta: Record<string, unknown>
  accion?: AccionRealizada
  pregunta?: Pregunta
}

export interface EntornoHerramientas {
  datos: DatosContexto
  navegar: (ruta: string) => void
}

// ───────────────────────────── Declaraciones (lo que ve el modelo) ─────────────────────────────

const camposHallazgo = {
  descripcion: { type: 'string', description: 'Qué se identificó (el "antes"), redactado de forma clara y profesional.' },
  equipo: { type: 'string', description: 'Equipo o componente afectado.' },
  prioridad: { type: 'string', enum: PRIORIDADES_PENDIENTE, description: 'P1 crítica, P2 alta, P3 media, P4 baja.' },
  categoria: { type: 'string', enum: CATEGORIAS_PENDIENTE },
  impacto: { type: 'string' },
  accion_propuesta: { type: 'string' },
  responsable: { type: 'string', description: 'Persona o área responsable.' },
  fecha_compromiso: { type: 'string', description: 'Fecha compromiso en formato AAAA-MM-DD.' },
  solucion: { type: 'string', description: 'El "después": qué se hizo, cómo quedó y qué se mejoró.' },
  resuelto: { type: 'boolean', description: 'true para marcarlo como resuelto (cerrado).' },
}

export interface DefinicionHerramienta {
  name: string
  description: string
  /** JSON Schema (sirve tal cual para Gemini y para Claude). */
  parameters: { type: 'object'; properties: Record<string, unknown>; required?: string[] }
}

/**
 * Siempre el mismo conjunto, en el mismo orden: Claude exige que las herramientas no cambien durante la
 * conversación (si no, descarta su razonamiento previo) y así también se aprovecha el caché. Las del
 * informe responden con un error si no hay un informe abierto.
 */
export function definicionesHerramientas(): DefinicionHerramienta[] {
  const base: DefinicionHerramienta[] = [
    {
      name: 'actualizar_actividad',
      description: 'Cambia el estado y/o la observación de una actividad del plan (registro diario).',
      parameters: {
        type: 'object',
        properties: {
          actividad: { type: 'string', description: 'Referencia de la actividad (act_xxxxxx).' },
          estado: { type: 'string', enum: ESTADOS_ACTIVIDAD },
          observacion: { type: 'string', description: 'Texto completo de la observación (reemplaza el anterior; inclúyelo si solo agregas).' },
        },
        required: ['actividad'],
      },
    },
    {
      name: 'crear_hallazgo',
      description: 'Registra un hallazgo/observación nuevo, ligado a una actividad o general.',
      parameters: {
        type: 'object',
        properties: {
          actividad: { type: 'string', description: 'Referencia act_xxxxxx, o "general" si no corresponde a una actividad.' },
          ...camposHallazgo,
        },
        required: ['actividad', 'descripcion'],
      },
    },
    {
      name: 'actualizar_hallazgo',
      description: 'Modifica un hallazgo existente (cualquier campo, su solución o su estado).',
      parameters: {
        type: 'object',
        properties: {
          hallazgo: { type: 'string', description: 'Código del hallazgo, p.ej. H-03.' },
          estado: { type: 'string', enum: ESTADOS_PENDIENTE },
          ...camposHallazgo,
        },
        required: ['hallazgo'],
      },
    },
    {
      name: 'preguntar_usuario',
      description:
        'Hace una pregunta con opciones para que el usuario elija con un toque. Úsala cuando falte un dato o haya ambigüedad, en vez de preguntar en texto libre.',
      parameters: {
        type: 'object',
        properties: {
          pregunta: { type: 'string' },
          opciones: { type: 'array', items: { type: 'string' }, description: 'Entre 2 y 6 opciones cortas.' },
          seleccion_multiple: { type: 'boolean' },
        },
        required: ['pregunta', 'opciones'],
      },
    },
    {
      name: 'abrir_pantalla',
      description: 'Lleva al usuario a una pantalla de la app de la visita en contexto.',
      parameters: {
        type: 'object',
        properties: {
          pantalla: { type: 'string', enum: ['visita', 'hoy', 'plan', 'reporte', 'cierre', 'pendientes', 'hallazgo'] },
          dia: { type: 'integer', description: 'Día de la visita (para hoy, plan y reporte).' },
          hallazgo: { type: 'string', description: 'Código H-xx (para pantalla "hallazgo").' },
        },
        required: ['pantalla'],
      },
    },
  ]
  const informe: DefinicionHerramienta[] = [
    {
      name: 'editar_texto_informe',
      description:
        'Solo con un informe abierto en pantalla (Reporte del día o Cierre). Reemplaza un fragmento exacto del texto del correo que el usuario está revisando (respeta formato y fotos). El fragmento debe copiarse tal cual del TEXTO DEL CORREO y ser corto (dentro de una misma frase).',
      parameters: {
        type: 'object',
        properties: { buscar: { type: 'string' }, reemplazar: { type: 'string' } },
        required: ['buscar', 'reemplazar'],
      },
    },
    {
      name: 'agregar_punto_resumen',
      description: 'Solo con un informe abierto. Agrega una viñeta al "Resumen ejecutivo" del correo.',
      parameters: { type: 'object', properties: { texto: { type: 'string' } }, required: ['texto'] },
    },
    {
      name: 'reemplazar_whatsapp',
      description: 'Solo con un informe abierto. Reemplaza el texto completo del mensaje de WhatsApp (conserva el formato *negrita* y los emojis).',
      parameters: { type: 'object', properties: { texto: { type: 'string' } }, required: ['texto'] },
    },
    {
      name: 'cambiar_asunto',
      description: 'Solo con un informe abierto. Cambia el asunto del correo.',
      parameters: { type: 'object', properties: { texto: { type: 'string' } }, required: ['texto'] },
    },
    {
      name: 'regenerar_informe',
      description:
        'Solo con un informe abierto. Vuelve a generar el correo y el WhatsApp desde los datos actuales (úsalo después de corregir datos de actividades o hallazgos). Descarta las ediciones manuales del informe.',
      parameters: { type: 'object', properties: {} },
    },
  ]
  return [...base, ...informe]
}

// ───────────────────────────── Ejecución ─────────────────────────────

type Args = Record<string, unknown>

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : undefined)

function buscarActividad(d: DatosContexto, ref: unknown) {
  const r = str(ref)
  return d.actividades.find((a) => refActividad(a) === r || a.id === r)
}

function buscarHallazgo(d: DatosContexto, codigo: unknown) {
  const c = str(codigo)?.toUpperCase()
  return d.hallazgos.find((h) => d.codigos.get(h.id) === c || h.id === str(codigo))
}

function fechaValida(f: string | undefined): string | undefined {
  return f && /^\d{4}-\d{2}-\d{2}$/.test(f) ? f : undefined
}

function aplicarCamposHallazgo(base: Pendiente, a: Args): Pendiente {
  const p = { ...base }
  if (str(a.descripcion)) p.descripcion = str(a.descripcion)!
  if (a.equipo !== undefined) p.equipo = str(a.equipo) ?? ''
  if (PRIORIDADES_PENDIENTE.includes(a.prioridad as PrioridadPendiente)) p.prioridad = a.prioridad as PrioridadPendiente
  if (CATEGORIAS_PENDIENTE.includes(a.categoria as CategoriaPendiente)) p.categoria = a.categoria as CategoriaPendiente
  if (a.impacto !== undefined) p.impacto = str(a.impacto) ?? ''
  if (a.accion_propuesta !== undefined) p.accionPropuesta = str(a.accion_propuesta) ?? ''
  if (a.responsable !== undefined) p.responsable = str(a.responsable) || RESPONSABLE_POR_DEFECTO
  if (a.fecha_compromiso !== undefined) p.fechaCompromiso = fechaValida(str(a.fecha_compromiso)) ?? FECHA_POR_DEFECTO
  if (a.solucion !== undefined) p.solucion = str(a.solucion) || undefined
  if (ESTADOS_PENDIENTE.includes(a.estado as EstadoPendiente)) p.estado = a.estado as EstadoPendiente
  if (a.resuelto === true) p.estado = 'CERRADO'
  if (a.resuelto === false && p.estado === 'CERRADO') p.estado = 'EN_PROCESO'
  p.fechaSolucion = p.estado === 'CERRADO' ? (base.fechaSolucion ?? hoyLocal()) : undefined
  p.actualizadoEn = ahoraISO()
  return p
}

export async function ejecutarHerramienta(nombre: string, args: Args, env: EntornoHerramientas): Promise<ResultadoHerramienta> {
  const d = env.datos
  const visita = d.visita

  switch (nombre) {
    case 'preguntar_usuario': {
      const opciones = Array.isArray(args.opciones) ? args.opciones.map(String).filter(Boolean).slice(0, 8) : []
      return {
        respuesta: {},
        pregunta: { texto: str(args.pregunta) ?? '', opciones, multiple: args.seleccion_multiple === true },
      }
    }

    case 'actualizar_actividad': {
      const a = buscarActividad(d, args.actividad)
      if (!a) return { respuesta: { error: `No existe la actividad ${String(args.actividad)}.` } }
      const anterior = (await obtenerActividad(a.id)) ?? a
      const nueva = { ...anterior, actualizadoEn: ahoraISO() }
      const cambios: string[] = []
      if (ESTADOS_ACTIVIDAD.includes(args.estado as EstadoActividad) && args.estado !== anterior.estado) {
        nueva.estado = args.estado as EstadoActividad
        cambios.push(`estado → ${ETIQUETA_ESTADO_ACTIVIDAD[nueva.estado]}`)
      }
      if (typeof args.observacion === 'string' && args.observacion.trim() !== anterior.observacion) {
        nueva.observacion = args.observacion.trim()
        cambios.push('observación actualizada')
      }
      if (cambios.length === 0) return { respuesta: { ok: true, nota: 'Sin cambios: ya tenía esos valores.' } }
      await guardarActividad(nueva)
      avisarCambios([a.id])
      return {
        respuesta: { ok: true, cambios },
        accion: {
          resumen: `«${a.actividad}»: ${cambios.join(', ')}`,
          deshacer: async () => {
            await guardarActividad(anterior)
            avisarCambios([a.id])
          },
        },
      }
    }

    case 'crear_hallazgo': {
      if (!visita) return { respuesta: { error: 'No hay una visita en contexto.' } }
      const descripcion = str(args.descripcion)
      if (!descripcion) return { respuesta: { error: 'Falta la descripción.' } }
      const act = str(args.actividad) === 'general' ? undefined : buscarActividad(d, args.actividad)
      if (str(args.actividad) !== 'general' && !act) return { respuesta: { error: `No existe la actividad ${String(args.actividad)}.` } }
      const ahora = ahoraISO()
      const base: Pendiente = {
        id: generarId(),
        visitaId: visita.id,
        planta: visita.planta,
        fecha: hoyLocal(),
        equipo: act?.equipoProceso ?? '',
        descripcion,
        categoria: 'Otro',
        impacto: '',
        prioridad: 'P3',
        accionPropuesta: '',
        responsable: RESPONSABLE_POR_DEFECTO,
        fechaCompromiso: FECHA_POR_DEFECTO,
        estado: 'ABIERTO',
        comentarios: '',
        actividadId: act?.id,
        numero: await siguienteNumeroHallazgo(visita.id),
        creadoEn: ahora,
        actualizadoEn: ahora,
      }
      const nuevo = aplicarCamposHallazgo(base, args)
      await guardarPendiente(nuevo)
      const codigo = codigosHallazgos(await listarPendientesPorVisita(visita.id)).get(nuevo.id) ?? ''
      avisarCambios([nuevo.id])
      return {
        respuesta: { ok: true, codigo },
        accion: {
          resumen: `Hallazgo ${codigo} creado${act ? ` en «${act.actividad}»` : ''}: ${nuevo.descripcion}`,
          deshacer: async () => {
            await eliminarPendiente(nuevo.id, { reservarNumero: false })
            avisarCambios([nuevo.id])
          },
          enlace: `/pendientes/${nuevo.id}/editar`,
          enlaceTexto: 'Abrir para agregar fotos',
        },
      }
    }

    case 'actualizar_hallazgo': {
      const h = buscarHallazgo(d, args.hallazgo)
      if (!h) return { respuesta: { error: `No existe el hallazgo ${String(args.hallazgo)}.` } }
      const anterior = (await obtenerPendiente(h.id)) ?? h
      const nuevo = aplicarCamposHallazgo(anterior, args)
      await guardarPendiente(nuevo)
      avisarCambios([h.id])
      const codigo = d.codigos.get(h.id)
      return {
        respuesta: { ok: true, codigo, estado: nuevo.estado },
        accion: {
          resumen: `Hallazgo ${codigo} actualizado${nuevo.estado === 'CERRADO' && anterior.estado !== 'CERRADO' ? ' y marcado como resuelto' : ''}`,
          deshacer: async () => {
            await guardarPendiente(anterior)
            avisarCambios([h.id])
          },
          enlace: `/pendientes/${h.id}/editar`,
          enlaceTexto: 'Ver hallazgo',
        },
      }
    }

    case 'abrir_pantalla': {
      if (!visita) return { respuesta: { error: 'No hay una visita en contexto.' } }
      const dia = Number(args.dia) || undefined
      const p = str(args.pantalla)
      let ruta = `/visitas/${visita.id}`
      if (p === 'hoy' || p === 'plan' || p === 'reporte') ruta += `/${p}${dia ? `?dia=${dia}` : ''}`
      else if (p === 'cierre') ruta += '/cierre'
      else if (p === 'pendientes') ruta = `/pendientes?visitaId=${visita.id}`
      else if (p === 'hallazgo') {
        const h = buscarHallazgo(d, args.hallazgo)
        if (!h) return { respuesta: { error: `No existe el hallazgo ${String(args.hallazgo)}.` } }
        ruta = `/pendientes/${h.id}/editar`
      }
      env.navegar(ruta)
      return { respuesta: { ok: true, abierta: p } }
    }
  }

  // Herramientas del informe abierto
  const informe = informeActivo()
  if (!informe) return { respuesta: { error: 'No hay un informe abierto en pantalla.' } }
  const foto = informe.instantanea()
  const deshacer = async () => informe.restaurar(foto)

  switch (nombre) {
    case 'editar_texto_informe': {
      const veces = informe.reemplazarEnCorreo(String(args.buscar ?? ''), String(args.reemplazar ?? ''))
      if (veces === 0) return { respuesta: { error: 'No encontré ese texto exacto en el correo. Usa un fragmento más corto, copiado tal cual.' } }
      return { respuesta: { ok: true, reemplazos: veces }, accion: { resumen: `Correo ajustado (${veces} cambio${veces === 1 ? '' : 's'})`, deshacer } }
    }
    case 'agregar_punto_resumen': {
      const ok = informe.agregarAlResumen(String(args.texto ?? ''))
      if (!ok) return { respuesta: { error: 'No encontré el resumen ejecutivo en el correo.' } }
      return { respuesta: { ok: true }, accion: { resumen: 'Punto agregado al resumen ejecutivo', deshacer } }
    }
    case 'reemplazar_whatsapp': {
      informe.fijarWhatsApp(String(args.texto ?? ''))
      return { respuesta: { ok: true }, accion: { resumen: 'Mensaje de WhatsApp actualizado', deshacer } }
    }
    case 'cambiar_asunto': {
      informe.fijarAsunto(String(args.texto ?? ''))
      return { respuesta: { ok: true }, accion: { resumen: 'Asunto del correo actualizado', deshacer } }
    }
    case 'regenerar_informe': {
      await informe.regenerar()
      return { respuesta: { ok: true }, accion: { resumen: 'Informe regenerado con los datos actuales', deshacer } }
    }
  }
  return { respuesta: { error: `Herramienta desconocida: ${nombre}` } }
}
