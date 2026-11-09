# 维护笔记（原 README）

网站：https://wjy-weibo.jwjw888.workers.dev/

- `public/index.html`：网页
- `public/data/posts.json`：微博内容（含「半年可见」转载）
- `public/data/comments.json`：热门评论前 5 名和吴谨言本人的回复
- `public/data/dims.json`：图片尺寸
- `public/thumbs/`：压缩后的图片（原图另存在 R2）

推送到 main 分支后，Cloudflare 会自动部署。

## 头像
每条微博的 `avatar` 字段记录抓取当时吴谨言的头像（存于 `public/avatars/`，文件名为微博图片 ID）。
以后每次更新时，新抓到的微博要记录当时的头像；若头像已更换，存成新文件，旧微博保留原来的头像。
最早一批（2026-10-28 首次备份）因为抓不到历史头像，统一使用当天的头像。

## 不备份的转发
转发自以下账号的微博不备份：@新华社、@人民日报、@央视新闻、@中国电影报道。
她与这些账号的「共创」微博（显示为她本人发布）要保留。

## 2010—2024年6月的微博
来自「吴谨言的微博书」（weiboshu.com/books/427ca300），共 1141 条（与半年可见重复的 2024-04-16 一条除外）。
文字按书的排版还原，表情符号在书里是图片，无法还原，已省略。网站显示的是 600 宽的压缩图；「查看原图」目前链接到微博图床的原图。

## 表情
`public/emoji/` 是微博官方的表情图片，`public/data/emoji.json` 是「[表情名] → 图片文件」的对照表。
以后更新遇到新的表情，要从微博的表情列表（或微博原文里的表情图）补进来。

## 共创微博
共创微博在 `posts.json` 里有 `coop` 字段（共创者名字和头像），标题显示「A 与 B 的共创微博」。
以后更新时，从微博的 `cooperate_info` 读取共创者。

## 原图存进 R2
`src/index.js` 提供 `POST /r2-archive/<路径>`（例如 `/r2-archive/img/xxx.jpg`），网站会把该图从微博图床抓下来存进 R2 bucket `jwjw`。
只接受 `posts.json` 里已有的图片。存好之后，把该图在 `posts.json` 的 `r2:false` 拿掉，「查看原图」就会改用 R2。

## 暂存区（更新用）
`/staging/0`～`/staging/9`：浏览器用 PUT 上传抓到的资料（每个最多 90 MB），Claude 用 GET 取回后再 DELETE。
资料存在 R2 的 `staging/` 底下，不会直接显示在网站上。

## 链接显示
文中的 t.cn 短链接不显示网址，改为显示微博的链接标题（例如「🔗微博视界大会·年度推荐」），不可点击。
标题对照存在 `public/data/links.json`（从微博的 `url_struct` 取得）；查不到标题的显示「网页链接」。以后更新时要一起补上新链接的标题。

## 两个网址
- Cloudflare：https://wjy-weibo.jwjw888.workers.dev/
- GitHub Pages：https://jwjw-888.github.io/wjy_weibo/
推送到 main 后两边都会自动更新。网页里的路径都要用相对路径（不要以 / 开头），GitHub Pages 才能正常显示。
两个网址的「查看原图」都连 R2。

## 加速（2026-10-28）
- 资料改成一个压缩档 `data/all.json`：**每次修改 data/ 下任何 JSON 后都要执行 `python3 tools/bundle.py`**。
- 2026-11-06：bundle.py 另外产生很小的 `data/head.json`（最新 12 条＋评论＋全站统计），网页先显示它，完整的 all.json 在背景下载、到了无缝接上；下载卡住会中断重试；完整资料没到前点筛选/搜索会显示「完整资料载入中」。
- 动态里的缩图维持用 `thumbs/`（用户觉得小缩图不清楚，2026-10-28 改回）。
- sw.js 会把缩图/头像/表情存进手机，第二次打开直接从本地读。

## Live 图（2026-10-28 起）
- Live 图要存（不算视频）。`/ajax/statuses/show` 的 `pic_infos[pid].type === "livephoto"`，`video` 是 video.weibo.com 播放链接（几小时后过期）。
- 在 weibo.com 分页里把播放链接 POST 到 `/r2-live`（JSON `{url}`），worker 存原档到 R2 `live/<fid>.mov`；`GET /r2-live/<fid>.mov` 可取回。
- 工作区取回后用 ffmpeg 转成 `public/live/<fid>.mp4`（短边 720、H.264 CRF25、faststart），posts.json 里该图加 `"live": "live/<fid>.mp4"`。
- mix_media_info 有视频时，图片与视频依原微博顺序排列。
- 2024/06 以前（微博书）的贴文已不可见，抓不到 Live 动态部分。

