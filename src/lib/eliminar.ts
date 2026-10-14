// Flujos de eliminación con confirmación, compartidos entre pantallas.

import { eliminarActividadCompleta, listarFotosPorEntidad, listarPendientesPorVisita } from '../db'
import type { Actividad, Visita } from '../types'
import { confirmar } from './dialogo'
import { avisarCambios } from './eventos'
import { registrarCambioPlan } from './historial'

/**
 * Pide confirmación y elimina una actividad del plan (queda en el historial del plan, con motivo si
 * el plan ya estaba aprobado). Sus hallazgos se conservan como hallazgos generales.
 * Devuelve la visita actualizada, o null si se canceló.
 */
export async function eliminarActividadConfirmando(visita: Visita, actividad: Actividad): Promise<Visita | null> {
  const [hallazgos, fotos] = await Promise.all([listarPendientesPorVisita(visita.id), listarFotosPorEntidad(actividad.id)])
  const suyos = hallazgos.filter((h) => h.actividadId === actividad.id).length
  const detalles = [
    fotos.length ? `Se eliminan sus ${fotos.length} foto(s) de la actividad.` : '',
    suyos ? `Sus ${suyos} hallazgo(s) NO se pierden: quedan como hallazgos generales de la visita, con sus fotos y su código.` : '',
  ].filter(Boolean)
  const ok = await confirmar({
    titulo: `¿Eliminar «${actividad.actividad}»?`,
    mensaje: [`Día ${actividad.dia} del plan.`, ...detalles].join('\n\n'),
    aceptar: 'Eliminar',
    peligro: true,
  })
  if (!ok) return null
  const actualizada = await registrarCambioPlan(visita, `Actividad eliminada (día ${actividad.dia}): ${actividad.actividad}`)
  if (!actualizada) return null
  await eliminarActividadCompleta(actividad.id)
  avisarCambios([actividad.id])
  return actualizada
}
