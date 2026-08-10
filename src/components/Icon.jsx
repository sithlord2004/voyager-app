// Shared monochrome line-icon set (stroke = currentColor, follows the theme).
// One consistent family: 24px grid, 1.7 stroke, round caps/joins.
// Use anywhere as <Icon name="home" />.
const ICONS = {
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5.5 9.5V20h13V9.5" /><path d="M10 20v-5h4v5" /></>,
  map: <><path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4Z" /><path d="M9 4v14" /><path d="M15 6v14" /></>,
  shield: <><path d="M12 3.5 19 6v5.2c0 4.6-3 7.4-7 9.3-4-1.9-7-4.7-7-9.3V6l7-2.5Z" /><path d="m9 12 2 2 4-4" /></>,
  bag: <><rect x="4.5" y="7.5" width="15" height="12" rx="2.5" /><path d="M9 7.5V6a3 3 0 0 1 6 0v1.5" /></>,
  lifebuoy: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="3.4" /><path d="m6 6 3.6 3.6M18 6l-3.6 3.6M18 18l-3.6-3.6M6 18l3.6-3.6" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6M18.7 18.7l-1.6-1.6M6.9 6.9 5.3 5.3" /></>,
  help: <><circle cx="12" cy="12" r="8.5" /><path d="M9.6 9.3a2.5 2.5 0 0 1 4.7 1.2c0 1.6-2.3 2-2.3 3.4" /><circle cx="12" cy="16.6" r="0.6" fill="currentColor" stroke="none" /></>,
  lock: <><rect x="5" y="10.5" width="14" height="9.5" rx="2.5" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>,
  unlock: <><rect x="5" y="10.5" width="14" height="9.5" rx="2.5" /><path d="M8 10.5V8a4 4 0 0 1 7.5-1.9" /></>,
  plane: <><path d="M21 15.5 3 10.2v-2l7 1.4 2.6-5.1 1.9.5-1 5.2 4.6.9.8-2.5 1.6.4-.6 3.4L21 15.5Z" /></>,
  bell: <><path d="M18 8.5A6 6 0 0 0 6 8.5c0 6-2.5 7.5-2.5 7.5h17S18 14.5 18 8.5" /><path d="M13.6 19.5a2 2 0 0 1-3.2 0" /></>,
  theme: <><circle cx="12" cy="12" r="8" /><path d="M12 4a8 8 0 0 0 0 16Z" fill="currentColor" stroke="none" /></>,
  user: <><path d="M19 20.5v-1.5a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v1.5" /><circle cx="12" cy="7.5" r="4" /></>,
  users: <><path d="M16.5 20.5v-1.5a4 4 0 0 0-4-4h-5a4 4 0 0 0-4 4v1.5" /><circle cx="10" cy="7.5" r="3.6" /><path d="M20.5 20.5v-1.5a4 4 0 0 0-3-3.8" /><path d="M15.5 3.9a4 4 0 0 1 0 7.2" /></>,
  cloud: <><path d="M17.5 18a4.2 4.2 0 0 0 .3-8.4A6 6 0 0 0 6 10.4 4 4 0 0 0 6.5 18Z" /></>,
  download: <><path d="M12 3.5v11" /><path d="m7.5 10.5 4.5 4.5 4.5-4.5" /><path d="M4.5 19.5h15" /></>,
  upload: <><path d="M12 14.5v-11" /><path d="m7.5 7.5 4.5-4.5 4.5 4.5" /><path d="M4.5 19.5h15" /></>,
  passkey: <><circle cx="9" cy="9.5" r="3.5" /><path d="M9 13c-3 0-5 1.8-5 4v1.5h6" /><circle cx="17" cy="12.5" r="2.2" /><path d="M17 14.7v5.3l1.3-1 -1.3-1 1.3-1" /></>,
  key: <><circle cx="8" cy="15" r="3.6" /><path d="m10.6 12.4 7-7" /><path d="m15.5 4.5 3 3" /><path d="m13.6 6.4 2 2" /></>,
  pin: <><path d="M20 10.5c0 6-8 11.5-8 11.5S4 16.5 4 10.5a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10.3" r="2.8" /></>,
  hospital: <><rect x="4.5" y="4.5" width="15" height="15" rx="2.5" /><path d="M12 8.5v7M8.5 12h7" /></>,
  building: <><path d="M5.5 20.5V5a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v15.5" /><path d="M3.5 20.5h17" /><path d="M9 8h0M15 8h0M9 12h0M15 12h0" /><path d="M10 20.5v-3a2 2 0 0 1 4 0v3" /></>,
  phone: <><path d="M6.5 3.5h3l1.5 4-2 1.3a11 11 0 0 0 5 5l1.3-2 4 1.5v3a2 2 0 0 1-2.2 2A16 16 0 0 1 4.5 5.7 2 2 0 0 1 6.5 3.5Z" /></>,
  pulse: <><path d="M3.5 12h4l2-6 4 12 2-6h5" /></>,
  bulb: <><path d="M9.5 18h5" /><path d="M10 21h4" /><path d="M15 14.5c.2-1 .7-1.7 1.4-2.5A4.7 4.7 0 0 0 18 8.5 6 6 0 0 0 6 8.5c0 1 .2 2.2 1.5 3.5.7.8 1.2 1.5 1.4 2.5" /></>,
  edit: <><path d="M4 20h4L18.5 9.5a2 2 0 0 0-3-3L5 17v3Z" /><path d="m14 6 3 3" /></>,
  trash: <><path d="M4 6.5h16" /><path d="M9 6.5V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5" /><path d="M6.5 6.5 7.3 19a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9l.8-12.5" /><path d="M10 10.5v6M14 10.5v6" /></>,
  share: <><circle cx="17.5" cy="6" r="2.6" /><circle cx="6.5" cy="12" r="2.6" /><circle cx="17.5" cy="18" r="2.6" /><path d="m9 10.7 6-3.4M9 13.3l6 3.4" /></>,
  chevron: <><path d="m6 9.5 6 6 6-6" /></>,
  chevronRight: <><path d="m9.5 6 6 6-6 6" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m20 20-4.7-4.7" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  check: <><path d="m5 12.5 4.5 4.5L19 7" /></>,
  x: <><path d="M6 6l12 12M18 6 6 18" /></>,
  calendar: <><rect x="4" y="5.5" width="16" height="15" rx="2.5" /><path d="M4 9.5h16M8 3.5v4M16 3.5v4" /></>,
  camera: <><path d="M4.5 8.5a2 2 0 0 1 2-2h1.3l1-1.7h6.4l1 1.7h1.3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z" /><circle cx="12" cy="12.5" r="3.2" /></>,
  image: <><rect x="4" y="5" width="16" height="14" rx="2.5" /><circle cx="9" cy="10" r="1.6" /><path d="m5 17 4.5-4.5 3.5 3.5 3-3L19 16.5" /></>,
  refresh: <><path d="M20 11.5a8 8 0 1 0-.6 4" /><path d="M20 5v5h-5" /></>,
  sparkle: <><path d="M12 3.5 13.7 9l5.5 1.7-5.5 1.7L12 18l-1.7-5.6L4.8 10.7 10.3 9 12 3.5Z" /></>,
  qr: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><path d="M14 14h3v3M20 14v6M14 20h3" /></>,
  compass: <><circle cx="12" cy="12" r="8.5" /><path d="m15 9-1.3 4.2L9 15l1.3-4.2L15 9Z" /></>
}

export function Icon({ name, size = 18 }) {
  const paths = ICONS[name]
  if (!paths) return null
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>{paths}</svg>
  )
}
