import { NavLink, Outlet } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/', label: 'Panel', icono: '📊', fin: true },
  { to: '/visitas', label: 'Visitas', icono: '🏭', fin: false },
  { to: '/pendientes', label: 'Pendientes', icono: '📌', fin: false },
]

export default function Layout() {
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}>
        <h1 className="text-base font-semibold tracking-tight text-slate-900">Visitas Técnicas</h1>
      </header>

      <main className="flex-1 px-4 py-4">
        <Outlet />
      </main>

      <nav
        className="sticky bottom-0 z-10 flex border-t border-slate-200 bg-white/95 backdrop-blur"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.fin}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium ${
                isActive ? 'text-accent' : 'text-slate-500'
              }`
            }
          >
            <span className="text-lg leading-none">{item.icono}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
