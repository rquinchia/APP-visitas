import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowUp, Check, ExternalLink, RotateCcw, Sparkles, Undo2, X } from 'lucide-react'
import { ConversacionAgente } from '../lib/agente/agente'
import { cargarDatosContexto, interpretarRuta, type Pantalla, type UbicacionApp } from '../lib/agente/contexto'
import type { AccionRealizada, Pregunta } from '../lib/agente/herramientas'
import { ErrorIA } from '../lib/gemini'
import { hayClaveIA } from '../lib/iaConfig'

type Mensaje =
  | { id: number; tipo: 'usuario'; texto: string }
  | { id: number; tipo: 'asistente'; texto: string }
  | { id: number; tipo: 'accion'; accion: AccionRealizada; deshecha: boolean }
  | { id: number; tipo: 'pregunta'; pregunta: Pregunta; respondida?: string }
  | { id: number; tipo: 'error'; texto: string }

const SUGERENCIAS: Partial<Record<Pantalla, string[]>> = {
  hoy: ['Marca como completada la primera actividad', 'Registra un hallazgo en el diagnóstico', '¿Qué me falta por registrar hoy?'],
  plan: ['¿Qué actividades quedan pendientes?', 'Registra 3 observaciones en una actividad', 'Resume el avance por día'],
  reporte: ['Revisa el reporte y dime qué le falta', 'Mejora la redacción del WhatsApp', 'Agrega al resumen que se cumplió la capacitación'],
  cierre: ['Revisa el informe final y propón mejoras', '¿Qué pendientes críticos quedan?', 'Hazme un resumen para mi jefe'],
  hallazgo: ['Mejora la redacción de este hallazgo', 'Ya se solucionó: se cambió la pieza', 'Sugiere prioridad y acción'],
}
const SUGERENCIAS_GENERALES = ['¿Cómo va la visita?', 'Registra un hallazgo', '¿Qué pendientes están sin responsable?']

type SinId<T> = T extends unknown ? Omit<T, 'id'> : never

let siguienteId = 1