## 不备份留言的用户（以 uid 为准，改昵称也一样）
- 7036596512（原昵称：小君-kiki）
- 7492962323（原昵称：叫我湘菜大王）
- 6664185690（原昵称：小掀被）
- 7890389247（原昵称：小1摘樱桃）
- 7219895881（原昵称：小葵不是魁）
- 7556898955（原昵称：这里是格格巫）
- 5867796382（原昵称：阮卿卿田园系_破忒头）
- 6582011218（原昵称：双木不仄言_阮卿卿的亲亲）
- 7440139822（原昵称：阮卿卿苍天鉴忠奸）
- 6375609645（原昵称：阮卿卿话多说一点）
- 7421237358（原昵称：是王玉玉yu呀）
- 5663774992（原昵称：阮卿卿清风送鼓声_卿别黑化版）
- 7416177919（原昵称：REveries_nee）
- 内容或昵称含「魏哲鸣」「萧玦」「萧块」的留言也不备份。
**例外：吴谨言回复过的留言不受以上限制**（封杀名单、关键词都不管），一律保留在「她有回复」。

## 评论区选法（2026-10-31 起）
- 每篇收 **5 位不同粉丝** 的留言（不再是按点赞前 5 名）。先用 `tools/pick_comments.py` 从热门评论（约 100 条）筛掉封杀名单、关键词、认证账号（官方/明星）、吴谨言本人、只有客套话的、刷屏、超话打榜、负面找茬的，得到候选。认证账号只排除官方/机构蓝 V（verified_type 1~7）和明星本人；黄 V 个人认证的粉丝要收（2026-10-31 修正）。带图留言的图片编号用微博手机版 m.weibo.cn `/comments/hotflow` 取得（`pic.pid`），存成 {评论id: pid} 后用 `--cpics` 传入。
- **再由 Claude 逐则看候选、人工挑 5 则**（用户 2026-10-31 指定），优先顺序：有趣有梗的、好笑的、真心祝福的、诚恳的、认真提建议的。不要只挑点赞高的，也不要五则都同一种；同一人每篇最多 1 则，**以留言内容为准**：挑的时候不看点赞数，只看内容有不有趣、真不真心；**维持多样性，不要固定挑某些人**（用户 2026-10-31）：每次更新挑之前先统计全站谁已被选过几次，内容差不多好时，优先选还没出现过的新面孔；但常客不是被排除，他们的留言好还是可以选，但**全站每人最多 5 则**（用户 2026-10-31 定）（bucciarati927 也一样 5 则）；71t小秦不开心就吃饭 维持少量（目前 2 则）；Youik52e-是卿卿还是亲亲（uid 7372822197）、vollim（uid 7530399806）各最多 3 则。**「71t小秦不开心就吃饭」（uid 5562007520）全站只保留少数几则**（用户 2026-10-31 要求减少，目前 2 则），新的更新尽量不选她。挑好的 id 写进 `tools/picks.json`（{贴文id: [评论id...]}），再执行 `python3 tools/pick_comments.py <评论json> --picks tools/picks.json` 产生 comments.json。
- 浏览器抓评论（`/ajax/statuses/buildComments`，flow=0，5 页约 100 则）时，每则要带 id、uid、昵称、avatar_hd、verified、created_at、text_raw、like_counts、pic_num、**source（IP 属地）**，以及子评论里吴谨言的回复（同样字段）。
- 每则评论存 `region`（微博评论的 IP 属地「来自 X」，去掉「来自 」），网页显示在时间后面；吴谨言的回复也存，代表她当时的所在地。
- 吴谨言回复过的留言另外放在「她有回复」区，全收，不受封杀名单和关键词限制。

