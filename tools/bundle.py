# 把 data/ 下的 JSON 合并成 data/all.json（完整资料）和 data/head.json（最新几条，网路慢时先显示）。
# 每次更新资料后执行：python3 tools/bundle.py
import json,os
D='public/data/'
L=lambda f,d=None: json.load(open(D+f,encoding='utf-8')) if d is None else (json.load(open(D+f,encoding='utf-8')) if os.path.exists(D+f) else d)
posts=L('posts.json');dims=L('dims.json');cm=L('comments.json',{});emo=L('emoji.json',{});links=L('links.json',{})
dump=lambda o,f: json.dump(o,open(D+f,'w',encoding='utf-8'),ensure_ascii=False,separators=(',',':'))
dump({'d':posts,'dims':dims,'cm':cm,'emo':emo,'links':links},'all.json')
# head.json：最新 12 条一般微博（不含超话）＋它们的评论、图片尺寸；meta 是全部资料的统计（顶部数字和月份选单用）
P=posts['posts']; srt=sorted(P,key=lambda p:p['time'],reverse=True)
head=[p for p in srt if not p.get('ch')][:12]
mk=lambda t:t[:7]
def ymd_local(t):
  import datetime; return (datetime.datetime.fromisoformat(t.replace('Z','+00:00'))+datetime.timedelta(hours=8)).strftime('%Y-%m')
times=sorted(p['time'] for p in P)
months=sorted({ymd_local(p['time']) for p in P},reverse=True)
picN=sum(len([x for x in p['pics'] if not x.get('isVideo')])+(len(p['rt']['pics']) if p.get('rt') else 0) for p in P)
chN=sum(1 for p in P if p.get('ch'))
meta={'wbN':len(P)-chN,'chN':chN,'picN':picN,'first':times[0],'last':times[-1],'months':months}
keys=set()
for p in head:
  for x in p['pics']+(p['rt']['pics'] if p.get('rt') else []): keys.add(x.get('src'))
  if p.get('video'): keys.add(p['video'].get('cover'))
hd={k:v for k,v in dims.items() if k in keys}
meta['size']=os.path.getsize(D+'all.json')  # 完整资料大小，网页显示下载进度用
dump({'d':{**{k:v for k,v in posts.items() if k!='posts'},'posts':head,'meta':meta},'dims':hd,'cm':{p['id']:cm[p['id']] for p in head if p['id'] in cm},'emo':emo,'links':links},'head.json')
print('head',len(head),os.path.getsize(D+'head.json'),'all',os.path.getsize(D+'all.json'))

# 把资料大小写进 index.html，网页一开始（资料还没到）就能显示下载百分比
import re
ip=os.path.join(D,'..','index.html'); h=open(ip,encoding='utf-8').read()
h=re.sub(r'<meta name="data-size" content="[^"]*">','<meta name="data-size" content="%d,%d">'%(os.path.getsize(D+'head.json'),os.path.getsize(D+'all.json')),h,count=1)
open(ip,'w',encoding='utf-8').write(h)
