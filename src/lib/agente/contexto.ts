// Lo que el asistente "ve": la pantalla actual y los datos de la visita en curso, resumidos en texto.
// No incluye fotos. Se reconstruye en cada turno, así siempre trabaja sobre los datos vigentes.

import { listarActividadesPorVisita, listarPendientesPorVisita, listarVisitas, obtenerPendiente } from '../../db'
import type { Actividad, Pendiente, Visita } from '../../types'
import { ETIQUETA_ESTADO_ACTIVIDAD, ETIQUETA_ESTADO_PENDIENTE, TIPOS_VISITA } from '../../types'
import { codigosHallazgos } from '../hallazgos'
import { calcularAvance, diaActual, fechaDelDia } from '../progreso'
import { hoyLocal } from '../id'
import { informeActivo } from './informeActivo'

export type Pantalla = 'panel' | 'visitas' | 'visita' | 'hoy' | 'plan' | 'reporte' | 'cierre' | 'pendientes' | 'hallazgo' | 'otra'

export interface UbicacionApp {
  pantalla: Pantalla
  visitaId?: string
  dia?: number
  hallazgoId?: string
}

/** Interpreta la ruta del HashRouter (sin el '#'). */
export function interpretarRuta(pathname: string, search: string): UbicacionApp {
  const q = new URLSearchParams(search)
  const dia = Number(q.get('dia')) || undefined
  let m = /^\/visitas\/([^/]+)\/(hoy|plan|reporte|cierre)/.exec(pathname)
  if (m) return { pantalla: m[2] as Pantalla, visitaId: m[1], dia }
  m = /^\/visitas\/([^/]+)$/.exec(pathname)
  if (m && m[1] !== 'nueva') return { pantalla: 'visita', visitaId: m[1] }
  m = /^\/pendientes\/([^/]+)\/editar/.exec(pathname)
  if (m) return { pantalla: 'hallazgo', hallazgoId: m[1] }
  if (pathname.startsWith('/pendientes')) return { pantalla: pathname === '/pendientes' ? 'pendientes' : 'hallazgo', visitaId: q.get('visitaId') ?? undefined }
  if (pathname === '/visitas') return { pantalla: 'visitas' }
  if (pathname === '/' || pathname === '') return { pantalla: 'panel' }
  return { pantalla: 'otra' }
}

/** Referencia corta y estable de una actividad para el modelo (evita UUID largos). */
export function refActividad(a: Actividad): string {
  return `act_${a.id.replace(/-/g, '').slice(0, 6)}`
}

export interface DatosContexto {
  ubicacion: UbicacionApp
  visita: Visita | null
  actividades: Actividad[]
  hallazgos: Pendiente[]
  codigos: Map<string, string>
  diaEnFoco: number | null
}

export async function cargarDatosContexto(ubicacion: UbicacionApp): Promise<DatosContexto> {
  let visitaId = ubicacion.visitaId
  if (!visitaId && ubicacion.hallazgoId) visitaId = (await obtenerPendiente(ubicacion.hallazgoId))?.visitaId
  const visitas = await listarVisitas()
  const visita =
    visitas.find((v) => v.id === visitaId) ?? visitas.find((v) => v.estado === 'VISITA_ACTIVA') ?? visitas[0] ?? null
  if (!visita) return { ubicacion, visita: null, actividades: [], hallazgos: [], codigos: new Map(), diaEnFoco: null }
  const [actividades, hallazgos] = await Promise.all([listarActividadesPorVisita(visita.id), listarPendientesPorVisita(visita.id)])
  const hoy = diaActual(visita)
  const diaEnFoco = ubicacion.dia ?? (hoy && hoy > 0 ? hoy : null)
  return { ubicacion, visita, actividades, hallazgos, codigos: codigosHallazgos(hallazgos), diaEnFoco }
}

const NOMBRE_PANTALLA: Record<Pantalla, string> = {
  panel: 'Panel principal',
  visitas: 'Lista de visitas',
  visita: 'Detalle de la visita',
  hoy: 'Registro del día ("Hoy")',
  plan: 'Plan de actividades',
  reporte: 'Reporte del día (correo y WhatsApp)',
  cierre: 'Cierre de visita e informe final',
  pendientes: 'Lista de pendientes/hallazgos',
  hallazgo: 'Formulario de un hallazgo',
  otra: 'Otra pantalla',
}

