// Prepara las fotos (miniaturas en base64) que llevan los informes de correo. Separado de
// reportes.ts para que este último sea solo armado de texto/HTML, sin acceso a la base de datos.

import { listarFotosPorEntidad } from '../db'
import type { Actividad, Foto, Pendiente } from '../types'
import { ETIQUETA_FOTO_DESPUES } from '../types'
import { blobAThumbnailDataUrl } from './imagenes'

const ASPECTO = 4 / 3

export interface HallazgoInforme {
  p: Pendiente
  codigo: string
  actividad?: Actividad
  antes: string[]
  despues: string[]
  totalAntes: number
  totalDespues: number
}

export interface GaleriaInforme {
  fotos: string[]
  total: number
}

async function miniaturas(fotos: Foto[], max: number): Promise<string[]> {
  const urls = await Promise.all(fotos.slice(0, max).map((f) => blobAThumbnailDataUrl(f.blob, 480, 0.72, ASPECTO).catch(() => null)))
  return urls.filter((u): u is string => !!u)
}

function porFecha(a: Foto, b: Foto) {
  return a.creadoEn.localeCompare(b.creadoEn)
}

/** Para cada hallazgo, hasta `fotosPorLado` fotos del antes y del después. */
export async function prepararHallazgos(
  hallazgos: Pendiente[],
  codigos: Map<string, string>,
  actividades: Actividad[],
  fotosPorLado = 1,
): Promise<HallazgoInforme[]> {
  return Promise.all(
    hallazgos.map(async (p) => {
      const fotos = (await listarFotosPorEntidad(p.id)).sort(porFecha)
      const antes = fotos.filter((f) => !f.etiqueta)
      const despues = fotos.filter((f) => f.etiqueta === ETIQUETA_FOTO_DESPUES)
      return {
        p,
        codigo: codigos.get(p.id) ?? '',
        actividad: actividades.find((a) => a.id === p.actividadId),
        antes: await miniaturas(antes, fotosPorLado),
        despues: await miniaturas(despues, fotosPorLado),
        totalAntes: antes.length,
        totalDespues: despues.length,
      }
    }),
  )
}

/** Fotos de las actividades (evidencia general, no de hallazgos). */
export async function prepararGaleria(actividades: Actividad[], max: number): Promise<GaleriaInforme> {
  const listas = await Promise.all(actividades.map((a) => listarFotosPorEntidad(a.id)))
  const todas = listas.flat().sort(porFecha)
  return { fotos: await miniaturas(todas, max), total: todas.length }
}
