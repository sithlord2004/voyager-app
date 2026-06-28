import { useState } from 'react'
import { Icon } from './Icon.jsx'

// Reusable accordion section: a tappable header that shows/hides its content.
// Pass a stable `id` and it remembers its open/closed state across navigation
// and reloads (stored on-device); without an id it just uses `defaultOpen`.
export default function Collapsible({ id, icon, title, badge, defaultOpen = false, tone, children }) {
  const key = id ? 'collapse:' + id : null
  const [open, setOpen] = useState(() => {
    if (key) { try { const s = localStorage.getItem(key); if (s !== null) return s === '1' } catch { /* ignore */ } }
    return defaultOpen
  })
  function toggle() {
    setOpen(o => {
      const next = !o
      if (key) { try { localStorage.setItem(key, next ? '1' : '0') } catch { /* ignore */ } }
      return next
    })
  }
  return (
    <div className={'collapse' + (tone ? ' ' + tone : '') + (open ? ' open' : '')}>
      <button type="button" className="collapse-head" onClick={toggle} aria-expanded={open}>
        {icon && <span className="ch-ic"><Icon name={icon} size={18} /></span>}
        <span className="ch-title">{title}</span>
        {badge != null && badge !== '' && <span className="ch-badge">{badge}</span>}
        <span className="ch-chev"><Icon name="chevron" size={18} /></span>
      </button>
      {open && <div className="collapse-body">{children}</div>}
    </div>
  )
}
