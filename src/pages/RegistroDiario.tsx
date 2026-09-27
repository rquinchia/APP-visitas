import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AlertCircle, Send, Zap } from 'lucide-react'
import { guardarActividad, listarActividadesPorVisita, obtenerVisita } from '../db'
import { Card, ListGroup, ListRow, PageHeader, SectionTitle } from '../components/ui'
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
    try {
      await guardarActividad({ ...actividad, estado, actualizadoEn: ahoraISO() })
      if (visita) await refrescar(visita.id)
    } catch {
      alert('No se pudo guardar este cambio en el dispositivo. Vuelve a intentarlo; si persiste, puede ser espacio de almacenamiento lleno.')
    }
  }

  function onComentarioChange(actividadId: string, valor: string) {
    setComentarios((prev) => ({ ...prev, [actividadId]: valor }))
  }

  async function guardarComentario(actividad: Actividad) {
    const texto = comentarios[actividad.id]
    if (texto === undefined || texto === actividad.observacion) return
    try {
      await guardarActividad({ ...actividad, observacion: texto, actualizadoEn: ahoraISO() })
      if (visita) await refrescar(visita.id)
    } catch {
      alert('No se pudo guardar el comentario. El texto sigue en pantalla — vuelve a tocar fuera del recuadro para reintentar.')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        titulo="Hoy"
        subtitulo={`${visita.planta || 'Planta sin definir'} · Día ${dia} de ${visita.duracionDias}`}
        atras={`/visitas/${visita.id}`}
        atrasEtiqueta="Visita"
        accion={
          <select
            value={dia}
            onChange={(e) => setDia(Number(e.target.value))}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm"
          >
            {Array.from({ length: visita.duracionDias }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                Día {d}
              </option>
            ))}
          </select>
        }
      />

      <Card>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Avance del día</p>
            <p className="text-3xl font-bold tracking-tight text-slate-900">{avanceDia.porcentaje}%</p>
          </div>
          <p className="text-right text-xs text-slate-500">
            Total visita
            <br />
            <span className="text-base font-semibold text-slate-700">{avanceTotal.porcentaje}%</span>
          </p>
        </div>
        <div className="mt-3">
          <BarraProgreso porcentaje={avanceDia.porcentaje} />
        </div>
      </Card>

      <ListGroup>
        <ListRow
          to={`/visitas/${visita.id}/reporte?dia=${dia}`}
          icono={Send}
          color="indigo"
          titulo="Reporte del día"
          detalle="WhatsApp y Outlook, con fotos"
        />
        <ListRow
          to={`/pendientes/nuevo?visitaId=${visita.id}`}
          icono={AlertCircle}
          color="rojo"
          titulo="Registrar hallazgo o pendiente"
        />
        <ListRow
          to={`/visitas/${visita.id}/plan/nueva?dia=${dia}&emergente=1`}
          icono={Zap}
          color="ambar"
          titulo="Añadir actividad emergente"
        />
      </ListGroup>

      <SectionTitle>Actividades del día {dia}</SectionTitle>

      {delDia.length === 0 && (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
          No hay actividades planificadas para este día.
        </p>
      )}

      <div className="-mt-2 flex flex-col gap-3">
        {delDia.map((a, i) => (
          <Card key={a.id} className={`border-l-4 ${BORDE_ESTADO[a.estado]}`}>
            <div className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold leading-snug text-slate-900">
                  {a.emergente && <Zap className="mr-1 inline h-4 w-4 text-amber-500" />}
                  {a.actividad}
                </p>
                {a.objetivo && <p className="mt-0.5 text-xs text-slate-500">{a.objetivo}</p>}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {ESTADOS_RAPIDOS.map((estado) => (
                <button
                  key={estado}
                  onClick={() => marcarEstado(a, estado)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
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
              className="mt-3 w-full rounded-xl border-0 bg-slate-100 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/30"
            />

            <div className="mt-3">
              <FotosPicker visitaId={visita.id} entidadTipo="ACTIVIDAD" entidadId={a.id} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

const BORDE_ESTADO: Record<EstadoActividad, string> = {
  PENDIENTE: 'border-l-slate-200',
  EN_PROGRESO: 'border-l-sky-400',
  COMPLETADA: 'border-l-emerald-500',
  PARCIAL: 'border-l-amber-400',
  BLOQUEADA: 'border-l-rose-500',
  NO_APLICA: 'border-l-slate-300',
}
