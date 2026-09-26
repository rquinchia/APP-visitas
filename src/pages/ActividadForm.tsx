import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { guardarActividad, listarActividadesPorVisita, obtenerActividad, obtenerVisita } from '../db'
import { generarId, ahoraISO } from '../lib/id'
import { registrarCambioPlan } from '../lib/historial'
import type { Actividad, EstadoActividad, Visita } from '../types'
import { ETIQUETA_ESTADO_ACTIVIDAD, TIPOS_ACTIVIDAD_SUGERIDOS } from '../types'

const VACIA: Omit<Actividad, 'id' | 'visitaId' | 'creadoEn' | 'actualizadoEn'> = {
  dia: 1,
  orden: 1,
  actividad: '',
  objetivo: '',
  tipo: '',
  equipoProceso: '',
  evidenciaRequerida: '',
  criterioCumplimiento: '',
  estado: 'PENDIENTE',
  observacion: '',
  emergente: false,
}

export default function ActividadForm() {
  const { id, actividadId } = useParams<{ id: string; actividadId?: string }>()
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const [visita, setVisita] = useState<Visita | null>(null)
  const [actividadOriginal, setActividadOriginal] = useState<Actividad | null>(null)
  const [todasActividades, setTodasActividades] = useState<Actividad[]>([])
  const [campos, setCampos] = useState(VACIA)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)

  const esNueva = !actividadId

  useEffect(() => {
    if (!id) return
    async function cargar() {
      const [v, lista] = await Promise.all([obtenerVisita(id!), listarActividadesPorVisita(id!)])
      setVisita(v ?? null)
      setTodasActividades(lista)

      if (actividadId) {
        const a = await obtenerActividad(actividadId)
        if (a) {
          setActividadOriginal(a)
          setCampos(a)
        }
      } else {
        const dia = Number(params.get('dia')) || 1
        const emergente = params.get('emergente') === '1'
        setCampos({ ...VACIA, dia, emergente })
      }
      setCargando(false)
    }
    cargar()
  }, [id, actividadId])

  if (cargando) return <p className="text-sm text-slate-500">Cargando…</p>
  if (!visita) return <p className="text-sm text-rose-600">Visita no encontrada.</p>

  function siguienteOrden(dia: number, excluirId?: string): number {
    const delDia = todasActividades.filter((a) => a.dia === dia && a.id !== excluirId)
    return delDia.length === 0 ? 1 : Math.max(...delDia.map((a) => a.orden)) + 1
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!visita || !campos.actividad.trim()) return
    setGuardando(true)

    const ahora = ahoraISO()
    const cambioDia = actividadOriginal && actividadOriginal.dia !== campos.dia

    const actividad: Actividad = {
      id: actividadOriginal?.id ?? generarId(),
      visitaId: visita.id,
      ...campos,
      actividad: campos.actividad.trim(),
      orden: actividadOriginal
        ? cambioDia
          ? siguienteOrden(campos.dia, actividadOriginal.id)
          : actividadOriginal.orden
        : siguienteOrden(campos.dia),
      creadoEn: actividadOriginal?.creadoEn ?? ahora,
      actualizadoEn: ahora,
    }

    const descripcion = esNueva
      ? `Actividad creada (día ${actividad.dia}): ${actividad.actividad}`
      : cambioDia
        ? `Actividad reprogramada del día ${actividadOriginal!.dia} al día ${actividad.dia}: ${actividad.actividad}`
        : `Actividad editada (día ${actividad.dia}): ${actividad.actividad}`

    const visitaActualizada = await registrarCambioPlan(visita, descripcion)
    if (!visitaActualizada) {
      setGuardando(false)
      return
    }

    await guardarActividad(actividad)
    navigate(`/visitas/${visita.id}/plan`)
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 pb-8">
      <button type="button" onClick={() => navigate(`/visitas/${visita.id}/plan`)} className="self-start text-sm text-slate-500">
        ← Volver al plan
      </button>

      <h2 className="text-base font-semibold text-slate-900">
        {esNueva ? 'Nueva actividad' : 'Editar actividad'}
        {campos.emergente && <span className="ml-2 text-sm font-normal text-amber-600">⚡ emergente</span>}
      </h2>

      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Día" tipo="number" min={1} max={visita.duracionDias}
          valor={String(campos.dia)} onChange={(v) => setCampos({ ...campos, dia: Math.max(1, Math.min(visita.duracionDias, Number(v) || 1)) })} />
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Estado</label>
          <select
            value={campos.estado}
            onChange={(e) => setCampos({ ...campos, estado: e.target.value as EstadoActividad })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          >
            {(Object.keys(ETIQUETA_ESTADO_ACTIVIDAD) as EstadoActividad[]).map((estado) => (
              <option key={estado} value={estado}>
                {ETIQUETA_ESTADO_ACTIVIDAD[estado]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Campo etiqueta="Actividad" requerido valor={campos.actividad} onChange={(v) => setCampos({ ...campos, actividad: v })} placeholder="Ej. Repaso de ajuste de rodillos" />
      <Campo etiqueta="Objetivo" valor={campos.objetivo} onChange={(v) => setCampos({ ...campos, objetivo: v })} />

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Tipo</label>
        <input
          list="tipos-actividad"
          value={campos.tipo}
          onChange={(e) => setCampos({ ...campos, tipo: e.target.value })}
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          placeholder="Ej. Formación"
        />
        <datalist id="tipos-actividad">
          {TIPOS_ACTIVIDAD_SUGERIDOS.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </div>

      <Campo etiqueta="Equipo / proceso" valor={campos.equipoProceso} onChange={(v) => setCampos({ ...campos, equipoProceso: v })} />
      <Campo etiqueta="Evidencia requerida" valor={campos.evidenciaRequerida} onChange={(v) => setCampos({ ...campos, evidenciaRequerida: v })} placeholder="Ej. Foto del ajuste realizado" />
      <Campo etiqueta="Criterio de cumplimiento" valor={campos.criterioCumplimiento} onChange={(v) => setCampos({ ...campos, criterioCumplimiento: v })} />

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Observación</label>
        <textarea
          value={campos.observacion}
          onChange={(e) => setCampos({ ...campos, observacion: e.target.value })}
          rows={3}
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={campos.emergente}
          onChange={(e) => setCampos({ ...campos, emergente: e.target.checked })}
        />
        Actividad emergente (no estaba en el plan original)
      </label>

      <button
        type="submit"
        disabled={guardando || !campos.actividad.trim()}
        className="rounded-xl bg-accent py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {esNueva ? 'Crear actividad' : 'Guardar cambios'}
      </button>
    </form>
  )
}

function Campo({
  etiqueta,
  valor,
  onChange,
  placeholder,
  tipo = 'text',
  min,
  max,
  requerido,
}: {
  etiqueta: string
  valor: string
  onChange: (v: string) => void
  placeholder?: string
  tipo?: string
  min?: number
  max?: number
  requerido?: boolean
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">
        {etiqueta}
        {requerido && <span className="text-rose-500"> *</span>}
      </label>
      <input
        type={tipo}
        min={min}
        max={max}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      />
    </div>
  )
}
