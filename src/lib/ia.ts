import { obtenerClaveIA } from './iaConfig'

const MODELO = 'gpt-4o-mini'
const URL_API = 'https://api.openai.com/v1/chat/completions'

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
  if (!clave) throw new ErrorIA('No has configurado tu clave de OpenAI. Ve a Ajustes para agregarla.')

  let respuesta: Response
  try {
    respuesta = await fetch(URL_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${clave}`,
      },
      body: JSON.stringify({
        model: MODELO,
        messages: [{ role: 'system', content: PROMPT_SISTEMA }, ...historial],
        temperature: 0.5,
        max_tokens: 400,
      }),
    })
  } catch {
    throw new ErrorIA(
      'No se pudo conectar con OpenAI. Revisa tu conexión a internet. Si el problema persiste, puede que el navegador ' +
        'esté bloqueando la conexión directa — avísale a Claude para revisarlo.',
    )
  }

  if (!respuesta.ok) {
    if (respuesta.status === 401) throw new ErrorIA('La clave de OpenAI no es válida. Revísala en Ajustes.')
    if (respuesta.status === 429) throw new ErrorIA('Se alcanzó el límite de uso de tu cuenta de OpenAI. Intenta más tarde o revisa tu plan.')
    throw new ErrorIA(`OpenAI respondió con un error (código ${respuesta.status}). Intenta de nuevo.`)
  }

  const datos = await respuesta.json()
  const texto = datos?.choices?.[0]?.message?.content?.trim()
  if (!texto) throw new ErrorIA('OpenAI no devolvió texto. Intenta de nuevo.')
  return texto
}
