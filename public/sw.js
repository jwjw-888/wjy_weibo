// 让网站可以安装成 App。网页和资料一律从网络读最新内容（断网时用存下的版本）；
// 缩图、头像、表情这类不会变的图片，看过一次就存在手机里，下次直接秒开。
const CACHE = "wjy-weibo-v4", IMG = "wjy-weibo-img-v1";
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(["./", "./index.html", "./manifest.webmanifest"])).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== IMG).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // 外部网站（微博图床、R2）不经过这里
  if (url.origin === location.origin && /\/(thumbs|avatars|emoji|icons|live)\//.test(url.pathname)) {
    e.respondWith(caches.open(IMG).then(c => c.match(req).then(hit => hit || fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }))));
    return;
  }
  e.respondWith(fetch(req).then(res => {
    if (res.ok && url.origin === location.origin) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
    return res;
  }).catch(() => caches.match(req).then(r => r || caches.match("./"))));
});
