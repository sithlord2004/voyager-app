// fetch with a hard timeout. Inside a serverless function one slow upstream
// (a geocoder, a flight API) can burn the whole execution budget and take the
// entire job down with it — a notification we skip is far better than a run
// that never finishes.
export async function fetchT(url, opts = {}, ms = 4000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal })
  } finally {
    clearTimeout(timer)
  }
}
