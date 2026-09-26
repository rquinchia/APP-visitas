// Modelo de datos central de la aplicación.
// Cambios de forma aquí deben reflejarse en src/db/index.ts (definición de stores).

export type TipoVisita = 'PA' | 'SC' | 'FL'

export const TIPOS_VISITA: Record<TipoVisita, { nombre: string; objetivo: string; duracionDias: number }> = {
  PA: { nombre: 'PA — Stretch Line', objetivo: 'Formación y repaso Stretch Line', duracionDias: 15 },
  SC: {
    nombre: 'SC — Soldadoras de alambrón',
    objetivo: 'Evaluación de soldadoras de alambrón, pruebas de soldadura, pruebas de tensión y capacitación',
    duracionDias: 5,
  },
  FL: {
    nombre: 'FL — Rolling Cassette',
    objetivo: 'Capacitación y práctica de ajuste de Rolling Cassette / cassetera',
    duracionDias: 5,
  },
}

export type EstadoVisita =
  | 'BORRADOR'
  | 'EN_REVISION'
  | 'ENVIADO_APROBACION'
  | 'AJUSTES_SOLICITADOS'
  | 'APROBADO'
  | 'LISTO_PARA_INICIAR'
  | 'VISITA_ACTIVA'
  | 'VISITA_TERMINADA'
  | 'SEGUIMIENTO_PENDIENTES'
  | 'CERRADO'

export const ORDEN_ESTADOS: EstadoVisita[] = [
  'BORRADOR',
  'EN_REVISION',
  'ENVIADO_APROBACION',
  'AJUSTES_SOLICITADOS',
  'APROBADO',
  'LISTO_PARA_INICIAR',
  'VISITA_ACTIVA',
  'VISITA_TERMINADA',
  'SEGUIMIENTO_PENDIENTES',
  'CERRADO',
]

export const ETIQUETA_ESTADO: Record<EstadoVisita, string> = {
  BORRADOR: 'Borrador',
  EN_REVISION: 'En revisión',
  ENVIADO_APROBACION: 'Enviado para aprobación',
  AJUSTES_SOLICITADOS: 'Ajustes solicitados',
  APROBADO: 'Aprobado',
  LISTO_PARA_INICIAR: 'Listo para iniciar',
  VISITA_ACTIVA: 'Visita activa',
  VISITA_TERMINADA: 'Visita terminada',
  SEGUIMIENTO_PENDIENTES: 'Seguimiento de pendientes',
  CERRADO: 'Cerrado',
}

export interface Visita {
  id: string
  tipo: TipoVisita
  planta: string
  cliente: string
  objetivo: string
  duracionDias: number
  fechaInicio: string | null // ISO date, null hasta LISTO_PARA_INICIAR
  estado: EstadoVisita
  responsable: string
  creadoEn: string // ISO datetime
  actualizadoEn: string // ISO datetime
  version: number // versión del plan vigente
}

export type EstadoActividad = 'PENDIENTE' | 'EN_PROGRESO' | 'COMPLETADA' | 'PARCIAL' | 'BLOQUEADA' | 'NO_APLICA'

export const ETIQUETA_ESTADO_ACTIVIDAD: Record<EstadoActividad, string> = {
  PENDIENTE: 'Pendiente',
  EN_PROGRESO: 'En progreso',
  COMPLETADA: 'Completada',
  PARCIAL: 'Parcial',
  BLOQUEADA: 'Bloqueada',
  NO_APLICA: 'No aplica',
}

export interface Actividad {
  id: string
  visitaId: string
  dia: number
  orden: number
  actividad: string
  objetivo: string
  tipo: string // p.ej. Formación, Evaluación, Práctica, Ajuste, Prueba
  equipoProceso: string
  evidenciaRequerida: string
  criterioCumplimiento: string
  estado: EstadoActividad
  observacion: string
  emergente: boolean
  creadoEn: string
  actualizadoEn: string
}

export interface CambioHistorial {
  id: string
  visitaId: string
  version: number
  fecha: string // ISO datetime
  cambio: string
  motivo: string
}

export type PrioridadPendiente = 'P1' | 'P2' | 'P3' | 'P4'

export const ETIQUETA_PRIORIDAD: Record<PrioridadPendiente, string> = {
  P1: 'P1 — Crítica',
  P2: 'P2 — Alta',
  P3: 'P3 — Media',
  P4: 'P4 — Baja',
}

export type EstadoPendiente = 'ABIERTO' | 'RESPONSABLE_PENDIENTE' | 'EN_PROCESO' | 'EN_ESPERA' | 'CERRADO' | 'CANCELADO'

export const ETIQUETA_ESTADO_PENDIENTE: Record<EstadoPendiente, string> = {
  ABIERTO: 'Abierto',
  RESPONSABLE_PENDIENTE: 'Responsable pendiente',
  EN_PROCESO: 'En proceso',
  EN_ESPERA: 'En espera',
  CERRADO: 'Cerrado',
  CANCELADO: 'Cancelado',
}

export type CategoriaPendiente =
  | 'Mantenimiento'
  | 'Reparación'
  | 'Repuestos'
  | 'Herramientas'
  | 'Seguridad'
  | 'Calidad'
  | 'Mejora'
  | 'Capacitación'
  | 'Documentación'
  | 'Proceso'
  | 'Otro'

export const RESPONSABLE_POR_DEFECTO = 'POR ASIGNAR'
export const FECHA_POR_DEFECTO = 'POR DEFINIR'

export interface Pendiente {
  id: string
  visitaId: string
  planta: string
  fecha: string // ISO date de creación
  equipo: string
  descripcion: string
  categoria: CategoriaPendiente
  impacto: string
  prioridad: PrioridadPendiente
  accionPropuesta: string
  responsable: string // RESPONSABLE_POR_DEFECTO si falta
  fechaCompromiso: string // FECHA_POR_DEFECTO si falta
  estado: EstadoPendiente
  comentarios: string
  creadoEn: string
  actualizadoEn: string
}

export type EntidadFoto = 'ACTIVIDAD' | 'HALLAZGO' | 'PENDIENTE' | 'EVIDENCIA_CIERRE'

export interface Foto {
  id: string
  visitaId: string
  entidadTipo: EntidadFoto
  entidadId: string
  blob: Blob
  nombreArchivo: string
  creadoEn: string
}
