// Registro de lo eliminado ("lápidas"). Viaja en el respaldo para que, al "Combinar" en otro
// dispositivo, lo eliminado no reaparezca y se elimine también allá. Guarda el número de cada
// hallazgo eliminado para que su código H-xx no se reutilice nunca.

export type TipoEliminado = 'visita' | 'actividad' | 'pendiente' | 'foto' | 'historial'

export interface Eliminado {
  id: string
  tipo: TipoEliminado
  en: string
  visitaId?: string
  /** Solo hallazgos: su número (H-xx) para no reutilizarlo. */
  numero?: number
}

const CLAVE = 'app_visitas_eliminados'

export function leerEliminados(): Eliminado[] {
  try {
    const crudo = localStorage.getItem(CLAVE)
    return crudo ? (JSON.parse(crudo) as Eliminado[]) : []
  } catch {
    return []
  }
}

function escribir(lista: Eliminado[]) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(lista))
  } catch {
    // sin almacenamiento disponible: la eliminación local igual se hizo
  }
}

export function registrarEliminados(nuevos: Eliminado[]): void {
  if (nuevos.length === 0) return
  const actuales = leerEliminados()
  const ids = new Set(actuales.map((e) => e.id))
  escribir([...actuales, ...nuevos.filter((e) => !ids.has(e.id))])
}

/** Al "Reemplazar todo" el respaldo manda: su registro de eliminados sustituye al local. */
export function reemplazarEliminados(lista: Eliminado[]): void {
  escribir(lista)
}

export function idsEliminados(): Set<string> {
  return new Set(leerEliminados().map((e) => e.id))
}

/** Número más alto de hallazgo que se usó en una visita (incluye los eliminados). */
export function maxNumeroEliminado(visitaId: string): number {
  return Math.max(0, ...leerEliminados().filter((e) => e.visitaId === visitaId && e.numero).map((e) => e.numero!))
}
