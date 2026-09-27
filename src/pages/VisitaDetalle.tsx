import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CalendarCheck, ClipboardList, FileText, Flag, ListTodo, Send, type LucideIcon } from 'lucide-react'
import { guardarVisita, listarActividadesPorVisita, listarPendientesPorVisita, obtenerVisita } from '../db'
import { ahoraISO } from '../lib/id'
import type { Actividad, EstadoVisita, Pendiente, Visita } from '../types'
import { TIPOS_VISITA } from '../types'
import EstadoBadge from '../components/EstadoBadge'
import BarraProgreso from '../components/BarraProgreso'
import { calcularAvance, diaActual } from '../lib/progreso'
import { TRANSICIONES, aplicarTransicionEstado, type Transicion } from '../lib/transiciones'
import { Card, IconTile, PageHeader, SectionTitle, type ColorIcono } from '../components/ui'

const FASES: { nombre: string; estados: EstadoVisita[] }[] = [
  { nombre: 'Planificación', estados: ['BORRADOR', 'EN_REVISION', 'ENVIADO_APROBACION', 'AJUSTES_SOLICITADOS'] },
  { nombre: 'Aprobación', estados: ['APROBADO', 'LISTO_PARA_INICIAR'] },
  { nombre: 'En planta', estados: ['VISITA_ACTIVA'] },
  { nombre: 'Cierre', estados: ['VISITA_TERMINADA', 'SEGUIMIENTO_PENDIENTES', 'CERRADO'] },
]

const GUIA: Record<EstadoVisita, string> = {
  BORRADOR: 'Arma el plan de actividades y, cuando esté listo, envíalo a revisión.',
  EN_REVISION: 'Revisa el plan una vez más y envíalo para aprobación.',
  ENVIADO_APROBACION: 'Registra si el plan fue aprobado o si pidieron ajustes.',
  AJUSTES_SOLICITADOS: 'Ajusta el plan y vuelve a enviarlo a revisión.',
  APROBADO: 'Confirma la fecha de inicio y marca la visita como lista para iniciar.',
  LISTO_PARA_INICIAR: 'Todo listo. El primer día en planta, pulsa "Iniciar visita".',
  VISITA_ACTIVA: 'Registra el avance en "Hoy" y envía el reporte del día. Al final, termina la visita.',
  VISITA_TERMINADA: 'Da seguimiento a los pendientes que quedaron abiertos.',
  SEGUIMIENTO_PENDIENTES: 'Cuando los pendientes estén resueltos, cierra la visita.',
  CERRADO: 'Visita cerrada. Puedes consultar el informe final cuando quieras.',
}

const EN_EJECUCION_O_DESPUES: EstadoVisita[] = ['VISITA_ACTIVA', 'VISITA_TERMINADA', 'SEGUIMIENTO_PENDIENTES', 'CERRADO']

