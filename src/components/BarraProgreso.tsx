export default function BarraProgreso({ porcentaje }: { porcentaje: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
      <div
        className="h-full rounded-full bg-accent transition-all"
        style={{ width: `${Math.min(100, Math.max(0, porcentaje))}%` }}
      />
    </div>
  )
}
