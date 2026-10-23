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

const startupSplash = document.getElementById('startup-splash')
if (startupSplash) {
  const splashImage = startupSplash.querySelector('img')
  const progressIndicator = startupSplash.querySelector('[role="progressbar"]')
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const progressDuration = reduceMotion ? 180 : 2100
  let splashStarted = false

  const startSplash = () => {
    if (splashStarted) return
    splashStarted = true
    startupSplash.classList.add('is-ready')

    const startedAt = performance.now()
    const updateProgress = (now) => {
      const progress = Math.min((now - startedAt) / progressDuration, 1)
      progressIndicator?.setAttribute('aria-valuenow', String(Math.round(progress * 100)))
      if (progress < 1) requestAnimationFrame(updateProgress)
    }
    requestAnimationFrame(updateProgress)

    window.setTimeout(() => {
      startupSplash.classList.add('is-hidden')
      window.setTimeout(() => startupSplash.remove(), 320)
    }, progressDuration + (reduceMotion ? 80 : 320))
  }

  if (splashImage?.complete) {
    startSplash()
  } else {
    splashImage?.addEventListener('load', startSplash, { once: true })
    splashImage?.addEventListener('error', startSplash, { once: true })
    window.setTimeout(startSplash, 900)
  }
}
