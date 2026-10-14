import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CheckCircle2, ChevronDown, Plus, RotateCcw } from 'lucide-react'
import { guardarPendiente, listarActividadesPorVisita, listarVisitas, obtenerPendiente } from '../db'
import { generarId, ahoraISO, hoyLocal, formatearFecha } from '../lib/id'
import type { Actividad, CategoriaPendiente, EstadoPendiente, Pendiente, PrioridadPendiente, Visita } from '../types'
import {
  CATEGORIAS_PENDIENTE,
  ESTADOS_PENDIENTE,
  ETIQUETA_ESTADO_PENDIENTE,
  ETIQUETA_FOTO_DESPUES,
  ETIQUETA_PRIORIDAD,
  FECHA_POR_DEFECTO,
  PRIORIDADES_PENDIENTE,
  RESPONSABLE_POR_DEFECTO,
  TIPOS_VISITA,
} from '../types'
import FotosPicker from '../components/FotosPicker'
import AsistenteIA from '../components/AsistenteIA'
import { PageHeader } from '../components/ui'

const VACIO = {
  visitaId: '',
  actividadId: '',
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
  solucion: '',
}

/**
 * Hallazgo (observación) con su ciclo antes → después. Es el mismo registro que se ve en
 * "Pendientes": mientras no esté resuelto, es un pendiente.
 */
