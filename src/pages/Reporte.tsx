import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Copy, Mail, MessageCircle, RotateCcw, Share2 } from 'lucide-react'
import { listarActividadesPorVisita, listarFotosPorEntidad, listarPendientesPorVisita, obtenerVisita } from '../db'
import { diaActual } from '../lib/progreso'
import { blobAThumbnailDataUrl } from '../lib/imagenes'
import { descargarBorradorOutlook } from '../lib/outlook'
import {
  copiarHtmlYTexto,
  envolverInformeHTML,
  generarAsuntoOutlook,
  generarInformeDiarioOutlookHTML,
  generarReporteWhatsApp,
} from '../lib/reportes'
import type { Actividad, Pendiente, Visita } from '../types'
import { BotonPrimario, BotonSecundario, Card, PageHeader } from '../components/ui'
import Segmentado from '../components/Segmentado'

const MAX_FOTOS_INFORME = 12

async function copiar(texto: string) {
  try {
    await navigator.clipboard.writeText(texto)
    alert('Copiado al portapapeles.')
  } catch {
    alert('No se pudo copiar automáticamente. Selecciona el texto y cópialo manualmente.')
  }
}

async function cargarMiniaturas(actividades: Actividad[]): Promise<{ dataUrls: string[]; total: number }> {
  const listas = await Promise.all(actividades.map((a) => listarFotosPorEntidad(a.id)))
  const todas = listas.flat()
  const capadas = todas.slice(0, MAX_FOTOS_INFORME)
  const dataUrls = await Promise.all(capadas.map((f) => blobAThumbnailDataUrl(f.blob).catch(() => null)))
  return { dataUrls: dataUrls.filter((u): u is string => !!u), total: todas.length }
}

