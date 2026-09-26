import type { Actividad, Visita } from '../types'

export interface ResumenAvance {
  completadas: number
  parciales: number
  pendientes: number
  bloqueadas: number
  total: number
  porcentaje: number // 0-100, basado en actividades (completada=1, parcial=0.5)
}

export function calcularAvance(actividades: Actividad[]): ResumenAvance {
  const evaluables = actividades.filter((a) => a.estado !== 'NO_APLICA')
  const completadas = evaluables.filter((a) => a.estado === 'COMPLETADA').length
  const parciales = evaluables.filter((a) => a.estado === 'PARCIAL').length
  const pendientes = evaluables.filter((a) => a.estado === 'PENDIENTE' || a.estado === 'EN_PROGRESO').length
  const bloqueadas = evaluables.filter((a) => a.estado === 'BLOQUEADA').length
  const total = evaluables.length
  const puntaje = completadas + parciales * 0.5
  const porcentaje = total === 0 ? 0 : Math.round((puntaje / total) * 100)
  return { completadas, parciales, pendientes, bloqueadas, total, porcentaje }
}

export function diaActual(visita: Visita): number | null {
  if (!visita.fechaInicio) return null
  const inicio = new Date(visita.fechaInicio)
  const hoy = new Date()
  const inicioUTC = Date.UTC(inicio.getFullYear(), inicio.getMonth(), inicio.getDate())
  const hoyUTC = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  const diff = Math.floor((hoyUTC - inicioUTC) / 86400000) + 1
  if (diff < 1) return 0 // aún no inicia
  if (diff > visita.duracionDias) return visita.duracionDias
  return diff
}
