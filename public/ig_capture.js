// IG 备份脚本（2026-11-09 第三版）：IG 不再让外部程式直接读 /api/v1/，改成「跟着 IG 自己的网页一起读」。
// 用法：电脑浏览器登入 instagram.com，打开她的主页，F12 → Console 贴上整段按 Enter。
// 脚本会自动往下卷动主页，把 IG 网页自己载入的贴文资料记下来；卷到底后右上角出现粉红色按钮「上传到备份网站」，点它。
// 卷动期间请不要切换分页或关掉视窗（可以放着不动）。再跑一次也没关系：已存过的图会跳过。
(async () => {
  const SITE = "https://wjy-weibo.jwjw888.workers.dev";
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const log = (...a) => console.log("%c[IG备份]", "color:#c13584;font-weight:bold", ...a);
  const user = location.pathname.split("/").filter(Boolean)[0];
  if (location.hostname !== "www.instagram.com" || !user) { alert("请先打开她的 IG 主页（www.instagram.com/帐号/）再执行"); return; }

  // 在任何 JSON 里找「贴文」（有 code、taken_at、图片）和「帐号资料」
  const found = new Map(), prof = {username: user};
  const walk = (o, depth = 0) => {
    if (!o || typeof o !== "object" || depth > 40) return;
    if (Array.isArray(o)) { for (const x of o) walk(x, depth + 1); return; }
    if (typeof o.code === "string" && o.taken_at && (o.image_versions2 || o.carousel_media)) {
      const own = !o.user || !o.user.username || o.user.username === user || (o.coauthor_producers || []).some(u => u.username === user);
      if (own) { const old = found.get(o.code); if (!old || (!old.carousel_media && o.carousel_media) || (old.like_count == null && o.like_count != null)) found.set(o.code, o); }
    }
    if (o.username === user) {
      if (o.full_name) prof.full_name = o.full_name;
      if (o.biography) prof.bio = o.biography;
      if (o.pk || o.id) prof.id = prof.id || String(o.pk || o.id);
      const hd = (o.hd_profile_pic_url_info && o.hd_profile_pic_url_info.url) || o.profile_pic_url_hd;
      if (hd) prof.avatarUrl = hd; else if (o.profile_pic_url && !prof.avatarUrl) prof.avatarUrl = o.profile_pic_url;
      if (o.follower_count) prof.followers = o.follower_count;
    }
    for (const k in o) { const v = o[k]; if (v && typeof v === "object") walk(v, depth + 1); }
  };
  const eat = txt => { if (!txt || txt.length < 20) return; txt = txt.replace(/^for \(;;\);/, ""); for (const line of txt.split("\n")) { try { walk(JSON.parse(line)); } catch (e) {} } };

  // 1) 网页一开始就嵌在原始码里的资料
  document.querySelectorAll('script[type="application/json"]').forEach(s => eat(s.textContent));
  // 2) 之后 IG 网页卷动时载入的资料（拦截 fetch 和 XHR 的回应）
  const of = window.fetch;
  window.fetch = async function (...a) { const r = await of.apply(this, a); try { r.clone().text().then(eat).catch(() => {}); } catch (e) {} return r; };
  const oo = XMLHttpRequest.prototype.open, os = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (...a) { this.addEventListener("load", () => { try { if (!this.responseType || this.responseType === "text") eat(this.responseText); } catch (e) {} }); return os.apply(this, a); };

  const meta = (document.querySelector('meta[property="og:description"]') || {}).content || "";
  const tm = meta.match(/([\d,.]+)\s*(?:則貼文|则帖子|則帖子|posts)/i) || meta.match(/([\d,]+)\s*(?:則|则|篇)/);
  const total = tm ? +tm[1].replace(/[,.]/g, "") : 0;
  log("开始自动往下卷动，目标约", total || "?", "则；请让这个分页保持在最前面");

  // 3) 一直卷到底：连续 10 次（约 20 秒）没有新贴文就当作到底
  let still = 0, last = -1; const allLinks = new Set();
  const grab = () => document.querySelectorAll('a[href*="/p/"],a[href*="/reel/"]').forEach(a => { const c = (a.getAttribute("href").match(/\/(?:p|reel)\/([^/?#]+)/) || [])[1]; if (c) allLinks.add(c); });
  grab();
  while (still < 10) {
    window.scrollTo(0, document.documentElement.scrollHeight);
    await sleep(2000);
    const links = new Set([...document.querySelectorAll('a[href*="/p/"],a[href*="/reel/"]')].map(a => (a.getAttribute("href").match(/\/(?:p|reel)\/([^/?#]+)/) || [])[1]).filter(Boolean));
    const n = found.size;
    log("已读取", n, "/", total || "?", "则（画面上", links.size, "则）");
    if (n === last) still++; else { still = 0; last = n; }
    if (total && n >= total) break;
    links.forEach(c => allLinks.add(c));
  }

  // 4) 画面上出现过、但资料里没有的贴文（通常是最上面一开始就显示的几则）：
  //    先读贴文网页；还是没有的话，回到顶部一则一则点开（IG 点开时会载入完整资料），再关掉
  let miss = [...allLinks].filter(c => !found.has(c));
  if (miss.length) log("补抓", miss.length, "则");
  for (const c of miss) {
    try { const h = await (await of(`/p/${c}/`, {credentials: "include"})).text(); const d = new DOMParser().parseFromString(h, "text/html"); d.querySelectorAll('script[type="application/json"]').forEach(s => eat(s.textContent)); } catch (e) {}
    await sleep(600);
  }
  miss = miss.filter(c => !found.has(c));
  if (miss.length) {
    log("改用点开的方式补抓", miss.length, "则");
    const home = location.href; window.scrollTo(0, 0); await sleep(2500);
    for (const c of miss) {
      let a = null;
      for (let t = 0; t < 30 && !a; t++) { a = document.querySelector(`a[href*="/${c}/"]`); if (!a) { window.scrollBy(0, 600); await sleep(700); } }
      if (!a) { log("找不到", c); continue; }
      a.scrollIntoView({block: "center"}); await sleep(500); a.click();
      for (let t = 0; t < 12 && !found.has(c); t++) await sleep(500);
      log(found.has(c) ? "补到" : "没补到", c);
      if (location.href !== home) { history.back(); await sleep(1500); }
      document.dispatchEvent(new KeyboardEvent("keydown", {key: "Escape", bubbles: true})); await sleep(800);
    }
  }
  window.fetch = of; XMLHttpRequest.prototype.send = os;
  const items = [...found.values()];
  if (!items.length) throw new Error("没有读到任何贴文（请把 Console 截图给 Claude）");
  const u0 = items.find(it => it.user && it.user.username === user);
  if (u0) { prof.full_name = prof.full_name || u0.user.full_name; prof.avatarUrl = prof.avatarUrl || (u0.user.hd_profile_pic_url_info || {}).url || u0.user.profile_pic_url; prof.id = prof.id || String(u0.user.pk || u0.user.id || ""); }
  const stillMiss = [...allLinks].filter(c => !found.has(c));
  if (stillMiss.length) log("仍然缺少", stillMiss.length, "则：", stillMiss.join(" "));
  log("帐号", prof.username, prof.full_name, "共", items.length, "则");

  const best = m => ((m.image_versions2 || {}).candidates || []).slice().sort((a, b) => b.width * b.height - a.width * a.height)[0] || null;
  const posts = items.map(it => {
    const ms = it.carousel_media && it.carousel_media.length ? it.carousel_media : [it];
    return {
      code: it.code, id: String(it.pk || it.id || ""), time: new Date(it.taken_at * 1000).toISOString(),
      text: (it.caption && it.caption.text) || "", likes: it.like_count, comments: it.comment_count, liked_hidden: it.like_and_view_counts_disabled || undefined,
      views: it.play_count || it.view_count || undefined, type: it.product_type || "",
      pinned: !!(it.timeline_pinned_user_ids && it.timeline_pinned_user_ids.length),
      loc: it.location ? it.location.name : "", coauthors: (it.coauthor_producers || []).map(u => u.username),
      media: ms.map((m, i) => { const c = best(m); return {i, key: `ig/${it.code}_${i}.jpg`, url: c && c.url, w: c && c.width, h: c && c.height, video: m.media_type === 2, dur: m.video_duration ? Math.round(m.video_duration) : undefined}; })
    };
  });
  const data = {at: new Date().toISOString(), profile: prof, posts, expected: total, missing: stillMiss};
  log("读取完成", posts.length, "则贴文，请点右上角粉红色按钮");

  const download = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], {type: "application/json"})); a.download = "ig_data.json"; document.body.appendChild(a); a.click(); a.remove(); };
  const btn = document.createElement("button");
  btn.textContent = `上传到备份网站（${posts.length} 则）`;
  btn.style.cssText = "position:fixed;top:16px;right:16px;z-index:999999;background:#c13584;color:#fff;border:0;border-radius:22px;padding:12px 22px;font-size:16px;font-weight:600;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.3)";
  document.body.appendChild(btn);
  btn.onclick = () => {
    const w = window.open(SITE + "/ig-receive.html", "igrecv");
    let got = false;
    const onMsg = async e => {
      if (e.origin !== SITE) return;
      if (e.data === "ready" && !got) { got = true; w.postMessage({type: "data", data}, SITE); btn.textContent = "已送出，请看上传页"; }
      // 上传页说某些图网站抓不到：由这一页下载图片再交给上传页
      if (e.data && e.data.type === "need") {
        for (const {key, url} of e.data.list) {
          try { const b = await (await fetch(url)).blob(); w.postMessage({type: "blob", key, blob: b}, SITE); }
          catch (err) { w.postMessage({type: "blob", key, error: String(err)}, SITE); }
        }
        w.postMessage({type: "blobs-done"}, SITE);
      }
    };
    window.addEventListener("message", onMsg);
    setTimeout(() => { if (!got) { download(); btn.textContent = "已下载 ig_data.json，请在上传页选择它"; } }, 10000);
  };
})().catch(e => { console.error(e); alert("IG 备份出错：" + e.message); });
