import { useState } from 'react'
import { Link } from 'react-router-dom'
import { generarTextoIA, ErrorIA, type MensajeIA } from '../lib/ia'
import { hayClaveIA } from '../lib/iaConfig'

interface Props {
  /** Describe brevemente qué es este campo, para orientar a la IA. Ej. "Descripción de un hallazgo/pendiente". */
  contexto: string
  valorActual: string
  onInsertar: (texto: string) => void
}

export default function AsistenteIA({ contexto, valorActual, onInsertar }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [pregunta, setPregunta] = useState('')
  const [historial, setHistorial] = useState<MensajeIA[]>([])
  const [sugerencia, setSugerencia] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  function reiniciar() {
    setAbierto(false)
    setPregunta('')
    setHistorial([])
    setSugerencia('')
    setError('')
  }

  if (!hayClaveIA()) {
    return (
      <p className="mt-1 text-[11px] text-slate-400">
        <Link to="/ajustes" className="font-medium text-accent underline">
          Configura tu clave de OpenAI
        </Link>{' '}
        para usar el asistente de redacción (✨).
      </p>
    )
  }

  async function pedir(instruccion: string) {
    if (!instruccion.trim()) return
    setError('')
    setCargando(true)
    const esPrimeraVez = historial.length === 0
    const contenido = esPrimeraVez
      ? `Contexto: ${contexto}.${valorActual ? ` Texto actual en el campo: "${valorActual}".` : ''} Petición: ${instruccion}`
      : instruccion
    const nuevoHistorial: MensajeIA[] = [...historial, { role: 'user', content: contenido }]
    try {
      const texto = await generarTextoIA(nuevoHistorial)
      setHistorial([...nuevoHistorial, { role: 'assistant', content: texto }])
      setSugerencia(texto)
      setPregunta('')
    } catch (e) {
      setError(e instanceof ErrorIA ? e.message : 'Ocurrió un error inesperado.')
    } finally {
      setCargando(false)
    }
  }

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="mt-1 text-xs font-medium text-accent">
        ✨ Pedir ayuda a la IA para redactar esto
      </button>
    )
  }

  return (
    <div className="mt-2 flex flex-col gap-2 rounded-lg border border-accent/20 bg-accent/5 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-accent">✨ Asistente de redacción</p>
        <button type="button" onClick={reiniciar} className="text-xs text-slate-400">
          Cerrar
        </button>
      </div>

      {historial.length === 0 && (
        <p className="text-[11px] text-slate-500">
          Cuéntame qué quieres decir y te ayudo a redactarlo. Ej: "la soldadora tiene fuga de aceite en el sistema
          hidráulico"
        </p>
      )}

      {sugerencia && <div className="rounded-md border border-slate-200 bg-white p-2 text-sm text-slate-800">{sugerencia}</div>}

      {error && <p className="text-xs font-medium text-rose-600">{error}</p>}

      <div className="flex gap-2">
        <input
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          placeholder={sugerencia ? 'Pide un ajuste (ej. "más corto")…' : 'Qué quieres decir…'}
          className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              pedir(pregunta)
            }
          }}
        />
        <button
          type="button"
          disabled={cargando || !pregunta.trim()}
          onClick={() => pedir(pregunta)}
          className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {cargando ? '…' : sugerencia ? 'Ajustar' : 'Redactar'}
        </button>
      </div>

      {sugerencia && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              onInsertar(sugerencia)
              reiniciar()
            }}
            className="flex-1 rounded-md bg-emerald-600 py-1.5 text-xs font-semibold text-white"
          >
            Usar este texto
          </button>
          <button type="button" onClick={reiniciar} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600">
            Cancelar
          </button>
        </div>
      )}
    </div>
  )
}
