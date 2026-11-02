// 让网站可以安装成 App。网页和资料一律从网络读最新内容（断网时用存下的版本）；
// 缩图、头像这类不会变的图片，看过一次就存在手机里，下次直接秒开。
// 表情可能会换图：先用手机里存的，同时在背景向网站确认，有新图就换掉，下次打开就是新的（2026-11-02）。
const CACHE = "wjy-weibo-v5", IMG = "wjy-weibo-img-v1";
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(["./", "./index.html", "./manifest.webmanifest"])).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== IMG).map(k => caches.delete(k))))
    .then(() => caches.open(IMG)).then(c => c.keys().then(rs => Promise.all(rs.filter(r => /\/emoji\//.test(r.url)).map(r => c.delete(r)))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // 外部网站（微博图床、R2）不经过这里
  if (/\/(emoji|icons)\//.test(url.pathname)) {
    e.respondWith(caches.open(IMG).then(c => c.match(req).then(hit => {
      const net = fetch(req, {cache: "no-cache"}).then(res => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
      if (hit) { e.waitUntil(net); return hit; }
      return net;
    })));
    return;
  }
  if (url.origin === location.origin && /\/(thumbs|avatars|live)\//.test(url.pathname)) {
    e.respondWith(caches.open(IMG).then(c => c.match(req).then(hit => hit || fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }))));
    return;
  }
  e.respondWith(fetch(req).then(res => {
    if (res.ok && url.origin === location.origin) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
    return res;
  }).catch(() => caches.match(req).then(r => r || caches.match("./"))));
});
