/** Control segmentado estilo iOS (pestañas compactas con indicador deslizante). */
export default function Segmentado({
  opciones,
  valor,
  onChange,
}: {
  opciones: { valor: string; etiqueta: string }[]
  valor: string
  onChange: (valor: string) => void
}) {
  const indice = Math.max(0, opciones.findIndex((o) => o.valor === valor))
  return (
    <div className="relative flex rounded-xl bg-slate-200/70 p-1">
      <span
        className="absolute bottom-1 top-1 rounded-[10px] bg-white shadow-sm transition-transform duration-300 ease-out"
        style={{ width: `calc((100% - 0.5rem) / ${opciones.length})`, transform: `translateX(${indice * 100}%)` }}
      />
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          onClick={() => onChange(o.valor)}
          className={`relative z-10 flex-1 py-1.5 text-[13px] font-semibold transition-colors ${
            o.valor === valor ? 'text-slate-900' : 'text-slate-500'
          }`}
        >
          {o.etiqueta}
        </button>
      ))}
    </div>
  )
}
