import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import {
  eliminarVisitaCompleta,
  guardarPendiente,
  guardarVisita,
  listarActividadesPorVisita,
  listarFotosPorVisita,
  listarPendientesPorVisita,
  obtenerVisita,
  registrarCambioHistorial,
} from '../db'
import { ahoraISO, generarId } from '../lib/id'
import { confirmar } from '../lib/dialogo'
import { avisarCambios } from '../lib/eventos'
import type { TipoVisita, Visita } from '../types'
import { TIPOS_VISITA } from '../types'
import { PageHeader } from '../components/ui'

const CAMPOS: { clave: keyof Visita; nombre: string }[] = [
  { clave: 'tipo', nombre: 'tipo' },
  { clave: 'planta', nombre: 'planta' },
  { clave: 'cliente', nombre: 'cliente' },
  { clave: 'responsable', nombre: 'responsable' },
  { clave: 'objetivo', nombre: 'objetivo' },
  { clave: 'duracionDias', nombre: 'duración' },
  { clave: 'fechaInicio', nombre: 'fecha de inicio' },
]

/** Editar los datos generales de una visita (no su plan ni su estado) o eliminarla por completo. */
export default function EditarVisita() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [visita, setVisita] = useState<Visita | null | undefined>(undefined)
  const [campos, setCampos] = useState<Visita | null>(null)
  const [diaMaximoUsado, setDiaMaximoUsado] = useState(1)
  const [conteo, setConteo] = useState({ actividades: 0, hallazgos: 0, fotos: 0 })
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!id) return
    Promise.all([obtenerVisita(id), listarActividadesPorVisita(id), listarPendientesPorVisita(id), listarFotosPorVisita(id)]).then(
      ([v, acts, pends, fotos]) => {
        setVisita(v ?? null)
        setCampos(v ?? null)
        setDiaMaximoUsado(Math.max(1, ...acts.map((a) => a.dia)))
        setConteo({ actividades: acts.length, hallazgos: pends.length, fotos: fotos.length })
      },
    )
  }, [id])

  if (visita === undefined || (visita && !campos)) return <p className="text-sm text-slate-500">Cargando…</p>
  if (visita === null || !campos) return <p className="text-sm text-rose-600">Visita no encontrada.</p>

  const duracionInvalida = campos.duracionDias < diaMaximoUsado

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!visita || !campos || duracionInvalida) return
    const limpia: Visita = {
      ...campos,
      planta: campos.planta.trim(),
      cliente: campos.cliente.trim(),
      responsable: campos.responsable.trim(),
      objetivo: campos.objetivo.trim(),
      fechaInicio: campos.fechaInicio || null,
      actualizadoEn: ahoraISO(),
    }
    const cambios = CAMPOS.filter((c) => (visita[c.clave] ?? '') !== (limpia[c.clave] ?? '')).map((c) => {
      const antes = c.clave === 'tipo' ? TIPOS_VISITA[visita.tipo].nombre : String(visita[c.clave] ?? '—')
      const despues = c.clave === 'tipo' ? TIPOS_VISITA[limpia.tipo].nombre : String(limpia[c.clave] ?? '—')
      return c.clave === 'objetivo' ? 'objetivo actualizado' : `${c.nombre}: ${antes || '—'} → ${despues || '—'}`
    })
    if (cambios.length === 0) {
      navigate(`/visitas/${visita.id}`)
      return
    }
    setGuardando(true)
    try {
      await guardarVisita(limpia)
      // El nombre de la planta también va copiado en cada hallazgo: se mantiene igual en todos.
      if (limpia.planta !== visita.planta) {
        for (const p of await listarPendientesPorVisita(visita.id)) await guardarPendiente({ ...p, planta: limpia.planta })
      }
      await registrarCambioHistorial({
        id: generarId(),
        visitaId: visita.id,
        version: visita.version,
        fecha: ahoraISO(),
        cambio: `Datos de la visita editados: ${cambios.join('; ')}`,
        motivo: '',
      })
      avisarCambios([visita.id])
      navigate(`/visitas/${visita.id}`)
    } catch {
      alert('No se pudieron guardar los cambios. Inténtalo de nuevo.')
      setGuardando(false)
    }
  }

  async function eliminar() {
    if (!visita) return
    const ok = await confirmar({
      titulo: `¿Eliminar la visita «${visita.planta || 'sin nombre'}»?`,
      mensaje:
        `Se elimina todo lo de esta visita: ${conteo.actividades} actividad(es), ${conteo.hallazgos} hallazgo(s) y ${conteo.fotos} foto(s), ` +
        'junto con su historial. No se puede deshacer.\n\nSi quieres conservar una copia, exporta antes un respaldo.',
      aceptar: 'Eliminar visita',
      peligro: true,
      escribir: 'ELIMINAR',
    })
    if (!ok) return
    try {
      await eliminarVisitaCompleta(visita.id)
      avisarCambios([visita.id])
      navigate('/visitas', { replace: true })
    } catch {
      alert('No se pudo eliminar la visita. Inténtalo de nuevo.')
    }
  }

  const set = <K extends keyof Visita>(k: K, v: Visita[K]) => setCampos({ ...campos, [k]: v })

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 pb-8">
      <PageHeader titulo="Editar visita" subtitulo="Datos generales. El plan y el estado se cambian desde la visita." atras={`/visitas/${visita.id}`} atrasEtiqueta="Visita" />

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Tipo de visita</label>
        <select value={campos.tipo} onChange={(e) => set('tipo', e.target.value as TipoVisita)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm">
          {(Object.keys(TIPOS_VISITA) as TipoVisita[]).map((t) => (
            <option key={t} value={t}>
              {TIPOS_VISITA[t].nombre}
            </option>
          ))}
        </select>
        {campos.tipo !== visita.tipo && (
          <p className="mt-1 text-xs text-slate-500">
            El objetivo y la duración no cambian solos.{' '}
            <button
              type="button"
              className="font-semibold text-accent"
              onClick={() => setCampos({ ...campos, objetivo: TIPOS_VISITA[campos.tipo].objetivo, duracionDias: Math.max(diaMaximoUsado, TIPOS_VISITA[campos.tipo].duracionDias) })}
            >
              Usar los del tipo {campos.tipo}
            </button>
          </p>
        )}
      </div>

      <Campo etiqueta="Planta / sitio" valor={campos.planta} onChange={(v) => set('planta', v)} />
      <Campo etiqueta="Cliente" valor={campos.cliente} onChange={(v) => set('cliente', v)} />
      <Campo etiqueta="Responsable de la visita" valor={campos.responsable} onChange={(v) => set('responsable', v)} />

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Objetivo</label>
        <textarea value={campos.objetivo} onChange={(e) => set('objetivo', e.target.value)} rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Duración (días)</label>
          <input
            type="number"
            min={diaMaximoUsado}
            max={60}
            value={campos.duracionDias}
            onChange={(e) => set('duracionDias', Math.max(1, Math.min(60, Number(e.target.value) || 1)))}
            className={`w-full rounded-lg border px-3 py-2.5 text-sm ${duracionInvalida ? 'border-rose-400 bg-rose-50' : 'border-slate-300'}`}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Fecha de inicio</label>
          <input
            type="date"
            value={campos.fechaInicio ?? ''}
            onChange={(e) => set('fechaInicio', e.target.value || null)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          />
        </div>
      </div>
      {duracionInvalida && (
        <p className="-mt-2 text-xs font-medium text-rose-600">
          El plan tiene actividades hasta el día {diaMaximoUsado}: la duración no puede ser menor. Muévelas o elimínalas primero desde el Plan.
        </p>
      )}

      <button type="submit" disabled={guardando || duracionInvalida} className="rounded-xl bg-accent py-3 text-sm font-semibold text-white disabled:opacity-50">
        Guardar cambios
      </button>
      <p className="-mt-2 text-center text-[11px] text-slate-400">Los cambios quedan en el historial de la visita.</p>

      <section className="mt-6 rounded-2xl border border-rose-200 bg-rose-50/60 p-4">
        <p className="text-sm font-semibold text-rose-800">Eliminar visita</p>
        <p className="mt-1 text-xs leading-relaxed text-rose-700">
          Borra la visita con su plan, hallazgos, fotos e historial de este dispositivo. Al "Combinar" un respaldo en otro dispositivo, también se elimina allá.
        </p>
        <button type="button" onClick={eliminar} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-rose-300 bg-white py-2.5 text-sm font-semibold text-rose-700">
          <Trash2 className="h-4 w-4" /> Eliminar esta visita
        </button>
      </section>
    </form>
  )
}

function Campo({ etiqueta, valor, onChange }: { etiqueta: string; valor: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{etiqueta}</label>
      <input
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      />
    </div>
  )
}
