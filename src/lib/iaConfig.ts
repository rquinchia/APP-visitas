// Configuración del asistente de IA, guardada solo en este dispositivo (localStorage).

export type ProveedorIA = 'gemini' | 'claude'

const CLAVES: Record<ProveedorIA, string> = {
  gemini: 'ia_gemini_api_key',
  claude: 'ia_claude_api_key',
}
const CLAVE_PROVEEDOR = 'ia_proveedor'

export const NOMBRE_PROVEEDOR: Record<ProveedorIA, string> = { gemini: 'Gemini', claude: 'Claude' }

function leer(clave: string): string {
  try {
    return localStorage.getItem(clave) ?? ''
  } catch {
    return ''
  }
}

function escribir(clave: string, valor: string) {
  try {
    if (valor) localStorage.setItem(clave, valor)
    else localStorage.removeItem(clave)
  } catch {
    // almacenamiento no disponible (modo privado del navegador, etc.)
  }
}

export function obtenerClave(p: ProveedorIA): string {
  return leer(CLAVES[p])
}

export function guardarClave(p: ProveedorIA, clave: string): void {
  escribir(CLAVES[p], clave)
}

export function tieneClave(p: ProveedorIA): boolean {
  return obtenerClave(p).trim().length > 0
}

/** Proveedor elegido; si no hay elección guardada, el primero que tenga clave (Gemini por defecto). */
export function proveedorActivo(): ProveedorIA {
  const guardado = leer(CLAVE_PROVEEDOR) as ProveedorIA
  if (guardado === 'gemini' || guardado === 'claude') return guardado
  return !tieneClave('gemini') && tieneClave('claude') ? 'claude' : 'gemini'
}

export function elegirProveedor(p: ProveedorIA): void {
  escribir(CLAVE_PROVEEDOR, p)
}

// Compatibilidad con el código anterior (Gemini).
export const obtenerClaveIA = () => obtenerClave('gemini')
export const guardarClaveIA = (clave: string) => guardarClave('gemini', clave)

/** ¿El proveedor activo tiene clave? */
export function hayClaveIA(): boolean {
  return tieneClave(proveedorActivo())
}
