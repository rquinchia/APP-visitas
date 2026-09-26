import type { EstadoVisita } from '../types'
import { ETIQUETA_ESTADO } from '../types'

const ESTILOS: Record<EstadoVisita, string> = {
  BORRADOR: 'bg-slate-200 text-slate-700',
  EN_REVISION: 'bg-amber-100 text-amber-800',
  ENVIADO_APROBACION: 'bg-amber-100 text-amber-800',
  AJUSTES_SOLICITADOS: 'bg-rose-100 text-rose-800',
  APROBADO: 'bg-emerald-100 text-emerald-800',
  LISTO_PARA_INICIAR: 'bg-emerald-100 text-emerald-800',
  VISITA_ACTIVA: 'bg-sky-100 text-sky-800',
  VISITA_TERMINADA: 'bg-slate-200 text-slate-700',
  SEGUIMIENTO_PENDIENTES: 'bg-amber-100 text-amber-800',
  CERRADO: 'bg-slate-800 text-white',
}

export default function EstadoBadge({ estado }: { estado: EstadoVisita }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${ESTILOS[estado]}`}>
      {ETIQUETA_ESTADO[estado]}
    </span>
  )
}
