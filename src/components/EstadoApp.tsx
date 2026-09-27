import { useEffect, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw } from 'lucide-react'

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
    const t = setTimeout(() => setMensaje(null), 3500)
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
      setMensaje(
        necesitaActualizarRef.current
          ? { texto: 'Hay una actualización disponible.', tono: 'info' }
          : { texto: 'Ya tienes la última versión ✓', tono: 'ok' },
      )
    } catch {
      setMensaje({ texto: 'No se pudo verificar. Intenta de nuevo.', tono: 'error' })
    } finally {
      setVerificando(false)
    }
  }

  const tonoToast =
    mensaje?.tono === 'ok' ? 'bg-emerald-600' : mensaje?.tono === 'error' ? 'bg-rose-600' : 'bg-slate-800'

  return (
    <>
      <div className="flex items-center gap-2">
        <span
          className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${
            enLinea ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
          }`}
          title={enLinea ? 'En línea' : 'Sin conexión — todo se guarda en el dispositivo'}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${enLinea ? 'bg-emerald-500' : 'bg-slate-400'}`} />
          {enLinea ? 'En línea' : 'Sin conexión'}
        </span>
        <button
          onClick={verificarActualizacion}
          disabled={verificando}
          aria-label="Verificar actualización"
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 disabled:opacity-50"
        >
          <RefreshCw className={`h-[18px] w-[18px] ${verificando ? 'animate-spin' : ''}`} strokeWidth={2.2} />
        </button>
      </div>

      {needRefresh && (
        <div
          className="fixed inset-x-0 z-50 mx-auto flex w-[min(92vw,420px)] animate-subir items-center justify-between gap-3 rounded-2xl bg-slate-900/95 px-4 py-3 text-sm text-white shadow-2xl backdrop-blur"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
        >
          <span>Hay una versión nueva lista.</span>
          <button onClick={() => updateServiceWorker(true)} className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-900">
            Actualizar
          </button>
        </div>
      )}

      {mensaje && !needRefresh && (
        <div
          className={`fixed inset-x-0 z-50 mx-auto w-[min(92vw,420px)] animate-subir rounded-2xl px-4 py-3 text-center text-sm font-medium text-white shadow-2xl ${tonoToast}`}
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
        >
          {mensaje.texto}
        </div>
      )}
    </>
  )
}
