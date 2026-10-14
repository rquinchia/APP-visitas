import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, Camera, CheckCircle2, Copy, GraduationCap, Mail, RotateCcw, Share2, XCircle } from 'lucide-react'
import { listarActividadesPorVisita, listarFotosPorVisita, listarHistorialPorVisita, listarPendientesPorVisita, obtenerVisita } from '../db'
import {
  contextoFinal,
  copiarHtmlYTexto,
  envolverInformeHTML,
  generarAsuntoInformeFinal,
  generarInformeFinalHTML,
  generarResumenFinalWhatsApp,
  type EncabezadoInforme,
} from '../lib/reportes'
import { prepararGaleria, prepararHallazgos } from '../lib/datosInforme'
import { descargarBorradorOutlook } from '../lib/outlook'
import EncabezadoInformeVista from '../components/EncabezadoInformeVista'
import { usePuenteInforme } from '../lib/agente/usePuenteInforme'
import { calcularAvance } from '../lib/progreso'
import { aplicarTransicionEstado, buscarTransicion } from '../lib/transiciones'
import type { Actividad, CambioHistorial, Foto, Pendiente, Visita } from '../types'
import { ETIQUETA_ESTADO_ACTIVIDAD } from '../types'
import { BotonPrimario, BotonSecundario, Card, IconTile, PageHeader, type ColorIcono } from '../components/ui'
import BarraProgreso from '../components/BarraProgreso'
import Segmentado from '../components/Segmentado'
import type { LucideIcon } from 'lucide-react'

const MAX_FOTOS_ACTIVIDADES = 9

async function copiar(texto: string) {
  try {
    await navigator.clipboard.writeText(texto)
    alert('Copiado al portapapeles.')
  } catch {
    alert('No se pudo copiar automáticamente.')
  }
}

