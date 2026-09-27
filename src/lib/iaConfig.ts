const CLAVE_STORAGE = 'ia_gemini_api_key'

export function obtenerClaveIA(): string {
  try {
    return localStorage.getItem(CLAVE_STORAGE) ?? ''
  } catch {
    return ''
  }
}

export function guardarClaveIA(clave: string): void {
  try {
    if (clave) localStorage.setItem(CLAVE_STORAGE, clave)
    else localStorage.removeItem(CLAVE_STORAGE)
  } catch {
    // almacenamiento no disponible (modo privado del navegador, etc.)
  }
}

export function hayClaveIA(): boolean {
  return obtenerClaveIA().trim().length > 0
}
