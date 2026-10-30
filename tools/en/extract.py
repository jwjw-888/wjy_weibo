# 抽出需要翻译的中文文字，分批写到 tools/en/src-NN.json（key = md5(text)[:10]）。已翻译的（tools/en/tr.json）跳过。
import json,re,hashlib,os,glob
D='tools/en/'
P=json.load(open('public/data/posts.json'))['posts']; C=json.load(open('public/data/comments.json')); L=json.load(open('public/data/links.json'))
def texts():
  for p in P:
    yield p['text']
    if p.get('rt'): yield p['rt']['text']
    if p.get('video') and p['video'].get('title'): yield p['video']['title']
    if p.get('rt') and p['rt'].get('video') and p['rt']['video'].get('title'): yield p['rt']['video']['title']
    if p.get('note'): yield p['note']
  for v in C.values():
    for c in v['top']: yield c['text']
    for a in v.get('author',[]):
      for c in [a['comment']]+a.get('replies',[]): yield c['text']
  for t in L.values(): yield t
key=lambda t: hashlib.md5(t.encode()).hexdigest()[:10]
tr=json.load(open(D+'tr.json')) if os.path.exists(D+'tr.json') else {}
todo={}
for t in texts():
  if t and re.search(r'[㐀-鿿]',t) and key(t) not in tr: todo[key(t)]=t
for f in glob.glob(D+'src-*.json'): os.remove(f)
items=list(todo.items()); b=[];cur={};n=0
for k,t in items:
  cur[k]=t; n+=len(t)
  if n>1800: b.append(cur);cur={};n=0
if cur: b.append(cur)
for i,x in enumerate(b): json.dump(x,open(D+'src-%02d.json'%i,'w'),ensure_ascii=False,indent=0)
print(len(todo),'texts in',len(b),'batches')
