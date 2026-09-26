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

  async function onArchivos(e: ChangeEvent<HTMLInputElement>) {
    const archivos = e.target.files
    if (!archivos || archivos.length === 0) return
    for (const archivo of Array.from(archivos)) {
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
    }
    e.target.value = ''
    await cargar()
  }

  async function borrar(id: string) {
    if (!window.confirm('¿Eliminar esta foto?')) return
    await eliminarFoto(id)
    await cargar()
  }

  return (
    <div>
      {titulo && <p className="mb-1 text-sm font-medium text-slate-700">{titulo}</p>}
      <div className="flex flex-wrap gap-2">
        {fotos.map((f) => (
          <div key={f.id} className="relative h-20 w-20 overflow-hidden rounded-lg border border-slate-200">
            <img src={urls[f.id]} alt={f.nombreArchivo} className="h-full w-full object-cover" />
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
        <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-slate-400 active:bg-slate-50">
          <span className="text-xl">📷</span>
          <span className="text-[10px]">Añadir</span>
          <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={onArchivos} />
        </label>
      </div>
    </div>
  )
}
