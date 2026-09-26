import { guardarVisita, registrarCambioHistorial } from '../db'
import { generarId, ahoraISO } from './id'
import type { EstadoVisita, Visita } from '../types'
import { ETIQUETA_ESTADO } from '../types'

export interface Transicion {
  destino: EstadoVisita
  etiqueta: string
  requiereFechaInicio?: boolean
  /** Antes de aplicar esta transición debe mostrarse la vista previa del plan (ver PlanVistaPrevia). */
  requierePlanPreview?: boolean
  /** Antes de aplicar esta transición debe mostrarse el checklist de cierre (ver Cierre). */
  requiereCierre?: boolean
}

export const TRANSICIONES: Partial<Record<EstadoVisita, Transicion[]>> = {
  BORRADOR: [{ destino: 'EN_REVISION', etiqueta: 'Enviar a revisión', requierePlanPreview: true }],
  EN_REVISION: [{ destino: 'ENVIADO_APROBACION', etiqueta: 'Enviar para aprobación', requierePlanPreview: true }],
  ENVIADO_APROBACION: [
    { destino: 'APROBADO', etiqueta: 'Aprobar' },
    { destino: 'AJUSTES_SOLICITADOS', etiqueta: 'Solicitar ajustes' },
  ],
  AJUSTES_SOLICITADOS: [{ destino: 'EN_REVISION', etiqueta: 'Volver a revisión', requierePlanPreview: true }],
  APROBADO: [{ destino: 'LISTO_PARA_INICIAR', etiqueta: 'Marcar listo para iniciar' }],
  LISTO_PARA_INICIAR: [{ destino: 'VISITA_ACTIVA', etiqueta: 'INICIAR VISITA', requiereFechaInicio: true }],
  VISITA_ACTIVA: [{ destino: 'VISITA_TERMINADA', etiqueta: 'TERMINAR VISITA', requiereCierre: true }],
  VISITA_TERMINADA: [{ destino: 'SEGUIMIENTO_PENDIENTES', etiqueta: 'Pasar a seguimiento de pendientes' }],
  SEGUIMIENTO_PENDIENTES: [{ destino: 'CERRADO', etiqueta: 'Cerrar visita' }],
}

export function buscarTransicion(estado: EstadoVisita, destino: EstadoVisita): Transicion | undefined {
  return TRANSICIONES[estado]?.find((t) => t.destino === destino)
}

/**
 * Aplica un cambio de estado del ciclo de vida de la visita: pide confirmación explícita,
 * motivo opcional, y deja constancia en el historial. Ningún estado crítico cambia solo.
 */
export async function aplicarTransicionEstado(visita: Visita, t: Transicion): Promise<Visita | null> {
  if (t.requiereFechaInicio && !visita.fechaInicio) {
    alert('Antes de iniciar la visita, guarda la fecha de inicio.')
    return null
  }
  const confirmado = window.confirm(
    `¿Confirmas: "${t.etiqueta}"?\n\nEstado actual: ${ETIQUETA_ESTADO[visita.estado]}\nNuevo estado: ${ETIQUETA_ESTADO[t.destino]}`,
  )
  if (!confirmado) return null

  const motivo = window.prompt('Motivo del cambio (opcional):', '') ?? ''
  const actualizada: Visita = { ...visita, estado: t.destino, actualizadoEn: ahoraISO() }
  await guardarVisita(actualizada)
  await registrarCambioHistorial({
    id: generarId(),
    visitaId: visita.id,
    version: visita.version,
    fecha: ahoraISO(),
    cambio: `Estado: ${ETIQUETA_ESTADO[visita.estado]} → ${ETIQUETA_ESTADO[t.destino]}`,
    motivo,
  })
  return actualizada
}
