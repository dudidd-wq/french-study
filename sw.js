// Service worker: precache the app shell, cache word audio on demand (with Range support for Safari).
const VERSION = 'v1.2.1';
const SHELL = 'french-shell-' + VERSION;
const AUDIO = 'french-audio-v1';          // kept across versions (audio files never change names)
const ASSETS = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css', 'fonts/rubik.woff2',
  'js/app.js', 'js/nav.js', 'js/util.js', 'js/data.js', 'js/store.js', 'js/audio.js', 'js/select.js', 'js/ui.js', 'js/match.js',
  'js/views/home.js', 'js/views/parts.js', 'js/views/flash.js', 'js/views/listen.js', 'js/views/quiz.js', 'js/views/stats.js', 'js/views/sent.js',
  'data/words.json', 'data/sentences.json', 'audio/silence-1000.mp3', 'audio/silence-500.mp3',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('french-shell-') && k !== SHELL).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function rangeResponse(req, res) {
  const range = req.headers.get('range');
  if (!range || !res) return res;
  const buf = await res.arrayBuffer();
  const m = /bytes=(\d*)-(\d*)/.exec(range); const size = buf.byteLength;
  let start = m && m[1] ? +m[1] : 0, end = m && m[2] ? +m[2] : size - 1;
  if (m && !m[1] && m[2]) { start = Math.max(0, size - +m[2]); end = size - 1; }
  end = Math.min(end, size - 1);
  if (start >= size) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  return new Response(buf.slice(start, end + 1), { status: 206, statusText: 'Partial Content', headers: {
    'Content-Type': res.headers.get('Content-Type') || 'audio/mpeg', 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes' } });
}

self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url); if (url.origin !== location.origin) return;
  const path = url.pathname;

  // Word + sentence audio: cache-first, store full (non-range) response on first play
  if (/\/audio\/((fr|he)\/\d+|sent\/[0-9a-f]+)\.mp3$/.test(path)) {
    e.respondWith((async () => {
      const cache = await caches.open(AUDIO);
      const key = new Request(url.href);
      let res = await cache.match(key);
      if (!res) {
        try {
          const net = await fetch(key);          // no Range header → full 200 body we can cache
          if (net.ok) { await cache.put(key, net.clone()); res = net; }
          else return net;
        } catch (err) { return new Response('', { status: 504 }); }
      }
      return rangeResponse(req, res);
    })());
    return;
  }

  // words.json: network-first so data fixes arrive, fall back to cache offline
  if (path.endsWith('/data/words.json') || path.endsWith('/data/sentences.json')) {
    e.respondWith(fetch(req).then(r => { if (r.ok) { const cl = r.clone(); caches.open(SHELL).then(c => c.put(req, cl)); } return r; })
      .catch(() => caches.match(req, { ignoreSearch: true })));
    return;
  }

  // App shell: cache-first (navigation falls back to index.html)
  e.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true }) || (req.mode === 'navigate' ? await caches.match('index.html') : null);
    if (hit) return req.headers.get('range') ? rangeResponse(req, hit) : hit;
    try {
      const r = await fetch(req);
      if (r.ok && r.type === 'basic') { const cl = r.clone(); caches.open(SHELL).then(c => c.put(req, cl)); }
      return r;
    } catch { return req.mode === 'navigate' ? caches.match('index.html') : new Response('', { status: 504 }); }
  })());
});