## 用户上传的替换图片
- 只换缩图（没有原图链接）：pics 项设 `nolink: true, r2: false`。
- 连原图也换：pics 项设 `custom: true`，缩图放 `thumbs/<key>`；原图 `PUT /staging/N` 后 `POST /r2-promote?slot=N&key=<key>` 存进 R2 同名路径。
- 显示成全黑但保留资料：pics 项加 `hide: true`（档案与原资料不删）。再加 `hideImg: "img/xxx.jpg"` 就改显示该图（2019/02/25 用户指定换成 404 图 img/notfound-404-custom.jpg）。
- 整篇只显示一张黑图（不显示文字、图片、评论，也搜不到）：贴文加 `blank: true`，原内容保留在资料里。例：bk-5078111739186168（2024/09/13）。若要显示指定图片而不是黑图，加 `blankImg: "img/xxx-custom.jpg"`（2024/09/13 用户指定换成 404 图 img/notfound-404-custom.jpg）。
- 「原微博」链接只显示在发布未满半年（183 天）的微博，按浏览当天自动计算。
- 盐圈大管家转载的视频：封面直接连到该条盐圈微博（via.url），点了就能去看影片，不只是截图。
- 每次更新检查盐圈大管家「小吴老师的半年可见」时：如果新转载的是网站上已有的吴谨言视频微博（同一天、同内容），不另外新增一篇，而是把那条盐圈微博的链接加到原贴（`video.watch` = 盐圈微博网址），让封面可以点去看视频。

## 备用原图（给中国用户）
- 看大图时「查看原图」连 R2（每张都存在 R2）；旁边「备用原图」连微博图床（sinaimg，中国连得上）。微博图床拒绝「没有来源网址」的请求（403），所以「备用原图」是在看图视窗里用 referrerpolicy="origin" 直接载入，不另开分页（另开分页在 App 模式下可能不带来源）。sw.js 不拦截外部网址。
- 盐圈大管家备份的贴文：备用原图就是盐圈那份图。吴谨言自己的贴文：用她微博的图。
- 更新时若发现盐圈大管家备份了她的某篇（同日同内容），把盐圈对应图片的 sinaimg 网址写进该图的 `alt`，备用原图会优先用盐圈那份。
- 微博书（2024/06 以前）贴文和用户上传替换的图片没有备用原图。
- 2026-10-30 实测：微博图床只在「来源是 weibo.com」时才给图（外站来源、无来源都 403，除非该图刚好已被缓存），所以备用原图直连微博行不通，按钮暂时隐藏。
- 盐圈大管家备份的贴文，右上角显示「大管家备份 ↗」连到那条盐圈微博（可去看视频、原图）。吴谨言自己的贴文若之后被盐圈备份，把盐圈网址写进该贴的 `backup` 字段，也会显示这个链接。

## 英文版（中文 / ENG 切换，2026-10-30）
- 右上角「中文 / ENG」切换，选择记在浏览器里；英文翻译在 `data/en.json`（只有选 ENG 才下载）。
- 翻译库 `tools/en/tr.json`（key = 中文原文 md5 前 10 码）。剧名对照与规则见 `tools/en/glossary.md`：**剧名只用查得到的官方英文名，查不到保留中文**。
- 每次更新后：`python3 tools/en/extract.py` 列出新文字（src-NN.json）→ 翻译写成 en-NN.json → `python3 tools/en/merge.py` → `python3 tools/en/build.py` → 删掉 src/en 暂存档。
- 翻译时遇到不确定的专有名词（剧名、角色、官署、昵称、粉丝用语等），**先列出来问用户**，确认后再翻并加进 glossary.md，不要自己猜或音译。
- 「角色感言」分类：posts.json 里 `essay: true` 的贴文（杀青感想、收官/大结局感言、播剧期间对角色/剧的感想，多为中长文）。每次更新时挑出符合的新贴文加上这个标记，不确定的先问用户。

## 访客统计（2026-11-01）
- Microsoft Clarity，专案 ID `z6pvep9vf7`（代码在 index.html 的 <head>）。后台：clarity.microsoft.com（用户自己的账号）。两个网址都会统计；中国大陆能否稳定统计未确认。