export default function PendienteForm() {
  const { pendienteId } = useParams<{ pendienteId?: string }>()
  const [params] = useSearchParams()
  const navigate = useNavigate()

  // El id se fija desde el inicio para poder adjuntar fotos antes de pulsar "Guardar".
  const [idRegistro, setIdRegistro] = useState(() => pendienteId ?? generarId())
  // Captura rápida: en un hallazgo nuevo solo se ve lo esencial (qué se vio + fotos); el resto se despliega si hace falta.
  const [verPlan, setVerPlan] = useState(!!pendienteId)
  const [verDespues, setVerDespues] = useState(!!pendienteId)
  const [guardadosSeguidos, setGuardadosSeguidos] = useState(0)
  const [visitas, setVisitas] = useState<Visita[]>([])
  const [actividades, setActividades] = useState<Actividad[]>([])
  const [original, setOriginal] = useState<Pendiente | null>(null)
  const [campos, setCampos] = useState(VACIO)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [fotosDespues, setFotosDespues] = useState(0)

  const volver = params.get('volver') || '/pendientes'

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
            actividadId: p.actividadId ?? '',
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
            solucion: p.solucion ?? '',
          })
        }
      } else {
        const visitaId = params.get('visitaId') || listaVisitas[0]?.id || ''
        setCampos({ ...VACIO, visitaId, actividadId: params.get('actividadId') || '' })
      }
      setCargando(false)
    }
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendienteId])

  useEffect(() => {
    if (!campos.visitaId) return
    listarActividadesPorVisita(campos.visitaId).then(setActividades)
  }, [campos.visitaId])

  // Al elegir la actividad, se sugiere su equipo/proceso si el campo está vacío.
  useEffect(() => {
    if (campos.equipo || !campos.actividadId) return
    const a = actividades.find((x) => x.id === campos.actividadId)
    if (a?.equipoProceso) setCampos((c) => ({ ...c, equipo: a.equipoProceso }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actividades, campos.actividadId])

  if (cargando) return <p className="text-sm text-slate-500">Cargando…</p>
  if (visitas.length === 0) return <p className="text-sm text-rose-600">Primero crea una visita.</p>

  const esNuevo = !pendienteId && !original
  const visitaSeleccionada = visitas.find((v) => v.id === campos.visitaId)
  const actividadSeleccionada = actividades.find((a) => a.id === campos.actividadId)
  const resuelto = campos.estado === 'CERRADO'

  function construir(sobre: typeof campos): Pendiente {
    const ahora = ahoraISO()
    const visita = visitas.find((v) => v.id === sobre.visitaId)!
    return {
      id: idRegistro,
      visitaId: sobre.visitaId,
      planta: visita.planta,
      fecha: original?.fecha ?? hoyLocal(),
      equipo: sobre.equipo.trim(),
      descripcion: sobre.descripcion.trim(),
      categoria: sobre.categoria,
      impacto: sobre.impacto.trim(),
      prioridad: sobre.prioridad,
      accionPropuesta: sobre.accionPropuesta.trim(),
      responsable: sobre.responsable.trim() || RESPONSABLE_POR_DEFECTO,
      fechaCompromiso: sobre.fechaCompromiso || FECHA_POR_DEFECTO,
      estado: sobre.estado,
      comentarios: sobre.comentarios.trim(),
      actividadId: sobre.actividadId || undefined,
      solucion: sobre.solucion.trim() || undefined,
      fechaSolucion: sobre.estado === 'CERRADO' ? (original?.fechaSolucion ?? hoyLocal()) : undefined,
      creadoEn: original?.creadoEn ?? ahora,
      actualizadoEn: ahora,
    }
  }

  async function persistir(sobre = campos): Promise<boolean> {
    if (!sobre.visitaId || !sobre.descripcion.trim()) return false
    const pendiente = construir(sobre)
    try {
      await guardarPendiente(pendiente)
      setOriginal(pendiente)
      return true
    } catch {
      alert('No se pudo guardar el hallazgo en el dispositivo. Verifica el espacio disponible e inténtalo de nuevo.')
      return false
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setGuardando(true)
    const ok = await persistir()
    setGuardando(false)
    if (ok) navigate(volver)
  }

  /** Guarda y deja el formulario listo para la siguiente observación de la misma actividad. */
  async function guardarYOtra() {
    setGuardando(true)
    const ok = await persistir()
    setGuardando(false)
    if (!ok) return
    setGuardadosSeguidos((n) => n + 1)
    setIdRegistro(generarId())
    setOriginal(null)
    setFotosDespues(0)
    setVerPlan(false)
    setVerDespues(false)
    setCampos({ ...VACIO, visitaId: campos.visitaId, actividadId: campos.actividadId, equipo: campos.equipo })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function marcarResuelto() {
    if (!campos.solucion.trim()) {
      alert('Describe primero qué se hizo y cómo quedó (sección "Después").')
      return
    }
    const nuevos = { ...campos, estado: 'CERRADO' as EstadoPendiente }
    setCampos(nuevos)
    await persistir(nuevos)
  }

  async function reabrir() {
    const nuevos = { ...campos, estado: 'EN_PROCESO' as EstadoPendiente }
    setCampos(nuevos)
    if (original) setOriginal({ ...original, fechaSolucion: undefined })
    await persistir(nuevos)
  }

  const motivoBloqueo = !campos.descripcion.trim() ? 'Escribe primero qué identificaste para poder adjuntar fotos.' : undefined

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 pb-8">
      <PageHeader
        titulo={!pendienteId ? 'Nuevo hallazgo' : 'Hallazgo'}
        subtitulo={actividadSeleccionada ? `Actividad: ${actividadSeleccionada.actividad}` : visitaSeleccionada?.planta}
        atras={volver}
        atrasEtiqueta="Volver"
        accion={
          resuelto ? (
            <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
              <CheckCircle2 className="h-3.5 w-3.5" /> Resuelto
            </span>
          ) : undefined
        }
      />

      {guardadosSeguidos > 0 && (
        <p className="-mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
          ✓ {guardadosSeguidos} hallazgo{guardadosSeguidos === 1 ? '' : 's'} guardado{guardadosSeguidos === 1 ? '' : 's'}. Registra el siguiente.
        </p>
      )}

      <div className={`grid grid-cols-1 gap-3 ${!pendienteId && params.get('actividadId') ? 'hidden' : ''}`}>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Visita / planta</label>
          <select
            value={campos.visitaId}
            onChange={(e) => setCampos({ ...campos, visitaId: e.target.value, actividadId: '' })}
            disabled={!esNuevo}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm disabled:bg-slate-100 disabled:text-slate-500"
          >
            {visitas.map((v) => (
              <option key={v.id} value={v.id}>
                {v.planta || 'Planta sin definir'} — {TIPOS_VISITA[v.tipo].nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Actividad donde se identificó</label>
          <select
            value={campos.actividadId}
            onChange={(e) => setCampos({ ...campos, actividadId: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          >
            <option value="">— Hallazgo general (sin actividad) —</option>
            {actividades.map((a) => (
              <option key={a.id} value={a.id}>
                Día {a.dia} · {a.actividad}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ANTES */}
      <Seccion tono="antes" titulo="Antes · Lo identificado" ayuda="Qué se observó, dónde y por qué importa.">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Descripción <span className="text-rose-500">*</span>
          </label>
          <textarea
            value={campos.descripcion}
            onChange={(e) => setCampos({ ...campos, descripcion: e.target.value })}
            rows={3}
            placeholder="Ej. Rodamiento del rodillo 3 con ruido y temperatura elevada (68 °C)"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
            required
          />
          <AsistenteIA
            contexto="Descripción de un hallazgo (lo identificado, el 'antes') en una visita técnica industrial"
            valorActual={campos.descripcion}
            onInsertar={(texto) => setCampos({ ...campos, descripcion: texto })}
          />
        </div>
        <Campo etiqueta="Equipo / componente" valor={campos.equipo} onChange={(v) => setCampos({ ...campos, equipo: v })} placeholder="Ej. Stretch Line · caja de rodillos 3" />
        <FotosPicker
          visitaId={campos.visitaId}
          entidadTipo="PENDIENTE"
          entidadId={idRegistro}
          titulo="Fotos del antes"
          bloqueadoMotivo={motivoBloqueo}
          antesDeGuardar={() => persistir()}
        />
      </Seccion>

      {/* CLASIFICACIÓN Y ACCIÓN */}
      <Seccion
        tono="accion"
        titulo="Clasificación y plan de acción"
        abierto={verPlan}
        onAbrir={() => setVerPlan(true)}
        resumen={`${ETIQUETA_PRIORIDAD[campos.prioridad]} · ${campos.responsable || RESPONSABLE_POR_DEFECTO} · opcional, puedes completarlo después`}
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Prioridad</label>
            <select
              value={campos.prioridad}
              onChange={(e) => setCampos({ ...campos, prioridad: e.target.value as PrioridadPendiente })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
            >
              {PRIORIDADES_PENDIENTE.map((p) => (
                <option key={p} value={p}>
                  {ETIQUETA_PRIORIDAD[p]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Categoría</label>
            <select
              value={campos.categoria}
              onChange={(e) => setCampos({ ...campos, categoria: e.target.value as CategoriaPendiente })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
            >
              {CATEGORIAS_PENDIENTE.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Campo etiqueta="Impacto" valor={campos.impacto} onChange={(v) => setCampos({ ...campos, impacto: v })} placeholder="Ej. Riesgo de parada de línea / afecta calidad" />

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Acción propuesta</label>
          <textarea
            value={campos.accionPropuesta}
            onChange={(e) => setCampos({ ...campos, accionPropuesta: e.target.value })}
            rows={2}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
          />
          <AsistenteIA
            contexto="Acción propuesta para resolver un hallazgo de una visita técnica industrial"
            valorActual={campos.accionPropuesta}
            onInsertar={(texto) => setCampos({ ...campos, accionPropuesta: texto })}
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
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
            />
            {!campos.fechaCompromiso && <p className="mt-1 text-xs text-slate-400">Quedará "{FECHA_POR_DEFECTO}".</p>}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Estado</label>
          <select
            value={campos.estado}
            onChange={(e) => setCampos({ ...campos, estado: e.target.value as EstadoPendiente })}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
          >
            {ESTADOS_PENDIENTE.map((estado) => (
              <option key={estado} value={estado}>
                {estado === 'CERRADO' ? 'Resuelto / cerrado' : ETIQUETA_ESTADO_PENDIENTE[estado]}
              </option>
            ))}
          </select>
        </div>
      </Seccion>

      {/* DESPUÉS */}
      <Seccion
        tono="despues"
        titulo="Después · Solución"
        ayuda="Complétalo cuando se solucione (puede ser otro día): qué se hizo, cómo queda y qué se mejoró."
        abierto={verDespues}
        onAbrir={() => setVerDespues(true)}
        resumen="¿Ya se solucionó? Toca para registrar el después"
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Qué se hizo y cómo queda</label>
          <textarea
            value={campos.solucion}
            onChange={(e) => setCampos({ ...campos, solucion: e.target.value })}
            rows={3}
            placeholder="Ej. Se reemplazó el rodamiento y se lubricó según manual; temperatura normal (41 °C), sin ruido."
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
          />
          <AsistenteIA
            contexto="Descripción de la solución aplicada a un hallazgo (el 'después'): qué se hizo, cómo quedó y qué mejoró, en una visita técnica industrial"
            valorActual={campos.solucion}
            onInsertar={(texto) => setCampos({ ...campos, solucion: texto })}
          />
        </div>
        <FotosPicker
          visitaId={campos.visitaId}
          entidadTipo="PENDIENTE"
          entidadId={idRegistro}
          etiqueta={ETIQUETA_FOTO_DESPUES}
          titulo="Fotos del después"
          bloqueadoMotivo={motivoBloqueo}
          antesDeGuardar={() => persistir()}
          onCambio={setFotosDespues}
        />
        {resuelto ? (
          <div className="flex items-center justify-between gap-2 rounded-xl bg-emerald-100/70 px-3 py-2.5">
            <p className="text-sm font-medium text-emerald-800">
              ✓ Resuelto{original?.fechaSolucion ? ` el ${formatearFecha(original.fechaSolucion)}` : ''}
            </p>
            <button type="button" onClick={reabrir} className="flex items-center gap-1 text-xs font-medium text-slate-500">
              <RotateCcw className="h-3.5 w-3.5" /> Reabrir
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={marcarResuelto}
            disabled={!campos.descripcion.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" /> Marcar como resuelto
          </button>
        )}
        {!resuelto && campos.solucion.trim() && fotosDespues === 0 && (
          <p className="text-[11px] text-slate-500">Sugerencia: agrega una foto del después para mostrar el resultado en el informe.</p>
        )}
      </Seccion>

      {verPlan && (
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Comentarios internos</label>
          <textarea
            value={campos.comentarios}
            onChange={(e) => setCampos({ ...campos, comentarios: e.target.value })}
            rows={2}
            placeholder="No aparecen en los informes."
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          />
        </div>
      )}

      {!pendienteId && (
        <button
          type="button"
          onClick={guardarYOtra}
          disabled={guardando || !campos.descripcion.trim()}
          className="flex items-center justify-center gap-2 rounded-xl border-2 border-accent bg-white py-3 text-sm font-semibold text-accent disabled:opacity-50"
        >
          <Plus className="h-4 w-4" strokeWidth={3} /> Guardar y agregar otro hallazgo
        </button>
      )}
      <button
        type="submit"
        disabled={guardando || !campos.descripcion.trim()}
        className="-mt-1 rounded-xl bg-accent py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {!pendienteId ? 'Guardar y terminar' : 'Guardar cambios'}
      </button>
    </form>
  )
}

const TONOS = {
  antes: { caja: 'border-rose-200 bg-rose-50/60', titulo: 'text-rose-700', punto: 'bg-rose-500' },
  accion: { caja: 'border-slate-200 bg-white', titulo: 'text-slate-700', punto: 'bg-sky-500' },
  despues: { caja: 'border-emerald-200 bg-emerald-50/60', titulo: 'text-emerald-700', punto: 'bg-emerald-500' },
}

function Seccion({
  tono,
  titulo,
  ayuda,
  abierto = true,
  onAbrir,
  resumen,
  children,
}: {
  tono: keyof typeof TONOS
  titulo: string
  ayuda?: string
  abierto?: boolean
  onAbrir?: () => void
  resumen?: string
  children: ReactNode
}) {
  const t = TONOS[tono]
  if (!abierto) {
    return (
      <button type="button" onClick={onAbrir} className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left ${t.caja}`}>
        <div className="min-w-0 flex-1">
          <p className={`flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide ${t.titulo}`}>
            <span className={`h-2 w-2 rounded-full ${t.punto}`} />
            {titulo}
          </p>
          {resumen && <p className="mt-0.5 truncate text-xs text-slate-500">{resumen}</p>}
        </div>
        <ChevronDown className="h-5 w-5 shrink-0 text-slate-400" />
      </button>
    )
  }
  return (
    <section className={`flex flex-col gap-3 rounded-2xl border p-4 ${t.caja}`}>
      <div>
        <p className={`flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide ${t.titulo}`}>
          <span className={`h-2 w-2 rounded-full ${t.punto}`} />
          {titulo}
        </p>
        {ayuda && <p className="mt-0.5 text-xs text-slate-500">{ayuda}</p>}
      </div>
      {children}
    </section>
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
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      />
    </div>
  )
}
