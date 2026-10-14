// Motor del asistente: conversación con Gemini usando "function calling". El modelo pide herramientas
// (actualizar una actividad, crear un hallazgo, preguntar con opciones, ajustar el informe…), la app
// las ejecuta y le devuelve el resultado, hasta que el modelo responde con texto o hace una pregunta.

import { llamarGemini, type AvisoEstado, type ContenidoGemini, type ParteGemini } from '../gemini'
import { cargarDatosContexto, contextoComoTexto, type UbicacionApp } from './contexto'
import { declaraciones, ejecutarHerramienta, type AccionRealizada, type Pregunta } from './herramientas'
import { informeActivo } from './informeActivo'

const MAX_PASOS = 8
const MAX_CONTENIDOS = 40

const PROMPT = `Eres el asistente integrado de la app "Visitas Técnicas", usada por un ingeniero en visitas técnicas industriales (líneas de trefilado/Stretch Line, soldadores de alambrón, rolling cassettes). Hablas en español, con frases cortas y tono profesional y cercano.

Tu trabajo es ahorrarle tiempo al usuario actuando directamente sobre la app con las herramientas:
- Si dice que una actividad se completó, quedó parcial o se bloqueó, usa actualizar_actividad. Si dio detalles, redáctalos como observación profesional.
- Si describe una observación, falla o mejora, créala con crear_hallazgo en la actividad correcta, con una descripción clara; propone prioridad y categoría razonables.
- Si dice que algo ya se solucionó, usa actualizar_hallazgo con la solución (el "después") y resuelto=true.
- Si está revisando un informe y pide corregir algo, ajústalo con las herramientas del informe. Si el error está en los datos (una actividad o un hallazgo), corrige el dato y luego usa regenerar_informe, avisando que eso descarta ediciones manuales del informe.
- Para llevarlo a una pantalla, usa abrir_pantalla.

Reglas:
- Cuando falte un dato o haya ambigüedad (qué actividad, qué hallazgo, qué estado, qué prioridad), usa preguntar_usuario con opciones concretas tomadas del contexto (nombres de actividades, códigos H-xx). No preguntes en texto libre lo que se puede elegir con un toque. Haz una sola pregunta a la vez.
- Si el usuario ya fue claro, actúa sin pedir confirmación: cada acción queda registrada y él puede deshacerla con un toque.
- Después de actuar, si es útil, ofrece UN siguiente paso con preguntar_usuario (p.ej. "¿Registramos hallazgos de esta actividad?" con opciones Sí / No). No seas insistente.
- Usa solo las referencias de actividades (act_xxxxxx) y los códigos de hallazgos (H-xx) del contexto. Nunca inventes datos técnicos (parámetros, tolerancias, marcas, valores) que el usuario no haya dado.
- No puedes cambiar el estado de la visita (enviar a aprobación, iniciar, terminar), ni crear o eliminar actividades del plan, ni adjuntar fotos: explica en una frase cómo hacerlo en la app (las fotos se agregan abriendo el hallazgo).
- Fechas en formato AAAA-MM-DD; "hoy" y "mañana" se calculan desde la FECHA DE HOY del contexto.
- Al terminar, responde con un resumen muy breve de lo que hiciste (1 a 3 líneas). No repitas todo el contexto.`

export interface EventosAgente {
  texto: (texto: string) => void
  accion: (accion: AccionRealizada) => void
  pregunta: (pregunta: Pregunta) => void
  aviso: AvisoEstado
}

interface PreguntaPendiente {
  respuestasPrevias: ParteGemini[]
  llamada: { name: string; id?: string }
}

export class ConversacionAgente {
  private historial: ContenidoGemini[] = []
  private pendiente: PreguntaPendiente | null = null

  constructor(
    private obtenerUbicacion: () => UbicacionApp,
    private navegar: (ruta: string) => void,
  ) {}

  get esperandoRespuesta(): boolean {
    return this.pendiente !== null
  }

  reiniciar() {
    this.historial = []
    this.pendiente = null
  }

