import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Plus } from 'lucide-react'
import { listarFotosPorEntidad } from '../db'
import type { Pendiente } from '../types'
import { ETIQUETA_FOTO_DESPUES, estaResuelto } from '../types'

const COLOR_PRIORIDAD = { P1: 'bg-rose-600', P2: 'bg-orange-500', P3: 'bg-amber-400', P4: 'bg-slate-300' } as const

interface Props {
  visitaId: string
  actividadId: string
  hallazgos: Pendiente[]
  /** Códigos H-01… de la visita (los mismos de los informes). */
  codigos: Map<string, string>
  /** Ruta a la que vuelve el formulario del hallazgo al guardar. */
  volver: string
}

/** Lista de hallazgos (observaciones) de una actividad, con miniaturas del antes y el después. */
export default function HallazgosActividad({ visitaId, actividadId, hallazgos, codigos, volver }: Props) {
  const volverParam = encodeURIComponent(volver)
  const resueltos = hallazgos.filter(estaResuelto).length

  return (
    <div className="mt-3 rounded-xl bg-slate-50 p-2.5">
      <div className="mb-1.5 flex items-center justify-between px-0.5">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">
          Hallazgos
          {hallazgos.length > 0 && (
            <span className="ml-1.5 font-medium normal-case tracking-normal text-slate-400">
              {hallazgos.length} · {resueltos} resuelto{resueltos === 1 ? '' : 's'}
            </span>
          )}
        </p>
        <Link
          to={`/pendientes/nuevo?visitaId=${visitaId}&actividadId=${actividadId}&volver=${volverParam}`}
          className="flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-white"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={3} /> Agregar
        </Link>
      </div>

      {hallazgos.length === 0 && (
        <p className="px-0.5 text-[11px] text-slate-400">Registra cada observación con su foto; luego agrega la solución con la foto del después.</p>
      )}

      <div className="flex flex-col gap-1.5">
        {hallazgos.map((h) => (
          <FilaHallazgo key={h.id} hallazgo={h} codigo={codigos.get(h.id) ?? ''} to={`/pendientes/${h.id}/editar?volver=${volverParam}`} />
        ))}
      </div>
    </div>
  )
}

function FilaHallazgo({ hallazgo, codigo, to }: { hallazgo: Pendiente; codigo: string; to: string }) {
  const [antes, setAntes] = useState<string | null>(null)
  const [despues, setDespues] = useState<string | null>(null)
  const resuelto = estaResuelto(hallazgo)

  useEffect(() => {
    let urls: string[] = []
    listarFotosPorEntidad(hallazgo.id).then((fotos) => {
      const a = fotos.find((f) => !f.etiqueta)
      const d = fotos.find((f) => f.etiqueta === ETIQUETA_FOTO_DESPUES)
      if (a) {
        const u = URL.createObjectURL(a.blob)
        urls.push(u)
        setAntes(u)
      }
      if (d) {
        const u = URL.createObjectURL(d.blob)
        urls.push(u)
        setDespues(u)
      }
    })
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u))
      urls = []
    }
  }, [hallazgo.id, hallazgo.actualizadoEn])

  return (
    <Link to={to} className="flex items-center gap-2.5 rounded-lg bg-white p-2 shadow-sm shadow-slate-200/60 active:bg-slate-50">
      <div className="flex shrink-0 items-center gap-1">
        <Miniatura url={antes} etiqueta="Antes" tono="rose" />
        <ArrowRight className="h-3 w-3 text-slate-300" />
        <Miniatura url={despues} etiqueta="Después" tono="emerald" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[13px] font-medium leading-snug text-slate-800">{hallazgo.descripcion}</p>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-slate-700">{codigo}</span>
          <span className={`rounded-full px-1.5 py-px text-[10px] font-bold text-white ${COLOR_PRIORIDAD[hallazgo.prioridad]}`}>
            {hallazgo.prioridad}
          </span>
          <span className={`text-[11px] font-medium ${resuelto ? 'text-emerald-700' : 'text-slate-500'}`}>
            {resuelto ? '✓ Resuelto' : hallazgo.solucion ? 'Solución en curso' : 'Abierto'}
          </span>
        </div>
      </div>
    </Link>
  )
}

function Miniatura({ url, etiqueta, tono }: { url: string | null; etiqueta: string; tono: 'rose' | 'emerald' }) {
  if (url) {
    return <img src={url} alt={etiqueta} className={`h-11 w-11 rounded-md object-cover ring-2 ${tono === 'rose' ? 'ring-rose-200' : 'ring-emerald-300'}`} />
  }
  return (
    <span
      className={`flex h-11 w-11 items-center justify-center rounded-md border border-dashed text-[8.5px] font-medium ${
        tono === 'rose' ? 'border-rose-200 text-rose-300' : 'border-emerald-200 text-emerald-400'
      }`}
    >
      {etiqueta}
    </span>
  )
}
