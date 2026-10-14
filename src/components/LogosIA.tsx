// Logos simplificados de cada proveedor, para identificar en la app con cuál se está trabajando.
import type { ProveedorIA } from '../lib/iaConfig'

export function LogoGemini({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="grad-gemini" x1="3" y1="21" x2="21" y2="3" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#1C7DFF" />
          <stop offset="0.55" stopColor="#8E6CEF" />
          <stop offset="1" stopColor="#E0647D" />
        </linearGradient>
      </defs>
      <path d="M12 1.5c.6 5.6 4.9 9.9 10.5 10.5-5.6.6-9.9 4.9-10.5 10.5C11.4 16.9 7.1 12.6 1.5 12 7.1 11.4 11.4 7.1 12 1.5Z" fill="url(#grad-gemini)" />
    </svg>
  )
}

const RAYOS_CLAUDE = Array.from({ length: 12 }, (_, i) => ({ angulo: i * 30 + (i % 2 ? 8 : 0), largo: i % 3 === 0 ? 10 : i % 3 === 1 ? 8.2 : 9.1 }))

export function LogoClaude({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <g stroke="#D97757" strokeWidth="2.3" strokeLinecap="round">
        {RAYOS_CLAUDE.map(({ angulo, largo }) => {
          const r = (angulo * Math.PI) / 180
          return <line key={angulo} x1="12" y1="12" x2={12 + Math.cos(r) * largo} y2={12 + Math.sin(r) * largo} />
        })}
      </g>
    </svg>
  )
}

export function LogoProveedor({ proveedor, className }: { proveedor: ProveedorIA; className?: string }) {
  return proveedor === 'claude' ? <LogoClaude className={className} /> : <LogoGemini className={className} />
}
