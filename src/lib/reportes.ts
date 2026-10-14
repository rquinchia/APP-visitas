// Informes de la visita: WhatsApp (texto) y correo (HTML), diario y final.
//
// Estructura común (para que todo sea coherente): encabezado → indicadores → resumen ejecutivo →
// actividades → hallazgos (mejoras implementadas con antes/después, luego hallazgos abiertos con su
// plan de acción) → evidencias → próximo paso → pendientes. Los hallazgos usan el mismo código
// (H-01…) en la app, en WhatsApp y en el correo.
//
// El HTML es compatible con Outlook de escritorio (motor de Word): solo tablas, estilos en línea,
// sin flex ni grid; las imágenes llevan `width` y vienen ya recortadas a 4:3 (ver datosInforme.ts).

import type { Actividad, EstadoActividad, EstadoPendiente, Pendiente, PrioridadPendiente, Visita } from '../types'
import { ETIQUETA_ESTADO_ACTIVIDAD, FECHA_POR_DEFECTO, RESPONSABLE_POR_DEFECTO, TIPOS_VISITA, estaAbierto, estaResuelto } from '../types'
import { calcularAvance, fechaDelDia, type ResumenAvance } from './progreso'
import { codigosHallazgos, estaVencido, hallazgosDelDia, ordenarHallazgos, pendientesAbiertos } from './hallazgos'
import { formatearFecha, hoyLocal, parsearFecha } from './id'
import type { GaleriaInforme, HallazgoInforme } from './datosInforme'

// ───────────────────────────── Contexto (cálculos compartidos) ─────────────────────────────

const ES_EJECUTADA = (a: Actividad) => a.estado === 'COMPLETADA' || a.estado === 'PARCIAL'
const ES_FORMACION = (a: Actividad) => a.tipo.toLowerCase().includes('formaci')
const SIN_DUENO = (p: Pendiente) => p.responsable === RESPONSABLE_POR_DEFECTO || p.fechaCompromiso === FECHA_POR_DEFECTO

interface ContextoBase {
  visita: Visita
  codigos: Map<string, string>
  abiertosVisita: Pendiente[]
  sinDueno: number
  vencidos: number
}

export interface ContextoDiario extends ContextoBase {
  dia: number
  fecha: string
  actsDia: Actividad[]
  avanceDia: ResumenAvance
  avanceTotal: ResumenAvance
  hallazgos: Pendiente[]
  mejoras: Pendiente[]
  abiertosDia: Pendiente[]
  proximo: Actividad[]
  arrastre: Actividad[]
}

export interface ContextoFinal extends ContextoBase {
  actividades: Actividad[]
  avance: ResumenAvance
  hallazgos: Pendiente[]
  mejoras: Pendiente[]
  abiertos: Pendiente[]
  formacion: Actividad[]
  noEjecutadas: Actividad[]
}

function base(visita: Visita, pendientes: Pendiente[]): ContextoBase {
  const abiertosVisita = pendientesAbiertos(pendientes)
  const hoy = hoyLocal()
  return {
    visita,
    codigos: codigosHallazgos(pendientes),
    abiertosVisita,
    sinDueno: abiertosVisita.filter(SIN_DUENO).length,
    vencidos: abiertosVisita.filter((p) => estaVencido(p, hoy)).length,
  }
}

export function contextoDiario(visita: Visita, dia: number, actividades: Actividad[], pendientes: Pendiente[]): ContextoDiario {
  const actsDia = actividades.filter((a) => a.dia === dia).sort((a, b) => a.orden - b.orden)
  const hallazgos = ordenarHallazgos(hallazgosDelDia(visita, dia, actsDia, pendientes))
  return {
    ...base(visita, pendientes),
    dia,
    fecha: fechaDelDia(visita, dia) ?? hoyLocal(),
    actsDia,
    avanceDia: calcularAvance(actsDia),
    avanceTotal: calcularAvance(actividades),
    hallazgos,
    mejoras: hallazgos.filter(estaResuelto),
    abiertosDia: hallazgos.filter(estaAbierto),
    proximo: actividades.filter((a) => a.dia === dia + 1).sort((a, b) => a.orden - b.orden),
    arrastre: actsDia.filter((a) => a.estado === 'PENDIENTE' || a.estado === 'EN_PROGRESO' || a.estado === 'PARCIAL' || a.estado === 'BLOQUEADA'),
  }
}

export function contextoFinal(visita: Visita, actividades: Actividad[], pendientes: Pendiente[]): ContextoFinal {
  const ordenadas = [...actividades].sort((a, b) => a.dia - b.dia || a.orden - b.orden)
  const hallazgos = ordenarHallazgos(pendientes.filter((p) => p.estado !== 'CANCELADO'))
  return {
    ...base(visita, pendientes),
    actividades: ordenadas,
    avance: calcularAvance(ordenadas),
    hallazgos,
    mejoras: hallazgos.filter(estaResuelto),
    abiertos: hallazgos.filter(estaAbierto),
    formacion: ordenadas.filter((a) => ES_FORMACION(a) && ES_EJECUTADA(a)),
    noEjecutadas: ordenadas.filter((a) => a.estado === 'PENDIENTE' || a.estado === 'EN_PROGRESO' || a.estado === 'BLOQUEADA'),
  }
}

// ───────────────────────────── Utilidades de texto ─────────────────────────────

function truncar(texto: string, max: number): string {
  const limpio = texto.replace(/\s+/g, ' ').trim()
  return limpio.length > max ? limpio.slice(0, max - 1).trimEnd() + '…' : limpio
}

/** Fragmento para insertar dentro de una frase: sin punto final (evita "cm….", "mm).)."). */
function fragmento(texto: string, max: number): string {
  return truncar(texto, max).replace(/[.\s]+$/, '')
}

/** Cierra una frase con punto, salvo que ya termine en "…" o ".". */
function cerrar(frase: string): string {
  return /[.…]$/.test(frase) ? frase : frase + '.'
}

function pct(n: number, total: number): number {
  return total === 0 ? 0 : Math.round((n / total) * 100)
}

const DIAS_SEMANA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

function fechaConDia(fecha: string): string {
  return `${DIAS_SEMANA[parsearFecha(fecha).getDay()]} ${formatearFecha(fecha)}`
}

