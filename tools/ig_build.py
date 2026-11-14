# IG 备份整理：从暂存区 /staging/7 取回 ig_capture.js 抓的资料，做压缩图，写出 public/data/ig.json。
# 用法：python3 tools/ig_build.py        （跑完确认没问题再 DELETE /staging/7）
# 影片只存 R2 的 ig/video/（不进 GitHub），ig.json 里记 vsrc。
# 压缩图：长边 1080、JPEG 品质 80，存 public/thumbs/ig/；原图在 R2 的 ig/（网页「查看原图」用）。
# 已存在的压缩图不重做；旧的 ig.json 里有、这次没抓到的贴文会保留（她删掉的贴文也留着）。
import json, os, io, sys, urllib.request
from PIL import Image
SITE = "https://wjy-weibo.jwjw888.workers.dev"
OUT = "public/data/ig.json"; TH = "public/thumbs/ig"
os.makedirs(TH, exist_ok=True)
get = lambda u: urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "wjy-archive"}), timeout=60).read()
new = json.loads(get(SITE + "/staging/7"))
old = json.load(open(OUT, encoding="utf-8")) if os.path.exists(OUT) else {"posts": []}
byc = {p["code"]: p for p in old["posts"]}

def thumb(key, size=1080):
  path = os.path.join("public/thumbs", key)
  if os.path.exists(path): return True
  try: b = get(SITE + "/r2-ig/" + key[3:])
  except Exception as e: print("缺图", key, e); return False
  im = Image.open(io.BytesIO(b)).convert("RGB"); im.thumbnail((size, size), Image.LANCZOS)
  im.save(path, "JPEG", quality=80, optimize=True, progressive=True); return True

# 先并行做好全部压缩图（8 条线同时下载）
from concurrent.futures import ThreadPoolExecutor
keys = [m["key"] for p in new["posts"] for m in p["media"] if m.get("r2")]
with ThreadPoolExecutor(8) as ex: done = dict(zip(keys, ex.map(thumb, keys)))
prof = new["profile"]
if prof.get("avatar") and not thumb(prof["avatar"], 240): prof["avatar"] = ""
for p in new["posts"]:
  media = []
  for m in p["media"]:
    ok = m.get("r2") and (done.get(m["key"]) or thumb(m["key"]))
    if not ok: print("略过（没有图）", m["key"]); continue
    media.append({k: v for k, v in {"src": m["key"], "w": m.get("w"), "h": m.get("h"), "video": m.get("video") or None, "dur": m.get("dur"), "vsrc": m.get("vkey") if m.get("vr2") else None}.items() if v is not None})
  if not media: continue
  q = {k: v for k, v in p.items() if k not in ("media", "id") and v not in (None, "", [], False)}
  q["media"] = media; byc[p["code"]] = q
posts = sorted(byc.values(), key=lambda p: p["time"], reverse=True)
json.dump({"at": new["at"], "profile": prof, "posts": posts}, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("贴文", len(posts), "图片", sum(len(p["media"]) for p in posts), "ig.json", os.path.getsize(OUT), "失败", new.get("failed"))

# 把 ig.json 大小写进 ig.html，网页一开始就能显示下载百分比
import re
hp = "public/ig.html"; h = open(hp, encoding="utf-8").read()
h = re.sub(r'<meta name="data-size" content="[^"]*">', '<meta name="data-size" content="%d">' % os.path.getsize(OUT), h, count=1)
open(hp, "w", encoding="utf-8").write(h)

# 格子用的小图（400×533，约 25KB）：首页格子不用载 1080 的大图，网路慢也能很快看到（2026-11-14）
from PIL import Image as _I, ImageOps as _O
os.makedirs("public/thumbs/igt", exist_ok=True)
for p in posts:
  s = p["media"][0]["src"]; o = "public/thumbs/igt/" + os.path.basename(s)
  if not os.path.exists(o): _O.fit(_I.open(os.path.join("public/thumbs", s)).convert("RGB"), (400, 533)).save(o, quality=72, optimize=True, progressive=True)
