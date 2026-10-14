// Puente entre la pantalla de informe abierta (Reporte del día o Cierre) y el asistente, para que el
// asistente pueda leer y ajustar el informe que el usuario está revisando.

export interface InformeActivo {
  tipo: 'diario' | 'final'
  /** Texto plano del correo tal como está en pantalla (con las ediciones del usuario). */
  textoCorreo: () => string
  textoWhatsApp: () => string
  asunto: () => string
  /** Reemplaza un fragmento de texto del correo. Devuelve cuántas veces lo encontró. */
  reemplazarEnCorreo: (buscar: string, reemplazar: string) => number
  /** Agrega una viñeta al resumen ejecutivo. */
  agregarAlResumen: (texto: string) => boolean
  fijarWhatsApp: (texto: string) => void
  fijarAsunto: (texto: string) => void
  /** Vuelve a generar ambos informes desde los datos (descarta ediciones manuales). */
  regenerar: () => Promise<void>
  /** Para deshacer: foto del estado actual y restauración. */
  instantanea: () => { correoHtml: string; whatsapp: string; asunto: string }
  restaurar: (i: { correoHtml: string; whatsapp: string; asunto: string }) => void
}

let activo: InformeActivo | null = null

export function registrarInformeActivo(informe: InformeActivo): () => void {
  activo = informe
  return () => {
    if (activo === informe) activo = null
  }
}

export function informeActivo(): InformeActivo | null {
  return activo
}

/** Reemplaza texto dentro de los nodos de texto de un elemento (conserva el formato y las fotos). */
export function reemplazarTextoEnElemento(raiz: HTMLElement, buscar: string, reemplazar: string): number {
  if (!buscar) return 0
  let veces = 0
  const recorrido = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT)
  const nodos: Text[] = []
  while (recorrido.nextNode()) nodos.push(recorrido.currentNode as Text)
  for (const nodo of nodos) {
    const texto = nodo.nodeValue ?? ''
    if (texto.includes(buscar)) {
      veces += texto.split(buscar).length - 1
      nodo.nodeValue = texto.split(buscar).join(reemplazar)
    }
  }
  return veces
}