  /** Envía un mensaje del usuario (o su respuesta a una pregunta con opciones). */
  async enviar(texto: string, eventos: EventosAgente): Promise<void> {
    const largoPrevio = this.historial.length
    const pendientePrevio = this.pendiente
    if (this.pendiente) {
      const { respuestasPrevias, llamada } = this.pendiente
      this.historial.push({
        role: 'user',
        parts: [...respuestasPrevias, { functionResponse: { name: llamada.name, ...(llamada.id ? { id: llamada.id } : {}), response: { respuesta_del_usuario: texto } } }],
      })
      this.pendiente = null
    } else {
      this.historial.push({ role: 'user', parts: [{ text: texto }] })
    }

    try {
      await this.ciclo(eventos)
    } catch (e) {
      // Se descarta el turno incompleto (una llamada de herramienta sin su respuesta dejaría el
      // historial inválido). Lo ya aplicado en los datos se conserva y el contexto lo refleja.
      this.historial.length = largoPrevio
      this.pendiente = pendientePrevio
      throw e
    }
    this.recortar()
  }

  private async ciclo(eventos: EventosAgente) {
    for (let paso = 0; paso < MAX_PASOS; paso++) {
      const ubicacion = this.obtenerUbicacion()
      const datos = await cargarDatosContexto(ubicacion)
      const conInforme = !!informeActivo() && (ubicacion.pantalla === 'reporte' || ubicacion.pantalla === 'cierre')

      const { contenido } = await llamarGemini(
        {
          contents: this.historial,
          systemInstruction: { parts: [{ text: `${PROMPT}\n\n=== CONTEXTO ACTUAL DE LA APP ===\n${contextoComoTexto(datos)}` }] },
          tools: declaraciones(conInforme),
          toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
          generationConfig: { temperature: 0.3 },
        },
        eventos.aviso,
      )
      // Se guarda tal cual (incluye las "firmas de pensamiento" que Gemini exige devolver).
      this.historial.push(contenido)

      const texto = contenido.parts
        .filter((p) => typeof p.text === 'string' && !p.thought)
        .map((p) => p.text as string)
        .join('')
        .trim()
      if (texto) eventos.texto(texto)

      const llamadas = contenido.parts
        .map((p) => p.functionCall as { name: string; args?: Record<string, unknown>; id?: string } | undefined)
        .filter((c): c is { name: string; args?: Record<string, unknown>; id?: string } => !!c)
      if (llamadas.length === 0) return

      const respuestas: ParteGemini[] = []
      let pregunta: { pregunta: Pregunta; llamada: { name: string; id?: string } } | null = null
      for (const llamada of llamadas) {
        const r = await ejecutarHerramienta(llamada.name, llamada.args ?? {}, { datos: await cargarDatosContexto(this.obtenerUbicacion()), navegar: this.navegar })
        if (r.pregunta && !pregunta) {
          pregunta = { pregunta: r.pregunta, llamada: { name: llamada.name, id: llamada.id } }
          continue
        }
        if (r.accion) eventos.accion(r.accion)
        respuestas.push({ functionResponse: { name: llamada.name, ...(llamada.id ? { id: llamada.id } : {}), response: r.pregunta ? { error: 'Solo una pregunta a la vez.' } : r.respuesta } })
      }

      if (pregunta) {
        this.pendiente = { respuestasPrevias: respuestas, llamada: pregunta.llamada }
        eventos.pregunta(pregunta.pregunta)
        return
      }
      this.historial.push({ role: 'user', parts: respuestas })
    }
    eventos.texto('Hice varios pasos seguidos y me detuve para no exagerar. Dime si continúo.')
  }

  /** Mantiene el historial acotado sin partir un par llamada/respuesta de herramienta. */
  private recortar() {
    if (this.historial.length <= MAX_CONTENIDOS) return
    let inicio = this.historial.length - MAX_CONTENIDOS
    while (inicio < this.historial.length) {
      const c = this.historial[inicio]
      if (c.role === 'user' && c.parts.some((p) => typeof p.text === 'string')) break
      inicio++
    }
    this.historial = this.historial.slice(inicio)
  }
}
