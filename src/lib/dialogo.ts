// Diálogos propios de la app (confirmar / pedir un texto), en lugar de window.confirm/prompt: en la
// app instalada en el iPhone los diálogos nativos pueden no mostrarse o cancelarse solos, y entonces
// acciones como eliminar o cambiar de estado no hacían nada. Se muestran con <Dialogos /> (Layout).

export interface OpcionesConfirmar {
  titulo: string
  mensaje?: string
  aceptar?: string
  peligro?: boolean
  /** Para acciones graves: el usuario debe escribir este texto exacto para habilitar el botón. */
  escribir?: string
}

export interface OpcionesTexto {
  titulo: string
  mensaje?: string
  aceptar?: string
  placeholder?: string
  valorInicial?: string
  obligatorio?: boolean
}

export type PeticionDialogo =
  | { tipo: 'confirmar'; opciones: OpcionesConfirmar; responder: (v: boolean) => void }
  | { tipo: 'texto'; opciones: OpcionesTexto; responder: (v: string | null) => void }

let mostrar: ((p: PeticionDialogo) => void) | null = null

export function registrarDialogos(fn: ((p: PeticionDialogo) => void) | null): void {
  mostrar = fn
}

export function confirmar(opciones: OpcionesConfirmar): Promise<boolean> {
  if (!mostrar) return Promise.resolve(window.confirm([opciones.titulo, opciones.mensaje].filter(Boolean).join('\n\n')))
  return new Promise((resolve) => mostrar!({ tipo: 'confirmar', opciones, responder: resolve }))
}

/** Devuelve el texto escrito, o null si el usuario canceló. */
export function pedirTexto(opciones: OpcionesTexto): Promise<string | null> {
  if (!mostrar) return Promise.resolve(window.prompt([opciones.titulo, opciones.mensaje].filter(Boolean).join('\n\n'), opciones.valorInicial ?? ''))
  return new Promise((resolve) => mostrar!({ tipo: 'texto', opciones, responder: resolve }))
}
