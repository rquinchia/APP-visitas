// Motor del asistente: conversación con el modelo (Gemini o Claude) usando herramientas. El modelo pide
// herramientas (actualizar una actividad, crear un hallazgo, preguntar con opciones, ajustar el
// informe…), la app las ejecuta y le devuelve el resultado, hasta que responde con texto o pregunta.

import type { AvisoEstado } from '../gemini'
import type { ProveedorIA } from '../iaConfig'
import { cargarDatosContexto, contextoComoTexto, type UbicacionApp } from './contexto'
import { ejecutarHerramienta, type AccionRealizada, type Pregunta } from './herramientas'
import { crearMotor, type LlamadaHerramienta, type MotorAgente, type ResultadoLlamada } from './motores'

const MAX_PASOS = 8

const PROMPT = `Eres el asistente integrado de la app "Visitas Técnicas", usada por un ingeniero en visitas técnicas industriales (líneas de trefilado/Stretch Line, soldadores de alambrón, rolling cassettes). Hablas en español, con frases cortas y tono profesional y cercano.

Tu trabajo es ahorrarle tiempo al usuario actuando directamente sobre la app con las herramientas. En cada turno recibes el CONTEXTO ACTUAL DE LA APP (pantalla, visita, actividades, hallazgos y, si está abierto, el informe); usa siempre el más reciente.
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
- No puedes cambiar el estado de la visita (enviar a aprobación, iniciar, terminar), ni crear o eliminar actividades o visitas, ni adjuntar fotos: explica en una frase cómo hacerlo en la app (las fotos se agregan abriendo el hallazgo; eliminar y editar datos de la visita están en la propia visita).
- Las herramientas del informe solo funcionan con el Reporte del día o el Cierre abiertos.
- Fechas en formato AAAA-MM-DD; "hoy" y "mañana" se calculan desde la FECHA DE HOY del contexto.
- Al terminar, responde con un resumen muy breve de lo que hiciste (1 a 3 líneas). No repitas el contexto.`

export interface EventosAgente {
  texto: (texto: string) => void
  accion: (accion: AccionRealizada) => void
  pregunta: (pregunta: Pregunta) => void
  aviso: AvisoEstado
}

interface PreguntaPendiente {
  resultadosPrevios: ResultadoLlamada[]
  llamada: LlamadaHerramienta
}

export class ConversacionAgente {
  private motor: MotorAgente
  private pendiente: PreguntaPendiente | null = null

  constructor(
    proveedor: ProveedorIA,
    private obtenerUbicacion: () => UbicacionApp,
    private navegar: (ruta: string) => void,
  ) {
    this.motor = crearMotor(proveedor)
  }

  get proveedor(): ProveedorIA {
    return this.motor.proveedor
  }

  /** Empieza de cero (también al cambiar de proveedor: cada uno guarda el historial a su manera). */
  reiniciar(proveedor: ProveedorIA = this.motor.proveedor) {
    this.motor = crearMotor(proveedor)
    this.pendiente = null
  }

  /** Envía un mensaje del usuario (o su respuesta a una pregunta con opciones). */
  async enviar(texto: string, eventos: EventosAgente): Promise<void> {
    const marca = this.motor.marca()
    const pendientePrevio = this.pendiente
    if (this.pendiente) {
      const { resultadosPrevios, llamada } = this.pendiente
      this.motor.agregarResultados([...resultadosPrevios, { llamada, respuesta: { respuesta_del_usuario: texto } }])
      this.pendiente = null
    } else {
      this.motor.agregarMensajeUsuario(texto)
    }

    try {
      await this.ciclo(eventos)
    } catch (e) {
      // Se descarta el turno incompleto (una llamada de herramienta sin su respuesta dejaría el
      // historial inválido). Lo ya aplicado en los datos se conserva y el contexto lo refleja.
      this.motor.volverA(marca)
      this.pendiente = pendientePrevio
      throw e
    }
  }

  private async ciclo(eventos: EventosAgente) {
    for (let paso = 0; paso < MAX_PASOS; paso++) {
      const datos = await cargarDatosContexto(this.obtenerUbicacion())
      const { texto, llamadas } = await this.motor.turno(PROMPT, contextoComoTexto(datos), eventos.aviso)
      if (texto) eventos.texto(texto)
      if (llamadas.length === 0) return

      const resultados: ResultadoLlamada[] = []
      let pregunta: { pregunta: Pregunta; llamada: LlamadaHerramienta } | null = null
      for (const llamada of llamadas) {
        const r = await ejecutarHerramienta(llamada.nombre, llamada.args, { datos: await cargarDatosContexto(this.obtenerUbicacion()), navegar: this.navegar })
        if (r.pregunta && !pregunta) {
          pregunta = { pregunta: r.pregunta, llamada }
          continue
        }
        if (r.accion) eventos.accion(r.accion)
        resultados.push({ llamada, respuesta: r.pregunta ? { error: 'Solo una pregunta a la vez.' } : r.respuesta })
      }

      if (pregunta) {
        this.pendiente = { resultadosPrevios: resultados, llamada: pregunta.llamada }
        eventos.pregunta(pregunta.pregunta)
        return
      }
      this.motor.agregarResultados(resultados)
    }
    eventos.texto('Hice varios pasos seguidos y me detuve para no exagerar. Dime si continúo.')
  }
}
