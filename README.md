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