function rangoVisita(visita: Visita): string {
  if (!visita.fechaInicio) return `${visita.duracionDias} días`
  const fin = fechaDelDia(visita, visita.duracionDias)!
  return `${formatearFecha(visita.fechaInicio)} – ${formatearFecha(fin)} · ${visita.duracionDias} días`
}

function nombreTipo(visita: Visita): string {
  return TIPOS_VISITA[visita.tipo].nombre
}

function fechaCompromisoTexto(p: Pendiente): string {
  return p.fechaCompromiso === FECHA_POR_DEFECTO ? FECHA_POR_DEFECTO : formatearFecha(p.fechaCompromiso)
}

// ───────────────────────────── WhatsApp ─────────────────────────────

const EMOJI_PRIORIDAD: Record<PrioridadPendiente, string> = { P1: '🔴', P2: '🟠', P3: '🟡', P4: '⚪' }

const EMOJI_ACTIVIDAD: Record<EstadoActividad, string> = {
  COMPLETADA: '✔️',
  PARCIAL: '◐',
  BLOQUEADA: '⛔',
  EN_PROGRESO: '🔄',
  PENDIENTE: '⏳',
  NO_APLICA: '➖',
}

function barraTexto(porcentaje: number): string {
  const llenos = Math.round(porcentaje / 10)
  return '▰'.repeat(llenos) + '▱'.repeat(10 - llenos)
}

function lineaPendienteWA(p: Pendiente, codigo: string): string[] {
  const vencido = estaVencido(p)
  return [
    `${EMOJI_PRIORIDAD[p.prioridad]} *${codigo}* · ${p.prioridad} · ${truncar(p.descripcion, 110)}`,
    `     ➜ ${p.accionPropuesta ? truncar(p.accionPropuesta, 90) + ' · ' : ''}👤 ${p.responsable} · 📅 ${fechaCompromisoTexto(p)}${vencido ? ' ⚠️ *vencido*' : ''}`,
  ]
}

function lineaMejoraWA(p: Pendiente, codigo: string): string[] {
  return [`✅ *${codigo}* · ${truncar(p.descripcion, 100)}`, `     ✔️ ${p.solucion ? truncar(p.solucion, 120) : 'Resuelto.'}`]
}

function bloqueAlertasWA(ctx: ContextoBase): string[] {
  const alertas: string[] = []
  if (ctx.sinDueno > 0) alertas.push(`⚠️ ${ctx.sinDueno} pendiente(s) sin responsable o fecha compromiso: se solicita asignarlos.`)
  if (ctx.vencidos > 0) alertas.push(`⏰ ${ctx.vencidos} pendiente(s) con fecha compromiso vencida.`)
  return alertas
}

function resumenAbiertosWA(abiertos: Pendiente[]): string {
  if (abiertos.length === 0) return 'Sin pendientes abiertos. 👌'
  const p1 = abiertos.filter((p) => p.prioridad === 'P1').length
  const p2 = abiertos.filter((p) => p.prioridad === 'P2').length
  const partes = [p1 > 0 ? `🔴 ${p1} P1` : '', p2 > 0 ? `🟠 ${p2} P2` : ''].filter(Boolean)
  return `${abiertos.length} abiertos${partes.length ? ` (${partes.join(' · ')})` : ''}`
}

export function generarReporteWhatsApp(ctx: ContextoDiario): string {
  const { visita, dia, actsDia, avanceDia, avanceTotal } = ctx
  const L: string[] = []

  L.push(`📍 *${(visita.planta || 'Planta').toUpperCase()}* · ${nombreTipo(visita)}`)
  L.push(`🗓️ Día ${dia} de ${visita.duracionDias} · ${fechaConDia(ctx.fecha)}`)
  L.push('')
  L.push('📊 *AVANCE*')
  L.push(`Hoy       ${barraTexto(avanceDia.porcentaje)} *${avanceDia.porcentaje}%*`)
  L.push(`Visita    ${barraTexto(avanceTotal.porcentaje)} *${avanceTotal.porcentaje}%*`)

  L.push('')
  const evaluables = actsDia.filter((a) => a.estado !== 'NO_APLICA')
  L.push(`✅ *ACTIVIDADES* (${avanceDia.completadas} de ${evaluables.length} completadas)`)
  if (actsDia.length === 0) L.push('Sin actividades planificadas para este día.')
  for (const a of actsDia) {
    const nota = a.observacion && a.estado !== 'COMPLETADA' ? ` — _${truncar(a.observacion, 90)}_` : ''
    L.push(`${EMOJI_ACTIVIDAD[a.estado]} ${truncar(a.actividad, 90)}${a.estado !== 'COMPLETADA' ? ` (${ETIQUETA_ESTADO_ACTIVIDAD[a.estado].toLowerCase()})` : ''}${nota}`)
  }

  L.push('')
  L.push(`🔎 *HALLAZGOS DEL DÍA* (${ctx.hallazgos.length}${ctx.mejoras.length ? ` · ${ctx.mejoras.length} resuelto${ctx.mejoras.length === 1 ? '' : 's'}` : ''})`)
  if (ctx.hallazgos.length === 0) L.push('Sin hallazgos registrados.')
  for (const p of ctx.mejoras) L.push(...lineaMejoraWA(p, ctx.codigos.get(p.id)!))
  for (const p of ctx.abiertosDia) L.push(...lineaPendienteWA(p, ctx.codigos.get(p.id)!))

  L.push('')
  L.push(`📌 *PENDIENTES DE LA VISITA*: ${resumenAbiertosWA(ctx.abiertosVisita)}`)
  const alertas = bloqueAlertasWA(ctx)
  if (alertas.length) L.push(...alertas)

  L.push('')
  if (dia >= visita.duracionDias) {
    L.push('➡️ *PRÓXIMO PASO*')
    L.push('• Cierre de la visita y envío del informe final.')
  } else {
    L.push(`➡️ *PLAN DÍA ${dia + 1}*`)
    if (ctx.proximo.length === 0 && ctx.arrastre.length === 0) L.push('• Continuar según el plan aprobado.')
    for (const a of ctx.proximo) L.push(`• ${truncar(a.actividad, 90)}`)
    for (const a of ctx.arrastre) L.push(`• ${truncar(a.actividad, 80)} _(continúa del día ${dia})_`)
  }

  L.push('')
  L.push('📧 _El detalle con fotos del antes y después va en el informe por correo._')
  return L.join('\n')
}

