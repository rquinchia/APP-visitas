import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { listarActividadesPorVisita, obtenerVisita } from '../db'
import type { Actividad, EstadoVisita, Visita } from '../types'
import { ETIQUETA_ESTADO_ACTIVIDAD, TIPOS_VISITA } from '../types'
import { aplicarTransicionEstado, buscarTransicion } from '../lib/transiciones'

function textoPlano(visita: Visita, actividades: Actividad[]): string {
  const lineas = [`Plan de visita — ${TIPOS_VISITA[visita.tipo].nombre}`, `Planta: ${visita.planta || '—'}`, `Versión: ${visita.version}`, '']
  const dias = Array.from({ length: visita.duracionDias }, (_, i) => i + 1)
  for (const dia of dias) {
    const delDia = actividades.filter((a) => a.dia === dia).sort((a, b) => a.orden - b.orden)
    if (delDia.length === 0) continue
    lineas.push(`Día ${dia}`)
    for (const a of delDia) {
      lineas.push(`- ${a.actividad} (${ETIQUETA_ESTADO_ACTIVIDAD[a.estado]})`)
    }
    lineas.push('')
  }
  return lineas.join('\n')
}

export default function PlanVistaPrevia() {
  const { id } = useParams<{ id: string }>()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const destino = params.get('destino') as EstadoVisita | null

  const [visita, setVisita] = useState<Visita | null | undefined>(undefined)
  const [actividades, setActividades] = useState<Actividad[]>([])

  useEffect(() => {
    if (!id) return
    obtenerVisita(id).then((v) => setVisita(v ?? null))
    listarActividadesPorVisita(id).then(setActividades)
  }, [id])

  if (visita === undefined) return <p className="text-sm text-slate-500">Cargando…</p>
  if (visita === null) return <p className="text-sm text-rose-600">Visita no encontrada.</p>

  const transicion = destino ? buscarTransicion(visita.estado, destino) : undefined
  const dias = Array.from({ length: visita.duracionDias }, (_, i) => i + 1)

  async function confirmar() {
    if (!visita || !transicion) return
    const actualizada = await aplicarTransicionEstado(visita, transicion)
    if (actualizada) navigate(`/visitas/${visita.id}`)
  }

  async function compartir() {
    if (!visita) return
    const texto = textoPlano(visita, actividades)
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Plan de visita', text: texto })
        return
      } catch {
        // el usuario canceló el diálogo nativo; no hacer nada más
        return
      }
    }
    try {
      await navigator.clipboard.writeText(texto)
      alert('Plan copiado al portapapeles.')
    } catch {
      alert('No se pudo copiar automáticamente. Copia el plan manualmente desde la pantalla anterior.')
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-8">
      <button onClick={() => navigate(`/visitas/${visita.id}/plan`)} className="self-start text-sm text-slate-500">
        ← Editar plan
      </button>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{TIPOS_VISITA[visita.tipo].nombre}</p>
        <h2 className="text-lg font-semibold text-slate-900">{visita.planta || 'Planta sin definir'}</h2>
        <p className="text-xs text-slate-500">Vista previa · versión {visita.version}</p>
      </div>

      {actividades.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-500">
          El plan no tiene actividades todavía.
        </p>
      )}

      {dias.map((dia) => {
        const delDia = actividades.filter((a) => a.dia === dia).sort((a, b) => a.orden - b.orden)
        if (delDia.length === 0) return null
        return (
          <section key={dia} className="rounded-xl border border-slate-200 bg-white p-3">
            <h3 className="mb-2 text-sm font-semibold text-slate-800">Día {dia}</h3>
            <div className="flex flex-col gap-2">
              {delDia.map((a) => (
                <div key={a.id} className="rounded-lg bg-slate-50 p-3 text-sm">
                  <p className="font-medium text-slate-900">
                    {a.emergente && <span className="mr-1 text-amber-500">⚡</span>}
                    {a.actividad}
                  </p>
                  {a.objetivo && <p className="text-xs text-slate-500">Objetivo: {a.objetivo}</p>}
                  {a.criterioCumplimiento && <p className="text-xs text-slate-500">Criterio: {a.criterioCumplimiento}</p>}
                  <p className="mt-1 text-xs font-medium text-slate-600">{ETIQUETA_ESTADO_ACTIVIDAD[a.estado]}</p>
                </div>
              ))}
            </div>
          </section>
        )
      })}

      <div className="sticky bottom-16 flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
        <button onClick={compartir} className="rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-700">
          Compartir
        </button>
        {transicion && (
          <button onClick={confirmar} className="rounded-lg bg-accent py-2.5 text-sm font-semibold text-white">
            Confirmar: {transicion.etiqueta}
          </button>
        )}
      </div>
    </div>
  )
}
