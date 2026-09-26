import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { guardarActividad, listarActividadesPorVisita, obtenerVisita } from '../db'
import { ahoraISO } from '../lib/id'
import { calcularAvance, diaActual } from '../lib/progreso'
import type { Actividad, EstadoActividad, Visita } from '../types'
import { ETIQUETA_ESTADO_ACTIVIDAD } from '../types'
import BarraProgreso from '../components/BarraProgreso'
import FotosPicker from '../components/FotosPicker'

const ESTILOS_ESTADO: Record<EstadoActividad, string> = {
  PENDIENTE: 'bg-white text-slate-600 border-slate-300',
  EN_PROGRESO: 'bg-sky-50 text-sky-700 border-sky-300',
  COMPLETADA: 'bg-emerald-600 text-white border-emerald-600',
  PARCIAL: 'bg-amber-400 text-amber-950 border-amber-400',
  BLOQUEADA: 'bg-rose-600 text-white border-rose-600',
  NO_APLICA: 'bg-slate-100 text-slate-400 border-slate-200',
}

const ESTADOS_RAPIDOS: EstadoActividad[] = ['COMPLETADA', 'PARCIAL', 'BLOQUEADA', 'EN_PROGRESO', 'PENDIENTE', 'NO_APLICA']

export default function RegistroDiario() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [visita, setVisita] = useState<Visita | null | undefined>(undefined)
  const [actividades, setActividades] = useState<Actividad[]>([])
  const [dia, setDia] = useState(1)
  const [comentarios, setComentarios] = useState<Record<string, string>>({})

  async function refrescar(visitaId: string) {
    const lista = await listarActividadesPorVisita(visitaId)
    setActividades(lista)
  }

  useEffect(() => {
    if (!id) return
    obtenerVisita(id).then((v) => {
      setVisita(v ?? null)
      if (v) {
        const d = diaActual(v)
        setDia(d && d > 0 ? d : 1)
      }
    })
    refrescar(id)
  }, [id])

  if (visita === undefined) return <p className="text-sm text-slate-500">Cargando…</p>
  if (visita === null) return <p className="text-sm text-rose-600">Visita no encontrada.</p>

  const delDia = actividades.filter((a) => a.dia === dia).sort((a, b) => a.orden - b.orden)
  const avanceDia = calcularAvance(delDia)
  const avanceTotal = calcularAvance(actividades)

  async function marcarEstado(actividad: Actividad, estado: EstadoActividad) {
    await guardarActividad({ ...actividad, estado, actualizadoEn: ahoraISO() })
    if (visita) await refrescar(visita.id)
  }

  function onComentarioChange(actividadId: string, valor: string) {
    setComentarios((prev) => ({ ...prev, [actividadId]: valor }))
  }

  async function guardarComentario(actividad: Actividad) {
    const texto = comentarios[actividad.id]
    if (texto === undefined || texto === actividad.observacion) return
    await guardarActividad({ ...actividad, observacion: texto, actualizadoEn: ahoraISO() })
    if (visita) await refrescar(visita.id)
  }

  return (
    <div className="flex flex-col gap-4 pb-8">
      <button onClick={() => navigate(`/visitas/${visita.id}`)} className="self-start text-sm text-slate-500">
        ← Volver a la visita
      </button>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{visita.planta || 'Planta sin definir'}</p>
            <h2 className="text-lg font-semibold text-slate-900">Hoy — Día {dia} de {visita.duracionDias}</h2>
          </div>
          <select
            value={dia}
            onChange={(e) => setDia(Number(e.target.value))}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          >
            {Array.from({ length: visita.duracionDias }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                Día {d}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs text-slate-500">
            <span>Avance del día</span>
            <span>{avanceDia.porcentaje}%</span>
          </div>
          <BarraProgreso porcentaje={avanceDia.porcentaje} />
          <div className="mt-1 flex justify-between text-xs text-slate-400">
            <span>Avance total de la visita</span>
            <span>{avanceTotal.porcentaje}%</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Link
          to={`/visitas/${visita.id}/plan/nueva?dia=${dia}&emergente=1`}
          className="flex items-center justify-center gap-1 rounded-xl border-2 border-dashed border-amber-400 bg-amber-50 py-3 text-xs font-semibold text-amber-700"
        >
          ⚡ Actividad emergente
        </Link>
        <Link
          to={`/pendientes/nuevo?visitaId=${visita.id}`}
          className="flex items-center justify-center gap-1 rounded-xl border-2 border-dashed border-rose-300 bg-rose-50 py-3 text-xs font-semibold text-rose-700"
        >
          📌 Hallazgo / pendiente
        </Link>
      </div>

      {delDia.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-500">
          No hay actividades planificadas para este día.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {delDia.map((a) => (
          <div key={a.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">
              {a.emergente && <span className="mr-1 text-amber-500">⚡</span>}
              {a.actividad}
            </p>
            {a.objetivo && <p className="mt-0.5 text-xs text-slate-500">{a.objetivo}</p>}

            <div className="mt-3 flex flex-wrap gap-1.5">
              {ESTADOS_RAPIDOS.map((estado) => (
                <button
                  key={estado}
                  onClick={() => marcarEstado(a, estado)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                    a.estado === estado ? ESTILOS_ESTADO[estado] : 'border-slate-200 bg-white text-slate-500'
                  }`}
                >
                  {ETIQUETA_ESTADO_ACTIVIDAD[estado]}
                </button>
              ))}
            </div>

            <textarea
              value={comentarios[a.id] ?? a.observacion}
              onChange={(e) => onComentarioChange(a.id, e.target.value)}
              onBlur={() => guardarComentario(a)}
              placeholder="Comentario corto…"
              rows={2}
              className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />

            <div className="mt-3">
              <FotosPicker visitaId={visita.id} entidadTipo="ACTIVIDAD" entidadId={a.id} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