export function generarResumenFinalWhatsApp(ctx: ContextoFinal): string {
  const { visita, avance } = ctx
  const L: string[] = []
  const tasa = pct(ctx.mejoras.length, ctx.hallazgos.length)

  L.push('🏁 *INFORME FINAL DE VISITA*')
  L.push(`📍 *${(visita.planta || 'Planta').toUpperCase()}* · ${nombreTipo(visita)}`)
  L.push(`🗓️ ${rangoVisita(visita)}`)
  L.push('')
  L.push('📊 *RESULTADO*')
  L.push(`Avance final ${barraTexto(avance.porcentaje)} *${avance.porcentaje}%*`)
  L.push(`✔️ ${avance.completadas} de ${avance.total} actividades completadas${avance.parciales ? ` (+${avance.parciales} parciales)` : ''}`)
  if (ctx.formacion.length) L.push(`👥 ${ctx.formacion.length} actividad(es) de formación realizadas`)
  L.push(`🔎 ${ctx.hallazgos.length} hallazgos · ✅ ${ctx.mejoras.length} resueltos${ctx.hallazgos.length ? ` (${tasa}%)` : ''}`)

  if (ctx.mejoras.length) {
    L.push('')
    L.push(`🏆 *MEJORAS IMPLEMENTADAS* (${ctx.mejoras.length})`)
    const max = 6
    for (const p of ctx.mejoras.slice(0, max)) L.push(...lineaMejoraWA(p, ctx.codigos.get(p.id)!))
    if (ctx.mejoras.length > max) L.push(`_…y ${ctx.mejoras.length - max} más en el informe por correo._`)
  }

  L.push('')
  L.push(`📌 *PENDIENTES EN SEGUIMIENTO*: ${resumenAbiertosWA(ctx.abiertos)}`)
  const maxP = 8
  for (const p of ctx.abiertos.slice(0, maxP)) L.push(...lineaPendienteWA(p, ctx.codigos.get(p.id)!))
  if (ctx.abiertos.length > maxP) L.push(`_…y ${ctx.abiertos.length - maxP} más en el informe por correo._`)
  const alertas = bloqueAlertasWA(ctx)
  if (alertas.length) L.push('', ...alertas)

  if (ctx.noEjecutadas.length) {
    L.push('')
    L.push(`⏳ *NO EJECUTADAS*: ${ctx.noEjecutadas.length} actividad(es) — detalle en el correo.`)
  }

  L.push('')
  L.push('📧 _Informe final completo, con evidencias del antes y después, enviado por correo._')
  return L.join('\n')
}

// ───────────────────────────── Correo (HTML) — piezas ─────────────────────────────

const C = {
  tinta: '#0f172a',
  texto: '#334155',
  suave: '#64748b',
  tenue: '#94a3b8',
  linea: '#e2e8f0',
  fondo: '#f8fafc',
  azul: '#0369a1',
  azulFondo: '#f0f9ff',
  verde: '#047857',
  verdeFondo: '#ecfdf5',
  verdeLinea: '#a7f3d0',
  ambar: '#b45309',
  ambarFondo: '#fffbeb',
  ambarLinea: '#fde68a',
  rojo: '#be123c',
  rojoFondo: '#fff1f2',
}

const FUENTE = "font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;"
const TABLA = 'role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/** Texto multilínea del usuario → HTML con saltos de línea. */
function escMultilinea(s: string): string {
  return esc(s.trim()).replace(/\n/g, '<br>')
}

function chip(texto: string, fondo: string, color: string): string {
  return `<span style="display:inline-block;background:${fondo};color:${color};font-size:11px;font-weight:700;line-height:16px;padding:2px 8px;border-radius:10px;white-space:nowrap;">${esc(texto)}</span>`
}

const PRIORIDAD_ESTILO: Record<PrioridadPendiente, [string, string, string]> = {
  P1: ['#e11d48', '#ffffff', 'P1 Crítica'],
  P2: ['#f97316', '#ffffff', 'P2 Alta'],
  P3: ['#facc15', '#422006', 'P3 Media'],
  P4: ['#cbd5e1', '#1e293b', 'P4 Baja'],
}

function chipPrioridad(p: PrioridadPendiente): string {
  const [fondo, color, texto] = PRIORIDAD_ESTILO[p]
  return chip(texto, fondo, color)
}

const ESTADO_PENDIENTE_ESTILO: Record<EstadoPendiente, [string, string, string]> = {
  ABIERTO: ['#e0f2fe', '#075985', 'Abierto'],
  RESPONSABLE_PENDIENTE: ['#fef3c7', '#92400e', 'Sin responsable'],
  EN_PROCESO: ['#e0e7ff', '#3730a3', 'En proceso'],
  EN_ESPERA: ['#f1f5f9', '#475569', 'En espera'],
  CERRADO: ['#d1fae5', '#065f46', '✓ Resuelto'],
  CANCELADO: ['#f1f5f9', '#94a3b8', 'Cancelado'],
}

function chipEstadoPendiente(e: EstadoPendiente): string {
  const [fondo, color, texto] = ESTADO_PENDIENTE_ESTILO[e]
  return chip(texto, fondo, color)
}

const ESTADO_ACTIVIDAD_ESTILO: Record<EstadoActividad, [string, string]> = {
  COMPLETADA: ['#d1fae5', '#065f46'],
  PARCIAL: ['#fef3c7', '#92400e'],
  BLOQUEADA: ['#ffe4e6', '#9f1239'],
  EN_PROGRESO: ['#e0f2fe', '#075985'],
  PENDIENTE: ['#f1f5f9', '#475569'],
  NO_APLICA: ['#f1f5f9', '#94a3b8'],
}

function chipEstadoActividad(e: EstadoActividad): string {
  const [fondo, color] = ESTADO_ACTIVIDAD_ESTILO[e]
  return chip(ETIQUETA_ESTADO_ACTIVIDAD[e], fondo, color)
}

function colorAvance(p: number): string {
  return p >= 80 ? C.verde : p >= 50 ? C.azul : C.ambar
}

/** Barra de progreso con celdas de tabla (se ve igual en Outlook de escritorio). */
function barra(porcentaje: number, color: string, alto = 8): string {
  const p = Math.max(0, Math.min(100, Math.round(porcentaje)))
  const celda = (ancho: number, fondo: string) =>
    `<td width="${ancho}%" style="background:${fondo};height:${alto}px;line-height:${alto}px;font-size:1px;">&nbsp;</td>`
  const celdas = p === 0 ? celda(100, C.linea) : p === 100 ? celda(100, color) : celda(p, color) + celda(100 - p, C.linea)
  return `<table ${TABLA} style="border-radius:${alto}px;overflow:hidden;"><tr>${celdas}</tr></table>`
}

