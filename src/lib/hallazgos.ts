import type { Actividad, Pendiente, PrioridadPendiente, Visita } from '../types'
import { estaAbierto } from '../types'
import { fechaDelDia } from './progreso'
import { hoyLocal } from './id'

const ORDEN_PRIORIDAD: Record<PrioridadPendiente, number> = { P1: 0, P2: 1, P3: 2, P4: 3 }

/**
 * Número de cada hallazgo de una visita. Se respeta el número guardado (`numero`); a los que no lo
 * tienen (datos anteriores) o lo tienen repetido (p.ej. tras combinar respaldos de dos dispositivos)
 * se les asigna el siguiente libre en orden de registro. Para datos anteriores esto da 1, 2, 3… en
 * orden de registro: los mismos códigos que ya mostraban los informes.
 */
export function asignarNumeros(pendientesVisita: Pendiente[], minimoSiguiente = 0): Map<string, number> {
  const ordenados = [...pendientesVisita].sort((a, b) => a.creadoEn.localeCompare(b.creadoEn) || a.id.localeCompare(b.id))
  const usados = new Set<number>()
  const resultado = new Map<string, number>()
  const sinNumero: Pendiente[] = []
  for (const p of ordenados) {
    if (p.numero && !usados.has(p.numero)) {
      usados.add(p.numero)
      resultado.set(p.id, p.numero)
    } else sinNumero.push(p)
  }
  let siguiente = Math.max(minimoSiguiente, ...usados, 0) + 1
  for (const p of sinNumero) resultado.set(p.id, siguiente++)
  return resultado
}

/**
 * Código corto y permanente por visita (H-01, H-02…). Es el mismo en la app, en WhatsApp y en el
 * correo; eliminar un hallazgo no renumera a los demás.
 */
export function codigosHallazgos(pendientesVisita: Pendiente[]): Map<string, string> {
  const numeros = asignarNumeros(pendientesVisita)
  const ancho = Math.max(2, String(Math.max(0, ...numeros.values())).length)
  return new Map([...numeros].map(([id, n]) => [id, `H-${String(n).padStart(ancho, '0')}`]))
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
