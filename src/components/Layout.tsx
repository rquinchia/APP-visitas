import { NavLink, Outlet } from 'react-router-dom'
import EstadoApp from './EstadoApp'

const NAV_ITEMS = [
  { to: '/', label: 'Panel', icono: '📊', fin: true },
  { to: '/visitas', label: 'Visitas', icono: '🏭', fin: false },
  { to: '/pendientes', label: 'Pendientes', icono: '📌', fin: false },
  { to: '/backup', label: 'Respaldo', icono: '💾', fin: false },
]

export default function Layout() {
  return (
    <div className="min-h-screen bg-slate-100 sm:bg-gradient-to-b sm:from-slate-200 sm:to-slate-100 sm:py-6">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col bg-slate-50 sm:min-h-[calc(100vh-3rem)] sm:overflow-hidden sm:rounded-3xl sm:border sm:border-slate-200/80 sm:shadow-2xl sm:shadow-slate-300/50">
        <header
          className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 px-4 pb-3 backdrop-blur-xl backdrop-saturate-150"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.875rem)' }}
        >
          <h1 className="text-[22px] font-bold tracking-tight text-slate-900">Visitas Técnicas</h1>
          <div className="mt-1.5">
            <EstadoApp />
          </div>
        </header>

        <main className="flex-1 px-4 py-4">
          <Outlet />
        </main>

        <nav
          className="sticky bottom-0 z-20 flex border-t border-slate-200/70 bg-white/85 backdrop-blur-xl backdrop-saturate-150"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.fin} className="flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium">
              {({ isActive }) => (
                <>
                  <span
                    className={`flex h-7 w-10 items-center justify-center rounded-full text-lg leading-none transition-colors duration-150 ${
                      isActive ? 'bg-accent/10' : ''
                    }`}
                  >
                    {item.icono}
                  </span>
                  <span className={isActive ? 'text-accent' : 'text-slate-400'}>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
