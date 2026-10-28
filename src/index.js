// 网站本体是静态文件（public/）。这个小程序只处理 /r2-archive/ 路径：
// 把网站资料里已有的微博原图，从微博图床存进 R2（bucket: jwjw）。
// 只接受 public/data/posts.json 里列出的图片，避免被拿来存别的东西。

let allow = null, allowAt = 0;

async function loadAllow(env, request) {
  if (allow && Date.now() - allowAt < 60_000) return allow;
  const res = await env.ASSETS.fetch(new URL("/data/posts.json", request.url));
  const data = await res.json();
  const map = new Map();
  for (const p of data.posts) {
    for (const q of [p, p.rt].filter(Boolean)) {
      for (const x of q.pics || []) if (x.orig && !x.nolink) map.set(x.src, x.orig);
      if (q.video && q.video.coverOrig) map.set(q.video.cover, q.video.coverOrig);
    }
  }
  allow = map; allowAt = Date.now();
  return map;
}

// 暂存区：浏览器把抓到的资料传上来，Claude 再取走整理。只有 10 个固定位置、每个最多 90 MB。
async function staging(request, env, url) {
  const slot = url.pathname.slice("/staging/".length);
  if (!/^[0-9]$/.test(slot)) return json({error: "slot must be 0-9"}, 400);
  const key = "staging/" + slot;
  if (request.method === "PUT" || request.method === "POST") {
    const len = +(request.headers.get("content-length") || 0);
    if (len > 90 * 1024 * 1024) return json({error: "too large"}, 413);
    const body = await request.arrayBuffer();
    if (body.byteLength > 90 * 1024 * 1024) return json({error: "too large"}, 413);
    await env.BUCKET.put(key, body, {httpMetadata: {contentType: "application/octet-stream"}, customMetadata: {at: new Date().toISOString()}});
    return json({slot, status: "stored", size: body.byteLength});
  }
  if (request.method === "GET") {
    const obj = await env.BUCKET.get(key);
    if (!obj) return json({slot, status: "empty"}, 404);
    return new Response(obj.body, {headers: {"content-type": "application/octet-stream", "cache-control": "no-store", "x-stored-at": (obj.customMetadata || {}).at || ""}});
  }
  if (request.method === "DELETE") { await env.BUCKET.delete(key); return json({slot, status: "deleted"}); }
  return json({error: "method"}, 405);
}

const json = (obj, status = 200) => new Response(JSON.stringify(obj), {status, headers: {"content-type": "application/json; charset=utf-8", "cache-control": "no-store"}});

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/staging/")) return staging(request, env, url);
    if (!url.pathname.startsWith("/r2-archive/")) return env.ASSETS.fetch(request);
    if (request.method !== "POST") return json({error: "use POST"}, 405);
    const key = decodeURIComponent(url.pathname.slice("/r2-archive/".length));
    const map = await loadAllow(env, request);
    const src = map.get(key);
    if (!src) return json({key, status: "not-allowed"}, 403);
    const head = await env.BUCKET.head(key);
    if (head) return json({key, status: "exists", size: head.size});
    const up = await fetch(src.replace(/^http:/, "https:"), {headers: {"Referer": "https://weibo.com/", "User-Agent": "Mozilla/5.0"}});
    if (!up.ok) return json({key, status: "fetch-failed", code: up.status}, 502);
    const body = await up.arrayBuffer();
    await env.BUCKET.put(key, body, {httpMetadata: {contentType: up.headers.get("content-type") || "image/jpeg"}});
    return json({key, status: "saved", size: body.byteLength});
  }
};
