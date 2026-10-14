import type { EncabezadoInforme } from '../lib/reportes'

/** Vista en pantalla del encabezado del correo (el mismo que lleva el informe enviado). */
export default function EncabezadoInformeVista({ encabezado }: { encabezado: EncabezadoInforme | null }) {
  return (
    <>
      <div className="bg-gradient-to-br from-slate-900 via-sky-950 to-sky-700 px-4 py-5 text-white">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-sky-300">{encabezado?.etiqueta ?? 'Informe de visita técnica'}</p>
        <p className="mt-1.5 text-xl font-extrabold leading-tight">{encabezado?.titulo ?? '…'}</p>
        {encabezado && (
          <>
            <p className="mt-1 text-[13px] text-sky-50">{encabezado.detalle}</p>
            <p className="mt-0.5 text-xs text-sky-300">{encabezado.meta}</p>
          </>
        )}
      </div>
      <div className="h-1 bg-sky-400" />
    </>
  )
}
