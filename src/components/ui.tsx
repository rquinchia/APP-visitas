import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react'

/** Encabezado de pantalla estilo iOS: botón atrás arriba, título grande y subtítulo. */
export function PageHeader({
  titulo,
  subtitulo,
  atras,
  atrasEtiqueta = 'Atrás',
  accion,
}: {
  titulo: string
  subtitulo?: ReactNode
  atras?: string
  atrasEtiqueta?: string
  accion?: ReactNode
}) {
  const navigate = useNavigate()
  return (
    <div className="mb-4">
      {atras && (
        <button
          type="button"
          onClick={() => navigate(atras)}
          className="-ml-1.5 mb-1 flex items-center gap-0.5 text-[15px] font-medium text-accent"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
          {atrasEtiqueta}
        </button>
      )}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-[28px] font-bold leading-tight tracking-tight text-slate-900">{titulo}</h2>
          {subtitulo && <div className="mt-0.5 text-sm text-slate-500">{subtitulo}</div>}
        </div>
        {accion}
      </div>
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm shadow-slate-200/60 ${className}`}>{children}</div>
}

/** Título pequeño en mayúsculas sobre un grupo, como en Ajustes de iOS. */
export function SectionTitle({ children }: { children: ReactNode }) {
  return <p className="mb-1.5 mt-5 px-1 text-[12px] font-semibold uppercase tracking-wide text-slate-400">{children}</p>
}

const COLORES_ICONO = {
  azul: 'bg-sky-500',
  verde: 'bg-emerald-500',
  naranja: 'bg-orange-500',
  rojo: 'bg-rose-500',
  morado: 'bg-violet-500',
  gris: 'bg-slate-500',
  indigo: 'bg-indigo-500',
  ambar: 'bg-amber-500',
} as const

export type ColorIcono = keyof typeof COLORES_ICONO

export function IconTile({ icono: Icono, color, grande }: { icono: LucideIcon; color: ColorIcono; grande?: boolean }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center text-white ${COLORES_ICONO[color]} ${
        grande ? 'h-11 w-11 rounded-[14px]' : 'h-8 w-8 rounded-[9px]'
      }`}
    >
      <Icono className={grande ? 'h-6 w-6' : 'h-[18px] w-[18px]'} strokeWidth={2.2} />
    </span>
  )
}

/** Grupo de filas con divisores, como las listas agrupadas de iOS. */
export function ListGroup({ children }: { children: ReactNode }) {
  return (
    <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/60">
      {children}
    </div>
  )
}

export function ListRow({
  to,
  onClick,
  icono,
  color = 'azul',
  titulo,
  detalle,
  valor,
}: {
  to?: string
  onClick?: () => void
  icono?: LucideIcon
  color?: ColorIcono
  titulo: ReactNode
  detalle?: ReactNode
  valor?: ReactNode
}) {
  const contenido = (
    <>
      {icono && <IconTile icono={icono} color={color} />}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-medium text-slate-900">{titulo}</div>
        {detalle && <div className="truncate text-xs text-slate-500">{detalle}</div>}
      </div>
      {valor && <div className="shrink-0 text-sm text-slate-400">{valor}</div>}
      {(to || onClick) && <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" strokeWidth={2.5} />}
    </>
  )
  const clases = 'flex w-full items-center gap-3 px-4 py-3 text-left active:bg-slate-50'
  if (to) {
    return (
      <Link to={to} className={clases}>
        {contenido}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={clases}>
        {contenido}
      </button>
    )
  }
  return <div className={clases}>{contenido}</div>
}

/** Botón grande de acción principal. */
export function BotonPrimario({
  children,
  onClick,
  disabled,
  tono = 'accent',
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  tono?: 'accent' | 'oscuro' | 'verde'
}) {
  const colores = { accent: 'bg-accent', oscuro: 'bg-slate-900', verde: 'bg-emerald-600' }[tono]
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center justify-center gap-2 rounded-2xl ${colores} py-3.5 text-[15px] font-semibold text-white shadow-sm disabled:opacity-50`}
    >
      {children}
    </button>
  )
}

export function BotonSecundario({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-3 text-[15px] font-medium text-slate-700 disabled:opacity-50"
    >
      {children}
    </button>
  )
}
