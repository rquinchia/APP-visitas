import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Archive, Factory, LayoutGrid, ListTodo, Settings, type LucideIcon } from 'lucide-react'
import EstadoApp from './EstadoApp'

const NAV_ITEMS: { to: string; label: string; icono: LucideIcon; fin: boolean }[] = [
  { to: '/', label: 'Panel', icono: LayoutGrid, fin: true },
  { to: '/visitas', label: 'Visitas', icono: Factory, fin: false },
  { to: '/pendientes', label: 'Pendientes', icono: ListTodo, fin: false },
  { to: '/backup', label: 'Respaldo', icono: Archive, fin: false },
]

export default function Layout() {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-slate-100 sm:bg-gradient-to-br sm:from-slate-200 sm:via-slate-100 sm:to-sky-50 sm:py-6">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col bg-[#f5f6f8] sm:min-h-[calc(100vh-3rem)] sm:overflow-hidden sm:rounded-[28px] sm:border sm:border-white/70 sm:shadow-2xl sm:shadow-slate-400/30">
        <header
          className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200/60 bg-[#f5f6f8]/80 px-4 pb-2 backdrop-blur-xl backdrop-saturate-150"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.5rem)' }}
        >
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-slate-800 to-sky-700 text-[11px] font-bold text-white">
              VT
            </span>
            <span className="text-[15px] font-semibold tracking-tight text-slate-800">Visitas Técnicas</span>
          </Link>
          <div className="flex items-center gap-1">
            <EstadoApp />
            <Link to="/ajustes" aria-label="Ajustes" className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400">
              <Settings className="h-[19px] w-[19px]" strokeWidth={2.2} />
            </Link>
          </div>
        </header>

        <main key={location.pathname} className="flex-1 animate-entrar px-4 pb-6 pt-4">
          <Outlet />
        </main>

        <nav
          className="sticky bottom-0 z-20 flex border-t border-slate-200/60 bg-white/85 backdrop-blur-xl backdrop-saturate-150"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.fin} className="flex flex-1 flex-col items-center gap-0.5 pb-1.5 pt-2">
              {({ isActive }) => (
                <>
                  <item.icono className={`h-6 w-6 transition-colors ${isActive ? 'text-accent' : 'text-slate-400'}`} strokeWidth={isActive ? 2.4 : 2} />
                  <span className={`text-[10.5px] font-medium ${isActive ? 'text-accent' : 'text-slate-400'}`}>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
