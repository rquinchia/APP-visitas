import { HashRouter, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Visitas from './pages/Visitas'
import NuevaVisita from './pages/NuevaVisita'
import VisitaDetalle from './pages/VisitaDetalle'
import Plan from './pages/Plan'
import ActividadForm from './pages/ActividadForm'
import PlanVistaPrevia from './pages/PlanVistaPrevia'
import Pendientes from './pages/Pendientes'
import PendienteForm from './pages/PendienteForm'
import RegistroDiario from './pages/RegistroDiario'
import Reporte from './pages/Reporte'
import Cierre from './pages/Cierre'
import Backup from './pages/Backup'
import Ajustes from './pages/Ajustes'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="visitas" element={<Visitas />} />
          <Route path="visitas/nueva" element={<NuevaVisita />} />
          <Route path="visitas/:id" element={<VisitaDetalle />} />
          <Route path="visitas/:id/hoy" element={<RegistroDiario />} />
          <Route path="visitas/:id/reporte" element={<Reporte />} />
          <Route path="visitas/:id/cierre" element={<Cierre />} />
          <Route path="visitas/:id/plan" element={<Plan />} />
          <Route path="visitas/:id/plan/vista-previa" element={<PlanVistaPrevia />} />
          <Route path="visitas/:id/plan/nueva" element={<ActividadForm />} />
          <Route path="visitas/:id/plan/:actividadId/editar" element={<ActividadForm />} />
          <Route path="pendientes" element={<Pendientes />} />
          <Route path="pendientes/nuevo" element={<PendienteForm />} />
          <Route path="pendientes/:pendienteId/editar" element={<PendienteForm />} />
          <Route path="backup" element={<Backup />} />
          <Route path="ajustes" element={<Ajustes />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
