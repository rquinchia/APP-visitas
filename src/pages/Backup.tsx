import { useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { generarRespaldo, leerArchivoRespaldo, restaurarRespaldo, resumirRespaldo, type ResumenRespaldo } from '../lib/backup'

function nombreArchivoRespaldo() {
  return `visitas-respaldo-${new Date().toISOString().slice(0, 10)}.json`
}

export default function Backup() {
  const navigate = useNavigate()
  const [exportando, setExportando] = useState(false)
  const [archivoPendiente, setArchivoPendiente] = useState<File | null>(null)
  const [resumen, setResumen] = useState<ResumenRespaldo | null>(null)
  const [importando, setImportando] = useState(false)
  const [error, setError] = useState('')

  async function exportar() {
    setExportando(true)
    try {
      const blob = await generarRespaldo()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = nombreArchivoRespaldo()
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      alert('No se pudo generar el respaldo.')
    } finally {
      setExportando(false)
    }
  }

  async function compartir() {
    try {
      const blob = await generarRespaldo()
      const archivo = new File([blob], nombreArchivoRespaldo(), { type: 'application/json' })
      if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
        await navigator.share({ files: [archivo], title: 'Respaldo de visitas' })
      } else {
        alert('Este dispositivo no admite compartir archivos directamente. Usa "Descargar respaldo".')
      }
    } catch {
      // el usuario canceló el diálogo nativo
    }
  }

  async function onArchivoSeleccionado(e: ChangeEvent<HTMLInputElement>) {
    setError('')
    setResumen(null)
    setArchivoPendiente(null)
    const archivo = e.target.files?.[0]
    if (!archivo) return
    try {
      const respaldo = await leerArchivoRespaldo(archivo)
      setResumen(resumirRespaldo(respaldo))
      setArchivoPendiente(archivo)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo leer el archivo.')
    }
    e.target.value = ''
  }

  async function restaurar(limpiarPrimero: boolean) {
    if (!archivoPendiente) return
    const advertencia = limpiarPrimero
      ? 'Esto REEMPLAZARÁ todos los datos actuales de la aplicación por los del respaldo. Esta acción no se puede deshacer. ¿Continuar?'
      : '¿Combinar este respaldo con los datos actuales? Los registros con el mismo ID se sobrescribirán.'
    if (!window.confirm(advertencia)) return

    setImportando(true)
    try {
      const respaldo = await leerArchivoRespaldo(archivoPendiente)
      await restaurarRespaldo(respaldo, { limpiarPrimero })
      alert('Respaldo restaurado correctamente.')
      setArchivoPendiente(null)
      setResumen(null)
      navigate('/')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo restaurar el respaldo.')
    } finally {
      setImportando(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-8">
      <section className="rounded-2xl border border-accent/20 bg-accent/5 p-4">
        <h2 className="text-sm font-semibold text-accent">📁 Cómo pasar información entre tu PC y tu iPhone</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-slate-600">
          <li>Crea una carpeta en OneDrive, por ejemplo "Visitas App", accesible desde ambos dispositivos.</li>
          <li>
            En el dispositivo donde acabas de trabajar: toca <strong>"Descargar respaldo"</strong> (o
            <strong> "Compartir" → OneDrive</strong> en iPhone) y guárdalo en esa carpeta.
          </li>
          <li>
            En el otro dispositivo: abre esa misma carpeta de OneDrive, toca <strong>"Elegir archivo"</strong> abajo y
            selecciona <strong>"Combinar con lo actual"</strong>.
          </li>
        </ol>
        <p className="mt-2 text-xs text-slate-500">
          No es automático — pero OneDrive mueve el archivo solo entre tus dispositivos, sin que tengas que enviártelo
          por correo cada vez.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/60 p-4">
        <h2 className="text-sm font-semibold text-slate-800">Exportar respaldo</h2>
        <p className="mt-1 text-xs text-slate-500">Guarda todas las visitas, planes, pendientes y fotografías en un solo archivo.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={exportar} disabled={exportando} className="rounded-lg bg-accent py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            {exportando ? 'Generando…' : 'Descargar respaldo'}
          </button>
          <button onClick={compartir} className="rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-700">
            Compartir a OneDrive
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/60 p-4">
        <h2 className="text-sm font-semibold text-slate-800">Importar respaldo</h2>
        <p className="mt-1 text-xs text-slate-500">Recupera la información desde un archivo de respaldo exportado antes.</p>

        <label className="tap mt-3 flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-slate-300 py-3 text-sm font-medium text-slate-600">
          Elegir archivo (.json)
          <input type="file" accept=".json,application/json" className="hidden" onChange={onArchivoSeleccionado} />
        </label>

        {error && <p className="mt-2 text-xs font-medium text-rose-600">{error}</p>}

        {resumen && (
          <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            <p>Exportado: {new Date(resumen.exportadoEn).toLocaleString()}</p>
            <p>
              {resumen.visitas} visitas · {resumen.actividades} actividades · {resumen.pendientes} pendientes · {resumen.fotos} fotos
            </p>
            <div className="mt-3 flex flex-col gap-2">
              <button
                onClick={() => restaurar(false)}
                disabled={importando}
                className="rounded-lg bg-accent py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                Combinar con lo actual
              </button>
              <button
                onClick={() => restaurar(true)}
                disabled={importando}
                className="rounded-lg border border-rose-300 bg-rose-50 py-2.5 text-sm font-semibold text-rose-700 disabled:opacity-60"
              >
                Reemplazar todo lo actual
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
