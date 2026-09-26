import type { Actividad, Pendiente, Visita } from '../types'
import { FECHA_POR_DEFECTO, RESPONSABLE_POR_DEFECTO } from '../types'
import { calcularAvance } from './progreso'

function abiertos(pendientes: Pendiente[]) {
  return pendientes.filter((p) => p.estado !== 'CERRADO' && p.estado !== 'CANCELADO')
}

function truncar(texto: string, max: number): string {
  return texto.length > max ? texto.slice(0, max - 1).trimEnd() + '…' : texto
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
    `📍 ${visita.planta || 'Planta'} | Día ${dia}/${visita.duracionDias}`,
    `📊 Avance: ${avance.porcentaje}%`,
    '',
    '✅ EJECUTADO',
    ejecutadoTexto,
    '',
    '👥 FORMACIÓN',
    formacionTexto,
    '',
    '🔎 HALLAZGOS',
    hallazgosTexto,
    '',
    '📌 PENDIENTES',
    pendientesTexto,
    '',
    '➡️ SIGUIENTE PASO',
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
