// Shared monochrome line-icon set (stroke = currentColor, follows the theme).
// Use anywhere as <Icon name="home" /> for icons consistent with the nav.
const ICONS = {
  home: <><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></>,
  map: <><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" /><line x1="9" y1="3" x2="9" y2="18" /><line x1="15" y1="6" x2="15" y2="21" /></>,
  shield: <><path d="M12 3l8 3v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z" /><path d="M9 12l2 2 4-4" /></>,
  bag: <><rect x="4" y="7" width="16" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /><line x1="4" y1="12" x2="20" y2="12" /></>,
  lifebuoy: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3.5" /><line x1="12" y1="2.5" x2="12" y2="8.5" /><line x1="12" y1="15.5" x2="12" y2="21.5" /><line x1="2.5" y1="12" x2="8.5" y2="12" /><line x1="15.5" y1="12" x2="21.5" y2="12" /></>,
  settings: <><circle cx="9" cy="7" r="2" /><line x1="4" y1="7" x2="7" y2="7" /><line x1="11" y1="7" x2="20" y2="7" /><circle cx="15" cy="17" r="2" /><line x1="4" y1="17" x2="13" y2="17" /><line x1="17" y1="17" x2="20" y2="17" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.2a2.6 2.6 0 0 1 4.8 1.3c0 1.7-2.3 2-2.3 3.5" /><circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" /></>,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  unlock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 7.5-1.7" /></>,
  plane: <><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></>,
  bell: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>,
  theme: <><circle cx="12" cy="12" r="9" /><path d="M12 3v18" /><path d="M12 3a9 9 0 0 1 0 18" fill="currentColor" stroke="none" opacity="0.18" /></>,
  user: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
  users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9" /><path d="M16 3.1a4 4 0 0 1 0 7.8" /></>,
  cloud: <><path d="M18 10h-1.3A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" /></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>,
  passkey: <><path d="M12 10.5v4" /><path d="M8.5 8.2a5 5 0 0 1 7 0" /><path d="M6.5 10.7a7.5 7.5 0 0 1 11 0" /><path d="M9 16a3 3 0 0 0 6 0" /></>,
  key: <><circle cx="7" cy="15" r="4" /><path d="M10 12l8-8" /><path d="M16 6l3 3" /><path d="M14 8l2 2" /></>,
  pin: <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></>,
  hospital: <><rect x="4" y="4" width="16" height="16" rx="2" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></>,
  building: <><path d="M5 21V5a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v16" /><line x1="3" y1="21" x2="21" y2="21" /><line x1="9" y1="7" x2="9.01" y2="7" /><line x1="15" y1="7" x2="15.01" y2="7" /><line x1="9" y1="11" x2="9.01" y2="11" /><line x1="15" y1="11" x2="15.01" y2="11" /><path d="M10 21v-3a2 2 0 0 1 4 0v3" /></>,
  phone: <><path d="M6 3h3l2 5-2.5 1.5a11 11 0 0 0 5 5L16 13l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 5 2 2 0 0 1 5 3" /></>,
  pulse: <><path d="M3 12h4l2-6 4 12 2-6h6" /></>,
  bulb: <><line x1="9" y1="18" x2="15" y2="18" /><line x1="10" y1="22" x2="14" y2="22" /><path d="M15 14c.2-1 .7-1.7 1.4-2.5A4.7 4.7 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5C8.3 12.3 8.8 13 9 14" /></>,
  edit: <><path d="M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5z" /></>,
  trash: <><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></>
}

export function Icon({ name, size = 18 }) {
  const paths = ICONS[name]
  if (!paths) return null
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>{paths}</svg>
  )
}