export default function Cierre() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [visita, setVisita] = useState<Visita | null | undefined>(undefined)
  const [actividades, setActividades] = useState<Actividad[]>([])
  const [pendientes, setPendientes] = useState<Pendiente[]>([])
  const [fotos, setFotos] = useState<Foto[]>([])
  const [historial, setHistorial] = useState<CambioHistorial[]>([])
  const [pestana, setPestana] = useState<'informe' | 'whatsapp' | 'historial'>('informe')
  const [confirmando, setConfirmando] = useState(false)
  const [encabezado, setEncabezado] = useState<EncabezadoInforme | null>(null)
  const [semillaHtml, setSemillaHtml] = useState('')
  const [versionSemilla, setVersionSemilla] = useState(0)
  const [generando, setGenerando] = useState(true)
  const [textoWhatsApp, setTextoWhatsApp] = useState('')
  const [asuntoEditado, setAsuntoEditado] = useState<string | null>(null)

  const cuerpoRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (cuerpoRef.current) cuerpoRef.current.innerHTML = semillaHtml
  }, [semillaHtml, versionSemilla, visita])

  async function generarInforme(v: Visita, acts: Actividad[], pends: Pendiente[]) {
    setGenerando(true)
    const ctx = contextoFinal(v, acts, pends)
    const [hallazgos, galeria] = await Promise.all([
      prepararHallazgos(ctx.hallazgos, ctx.codigos, acts),
      prepararGaleria(ctx.actividades, MAX_FOTOS_ACTIVIDADES),
    ])
    const informe = generarInformeFinalHTML(ctx, hallazgos, galeria)
    setEncabezado(informe.encabezado)
    setSemillaHtml(informe.cuerpoHtml)
    setVersionSemilla((n) => n + 1)
    setTextoWhatsApp(generarResumenFinalWhatsApp(ctx))
    setGenerando(false)
  }

  useEffect(() => {
    if (!id) return
    async function cargar() {
      const [v, acts, pends, fts, hist] = await Promise.all([
        obtenerVisita(id!),
        listarActividadesPorVisita(id!),
        listarPendientesPorVisita(id!),
        listarFotosPorVisita(id!),
        listarHistorialPorVisita(id!),
      ])
      setVisita(v ?? null)
      setActividades(acts)
      setPendientes(pends)
      setFotos(fts)
      setHistorial(hist)
      if (v) await generarInforme(v, acts, pends)
    }
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const asuntoAuto = visita ? generarAsuntoInformeFinal(contextoFinal(visita, actividades, pendientes)) : ''
  const asunto = asuntoEditado ?? asuntoAuto

  usePuenteInforme({
    tipo: 'final',
    cuerpoRef,
    whatsapp: textoWhatsApp,
    setWhatsapp: setTextoWhatsApp,
    asunto,
    setAsunto: setAsuntoEditado,
    regenerar: async () => {
      if (!visita) return
      const [acts, pends] = await Promise.all([listarActividadesPorVisita(visita.id), listarPendientesPorVisita(visita.id)])
      setActividades(acts)
      setPendientes(pends)
      await generarInforme(visita, acts, pends)
    },
  })

  if (visita === undefined) return <p className="text-sm text-slate-500">Cargando…</p>
  if (visita === null) return <p className="text-sm text-rose-600">Visita no encontrada.</p>

  const avance = calcularAvance(actividades)
  const noEjecutadas = actividades.filter((a) => a.estado === 'PENDIENTE' || a.estado === 'EN_PROGRESO' || a.estado === 'BLOQUEADA')
  const abiertosVisita = pendientes.filter((p) => p.estado !== 'CERRADO' && p.estado !== 'CANCELADO')
  const formacion = actividades.filter((a) => a.tipo.toLowerCase().includes('formaci'))
  const transicionTerminar = buscarTransicion(visita.estado, 'VISITA_TERMINADA')

  function htmlFinal(): string | null {
    if (!cuerpoRef.current || !encabezado) return null
    return envolverInformeHTML(encabezado, cuerpoRef.current.innerHTML)
  }

  function regenerar() {
    if (!visita) return
    if (!window.confirm('Esto vuelve a generar el informe automáticamente y descarta tus ediciones. ¿Continuar?')) return
    generarInforme(visita, actividades, pendientes)
  }

  function abrirEnOutlook() {
    const html = htmlFinal()
    if (!html || !visita) return
    descargarBorradorOutlook(asunto, html, `Informe final ${(visita.planta || 'visita').replace(/[\\/:*?"<>|]/g, '')}`)
  }

  async function copiarConFormato() {
    const html = htmlFinal()
    if (!html || !cuerpoRef.current) return
    const ok = await copiarHtmlYTexto(html, `${asunto}\n\n${cuerpoRef.current.innerText}`)
    alert(ok ? 'Informe copiado. Pégalo en un correo nuevo con Ctrl+V.' : 'No se pudo copiar automáticamente.')
  }

  async function compartirWhatsApp() {
    if (navigator.share) {
      try {
        await navigator.share({ text: textoWhatsApp })
      } catch {
        // cancelado
      }
      return
    }
    await copiar(textoWhatsApp)
  }

  async function confirmarCierre() {
    if (!visita || !transicionTerminar) return
    setConfirmando(true)
    const actualizada = await aplicarTransicionEstado(visita, transicionTerminar)
    setConfirmando(false)
    if (actualizada) navigate(`/visitas/${visita.id}`)
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader titulo="Cierre de visita" subtitulo={visita.planta || 'Planta sin definir'} atras={`/visitas/${visita.id}`} atrasEtiqueta="Visita" />

      <Card>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Avance final</p>
            <p className="text-4xl font-bold tracking-tight text-slate-900">{avance.porcentaje}%</p>
          </div>
          <p className="text-right text-xs text-slate-500">
            {avance.completadas} completadas
            <br />
            {avance.parciales} parciales · {avance.bloqueadas} bloqueadas
          </p>
        </div>
        <div className="mt-3">
          <BarraProgreso porcentaje={avance.porcentaje} />
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <Metrica icono={GraduationCap} color="morado" etiqueta="Formación" valor={formacion.length} />
        <Metrica icono={Camera} color="azul" etiqueta="Fotografías" valor={fotos.length} />
        <Metrica icono={CheckCircle2} color="verde" etiqueta="Hallazgos resueltos" valor={pendientes.filter((p) => p.estado === 'CERRADO').length} />
        <Metrica icono={XCircle} color="rojo" etiqueta="Pendientes abiertos" valor={abiertosVisita.length} />
      </div>

      {noEjecutadas.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-800">
            <AlertTriangle className="h-4 w-4" /> {noEjecutadas.length} actividades sin completar
          </p>
          <ul className="mt-2 space-y-1 text-xs text-amber-700">
            {noEjecutadas.map((a) => (
              <li key={a.id}>
                Día {a.dia}: {a.actividad} · {ETIQUETA_ESTADO_ACTIVIDAD[a.estado]}
              </li>
            ))}
          </ul>
        </div>
      )}

      {abiertosVisita.length > 0 && (
        <p className="rounded-xl bg-slate-200/60 px-3 py-2 text-xs text-slate-600">
          Los {abiertosVisita.length} pendientes abiertos <strong>no se cierran</strong> al terminar: pasan a seguimiento
          post-visita.
        </p>
      )}

      <Segmentado
        opciones={[
          { valor: 'informe', etiqueta: 'Informe final' },
          { valor: 'whatsapp', etiqueta: 'WhatsApp' },
          { valor: 'historial', etiqueta: 'Historial' },
        ]}
        valor={pestana}
        onChange={(v) => setPestana(v as typeof pestana)}
      />

      <div className={pestana === 'informe' ? 'flex flex-col gap-4' : 'hidden'}>
        <Card className="p-0">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Asunto</p>
            <p className="text-sm font-medium text-slate-800">{asunto}</p>
          </div>
          <EncabezadoInformeVista encabezado={encabezado} />
          {generando && <p className="px-4 pt-3 text-xs text-slate-400">Consolidando todos los días y fotos…</p>}
          <div
            ref={cuerpoRef}
            contentEditable
            suppressContentEditableWarning
            className="informe-cuerpo max-h-[620px] min-h-[160px] overflow-y-auto px-3 py-2 outline-none"
          />
          <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
            ✏️ Toca el texto para editarlo: agrega, quita o corrige lo que necesites.
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
      </div>

      <div className={pestana === 'whatsapp' ? 'flex flex-col gap-4' : 'hidden'}>
        <Card className="p-0">
          <textarea
            value={textoWhatsApp}
            onChange={(e) => setTextoWhatsApp(e.target.value)}
            rows={14}
            className="w-full resize-none rounded-2xl bg-[#e7f5ec] px-4 py-3 text-[13px] leading-relaxed text-slate-800 outline-none"
          />
        </Card>
        <BotonPrimario tono="verde" onClick={compartirWhatsApp}>
          <Share2 className="h-5 w-5" /> Compartir
        </BotonPrimario>
      </div>

      <div className={pestana === 'historial' ? 'flex flex-col gap-3' : 'hidden'}>
        <Card>
          <p className="mb-2 text-sm font-semibold text-slate-800">Actividades ({actividades.length})</p>
          <ul className="space-y-1.5 text-xs text-slate-600">
            {actividades.map((a) => (
              <li key={a.id} className="flex justify-between gap-2">
                <span className="truncate">
                  Día {a.dia} · {a.actividad}
                </span>
                <span className="shrink-0 text-slate-400">{ETIQUETA_ESTADO_ACTIVIDAD[a.estado]}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <p className="mb-2 text-sm font-semibold text-slate-800">Cambios del plan ({historial.length})</p>
          <ul className="space-y-1.5 text-xs text-slate-600">
            {historial.map((h) => (
              <li key={h.id}>
                <span className="text-slate-400">v{h.version}</span> · {h.cambio}
                {h.motivo && <span className="text-slate-400"> — {h.motivo}</span>}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {transicionTerminar && (
        <div className="mt-2">
          <BotonPrimario tono="oscuro" onClick={confirmarCierre} disabled={confirmando}>
            Terminar visita
          </BotonPrimario>
        </div>
      )}
    </div>
  )
}

function Metrica({ icono, color, etiqueta, valor }: { icono: LucideIcon; color: ColorIcono; etiqueta: string; valor: number }) {
  return (
    <Card className="flex items-center gap-3 p-3">
      <IconTile icono={icono} color={color} />
      <div>
        <p className="text-xl font-bold leading-none text-slate-900">{valor}</p>
        <p className="mt-0.5 text-[11px] text-slate-500">{etiqueta}</p>
      </div>
    </Card>
  )
}
