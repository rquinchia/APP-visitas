import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { eliminarActividad, guardarActividad, listarActividadesPorVisita, obtenerVisita } from '../db'
import { ahoraISO } from '../lib/id'
import { registrarCambioPlan } from '../lib/historial'
import { diaActual } from '../lib/progreso'
import type { Actividad, EstadoActividad, Visita } from '../types'
import { ETIQUETA_ESTADO_ACTIVIDAD } from '../types'
import FotosPicker from '../components/FotosPicker'
import { ListGroup, ListRow, PageHeader } from '../components/ui'
import { Eye, Plus, Zap } from 'lucide-react'

export default function Plan() {
  const { id } = useParams<{ id: string }>()
  const [visita, setVisita] = useState<Visita | null | undefined>(undefined)
  const [actividades, setActividades] = useState<Actividad[]>([])

  async function refrescar(visitaId: string) {
    setActividades(await listarActividadesPorVisita(visitaId))
  }

  useEffect(() => {
    if (!id) return
    obtenerVisita(id).then((v) => setVisita(v ?? null))
    refrescar(id)
  }, [id])

  if (visita === undefined) return <p className="text-sm text-slate-500">Cargando…</p>
  if (visita === null) return <p className="text-sm text-rose-600">Visita no encontrada.</p>

  function siguienteOrden(dia: number): number {
    const delDia = actividades.filter((a) => a.dia === dia)
    return delDia.length === 0 ? 1 : Math.max(...delDia.map((a) => a.orden)) + 1
  }

  async function eliminar(actividad: Actividad) {
    if (!visita) return
    if (!window.confirm(`¿Eliminar la actividad "${actividad.actividad}" (día ${actividad.dia})?`)) return
    const actualizada = await registrarCambioPlan(visita, `Actividad eliminada (día ${actividad.dia}): ${actividad.actividad}`)
    if (!actualizada) return
    setVisita(actualizada)
    await eliminarActividad(actividad.id)
    await refrescar(visita.id)
  }

  async function duplicar(actividad: Actividad) {
    if (!visita) return
    const actualizada = await registrarCambioPlan(visita, `Actividad duplicada (día ${actividad.dia}): ${actividad.actividad}`)
    if (!actualizada) return
    setVisita(actualizada)
    const ahora = ahoraISO()
    await guardarActividad({
      ...actividad,
      id: crypto.randomUUID(),
      orden: siguienteOrden(actividad.dia),
      estado: 'PENDIENTE',
      observacion: '',
      creadoEn: ahora,
      actualizadoEn: ahora,
    })
    await refrescar(visita.id)
  }

  async function cambiarEstado(actividad: Actividad, nuevoEstado: EstadoActividad) {
    if (!visita || nuevoEstado === actividad.estado) return
    const actualizada = await registrarCambioPlan(
      visita,
      `Estado actualizado (día ${actividad.dia}): ${actividad.actividad} → ${ETIQUETA_ESTADO_ACTIVIDAD[nuevoEstado]}`,
    )
    if (!actualizada) return
    setVisita(actualizada)
    await guardarActividad({ ...actividad, estado: nuevoEstado, actualizadoEn: ahoraISO() })
    await refrescar(visita.id)
  }

  async function moverOrden(actividad: Actividad, direccion: -1 | 1) {
    if (!visita) return
    const delDia = actividades.filter((a) => a.dia === actividad.dia).sort((a, b) => a.orden - b.orden)
    const idx = delDia.findIndex((a) => a.id === actividad.id)
    const vecino = delDia[idx + direccion]

    if (vecino) {
      const actualizada = await registrarCambioPlan(visita, `Actividad reordenada (día ${actividad.dia}): ${actividad.actividad}`)
      if (!actualizada) return
      setVisita(actualizada)
      const ordenOriginal = actividad.orden
      await guardarActividad({ ...actividad, orden: vecino.orden, actualizadoEn: ahoraISO() })
      await guardarActividad({ ...vecino, orden: ordenOriginal, actualizadoEn: ahoraISO() })
      await refrescar(visita.id)
      return
    }

    // Está en el borde del día: cruzar al día anterior/siguiente en vez de quedarse quieto.
    const nuevoDia = actividad.dia + direccion
    if (nuevoDia < 1 || nuevoDia > visita.duracionDias) return

    const actualizada = await registrarCambioPlan(
      visita,
      `Actividad movida del día ${actividad.dia} al día ${nuevoDia}: ${actividad.actividad}`,
    )
    if (!actualizada) return
    setVisita(actualizada)

    const ahora = ahoraISO()
    const delDiaDestino = actividades.filter((a) => a.dia === nuevoDia).sort((a, b) => a.orden - b.orden)

    if (direccion === 1) {
      // Baja al día siguiente: entra de primera, las demás corren un puesto.
      for (const a of delDiaDestino) {
        await guardarActividad({ ...a, orden: a.orden + 1, actualizadoEn: ahora })
      }
      await guardarActividad({ ...actividad, dia: nuevoDia, orden: 1, actualizadoEn: ahora })
    } else {
      // Sube al día anterior: entra de última.
      const nuevoOrden = delDiaDestino.length === 0 ? 1 : Math.max(...delDiaDestino.map((a) => a.orden)) + 1
      await guardarActividad({ ...actividad, dia: nuevoDia, orden: nuevoOrden, actualizadoEn: ahora })
    }

    await refrescar(visita.id)
  }

  const dias = Array.from({ length: visita.duracionDias }, (_, i) => i + 1)
  const diaHoy = diaActual(visita)
  const diaSugerido = diaHoy && diaHoy > 0 ? diaHoy : 1

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        titulo="Plan"
        subtitulo={`${actividades.length} actividades · versión ${visita.version}`}
        atras={`/visitas/${visita.id}`}
        atrasEtiqueta="Visita"
        accion={
          <Link
            to={`/visitas/${visita.id}/plan/vista-previa`}
            className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm"
          >
            <Eye className="h-4 w-4" /> Vista previa
          </Link>
        }
      />

      <ListGroup>
        <ListRow
          to={`/visitas/${visita.id}/plan/nueva?dia=${diaSugerido}&emergente=1`}
          icono={Zap}
          color="ambar"
          titulo="Actividad emergente"
          detalle={`Se agrega al día ${diaSugerido}`}
        />
      </ListGroup>

      {dias.map((dia) => {
        const delDia = actividades.filter((a) => a.dia === dia).sort((a, b) => a.orden - b.orden)
        return (
          <section key={dia} className="rounded-2xl border border-slate-200/70 bg-white p-3 shadow-sm shadow-slate-200/60">
            <div className="mb-2 flex items-center justify-between px-1">
              <h3 className="flex items-center gap-2 text-[15px] font-semibold text-slate-800">
                <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-900 px-1.5 text-[11px] font-bold text-white">
                  {dia}
                </span>
                Día {dia}
              </h3>
              <Link
                to={`/visitas/${visita.id}/plan/nueva?dia=${dia}`}
                className="flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={3} /> Añadir
              </Link>
            </div>

            {delDia.length === 0 && <p className="text-xs text-slate-400">Sin actividades.</p>}

            <div className="flex flex-col gap-2">
              {delDia.map((a, idx) => (
                <div key={a.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {a.emergente && <span className="mr-1 text-amber-500">⚡</span>}
                        {a.actividad || '(sin nombre)'}
                      </p>
                      {a.tipo && <p className="text-xs text-slate-500">{a.tipo}</p>}
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      <button
                        disabled={idx === 0 && dia === 1}
                        onClick={() => moverOrden(a, -1)}
                        title={idx === 0 ? `Mover al día ${dia - 1}` : 'Subir'}
                        className="h-6 w-6 rounded border border-slate-200 text-xs text-slate-500 disabled:opacity-30"
                      >
                        ▲
                      </button>
                      <button
                        disabled={idx === delDia.length - 1 && dia === visita.duracionDias}
                        onClick={() => moverOrden(a, 1)}
                        title={idx === delDia.length - 1 ? `Mover al día ${dia + 1}` : 'Bajar'}
                        className="h-6 w-6 rounded border border-slate-200 text-xs text-slate-500 disabled:opacity-30"
                      >
                        ▼
                      </button>
                    </div>
                  </div>

                  <select
                    value={a.estado}
                    onChange={(e) => cambiarEstado(a, e.target.value as EstadoActividad)}
                    className="mt-2 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                  >
                    {(Object.keys(ETIQUETA_ESTADO_ACTIVIDAD) as EstadoActividad[]).map((estado) => (
                      <option key={estado} value={estado}>
                        {ETIQUETA_ESTADO_ACTIVIDAD[estado]}
                      </option>
                    ))}
                  </select>

                  <div className="mt-2">
                    <FotosPicker visitaId={visita.id} entidadTipo="ACTIVIDAD" entidadId={a.id} titulo="Fotos" />
                  </div>

                  <div className="mt-2 flex gap-3 text-xs">
                    <Link to={`/visitas/${visita.id}/plan/${a.id}/editar`} className="font-medium text-accent">
                      Editar
                    </Link>
                    <button onClick={() => duplicar(a)} className="font-medium text-slate-500">
                      Duplicar
                    </button>
                    <button onClick={() => eliminar(a)} className="font-medium text-rose-600">
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
