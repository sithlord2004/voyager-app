import { useState } from 'react'
import { Icon } from './Icon.jsx'

// Reusable accordion section: a tappable header that shows/hides its content.
export default function Collapsible({ icon, title, badge, defaultOpen = false, tone, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={'collapse' + (tone ? ' ' + tone : '') + (open ? ' open' : '')}>
      <button type="button" className="collapse-head" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        {icon && <span className="ch-ic"><Icon name={icon} size={18} /></span>}
        <span className="ch-title">{title}</span>
        {badge != null && badge !== '' && <span className="ch-badge">{badge}</span>}
        <span className="ch-chev"><Icon name="chevron" size={18} /></span>
      </button>
      {open && <div className="collapse-body">{children}</div>}
    </div>
  )
}
