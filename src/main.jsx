import React from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.jsx'
import './styles.css'

// Auto-update: when a new version is deployed, apply it and reload automatically.
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() { updateSW(true) },
  onRegisteredSW(_url, reg) {
    // Re-check for updates every 30 min and whenever the app regains focus.
    if (reg) {
      setInterval(() => reg.update(), 30 * 60 * 1000)
      document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update() })
    }
  }
})

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
