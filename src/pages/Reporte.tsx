import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { listarActividadesPorVisita, listarPendientesPorVisita, obtenerVisita } from '../db'
import { diaActual } from '../lib/progreso'
import {
  copiarHtmlYTexto,
  generarAsuntoOutlook,
  generarInformeDiarioOutlookHTML,
  generarReporteOutlook,
  generarReporteWhatsApp,
} from '../lib/reportes'
import type { Actividad, Pendiente, Visita } from '../types'

async function copiar(texto: string) {
  try {
    await navigator.clipboard.writeText(texto)
    alert('Copiado al portapapeles.')
  } catch {
    alert('No se pudo copiar automáticamente. Selecciona el texto y cópialo manualmente.')
  }
}

export default function Reporte() {
  const { id } = useParams<{ id: string }>()
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const [visita, setVisita] = useState<Visita | null | undefined>(undefined)
  const [actividades, setActividades] = useState<Actividad[]>([])
  const [pendientes, setPendientes] = useState<Pendiente[]>([])
  const [dia, setDia] = useState(1)
  const [textoWhatsApp, setTextoWhatsApp] = useState('')
  const [asuntoOutlook, setAsuntoOutlook] = useState('')
  const [textoOutlook, setTextoOutlook] = useState('')
  const [htmlOutlook, setHtmlOutlook] = useState('')

  useEffect(() => {
    if (!id) return
    async function cargar() {
      const [v, acts, pends] = await Promise.all([obtenerVisita(id!), listarActividadesPorVisita(id!), listarPendientesPorVisita(id!)])
      setVisita(v ?? null)
      setActividades(acts)
      setPendientes(pends)
      if (v) {
        const diaParam = Number(params.get('dia'))
        const d =
          diaParam ||
          (() => {
            const c = diaActual(v)
            return c && c > 0 ? c : 1
          })()
        setDia(d)
        const actsDia = acts.filter((a) => a.dia === d)
        setTextoWhatsApp(generarReporteWhatsApp(v, actsDia, pends, d))
        setAsuntoOutlook(generarAsuntoOutlook(v, actsDia, d))
        setTextoOutlook(generarReporteOutlook(v, actsDia, pends))
        setHtmlOutlook(generarInformeDiarioOutlookHTML(v, actsDia, pends, d))
      }
    }
    cargar()
  }, [id])

  if (visita === undefined) return <p className="text-sm text-slate-500">Cargando…</p>
  if (visita === null) return <p className="text-sm text-rose-600">Visita no encontrada.</p>

  function regenerar() {
    if (!visita) return
    const actsDia = actividades.filter((a) => a.dia === dia)
    setTextoWhatsApp(generarReporteWhatsApp(visita, actsDia, pendientes, dia))
    setAsuntoOutlook(generarAsuntoOutlook(visita, actsDia, dia))
    setTextoOutlook(generarReporteOutlook(visita, actsDia, pendientes))
    setHtmlOutlook(generarInformeDiarioOutlookHTML(visita, actsDia, pendientes, dia))
  }

  async function compartirWhatsApp() {
    if (navigator.share) {
      try {
        await navigator.share({ text: textoWhatsApp })
        return
      } catch {
        return
      }
    }
    await copiar(textoWhatsApp)
  }

  async function copiarInformeConFormato() {
    const ok = await copiarHtmlYTexto(htmlOutlook, `${asuntoOutlook}\n\n${textoOutlook}`)
    alert(ok ? 'Informe copiado. Pégalo en Outlook con Ctrl+V (mantiene el formato).' : 'No se pudo copiar automáticamente.')
  }

  function abrirCorreo() {
    const asunto = encodeURIComponent(asuntoOutlook)
    const cuerpo = encodeURIComponent(textoOutlook)
    window.location.href = `mailto:?subject=${asunto}&body=${cuerpo}`
  }

  return (
    <div className="flex flex-col gap-4 pb-8">
      <button onClick={() => navigate(`/visitas/${visita.id}`)} className="self-start text-sm text-slate-500">
        ← Volver a la visita
      </button>

      <div className="flex items-center justify-between rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/60 p-4">
        <div>
          <p className="text-sm font-medium text-slate-700">Reporte del día</p>
          <p className="text-xs text-slate-500">{visita.planta || 'Planta sin definir'}</p>
        </div>
        <div className="flex items-center gap-2">
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
          <button onClick={regenerar} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700">
            Regenerar
          </button>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/60 p-4">
        <h3 className="mb-1 text-sm font-semibold text-slate-800">WhatsApp — resumen ejecutivo</h3>
        <p className="mb-2 text-xs text-slate-500">Previsualiza, edita si hace falta, y comparte o copia.</p>
        <textarea
          value={textoWhatsApp}
          onChange={(e) => setTextoWhatsApp(e.target.value)}
          rows={14}
          className="w-full whitespace-pre-wrap rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
        />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button onClick={() => copiar(textoWhatsApp)} className="rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-700">
            Copiar
          </button>
          <button onClick={compartirWhatsApp} className="rounded-lg bg-accent py-2.5 text-sm font-semibold text-white">
            Compartir
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/60 p-4">
        <h3 className="mb-1 text-sm font-semibold text-slate-800">Outlook — vista previa con formato</h3>
        <p className="mb-2 text-xs text-slate-500">Así se verá el informe. Cópialo con formato y pégalo en un correo nuevo (Ctrl+V).</p>

        <div className="overflow-hidden rounded-lg border border-slate-200">
          <iframe title="Vista previa del informe" srcDoc={htmlOutlook} className="h-[420px] w-full bg-slate-100" sandbox="" />
        </div>

        <button onClick={copiarInformeConFormato} className="mt-2 w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-white">
          Copiar informe con formato
        </button>

        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-medium text-slate-500">Editar como texto simple / asunto</summary>
          <div className="mt-2">
            <label className="mb-1 block text-xs font-medium text-slate-600">Asunto</label>
            <input
              value={asuntoOutlook}
              onChange={(e) => setAsuntoOutlook(e.target.value)}
              className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <textarea
              value={textoOutlook}
              onChange={(e) => setTextoOutlook(e.target.value)}
              rows={12}
              className="w-full whitespace-pre-wrap rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
            />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                onClick={() => copiar(`${asuntoOutlook}\n\n${textoOutlook}`)}
                className="rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-700"
              >
                Copiar solo texto
              </button>
              <button onClick={abrirCorreo} className="rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-700">
                Abrir correo
              </button>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              El texto editado aquí no cambia la vista previa con formato de arriba — úsalo si prefieres pegar texto simple.
            </p>
          </div>
        </details>
      </section>
    </div>
  )
}
