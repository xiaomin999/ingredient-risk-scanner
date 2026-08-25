/* 离线缓存：缓存应用外壳；data/ 下为远程可更新成分库，走网络优先以保证更新即时生效 */
var CACHE = 'cr-shell-v3';
var ASSETS = [
  'index.html', 'css/style.css', 'js/app.js', 'js/db.js', 'js/risk-tags.js', 'js/sync.js',
  'manifest.json', 'icon.svg',
  'data/ingredients.json', 'data/risk-tags.json', 'data/db-version.json'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  // 远程成分库：网络优先，失败回退缓存（保证「远程可更新」立刻生效）
  if (url.pathname.indexOf('/data/') !== -1) {
    e.respondWith(
      fetch(e.request).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        return res;
      }).catch(function () { return caches.match(e.request); })
    );
    return;
  }
  // 应用外壳：缓存优先，后台更新
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      return hit || fetch(e.request).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        return res;
      }).catch(function () { return hit; });
    })
  );
});