function tituloSeccion(numero: number, titulo: string, nota?: string): string {
  return `
<table ${TABLA} style="margin:28px 0 12px;"><tr>
  <td style="border-left:4px solid ${C.azul};padding:1px 0 1px 10px;">
    <p style="margin:0;font-size:15px;font-weight:800;color:${C.tinta};">${numero}. ${esc(titulo)}</p>
    ${nota ? `<p style="margin:2px 0 0;font-size:12px;color:${C.suave};">${esc(nota)}</p>` : ''}
  </td>
</tr></table>`
}

function subtitulo(texto: string, color: string): string {
  return `<p style="margin:16px 0 8px;font-size:12px;font-weight:800;color:${color};text-transform:uppercase;letter-spacing:.06em;">${texto}</p>`
}

function vacio(texto: string): string {
  return `<p style="margin:0;padding:12px 14px;background:${C.fondo};border-radius:10px;font-size:13px;color:${C.suave};">${esc(texto)}</p>`
}

interface Kpi {
  valor: string
  etiqueta: string
  color: string
  detalle?: string
}

function indicadores(items: Kpi[]): string {
  // table-layout:fixed reparte el ancho por igual y evita que la fila se desborde en un teléfono.
  const ancho = Math.floor(100 / items.length)
  const celdas = items
    .map(
      (k) => `
  <td width="${ancho}%" valign="top" style="padding:3px;">
    <table ${TABLA}><tr><td style="background:${C.fondo};border:1px solid ${C.linea};border-radius:12px;padding:12px 4px;text-align:center;">
      <p style="margin:0;font-size:22px;font-weight:800;line-height:1.1;color:${k.color};white-space:nowrap;">${esc(k.valor)}</p>
      <p style="margin:6px 0 0;font-size:10.5px;font-weight:700;line-height:1.25;color:${C.suave};">${esc(k.etiqueta)}</p>
      ${k.detalle ? `<p style="margin:3px 0 0;font-size:10.5px;line-height:1.3;color:${C.tenue};">${esc(k.detalle)}</p>` : ''}
    </td></tr></table>
  </td>`,
    )
    .join('')
  return `<table ${TABLA} style="margin:16px 0 4px;table-layout:fixed;"><tr>${celdas}</tr></table>`
}

/** Las viñetas ya vienen en HTML (con valores escapados), para poder resaltar cifras en negrita. */
function filaResumen(vinetaHtml: string): string {
  return `
    <tr>
      <td valign="top" width="16" style="padding:4px 0;color:${C.azul};font-size:14px;font-weight:800;">›</td>
      <td style="padding:4px 0;font-size:14px;line-height:1.5;color:${C.texto};">${vinetaHtml}</td>
    </tr>`
}

/** Viñeta adicional para el resumen ejecutivo (la usa el asistente); el texto se escapa. */
export function filaResumenTexto(texto: string): string {
  return filaResumen(esc(texto))
}

function resumenEjecutivo(vinetas: string[]): string {
  const filas = vinetas.map(filaResumen).join('')
  return `
<table ${TABLA} style="margin:18px 0 0;"><tr>
  <td style="background:${C.azulFondo};border-left:4px solid ${C.azul};border-radius:0 12px 12px 0;padding:14px 16px;">
    <p style="margin:0 0 6px;font-size:12px;font-weight:800;color:${C.azul};text-transform:uppercase;letter-spacing:.06em;">Resumen ejecutivo</p>
    <table ${TABLA} data-resumen="1">${filas}</table>
  </td>
</tr></table>`
}

function tablaActividades(actividades: Actividad[], conDia: boolean): string {
  if (actividades.length === 0) return vacio('Sin actividades registradas.')
  const filas = actividades
    .map((a, i) => {
      const detalle = a.observacion || a.objetivo
      return `
    <tr>
      <td valign="top" width="26" style="padding:10px 0;border-bottom:1px solid ${C.linea};font-size:12px;font-weight:700;color:${C.tenue};">${conDia ? `D${a.dia}` : i + 1}</td>
      <td valign="top" style="padding:10px 8px 10px 0;border-bottom:1px solid ${C.linea};">
        <p style="margin:0;font-size:13.5px;font-weight:600;color:${a.estado === 'NO_APLICA' ? C.tenue : C.tinta};">${a.emergente ? '⚡ ' : ''}${esc(a.actividad)}</p>
        ${detalle ? `<p style="margin:2px 0 0;font-size:12px;line-height:1.45;color:${C.suave};">${escMultilinea(detalle)}</p>` : ''}
      </td>
      <td valign="top" align="right" width="96" style="padding:10px 0;border-bottom:1px solid ${C.linea};">${chipEstadoActividad(a.estado)}</td>
    </tr>`
    })
    .join('')
  return `<table ${TABLA}>${filas}</table>`
}

const ANCHO_FOTO = 258

function foto(src: string, alt: string): string {
  return `<img src="${src}" alt="${alt}" width="${ANCHO_FOTO}" style="display:block;width:100%;max-width:${ANCHO_FOTO}px;height:auto;border:0;border-radius:8px;" />`
}

function huecoFoto(texto: string, borde: string, color: string): string {
  return `<table ${TABLA}><tr><td height="120" align="center" valign="middle" style="height:120px;border:1px dashed ${borde};border-radius:8px;font-size:12px;color:${color};text-align:center;">${esc(texto)}</td></tr></table>`
}

function columnaFoto(etiqueta: string, color: string, fotos: string[], total: number, hueco: string): string {
  const extra = total > fotos.length ? `<p style="margin:4px 0 0;font-size:11px;color:${C.tenue};">+${total - fotos.length} foto(s) más en la app</p>` : ''
  return `
    <p style="margin:0 0 6px;font-size:11px;font-weight:800;color:${color};letter-spacing:.08em;">${etiqueta}</p>
    ${fotos.length ? fotos.map((f) => foto(f, etiqueta)).join('<div style="height:6px;line-height:6px;font-size:1px;">&nbsp;</div>') : hueco}
    ${extra}`
}

