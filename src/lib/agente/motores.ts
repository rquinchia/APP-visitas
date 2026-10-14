// Un "motor" por proveedor de IA: guarda el historial en el formato de ese proveedor y hace la llamada.
// El ciclo del agente (agente.ts) es el mismo para ambos.

import type Anthropic from '@anthropic-ai/sdk'
import { llamarGemini, type AvisoEstado, type ContenidoGemini } from '../gemini'
import { BETAS_CLAUDE, MODELO_CLAUDE, clienteClaude, errorClaude, textoClaude } from '../claude'
import { ErrorIA } from '../gemini'
import type { ProveedorIA } from '../iaConfig'
import { definicionesHerramientas } from './herramientas'

export interface LlamadaHerramienta {
  /** Id para emparejar la respuesta (el de la API si lo trae). */
  id: string
  /** Gemini puede no enviar id; en ese caso no se devuelve. */
  idApi?: string
  nombre: string
  args: Record<string, unknown>
}

export interface ResultadoLlamada {
  llamada: LlamadaHerramienta
  respuesta: Record<string, unknown>
}

export interface TurnoModelo {
  texto: string
  llamadas: LlamadaHerramienta[]
}

export interface MotorAgente {
  readonly proveedor: ProveedorIA
  agregarMensajeUsuario(texto: string): void
  /** Respuestas a TODAS las llamadas del último turno del modelo, en un solo mensaje. */
  agregarResultados(resultados: ResultadoLlamada[]): void
  /** Llama al modelo y guarda su respuesta en el historial. `sistema` es fijo; `contexto` cambia con la app. */
  turno(sistema: string, contexto: string, aviso: AvisoEstado): Promise<TurnoModelo>
  marca(): unknown
  volverA(marca: unknown): void
}

// ───────────────────────────── Gemini ─────────────────────────────

const MAX_CONTENIDOS_GEMINI = 40

class MotorGemini implements MotorAgente {
  readonly proveedor = 'gemini' as const
  private historial: ContenidoGemini[] = []
  private n = 0

  agregarMensajeUsuario(texto: string) {
    this.recortar()
    this.historial.push({ role: 'user', parts: [{ text: texto }] })
  }

  agregarResultados(resultados: ResultadoLlamada[]) {
    this.historial.push({
      role: 'user',
      parts: resultados.map((r) => ({
        functionResponse: { name: r.llamada.nombre, ...(r.llamada.idApi ? { id: r.llamada.idApi } : {}), response: r.respuesta },
      })),
    })
  }

  async turno(sistema: string, contexto: string, aviso: AvisoEstado): Promise<TurnoModelo> {
    const { contenido } = await llamarGemini(
      {
        contents: this.historial,
        // En Gemini el contexto puede ir en la instrucción de sistema y renovarse en cada llamada.
        systemInstruction: { parts: [{ text: `${sistema}\n\n=== CONTEXTO ACTUAL DE LA APP ===\n${contexto}` }] },
        tools: [{ functionDeclarations: definicionesHerramientas() }],
        toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
        generationConfig: { temperature: 0.3 },
      },
      aviso,
    )
    // Se guarda tal cual: incluye las "firmas de pensamiento" que Gemini exige devolver.
    this.historial.push(contenido)
    const texto = contenido.parts
      .filter((p) => typeof p.text === 'string' && !p.thought)
      .map((p) => p.text as string)
      .join('')
      .trim()
    const llamadas = contenido.parts
      .map((p) => p.functionCall as { name: string; args?: Record<string, unknown>; id?: string } | undefined)
      .filter((c): c is { name: string; args?: Record<string, unknown>; id?: string } => !!c)
      .map((c) => ({ id: c.id ?? `g${++this.n}`, idApi: c.id, nombre: c.name, args: c.args ?? {} }))
    return { texto, llamadas }
  }

  marca() {
    return this.historial.length
  }

  volverA(m: unknown) {
    this.historial.length = m as number
  }

