/**
 * Reduce una fotografía a una miniatura en base64, para poder incluirla en un informe sin que pese
 * demasiado. Con `aspecto` (ancho/alto, p.ej. 4/3) recorta al centro, para que todas las fotos del
 * informe queden del mismo tamaño y alineadas (Outlook de escritorio no admite recortes por CSS).
 */
export async function blobAThumbnailDataUrl(blob: Blob, maxAncho = 480, calidad = 0.72, aspecto?: number): Promise<string> {
  const bitmap = await createImageBitmap(blob)
  try {
    let sx = 0
    let sy = 0
    let sw = bitmap.width
    let sh = bitmap.height
    if (aspecto) {
      if (sw / sh > aspecto) {
        sw = Math.round(sh * aspecto)
        sx = Math.round((bitmap.width - sw) / 2)
      } else {
        sh = Math.round(sw / aspecto)
        sy = Math.round((bitmap.height - sh) / 2)
      }
    }
    const escala = Math.min(1, maxAncho / sw)
    const ancho = Math.max(1, Math.round(sw * escala))
    const alto = Math.max(1, Math.round(sh * escala))
    const canvas = document.createElement('canvas')
    canvas.width = ancho
    canvas.height = alto
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('No se pudo preparar la imagen.')
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, ancho, alto)
    return canvas.toDataURL('image/jpeg', calidad)
  } finally {
    bitmap.close()
  }
}