function tarjetaHallazgo(h: HallazgoInforme, conDia: boolean): string {
  const { p } = h
  const resuelto = estaResuelto(p)
  const contexto = [p.equipo, p.categoria !== 'Otro' ? p.categoria : '', h.actividad ? `${conDia ? `Día ${h.actividad.dia} · ` : ''}${h.actividad.actividad}` : '']
    .filter(Boolean)
    .map(esc)
    .join(' · ')

  const hayFotos = h.antes.length > 0 || h.despues.length > 0
  const filaFotos = hayFotos
    ? `
  <tr><td style="padding:2px 14px 12px;">
    <table ${TABLA}><tr>
      <td width="50%" valign="top" style="padding-right:6px;">
        ${columnaFoto('ANTES', C.rojo, h.antes, h.totalAntes, huecoFoto('Sin foto', C.linea, C.tenue))}
      </td>
      <td width="50%" valign="top" style="padding-left:6px;">
        ${columnaFoto('DESPUÉS', C.verde, h.despues, h.totalDespues, huecoFoto(resuelto ? 'Sin foto' : 'Pendiente de solución', resuelto ? C.linea : C.ambarLinea, resuelto ? C.tenue : C.ambar))}
      </td>
    </tr></table>
  </td></tr>`
    : ''

  const vencido = estaVencido(p)
  const pie = resuelto
    ? `
    <table ${TABLA}><tr><td style="background:${C.verdeFondo};border:1px solid ${C.verdeLinea};border-radius:10px;padding:10px 12px;">
      <p style="margin:0;font-size:11px;font-weight:800;color:${C.verde};letter-spacing:.06em;">✓ SOLUCIÓN${p.fechaSolucion ? ` · ${esc(formatearFecha(p.fechaSolucion))}` : ''}</p>
      <p style="margin:4px 0 0;font-size:13px;line-height:1.5;color:${C.tinta};">${p.solucion ? escMultilinea(p.solucion) : 'Resuelto.'}</p>
    </td></tr></table>`
    : `
    <table ${TABLA}><tr><td style="background:${C.ambarFondo};border:1px solid ${C.ambarLinea};border-radius:10px;padding:10px 12px;">
      <p style="margin:0;font-size:11px;font-weight:800;color:${C.ambar};letter-spacing:.06em;">PLAN DE ACCIÓN</p>
      <p style="margin:4px 0 0;font-size:13px;line-height:1.5;color:${C.tinta};">${p.accionPropuesta ? escMultilinea(p.accionPropuesta) : '<span style="color:#94a3b8;">Acción por definir.</span>'}</p>
      ${p.solucion ? `<p style="margin:6px 0 0;font-size:12.5px;line-height:1.45;color:${C.texto};"><strong>Avance:</strong> ${escMultilinea(p.solucion)}</p>` : ''}
      <p style="margin:6px 0 0;font-size:12px;color:${C.texto};">
        <strong>Responsable:</strong> <span style="color:${p.responsable === RESPONSABLE_POR_DEFECTO ? C.rojo : C.texto};">${esc(p.responsable)}</span>
        &nbsp;·&nbsp; <strong>Compromiso:</strong> <span style="color:${vencido || p.fechaCompromiso === FECHA_POR_DEFECTO ? C.rojo : C.texto};">${esc(fechaCompromisoTexto(p))}${vencido ? ' (vencido)' : ''}</span>
      </p>
    </td></tr></table>`

  return `
<table ${TABLA} style="margin:0 0 14px;border:1px solid ${C.linea};border-radius:14px;border-collapse:separate;">
  <tr><td style="padding:12px 14px 10px;">
    <p style="margin:0;">
      <span style="font-size:13px;font-weight:800;color:${C.tinta};">${esc(h.codigo)}</span>&nbsp;&nbsp;${chipPrioridad(p.prioridad)}&nbsp;${chipEstadoPendiente(p.estado)}
    </p>
    <p style="margin:8px 0 0;font-size:14.5px;font-weight:700;line-height:1.4;color:${C.tinta};">${escMultilinea(p.descripcion)}</p>
    ${contexto ? `<p style="margin:3px 0 0;font-size:12px;color:${C.suave};">${contexto}</p>` : ''}
    ${p.impacto ? `<p style="margin:4px 0 0;font-size:12px;color:${C.texto};"><strong>Impacto:</strong> ${esc(p.impacto)}</p>` : ''}
  </td></tr>
  ${filaFotos}
  <tr><td style="padding:0 14px 14px;">${pie}</td></tr>
</table>`
}

function bloqueHallazgos(hallazgos: HallazgoInforme[], conDia: boolean): string {
  const mejoras = hallazgos.filter((h) => estaResuelto(h.p))
  const abiertos = hallazgos.filter((h) => !estaResuelto(h.p))
  let html = ''
  if (mejoras.length) {
    html += subtitulo(`✓ Mejoras implementadas (${mejoras.length})`, C.verde)
    html += mejoras.map((h) => tarjetaHallazgo(h, conDia)).join('')
  }
  if (abiertos.length) {
    html += subtitulo(`● Requieren acción (${abiertos.length})`, C.ambar)
    html += abiertos.map((h) => tarjetaHallazgo(h, conDia)).join('')
  }
  return html
}

function galeria(g: GaleriaInforme): string {
  if (g.fotos.length === 0) return ''
  const filas: string[] = []
  for (let i = 0; i < g.fotos.length; i += 3) {
    const celdas = [0, 1, 2]
      .map((k) => {
        const src = g.fotos[i + k]
        return `<td width="33%" valign="top" style="padding:3px;">${src ? `<img src="${src}" alt="Evidencia" width="176" style="display:block;width:100%;max-width:176px;height:auto;border:0;border-radius:8px;" />` : '&nbsp;'}</td>`
      })
      .join('')
    filas.push(`<tr>${celdas}</tr>`)
  }
  const nota = g.total > g.fotos.length ? `<p style="margin:6px 0 0;font-size:11px;color:${C.tenue};">Mostrando ${g.fotos.length} de ${g.total} fotografías; el resto está disponible en la app.</p>` : ''
  return `<table ${TABLA}>${filas.join('')}</table>${nota}`
}

function listaSimple(items: string[]): string {
  return `<table ${TABLA}>${items
    .map(
      (i) => `<tr><td valign="top" width="16" style="padding:3px 0;color:${C.azul};font-weight:800;">•</td><td style="padding:3px 0;font-size:13.5px;line-height:1.5;color:${C.texto};">${i}</td></tr>`,
    )
    .join('')}</table>`
}

