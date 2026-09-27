import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { listarActividadesPorVisita, listarFotosPorVisita, listarHistorialPorVisita, listarPendientesPorVisita, obtenerVisita } from '../db'
import {
  copiarHtmlYTexto,
  envolverInformeHTML,
  generarAsuntoInformeFinal,
  generarInformeFinalOutlook,
  generarInformeFinalOutlookHTML,
  generarResumenFinalWhatsApp,
} from '../lib/reportes'
import { blobAThumbnailDataUrl } from '../lib/imagenes'
import { calcularAvance } from '../lib/progreso'
import { aplicarTransicionEstado, buscarTransicion } from '../lib/transiciones'
import type { Actividad, CambioHistorial, Foto, Pendiente, Visita } from '../types'

const MAX_FOTOS_INFORME_FINAL = 18

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
  const [confirmando, setConfirmando] = useState(false)
  const [subtituloOutlook, setSubtituloOutlook] = useState('')
  const [cargandoFotos, setCargandoFotos] = useState(true)

  const cuerpoRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!id) return
    obtenerVisita(id).then((v) => setVisita(v ?? null))
    listarActividadesPorVisita(id).then(setActividades)
    listarPendientesPorVisita(id).then(setPendientes)
    listarFotosPorVisita(id).then(setFotos)
    listarHistorialPorVisita(id).then(setHistorial)
  }, [id])

  async function generarInformeConFotos(v: Visita, acts: Actividad[], pends: Pendiente[], fts: Foto[]) {
    setCargandoFotos(true)
    const capadas = fts.slice(0, MAX_FOTOS_INFORME_FINAL)
    const dataUrls = (await Promise.all(capadas.map((f) => blobAThumbnailDataUrl(f.blob).catch(() => null)))).filter(
      (u): u is string => !!u,
    )
    setCargandoFotos(false)
    const { subtitulo, cuerpoHtml } = generarInformeFinalOutlookHTML(v, acts, pends, dataUrls, fts.length)
    setSubtituloOutlook(subtitulo)
    if (cuerpoRef.current) cuerpoRef.current.innerHTML = cuerpoHtml
  }

  useEffect(() => {
    if (visita && fotos) generarInformeConFotos(visita, actividades, pendientes, fotos)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visita, actividades, pendientes, fotos])

  if (visita === undefined) return <p className="text-sm text-slate-500">Cargando…</p>
  if (visita === null) return <p className="text-sm text-rose-600">Visita no encontrada.</p>

  const avance = calcularAvance(actividades)
  const noEjecutadas = actividades.filter((a) => a.estado === 'PENDIENTE' || a.estado === 'EN_PROGRESO' || a.estado === 'BLOQUEADA')
  const abiertosVisita = pendientes.filter((p) => p.estado !== 'CERRADO' && p.estado !== 'CANCELADO')
  const cerradosVisita = pendientes.filter((p) => p.estado === 'CERRADO' || p.estado === 'CANCELADO')
  const formacion = actividades.filter((a) => a.tipo.toLowerCase().includes('formaci'))

  const asunto = generarAsuntoInformeFinal(visita, actividades)
  const informeOutlook = generarInformeFinalOutlook(visita, actividades, pendientes, fotos)
  const resumenWhatsApp = generarResumenFinalWhatsApp(visita, actividades, pendientes)

  function regenerarInforme() {
    if (!visita) return
    if (!window.confirm('Esto reemplaza el informe con la versión generada automáticamente y pierdes tus ediciones. ¿Continuar?')) return
    generarInformeConFotos(visita, actividades, pendientes, fotos)
  }

  async function copiarInformeFinalConFormato() {
    if (!cuerpoRef.current || !visita) return
    const html = envolverInformeHTML(visita.planta || 'Planta', subtituloOutlook, cuerpoRef.current.innerHTML)
    const texto = `${asunto}\n\n${cuerpoRef.current.innerText}`
    const ok = await copiarHtmlYTexto(html, texto)
    alert(ok ? 'Informe copiado. Pégalo en Outlook con Ctrl+V (mantiene el formato).' : 'No se pudo copiar automáticamente.')
  }

  async function confirmarCierre() {
    if (!visita) return
    const transicion = buscarTransicion(visita.estado, 'VISITA_TERMINADA')
    if (!transicion) return
    setConfirmando(true)
    const actualizada = await aplicarTransicionEstado(visita, transicion)
    setConfirmando(false)
    if (actualizada) navigate(`/visitas/${visita.id}`)
  }

  return (
    <div className="flex flex-col gap-4 pb-8">
      <button onClick={() => navigate(`/visitas/${visita.id}`)} className="self-start text-sm text-slate-500">
        ← Volver a la visita
      </button>

      <div className="rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/60 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Checklist de cierre</p>
        <h2 className="text-lg font-semibold text-slate-900">{visita.planta || 'Planta sin definir'}</h2>
        <p className="mt-1 text-sm text-slate-600">Avance final: {avance.porcentaje}%</p>
      </div>

      {noEjecutadas.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-800">⚠ Hay {noEjecutadas.length} actividades sin completar</p>
          <ul className="mt-2 flex flex-col gap-1 text-xs text-amber-700">
            {noEjecutadas.map((a) => (
              <li key={a.id}>
                Día {a.dia}: {a.actividad} ({a.estado})
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Resumen etiqueta="Formación realizada" valor={formacion.length} />
        <Resumen etiqueta="Evidencias (fotos)" valor={fotos.length} />
        <Resumen etiqueta="Acciones cerradas" valor={cerradosVisita.length} />
        <Resumen etiqueta="Acciones abiertas" valor={abiertosVisita.length} alerta={abiertosVisita.length > 0} />
      </div>

      {abiertosVisita.length > 0 && (
        <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
          Los {abiertosVisita.length} pendientes abiertos <strong>no se cierran</strong> al terminar la visita: pasan a
          seguimiento post-visita.
        </p>
      )}

      <details className="rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/60 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">Historial de actividades ({actividades.length})</summary>
        <ul className="mt-2 flex flex-col gap-1 text-xs text-slate-600">
          {actividades.map((a) => (
            <li key={a.id}>
              Día {a.dia}: {a.actividad} — {a.estado}
            </li>
          ))}
        </ul>
      </details>

      <details className="rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/60 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">Historial de cambios del plan ({historial.length})</summary>
        <ul className="mt-2 flex flex-col gap-1 text-xs text-slate-600">
          {historial.map((h) => (
            <li key={h.id}>
              v{h.version} · {h.cambio}
              {h.motivo && ` — ${h.motivo}`}
            </li>
          ))}
        </ul>
      </details>

      <section className="rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/60 p-4">
        <h3 className="mb-2 text-sm font-semibold text-slate-800">Resumen final — WhatsApp</h3>
        <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-mono text-xs text-slate-700">{resumenWhatsApp}</pre>
        <button onClick={() => copiar(resumenWhatsApp)} className="mt-2 w-full rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-700">
          Copiar
        </button>
      </section>

      <section className="rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/60 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Informe final — Outlook (editable)</h3>
          <button onClick={regenerarInforme} className="text-xs font-medium text-slate-500">
            Regenerar
          </button>
        </div>
        <p className="mb-2 text-xs text-slate-500">
          Asunto: {asunto}. Toca el informe para editar, agregar o quitar contenido.
          {cargandoFotos && ' Cargando fotos…'}
        </p>

        <div
          ref={cuerpoRef}
          contentEditable
          suppressContentEditableWarning
          className="max-h-[480px] overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 outline-none focus:ring-2 focus:ring-accent/30"
        />

        <button onClick={copiarInformeFinalConFormato} className="mt-2 w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-white">
          Copiar informe con formato
        </button>

        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-slate-500">Copiar como texto simple</summary>
          <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-mono text-xs text-slate-700">{informeOutlook}</pre>
          <button
            onClick={() => copiar(`${asunto}\n\n${informeOutlook}`)}
            className="mt-2 w-full rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-700"
          >
            Copiar solo texto
          </button>
        </details>
      </section>

      <button
        onClick={confirmarCierre}
        disabled={confirmando}
        className="rounded-xl bg-accent py-3.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        Confirmar: TERMINAR VISITA
      </button>
    </div>
  )
}

function Resumen({ etiqueta, valor, alerta }: { etiqueta: string; valor: number; alerta?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/60 p-3 text-center">
      <div className={`text-lg font-bold ${alerta ? 'text-rose-600' : 'text-slate-900'}`}>{valor}</div>
      <div className="text-[11px] text-slate-500">{etiqueta}</div>
    </div>
  )
}
