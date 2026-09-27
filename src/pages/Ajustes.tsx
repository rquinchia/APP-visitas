import { useState } from 'react'
import { generarTextoIA, ErrorIA } from '../lib/ia'
import { guardarClaveIA, obtenerClaveIA } from '../lib/iaConfig'
import { PageHeader } from '../components/ui'

export default function Ajustes() {
  const [clave, setClave] = useState(obtenerClaveIA())
  const [mostrar, setMostrar] = useState(false)
  const [probando, setProbando] = useState(false)
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null)

  function guardar() {
    guardarClaveIA(clave.trim())
    setResultado(null)
    alert('Clave guardada en este dispositivo.')
  }

  function eliminar() {
    if (!window.confirm('¿Eliminar la clave guardada de este dispositivo?')) return
    guardarClaveIA('')
    setClave('')
    setResultado(null)
  }

  async function probar() {
    setProbando(true)
    setResultado(null)
    guardarClaveIA(clave.trim())
    try {
      const texto = await generarTextoIA([{ role: 'user', content: 'Responde solo con la palabra: Conectado' }])
      setResultado({ ok: true, texto })
    } catch (e) {
      setResultado({ ok: false, texto: e instanceof ErrorIA ? e.message : 'Error inesperado.' })
    } finally {
      setProbando(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-8">
      <PageHeader titulo="Ajustes" atras="/" atrasEtiqueta="Panel" />
      <section className="rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/60 p-4">
        <h2 className="text-sm font-semibold text-slate-800">✨ Asistente de redacción con IA</h2>
        <p className="mt-1 text-xs text-slate-500">
          Usa tu propia cuenta de Google (Gemini), gratis. La clave se guarda solo en este dispositivo (nunca se sube a
          ningún lado). Al usar el asistente, el texto que escribas se envía a los servidores de Google para generar
          la respuesta — ten esto presente con información sensible.
        </p>

        <label className="mb-1 mt-3 block text-xs font-medium text-slate-600">Clave de API de Google Gemini</label>
        <div className="flex gap-2">
          <input
            type={mostrar ? 'text' : 'password'}
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            placeholder="AIza..."
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            autoComplete="off"
          />
          <button type="button" onClick={() => setMostrar((m) => !m)} className="rounded-lg border border-slate-300 px-3 text-xs text-slate-600">
            {mostrar ? 'Ocultar' : 'Ver'}
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={guardar} disabled={!clave.trim()} className="rounded-lg bg-accent py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            Guardar
          </button>
          <button onClick={eliminar} className="rounded-lg border border-rose-300 bg-rose-50 py-2.5 text-sm font-medium text-rose-700">
            Eliminar clave
          </button>
        </div>

        <button
          onClick={probar}
          disabled={probando || !clave.trim()}
          className="mt-2 w-full rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-700 disabled:opacity-50"
        >
          {probando ? 'Probando…' : 'Probar conexión'}
        </button>

        {resultado && (
          <p className={`mt-2 text-xs font-medium ${resultado.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
            {resultado.ok ? `✓ Conexión exitosa (respuesta de prueba: "${resultado.texto}")` : resultado.texto}
          </p>
        )}

        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-slate-500">¿Cómo consigo mi clave gratis de Google Gemini?</summary>
          <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-slate-600">
            <li>Entra a aistudio.google.com e inicia sesión con tu cuenta de Google.</li>
            <li>Busca "Get API key" → "Create API key".</li>
            <li>Copia la clave (empieza con "AIza") y pégala arriba.</li>
            <li>No necesitas tarjeta de crédito — el nivel gratuito alcanza para este uso.</li>
          </ol>
        </details>
      </section>
    </div>
  )
}
