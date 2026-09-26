import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { guardarVisita, listarActividadesPorVisita, obtenerVisita } from '../db'
import { ahoraISO } from '../lib/id'
import type { Actividad, Visita } from '../types'
import { TIPOS_VISITA } from '../types'
import EstadoBadge from '../components/EstadoBadge'
import BarraProgreso from '../components/BarraProgreso'
import { calcularAvance } from '../lib/progreso'
import { TRANSICIONES, aplicarTransicionEstado, type Transicion } from '../lib/transiciones'

export default function VisitaDetalle() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [visita, setVisita] = useState<Visita | null | undefined>(undefined)
  const [actividades, setActividades] = useState<Actividad[]>([])
  const [fechaInicio, setFechaInicio] = useState('')

  useEffect(() => {
    if (!id) return
    obtenerVisita(id).then((v) => {
      setVisita(v ?? null)
      setFechaInicio(v?.fechaInicio ?? '')
    })
    listarActividadesPorVisita(id).then(setActividades)
  }, [id])

  if (visita === undefined) return <p className="text-sm text-slate-500">Cargando…</p>
  if (visita === null) return <p className="text-sm text-rose-600">Visita no encontrada.</p>

  async function guardarFechaInicio() {
    if (!visita) return
    const actualizada: Visita = { ...visita, fechaInicio: fechaInicio || null, actualizadoEn: ahoraISO() }
    await guardarVisita(actualizada)
    setVisita(actualizada)
  }

  async function onTransicion(t: Transicion) {
    if (!visita) return
    const resultado = await aplicarTransicionEstado(visita, t)
    if (resultado) setVisita(resultado)
  }

  const transicionesDisponibles = TRANSICIONES[visita.estado] ?? []
  const avance = calcularAvance(actividades)

  return (
    <div className="flex flex-col gap-4">
      <button onClick={() => navigate('/visitas')} className="self-start text-sm text-slate-500">
        ← Volver a visitas
      </button>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{TIPOS_VISITA[visita.tipo].nombre}</p>
        <div className="mt-1 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{visita.planta || 'Planta sin definir'}</h2>
          <EstadoBadge estado={visita.estado} />
        </div>
        <p className="mt-1 text-sm text-slate-500">{visita.cliente || 'Cliente sin definir'}</p>
        <p className="mt-3 text-sm text-slate-700">{visita.objetivo}</p>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-xs text-slate-400">Duración</dt>
            <dd className="text-slate-800">{visita.duracionDias} días</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Responsable</dt>
            <dd className="text-slate-800">{visita.responsable || '—'}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <label className="mb-1 block text-sm font-medium text-slate-700">Fecha de inicio</label>
        <div className="flex gap-2">
          <input
            type="date"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            onClick={guardarFechaInicio}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
          >
            Guardar
          </button>
        </div>
      </div>

      <Link to={`/visitas/${visita.id}/plan`} className="block rounded-xl border border-slate-200 bg-white p-4 active:bg-slate-50">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-700">Plan de actividades</p>
          <span className="text-sm text-accent">Ver plan →</span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {actividades.length === 0 ? 'Sin actividades todavía' : `${actividades.length} actividades · versión ${visita.version}`}
        </p>
        {actividades.length > 0 && (
          <div className="mt-2">
            <BarraProgreso porcentaje={avance.porcentaje} />
          </div>
        )}
      </Link>

      {transicionesDisponibles.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-2 text-sm font-medium text-slate-700">Ciclo de vida</p>
          <div className="flex flex-col gap-2">
            {transicionesDisponibles.map((t) =>
              t.requierePlanPreview ? (
                <Link
                  key={t.destino}
                  to={`/visitas/${visita.id}/plan/vista-previa?destino=${t.destino}`}
                  className="rounded-lg bg-accent py-2.5 text-center text-sm font-semibold text-white"
                >
                  {t.etiqueta}
                </Link>
              ) : (
                <button
                  key={t.destino}
                  onClick={() => onTransicion(t)}
                  className="rounded-lg bg-accent py-2.5 text-sm font-semibold text-white"
                >
                  {t.etiqueta}
                </button>
              ),
            )}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-500">
        Registro diario, fotos y hallazgos: próximo módulo.
      </div>
    </div>
  )
}
