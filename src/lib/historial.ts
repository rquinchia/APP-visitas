import { guardarVisita, registrarCambioHistorial } from '../db'
import { generarId, ahoraISO } from './id'
import { ORDEN_ESTADOS } from '../types'
import { pedirTexto } from './dialogo'
import type { Visita } from '../types'

const UMBRAL_MOTIVO_OBLIGATORIO = ORDEN_ESTADOS.indexOf('APROBADO')

/**
 * Registra un cambio del plan en el historial. Una vez el plan fue aprobado, ningún cambio
 * puede sobrescribirlo en silencio: se exige un motivo explícito y el cambio genera una nueva
 * versión del plan. Si el usuario cancela el diálogo de motivo, la operación que llamó a esta
 * función debe abortarse (esta función devuelve null).
 *
 * Devuelve la visita (con la versión actualizada cuando corresponde) para que el llamador
 * mantenga su estado local sincronizado, o null si el cambio debe cancelarse.
 */
export async function registrarCambioPlan(visita: Visita, cambio: string): Promise<Visita | null> {
  const requiereMotivo = ORDEN_ESTADOS.indexOf(visita.estado) >= UMBRAL_MOTIVO_OBLIGATORIO
  let motivo = ''
  let visitaActualizada = visita

  if (requiereMotivo) {
    const respuesta = await pedirTexto({
      titulo: 'Motivo del cambio',
      mensaje: `El plan ya fue aprobado (versión ${visita.version}); este cambio crea la versión ${visita.version + 1}.\n\n«${cambio}»`,
      placeholder: 'Ej. Ajuste solicitado por el cliente',
      aceptar: 'Guardar cambio',
      obligatorio: true,
    })
    if (respuesta === null) return null
    motivo = respuesta
    visitaActualizada = { ...visita, version: visita.version + 1, actualizadoEn: ahoraISO() }
    await guardarVisita(visitaActualizada)
  }

  await registrarCambioHistorial({
    id: generarId(),
    visitaId: visita.id,
    version: visitaActualizada.version,
    fecha: ahoraISO(),
    cambio,
    motivo,
  })
  return visitaActualizada
}
