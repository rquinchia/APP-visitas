import type { Actividad, Pendiente, PrioridadPendiente, Visita } from '../types'
import { estaAbierto } from '../types'
import { fechaDelDia } from './progreso'
import { hoyLocal } from './id'

const ORDEN_PRIORIDAD: Record<PrioridadPendiente, number> = { P1: 0, P2: 1, P3: 2, P4: 3 }

/**
 * Código corto y estable por visita (H-01, H-02…) según el orden de registro. Es el mismo en la app,
 * en WhatsApp y en el correo, para que todos hablen del mismo hallazgo.
 */
export function codigosHallazgos(pendientesVisita: Pendiente[]): Map<string, string> {
  const ordenados = [...pendientesVisita].sort((a, b) => a.creadoEn.localeCompare(b.creadoEn))
  const ancho = Math.max(2, String(ordenados.length).length)
  return new Map(ordenados.map((p, i) => [p.id, `H-${String(i + 1).padStart(ancho, '0')}`]))
}

/** Prioridad (P1 primero) y luego orden de registro. */
export function ordenarHallazgos(lista: Pendiente[]): Pendiente[] {
  return [...lista].sort((a, b) => ORDEN_PRIORIDAD[a.prioridad] - ORDEN_PRIORIDAD[b.prioridad] || a.creadoEn.localeCompare(b.creadoEn))
}

/**
 * Hallazgos que corresponden a un día de la visita: los registrados en actividades de ese día,
 * los creados en esa fecha y los resueltos en esa fecha (aunque se hayan identificado antes).
 */
export function hallazgosDelDia(visita: Visita, dia: number, actividadesDia: Actividad[], pendientes: Pendiente[]): Pendiente[] {
  const fecha = fechaDelDia(visita, dia) ?? hoyLocal()
  const idsActividades = new Set(actividadesDia.map((a) => a.id))
  return pendientes.filter(
    (p) =>
      p.estado !== 'CANCELADO' &&
      ((p.actividadId && idsActividades.has(p.actividadId)) || p.fecha === fecha || p.fechaSolucion === fecha),
  )
}

export function pendientesAbiertos(pendientes: Pendiente[]): Pendiente[] {
  return ordenarHallazgos(pendientes.filter(estaAbierto))
}

export function estaVencido(p: Pendiente, hoy = hoyLocal()): boolean {
  return estaAbierto(p) && /^\d{4}-\d{2}-\d{2}$/.test(p.fechaCompromiso) && p.fechaCompromiso < hoy
}
