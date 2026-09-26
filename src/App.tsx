import { HashRouter, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Visitas from './pages/Visitas'
import NuevaVisita from './pages/NuevaVisita'
import VisitaDetalle from './pages/VisitaDetalle'
import Pendientes from './pages/Pendientes'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="visitas" element={<Visitas />} />
          <Route path="visitas/nueva" element={<NuevaVisita />} />
          <Route path="visitas/:id" element={<VisitaDetalle />} />
          <Route path="pendientes" element={<Pendientes />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