function nombreSeguro(texto: string) {
  return texto.replace(/[\\/:*?"<>|]/g, '').trim() || 'Informe'
}

export default function Reporte() {
  const { id } = useParams<{ id: string }>()
  const [params] = useSearchParams()

  const [visita, setVisita] = useState<Visita | null | undefined>(undefined)
  const [actividades, setActividades] = useState<Actividad[]>([])
  const [pendientes, setPendientes] = useState<Pendiente[]>([])
  const [dia, setDia] = useState(1)
  const [pestana, setPestana] = useState<'outlook' | 'whatsapp'>('outlook')
  const [textoWhatsApp, setTextoWhatsApp] = useState('')
  const [asuntoOutlook, setAsuntoOutlook] = useState('')
  const [subtituloOutlook, setSubtituloOutlook] = useState('')
  const [semillaHtml, setSemillaHtml] = useState('')
  const [versionSemilla, setVersionSemilla] = useState(0)
  const [generando, setGenerando] = useState(true)

  const cuerpoRef = useRef<HTMLDivElement>(null)

  // El contenido editable se escribe en el DOM solo cuando cambia la "semilla" (o se regenera),
  // así las ediciones del usuario no se pierden con otros cambios de estado de la pantalla.
  useEffect(() => {
    if (cuerpoRef.current) cuerpoRef.current.innerHTML = semillaHtml
  }, [semillaHtml, versionSemilla, visita])

  async function generar(v: Visita, todasActs: Actividad[], todasPends: Pendiente[], d: number) {
    setGenerando(true)
    const actsDia = todasActs.filter((a) => a.dia === d)
    setTextoWhatsApp(generarReporteWhatsApp(v, actsDia, todasPends, d))
    setAsuntoOutlook(generarAsuntoOutlook(v, actsDia, d))
    const { dataUrls, total } = await cargarMiniaturas(actsDia)
    const { subtitulo, cuerpoHtml } = generarInformeDiarioOutlookHTML(v, actsDia, todasPends, d, dataUrls, total)
    setSubtituloOutlook(subtitulo)
    setSemillaHtml(cuerpoHtml)
    setVersionSemilla((n) => n + 1)
    setGenerando(false)
  }

  useEffect(() => {
    if (!id) return
    async function cargar() {
      const [v, acts, pends] = await Promise.all([obtenerVisita(id!), listarActividadesPorVisita(id!), listarPendientesPorVisita(id!)])
      setVisita(v ?? null)
      setActividades(acts)
      setPendientes(pends)
      if (v) {
        const diaParam = Number(params.get('dia'))
        const c = diaActual(v)
        const d = diaParam || (c && c > 0 ? c : 1)
        setDia(d)
        await generar(v, acts, pends, d)
      }
    }
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (visita === undefined) return <p className="text-sm text-slate-500">Cargando…</p>
  if (visita === null) return <p className="text-sm text-rose-600">Visita no encontrada.</p>

  function regenerar() {
    if (!visita) return
    if (!window.confirm('Esto vuelve a generar el informe automáticamente y descarta tus ediciones. ¿Continuar?')) return
    generar(visita, actividades, pendientes, dia)
  }

  function htmlFinal(): string | null {
    if (!cuerpoRef.current || !visita) return null
    return envolverInformeHTML(visita.planta || 'Planta', subtituloOutlook, cuerpoRef.current.innerHTML)
  }

  function abrirEnOutlook() {
    const html = htmlFinal()
    if (!html || !visita) return
    descargarBorradorOutlook(asuntoOutlook, html, nombreSeguro(`Informe ${visita.planta} Dia ${dia}`))
  }

  async function copiarConFormato() {
    const html = htmlFinal()
    if (!html || !cuerpoRef.current) return
    const ok = await copiarHtmlYTexto(html, `${asuntoOutlook}\n\n${cuerpoRef.current.innerText}`)
    alert(ok ? 'Informe copiado. Pégalo en un correo nuevo con Ctrl+V.' : 'No se pudo copiar automáticamente.')
  }

  async function compartirWhatsApp() {
    if (navigator.share) {
      try {
        await navigator.share({ text: textoWhatsApp })
      } catch {
        // cancelado por el usuario
      }
      return
    }
    await copiar(textoWhatsApp)
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        titulo="Reporte del día"
        subtitulo={visita.planta || 'Planta sin definir'}
        atras={`/visitas/${visita.id}`}
        atrasEtiqueta="Visita"
        accion={
          <select
            value={dia}
            onChange={(e) => {
              const d = Number(e.target.value)
              setDia(d)
              generar(visita, actividades, pendientes, d)
            }}
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

      <Segmentado
        opciones={[
          { valor: 'outlook', etiqueta: 'Correo (Outlook)' },
          { valor: 'whatsapp', etiqueta: 'WhatsApp' },
        ]}
        valor={pestana}
        onChange={(v) => setPestana(v as 'outlook' | 'whatsapp')}
      />

      <div className={pestana === 'outlook' ? 'flex flex-col gap-4' : 'hidden'}>
          <Card className="p-0">
            <div className="border-b border-slate-100 px-4 py-3">
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Asunto</label>
              <input
                value={asuntoOutlook}
                onChange={(e) => setAsuntoOutlook(e.target.value)}
                className="w-full bg-transparent text-sm font-medium text-slate-800 outline-none"
              />
            </div>
            <div className="bg-gradient-to-br from-slate-900 to-sky-800 px-4 py-4 text-white">
              <p className="text-[10px] font-bold uppercase tracking-widest text-sky-300">Informe de visita técnica</p>
              <p className="mt-1 text-lg font-bold">{visita.planta || 'Planta'}</p>
              <p className="text-xs text-sky-100">{subtituloOutlook}</p>
            </div>
            {generando && <p className="px-4 pt-3 text-xs text-slate-400">Preparando informe y fotos…</p>}
            <div
              ref={cuerpoRef}
              contentEditable
              suppressContentEditableWarning
              className="max-h-[520px] min-h-[160px] overflow-y-auto px-4 py-2 outline-none"
            />
            <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
              ✏️ Toca el texto para editarlo: puedes agregar, borrar o corregir antes de enviarlo.
            </p>
          </Card>

          <BotonPrimario onClick={abrirEnOutlook} disabled={generando}>
            <Mail className="h-5 w-5" /> Abrir en Outlook
          </BotonPrimario>
          <div className="grid grid-cols-2 gap-2">
            <BotonSecundario onClick={copiarConFormato} disabled={generando}>
              <Copy className="h-4 w-4" /> Copiar
            </BotonSecundario>
            <BotonSecundario onClick={regenerar} disabled={generando}>
              <RotateCcw className="h-4 w-4" /> Regenerar
            </BotonSecundario>
          </div>
          <p className="px-1 text-center text-[11px] leading-relaxed text-slate-400">
            "Abrir en Outlook" descarga el borrador: ábrelo (clic en la descarga) y se abrirá en Outlook como correo nuevo,
            con formato y fotos, listo para poner destinatarios y enviar.
          </p>
      </div>

      <div className={pestana === 'whatsapp' ? 'flex flex-col gap-4' : 'hidden'}>
          <Card className="p-0">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <MessageCircle className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-semibold text-slate-800">Resumen ejecutivo</span>
            </div>
            <textarea
              value={textoWhatsApp}
              onChange={(e) => setTextoWhatsApp(e.target.value)}
              rows={16}
              className="w-full resize-none bg-[#e7f5ec] px-4 py-3 text-[13px] leading-relaxed text-slate-800 outline-none"
            />
          </Card>
          <BotonPrimario tono="verde" onClick={compartirWhatsApp}>
            <Share2 className="h-5 w-5" /> Compartir
          </BotonPrimario>
          <BotonSecundario onClick={() => copiar(textoWhatsApp)}>
            <Copy className="h-4 w-4" /> Copiar texto
          </BotonSecundario>
      </div>
    </div>
  )
}
