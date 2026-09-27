import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listarActividadesPorVisita, listarTodosPendientes, listarVisitas } from '../db'
import type { Pendiente, Visita } from '../types'
import { FECHA_POR_DEFECTO, RESPONSABLE_POR_DEFECTO, TIPOS_VISITA } from '../types'
import EstadoBadge from '../components/EstadoBadge'
import BarraProgreso from '../components/BarraProgreso'
import { calcularAvance, diaActual, type ResumenAvance } from '../lib/progreso'
import { PageHeader, SectionTitle } from '../components/ui'
import { Plus } from 'lucide-react'

interface VisitaConAvance {
  visita: Visita
  avance: ResumenAvance
}

function resumenPendientes(pendientes: Pendiente[]) {
  const hoy = new Date().toISOString().slice(0, 10)
  const abiertos = pendientes.filter((p) => p.estado !== 'CERRADO' && p.estado !== 'CANCELADO')
  return {
    p1: abiertos.filter((p) => p.prioridad === 'P1').length,
    p2: abiertos.filter((p) => p.prioridad === 'P2').length,
    abiertos: abiertos.length,
    sinResponsable: abiertos.filter((p) => p.responsable === RESPONSABLE_POR_DEFECTO).length,
    sinFecha: abiertos.filter((p) => p.fechaCompromiso === FECHA_POR_DEFECTO).length,
    vencidos: abiertos.filter((p) => p.fechaCompromiso !== FECHA_POR_DEFECTO && p.fechaCompromiso < hoy).length,
  }
}

export default function Dashboard() {
  const [items, setItems] = useState<VisitaConAvance[] | null>(null)
  const [pendientes, setPendientes] = useState<Pendiente[]>([])

  useEffect(() => {
    let cancelado = false
    async function cargar() {
      const [visitas, todosPendientes] = await Promise.all([listarVisitas(), listarTodosPendientes()])
      const conAvance = await Promise.all(
        visitas.map(async (visita) => ({
          visita,
          avance: calcularAvance(await listarActividadesPorVisita(visita.id)),
        })),
      )
      if (!cancelado) {
        setItems(conAvance)
        setPendientes(todosPendientes)
      }
    }
    cargar()
    return () => {
      cancelado = true
    }
  }, [])

  if (items === null) {
    return <p className="text-sm text-slate-500">Cargando…</p>
  }

  const activas = items.filter((i) => i.visita.estado !== 'CERRADO')
  const rp = resumenPendientes(pendientes)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        titulo="Panel"
        subtitulo={new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}
        accion={
          <Link to="/visitas/nueva" aria-label="Nueva visita" className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-white shadow-md shadow-accent/30">
            <Plus className="h-5 w-5" strokeWidth={2.6} />
          </Link>
        }
      />

      <SectionTitle>Pendientes</SectionTitle>
      <Link to="/pendientes" className="-mt-2 grid grid-cols-3 gap-2 rounded-2xl border border-slate-200/70 bg-white p-3 shadow-sm shadow-slate-200/60">
        <ResumenCelda etiqueta="P1 críticos" valor={rp.p1} alerta={rp.p1 > 0} />
        <ResumenCelda etiqueta="P2 altos" valor={rp.p2} alerta={rp.p2 > 0} />
        <ResumenCelda etiqueta="Abiertos" valor={rp.abiertos} />
        <ResumenCelda etiqueta="Sin responsable" valor={rp.sinResponsable} alerta={rp.sinResponsable > 0} />
        <ResumenCelda etiqueta="Sin fecha" valor={rp.sinFecha} alerta={rp.sinFecha > 0} />
        <ResumenCelda etiqueta="Vencidos" valor={rp.vencidos} alerta={rp.vencidos > 0} />
      </Link>

      <SectionTitle>Visitas en curso</SectionTitle>

      {activas.length === 0 && (
        <div className="-mt-2 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-sm text-slate-500">Todavía no hay visitas creadas.</p>
          <Link to="/visitas/nueva" className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-accent/30">
            <Plus className="h-4 w-4" strokeWidth={3} /> Crear la primera visita
          </Link>
        </div>
      )}

      {activas.map(({ visita, avance }) => {
        const dia = diaActual(visita)
        return (
          <Link
            key={visita.id}
            to={`/visitas/${visita.id}`}
            className="-mt-1 block rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm shadow-slate-200/60"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{TIPOS_VISITA[visita.tipo].nombre}</p>
                <p className="text-base font-semibold text-slate-900">{visita.planta || 'Planta sin definir'}</p>
              </div>
              <EstadoBadge estado={visita.estado} />
            </div>

            <p className="mt-1 text-sm text-slate-500">
              {dia !== null && dia > 0 ? `Día ${dia}/${visita.duracionDias}` : `${visita.duracionDias} días planificados`}
            </p>

            <div className="mt-3">
              <div className="mb-1 flex justify-between text-xs text-slate-500">
                <span>Avance</span>
                <span>{avance.porcentaje}%</span>
              </div>
              <BarraProgreso porcentaje={avance.porcentaje} />
            </div>

            <div className="mt-3 grid grid-cols-4 gap-1 text-center text-xs text-slate-500">
              <div>
                <div className="font-semibold text-slate-800">{avance.completadas}</div>
                Completadas
              </div>
              <div>
                <div className="font-semibold text-slate-800">{avance.parciales}</div>
                Parciales
              </div>
              <div>
                <div className="font-semibold text-slate-800">{avance.pendientes}</div>
                Pendientes
              </div>
              <div>
                <div className="font-semibold text-slate-800">{avance.bloqueadas}</div>
                Bloqueadas
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

function ResumenCelda({ etiqueta, valor, alerta }: { etiqueta: string; valor: number; alerta?: boolean }) {
  return (
    <div className="text-center">
      <div className={`text-lg font-bold ${alerta ? 'text-rose-600' : 'text-slate-900'}`}>{valor}</div>
      <div className="text-[11px] leading-tight text-slate-500">{etiqueta}</div>
    </div>
  )
}