## 超话空降（2026-11-02 起）
- **每次「更新」都要一并检查她有没有新的超话空降**（用户 2026-11-02 定）：她自己发的超话帖、她在帖下的留言/回复、她留在粉丝帖下的评论，都放「超话空降」。先查 m.weibo.cn `<超话containerid>_-_landing`（吴谨言超话、以及当时在播剧的超话）和 searchProfile q=超话，有新日期再按下面方法扫。
- 吴谨言在超话发的帖子放在 `posts.json`，加 `"ch": "吴谨言超话"`、`source: "吴谨言超话"`；网页只在「超话空降」分类显示，不和微博混在一起（其他分类都排除 `ch`）。
- 她发在别的超话、同时也出现在她主页时间线的帖（例如 #电视剧御廷谣[超话]# 两条）照旧算一般微博，不重复收。
- 找帖：weibo.com `/ajax/statuses/searchProfile?uid=1278603180&q=吴谨言超话&page=N`（可加 starttime/endtime）。只找得到约半年内的；2026-07-26 以前搜不到（半年可见）。m.weibo.cn 超话的「空降超话」`<containerid>_-_landing` 只列最近一次空降。
- 她的留言：她在自己超话帖下发的留言记成 `isAuthorComment: true`（她自己在该留言下的回复放 `replies`）；她回复粉丝的照常放「她有回复」。她的回复常藏在楼中楼里，要对 `total_number` 大于预览数的每一楼用 `buildComments?fetch_level=1&id=<楼id>` 翻完找 uid 1278603180。留言里的图片编号用 m.weibo.cn `/comments/hotflow`、`/comments/hotFlowChild` 取。
- 粉丝留言照一般规则人工挑 5 则（tools/picks.json）。
- 她留在粉丝帖下的评论（2024 年等，她自己的帖已半年可见看不到）：照超话原样，**主体是粉丝的帖**（posts.json 加 `fan: {user, avatar}`、`cmtOn: true`，avatar 存 avatars/u/），**她的评论放 comments.json 的 author（isAuthorComment）**，黄底区预设展开。找法：s.weibo.com 按小时搜该超话的帖（timescope=custom:YYYY-MM-DD-HH:...，每次请求间隔 ≥1.5 秒，否则会被挡 418），再用 weibo.com buildComments 查每帖有没有 uid 1278603180。

## 艺人与公众人物留言（2026-11-05 起）
- 艺人/公众人物（演员、歌手、导演、编剧、配音演员等，看微博认证说明 verified_reason；不含官方/后援会等蓝 V 机构、也不含「博主」「超话主持人」）的留言全部备份，放在「艺人与公众人物留言」区，底色 #A9D1D1。
- 留言区顺序：她的回复（第一位）→ 艺人与公众人物留言 → 粉丝留言。她回复过的艺人留言只放在「她有回复」，不在艺人区重复。
- 名单在 `tools/celebs.json`（uid）；pick_comments.py 会自动把名单里的人放进 comments.json 的 `celeb`。以后遇到新的黄 V 留言者，用 `/ajax/profile/info?uid=` 看认证说明，是艺人就加进名单。

## 粉丝留言固定（2026-11-07 用户定）
- 已经备份、挑好的粉丝留言，以后更新时**不换人**，只更新点赞数；pick_comments.py 默认就是这样。
- 只有用户下指令要换时，才加 `--repick` 重新挑（或直接改 comments.json / picks.json 那一篇）。
- 用户指定、但抓不到的留言（折叠区、截图补的），存成手动条目，picker 会保留。

## IG 备份（2026-11-09 起）
- 网页：`public/ig.html`（主页「超话空降」旁的「IG备份 ›」链接进去），资料 `public/data/ig.json`，压缩图 `public/thumbs/ig/`（长边 1080），原图在 R2 `ig/<贴文代码>_<序号>.jpg`、头像 `ig/avatar.jpg`。
- 贴文文字、图片都备份；视频（2026-11-09 起）只存 R2 的 `ig/video/<代码>_<序号>.mp4`，不进 GitHub，ig.json 的 `vsrc` 记路径，大图里直接播放。
- 抓取（IG 的 /api/v1/ 对脚本一律 404，改为拦截 IG 网页自己的资料、自动卷动到底）：用户在电脑浏览器登入 IG、打开她的主页，Console 贴上 `public/ig_capture.js`（网址 https://wjy-weibo.jwjw888.workers.dev/ig_capture.js） → 点粉红色按钮 → 开出 `ig-receive.html`（IG 的 CSP 不准直接连外站，所以由上传页代传）。上传页把每张图 POST `/r2-ig` 让 worker 从 IG 图床存进 R2，抓不到的由 IG 分页下载后 PUT `/r2-ig?key=`；资料放 `/staging/7`。
- 整理：`python3 tools/ig_build.py`（会把 ig.json 大小写进 ig.html 的 data-size，网页显示下载百分比；从 /staging/7 取资料、经 `GET /r2-ig/<档名>` 取原图做压缩图、合并进 ig.json，旧贴文保留），确认后 DELETE /staging/7。
