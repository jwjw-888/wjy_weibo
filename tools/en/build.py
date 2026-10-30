# 用 tools/en/tr.json（中文→英文翻译）产生 public/data/en.json，英文模式才会下载。
import json,hashlib,re
tr=json.load(open('tools/en/tr.json'))
P=json.load(open('public/data/posts.json'))['posts']; C=json.load(open('public/data/comments.json')); L=json.load(open('public/data/links.json'))
k=lambda t: tr.get(hashlib.md5(t.encode()).hexdigest()[:10]) if t and re.search(r'[㐀-鿿]',t) else None
out={'p':{},'c':{},'l':{}}
for p in P:
  e={}
  if k(p['text']): e['t']=k(p['text'])
  if p.get('rt') and k(p['rt']['text']): e['r']=k(p['rt']['text'])
  if p.get('video') and k(p['video'].get('title','')): e['v']=k(p['video']['title'])
  if p.get('rt') and p['rt'].get('video') and k(p['rt']['video'].get('title','')): e['rv']=k(p['rt']['video']['title'])
  if p.get('note') and k(p['note']): e['n']=k(p['note'])
  if e: out['p'][p['id']]=e
for v in C.values():
  for c in v['top']+[x for a in v.get('author',[]) for x in [a['comment']]+a.get('replies',[])]:
    if k(c['text']): out['c'][c['id']]=k(c['text'])
for u,t in L.items():
  if k(t): out['l'][u]=k(t)
json.dump(out,open('public/data/en.json','w',encoding='utf-8'),ensure_ascii=False,separators=(',',':'))
miss=[p['id'] for p in P if re.search(r'[㐀-鿿]',p['text']) and p['id'] not in out['p']]
print('posts',len(out['p']),'comments',len(out['c']),'links',len(out['l']),'missing',len(miss))
