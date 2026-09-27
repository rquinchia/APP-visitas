import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { guardarVisita } from '../db'
import { generarId, ahoraISO } from '../lib/id'
import type { TipoVisita, Visita } from '../types'
import { TIPOS_VISITA } from '../types'
import { PageHeader } from '../components/ui'

export default function NuevaVisita() {
  const navigate = useNavigate()
  const [tipo, setTipo] = useState<TipoVisita>('PA')
  const [planta, setPlanta] = useState('')
  const [cliente, setCliente] = useState('')
  const [responsable, setResponsable] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setGuardando(true)
    const ahora = ahoraISO()
    const visita: Visita = {
      id: generarId(),
      tipo,
      planta: planta.trim(),
      cliente: cliente.trim(),
      objetivo: TIPOS_VISITA[tipo].objetivo,
      duracionDias: TIPOS_VISITA[tipo].duracionDias,
      fechaInicio: null,
      estado: 'BORRADOR',
      responsable: responsable.trim(),
      creadoEn: ahora,
      actualizadoEn: ahora,
      version: 1,
    }
    await guardarVisita(visita)
    navigate(`/visitas/${visita.id}`)
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <PageHeader titulo="Nueva visita" subtitulo="Elige el tipo y completa los datos básicos." atras="/visitas" atrasEtiqueta="Visitas" />
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Tipo de visita</label>
        <div className="grid grid-cols-1 gap-2">
          {(Object.keys(TIPOS_VISITA) as TipoVisita[]).map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => setTipo(t)}
              className={`rounded-xl border p-3 text-left transition ${
                tipo === t ? 'border-accent bg-accent/5' : 'border-slate-200 bg-white'
              }`}
            >
              <p className="font-semibold text-slate-900">{TIPOS_VISITA[t].nombre}</p>
              <p className="text-xs text-slate-500">{TIPOS_VISITA[t].objetivo}</p>
              <p className="mt-1 text-xs font-medium text-accent">{TIPOS_VISITA[t].duracionDias} días</p>
            </button>
          ))}
        </div>
      </div>

      <Campo etiqueta="Planta / sitio" valor={planta} onChange={setPlanta} placeholder="Ej. Planta Bogotá" />
      <Campo etiqueta="Cliente" valor={cliente} onChange={setCliente} placeholder="Ej. Acerías S.A." />
      <Campo etiqueta="Responsable de la visita" valor={responsable} onChange={setResponsable} placeholder="Nombre" />

      <button
        type="submit"
        disabled={guardando}
        className="mt-2 rounded-xl bg-accent py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        Crear visita en borrador
      </button>
    </form>
  )
}

function Campo({
  etiqueta,
  valor,
  onChange,
  placeholder,
}: {
  etiqueta: string
  valor: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{etiqueta}</label>
      <input
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      />
    </div>
  )
}
