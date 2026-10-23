import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

// Capacitor WebView owns the native app lifecycle and asset cache. Keep the
// PWA service worker for browser installs, but avoid a second cache layer in
// the packaged Android application.
if (import.meta.env.MODE !== 'capacitor') {
  registerSW({ immediate: true })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
