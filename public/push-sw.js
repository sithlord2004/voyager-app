/* Push handling for Voyager's service worker.
   Workbox generates the caching worker; this file is pulled in via
   `workbox.importScripts` so the push logic survives every rebuild. */

self.addEventListener('push', event => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { body: event.data && event.data.text() } }

  const title = data.title || 'Voyager'
  const options = {
    body: data.body || '',
    icon: '/icon.svg',
    badge: '/icon.svg',
    // Same tag replaces an earlier notification instead of stacking duplicates.
    tag: data.tag || 'voyager',
    renotify: !!data.tag,
    data: { url: data.url || '/' }
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

// Focus an existing window if the app is already open, otherwise open one.
self.addEventListener('notificationclick', event => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if ('focus' in client) { client.navigate(target); return client.focus() }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target)
    })
  )
})
