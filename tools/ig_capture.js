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
  const get = async u => { for (let i = 0; i < 4; i++) { const r = await fetch(u, {headers: H, credentials: "include"}); if (r.ok) return r.json(); log("读取失败", r.status, "等一下重试…"); await sleep(5000 * (i + 1)); } throw new Error("读取失败：" + u); };

  const user = location.pathname.split("/").filter(Boolean)[0];
  if (location.hostname !== "www.instagram.com" || !user) { alert("请先打开她的 IG 主页（www.instagram.com/帐号/）再执行"); return; }
  const prof = (await get(`/api/v1/users/web_profile_info/?username=${encodeURIComponent(user)}`)).data.user;
  log("帐号", prof.username, prof.full_name, "贴文数", prof.edge_owner_to_timeline_media && prof.edge_owner_to_timeline_media.count);

  const items = []; let max = "";
  do {
    const r = await get(`/api/v1/feed/user/${prof.id}/?count=33${max ? "&max_id=" + encodeURIComponent(max) : ""}`);
    items.push(...(r.items || [])); log("已读取", items.length, "则");
    max = r.more_available ? r.next_max_id : ""; await sleep(1200);
  } while (max);

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
  const data = {at: new Date().toISOString(), profile: {username: prof.username, full_name: prof.full_name, bio: prof.biography, id: prof.id,
    followers: prof.edge_followed_by && prof.edge_followed_by.count, following: prof.edge_follow && prof.edge_follow.count,
    avatarUrl: (prof.hd_profile_pic_url_info || {}).url || prof.profile_pic_url_hd}, posts};
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
