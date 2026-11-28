#!/usr/bin/env python3
"""把 posts.json 里的微博原图存进 Cloudflare R2（只上传、不改网站资料）。

用法（在 repo 根目录）：
  python3 tools/archive_originals.py --dry-run          # 只列出要处理的数量
  python3 tools/archive_originals.py --limit 50         # 先试 50 张
  python3 tools/archive_originals.py                    # 全部

需要的环境变量（放在 GitHub Secrets，不要写进程式码）：
  R2_ENDPOINT_URL        https://<账号ID>.r2.cloudflarestorage.com
  R2_ACCESS_KEY_ID
  R2_SECRET_ACCESS_KEY
  R2_BUCKET_NAME         jwjw

结果会写进 tools/archive_report.json（成功 / 已存在 / 失败）。
本脚本不会修改 public/data/posts.json，网站要不要改用 R2，等确认后再说。
"""
import argparse
import json
import os
import sys
import time
from pathlib import Path

import boto3
import requests
from botocore.exceptions import ClientError

ROOT = Path(__file__).resolve().parent.parent
POSTS = ROOT / "public" / "data" / "posts.json"
REPORT = ROOT / "tools" / "archive_report.json"

HEADERS = {
    "Referer": "https://weibo.com/",
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    ),
}


def load_items():
    """回传 [(key, orig_url)]，key 就是 posts.json 的 src，例如 img/xxx.jpg。"""
    data = json.loads(POSTS.read_text(encoding="utf-8"))
    posts = data["posts"] if isinstance(data, dict) else data
    seen = set()
    items = []
    for p in posts:
        for x in p.get("pics", []):
            src = x.get("src", "")
            orig = x.get("orig", "")
            if not src.startswith("img/"):
                continue
            if not orig.startswith("http"):
                continue  # 没有原图网址的（手动换的缩图）跳过
            if src in seen:
                continue
            seen.add(src)
            items.append((src, orig))
    return items


def make_client():
    for name in ("R2_ENDPOINT_URL", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"):
        if not os.environ.get(name):
            sys.exit(f"缺少环境变量 {name}")
    client = boto3.client(
        "s3",
        endpoint_url=os.environ["R2_ENDPOINT_URL"],
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
    )
    return client, os.environ["R2_BUCKET_NAME"]


def exists(client, bucket, key):
    try:
        client.head_object(Bucket=bucket, Key=key)
        return True
    except ClientError as e:
        code = str(e.response.get("Error", {}).get("Code", ""))
        if code in ("404", "NoSuchKey", "NotFound"):
            return False
        raise


def download(url, retries=3):
    last = None
    for i in range(retries):
        try:
            r = requests.get(url, headers=HEADERS, timeout=60)
            if r.status_code == 200 and r.content:
                ctype = r.headers.get("Content-Type", "image/jpeg").split(";")[0]
                if not ctype.startswith("image/"):
                    ctype = "image/jpeg"
                return r.content, ctype
            last = f"HTTP {r.status_code}"
        except requests.RequestException as e:
            last = str(e)
        time.sleep(2 * (i + 1))
    raise RuntimeError(last or "下载失败")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="只列数量，不下载不上传")
    ap.add_argument("--limit", type=int, default=0, help="最多处理几张（0 = 全部）")
    ap.add_argument("--delay", type=float, default=0.3, help="每张之间的秒数")
    args = ap.parse_args()

    items = load_items()
    if args.limit:
        items = items[: args.limit]
    print(f"待处理 {len(items)} 张")

    if args.dry_run:
        for key, orig in items[:10]:
            print(key, orig)
        return

    client, bucket = make_client()
    report = {"uploaded": [], "skipped": [], "failed": []}

    for i, (key, orig) in enumerate(items, 1):
        try:
            if exists(client, bucket, key):
                report["skipped"].append(key)
            else:
                body, ctype = download(orig)
                client.put_object(Bucket=bucket, Key=key, Body=body, ContentType=ctype)
                report["uploaded"].append(key)
        except Exception as e:  # 单张失败不中断整批
            report["failed"].append({"key": key, "orig": orig, "error": str(e)})
        if i % 100 == 0:
            print(f"进度 {i}/{len(items)}：上传 {len(report['uploaded'])}，已存在 {len(report['skipped'])}，失败 {len(report['failed'])}")
        time.sleep(args.delay)

    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"完成：上传 {len(report['uploaded'])}，已存在 {len(report['skipped'])}，失败 {len(report['failed'])}")
    print(f"报告：{REPORT}")


if __name__ == "__main__":
    main()