  /** Historial acotado sin partir un par llamada/respuesta (Gemini no exige historial intacto). */
  private recortar() {
    if (this.historial.length <= MAX_CONTENIDOS_GEMINI) return
    let inicio = this.historial.length - MAX_CONTENIDOS_GEMINI
    while (inicio < this.historial.length) {
      const c = this.historial[inicio]
      if (c.role === 'user' && c.parts.some((p) => typeof p.text === 'string')) break
      inicio++
    }
    this.historial = this.historial.slice(inicio)
  }
}

// ───────────────────────────── Claude ─────────────────────────────
//
// Claude (Opus 5.5) liga su razonamiento a la conversación exacta: el `system`, las `tools` y los
// mensajes anteriores deben quedar idénticos entre peticiones. Por eso: `system` y `tools` fijos, el
// historial solo crece (nunca se recorta ni se edita) y el contexto de la app se AGREGA como mensaje
// `role: "system"` a mitad de conversación cada vez que cambia.

class MotorClaude implements MotorAgente {
  readonly proveedor = 'claude' as const
  private historial: Anthropic.Beta.BetaMessageParam[] = []
  private ultimoContexto = ''

  agregarMensajeUsuario(texto: string) {
    this.historial.push({ role: 'user', content: texto })
  }

  agregarResultados(resultados: ResultadoLlamada[]) {
    this.historial.push({
      role: 'user',
      content: resultados.map((r) => ({
        type: 'tool_result' as const,
        tool_use_id: r.llamada.id,
        content: JSON.stringify(r.respuesta),
        ...('error' in r.respuesta ? { is_error: true } : {}),
      })),
    })
  }

  async turno(sistema: string, contexto: string): Promise<TurnoModelo> {
    if (contexto !== this.ultimoContexto) {
      // Sigue siempre a un mensaje de usuario (texto o resultados de herramientas), como exige la API.
      this.historial.push({ role: 'system', content: `CONTEXTO ACTUAL DE LA APP (reemplaza a cualquier contexto anterior):\n${contexto}` })
      this.ultimoContexto = contexto
    }
    let respuesta: Anthropic.Beta.BetaMessage
    try {
      respuesta = await (await clienteClaude()).beta.messages.create({
        model: MODELO_CLAUDE,
        max_tokens: 16000,
        betas: BETAS_CLAUDE,
        fallbacks: 'default',
        thinking: { type: 'adaptive', block_binding: { prefix_mismatch_behavior: 'drop_block' } },
        output_config: { effort: 'medium' },
        cache_control: { type: 'ephemeral' },
        system: sistema,
        tools: definicionesHerramientas().map((d) => ({
          name: d.name,
          description: d.description,
          input_schema: d.parameters as Anthropic.Beta.BetaTool.InputSchema,
        })),
        messages: this.historial,
      })
    } catch (e) {
      throw errorClaude(e)
    }
    // Se guarda el contenido completo (incluye los bloques de razonamiento, que deben volver intactos).
    this.historial.push({ role: 'assistant', content: respuesta.content })

    if (respuesta.stop_reason === 'refusal') {
      return { texto: 'Claude no pudo ayudar con esta petición (filtro de seguridad). Intenta reformularla o usa Gemini.', llamadas: [] }
    }
    const llamadas = respuesta.content
      .filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use')
      .map((b) => ({ id: b.id, nombre: b.name, args: (b.input ?? {}) as Record<string, unknown> }))
    const texto = textoClaude(respuesta.content)
    if (!texto && llamadas.length === 0 && respuesta.stop_reason === 'max_tokens') {
      throw new ErrorIA('La respuesta de Claude quedó incompleta. Intenta con una petición más concreta.')
    }
    return { texto, llamadas }
  }

  marca() {
    return { largo: this.historial.length, contexto: this.ultimoContexto }
  }

  volverA(m: unknown) {
    const { largo, contexto } = m as { largo: number; contexto: string }
    this.historial.length = largo
    this.ultimoContexto = contexto
  }
}

export function crearMotor(p: ProveedorIA): MotorAgente {
  return p === 'claude' ? new MotorClaude() : new MotorGemini()
}
