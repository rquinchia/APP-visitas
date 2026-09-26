import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { guardarPendiente, listarVisitas, obtenerPendiente } from '../db'
import { generarId, ahoraISO } from '../lib/id'
import type { CategoriaPendiente, EstadoPendiente, Pendiente, PrioridadPendiente, Visita } from '../types'
import {
  CATEGORIAS_PENDIENTE,
  ESTADOS_PENDIENTE,
  ETIQUETA_ESTADO_PENDIENTE,
  ETIQUETA_PRIORIDAD,
  FECHA_POR_DEFECTO,
  PRIORIDADES_PENDIENTE,
  RESPONSABLE_POR_DEFECTO,
  TIPOS_VISITA,
} from '../types'
import FotosPicker from '../components/FotosPicker'

const VACIO = {
  visitaId: '',
  equipo: '',
  descripcion: '',
  categoria: 'Otro' as CategoriaPendiente,
  impacto: '',
  prioridad: 'P3' as PrioridadPendiente,
  accionPropuesta: '',
  responsable: '',
  fechaCompromiso: '',
  estado: 'ABIERTO' as EstadoPendiente,
  comentarios: '',
}

export default function PendienteForm() {
  const { pendienteId } = useParams<{ pendienteId?: string }>()
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const [visitas, setVisitas] = useState<Visita[]>([])
  const [original, setOriginal] = useState<Pendiente | null>(null)
  const [campos, setCampos] = useState(VACIO)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)

  const esNuevo = !pendienteId

  useEffect(() => {
    async function cargar() {
      const listaVisitas = await listarVisitas()
      setVisitas(listaVisitas)

      if (pendienteId) {
        const p = await obtenerPendiente(pendienteId)
        if (p) {
          setOriginal(p)
          setCampos({
            visitaId: p.visitaId,
            equipo: p.equipo,
            descripcion: p.descripcion,
            categoria: p.categoria,
            impacto: p.impacto,
            prioridad: p.prioridad,
            accionPropuesta: p.accionPropuesta,
            responsable: p.responsable === RESPONSABLE_POR_DEFECTO ? '' : p.responsable,
            fechaCompromiso: p.fechaCompromiso === FECHA_POR_DEFECTO ? '' : p.fechaCompromiso,
            estado: p.estado,
            comentarios: p.comentarios,
          })
        }
      } else {
        const visitaId = params.get('visitaId') || listaVisitas[0]?.id || ''
        setCampos({ ...VACIO, visitaId })
      }
      setCargando(false)
    }
    cargar()
  }, [pendienteId])

  if (cargando) return <p className="text-sm text-slate-500">Cargando…</p>
  if (visitas.length === 0) return <p className="text-sm text-rose-600">Primero crea una visita.</p>

  const visitaSeleccionada = visitas.find((v) => v.id === campos.visitaId)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!campos.visitaId || !campos.descripcion.trim()) return
    setGuardando(true)
    const ahora = ahoraISO()
    const visita = visitas.find((v) => v.id === campos.visitaId)!

    const pendiente: Pendiente = {
      id: original?.id ?? generarId(),
      visitaId: campos.visitaId,
      planta: visita.planta,
      fecha: original?.fecha ?? ahora.slice(0, 10),
      equipo: campos.equipo.trim(),
      descripcion: campos.descripcion.trim(),
      categoria: campos.categoria,
      impacto: campos.impacto.trim(),
      prioridad: campos.prioridad,
      accionPropuesta: campos.accionPropuesta.trim(),
      responsable: campos.responsable.trim() || RESPONSABLE_POR_DEFECTO,
      fechaCompromiso: campos.fechaCompromiso || FECHA_POR_DEFECTO,
      estado: campos.estado,
      comentarios: campos.comentarios.trim(),
      creadoEn: original?.creadoEn ?? ahora,
      actualizadoEn: ahora,
    }

    await guardarPendiente(pendiente)

    if (esNuevo) {
      navigate(`/pendientes/${pendiente.id}/editar`, { replace: true })
    } else {
      navigate('/pendientes')
    }
    setGuardando(false)
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 pb-8">
      <button type="button" onClick={() => navigate('/pendientes')} className="self-start text-sm text-slate-500">
        ← Volver a pendientes
      </button>

      <h2 className="text-base font-semibold text-slate-900">{esNuevo ? 'Nuevo pendiente' : 'Editar pendiente'}</h2>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Visita / planta</label>
        <select
          value={campos.visitaId}
          onChange={(e) => setCampos({ ...campos, visitaId: e.target.value })}
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
        >
          {visitas.map((v) => (
            <option key={v.id} value={v.id}>
              {v.planta || 'Planta sin definir'} — {TIPOS_VISITA[v.tipo].nombre}
            </option>
          ))}
        </select>
        {visitaSeleccionada && <p className="mt-1 text-xs text-slate-400">Cliente: {visitaSeleccionada.cliente || '—'}</p>}
      </div>

      <Campo etiqueta="Equipo" valor={campos.equipo} onChange={(v) => setCampos({ ...campos, equipo: v })} placeholder="Ej. Soldador J5-S línea 2" />

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Descripción <span className="text-rose-500">*</span>
        </label>
        <textarea
          value={campos.descripcion}
          onChange={(e) => setCampos({ ...campos, descripcion: e.target.value })}
          rows={3}
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Categoría</label>
          <select
            value={campos.categoria}
            onChange={(e) => setCampos({ ...campos, categoria: e.target.value as CategoriaPendiente })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          >
            {CATEGORIAS_PENDIENTE.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Prioridad</label>
          <select
            value={campos.prioridad}
            onChange={(e) => setCampos({ ...campos, prioridad: e.target.value as PrioridadPendiente })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          >
            {PRIORIDADES_PENDIENTE.map((p) => (
              <option key={p} value={p}>
                {ETIQUETA_PRIORIDAD[p]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Campo etiqueta="Impacto" valor={campos.impacto} onChange={(v) => setCampos({ ...campos, impacto: v })} placeholder="Ej. Detiene la línea / afecta calidad" />

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Acción propuesta</label>
        <textarea
          value={campos.accionPropuesta}
          onChange={(e) => setCampos({ ...campos, accionPropuesta: e.target.value })}
          rows={2}
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Campo
          etiqueta="Responsable"
          valor={campos.responsable}
          onChange={(v) => setCampos({ ...campos, responsable: v })}
          placeholder={RESPONSABLE_POR_DEFECTO}
        />
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Fecha compromiso</label>
          <input
            type="date"
            value={campos.fechaCompromiso}
            onChange={(e) => setCampos({ ...campos, fechaCompromiso: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          />
          {!campos.fechaCompromiso && <p className="mt-1 text-xs text-slate-400">Se guardará como "{FECHA_POR_DEFECTO}".</p>}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Estado</label>
        <select
          value={campos.estado}
          onChange={(e) => setCampos({ ...campos, estado: e.target.value as EstadoPendiente })}
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
        >
          {ESTADOS_PENDIENTE.map((estado) => (
            <option key={estado} value={estado}>
              {ETIQUETA_ESTADO_PENDIENTE[estado]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Comentarios</label>
        <textarea
          value={campos.comentarios}
          onChange={(e) => setCampos({ ...campos, comentarios: e.target.value })}
          rows={2}
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
        />
      </div>

      {original && (
        <>
          <FotosPicker visitaId={original.visitaId} entidadTipo="PENDIENTE" entidadId={original.id} titulo="Fotos / evidencia" />
          <FotosPicker
            visitaId={original.visitaId}
            entidadTipo="PENDIENTE"
            entidadId={original.id}
            etiqueta="Evidencia de cierre"
            titulo="Evidencia de cierre"
          />
        </>
      )}

      <button
        type="submit"
        disabled={guardando || !campos.descripcion.trim()}
        className="rounded-xl bg-accent py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {esNuevo ? 'Crear pendiente' : 'Guardar cambios'}
      </button>
    </form>
  )
}

function Campo({
  etiqueta,
  valor,
  onChange,
  placeholder,
}: {
  etiqueta: string
  valor: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{etiqueta}</label>
      <input
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      />
    </div>
  )
}
