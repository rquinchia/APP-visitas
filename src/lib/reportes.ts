import type { Actividad, Foto, Pendiente, PrioridadPendiente, Visita } from '../types'
import { FECHA_POR_DEFECTO, RESPONSABLE_POR_DEFECTO } from '../types'
import { calcularAvance } from './progreso'

function abiertos(pendientes: Pendiente[]) {
  return pendientes.filter((p) => p.estado !== 'CERRADO' && p.estado !== 'CANCELADO')
}

function truncar(texto: string, max: number): string {
  return texto.length > max ? texto.slice(0, max - 1).trimEnd() + '…' : texto
}

// --- Constructor de informes HTML (Outlook) con estándar visual consistente ---

function escaparHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const COLOR_PRIORIDAD: Record<PrioridadPendiente, string> = {
  P1: '#e11d48',
  P2: '#f97316',
  P3: '#eab308',
  P4: '#94a3b8',
}

function listaHtml(items: string[], vacio: string): string {
  if (items.length === 0) {
    return `<p style="margin:0;color:#64748b;">${escaparHtml(vacio)}</p>`
  }
  return `<ul style="margin:0;padding-left:18px;">${items
    .map((i) => `<li style="margin-bottom:4px;">${escaparHtml(i)}</li>`)
    .join('')}</ul>`
}

