// Aviso entre pantallas de que cambiaron datos (p.ej. el asistente actualizó una actividad), para que
// la pantalla visible se recargue sola sin que el usuario tenga que salir y volver.

import { useEffect, useRef } from 'react'

const EVENTO = 'visitas:datos-cambiados'

export interface DetalleCambio {
  /** Ids de los registros tocados (actividades, hallazgos). */
  ids: string[]
}

export function avisarCambios(ids: string[]): void {
  window.dispatchEvent(new CustomEvent<DetalleCambio>(EVENTO, { detail: { ids } }))
}

export function useDatosCambiados(alCambiar: (detalle: DetalleCambio) => void): void {
  const ref = useRef(alCambiar)
  ref.current = alCambiar
  useEffect(() => {
    const manejador = (e: Event) => ref.current((e as CustomEvent<DetalleCambio>).detail)
    window.addEventListener(EVENTO, manejador)
    return () => window.removeEventListener(EVENTO, manejador)
  }, [])
}
