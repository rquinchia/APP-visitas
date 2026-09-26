import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listarVisitas } from '../db'
import type { Visita } from '../types'
import { TIPOS_VISITA } from '../types'
import EstadoBadge from '../components/EstadoBadge'

export default function Visitas() {
  const [visitas, setVisitas] = useState<Visita[] | null>(null)

  useEffect(() => {
    listarVisitas().then(setVisitas)
  }, [])

  return (
    <div className="flex flex-col gap-3">
      <Link
        to="/visitas/nueva"
        className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-accent/50 bg-accent/5 py-3 text-sm font-semibold text-accent active:bg-accent/10"
      >
        + Nueva visita
      </Link>

      {visitas === null && <p className="text-sm text-slate-500">Cargando…</p>}

      {visitas?.length === 0 && <p className="text-sm text-slate-500">Aún no hay visitas registradas.</p>}

      {visitas?.map((v) => (
        <Link
          key={v.id}
          to={`/visitas/${v.id}`}
          className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 active:bg-slate-50"
        >
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{TIPOS_VISITA[v.tipo].nombre}</p>
            <p className="font-semibold text-slate-900">{v.planta || 'Planta sin definir'}</p>
            <p className="text-xs text-slate-500">{v.cliente || 'Cliente sin definir'}</p>
          </div>
          <EstadoBadge estado={v.estado} />
        </Link>
      ))}
    </div>
  )
}
