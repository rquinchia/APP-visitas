import { escribirTodosLosDatos, obtenerTodosLosDatos } from '../db'
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
  const fotos = await Promise.all(
    respaldo.fotos.map(async (f) => ({
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
      visitas: respaldo.visitas,
      actividades: respaldo.actividades,
      pendientes: respaldo.pendientes,
      historialPlan: respaldo.historialPlan,
      fotos,
    },
    opciones,
  )
}
