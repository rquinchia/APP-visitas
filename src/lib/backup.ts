import { aplicarEliminadosLocales, escribirTodosLosDatos, normalizarNumerosHallazgos, obtenerTodosLosDatos } from '../db'
import { idsEliminados, leerEliminados, reemplazarEliminados, registrarEliminados, type Eliminado } from './eliminados'
import type { Actividad, CambioHistorial, EntidadFoto, Pendiente, Visita } from '../types'

const FORMATO = 'app-visitas-respaldo'
const VERSION_FORMATO = 1

interface FotoRespaldo {
  id: string
  visitaId: string
  entidadTipo: EntidadFoto
  entidadId: string
  nombreArchivo: string
  etiqueta?: string
  creadoEn: string
  dataUrl: string
}

interface RespaldoJSON {
  formato: string
  version: number
  exportadoEn: string
  visitas: Visita[]
  actividades: Actividad[]
  pendientes: Pendiente[]
  historialPlan: CambioHistorial[]
  fotos: FotoRespaldo[]
  /** Lo eliminado en el dispositivo de origen (opcional: respaldos anteriores no lo traen). */
  eliminados?: Eliminado[]
}

function blobADataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader()
    lector.onloadend = () => resolve(lector.result as string)
    lector.onerror = () => reject(new Error('No se pudo leer una fotografía para el respaldo.'))
    lector.readAsDataURL(blob)
  })
}

async function dataUrlABlob(dataUrl: string): Promise<Blob> {
  const respuesta = await fetch(dataUrl)
  return respuesta.blob()
}

export async function generarRespaldo(): Promise<Blob> {
  const datos = await obtenerTodosLosDatos()
  const fotos: FotoRespaldo[] = await Promise.all(
    datos.fotos.map(async (f) => ({
      id: f.id,
      visitaId: f.visitaId,
      entidadTipo: f.entidadTipo,
      entidadId: f.entidadId,
      nombreArchivo: f.nombreArchivo,
      etiqueta: f.etiqueta,
      creadoEn: f.creadoEn,
      dataUrl: await blobADataUrl(f.blob),
    })),
  )

  const respaldo: RespaldoJSON = {
    formato: FORMATO,
    version: VERSION_FORMATO,
    exportadoEn: new Date().toISOString(),
    visitas: datos.visitas,
    actividades: datos.actividades,
    pendientes: datos.pendientes,
    historialPlan: datos.historialPlan,
    fotos,
    eliminados: leerEliminados(),
  }

  return new Blob([JSON.stringify(respaldo)], { type: 'application/json' })
}

export async function leerArchivoRespaldo(archivo: File): Promise<RespaldoJSON> {
  const texto = await archivo.text()
  let datos: unknown
  try {
    datos = JSON.parse(texto)
  } catch {
    throw new Error('El archivo no es un JSON válido.')
  }
  const r = datos as Partial<RespaldoJSON>
  if (r.formato !== FORMATO || !Array.isArray(r.visitas)) {
    throw new Error('El archivo no parece un respaldo válido de esta aplicación.')
  }
  return r as RespaldoJSON
}

export interface ResumenRespaldo {
  exportadoEn: string
  visitas: number
  actividades: number
  pendientes: number
  fotos: number
}

export function resumirRespaldo(respaldo: RespaldoJSON): ResumenRespaldo {
  return {
    exportadoEn: respaldo.exportadoEn,
    visitas: respaldo.visitas.length,
    actividades: respaldo.actividades.length,
    pendientes: respaldo.pendientes.length,
    fotos: respaldo.fotos.length,
  }
}

export async function restaurarRespaldo(respaldo: RespaldoJSON, opciones: { limpiarPrimero: boolean }): Promise<void> {
  // Combinar: lo eliminado en cualquiera de los dos dispositivos queda eliminado (no "resucita").
  // Reemplazar todo: manda el respaldo (permite recuperar a propósito una copia anterior).
  if (opciones.limpiarPrimero) reemplazarEliminados(respaldo.eliminados ?? [])
  else registrarEliminados(respaldo.eliminados ?? [])
  const borrados = idsEliminados()
  const vivo = <T extends { id: string }>(x: T) => !borrados.has(x.id)

  const fotos = await Promise.all(
    respaldo.fotos.filter(vivo).map(async (f) => ({
      id: f.id,
      visitaId: f.visitaId,
      entidadTipo: f.entidadTipo,
      entidadId: f.entidadId,
      nombreArchivo: f.nombreArchivo,
      etiqueta: f.etiqueta,
      creadoEn: f.creadoEn,
      blob: await dataUrlABlob(f.dataUrl),
    })),
  )

  await escribirTodosLosDatos(
    {
      visitas: respaldo.visitas.filter(vivo),
      actividades: respaldo.actividades.filter(vivo),
      pendientes: respaldo.pendientes.filter(vivo),
      historialPlan: respaldo.historialPlan.filter(vivo),
      fotos,
    },
    opciones,
  )
  await aplicarEliminadosLocales(borrados)
  await normalizarNumerosHallazgos()
}
