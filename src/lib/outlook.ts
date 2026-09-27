// Genera un borrador de correo (.eml) con el informe en HTML e imágenes incrustadas.
// Con la cabecera "X-Unsent: 1", Outlook de Windows lo abre como un correo nuevo listo para
// completar el destinatario y enviar, sin integraciones ni permisos especiales.

const CRLF = '\r\n'

function utf8ABase64(texto: string): string {
  const bytes = new TextEncoder().encode(texto)
  let binario = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binario)
}

function envolverLineas(base64: string): string {
  return base64.match(/.{1,76}/g)?.join(CRLF) ?? ''
}

function codificarAsunto(asunto: string): string {
  return `=?UTF-8?B?${utf8ABase64(asunto)}?=`
}

interface ImagenIncrustada {
  cid: string
  tipo: string
  base64: string
}

/** Reemplaza las imágenes data: del HTML por referencias cid: y las devuelve aparte como adjuntos en línea. */
function extraerImagenes(html: string): { html: string; imagenes: ImagenIncrustada[] } {
  const imagenes: ImagenIncrustada[] = []
  const htmlConCid = html.replace(/src="data:(image\/[a-z+]+);base64,([^"]+)"/g, (_m, tipo: string, datos: string) => {
    const cid = `img${imagenes.length + 1}@visitas`
    imagenes.push({ cid, tipo, base64: datos })
    return `src="cid:${cid}"`
  })
  return { html: htmlConCid, imagenes }
}

export function construirEml(asunto: string, html: string): string {
  const { html: htmlCid, imagenes } = extraerImagenes(html)
  const frontera = `----=_visitas_${Date.now().toString(36)}`

  const partes: string[] = []
  partes.push(
    `--${frontera}`,
    'Content-Type: text/html; charset="utf-8"',
    'Content-Transfer-Encoding: base64',
    '',
    envolverLineas(utf8ABase64(htmlCid)),
  )
  for (const img of imagenes) {
    const extension = img.tipo.split('/')[1] ?? 'jpg'
    partes.push(
      `--${frontera}`,
      `Content-Type: ${img.tipo}; name="${img.cid.split('@')[0]}.${extension}"`,
      'Content-Transfer-Encoding: base64',
      `Content-ID: <${img.cid}>`,
      `Content-Disposition: inline; filename="${img.cid.split('@')[0]}.${extension}"`,
      '',
      envolverLineas(img.base64),
    )
  }
  partes.push(`--${frontera}--`, '')

  const cabeceras = [
    'X-Unsent: 1',
    `Subject: ${codificarAsunto(asunto)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/related; boundary="${frontera}"; type="text/html"`,
    '',
    '',
  ]

  return cabeceras.join(CRLF) + partes.join(CRLF)
}

/** Descarga el borrador; al abrirlo en Windows se abre en Outlook como correo nuevo con todo el formato. */
export function descargarBorradorOutlook(asunto: string, html: string, nombreArchivo: string): void {
  const eml = construirEml(asunto, html)
  const blob = new Blob([eml], { type: 'message/rfc822' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo.endsWith('.eml') ? nombreArchivo : `${nombreArchivo}.eml`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
