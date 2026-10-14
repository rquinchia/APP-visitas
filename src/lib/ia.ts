import { llamarGemini, textoDe, ErrorIA, type AvisoEstado } from './gemini'
import { generarTextoClaude } from './claude'
import { proveedorActivo } from './iaConfig'

export { ErrorIA }

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

/** Redacción de un campo con el proveedor elegido en Ajustes (Gemini o Claude). */
export async function generarTextoIA(historial: MensajeIA[], aviso?: AvisoEstado): Promise<string> {
  if (proveedorActivo() === 'claude') return generarTextoClaude(PROMPT_SISTEMA, historial)

  const { contenido } = await llamarGemini(
    {
      contents: historial.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      systemInstruction: { parts: [{ text: PROMPT_SISTEMA }] },
      // Sin maxOutputTokens: en los modelos con "razonamiento" ese límite incluye el pensamiento y puede dejar la respuesta vacía.
      generationConfig: { temperature: 0.5 },
    },
    aviso,
  )
  const texto = textoDe(contenido)
  if (!texto) throw new ErrorIA('Gemini no devolvió texto. Intenta de nuevo.')
  return texto
}
