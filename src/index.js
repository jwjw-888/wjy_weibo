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
      for (const x of q.pics || []) { if (x.orig && !x.nolink) map.set(x.src, x.orig); if (x.custom) map.set(x.src, "custom"); }
      if (q.video && q.video.coverOrig) map.set(q.video.cover, q.video.coverOrig);
    }
  }
  allow = map; allowAt = Date.now();
  return map;
}

// 暂存区：浏览器把抓到的资料传上来，Claude 再取走整理。只有 10 个固定位置、每个最多 90 MB。
const CORS = {"Access-Control-Allow-Origin": "https://weibo.com", "Access-Control-Allow-Methods": "GET, PUT, POST, DELETE, OPTIONS", "Access-Control-Allow-Headers": "content-type", "Access-Control-Max-Age": "86400"};
async function staging(request, env, url) {
  if (request.method === "OPTIONS") return new Response(null, {status: 204, headers: CORS});
  const res = await stagingInner(request, env, url);
  const h = new Headers(res.headers); for (const [k, v] of Object.entries(CORS)) h.set(k, v);
  return new Response(res.body, {status: res.status, headers: h});
}
async function stagingInner(request, env, url) {
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


// Live 图的动态部分：只接受微博 livephoto 播放链接，存到 R2 的 live/<fid>.mov。
async function liveArchive(request, env) {
  if (request.method === "OPTIONS") return new Response(null, {status: 204, headers: CORS});
  const out = await liveInner(request, env);
  const h = new Headers(out.headers); for (const [k, v] of Object.entries(CORS)) h.set(k, v);
  return new Response(out.body, {status: out.status, headers: h});
}
async function liveInner(request, env) {
  if (request.method !== "POST") return json({error: "use POST"}, 405);
  const {url} = await request.json().catch(() => ({}));
  let u; try { u = new URL(url); } catch { return json({error: "bad url"}, 400); }
  if (u.hostname !== "video.weibo.com" || u.pathname !== "/media/play") return json({error: "not livephoto"}, 403);
  const inner = u.searchParams.get("livephoto") || "";
  const m = inner.match(/^https:\/\/(?:us|livephoto\.us)\.sinaimg\.cn\/([A-Za-z0-9]+)\.mov$/);
  if (!m) return json({error: "not livephoto"}, 403);
  const key = "live/" + m[1] + ".mov";
  const head = await env.BUCKET.head(key);
  if (head) return json({key, status: "exists", size: head.size});
  const up = await fetch(u.toString(), {headers: {"Referer": "https://weibo.com/", "User-Agent": "Mozilla/5.0"}});
  if (!up.ok) return json({key, status: "fetch-failed", code: up.status}, 502);
  const body = await up.arrayBuffer();
  if (body.byteLength < 1000 || body.byteLength > 50 * 1024 * 1024) return json({key, status: "bad-size", size: body.byteLength}, 502);
  await env.BUCKET.put(key, body, {httpMetadata: {contentType: "video/quicktime", cacheControl: "public, max-age=31536000"}});
  return json({key, status: "saved", size: body.byteLength});
}

// 用量：统计 R2 里的文件总大小，给每周检查免费额度用。
async function usage(env) {
  let cursor, bytes = 0, objects = 0;
  do {
    const r = await env.BUCKET.list({cursor, limit: 1000});
    for (const o of r.objects) { bytes += o.size; objects++; }
    cursor = r.truncated ? r.cursor : undefined;
  } while (cursor);
  const freeBytes = 10 * 1024 ** 3;
  return json({objects, bytes, gb: +(bytes / 1024 ** 3).toFixed(3), freeGb: 10, percent: +(bytes / freeBytes * 100).toFixed(1), at: new Date().toISOString()});
}

const json = (obj, status = 200) => new Response(JSON.stringify(obj), {status, headers: {"content-type": "application/json; charset=utf-8", "cache-control": "no-store"}});

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/staging/")) return staging(request, env, url);
    if (url.pathname === "/usage") return usage(env);
    if (url.pathname === "/img-check") {
      const u = url.searchParams.get("u") || "";
      if (!/^https:\/\/wx\d\.sinaimg\.cn\/[a-z0-9]+\/[A-Za-z0-9]+\.(jpg|gif|png)$/.test(u)) return json({error: "bad"}, 400);
      const base = {"User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36", "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8", "Sec-Fetch-Dest": "image", "Sec-Fetch-Mode": "no-cors", "Sec-Fetch-Site": "cross-site"};
      const out = {};
      for (const [k, h] of Object.entries({gh: {Referer: "https://jwjw-888.github.io/"}, ghpath: {Referer: "https://jwjw-888.github.io/wjy_weibo/"}, cf: {Referer: "https://wjy-weibo.jwjw888.workers.dev/"}, weibo: {Referer: "https://weibo.com/"}, none: {}})) {
        const r = await fetch(u, {headers: {...base, ...h}});
        out[k] = [r.status, r.headers.get("content-type"), r.headers.get("content-length")];
      }
      return json(out);
    }
    if (url.pathname === "/r2-live") return liveArchive(request, env);
    // 用户上传的替换原图：先 PUT 到暂存区，再搬到 posts.json 里标了 custom 的路径。
    if (url.pathname === "/r2-promote" && request.method === "POST") {
      const slot = url.searchParams.get("slot") || "", key = url.searchParams.get("key") || "";
      if (!/^[0-9]$/.test(slot)) return json({error: "slot"}, 400);
      const map = await loadAllow(env, request);
      if (map.get(key) !== "custom") return json({key, status: "not-allowed"}, 403);
      const obj = await env.BUCKET.get("staging/" + slot);
      if (!obj) return json({status: "staging-empty"}, 404);
      const ct = key.endsWith(".webp") ? "image/webp" : key.endsWith(".png") ? "image/png" : "image/jpeg";
      await env.BUCKET.put(key, obj.body, {httpMetadata: {contentType: ct}});
      await env.BUCKET.delete("staging/" + slot);
      return json({key, status: "saved"});
    }
    if (url.pathname.startsWith("/r2-live/") && request.method === "GET") {
      const key = "live/" + url.pathname.slice("/r2-live/".length);
      if (!/^live\/[A-Za-z0-9]+\.mov$/.test(key)) return json({error: "bad key"}, 400);
      const obj = await env.BUCKET.get(key);
      if (!obj) return json({key, status: "missing"}, 404);
      return new Response(obj.body, {headers: {"content-type": "video/quicktime"}});
    }
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
