// Build stamp injected by vite.config.js `define` at build time.
// Falls back gracefully if the defines aren't present.
const BUILD_TIME = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : ''
const COMMIT = typeof __COMMIT__ !== 'undefined' ? __COMMIT__ : ''

// A short, human-friendly label like: "build 29 Jun 2026, 14:32 · a1b2c3d"
export function versionLabel() {
  let when = ''
  if (BUILD_TIME) {
    try {
      when = new Date(BUILD_TIME).toLocaleString(undefined, {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      })
    } catch { when = BUILD_TIME }
  }
  return ['build', when, COMMIT && '· ' + COMMIT].filter(Boolean).join(' ')
}