export default function AsistenteAgente() {
  const location = useLocation()
  const navigate = useNavigate()
  const ubicacionRef = useRef<UbicacionApp>(interpretarRuta(location.pathname, location.search))
  ubicacionRef.current = interpretarRuta(location.pathname, location.search)

  const [abierto, setAbierto] = useState(false)
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [entrada, setEntrada] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState('')
  const [planta, setPlanta] = useState('')
  const [seleccion, setSeleccion] = useState<string[]>([])
  const finRef = useRef<HTMLDivElement>(null)
  const conversacion = useRef<ConversacionAgente>()
  if (!conversacion.current) {
    conversacion.current = new ConversacionAgente(
      () => ubicacionRef.current,
      (ruta) => {
        navigate(ruta)
        setAbierto(false)
      },
    )
  }

  useEffect(() => {
    if (!abierto) return
    cargarDatosContexto(ubicacionRef.current).then((d) => setPlanta(d.visita?.planta || ''))
  }, [abierto, location.pathname])

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [mensajes, ocupado, abierto])

  function agregar(m: SinId<Mensaje>) {
    setMensajes((prev) => [...prev, { ...m, id: siguienteId++ } as Mensaje])
  }

  async function enviar(texto: string) {
    const limpio = texto.trim()
    if (!limpio || ocupado) return
    setEntrada('')
    setSeleccion([])
    // Si había una pregunta abierta, el texto escrito cuenta como respuesta.
    setMensajes((prev) => prev.map((m) => (m.tipo === 'pregunta' && !m.respondida ? { ...m, respondida: limpio } : m)))
    agregar({ tipo: 'usuario', texto: limpio })
    setOcupado(true)
    setAviso('')
    try {
      await conversacion.current!.enviar(limpio, {
        texto: (t) => agregar({ tipo: 'asistente', texto: t }),
        accion: (a) => agregar({ tipo: 'accion', accion: a, deshecha: false }),
        pregunta: (p) => agregar({ tipo: 'pregunta', pregunta: p }),
        aviso: setAviso,
      })
    } catch (e) {
      agregar({ tipo: 'error', texto: e instanceof ErrorIA ? e.message : 'Ocurrió un error inesperado. Intenta de nuevo.' })
    } finally {
      setOcupado(false)
      setAviso('')
    }
  }

  async function deshacer(id: number, accion: AccionRealizada) {
    if (!accion.deshacer) return
    try {
      await accion.deshacer()
      setMensajes((prev) => prev.map((m) => (m.id === id && m.tipo === 'accion' ? { ...m, deshecha: true } : m)))
    } catch {
      alert('No se pudo deshacer este cambio.')
    }
  }

  function nuevaConversacion() {
    conversacion.current!.reiniciar()
    setMensajes([])
    setSeleccion([])
  }

  const sugerencias = SUGERENCIAS[ubicacionRef.current.pantalla] ?? SUGERENCIAS_GENERALES
  const preguntaAbierta = [...mensajes].reverse().find((m) => m.tipo === 'pregunta' && !m.respondida)

  return (
    <>
      {!abierto && (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          aria-label="Abrir asistente"
          className="fixed z-30 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 via-indigo-600 to-sky-500 text-white shadow-xl shadow-indigo-500/40"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 76px)', right: 'max(16px, calc((100vw - 42rem) / 2 + 16px))' }}
        >
          <Sparkles className="h-6 w-6" strokeWidth={2.2} />
        </button>
      )}

      {abierto && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/30 backdrop-blur-[2px]" onClick={() => setAbierto(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex h-[88vh] w-full max-w-2xl animate-entrar flex-col overflow-hidden rounded-t-[28px] bg-[#f5f6f8] shadow-2xl"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            {/* Encabezado */}
            <div className="flex items-center gap-3 border-b border-slate-200/70 bg-white px-4 py-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-sky-500 text-white">
                <Sparkles className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-slate-900">Asistente</p>
                <p className="truncate text-[11px] text-slate-500">{planta ? `${planta} · ` : ''}actúa sobre lo que ves en pantalla</p>
              </div>
              {mensajes.length > 0 && (
                <button type="button" onClick={nuevaConversacion} aria-label="Nueva conversación" className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400">
                  <RotateCcw className="h-[18px] w-[18px]" />
                </button>
              )}
              <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar" className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Mensajes */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {!hayClaveIA() ? (
                <div className="rounded-2xl bg-white p-4 text-sm text-slate-600 shadow-sm">
                  Para usar el asistente necesitas tu clave gratuita de Google Gemini.{' '}
                  <Link to="/ajustes" onClick={() => setAbierto(false)} className="font-semibold text-accent underline">
                    Configurarla en Ajustes
                  </Link>
                </div>
              ) : mensajes.length === 0 ? (
                <div className="flex flex-col gap-3">
                  <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <p className="text-[15px] font-semibold text-slate-900">¿En qué te ayudo?</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
                      Dime lo que pasó con tus palabras («el diagnóstico se completó, encontré una fuga en el tensor») y yo lleno los campos.
                      Si me falta algo te pregunto con opciones. Todo lo que haga se puede deshacer.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {sugerencias.map((s) => (
                      <button key={s} type="button" onClick={() => enviar(s)} className="rounded-xl border border-indigo-100 bg-white px-3 py-2.5 text-left text-[13px] font-medium text-indigo-700">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {mensajes.map((m) => (
                    <Fragment key={m.id}>
                      {m.tipo === 'usuario' && (
                        <div className="ml-10 self-end rounded-2xl rounded-br-md bg-accent px-3.5 py-2 text-[14px] leading-relaxed text-white">{m.texto}</div>
                      )}
                      {m.tipo === 'asistente' && (
                        <div className="mr-8 self-start rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-[14px] leading-relaxed text-slate-800 shadow-sm">
                          <TextoFormateado texto={m.texto} />
                        </div>
                      )}
                      {m.tipo === 'error' && (
                        <div className="mr-8 self-start rounded-2xl bg-rose-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-rose-700">{m.texto}</div>
                      )}
                      {m.tipo === 'accion' && (
                        <div className={`mr-8 flex items-start gap-2.5 self-start rounded-xl border px-3 py-2.5 ${m.deshecha ? 'border-slate-200 bg-slate-50' : 'border-emerald-200 bg-emerald-50'}`}>
                          <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${m.deshecha ? 'bg-slate-300' : 'bg-emerald-500'} text-white`}>
                            {m.deshecha ? <Undo2 className="h-3 w-3" /> : <Check className="h-3 w-3" strokeWidth={3} />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className={`text-[13px] leading-snug ${m.deshecha ? 'text-slate-400 line-through' : 'text-emerald-900'}`}>{m.accion.resumen}</p>
                            {!m.deshecha && (
                              <div className="mt-1 flex flex-wrap gap-3 text-xs font-semibold">
                                {m.accion.deshacer && (
                                  <button type="button" onClick={() => deshacer(m.id, m.accion)} className="text-slate-500">
                                    Deshacer
                                  </button>
                                )}
                                {m.accion.enlace && (
                                  <Link to={m.accion.enlace} onClick={() => setAbierto(false)} className="flex items-center gap-1 text-accent">
                                    {m.accion.enlaceTexto ?? 'Abrir'} <ExternalLink className="h-3 w-3" />
                                  </Link>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      {m.tipo === 'pregunta' && (
                        <div className="mr-4 self-start rounded-2xl rounded-bl-md bg-white px-3.5 py-3 shadow-sm">
                          <p className="text-[14px] font-medium leading-relaxed text-slate-800">{m.pregunta.texto}</p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {m.pregunta.opciones.map((o) => {
                              const elegida = m.respondida ? m.respondida.split(' · ').includes(o) : seleccion.includes(o)
                              return (
                                <button
                                  key={o}
                                  type="button"
                                  disabled={!!m.respondida || ocupado}
                                  onClick={() =>
                                    m.pregunta.multiple
                                      ? setSeleccion((s) => (s.includes(o) ? s.filter((x) => x !== o) : [...s, o]))
                                      : enviar(o)
                                  }
                                  className={`rounded-full border px-3 py-1.5 text-[13px] font-medium ${
                                    elegida ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-indigo-200 bg-indigo-50 text-indigo-700'
                                  } disabled:opacity-60`}
                                >
                                  {o}
                                </button>
                              )
                            })}
                          </div>
                          {m.pregunta.multiple && !m.respondida && (
                            <button
                              type="button"
                              disabled={seleccion.length === 0 || ocupado}
                              onClick={() => enviar(seleccion.join(' · '))}
                              className="mt-2 rounded-full bg-indigo-600 px-4 py-1.5 text-[13px] font-semibold text-white disabled:opacity-40"
                            >
                              Listo ({seleccion.length})
                            </button>
                          )}
                        </div>
                      )}
                    </Fragment>
                  ))}
                  {ocupado && (
                    <div className="mr-8 flex items-center gap-2 self-start rounded-2xl bg-white px-3.5 py-2.5 text-[13px] text-slate-500 shadow-sm">
                      <span className="flex gap-1">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400 [animation-delay:-0.3s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400 [animation-delay:-0.15s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400" />
                      </span>
                      {aviso || 'Pensando…'}
                    </div>
                  )}
                </div>
              )}
              <div ref={finRef} />
            </div>

            {/* Entrada */}
            {hayClaveIA() && (
              <div className="border-t border-slate-200/70 bg-white px-3 py-2.5">
                <div className="flex items-end gap-2 rounded-2xl bg-slate-100 py-1.5 pl-3.5 pr-1.5">
                  <textarea
                    value={entrada}
                    onChange={(e) => setEntrada(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) {
                        e.preventDefault()
                        enviar(entrada)
                      }
                    }}
                    rows={Math.min(4, Math.max(1, entrada.split('\n').length))}
                    placeholder={preguntaAbierta ? 'Elige una opción o escribe tu respuesta…' : 'Escribe o dicta lo que pasó…'}
                    className="max-h-28 flex-1 resize-none bg-transparent py-1.5 text-[15px] text-slate-800 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => enviar(entrada)}
                    disabled={!entrada.trim() || ocupado}
                    aria-label="Enviar"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white disabled:bg-slate-300"
                  >
                    <ArrowUp className="h-5 w-5" strokeWidth={2.6} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

/** Formato mínimo para las respuestas: **negrita** y viñetas ("- " o "* "). */
function TextoFormateado({ texto }: { texto: string }) {
  const lineas = texto.split('\n')
  return (
    <>
      {lineas.map((l, i) => {
        const viñeta = /^\s*[-*•]\s+/.test(l)
        const contenido = negritas(l.replace(/^\s*[-*•]\s+/, ''))
        if (!l.trim()) return <div key={i} className="h-2" />
        return viñeta ? (
          <div key={i} className="flex gap-1.5">
            <span className="text-indigo-400">•</span>
            <span>{contenido}</span>
          </div>
        ) : (
          <p key={i}>{contenido}</p>
        )
      })}
    </>
  )
}

function negritas(texto: string): ReactNode[] {
  return texto.split(/(\*\*[^*]+\*\*)/g).map((parte, i) =>
    parte.startsWith('**') && parte.endsWith('**') ? <strong key={i}>{parte.slice(2, -2)}</strong> : <Fragment key={i}>{parte}</Fragment>,
  )
}
