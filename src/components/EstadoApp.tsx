import { useEffect, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

type Mensaje = { texto: string; tono: 'ok' | 'info' | 'error' } | null

export default function EstadoApp() {
  const [enLinea, setEnLinea] = useState(navigator.onLine)
  const [verificando, setVerificando] = useState(false)
  const [mensaje, setMensaje] = useState<Mensaje>(null)
  const registrationRef = useRef<ServiceWorkerRegistration | undefined>(undefined)
  const necesitaActualizarRef = useRef(false)

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      registrationRef.current = registration
    },
  })

  useEffect(() => {
    necesitaActualizarRef.current = needRefresh
  }, [needRefresh])

  useEffect(() => {
    const onOnline = () => setEnLinea(true)
    const onOffline = () => setEnLinea(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  useEffect(() => {
    if (!mensaje) return
    const t = setTimeout(() => setMensaje(null), 4000)
    return () => clearTimeout(t)
  }, [mensaje])

  async function verificarActualizacion() {
    if (verificando) return
    setVerificando(true)
    setMensaje(null)
    try {
      if (!enLinea) {
        setMensaje({ texto: 'Sin conexión: no se puede verificar ahora.', tono: 'info' })
        return
      }
      const reg = registrationRef.current ?? (await navigator.serviceWorker?.getRegistration())
      await reg?.update()
      await new Promise((resolve) => setTimeout(resolve, 900))
      if (necesitaActualizarRef.current) {
        setMensaje({ texto: 'Hay una actualización disponible.', tono: 'info' })
      } else {
        setMensaje({ texto: 'Ya tienes la última versión ✓', tono: 'ok' })
      }
    } catch {
      setMensaje({ texto: 'No se pudo verificar. Intenta de nuevo.', tono: 'error' })
    } finally {
      setVerificando(false)
    }
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className={`h-2 w-2 rounded-full ${enLinea ? 'bg-emerald-500' : 'bg-slate-400'}`} />
          {enLinea ? 'En línea' : 'Sin conexión — guardando en el dispositivo'}
        </span>
        <button
          onClick={verificarActualizacion}
          disabled={verificando}
          aria-label="Verificar actualización"
          className="ml-auto flex h-7 w-7 items-center justify-center rounded-full text-slate-400 disabled:opacity-50"
        >
          <span className={verificando ? 'inline-block animate-spin' : 'inline-block'}>🔄</span>
        </button>
      </div>

      {(mensaje || needRefresh) && (
        <div
          className={`mt-2 flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
            needRefresh
              ? 'bg-accent/10 text-accent'
              : mensaje?.tono === 'ok'
                ? 'bg-emerald-50 text-emerald-700'
                : mensaje?.tono === 'error'
                  ? 'bg-rose-50 text-rose-700'
                  : 'bg-slate-100 text-slate-600'
          }`}
        >
          <span>{needRefresh ? 'Hay una versión nueva lista para instalar.' : mensaje?.texto}</span>
          {needRefresh && (
            <button onClick={() => updateServiceWorker(true)} className="shrink-0 rounded-md bg-accent px-2.5 py-1 text-white">
              Actualizar
            </button>
          )}
        </div>
      )}
    </div>
  )
}