function linea(...partes: (string | undefined | false)[]) {
  return partes.filter(Boolean).join(' | ')
}

export function contextoComoTexto(d: DatosContexto): string {
  const L: string[] = []
  L.push(`FECHA DE HOY: ${hoyLocal()}`)
  L.push(`PANTALLA ACTUAL: ${NOMBRE_PANTALLA[d.ubicacion.pantalla]}`)
  if (!d.visita) {
    L.push('No hay visitas creadas todavía.')
    return L.join('\n')
  }
  const v = d.visita
  const av = calcularAvance(d.actividades)
  L.push('')
  L.push('VISITA EN CONTEXTO:')
  L.push(
    linea(
      `planta: ${v.planta || '(sin nombre)'}`,
      `tipo: ${TIPOS_VISITA[v.tipo].nombre}`,
      v.cliente && `cliente: ${v.cliente}`,
      `estado: ${v.estado}`,
      `duración: ${v.duracionDias} días`,
      v.fechaInicio ? `inicio: ${v.fechaInicio}` : 'sin fecha de inicio',
      `avance total: ${av.porcentaje}%`,
    ),
  )
  if (d.diaEnFoco) L.push(`DÍA EN FOCO: ${d.diaEnFoco}${fechaDelDia(v, d.diaEnFoco) ? ` (${fechaDelDia(v, d.diaEnFoco)})` : ''}`)

  L.push('')
  L.push('ACTIVIDADES (ref | día | orden | nombre | tipo | estado | observación):')
  if (d.actividades.length === 0) L.push('(ninguna)')
  for (const a of d.actividades) {
    L.push(
      linea(
        refActividad(a),
        `día ${a.dia}`,
        `#${a.orden}`,
        a.actividad + (a.emergente ? ' (emergente)' : ''),
        a.tipo || '-',
        `${a.estado} (${ETIQUETA_ESTADO_ACTIVIDAD[a.estado]})`,
        a.observacion ? `obs: ${a.observacion.replace(/\s+/g, ' ')}` : undefined,
      ),
    )
  }

  L.push('')
  L.push('HALLAZGOS (código | actividad | prioridad | estado | descripción | equipo | acción | responsable | compromiso | solución):')
  if (d.hallazgos.length === 0) L.push('(ninguno)')
  const ordenados = [...d.hallazgos].sort((a, b) => a.creadoEn.localeCompare(b.creadoEn))
  for (const h of ordenados) {
    const act = d.actividades.find((a) => a.id === h.actividadId)
    L.push(
      linea(
        d.codigos.get(h.id),
        act ? refActividad(act) : 'general',
        h.prioridad,
        `${h.estado} (${ETIQUETA_ESTADO_PENDIENTE[h.estado]})`,
        h.descripcion.replace(/\s+/g, ' '),
        h.equipo && `equipo: ${h.equipo}`,
        h.accionPropuesta && `acción: ${h.accionPropuesta.replace(/\s+/g, ' ')}`,
        `resp: ${h.responsable}`,
        `compromiso: ${h.fechaCompromiso}`,
        h.solucion && `solución: ${h.solucion.replace(/\s+/g, ' ')}${h.fechaSolucion ? ` (${h.fechaSolucion})` : ''}`,
        `registrado: ${h.fecha}`,
      ),
    )
  }

  if (d.ubicacion.pantalla === 'hallazgo' && d.ubicacion.hallazgoId) {
    L.push('')
    L.push(`HALLAZGO ABIERTO EN PANTALLA: ${d.codigos.get(d.ubicacion.hallazgoId) ?? '(nuevo, aún sin guardar)'}`)
  }

  const informe = informeActivo()
  if (informe && (d.ubicacion.pantalla === 'reporte' || d.ubicacion.pantalla === 'cierre')) {
    L.push('')
    L.push(`INFORME ABIERTO (${informe.tipo === 'diario' ? `reporte del día ${d.diaEnFoco ?? ''}` : 'informe final'}). Esto es lo que el usuario ve ahora:`)
    L.push(`ASUNTO DEL CORREO: ${informe.asunto()}`)
    L.push('--- TEXTO DEL CORREO ---')
    L.push(informe.textoCorreo().slice(0, 12000))
    L.push('--- TEXTO DE WHATSAPP ---')
    L.push(informe.textoWhatsApp())
    L.push('--- FIN DEL INFORME ---')
  }
  return L.join('\n')
}