function tablaPendientes(abiertos: Pendiente[], codigos: Map<string, string>): string {
  if (abiertos.length === 0) return vacio('No quedan pendientes abiertos.')
  // Dos columnas (código | detalle) para que se lea igual en Outlook de escritorio y en el teléfono.
  const th = (t: string) =>
    `<td style="padding:8px 10px;background:${C.fondo};border-bottom:1px solid ${C.linea};font-size:10.5px;font-weight:800;color:${C.suave};text-transform:uppercase;letter-spacing:.04em;">${t}</td>`
  const filas = abiertos
    .map((p) => {
      const vencido = estaVencido(p)
      const sinResp = p.responsable === RESPONSABLE_POR_DEFECTO
      const fechaRoja = vencido || p.fechaCompromiso === FECHA_POR_DEFECTO
      return `
    <tr>
      <td valign="top" width="64" style="padding:10px;border-bottom:1px solid ${C.linea};">
        <p style="margin:0 0 4px;font-size:12px;font-weight:800;color:${C.tinta};">${esc(codigos.get(p.id) ?? '')}</p>${chip(p.prioridad, PRIORIDAD_ESTILO[p.prioridad][0], PRIORIDAD_ESTILO[p.prioridad][1])}
      </td>
      <td valign="top" style="padding:10px 10px 10px 0;border-bottom:1px solid ${C.linea};">
        <p style="margin:0;font-size:13px;font-weight:600;line-height:1.4;color:${C.tinta};">${esc(truncar(p.descripcion, 160))}</p>
        ${p.accionPropuesta ? `<p style="margin:3px 0 0;font-size:12px;line-height:1.4;color:${C.suave};">➜ ${esc(truncar(p.accionPropuesta, 140))}</p>` : ''}
        <p style="margin:5px 0 0;font-size:12px;line-height:1.4;color:${C.texto};">
          Responsable: <span style="color:${sinResp ? C.rojo : C.texto};font-weight:${sinResp ? 700 : 600};">${esc(p.responsable)}</span>
          &nbsp;·&nbsp; Compromiso: <span style="color:${fechaRoja ? C.rojo : C.texto};font-weight:${fechaRoja ? 700 : 600};">${esc(fechaCompromisoTexto(p))}${vencido ? ' (vencido)' : ''}</span>
          &nbsp;·&nbsp; <span style="color:${C.suave};">${esc(ESTADO_PENDIENTE_ESTILO[p.estado][2])}</span>
        </p>
      </td>
    </tr>`
    })
    .join('')
  return `<table ${TABLA} style="border:1px solid ${C.linea};border-radius:10px;border-collapse:separate;overflow:hidden;">
    <tr>${th('Código')}${th('Pendiente · responsable · compromiso')}</tr>${filas}
  </table>`
}

function avisos(ctx: ContextoBase): string {
  const textos: string[] = []
  if (ctx.sinDueno > 0) textos.push(`<strong>${ctx.sinDueno}</strong> pendiente(s) sin responsable o fecha compromiso: se solicita asignarlos.`)
  if (ctx.vencidos > 0) textos.push(`<strong>${ctx.vencidos}</strong> pendiente(s) con fecha compromiso vencida.`)
  if (!textos.length) return ''
  return `<table ${TABLA} style="margin:10px 0 0;"><tr><td style="background:${C.rojoFondo};border-radius:10px;padding:10px 12px;font-size:12.5px;line-height:1.5;color:${C.rojo};">⚠ ${textos.join('<br>⚠ ')}</td></tr></table>`
}

function resumenPrioridades(abiertos: Pendiente[]): string {
  const p1 = abiertos.filter((p) => p.prioridad === 'P1').length
  const p2 = abiertos.filter((p) => p.prioridad === 'P2').length
  return abiertos.length === 0 ? 'ninguno' : [`P1: ${p1}`, `P2: ${p2}`].join(' · ')
}

// ───────────────────────────── Correo (HTML) — informes ─────────────────────────────

export interface EncabezadoInforme {
  etiqueta: string
  titulo: string
  detalle: string
  meta: string
}

export interface CuerpoInforme {
  encabezado: EncabezadoInforme
  cuerpoHtml: string
}

function encabezado(visita: Visita, etiqueta: string, meta: string): EncabezadoInforme {
  return {
    etiqueta,
    titulo: visita.planta || 'Planta',
    detalle: `${nombreTipo(visita)}${visita.cliente ? ` · ${visita.cliente}` : ''}`,
    meta: `${meta}${visita.responsable ? ` · Responsable: ${visita.responsable}` : ''}`,
  }
}

export function generarAsuntoDiario(ctx: ContextoDiario): string {
  return `Informe diario · ${ctx.visita.planta || 'Planta'} · Día ${ctx.dia}/${ctx.visita.duracionDias} · Avance ${ctx.avanceDia.porcentaje}% · ${formatearFecha(ctx.fecha)}`
}

export function generarAsuntoInformeFinal(ctx: ContextoFinal): string {
  return `Informe final de visita · ${ctx.visita.planta || 'Planta'} · ${nombreTipo(ctx.visita)} · Avance ${ctx.avance.porcentaje}%`
}

