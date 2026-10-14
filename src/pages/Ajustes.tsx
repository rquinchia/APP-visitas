import { useState } from 'react'
import { generarTextoIA, ErrorIA } from '../lib/ia'
import { NOMBRE_PROVEEDOR, elegirProveedor, guardarClave, obtenerClave, proveedorActivo, type ProveedorIA } from '../lib/iaConfig'
import { PageHeader } from '../components/ui'
import { confirmar } from '../lib/dialogo'
import { LogoProveedor } from '../components/LogosIA'

export default function Ajustes() {
  const [proveedor, setProveedor] = useState<ProveedorIA>(proveedorActivo)

  function elegir(p: ProveedorIA) {
    elegirProveedor(p)
    setProveedor(p)
  }

  return (
    <div className="flex flex-col gap-4 pb-8">
      <PageHeader titulo="Ajustes" atras="/" atrasEtiqueta="Panel" />

      <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm shadow-slate-200/60">
        <h2 className="text-sm font-semibold text-slate-800">✨ Asistente con IA</h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Elige con qué IA trabaja el asistente (el chat flotante y el ✨ de cada campo). Puedes cambiarlo cuando quieras, también
          desde el propio chat.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(['gemini', 'claude'] as ProveedorIA[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => elegir(p)}
              className={`flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold ${
                proveedor === p ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'
              }`}
            >
              <LogoProveedor proveedor={p} className="h-5 w-5" /> {NOMBRE_PROVEEDOR[p]}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          Para que el asistente pueda actuar, se envía al proveedor lo que escribes y el texto de la visita en curso (actividades,
          hallazgos e informe en pantalla; nunca las fotos). Ten esto presente con información sensible.
        </p>
      </section>

      <TarjetaProveedor
        proveedor="gemini"
        activo={proveedor === 'gemini'}
        descripcion={
          <>
            <strong>Gratis</strong> con tu cuenta de Google. En el nivel gratuito Google puede usar los datos para mejorar sus
            productos. Si responde "alta demanda" (503), la app reintenta sola y cambia a otro modelo de Gemini.
          </>
        }
        placeholder="AIza..."
        pasos={[
          'Entra a aistudio.google.com e inicia sesión con tu cuenta de Google.',
          'Busca "Get API key" → "Create API key".',
          'Copia la clave (empieza con "AIza") y pégala arriba.',
          'No necesitas tarjeta de crédito.',
        ]}
      />

      <TarjetaProveedor
        proveedor="claude"
        activo={proveedor === 'claude'}
        descripcion={
          <>
            Usa <strong>Claude Opus 5.5</strong> con una clave de la API de Anthropic, <strong>de pago por uso</strong> (del orden de
            unos centavos de dólar por conversación). La suscripción de claude.ai (Pro, Max, Team) no incluye la API: es un saldo
            aparte que se recarga en console.anthropic.com. Anthropic no usa los datos de la API para entrenar sus modelos.
          </>
        }
        placeholder="sk-ant-..."
        pasos={[
          'Entra a console.anthropic.com e inicia sesión (o crea la cuenta).',
          'En "Billing", carga saldo (por ejemplo 5 USD) o configura un límite de gasto mensual.',
          'En "API keys" → "Create key", copia la clave (empieza con "sk-ant-") y pégala arriba.',
          'Recomendado: en "Limits" fija un tope de gasto mensual para estar tranquilo.',
        ]}
      />
    </div>
  )
}

function TarjetaProveedor({
  proveedor,
  activo,
  descripcion,
  placeholder,
  pasos,
}: {
  proveedor: ProveedorIA
  activo: boolean
  descripcion: React.ReactNode
  placeholder: string
  pasos: string[]
}) {
  const [clave, setClave] = useState(obtenerClave(proveedor))
  const [mostrar, setMostrar] = useState(false)
  const [probando, setProbando] = useState(false)
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null)
  const nombre = NOMBRE_PROVEEDOR[proveedor]

  function guardar() {
    guardarClave(proveedor, clave.trim())
    setResultado({ ok: true, texto: 'Clave guardada en este dispositivo.' })
  }

  async function eliminar() {
    if (!(await confirmar({ titulo: `¿Eliminar la clave de ${nombre} de este dispositivo?`, aceptar: 'Eliminar', peligro: true }))) return
    guardarClave(proveedor, '')
    setClave('')
    setResultado(null)
  }

  async function probar() {
    setProbando(true)
    setResultado(null)
    guardarClave(proveedor, clave.trim())
    // La prueba usa este proveedor aunque el activo sea otro.
    const previo = proveedorActivo()
    elegirProveedor(proveedor)
    try {
      const texto = await generarTextoIA([{ role: 'user', content: 'Responde solo con la palabra: Conectado' }], (m) => setResultado({ ok: true, texto: m }))
      setResultado({ ok: true, texto: `✓ Conexión exitosa (respuesta de prueba: "${texto}")` })
    } catch (e) {
      setResultado({ ok: false, texto: e instanceof ErrorIA ? e.message : 'Error inesperado.' })
    } finally {
      elegirProveedor(previo)
      setProbando(false)
    }
  }

  return (
    <section className={`rounded-2xl border bg-white p-4 shadow-sm shadow-slate-200/60 ${activo ? 'border-slate-900/30 ring-1 ring-slate-900/10' : 'border-slate-200/70'}`}>
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
        <LogoProveedor proveedor={proveedor} className="h-5 w-5" /> {nombre}
        {activo && <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">En uso</span>}
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">{descripcion}</p>

      <label className="mb-1 mt-3 block text-xs font-medium text-slate-600">Clave de API de {nombre}</label>
      <div className="flex gap-2">
        <input
          type={mostrar ? 'text' : 'password'}
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
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

      {resultado && <p className={`mt-2 text-xs font-medium ${resultado.ok ? 'text-emerald-600' : 'text-rose-600'}`}>{resultado.texto}</p>}

      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-medium text-slate-500">¿Cómo consigo mi clave de {nombre}?</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-slate-600">
          {pasos.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ol>
      </details>
    </section>
  )
}
