import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { normalizarNumerosHallazgos } from './db'

// Fija el número permanente (H-xx) de los hallazgos anteriores a esta versión; mismo código que ya
// mostraban. Si falla no bloquea nada: los códigos se calculan igual al mostrarlos.
normalizarNumerosHallazgos().catch(() => {})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
