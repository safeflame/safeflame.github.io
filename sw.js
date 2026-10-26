/* SafeFlame AI service worker: lets the site be installed and shows a friendly page when offline. */
const CACHE = 'sf-v1';
const OFFLINE = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline | SafeFlame AI</title><body style="margin:0;background:#08080f;color:#f0f0f8;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:2rem"><div><h1 style="margin:0 0 .6rem">You are offline</h1><p style="color:#a0a0b8">Check your connection and try again. SafeFlame AI needs the internet to load your account.</p><p><a href="/" style="color:#ff8a65">Try again</a></p></div>';
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url); if (u.origin !== location.origin) return;           // never touch Firebase / EmailJS / Google
  if (r.mode === 'navigate') { e.respondWith(fetch(r).catch(() => new Response(OFFLINE, { headers: { 'Content-Type': 'text/html' } }))); return; }
  if (/\.(png|ico|svg|webmanifest)$/.test(u.pathname)) { e.respondWith(caches.open(CACHE).then(c => c.match(r).then(m => m || fetch(r).then(n => { c.put(r, n.clone()); return n; })))); }
});
