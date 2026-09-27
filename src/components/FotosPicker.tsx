import { useEffect, useState, type ChangeEvent } from 'react'
import { eliminarFoto, guardarFoto, listarFotosPorEntidad } from '../db'
import { generarId, ahoraISO } from '../lib/id'
import type { EntidadFoto, Foto } from '../types'

interface Props {
  visitaId: string
  entidadTipo: EntidadFoto
  entidadId: string
  /** Permite separar fotos del mismo registro, p.ej. evidencia de apertura vs. evidencia de cierre. */
  etiqueta?: string
  titulo?: string
}

export default function FotosPicker({ visitaId, entidadTipo, entidadId, etiqueta, titulo }: Props) {
  const [fotos, setFotos] = useState<Foto[]>([])
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [indiceAmpliado, setIndiceAmpliado] = useState<number | null>(null)

  async function cargar() {
    const todas = await listarFotosPorEntidad(entidadId)
    setFotos(todas.filter((f) => (f.etiqueta ?? '') === (etiqueta ?? '')))
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entidadId, etiqueta])

  useEffect(() => {
    const nuevas: Record<string, string> = {}
    for (const f of fotos) nuevas[f.id] = URL.createObjectURL(f.blob)
    setUrls(nuevas)
    return () => {
      Object.values(nuevas).forEach((u) => URL.revokeObjectURL(u))
    }
  }, [fotos])

  useEffect(() => {
    if (indiceAmpliado === null) return
    if (indiceAmpliado >= fotos.length) {
      setIndiceAmpliado(fotos.length > 0 ? fotos.length - 1 : null)
    }
  }, [fotos, indiceAmpliado])

  async function onArchivos(e: ChangeEvent<HTMLInputElement>) {
    const archivos = e.target.files
    if (!archivos || archivos.length === 0) return
    let guardadas = 0
    let fallo = false
    for (const archivo of Array.from(archivos)) {
      try {
        await guardarFoto({
          id: generarId(),
          visitaId,
          entidadTipo,
          entidadId,
          blob: archivo,
          nombreArchivo: archivo.name,
          etiqueta,
          creadoEn: ahoraISO(),
        })
        guardadas++
      } catch {
        fallo = true
        break
      }
    }
    e.target.value = ''
    await cargar()
    if (fallo) {
      alert(
        guardadas > 0
          ? `Se guardaron ${guardadas} foto(s), pero una falló (posible espacio de almacenamiento lleno). Las que se guardaron están seguras.`
          : 'No se pudo guardar la foto. Puede ser espacio de almacenamiento lleno en el dispositivo.',
      )
    }
  }

  async function borrar(id: string) {
    if (!window.confirm('¿Eliminar esta foto?')) return
    try {
      await eliminarFoto(id)
      await cargar()
    } catch {
      alert('No se pudo eliminar la foto. Inténtalo de nuevo.')
    }
  }

  const fotoAmpliada = indiceAmpliado !== null ? fotos[indiceAmpliado] : undefined

  return (
    <div>
      {titulo && <p className="mb-1 text-sm font-medium text-slate-700">{titulo}</p>}
      <div className="flex flex-wrap gap-2">
        {fotos.map((f, i) => (
          <div key={f.id} className="relative h-20 w-20 overflow-hidden rounded-lg border border-slate-200">
            <img
              src={urls[f.id]}
              alt={f.nombreArchivo}
              onClick={() => setIndiceAmpliado(i)}
              className="h-full w-full cursor-zoom-in object-cover"
            />
            <button
              type="button"
              onClick={() => borrar(f.id)}
              className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs leading-none text-white"
              aria-label="Eliminar foto"
            >
              ✕
            </button>
          </div>
        ))}
        <label className="tap flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-slate-400">
          <span className="text-xl">📷</span>
          <span className="text-[10px]">Añadir</span>
          <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={onArchivos} />
        </label>
      </div>

      {fotoAmpliada && indiceAmpliado !== null && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90"
          onClick={() => setIndiceAmpliado(null)}
        >
          <button
            onClick={(e) => {
              e.stopPropagation()
              setIndiceAmpliado(null)
            }}
            aria-label="Cerrar"
            className="absolute right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-xl text-white"
            style={{ top: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
          >
            ✕
          </button>

          <img
            src={urls[fotoAmpliada.id]}
            alt={fotoAmpliada.nombreArchivo}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[80vh] max-w-[92vw] rounded-lg object-contain"
          />

          {fotos.length > 1 && (
            <div className="mt-4 flex items-center gap-6" onClick={(e) => e.stopPropagation()}>
              <button
                disabled={indiceAmpliado === 0}
                onClick={() => setIndiceAmpliado((i) => (i !== null ? i - 1 : i))}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-xl text-white disabled:opacity-30"
              >
                ‹
              </button>
              <span className="text-xs text-white/70">
                {indiceAmpliado + 1} / {fotos.length}
              </span>
              <button
                disabled={indiceAmpliado === fotos.length - 1}
                onClick={() => setIndiceAmpliado((i) => (i !== null ? i + 1 : i))}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-xl text-white disabled:opacity-30"
              >
                ›
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
