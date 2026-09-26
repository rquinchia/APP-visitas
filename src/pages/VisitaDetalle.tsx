import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { guardarVisita, obtenerVisita, registrarCambioHistorial } from '../db'
import { generarId, ahoraISO } from '../lib/id'
import type { EstadoVisita, Visita } from '../types'
import { ETIQUETA_ESTADO, TIPOS_VISITA } from '../types'
import EstadoBadge from '../components/EstadoBadge'

interface Transicion {
  destino: EstadoVisita
  etiqueta: string
  requiereFechaInicio?: boolean
}

const TRANSICIONES: Partial<Record<EstadoVisita, Transicion[]>> = {
  BORRADOR: [{ destino: 'EN_REVISION', etiqueta: 'Enviar a revisión' }],
  EN_REVISION: [{ destino: 'ENVIADO_APROBACION', etiqueta: 'Enviar para aprobación' }],
  ENVIADO_APROBACION: [
    { destino: 'APROBADO', etiqueta: 'Aprobar' },
    { destino: 'AJUSTES_SOLICITADOS', etiqueta: 'Solicitar ajustes' },
  ],
  AJUSTES_SOLICITADOS: [{ destino: 'EN_REVISION', etiqueta: 'Volver a revisión' }],
  APROBADO: [{ destino: 'LISTO_PARA_INICIAR', etiqueta: 'Marcar listo para iniciar' }],
  LISTO_PARA_INICIAR: [{ destino: 'VISITA_ACTIVA', etiqueta: 'INICIAR VISITA', requiereFechaInicio: true }],
  VISITA_ACTIVA: [{ destino: 'VISITA_TERMINADA', etiqueta: 'TERMINAR VISITA' }],
  VISITA_TERMINADA: [{ destino: 'SEGUIMIENTO_PENDIENTES', etiqueta: 'Pasar a seguimiento de pendientes' }],
  SEGUIMIENTO_PENDIENTES: [{ destino: 'CERRADO', etiqueta: 'Cerrar visita' }],
}

export default function VisitaDetalle() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [visita, setVisita] = useState<Visita | null | undefined>(undefined)
  const [fechaInicio, setFechaInicio] = useState('')

  useEffect(() => {
    if (!id) return
    obtenerVisita(id).then((v) => {
      setVisita(v ?? null)
      setFechaInicio(v?.fechaInicio ?? '')
    })
  }, [id])

  if (visita === undefined) return <p className="text-sm text-slate-500">Cargando…</p>
  if (visita === null) return <p className="text-sm text-rose-600">Visita no encontrada.</p>

  async function guardarFechaInicio() {
    if (!visita) return
    const actualizada: Visita = { ...visita, fechaInicio: fechaInicio || null, actualizadoEn: ahoraISO() }
    await guardarVisita(actualizada)
    setVisita(actualizada)
  }

  async function aplicarTransicion(t: Transicion) {
    if (!visita) return
    if (t.requiereFechaInicio && !visita.fechaInicio) {
      alert('Antes de iniciar la visita, guarda la fecha de inicio.')
      return
    }
    const confirmado = window.confirm(`¿Confirmas: "${t.etiqueta}"?\n\nEstado actual: ${ETIQUETA_ESTADO[visita.estado]}\nNuevo estado: ${ETIQUETA_ESTADO[t.destino]}`)
    if (!confirmado) return

    const motivo = window.prompt('Motivo del cambio (opcional):', '') ?? ''
    const actualizada: Visita = { ...visita, estado: t.destino, actualizadoEn: ahoraISO() }
    await guardarVisita(actualizada)
    await registrarCambioHistorial({
      id: generarId(),
      visitaId: visita.id,
      version: visita.version,
      fecha: ahoraISO(),
      cambio: `Estado: ${ETIQUETA_ESTADO[visita.estado]} → ${ETIQUETA_ESTADO[t.destino]}`,
      motivo,
    })
    setVisita(actualizada)
  }

  const transicionesDisponibles = TRANSICIONES[visita.estado] ?? []

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

      {transicionesDisponibles.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-2 text-sm font-medium text-slate-700">Ciclo de vida</p>
          <div className="flex flex-col gap-2">
            {transicionesDisponibles.map((t) => (
              <button
                key={t.destino}
                onClick={() => aplicarTransicion(t)}
                className="rounded-lg bg-accent py-2.5 text-sm font-semibold text-white"
              >
                {t.etiqueta}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-500">
        Plan de actividades, registro diario, fotos y hallazgos: próximo módulo.
      </div>
    </div>
  )
}
