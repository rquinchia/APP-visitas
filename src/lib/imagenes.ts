/** Reduce una fotografía a una miniatura en base64, para poder incluirla en un informe sin que pese demasiado. */
export async function blobAThumbnailDataUrl(blob: Blob, maxAncho = 480, calidad = 0.7): Promise<string> {
  const bitmap = await createImageBitmap(blob)
  try {
    const escala = Math.min(1, maxAncho / bitmap.width)
    const ancho = Math.max(1, Math.round(bitmap.width * escala))
    const alto = Math.max(1, Math.round(bitmap.height * escala))
    const canvas = document.createElement('canvas')
    canvas.width = ancho
    canvas.height = alto
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('No se pudo preparar la imagen.')
    ctx.drawImage(bitmap, 0, 0, ancho, alto)
    return canvas.toDataURL('image/jpeg', calidad)
  } finally {
    bitmap.close()
  }
}