function tablaPendientesHtml(pendientes: Pendiente[]): string {
  if (pendientes.length === 0) return ''
  const filas = pendientes
    .map(
      (p) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#64748b;">${escaparHtml(p.id.slice(0, 8))}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;">
          <span style="display:inline-block;background:${COLOR_PRIORIDAD[p.prioridad]};color:#ffffff;font-size:11px;font-weight:700;padding:2px 8px;border-radius:9999px;">${p.prioridad}</span>
        </td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#1e293b;">${escaparHtml(p.descripcion)}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#334155;">${escaparHtml(p.responsable)}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#334155;">${escaparHtml(p.fechaCompromiso)}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#334155;">${escaparHtml(p.estado)}</td>
      </tr>`,
    )
    .join('')

  return `
    <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#0284c7;text-transform:uppercase;letter-spacing:.04em;">📌 Pendientes</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-family:inherit;">
      <thead>
        <tr style="background:#f1f5f9;">
          <th style="padding:8px;text-align:left;font-size:11px;color:#64748b;">ID</th>
          <th style="padding:8px;text-align:left;font-size:11px;color:#64748b;">Prioridad</th>
          <th style="padding:8px;text-align:left;font-size:11px;color:#64748b;">Pendiente</th>
          <th style="padding:8px;text-align:left;font-size:11px;color:#64748b;">Responsable</th>
          <th style="padding:8px;text-align:left;font-size:11px;color:#64748b;">Fecha</th>
          <th style="padding:8px;text-align:left;font-size:11px;color:#64748b;">Estado</th>
        </tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>`
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

interface SeccionInforme {
  icono: string
  titulo: string
  contenidoHtml: string
}

/** Cuadrícula de miniaturas de evidencia fotográfica, ya reducidas a base64 (ver lib/imagenes.ts). */
function seccionEvidenciasHtml(fotosBase64: string[], totalReal: number): string {
  if (fotosBase64.length === 0) {
    return totalReal > 0
      ? `<p style="margin:0;">${totalReal} fotografía(s) registradas (no se incluyeron en esta vista).</p>`
      : `<p style="margin:0;color:#64748b;">Sin fotografías registradas.</p>`
  }
  const imgs = fotosBase64
    .map(
      (src) =>
        `<img src="${src}" style="width:31%;margin:0 3% 8px 0;border-radius:8px;object-fit:cover;aspect-ratio:1/1;vertical-align:top;" />`,
    )
    .join('')
  const nota =
    totalReal > fotosBase64.length
      ? `<p style="margin:6px 0 0;color:#64748b;font-size:12px;">Mostrando ${fotosBase64.length} de ${totalReal} fotografías registradas.</p>`
      : ''
  return `<div>${imgs}</div>${nota}`
}

/** Solo el contenido del informe (secciones + tabla), sin el marco de correo. Es lo que se muestra editable en pantalla. */
function construirCuerpoHTML(secciones: SeccionInforme[], tablaPendientesHtml?: string): string {
  const bloques = secciones
    .map(
      (s) => `
      <div style="padding:12px 0;">
        <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#0284c7;text-transform:uppercase;letter-spacing:.04em;">${s.icono} ${escaparHtml(s.titulo)}</p>
        <div style="font-size:14px;line-height:1.55;color:#1e293b;">${s.contenidoHtml}</div>
      </div>`,
    )
    .join('')
  return `${bloques}${tablaPendientesHtml ? `<div style="padding:12px 0;">${tablaPendientesHtml}</div>` : ''}`
}

/** Envuelve un cuerpo (generado o ya editado por el usuario) con el encabezado y pie de un correo. */
export function envolverInformeHTML(planta: string, subtitulo: string, cuerpoHtml: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#e2e8f0;padding:20px 0;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;">
      <tr>
        <td style="background:#0f172a;background:linear-gradient(135deg,#0f172a,#0369a1);padding:24px 20px;">
          <p style="margin:0;color:#7dd3fc;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;">Informe de visita técnica</p>
          <p style="margin:6px 0 0;color:#ffffff;font-size:22px;font-weight:700;">${escaparHtml(planta)}</p>
          <p style="margin:4px 0 0;color:#bae6fd;font-size:13px;">${escaparHtml(subtitulo)}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 20px;">${cuerpoHtml}</td>
      </tr>
      <tr>
        <td style="padding:18px 20px;text-align:center;">
          <p style="margin:0;color:#94a3b8;font-size:11px;">Generado con la app de Visitas Técnicas</p>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

// --- WhatsApp: reporte visual, ejecutivo y compacto ---

export function generarReporteWhatsApp(visita: Visita, actividadesDia: Actividad[], todasPendientes: Pendiente[], dia: number): string {
  const avance = calcularAvance(actividadesDia)
  const abiertosVisita = abiertos(todasPendientes)
  const hoy = new Date().toISOString().slice(0, 10)

  const ejecutadas = actividadesDia.filter((a) => a.estado === 'COMPLETADA' || a.estado === 'PARCIAL')
  const ejecutadoTexto =
    ejecutadas.length === 0
      ? 'Sin actividades cerradas todavía hoy.'
      : truncar(ejecutadas.map((a) => a.actividad).join(', '), 220)

  const formacion = actividadesDia.filter((a) => a.tipo.toLowerCase().includes('formaci'))
  const formacionTexto = formacion.length === 0 ? 'Sin formación registrada hoy.' : truncar(formacion.map((a) => a.actividad).join(', '), 160)

  const hallazgosHoy = todasPendientes.filter((p) => p.fecha === hoy)
  const hallazgosRelevantes = hallazgosHoy.filter((p) => p.prioridad === 'P1' || p.prioridad === 'P2')
  const hallazgosMostrar = hallazgosRelevantes.length > 0 ? hallazgosRelevantes : hallazgosHoy
  const hallazgosTexto =
    hallazgosMostrar.length === 0 ? 'Sin hallazgos relevantes hoy.' : truncar(hallazgosMostrar.map((p) => `${p.prioridad} ${p.descripcion}`).join(' · '), 220)

  const pendientesTexto =
    abiertosVisita.length === 0
      ? 'Sin pendientes abiertos.'
      : `${abiertosVisita.length} abiertos (P1: ${abiertosVisita.filter((p) => p.prioridad === 'P1').length}, P2: ${abiertosVisita.filter((p) => p.prioridad === 'P2').length})`

  const siguiente = actividadesDia.find((a) => a.estado === 'PENDIENTE' || a.estado === 'EN_PROGRESO')
  const siguienteTexto = siguiente ? siguiente.actividad : 'Continuar según plan del siguiente día.'

  const sinDueño = abiertosVisita.some((p) => p.responsable === RESPONSABLE_POR_DEFECTO || p.fechaCompromiso === FECHA_POR_DEFECTO)

  const lineas = [
    `📍 *${visita.planta || 'Planta'}* | Día ${dia}/${visita.duracionDias}`,
    `📊 Avance: *${avance.porcentaje}%*`,
    '',
    '*✅ EJECUTADO*',
    ejecutadoTexto,
    '',
    '*👥 FORMACIÓN*',
    formacionTexto,
    '',
    '*🔎 HALLAZGOS*',
    hallazgosTexto,
    '',
    '*📌 PENDIENTES*',
    pendientesTexto,
    '',
    '*➡️ SIGUIENTE PASO*',
    siguienteTexto,
  ]

  if (sinDueño) {
    lineas.push('', '⚠️ Se solicita asignar responsable y fecha compromiso a los pendientes indicados.')
  }

  lineas.push('', '📧 El detalle ampliado y las evidencias se incluyen en el informe enviado por correo.')

  return lineas.join('\n')
}

// --- Outlook: informe diario más detallado y profesional ---

export function generarAsuntoOutlook(visita: Visita, actividadesDia: Actividad[], dia: number): string {
  const avance = calcularAvance(actividadesDia)
  return `${visita.planta || 'Planta'} | Día ${dia}/${visita.duracionDias} | Avance ${avance.porcentaje}% | Informe visita técnica`
}

export interface CuerpoInforme {
  subtitulo: string
  cuerpoHtml: string
}

export function generarInformeDiarioOutlookHTML(
  visita: Visita,
  actividadesDia: Actividad[],
  todasPendientes: Pendiente[],
  dia: number,
  fotosBase64: string[] = [],
  totalFotos = 0,
): CuerpoInforme {
  const avance = calcularAvance(actividadesDia)
  const abiertosVisita = abiertos(todasPendientes)
  const hoy = new Date().toISOString().slice(0, 10)

  const ejecutadas = actividadesDia.filter((a) => a.estado === 'COMPLETADA' || a.estado === 'PARCIAL')
  const formacion = actividadesDia.filter((a) => a.tipo.toLowerCase().includes('formaci'))
  const hallazgosHoy = todasPendientes.filter((p) => p.fecha === hoy)
  const siguienteDia = actividadesDia.filter((a) => a.estado === 'PENDIENTE' || a.estado === 'EN_PROGRESO')

  const secciones: SeccionInforme[] = [
    { icono: '🎯', titulo: 'Objetivo', contenidoHtml: `<p style="margin:0;">${escaparHtml(visita.objetivo)}</p>` },
    {
      icono: '✅',
      titulo: 'Actividades ejecutadas',
      contenidoHtml: listaHtml(
        ejecutadas.map((a) => `${a.actividad}${a.observacion ? ` — ${a.observacion}` : ''}`),
        'Sin actividades cerradas en el día.',
      ),
    },
    {
      icono: '👥',
      titulo: 'Formación',
      contenidoHtml: listaHtml(
        formacion.map((a) => `${a.actividad}${a.observacion ? ` — ${a.observacion}` : ''}`),
        'Sin formación registrada en el día.',
      ),
    },
    {
      icono: '📊',
      titulo: 'Resultados',
      contenidoHtml: `<p style="margin:0;">Avance del día: <strong>${avance.porcentaje}%</strong> (${avance.completadas} completadas, ${avance.parciales} parciales, ${avance.bloqueadas} bloqueadas)</p>`,
    },
    {
      icono: '🔎',
      titulo: 'Hallazgos',
      contenidoHtml: listaHtml(
        hallazgosHoy.map((p) => `[${p.prioridad}] ${p.descripcion}`),
        'Sin hallazgos nuevos en el día.',
      ),
    },
    {
      icono: '🛠️',
      titulo: 'Acciones',
      contenidoHtml: listaHtml(
        hallazgosHoy.map((p) => p.accionPropuesta || 'Por definir'),
        'N/A',
      ),
    },
    {
      icono: '➡️',
      titulo: 'Plan siguiente día',
      contenidoHtml: listaHtml(
        siguienteDia.map((a) => a.actividad),
        'Continuar según el plan aprobado.',
      ),
    },
    {
      icono: '📷',
      titulo: 'Evidencias',
      contenidoHtml: seccionEvidenciasHtml(fotosBase64, totalFotos),
    },
  ]

  return {
    subtitulo: `Día ${dia}/${visita.duracionDias} · Avance ${avance.porcentaje}%`,
    cuerpoHtml: construirCuerpoHTML(secciones, tablaPendientesHtml(abiertosVisita)),
  }
}

export function generarReporteOutlook(visita: Visita, actividadesDia: Actividad[], todasPendientes: Pendiente[]): string {
  const avance = calcularAvance(actividadesDia)
  const abiertosVisita = abiertos(todasPendientes)

  const ejecutadas = actividadesDia.filter((a) => a.estado === 'COMPLETADA' || a.estado === 'PARCIAL')
  const formacion = actividadesDia.filter((a) => a.tipo.toLowerCase().includes('formaci'))
  const hallazgosHoy = todasPendientes.filter((p) => p.fecha === new Date().toISOString().slice(0, 10))
  const siguienteDia = actividadesDia.filter((a) => a.estado === 'PENDIENTE' || a.estado === 'EN_PROGRESO')

  const lineas: string[] = []
  lineas.push('Objetivo', visita.objetivo, '')

  lineas.push('Actividades ejecutadas')
  if (ejecutadas.length === 0) lineas.push('- Sin actividades cerradas en el día.')
  else ejecutadas.forEach((a) => lineas.push(`- ${a.actividad}${a.observacion ? ` — ${a.observacion}` : ''}`))
  lineas.push('')

  lineas.push('Formación')
  if (formacion.length === 0) lineas.push('- Sin formación registrada en el día.')
  else formacion.forEach((a) => lineas.push(`- ${a.actividad}${a.observacion ? ` — ${a.observacion}` : ''}`))
  lineas.push('')

  lineas.push('Resultados')
  lineas.push(`- Avance del día: ${avance.porcentaje}% (${avance.completadas} completadas, ${avance.parciales} parciales, ${avance.bloqueadas} bloqueadas)`)
  lineas.push('')

  lineas.push('Hallazgos')
  if (hallazgosHoy.length === 0) lineas.push('- Sin hallazgos nuevos en el día.')
  else hallazgosHoy.forEach((p) => lineas.push(`- [${p.prioridad}] ${p.descripcion}`))
  lineas.push('')

  lineas.push('Acciones')
  if (hallazgosHoy.length === 0) lineas.push('- N/A')
  else hallazgosHoy.forEach((p) => lineas.push(`- ${p.accionPropuesta || 'Por definir'}`))
  lineas.push('')

  lineas.push('Pendientes')
  lineas.push(abiertosVisita.length === 0 ? '- Sin pendientes abiertos.' : `- ${abiertosVisita.length} pendientes abiertos en total (ver tabla al final).`)
  lineas.push('')

  lineas.push('Plan siguiente día')
  if (siguienteDia.length === 0) lineas.push('- Continuar según el plan aprobado.')
  else siguienteDia.forEach((a) => lineas.push(`- ${a.actividad}`))
  lineas.push('')

  lineas.push('Evidencias')
  lineas.push('- Fotografías registradas en la aplicación (adjuntar o exportar según corresponda).')
  lineas.push('')

  if (abiertosVisita.length > 0) {
    lineas.push('ID | Prioridad | Pendiente | Responsable | Fecha | Estado')
    abiertosVisita.forEach((p) => {
      lineas.push(`${p.id.slice(0, 8)} | ${p.prioridad} | ${p.descripcion} | ${p.responsable} | ${p.fechaCompromiso} | ${p.estado}`)
    })
  }

  return lineas.join('\n')
}

// --- Cierre de visita: informes consolidados de toda la visita (todos los días) ---

export function generarAsuntoInformeFinal(visita: Visita, todasActividades: Actividad[]): string {
  const avance = calcularAvance(todasActividades)
  return `${visita.planta || 'Planta'} | Informe final de visita | Avance ${avance.porcentaje}%`
}

export function generarInformeFinalOutlook(
  visita: Visita,
  todasActividades: Actividad[],
  todasPendientes: Pendiente[],
  fotos: Foto[],
): string {
  const avance = calcularAvance(todasActividades)
  const ejecutadas = todasActividades.filter((a) => a.estado === 'COMPLETADA' || a.estado === 'PARCIAL')
  const noEjecutadas = todasActividades.filter((a) => a.estado === 'PENDIENTE' || a.estado === 'EN_PROGRESO' || a.estado === 'BLOQUEADA')
  const formacion = todasActividades.filter((a) => a.tipo.toLowerCase().includes('formaci'))
  const abiertosVisita = abiertos(todasPendientes)
  const cerrados = todasPendientes.filter((p) => p.estado === 'CERRADO' || p.estado === 'CANCELADO')

  const lineas: string[] = []
  lineas.push('Objetivo', visita.objetivo, '')

  lineas.push('Resultado general')
  lineas.push(
    `- Avance final: ${avance.porcentaje}% (${avance.completadas} completadas, ${avance.parciales} parciales, ${avance.pendientes} pendientes, ${avance.bloqueadas} bloqueadas)`,
  )
  lineas.push('')

  lineas.push('Actividades ejecutadas')
  if (ejecutadas.length === 0) lineas.push('- Ninguna actividad quedó completada o parcial.')
  else ejecutadas.forEach((a) => lineas.push(`- Día ${a.dia}: ${a.actividad}${a.observacion ? ` — ${a.observacion}` : ''}`))
  lineas.push('')

  if (noEjecutadas.length > 0) {
    lineas.push('Actividades no ejecutadas / bloqueadas')
    noEjecutadas.forEach((a) => lineas.push(`- Día ${a.dia}: ${a.actividad} (${a.estado})`))
    lineas.push('')
  }

  lineas.push('Formación realizada')
  if (formacion.length === 0) lineas.push('- Sin actividades de formación registradas.')
  else formacion.forEach((a) => lineas.push(`- Día ${a.dia}: ${a.actividad}${a.observacion ? ` — ${a.observacion}` : ''}`))
  lineas.push('')

  lineas.push('Hallazgos y acciones')
  lineas.push(`- Cerrados/cancelados: ${cerrados.length}`)
  lineas.push(`- Abiertos (pasan a seguimiento post-visita): ${abiertosVisita.length}`)
  lineas.push('')

  lineas.push('Evidencias')
  lineas.push(`- ${fotos.length} fotografías registradas durante la visita.`)
  lineas.push('')

  lineas.push('Pendientes en seguimiento')
  if (abiertosVisita.length === 0) lineas.push('- No quedan pendientes abiertos.')
  else {
    lineas.push('ID | Prioridad | Pendiente | Responsable | Fecha | Estado')
    abiertosVisita.forEach((p) => {
      lineas.push(`${p.id.slice(0, 8)} | ${p.prioridad} | ${p.descripcion} | ${p.responsable} | ${p.fechaCompromiso} | ${p.estado}`)
    })
  }

  return lineas.join('\n')
}

export function generarInformeFinalOutlookHTML(
  visita: Visita,
  todasActividades: Actividad[],
  todasPendientes: Pendiente[],
  fotosBase64: string[] = [],
  totalFotos = 0,
): CuerpoInforme {
  const avance = calcularAvance(todasActividades)
  const ejecutadas = todasActividades.filter((a) => a.estado === 'COMPLETADA' || a.estado === 'PARCIAL')
  const noEjecutadas = todasActividades.filter((a) => a.estado === 'PENDIENTE' || a.estado === 'EN_PROGRESO' || a.estado === 'BLOQUEADA')
  const formacion = todasActividades.filter((a) => a.tipo.toLowerCase().includes('formaci'))
  const abiertosVisita = abiertos(todasPendientes)
  const cerrados = todasPendientes.filter((p) => p.estado === 'CERRADO' || p.estado === 'CANCELADO')

  const secciones: SeccionInforme[] = [
    { icono: '🎯', titulo: 'Objetivo', contenidoHtml: `<p style="margin:0;">${escaparHtml(visita.objetivo)}</p>` },
    {
      icono: '📊',
      titulo: 'Resultado general',
      contenidoHtml: `<p style="margin:0;">Avance final: <strong>${avance.porcentaje}%</strong> (${avance.completadas} completadas, ${avance.parciales} parciales, ${avance.pendientes} pendientes, ${avance.bloqueadas} bloqueadas)</p>`,
    },
    {
      icono: '✅',
      titulo: 'Actividades ejecutadas',
      contenidoHtml: listaHtml(
        ejecutadas.map((a) => `Día ${a.dia}: ${a.actividad}${a.observacion ? ` — ${a.observacion}` : ''}`),
        'Ninguna actividad quedó completada o parcial.',
      ),
    },
  ]

  if (noEjecutadas.length > 0) {
    secciones.push({
      icono: '⚠️',
      titulo: 'No ejecutadas / bloqueadas',
      contenidoHtml: listaHtml(
        noEjecutadas.map((a) => `Día ${a.dia}: ${a.actividad} (${a.estado})`),
        '',
      ),
    })
  }

  secciones.push(
    {
      icono: '👥',
      titulo: 'Formación realizada',
      contenidoHtml: listaHtml(
        formacion.map((a) => `Día ${a.dia}: ${a.actividad}${a.observacion ? ` — ${a.observacion}` : ''}`),
        'Sin actividades de formación registradas.',
      ),
    },
    {
      icono: '🔎',
      titulo: 'Hallazgos y acciones',
      contenidoHtml: `<p style="margin:0;">Cerrados/cancelados: <strong>${cerrados.length}</strong> · Abiertos (pasan a seguimiento post-visita): <strong>${abiertosVisita.length}</strong></p>`,
    },
    {
      icono: '📷',
      titulo: 'Evidencias',
      contenidoHtml: seccionEvidenciasHtml(fotosBase64, totalFotos),
    },
  )

  return {
    subtitulo: `Informe final de visita · Avance ${avance.porcentaje}%`,
    cuerpoHtml: construirCuerpoHTML(secciones, tablaPendientesHtml(abiertosVisita)),
  }
}

export function generarResumenFinalWhatsApp(visita: Visita, todasActividades: Actividad[], todasPendientes: Pendiente[]): string {
  const avance = calcularAvance(todasActividades)
  const abiertosVisita = abiertos(todasPendientes)
  const formacion = todasActividades.filter((a) => a.tipo.toLowerCase().includes('formaci') && (a.estado === 'COMPLETADA' || a.estado === 'PARCIAL'))
  const ejecutadas = todasActividades.filter((a) => a.estado === 'COMPLETADA' || a.estado === 'PARCIAL')

  const sinDueño = abiertosVisita.some((p) => p.responsable === RESPONSABLE_POR_DEFECTO || p.fechaCompromiso === FECHA_POR_DEFECTO)

  const lineas = [
    `📍 *${visita.planta || 'Planta'}* | Visita finalizada`,
    `📊 Avance final: *${avance.porcentaje}%*`,
    '',
    '*✅ EJECUTADO*',
    truncar(ejecutadas.length === 0 ? 'Sin actividades cerradas.' : ejecutadas.map((a) => a.actividad).join(', '), 220),
    '',
    '*👥 FORMACIÓN*',
    truncar(formacion.length === 0 ? 'Sin formación completada.' : formacion.map((a) => a.actividad).join(', '), 160),
    '',
    '*📌 PENDIENTES EN SEGUIMIENTO*',
    abiertosVisita.length === 0 ? 'No quedan pendientes abiertos.' : `${abiertosVisita.length} pendientes pasan a seguimiento post-visita.`,
  ]

  if (sinDueño) {
    lineas.push('', '⚠️ Se solicita asignar responsable y fecha compromiso a los pendientes indicados.')
  }

  lineas.push('', '📧 El informe final ampliado y las evidencias se incluyen en el correo enviado.')

  return lineas.join('\n')
}
