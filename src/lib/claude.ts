// Cliente de Claude (API de Anthropic) desde el navegador, con la clave del propio usuario.
// La clave queda solo en este dispositivo; `dangerouslyAllowBrowser` es necesario porque la app no
// tiene servidor propio (misma decisión que con Gemini). El SDK se carga solo cuando se usa Claude,
// para no hacer más lenta la apertura de la app.

import type Anthropic from '@anthropic-ai/sdk'
import { ErrorIA } from './gemini'
import { obtenerClave } from './iaConfig'

export const MODELO_CLAUDE = 'claude-opus-5-5'

/** Betas: reintento en otro modelo si un filtro de seguridad rechaza por error, y control explícito del
 * chequeo de "pensamiento preservado" (si algo del historial no cuadra, se descarta ese razonamiento en
 * vez de fallar la petición). */
export const BETAS_CLAUDE = ['server-side-fallback-2026-07-01', 'thinking-binding-controls-2026-08-01']

let sdk: typeof Anthropic | null = null

export async function clienteClaude(): Promise<Anthropic> {
  const apiKey = obtenerClave('claude')
  if (!apiKey) throw new ErrorIA('No has configurado tu clave de Claude (Anthropic). Ve a Ajustes para agregarla.')
  if (!sdk) {
    try {
      sdk = (await import('@anthropic-ai/sdk')).default
    } catch {
      throw new ErrorIA('No se pudo cargar el módulo de Claude. Revisa tu conexión e inténtalo de nuevo.')
    }
  }
  // El SDK reintenta solo los 429/5xx/529 (saturación) con espera creciente.
  return new sdk({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 3 })
}

/** Traduce los errores del SDK a mensajes claros para el usuario. */
export function errorClaude(e: unknown): ErrorIA {
  if (e instanceof ErrorIA) return e
  const A = sdk
  if (A) {
    if (e instanceof A.AuthenticationError) return new ErrorIA('La clave de Claude no es válida. Revísala en Ajustes.')
    if (e instanceof A.PermissionDeniedError) return new ErrorIA('Tu clave de Claude no tiene permiso para este modelo. Revísala en console.anthropic.com.')
    if (e instanceof A.RateLimitError) return new ErrorIA('Claude alcanzó el límite de uso de tu cuenta por ahora. Intenta en unos minutos.')
    if (e instanceof A.BadRequestError) return new ErrorIA(`Claude rechazó la petición: ${e.message}`)
    if (e instanceof A.APIConnectionError) return new ErrorIA('No se pudo conectar con Claude. Revisa tu conexión a internet.')
    if (e instanceof A.APIError) {
      return (e.status ?? 0) >= 500
        ? new ErrorIA('Claude está saturado en este momento (ya se reintentó). Intenta de nuevo en unos minutos.')
        : new ErrorIA(`Claude respondió con un error (código ${e.status}): ${e.message}`)
    }
  }
  return new ErrorIA('Ocurrió un error inesperado con Claude.')
}

/** Texto de una respuesta (solo bloques de texto; el razonamiento no se muestra). */
export function textoClaude(contenido: Anthropic.Beta.BetaContentBlock[]): string {
  return contenido
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()
}

/** Redacción breve de un campo (asistente ✨). */
export async function generarTextoClaude(system: string, mensajes: { role: 'user' | 'assistant'; content: string }[]): Promise<string> {
  try {
    const r = await (await clienteClaude()).beta.messages.create({
      model: MODELO_CLAUDE,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system,
      messages: mensajes,
    })
    if (r.stop_reason === 'refusal') throw new ErrorIA('Claude no pudo responder esta petición. Intenta reformularla.')
    const texto = textoClaude(r.content)
    if (!texto) throw new ErrorIA('Claude no devolvió texto. Intenta de nuevo.')
    return texto
  } catch (e) {
    throw errorClaude(e)
  }
}
