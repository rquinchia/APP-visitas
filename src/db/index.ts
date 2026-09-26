import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Actividad, CambioHistorial, Foto, Pendiente, Visita } from '../types'

interface AppDB extends DBSchema {
  visitas: {
    key: string
    value: Visita
    indexes: { estado: string }
  }
  actividades: {
    key: string
    value: Actividad
    indexes: { visitaId: string }
  }
  pendientes: {
    key: string
    value: Pendiente
    indexes: { visitaId: string; estado: string }
  }
  fotos: {
    key: string
    value: Foto
    indexes: { entidadId: string; visitaId: string }
  }
  historialPlan: {
    key: string
    value: CambioHistorial
    indexes: { visitaId: string }
  }
}

const DB_NAME = 'app-visitas'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<AppDB>> | null = null

export function getDB(): Promise<IDBPDatabase<AppDB>> {
  if (!dbPromise) {
    dbPromise = openDB<AppDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const visitas = db.createObjectStore('visitas', { keyPath: 'id' })
        visitas.createIndex('estado', 'estado')

        const actividades = db.createObjectStore('actividades', { keyPath: 'id' })
        actividades.createIndex('visitaId', 'visitaId')

        const pendientes = db.createObjectStore('pendientes', { keyPath: 'id' })
        pendientes.createIndex('visitaId', 'visitaId')
        pendientes.createIndex('estado', 'estado')

        const fotos = db.createObjectStore('fotos', { keyPath: 'id' })
        fotos.createIndex('entidadId', 'entidadId')
        fotos.createIndex('visitaId', 'visitaId')

        const historialPlan = db.createObjectStore('historialPlan', { keyPath: 'id' })
        historialPlan.createIndex('visitaId', 'visitaId')
      },
    })
  }
  return dbPromise
}

// --- Visitas ---

export async function listarVisitas(): Promise<Visita[]> {
  const db = await getDB()
  const todas = await db.getAll('visitas')
  return todas.sort((a, b) => b.actualizadoEn.localeCompare(a.actualizadoEn))
}

export async function obtenerVisita(id: string): Promise<Visita | undefined> {
  const db = await getDB()
  return db.get('visitas', id)
}

export async function guardarVisita(visita: Visita): Promise<void> {
  const db = await getDB()
  await db.put('visitas', visita)
}

export async function eliminarVisita(id: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['visitas', 'actividades', 'pendientes', 'fotos', 'historialPlan'], 'readwrite')
  await tx.objectStore('visitas').delete(id)
  for (const storeName of ['actividades', 'pendientes', 'fotos', 'historialPlan'] as const) {
    const store = tx.objectStore(storeName)
    const idx = store.index('visitaId')
    let cursor = await idx.openCursor(IDBKeyRange.only(id))
    while (cursor) {
      await cursor.delete()
      cursor = await cursor.continue()
    }
  }
  await tx.done
}

// --- Actividades ---

export async function listarActividadesPorVisita(visitaId: string): Promise<Actividad[]> {
  const db = await getDB()
  const actividades = await db.getAllFromIndex('actividades', 'visitaId', visitaId)
  return actividades.sort((a, b) => a.dia - b.dia || a.orden - b.orden)
}

export async function obtenerActividad(id: string): Promise<Actividad | undefined> {
  const db = await getDB()
  return db.get('actividades', id)
}

export async function guardarActividad(actividad: Actividad): Promise<void> {
  const db = await getDB()
  await db.put('actividades', actividad)
}

export async function eliminarActividad(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('actividades', id)
}

// --- Pendientes ---

export async function listarPendientesPorVisita(visitaId: string): Promise<Pendiente[]> {
  const db = await getDB()
  return db.getAllFromIndex('pendientes', 'visitaId', visitaId)
}

export async function listarTodosPendientes(): Promise<Pendiente[]> {
  const db = await getDB()
  return db.getAll('pendientes')
}

export async function obtenerPendiente(id: string): Promise<Pendiente | undefined> {
  const db = await getDB()
  return db.get('pendientes', id)
}

export async function guardarPendiente(pendiente: Pendiente): Promise<void> {
  const db = await getDB()
  await db.put('pendientes', pendiente)
}

// --- Historial de plan ---

export async function listarHistorialPorVisita(visitaId: string): Promise<CambioHistorial[]> {
  const db = await getDB()
  const historial = await db.getAllFromIndex('historialPlan', 'visitaId', visitaId)
  return historial.sort((a, b) => b.fecha.localeCompare(a.fecha))
}

export async function registrarCambioHistorial(cambio: CambioHistorial): Promise<void> {
  const db = await getDB()
  await db.put('historialPlan', cambio)
}

// --- Fotos ---

export async function guardarFoto(foto: Foto): Promise<void> {
  const db = await getDB()
  await db.put('fotos', foto)
}

export async function listarFotosPorEntidad(entidadId: string): Promise<Foto[]> {
  const db = await getDB()
  return db.getAllFromIndex('fotos', 'entidadId', entidadId)
}

export async function listarFotosPorVisita(visitaId: string): Promise<Foto[]> {
  const db = await getDB()
  return db.getAllFromIndex('fotos', 'visitaId', visitaId)
}

export async function eliminarFoto(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('fotos', id)
}

// --- Backup / restore ---

export interface DatosCompletos {
  visitas: Visita[]
  actividades: Actividad[]
  pendientes: Pendiente[]
  historialPlan: CambioHistorial[]
  fotos: Foto[]
}

const STORES_BACKUP = ['visitas', 'actividades', 'pendientes', 'historialPlan', 'fotos'] as const

export async function obtenerTodosLosDatos(): Promise<DatosCompletos> {
  const db = await getDB()
  const [visitas, actividades, pendientes, historialPlan, fotos] = await Promise.all([
    db.getAll('visitas'),
    db.getAll('actividades'),
    db.getAll('pendientes'),
    db.getAll('historialPlan'),
    db.getAll('fotos'),
  ])
  return { visitas, actividades, pendientes, historialPlan, fotos }
}

export async function escribirTodosLosDatos(datos: DatosCompletos, opciones: { limpiarPrimero: boolean }): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(STORES_BACKUP, 'readwrite')
  if (opciones.limpiarPrimero) {
    for (const nombre of STORES_BACKUP) await tx.objectStore(nombre).clear()
  }
  for (const v of datos.visitas) await tx.objectStore('visitas').put(v)
  for (const a of datos.actividades) await tx.objectStore('actividades').put(a)
  for (const p of datos.pendientes) await tx.objectStore('pendientes').put(p)
  for (const h of datos.historialPlan) await tx.objectStore('historialPlan').put(h)
  for (const f of datos.fotos) await tx.objectStore('fotos').put(f)
  await tx.done
}
