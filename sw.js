/* CHMEdu — 앱 설치·빠른 실행용 서비스 워커
   서버(Apps Script) 호출은 절대 캐시하지 않는다. 화면 껍데기만 캐시한다. */
const V = 'chmedu-2026-09-07';
const SHELL = ['./', './index.html', './manifest.json',
  './chmedu-192.png', './chmedu-512.png',
  './chmedu-maskable-192.png', './chmedu-maskable-512.png',
  './chmedu-apple-180.png', './chmedu-favicon-32.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c =>
    Promise.allSettled(SHELL.map(u => fetch(u, {cache:'reload'})
      .then(r => r.ok ? c.put(u, r) : null).catch(() => null)))
  ).catch(() => {}));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.indexOf('chmedu-') === 0 && k !== V && k !== V + '-lib')
      .map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('message', e => { if (e.data === 'skip') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (err) { return; }

  // 서버 통신은 손대지 않음 (Apps Script)
  if (/script\.google\.com$|script\.googleusercontent\.com$|googleusercontent\.com$/.test(url.hostname)) return;

  // 외부 라이브러리(jsPDF·html2canvas)·웹폰트는 한 번 받으면 캐시에서
  if (/(^|\.)cdnjs\.cloudflare\.com$|(^|\.)gstatic\.com$|(^|\.)googleapis\.com$/.test(url.hostname)) {
    e.respondWith(caches.open(V + '-lib').then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      try { const res = await fetch(req); if (res && res.ok) c.put(req, res.clone()); return res; }
      catch (err) { return hit || Response.error(); }
    }));
    return;
  }

  if (url.origin !== location.origin) return;

  // 화면 이동: 네트워크 우선, 안 되면 캐시본
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        const c = await caches.open(V); c.put('./index.html', res.clone());
        return res;
      } catch (err) {
        return (await caches.match('./index.html')) || (await caches.match('./')) || Response.error();
      }
    })());
    return;
  }

  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res && res.ok) { const cc = res.clone(); caches.open(V).then(c => c.put(req, cc)); }
    return res;
  }).catch(() => hit)));
});
