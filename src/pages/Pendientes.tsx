import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { listarTodosPendientes, listarVisitas } from '../db'
import type { EstadoPendiente, Pendiente, PrioridadPendiente, Visita } from '../types'
import { ESTADOS_PENDIENTE, FECHA_POR_DEFECTO, PRIORIDADES_PENDIENTE, RESPONSABLE_POR_DEFECTO } from '../types'
import { PrioridadBadge, EstadoPendienteBadge } from '../components/PendienteBadges'

const ORDEN_PRIORIDAD: Record<PrioridadPendiente, number> = { P1: 0, P2: 1, P3: 2, P4: 3 }

export default function Pendientes() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const visitaIdFiltro = params.get('visitaId')
  const [pendientes, setPendientes] = useState<Pendiente[] | null>(null)
  const [visitas, setVisitas] = useState<Visita[]>([])
  const [filtroEstado, setFiltroEstado] = useState<'ABIERTOS' | 'TODOS' | EstadoPendiente>('ABIERTOS')
  const [filtroPrioridad, setFiltroPrioridad] = useState<'TODAS' | PrioridadPendiente>('TODAS')

  useEffect(() => {
    Promise.all([listarTodosPendientes(), listarVisitas()]).then(([p, v]) => {
      setPendientes(p)
      setVisitas(v)
    })
  }, [])

  function nombrePlanta(visitaId: string) {
    return visitas.find((v) => v.id === visitaId)?.planta || 'Planta sin definir'
  }

  function onNuevo() {
    if (visitas.length === 0) {
      alert('Primero crea una visita: los pendientes quedan asociados a la visita donde se detectaron.')
      navigate('/visitas/nueva')
      return
    }
    navigate(visitaIdFiltro ? `/pendientes/nuevo?visitaId=${visitaIdFiltro}` : '/pendientes/nuevo')
  }

  if (pendientes === null) return <p className="text-sm text-slate-500">Cargando…</p>

  const hoy = new Date().toISOString().slice(0, 10)
  let filtrados = visitaIdFiltro ? pendientes.filter((p) => p.visitaId === visitaIdFiltro) : pendientes
  filtrados = filtrados.filter((p) =>
    filtroEstado === 'TODOS' ? true : filtroEstado === 'ABIERTOS' ? p.estado !== 'CERRADO' && p.estado !== 'CANCELADO' : p.estado === filtroEstado,
  )
  if (filtroPrioridad !== 'TODAS') filtrados = filtrados.filter((p) => p.prioridad === filtroPrioridad)
  filtrados = filtrados.sort((a, b) => ORDEN_PRIORIDAD[a.prioridad] - ORDEN_PRIORIDAD[b.prioridad] || a.fecha.localeCompare(b.fecha))

  return (
    <div className="flex flex-col gap-4">
      {visitaIdFiltro && (
        <div className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
          <span>Mostrando solo: {nombrePlanta(visitaIdFiltro)}</span>
          <Link to="/pendientes" className="font-medium text-accent">
            Ver todos
          </Link>
        </div>
      )}

      <button
        onClick={onNuevo}
        className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-accent/50 bg-accent/5 py-3 text-sm font-semibold text-accent active:bg-accent/10"
      >
        + Nuevo pendiente
      </button>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value as typeof filtroEstado)}
          className="shrink-0 rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
        >
          <option value="ABIERTOS">Abiertos</option>
          <option value="TODOS">Todos los estados</option>
          {ESTADOS_PENDIENTE.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        <select
          value={filtroPrioridad}
          onChange={(e) => setFiltroPrioridad(e.target.value as typeof filtroPrioridad)}
          className="shrink-0 rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
        >
          <option value="TODAS">Todas las prioridades</option>
          {PRIORIDADES_PENDIENTE.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {filtrados.length === 0 && <p className="text-sm text-slate-500">No hay pendientes con estos filtros.</p>}

      {filtrados.map((p) => {
        const vencido = p.fechaCompromiso !== FECHA_POR_DEFECTO && p.fechaCompromiso < hoy && p.estado !== 'CERRADO' && p.estado !== 'CANCELADO'
        return (
          <Link
            key={p.id}
            to={`/pendientes/${p.id}/editar`}
            className="block rounded-xl border border-slate-200 bg-white p-4 active:bg-slate-50"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  {nombrePlanta(p.visitaId)} · {p.categoria}
                </p>
                <p className="truncate text-sm font-semibold text-slate-900">{p.descripcion || '(sin descripción)'}</p>
                {p.equipo && <p className="text-xs text-slate-500">{p.equipo}</p>}
              </div>
              <PrioridadBadge prioridad={p.prioridad} />
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <EstadoPendienteBadge estado={p.estado} />
              <span className={`text-xs ${p.responsable === RESPONSABLE_POR_DEFECTO ? 'font-semibold text-rose-600' : 'text-slate-500'}`}>
                {p.responsable}
              </span>
              <span className={`text-xs ${vencido ? 'font-semibold text-rose-600' : p.fechaCompromiso === FECHA_POR_DEFECTO ? 'font-semibold text-rose-600' : 'text-slate-500'}`}>
                {vencido ? `Vencido (${p.fechaCompromiso})` : p.fechaCompromiso}
              </span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
