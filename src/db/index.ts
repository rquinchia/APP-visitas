import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Actividad, CambioHistorial, Foto, Pendiente, Visita } from '../types'
import { asignarNumeros } from '../lib/hallazgos'
import { maxNumeroEliminado, registrarEliminados, type Eliminado } from '../lib/eliminados'

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

/** Elimina un hallazgo/pendiente y sus fotos, y deja constancia para el respaldo. */
export async function eliminarPendiente(id: string, opciones: { reservarNumero?: boolean } = {}): Promise<void> {
  const db = await getDB()
  const previo = await db.get('pendientes', id)
  // Fijar los números de la visita antes de borrar: así los demás conservan su código.
  if (previo) await normalizarNumerosHallazgos(previo.visitaId)
  const p = await db.get('pendientes', id)
  // "Deshacer" de algo recién creado no reserva el número: el siguiente hallazgo lo reutiliza.
  const numero = p && opciones.reservarNumero !== false ? asignarNumeros(await db.getAllFromIndex('pendientes', 'visitaId', p.visitaId)).get(id) : undefined
  const tx = db.transaction(['pendientes', 'fotos'], 'readwrite')
  await tx.objectStore('pendientes').delete(id)
  const fotos: string[] = []
  let cursor = await tx.objectStore('fotos').index('entidadId').openCursor(IDBKeyRange.only(id))
  while (cursor) {
    fotos.push(cursor.value.id)
    await cursor.delete()
    cursor = await cursor.continue()
  }
  await tx.done
  const en = new Date().toISOString()
  registrarEliminados([
    { id, tipo: 'pendiente', en, visitaId: p?.visitaId, numero },
    ...fotos.map((f) => ({ id: f, tipo: 'foto' as const, en })),
  ])
}

/**
 * Elimina una actividad y sus fotos. Sus hallazgos NO se pierden: quedan como hallazgos generales
 * de la visita (siguen en Pendientes y en los informes). Devuelve cuántos hallazgos se conservaron.
 */
export async function eliminarActividadCompleta(id: string): Promise<number> {
  const db = await getDB()
  const actividad = await db.get('actividades', id)
  if (!actividad) return 0
  const tx = db.transaction(['actividades', 'fotos', 'pendientes'], 'readwrite')
  await tx.objectStore('actividades').delete(id)
  const fotos: string[] = []
  let cursor = await tx.objectStore('fotos').index('entidadId').openCursor(IDBKeyRange.only(id))
  while (cursor) {
    fotos.push(cursor.value.id)
    await cursor.delete()
    cursor = await cursor.continue()
  }
  let conservados = 0
  const pendientes = await tx.objectStore('pendientes').index('visitaId').getAll(actividad.visitaId)
  for (const p of pendientes) {
    if (p.actividadId === id) {
      conservados++
      await tx.objectStore('pendientes').put({ ...p, actividadId: undefined, actualizadoEn: new Date().toISOString() })
    }
  }
  await tx.done
  const en = new Date().toISOString()
  registrarEliminados([{ id, tipo: 'actividad', en, visitaId: actividad.visitaId }, ...fotos.map((f) => ({ id: f, tipo: 'foto' as const, en }))])
  return conservados
}

/** Elimina una visita con todo lo suyo (plan, hallazgos, fotos, historial). */
export async function eliminarVisitaCompleta(id: string): Promise<void> {
  const db = await getDB()
  const en = new Date().toISOString()
  const lapidas: Eliminado[] = [{ id, tipo: 'visita', en }]
  const tipos = { actividades: 'actividad', pendientes: 'pendiente', fotos: 'foto', historialPlan: 'historial' } as const
  for (const store of ['actividades', 'pendientes', 'fotos', 'historialPlan'] as const) {
    const claves = await db.getAllKeysFromIndex(store, 'visitaId', id)
    lapidas.push(...claves.map((k) => ({ id: String(k), tipo: tipos[store], en, visitaId: id })))
  }
  await eliminarVisita(id)
  registrarEliminados(lapidas)
}

/** Borra localmente lo que otro dispositivo eliminó (se usa al combinar un respaldo). */
export async function aplicarEliminadosLocales(ids: Set<string>): Promise<void> {
  if (ids.size === 0) return
  const db = await getDB()
  const tx = db.transaction(['visitas', 'actividades', 'pendientes', 'fotos', 'historialPlan'], 'readwrite')
  for (const store of ['visitas', 'actividades', 'pendientes', 'fotos', 'historialPlan'] as const) {
    for (const id of ids) {
      if (await tx.objectStore(store).getKey(id)) await tx.objectStore(store).delete(id)
    }
  }
  await tx.done
}

/** Siguiente número de hallazgo libre en la visita (nunca reutiliza el de uno eliminado). */
export async function siguienteNumeroHallazgo(visitaId: string): Promise<number> {
  // Primero se fijan los números de los existentes, para que el nuevo no corra a los anteriores.
  await normalizarNumerosHallazgos(visitaId)
  const db = await getDB()
  const numeros = asignarNumeros(await db.getAllFromIndex('pendientes', 'visitaId', visitaId))
  return Math.max(0, maxNumeroEliminado(visitaId), ...numeros.values()) + 1
}

/** Guarda en cada hallazgo su número permanente (datos anteriores o combinados de dos dispositivos). */
export async function normalizarNumerosHallazgos(soloVisitaId?: string): Promise<void> {
  const db = await getDB()
  const todos = soloVisitaId ? await db.getAllFromIndex('pendientes', 'visitaId', soloVisitaId) : await db.getAll('pendientes')
  const porVisita = new Map<string, Pendiente[]>()
  for (const p of todos) porVisita.set(p.visitaId, [...(porVisita.get(p.visitaId) ?? []), p])
  for (const [visitaId, lista] of porVisita) {
    const numeros = asignarNumeros(lista, maxNumeroEliminado(visitaId))
    for (const p of lista) {
      const n = numeros.get(p.id)
      if (n && p.numero !== n) await db.put('pendientes', { ...p, numero: n })
    }
  }
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
  const foto = await db.get('fotos', id)
  await db.delete('fotos', id)
  registrarEliminados([{ id, tipo: 'foto', en: new Date().toISOString(), visitaId: foto?.visitaId }])
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
