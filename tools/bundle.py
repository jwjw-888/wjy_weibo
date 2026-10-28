# 把 data/ 下的 5 个 JSON 合并成一个压缩版 data/all.json（网站只需下载一次）。每次更新资料后执行：python3 tools/bundle.py
import json
D='public/data/'
L=lambda f,d=None: json.load(open(D+f,encoding='utf-8')) if d is None else (json.load(open(D+f,encoding='utf-8')) if __import__('os').path.exists(D+f) else d)
out={'d':L('posts.json'),'dims':L('dims.json'),'cm':L('comments.json',{}),'emo':L('emoji.json',{}),'links':L('links.json',{})}
json.dump(out,open(D+'all.json','w',encoding='utf-8'),ensure_ascii=False,separators=(',',':'))