export function generarInformeDiarioHTML(ctx: ContextoDiario, hallazgos: HallazgoInforme[], fotosActividades: GaleriaInforme): CuerpoInforme {
  const { visita, dia, actsDia, avanceDia, avanceTotal } = ctx
  const evaluables = actsDia.filter((a) => a.estado !== 'NO_APLICA')
  const p1Abiertos = ctx.abiertosVisita.filter((p) => p.prioridad === 'P1')

  // Resumen ejecutivo
  const v: string[] = []
  v.push(
    `Avance del día <strong>${avanceDia.porcentaje}%</strong>: ${avanceDia.completadas} de ${evaluables.length} actividades completadas` +
      `${avanceDia.parciales ? `, ${avanceDia.parciales} parcial(es)` : ''}${avanceDia.bloqueadas ? `, <strong style="color:${C.rojo};">${avanceDia.bloqueadas} bloqueada(s)</strong>` : ''}. ` +
      `Avance acumulado de la visita: <strong>${avanceTotal.porcentaje}%</strong>.`,
  )
  if (ctx.hallazgos.length) {
    v.push(
      `Se registraron <strong>${ctx.hallazgos.length}</strong> hallazgo(s); <strong style="color:${C.verde};">${ctx.mejoras.length} resuelto(s)</strong>` +
        `${ctx.abiertosDia.length ? ` y ${ctx.abiertosDia.length} con plan de acción` : ''}.`,
    )
  } else {
    v.push('Sin hallazgos registrados en el día.')
  }
  if (p1Abiertos.length) {
    v.push(
      cerrar(
        `<strong style="color:${C.rojo};">Atención:</strong> ${p1Abiertos.length} hallazgo(s) crítico(s) abierto(s): ` +
          p1Abiertos.slice(0, 3).map((p) => `${esc(ctx.codigos.get(p.id)!)} ${esc(fragmento(p.descripcion, 70))}`).join('; '),
      ),
    )
  }
  const bloqueadas = actsDia.filter((a) => a.estado === 'BLOQUEADA')
  if (bloqueadas.length) {
    v.push(cerrar(`Bloqueos: ${bloqueadas.map((a) => `${esc(fragmento(a.actividad, 90))}${a.observacion ? ` — ${esc(fragmento(a.observacion, 80))}` : ''}`).join('; ')}`))
  }
  v.push(
    dia >= visita.duracionDias
      ? 'Próximo paso: cierre de la visita y entrega del informe final.'
      : `Próximo paso: ${ctx.proximo.length ? `${ctx.proximo.length} actividad(es) planificadas para el día ${dia + 1}` : `continuar según el plan`}${ctx.arrastre.length ? ` + ${ctx.arrastre.length} que continúan de hoy` : ''}.`,
  )

  let n = 0
  let html = indicadores([
    { valor: `${avanceDia.porcentaje}%`, etiqueta: 'Avance del día', color: colorAvance(avanceDia.porcentaje), detalle: `${avanceDia.completadas}/${evaluables.length} completadas` },
    { valor: `${avanceTotal.porcentaje}%`, etiqueta: 'Avance visita', color: colorAvance(avanceTotal.porcentaje), detalle: `Día ${dia} de ${visita.duracionDias}` },
    { valor: String(ctx.hallazgos.length), etiqueta: 'Hallazgos', color: C.tinta, detalle: `${ctx.mejoras.length} resuelto(s)` },
    { valor: String(ctx.abiertosVisita.length), etiqueta: 'Pendientes', color: p1Abiertos.length ? C.rojo : C.tinta, detalle: resumenPrioridades(ctx.abiertosVisita) },
  ])
  html += `<table ${TABLA} style="margin:6px 0 0;"><tr><td style="padding:0 4px;">${barra(avanceTotal.porcentaje, colorAvance(avanceTotal.porcentaje), 6)}</td></tr></table>`
  html += resumenEjecutivo(v)

  html += tituloSeccion(++n, 'Actividades del día')
  html += tablaActividades(actsDia, false)

  html += tituloSeccion(++n, 'Hallazgos y mejoras', 'Cada hallazgo con su evidencia del antes y el después.')
  html += hallazgos.length ? bloqueHallazgos(hallazgos, false) : vacio('Sin hallazgos registrados en el día.')

  if (fotosActividades.fotos.length) {
    html += tituloSeccion(++n, 'Evidencias de las actividades')
    html += galeria(fotosActividades)
  }

  html += tituloSeccion(++n, dia >= visita.duracionDias ? 'Próximo paso' : `Plan para el día ${dia + 1}`)
  if (dia >= visita.duracionDias) {
    html += listaSimple(['Cierre de la visita y envío del informe final consolidado.'])
  } else {
    const items = [
      ...ctx.proximo.map((a) => `${a.emergente ? '⚡ ' : ''}${esc(a.actividad)}`),
      ...ctx.arrastre.map((a) => `${esc(a.actividad)} <span style="color:${C.tenue};">(continúa del día ${dia})</span>`),
    ]
    html += items.length ? listaSimple(items) : vacio('Continuar según el plan aprobado.')
  }

  html += tituloSeccion(++n, 'Pendientes abiertos de la visita', 'Ordenados por prioridad.')
  html += tablaPendientes(ctx.abiertosVisita, ctx.codigos)
  html += avisos(ctx)

  return {
    encabezado: encabezado(visita, 'Informe diario · Visita técnica', `Día ${dia} de ${visita.duracionDias} · ${fechaConDia(ctx.fecha)}`),
    cuerpoHtml: html,
  }
}

function tablaAvancePorDia(visita: Visita, actividades: Actividad[]): string {
  const filas: string[] = []
  for (let d = 1; d <= visita.duracionDias; d++) {
    const delDia = actividades.filter((a) => a.dia === d)
    if (delDia.length === 0) continue
    const av = calcularAvance(delDia)
    const fecha = fechaDelDia(visita, d)
    filas.push(`
    <tr>
      <td width="70" style="padding:6px 0;border-bottom:1px solid ${C.linea};font-size:12.5px;font-weight:700;color:${C.tinta};">Día ${d}${fecha ? `<br><span style="font-size:11px;font-weight:400;color:${C.tenue};">${esc(formatearFecha(fecha))}</span>` : ''}</td>
      <td width="64" style="padding:6px 0;border-bottom:1px solid ${C.linea};font-size:12px;color:${C.suave};">${av.completadas}/${av.total}</td>
      <td style="padding:6px 8px;border-bottom:1px solid ${C.linea};">${barra(av.porcentaje, colorAvance(av.porcentaje))}</td>
      <td width="44" align="right" style="padding:6px 0;border-bottom:1px solid ${C.linea};font-size:12.5px;font-weight:800;color:${colorAvance(av.porcentaje)};">${av.porcentaje}%</td>
    </tr>`)
  }
  return filas.length ? `<table ${TABLA}>${filas.join('')}</table>` : vacio('Sin actividades planificadas.')
}

