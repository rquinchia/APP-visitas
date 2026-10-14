import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { registrarDialogos, type PeticionDialogo } from '../lib/dialogo'

/** Muestra los diálogos pedidos con confirmar()/pedirTexto() (ver lib/dialogo.ts), uno a la vez. */
export default function Dialogos() {
  const [cola, setCola] = useState<PeticionDialogo[]>([])
  const [texto, setTexto] = useState('')

  useEffect(() => {
    registrarDialogos((p) => setCola((c) => [...c, p]))
    return () => registrarDialogos(null)
  }, [])

  const actual = cola[0]
  useEffect(() => {
    setTexto(actual?.tipo === 'texto' ? (actual.opciones.valorInicial ?? '') : '')
  }, [actual])

  if (!actual) return null

  function cerrar(valor: boolean) {
    if (!actual) return
    if (actual.tipo === 'confirmar') actual.responder(valor)
    else actual.responder(valor ? texto.trim() : null)
    setCola((c) => c.slice(1))
  }

  const o = actual.opciones
  const peligro = actual.tipo === 'confirmar' && actual.opciones.peligro
  const escribir = actual.tipo === 'confirmar' ? actual.opciones.escribir : undefined
  const habilitado =
    actual.tipo === 'confirmar' ? !escribir || texto.trim().toUpperCase() === escribir.toUpperCase() : !actual.opciones.obligatorio || !!texto.trim()

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 p-3 backdrop-blur-[2px] sm:items-center" onClick={() => cerrar(false)}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md animate-entrar rounded-[24px] bg-white p-5 shadow-2xl"
        style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-start gap-3">
          {peligro && (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
              <AlertTriangle className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[17px] font-semibold leading-snug text-slate-900">{o.titulo}</p>
            {o.mensaje && <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-slate-600">{o.mensaje}</p>}
          </div>
        </div>

        {(actual.tipo === 'texto' || escribir) && (
          <div className="mt-4">
            {escribir && (
              <p className="mb-1.5 text-xs text-slate-500">
                Para confirmar, escribe <strong className="text-slate-800">{escribir}</strong>
              </p>
            )}
            <input
              autoFocus
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && habilitado) cerrar(true)
              }}
              placeholder={actual.tipo === 'texto' ? actual.opciones.placeholder : escribir}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-[15px] focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => cerrar(false)} className="rounded-xl border border-slate-200 bg-white py-3 text-[15px] font-medium text-slate-700">
            Cancelar
          </button>
          <button
            type="button"
            disabled={!habilitado}
            onClick={() => cerrar(true)}
            className={`rounded-xl py-3 text-[15px] font-semibold text-white disabled:opacity-40 ${peligro ? 'bg-rose-600' : 'bg-accent'}`}
          >
            {o.aceptar ?? 'Aceptar'}
          </button>
        </div>
      </div>
    </div>
  )
}
