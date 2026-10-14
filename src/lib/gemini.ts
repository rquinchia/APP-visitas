// Cliente de Google Gemini (llamada directa desde el navegador con la clave del usuario).
//
// Resiliencia: un 503 ("modelo con alta demanda") es temporal según Google; se reintenta con espera
// creciente y, si sigue saturado (o se agotó la cuota gratuita de ese modelo, 429), se pasa a otro
// modelo "flash" disponible para la cuenta (se consulta la lista real de modelos, sin nombres fijos).
// El último modelo que funcionó se recuerda para empezar por él.

import { obtenerClaveIA } from './iaConfig'

const BASE = 'https://generativelanguage.googleapis.com/v1beta'
const MODELO_INICIAL = 'gemini-3.8-flash'
const CLAVE_MODELO = 'ia_gemini_modelo'
const ESPERAS_MS = [1200, 3500]

export class ErrorIA extends Error {}

export type ParteGemini = Record<string, unknown>
export interface ContenidoGemini {
  role: 'user' | 'model'
  parts: ParteGemini[]
}

export interface PeticionGemini {
  contents: ContenidoGemini[]
  systemInstruction?: { parts: { text: string }[] }
  tools?: unknown[]
  toolConfig?: unknown
  generationConfig?: Record<string, unknown>
}

export interface RespuestaGemini {
  contenido: ContenidoGemini
  modelo: string
}

/** Para mostrar al usuario qué está pasando ("reintentando…"). */
export type AvisoEstado = (mensaje: string) => void

function leerModeloGuardado(): string {
  try {
    return localStorage.getItem(CLAVE_MODELO) || MODELO_INICIAL
  } catch {
    return MODELO_INICIAL
  }
}

function guardarModelo(modelo: string) {
  try {
    localStorage.setItem(CLAVE_MODELO, modelo)
  } catch {
    // sin almacenamiento: se usará el inicial la próxima vez
  }
}

let cacheModelos: string[] | null = null

/** Modelos "flash" de texto disponibles para esta clave, de más nuevo a más antiguo (estables primero). */
async function modelosDisponibles(clave: string): Promise<string[]> {
  if (cacheModelos) return cacheModelos
  try {
    const r = await fetch(`${BASE}/models?pageSize=200&key=${encodeURIComponent(clave)}`)
    if (!r.ok) return []
    const datos = (await r.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] }
    const version = (n: string) => Number(/gemini-(\d+(?:\.\d+)?)/.exec(n)?.[1] ?? 0)
    cacheModelos = (datos.models ?? [])
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => m.name.replace(/^models\//, ''))
      .filter((n) => n.startsWith('gemini') && n.includes('flash') && !/(image|tts|audio|live|embedding|vision)/.test(n))
      .sort((a, b) => {
        const preview = (n: string) => (/(preview|exp)/.test(n) ? 1 : 0)
        const lite = (n: string) => (n.includes('lite') ? 1 : 0)
        return version(b) - version(a) || preview(a) - preview(b) || lite(a) - lite(b) || a.localeCompare(b)
      })
    return cacheModelos
  } catch {
    return []
  }
}

async function detalleError(r: Response): Promise<string> {
  try {
    const cuerpo = await r.json()
    return cuerpo?.error?.message ?? ''
  } catch {
    return ''
  }
}

const espera = (ms: number) => new Promise((res) => setTimeout(res, ms))

export async function llamarGemini(peticion: PeticionGemini, aviso?: AvisoEstado): Promise<RespuestaGemini> {
  const clave = obtenerClaveIA()
  if (!clave) throw new ErrorIA('No has configurado tu clave de Google Gemini. Ve a Ajustes para agregarla.')

  const preferido = leerModeloGuardado()
  const probados = new Set<string>()
  let candidatos = [preferido]
  let ultimoError = ''
  let consultoLista = false

  for (let i = 0; i < candidatos.length && probados.size < 4; i++) {
    const modelo = candidatos[i]
    if (probados.has(modelo)) continue
    probados.add(modelo)

    for (let intento = 0; intento <= ESPERAS_MS.length; intento++) {
      let r: Response
      try {
        r = await fetch(`${BASE}/models/${modelo}:generateContent?key=${encodeURIComponent(clave)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(peticion),
        })
      } catch {
        throw new ErrorIA('No se pudo conectar con Google Gemini. Revisa tu conexión a internet.')
      }

      if (r.ok) {
        const datos = await r.json()
        const contenido = datos?.candidates?.[0]?.content as ContenidoGemini | undefined
        if (!contenido?.parts?.length) {
          const motivo = datos?.candidates?.[0]?.finishReason ?? datos?.promptFeedback?.blockReason
          throw new ErrorIA(`Gemini no devolvió respuesta${motivo ? ` (${motivo})` : ''}. Intenta reformular.`)
        }
        if (modelo !== preferido) guardarModelo(modelo)
        return { contenido: { role: 'model', parts: contenido.parts }, modelo }
      }

      const detalle = await detalleError(r)
      ultimoError = `código ${r.status}${detalle ? `: ${detalle}` : ''}`

      if (r.status === 400 && /api key/i.test(detalle)) throw new ErrorIA('La clave de Google Gemini no es válida. Revísala en Ajustes.')
      if (r.status === 403) throw new ErrorIA(`Google rechazó la clave (${detalle || 'sin permiso'}). Revísala en Ajustes.`)

      const saturado = r.status === 503 || r.status === 500 || r.status === 504
      if (saturado && intento < ESPERAS_MS.length) {
        aviso?.(`Gemini está con alta demanda; reintentando (${intento + 1}/${ESPERAS_MS.length})…`)
        await espera(ESPERAS_MS[intento])
        continue
      }
      // Saturado tras reintentos, cuota agotada (429) o modelo inexistente (404): probar otro modelo.
      if (saturado || r.status === 429 || r.status === 404) {
        if (!consultoLista) {
          consultoLista = true
          const lista = await modelosDisponibles(clave)
          candidatos = [...candidatos, ...lista.filter((m) => !candidatos.includes(m))]
        }
        const siguiente = candidatos.slice(i + 1).find((m) => !probados.has(m))
        if (siguiente) aviso?.(`Cambiando a otro modelo de Gemini (${siguiente})…`)
        break
      }
      throw new ErrorIA(`Google Gemini respondió con un error (${ultimoError}).`)
    }
  }

  throw new ErrorIA(
    `Gemini no está disponible en este momento (${ultimoError || 'sin respuesta'}). Es una saturación temporal de Google: intenta de nuevo en unos minutos.`,
  )
}

/** Texto de una respuesta (une las partes de texto, ignorando las de "pensamiento"). */
export function textoDe(contenido: ContenidoGemini): string {
  return contenido.parts
    .filter((p) => typeof p.text === 'string' && !p.thought)
    .map((p) => p.text as string)
    .join('')
    .trim()
}