export default function VisitaDetalle() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [visita, setVisita] = useState<Visita | null | undefined>(undefined)
  const [actividades, setActividades] = useState<Actividad[]>([])
  const [pendientes, setPendientes] = useState<Pendiente[]>([])
  const [fechaInicio, setFechaInicio] = useState('')

  useEffect(() => {
    if (!id) return
    obtenerVisita(id).then((v) => {
      setVisita(v ?? null)
      setFechaInicio(v?.fechaInicio ?? '')
    })
    listarActividadesPorVisita(id).then(setActividades)
    listarPendientesPorVisita(id).then(setPendientes)
  }, [id])

  if (visita === undefined) return <p className="text-sm text-slate-500">Cargando…</p>
  if (visita === null) return <p className="text-sm text-rose-600">Visita no encontrada.</p>

  async function guardarFechaInicio(valor: string) {
    if (!visita) return
    setFechaInicio(valor)
    const actualizada: Visita = { ...visita, fechaInicio: valor || null, actualizadoEn: ahoraISO() }
    try {
      await guardarVisita(actualizada)
      setVisita(actualizada)
    } catch {
      alert('No se pudo guardar la fecha. Inténtalo de nuevo.')
    }
  }

  async function onTransicion(t: Transicion) {
    if (!visita) return
    if (t.requierePlanPreview) {
      navigate(`/visitas/${visita.id}/plan/vista-previa?destino=${t.destino}`)
      return
    }
    if (t.requiereCierre) {
      navigate(`/visitas/${visita.id}/cierre`)
      return
    }
    const resultado = await aplicarTransicionEstado(visita, t)
    if (resultado) setVisita(resultado)
  }

  const transiciones = TRANSICIONES[visita.estado] ?? []
  const avance = calcularAvance(actividades)
  const dia = diaActual(visita)
  const faseActual = FASES.findIndex((f) => f.estados.includes(visita.estado))
  const enEjecucion = EN_EJECUCION_O_DESPUES.includes(visita.estado)
  const abiertos = pendientes.filter((p) => p.estado !== 'CERRADO' && p.estado !== 'CANCELADO').length

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        titulo={visita.planta || 'Planta sin definir'}
        subtitulo={`${TIPOS_VISITA[visita.tipo].nombre}${visita.cliente ? ` · ${visita.cliente}` : ''}`}
        atras="/visitas"
        atrasEtiqueta="Visitas"
        accion={<EstadoBadge estado={visita.estado} />}
      />

      <Card>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Avance</p>
            <p className="text-4xl font-bold tracking-tight text-slate-900">{avance.porcentaje}%</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium text-slate-500">{dia && dia > 0 ? 'Día' : 'Duración'}</p>
            <p className="text-xl font-semibold text-slate-800">
              {dia && dia > 0 ? `${dia}/${visita.duracionDias}` : `${visita.duracionDias} días`}
            </p>
          </div>
        </div>
        <div className="mt-3">
          <BarraProgreso porcentaje={avance.porcentaje} />
        </div>

        <div className="mt-5 flex items-start">
          {FASES.map((f, i) => (
            <div key={f.nombre} className="flex flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                <span className={`h-0.5 flex-1 ${i === 0 ? 'bg-transparent' : i <= faseActual ? 'bg-accent' : 'bg-slate-200'}`} />
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                    i < faseActual
                      ? 'bg-accent text-white'
                      : i === faseActual
                        ? 'bg-accent text-white ring-4 ring-accent/20'
                        : 'bg-slate-200 text-slate-400'
                  }`}
                >
                  {i < faseActual ? '✓' : i + 1}
                </span>
                <span
                  className={`h-0.5 flex-1 ${i === FASES.length - 1 ? 'bg-transparent' : i < faseActual ? 'bg-accent' : 'bg-slate-200'}`}
                />
              </div>
              <span className={`mt-1.5 text-[10.5px] font-medium ${i === faseActual ? 'text-accent' : 'text-slate-400'}`}>{f.nombre}</span>
            </div>
          ))}
        </div>
      </Card>

      {transiciones.length > 0 || visita.estado === 'CERRADO' ? (
        <div className="rounded-2xl bg-gradient-to-br from-sky-600 to-indigo-600 p-4 text-white shadow-lg shadow-sky-600/20">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-100">Siguiente paso</p>
          <p className="mt-1 text-[15px] leading-snug">{GUIA[visita.estado]}</p>
          {transiciones.length > 0 && (
            <div className="mt-3 flex flex-col gap-2">
              {transiciones.map((t, i) => (
                <button
                  key={t.destino}
                  onClick={() => onTransicion(t)}
                  className={`w-full rounded-xl py-3 text-[15px] font-semibold ${
                    i === 0 ? 'bg-white text-sky-700' : 'border border-white/40 bg-white/10 text-white'
                  }`}
                >
                  {t.etiqueta}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <SectionTitle>Trabajo de la visita</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        {enEjecucion && (
          <Mosaico to={`/visitas/${visita.id}/hoy`} icono={CalendarCheck} color="verde" titulo="Hoy" detalle="Registrar avance y fotos" destacado />
        )}
        <Mosaico
          to={`/visitas/${visita.id}/plan`}
          icono={ClipboardList}
          color="azul"
          titulo="Plan"
          detalle={actividades.length === 0 ? 'Sin actividades' : `${actividades.length} actividades`}
        />
        <Mosaico
          to={`/pendientes?visitaId=${visita.id}`}
          icono={ListTodo}
          color="naranja"
          titulo="Pendientes"
          detalle={pendientes.length === 0 ? 'Sin registros' : `${abiertos} abiertos`}
        />
        {enEjecucion && (
          <Mosaico to={`/visitas/${visita.id}/reporte`} icono={Send} color="indigo" titulo="Reporte del día" detalle="WhatsApp y Outlook" />
        )}
        {enEjecucion && (
          <Mosaico to={`/visitas/${visita.id}/cierre`} icono={Flag} color="morado" titulo="Informe final" detalle="Consolidado de la visita" />
        )}
      </div>

      <SectionTitle>Datos de la visita</SectionTitle>
      <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/60">
        <Fila etiqueta="Objetivo">{visita.objetivo}</Fila>
        <Fila etiqueta="Responsable">{visita.responsable || '—'}</Fila>
        <Fila etiqueta="Fecha de inicio">
          <input
            type="date"
            value={fechaInicio}
            onChange={(e) => guardarFechaInicio(e.target.value)}
            className="rounded-lg bg-slate-100 px-2 py-1 text-sm text-slate-800"
          />
        </Fila>
        <Fila etiqueta="Versión del plan">v{visita.version}</Fila>
      </div>

      <Link to={`/visitas/${visita.id}/plan/vista-previa`} className="flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-accent">
        <FileText className="h-4 w-4" /> Ver plan completo
      </Link>
    </div>
  )
}

function Mosaico({
  to,
  icono,
  color,
  titulo,
  detalle,
  destacado,
}: {
  to: string
  icono: LucideIcon
  color: ColorIcono
  titulo: string
  detalle: string
  destacado?: boolean
}) {
  return (
    <Link
      to={to}
      className={`flex flex-col gap-3 rounded-2xl border p-4 shadow-sm ${
        destacado ? 'col-span-2 border-emerald-200 bg-emerald-50 shadow-emerald-100' : 'border-slate-200/70 bg-white shadow-slate-200/60'
      }`}
    >
      <IconTile icono={icono} color={color} grande />
      <div>
        <p className="text-[15px] font-semibold text-slate-900">{titulo}</p>
        <p className="text-xs text-slate-500">{detalle}</p>
      </div>
    </Link>
  )
}

function Fila({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <span className="shrink-0 text-sm text-slate-500">{etiqueta}</span>
      <span className="text-right text-sm text-slate-800">{children}</span>
    </div>
  )
}
