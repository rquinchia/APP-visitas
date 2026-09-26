import type { EstadoPendiente, PrioridadPendiente } from '../types'
import { ETIQUETA_ESTADO_PENDIENTE, ETIQUETA_PRIORIDAD } from '../types'

const ESTILOS_PRIORIDAD: Record<PrioridadPendiente, string> = {
  P1: 'bg-rose-600 text-white',
  P2: 'bg-orange-500 text-white',
  P3: 'bg-amber-400 text-amber-950',
  P4: 'bg-slate-200 text-slate-700',
}

export function PrioridadBadge({ prioridad }: { prioridad: PrioridadPendiente }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${ESTILOS_PRIORIDAD[prioridad]}`}>
      {ETIQUETA_PRIORIDAD[prioridad]}
    </span>
  )
}

const ESTILOS_ESTADO: Record<EstadoPendiente, string> = {
  ABIERTO: 'bg-sky-100 text-sky-800',
  RESPONSABLE_PENDIENTE: 'bg-amber-100 text-amber-800',
  EN_PROCESO: 'bg-indigo-100 text-indigo-800',
  EN_ESPERA: 'bg-slate-200 text-slate-700',
  CERRADO: 'bg-emerald-100 text-emerald-800',
  CANCELADO: 'bg-slate-200 text-slate-500 line-through',
}

export function EstadoPendienteBadge({ estado }: { estado: EstadoPendiente }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${ESTILOS_ESTADO[estado]}`}>
      {ETIQUETA_ESTADO_PENDIENTE[estado]}
    </span>
  )
}
