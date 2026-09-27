import { obtenerClaveIA } from './iaConfig'

const MODELO = 'gemini-3.8-flash'
const URL_API = `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`

const PROMPT_SISTEMA =
  'Eres un asistente que ayuda a redactar textos breves y profesionales en español para reportes de visitas ' +
  'técnicas industriales (mantenimiento, soldadura, capacitación, ajuste de equipos como líneas de trefilado, ' +
  'cassettes de laminación y soldadores de alambrón). Responde ÚNICAMENTE con el texto redactado, sin comillas ' +
  'ni explicaciones adicionales, listo para pegar directamente en un formulario. Sé claro, conciso y profesional. ' +
  'No inventes datos técnicos específicos (marcas, tolerancias, parámetros) que el usuario no te haya dado.'

export interface MensajeIA {
  role: 'user' | 'assistant'
  content: string
}

export class ErrorIA extends Error {}

export async function generarTextoIA(historial: MensajeIA[]): Promise<string> {
  const clave = obtenerClaveIA()
  if (!clave) throw new ErrorIA('No has configurado tu clave de Google Gemini. Ve a Ajustes para agregarla.')

  const contents = historial.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  let respuesta: Response
  try {
    respuesta = await fetch(`${URL_API}?key=${encodeURIComponent(clave)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: PROMPT_SISTEMA }] },
        generationConfig: { temperature: 0.5, maxOutputTokens: 400 },
      }),
    })
  } catch {
    throw new ErrorIA(
      'No se pudo conectar con Google Gemini. Revisa tu conexión a internet. Si el problema persiste, avísale a Claude ' +
        'para revisarlo (puede ser un bloqueo del navegador).',
    )
  }

  if (!respuesta.ok) {
    let detalle = ''
    try {
      const cuerpo = await respuesta.json()
      detalle = cuerpo?.error?.message ?? ''
    } catch {
      // sin cuerpo JSON legible
    }
    if (respuesta.status === 400 && detalle.toLowerCase().includes('api key')) {
      throw new ErrorIA('La clave de Google Gemini no es válida. Revísala en Ajustes.')
    }
    if (respuesta.status === 429) throw new ErrorIA('Se alcanzó el límite gratuito de uso por ahora. Intenta de nuevo en unos minutos.')
    throw new ErrorIA(`Google Gemini respondió con un error (código ${respuesta.status})${detalle ? `: ${detalle}` : ''}.`)
  }

  const datos = await respuesta.json()
  const texto = datos?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
  if (!texto) throw new ErrorIA('Gemini no devolvió texto. Intenta de nuevo.')
  return texto
}
