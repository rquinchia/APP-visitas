export function generarId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function ahoraISO(): string {
  return new Date().toISOString()
}

/** Fecha local del dispositivo (YYYY-MM-DD). No usar toISOString().slice(0, 10): eso es UTC y en
 * Colombia (UTC-5) después de las 7 p. m. devolvería la fecha de mañana. */
export function hoyLocal(): string {
  return fechaLocal(new Date())
}

export function fechaLocal(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

/** Interpreta "YYYY-MM-DD" como fecha local (new Date("YYYY-MM-DD") la toma como UTC y corre un día). */
export function parsearFecha(fecha: string): Date {
  const [a, m, d] = fecha.split('-').map(Number)
  return new Date(a, (m || 1) - 1, d || 1)
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** "13 oct 2026" */
export function formatearFecha(fecha: string): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(fecha)) return fecha
  const d = parsearFecha(fecha.slice(0, 10))
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`
}
