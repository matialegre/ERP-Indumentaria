import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import App from './App'
import './index.css'

function Root() {
  const loadUser = useAuthStore((s) => s.loadUser)

  useEffect(() => {
    // Carga el usuario desde el token JWT guardado en localStorage.
    // No hay listener de Supabase — el token no expira en el cliente.
    loadUser()
  }, [loadUser])

  return (
    <BrowserRouter>
      <App />
    </BrowserRouter>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
