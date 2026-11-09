// IG 备份脚本：用电脑浏览器登入 instagram.com，打开吴谨言的 IG 主页（https://www.instagram.com/<帐号>/），
// 按 F12 → Console，把整段贴进去按 Enter。读完贴文后，页面右上角会出现粉红色按钮「上传到备份网站」，点它。
// 会打开备份网站的上传页（ig-receive.html），由那一页把图片存进 R2、资料放进暂存区 /staging/7。
// （IG 不允许在它的页面直接连到别的网站，所以要多开一页来上传。）
// 若上传页没有接到资料，脚本会自动下载 ig_data.json，到上传页按「选择档案」选它即可。
// 再跑一次也没关系：已存过的图会跳过，只补新的。
(async () => {
  const SITE = "https://wjy-weibo.jwjw888.workers.dev";
  const H = {"X-IG-App-ID": "936619743392459", "X-Requested-With": "XMLHttpRequest"};
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const log = (...a) => console.log("%c[IG备份]", "color:#c13584;font-weight:bold", ...a);
  // 404/400 表示这个读法 IG 不支援了，不重试，直接换下一个读法
  const get = async u => { for (let i = 0; i < 4; i++) { const r = await fetch(u, {headers: H, credentials: "include"}); if (r.ok) return r.json(); log("读取失败", r.status, u); if (r.status === 404 || r.status === 400) break; log("等一下重试…"); await sleep(5000 * (i + 1)); } throw new Error("读取失败：" + u); };
  const tryGet = async u => { try { return await get(u); } catch (e) { return null; } };

  const user = location.pathname.split("/").filter(Boolean)[0];
  if (location.hostname !== "www.instagram.com" || !user) { alert("请先打开她的 IG 主页（www.instagram.com/帐号/）再执行"); return; }
  // 帐号资料：先用 web_profile_info；IG 不给的话，从网页原始码找帐号 ID，再从贴文里拿名字、头像
  let prof = null, info = await tryGet(`/api/v1/users/web_profile_info/?username=${encodeURIComponent(user)}`);
  if (info && info.data && info.data.user) { const u = info.data.user; prof = {id: u.id, username: u.username, full_name: u.full_name, bio: u.biography, followers: u.edge_followed_by && u.edge_followed_by.count, following: u.edge_follow && u.edge_follow.count, avatarUrl: (u.hd_profile_pic_url_info || {}).url || u.profile_pic_url_hd}; }
  if (!prof) {
    const html = document.documentElement.innerHTML;
    const m = html.match(/"profilePage_(\d+)"/) || html.match(/"profile_id":"(\d+)"/) || html.match(/"target_id":"(\d+)"/) || html.match(new RegExp('"pk":"(\\d+)","username":"' + user.replace(/\./g, '\\.') + '"')) || html.match(new RegExp('"id":"(\\d+)","username":"' + user + '"'));
    const meta = (document.querySelector('meta[property="og:description"]') || {}).content || "";
    prof = {id: m ? m[1] : "", username: user, bio: ""};
    log("改用备用读法，帐号 ID", prof.id || "（找不到，改用帐号名称读取）", meta);
  }

  const items = []; let max = "";
  const feedUrl = mx => prof.id ? `/api/v1/feed/user/${prof.id}/?count=33${mx ? "&max_id=" + encodeURIComponent(mx) : ""}` : `/api/v1/feed/user/${encodeURIComponent(user)}/username/?count=33${mx ? "&max_id=" + encodeURIComponent(mx) : ""}`;
  do {
    let r = await tryGet(feedUrl(max));
    if (!r && prof.id && !items.length) { prof.id = ""; r = await tryGet(feedUrl(max)); }
    if (!r) { if (!items.length) throw new Error("IG 不给读取贴文（请把 Console 的红字截图给 Claude）"); log("后面的贴文读取失败，先用已读到的", items.length, "则"); break; }
    items.push(...(r.items || [])); log("已读取", items.length, "则");
    if (r.user && !prof.full_name) { prof.id = prof.id || String(r.user.pk || r.user.id || ""); prof.full_name = r.user.full_name; prof.avatarUrl = prof.avatarUrl || (r.user.hd_profile_pic_url_info || {}).url || r.user.profile_pic_url; }
    max = r.more_available ? r.next_max_id : ""; await sleep(1200);
  } while (max);
  const u0 = items[0] && (items[0].user || items[0].owner);
  if (u0) { prof.full_name = prof.full_name || u0.full_name; prof.avatarUrl = prof.avatarUrl || (u0.hd_profile_pic_url_info || {}).url || u0.profile_pic_url; prof.id = prof.id || String(u0.pk || u0.id || ""); }
  log("帐号", prof.username, prof.full_name, "ID", prof.id);

  const best = m => ((m.image_versions2 || {}).candidates || []).slice().sort((a, b) => b.width * b.height - a.width * a.height)[0] || null;
  const posts = items.map(it => {
    const ms = it.carousel_media && it.carousel_media.length ? it.carousel_media : [it];
    return {
      code: it.code, id: String(it.pk), time: new Date(it.taken_at * 1000).toISOString(),
      text: (it.caption && it.caption.text) || "", likes: it.like_count, comments: it.comment_count,
      views: it.play_count || it.view_count || undefined, type: it.product_type || "",
      pinned: !!(it.timeline_pinned_user_ids && it.timeline_pinned_user_ids.length),
      loc: it.location ? it.location.name : "", coauthors: (it.coauthor_producers || []).map(u => u.username),
      media: ms.map((m, i) => { const c = best(m); return {i, key: `ig/${it.code}_${i}.jpg`, url: c && c.url, w: c && c.width, h: c && c.height, video: m.media_type === 2, dur: m.video_duration ? Math.round(m.video_duration) : undefined}; })
    };
  });
  const data = {at: new Date().toISOString(), profile: prof, posts};
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