export function generarInformeFinalHTML(ctx: ContextoFinal, hallazgos: HallazgoInforme[], fotosActividades: GaleriaInforme): CuerpoInforme {
  const { visita, avance } = ctx
  const tasa = pct(ctx.mejoras.length, ctx.hallazgos.length)
  const p1Abiertos = ctx.abiertos.filter((p) => p.prioridad === 'P1')

  const v: string[] = []
  v.push(
    `La visita cerró con un avance de <strong>${avance.porcentaje}%</strong>: ${avance.completadas} de ${avance.total} actividades completadas` +
      `${avance.parciales ? `, ${avance.parciales} parcial(es)` : ''}${ctx.noEjecutadas.length ? `, <strong style="color:${C.ambar};">${ctx.noEjecutadas.length} sin ejecutar</strong>` : ''}.`,
  )
  if (ctx.formacion.length) v.push(`Formación: <strong>${ctx.formacion.length}</strong> actividad(es) de formación realizadas.`)
  v.push(
    ctx.hallazgos.length
      ? `Se identificaron <strong>${ctx.hallazgos.length}</strong> hallazgo(s), de los cuales <strong style="color:${C.verde};">${ctx.mejoras.length} quedaron resueltos</strong> durante la visita (tasa de cierre ${tasa}%).`
      : 'No se registraron hallazgos durante la visita.',
  )
  if (ctx.abiertos.length) {
    v.push(
      cerrar(
        `Quedan <strong>${ctx.abiertos.length}</strong> pendiente(s) en seguimiento post-visita (${resumenPrioridades(ctx.abiertos)})` +
          `${p1Abiertos.length ? `; los críticos: ${p1Abiertos.slice(0, 3).map((p) => `${esc(ctx.codigos.get(p.id)!)} ${esc(fragmento(p.descripcion, 60))}`).join('; ')}` : ''}`,
      ),
    )
  } else {
    v.push('<strong style="color:#047857;">No quedan pendientes abiertos.</strong>')
  }

  let n = 0
  let html = indicadores([
    { valor: `${avance.porcentaje}%`, etiqueta: 'Avance final', color: colorAvance(avance.porcentaje), detalle: `${visita.duracionDias} días` },
    { valor: `${avance.completadas}/${avance.total}`, etiqueta: 'Actividades', color: C.tinta, detalle: 'completadas' },
    { valor: String(ctx.mejoras.length), etiqueta: 'Mejoras', color: C.verde, detalle: `de ${ctx.hallazgos.length} hallazgos (${tasa}%)` },
    { valor: String(ctx.abiertos.length), etiqueta: 'Pendientes', color: p1Abiertos.length ? C.rojo : C.tinta, detalle: resumenPrioridades(ctx.abiertos) },
  ])
  html += `<table ${TABLA} style="margin:6px 0 0;"><tr><td style="padding:0 4px;">${barra(avance.porcentaje, colorAvance(avance.porcentaje), 6)}</td></tr></table>`
  html += resumenEjecutivo(v)

  html += tituloSeccion(++n, 'Avance por día')
  html += tablaAvancePorDia(visita, ctx.actividades)

  html += tituloSeccion(++n, 'Hallazgos y mejoras', 'Mejoras implementadas (antes → después) y hallazgos que requieren acción.')
  html += hallazgos.length ? bloqueHallazgos(hallazgos, true) : vacio('No se registraron hallazgos durante la visita.')

  if (ctx.formacion.length) {
    html += tituloSeccion(++n, 'Formación realizada')
    html += tablaActividades(ctx.formacion, true)
  }

  if (ctx.noEjecutadas.length) {
    html += tituloSeccion(++n, 'Actividades no ejecutadas', 'Quedaron pendientes o bloqueadas al cierre.')
    html += tablaActividades(ctx.noEjecutadas, true)
  }

  if (fotosActividades.fotos.length) {
    html += tituloSeccion(++n, 'Evidencias de las actividades')
    html += galeria(fotosActividades)
  }

  html += tituloSeccion(++n, 'Pendientes en seguimiento', 'No se cierran con la visita: pasan a seguimiento post-visita.')
  html += tablaPendientes(ctx.abiertos, ctx.codigos)
  html += avisos(ctx)

  return {
    encabezado: encabezado(visita, 'Informe final · Visita técnica', rangoVisita(visita)),
    cuerpoHtml: html,
  }
}

/** Envuelve un cuerpo (generado o ya editado por el usuario) con el encabezado y pie del correo. */
export function envolverInformeHTML(e: EncabezadoInforme, cuerpoHtml: string): string {
  return `<!doctype html>
<html>
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:0;background:#e2e8f0;">
    <table ${TABLA} style="background:#e2e8f0;${FUENTE}"><tr><td align="center" style="padding:20px 8px;">
      <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:640px;background:#ffffff;border-radius:16px;overflow:hidden;${FUENTE}">
        <tr>
          <td bgcolor="#0f172a" style="background:#0f172a;background-image:linear-gradient(135deg,#0f172a 0%,#0c4a6e 60%,#0369a1 100%);padding:26px 24px 22px;">
            <p style="margin:0;color:#7dd3fc;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;">${esc(e.etiqueta)}</p>
            <p style="margin:8px 0 0;color:#ffffff;font-size:26px;font-weight:800;line-height:1.15;">${esc(e.titulo)}</p>
            <p style="margin:6px 0 0;color:#e0f2fe;font-size:14px;">${esc(e.detalle)}</p>
            <p style="margin:4px 0 0;color:#93c5fd;font-size:12.5px;">${esc(e.meta)}</p>
          </td>
        </tr>
        <tr><td height="4" bgcolor="#38bdf8" style="height:4px;line-height:4px;font-size:1px;background:#38bdf8;">&nbsp;</td></tr>
        <tr><td style="padding:8px 20px 8px;">${cuerpoHtml}</td></tr>
        <tr>
          <td style="padding:22px 24px 24px;border-top:1px solid ${C.linea};">
            <p style="margin:0;color:${C.tenue};font-size:11px;line-height:1.5;text-align:center;">
              Informe generado el ${esc(formatearFecha(hoyLocal()))} con la app Visitas Técnicas.<br>
              Las fotografías son miniaturas; los originales están disponibles en la app.
            </p>
          </td>
        </tr>
      </table>
    </td></tr></table>
  </body>
</html>`
}

/**
 * Copia texto enriquecido (HTML) al portapapeles junto con su versión de texto plano como
 * respaldo, para que al pegar en Outlook se vea formateado y, si el destino no admite HTML,
 * caiga al texto plano. Si el navegador no admite copiar HTML, copia solo el texto plano.
 */
export async function copiarHtmlYTexto(html: string, textoPlano: string): Promise<boolean> {
  try {
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      const item = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([textoPlano], { type: 'text/plain' }),
      })
      await navigator.clipboard.write([item])
      return true
    }
  } catch {
    // continúa al respaldo de texto plano
  }
  try {
    await navigator.clipboard.writeText(textoPlano)
    return true
  } catch {
    return false
  }
}
