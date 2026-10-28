# 吴谨言微博备份

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
