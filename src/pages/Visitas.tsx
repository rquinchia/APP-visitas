import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Factory, Plus } from 'lucide-react'
import { listarVisitas } from '../db'
import type { TipoVisita, Visita } from '../types'
import { TIPOS_VISITA } from '../types'
import EstadoBadge from '../components/EstadoBadge'
import { IconTile, PageHeader, type ColorIcono } from '../components/ui'

const COLOR_TIPO: Record<TipoVisita, ColorIcono> = { PA: 'azul', SC: 'naranja', FL: 'morado' }

export default function Visitas() {
  const [visitas, setVisitas] = useState<Visita[] | null>(null)

  useEffect(() => {
    listarVisitas().then(setVisitas)
  }, [])

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        titulo="Visitas"
        subtitulo={visitas ? `${visitas.length} registradas` : undefined}
        accion={
          <Link to="/visitas/nueva" aria-label="Nueva visita" className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-white shadow-md shadow-accent/30">
            <Plus className="h-5 w-5" strokeWidth={2.6} />
          </Link>
        }
      />

      {visitas === null && <p className="text-sm text-slate-500">Cargando…</p>}

      {visitas?.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-sm text-slate-500">Aún no hay visitas registradas.</p>
          <Link to="/visitas/nueva" className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white">
            <Plus className="h-4 w-4" strokeWidth={3} /> Nueva visita
          </Link>
        </div>
      )}

      {visitas?.map((v) => (
        <Link
          key={v.id}
          to={`/visitas/${v.id}`}
          className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm shadow-slate-200/60"
        >
          <IconTile icono={Factory} color={COLOR_TIPO[v.tipo]} grande />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold text-slate-900">{v.planta || 'Planta sin definir'}</p>
            <p className="truncate text-xs text-slate-500">
              {TIPOS_VISITA[v.tipo].nombre}
              {v.cliente ? ` · ${v.cliente}` : ''}
            </p>
            <div className="mt-1.5">
              <EstadoBadge estado={v.estado} />
            </div>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" />
        </Link>
      ))}
    </div>
  )
}
