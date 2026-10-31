# 用法：python3 tools/pick_comments.py <浏览器抓的评论 json>   （格式 {贴文id: [精简评论...]}）
# 每篇随机挑 5 位粉丝「有内容」的留言；吴谨言回复过的另放 author。规则见 README「评论区选法」。
import json,re,random,datetime,sys,os
# 选项：--candidates <输出档>  只列出每篇的候选留言给 Claude 挑；--picks <picks.json>  用人工挑好的评论 id
R=json.load(open(sys.argv[1]))
ARG=dict(zip(sys.argv[2::2],sys.argv[3::2]))
PICKS=json.load(open(ARG['--picks'])) if '--picks' in ARG else {}
CAND={}
C=json.load(open('public/data/comments.json'))
BAD={'7036596512','7492962323','6664185690','7890389247','7219895881','7556898955',
     '5867796382','6582011218','7440139822','6375609645','7421237358'}
KW=['魏哲鸣','萧玦','萧块']
ME='1278603180'
PHRASE=r'杀青快乐|杀青大吉|开机大吉|开机快乐|拍摄顺利|一切顺利|期待[^，,。！!？?\s]{0,10}|早日(相见|见面)|一起(看|支持|追)|速速|冲呀|冲冲|上线了|宣传委员|新剧|好剧|新角色|新造型|生日快乐|节日快乐|中秋快乐|新年快乐|恭喜|入围|大吉'
GENERIC=r'期待|好看|好美|美美|太美了|绝美|支持|加油|冲鸭|冲冲冲|爱你|喜欢|姐姐|老婆|宝宝|谨言|吴谨言|小吴|盐盐|来了|打卡|签到|晚安|早安|哈哈+|啊+|呀+|哇+|好好看|漂亮|可爱|帅|绝了|yyds|❤|~|～|！|!|。|，|,|\.|\?|？'
iso=lambda t:datetime.datetime.strptime(t,'%a %b %d %H:%M:%S %z %Y').astimezone(datetime.UTC).strftime('%Y-%m-%dT%H:%M:%S.000Z')
def pidof(u):
  m=re.search(r'/([0-9a-zA-Z]{20,})\.',u or ''); return m.group(1) if m else None
known={c['id']:c for v in C.values() for c in v['top']+[a['comment'] for a in v.get('author',[])]+[r for a in v.get('author',[]) for r in a['replies']]}
def core(t):
  t=re.sub(r'\[[^\]]{1,8}\]','',t); t=re.sub(r'@\S+','',t); t=re.sub(r'http\S+','',t)
  return re.sub(r'[\s\U00010000-\U0010FFFF☀-➿️]','',t)
def conv(c):
  k=known.get(c['id']); pics=k['pics'] if k else []
  t=c['x']
  if c.get('pn') or pics: t=re.sub(r'\s*http://t\.cn/\w+','',t).strip()
  return {"id":c['id'],"user":c['name'],"uid":c['uid'],"avatar":pidof(c['av']),"time":iso(c['t']),"text":t,"likes":c['l'],"pics":pics}
def blocked(c): return c['uid'] in BAD or any(k in c['x']+c['name'] for k in KW)
report={}
for pid,raw in R.items():
  seen=set();cm=[]
  for c in raw:
    if c['id'] not in seen: seen.add(c['id']);cm.append(c)
  pool=[];users=set();texts=set()
  for c in sorted(cm,key=lambda c:-c['l']):
    if blocked(c) or c['uid']==ME or c['v'] or not pidof(c['av']): continue
    if c.get('pn') and c['id'] not in known: continue   # 评论图抓不到编号就不收
    x=c['x']
    if '#' in x or ('http' in x and not c.get('pn')): continue
    if re.search(r'超话|控评|打榜|投票|做数据|轮博|反黑|//@',x): continue
    if re.search(r'混日子|糊弄|敷衍|破图|别拍|气死|坑人|垃圾|难看|恶心|去死|该死|也应该死|编剧是|ai的|AI的|丑|骂|滚',x): continue   # 负面/找茬的不收
    if re.search(r'(.{3,}?)(?:.{0,4}\1){2,}',x): continue   # 同一句重复刷屏
    co=core(x)
    sc=len(re.sub(GENERIC,'',re.sub(PHRASE,'',co)))
    if len(co)<8 or sc<6: continue
    c['_sc']=sc
    if co in texts or c['uid'] in users: continue
    texts.add(co);users.add(c['uid']);pool.append(c)
  # 不够 5 位时，用比较短的粉丝留言补上（仍排除封杀、负面、刷屏）
  extra=[]
  for c in sorted(cm,key=lambda c:-c['l']):
    if c in pool or blocked(c) or c['uid']==ME or c['v'] or not pidof(c['av']) or c['uid'] in users: continue
    x=c['x']
    if (c.get('pn') and c['id'] not in known) or '#' in x or 'http' in x or re.search(r'//@|超话|控评|打榜|混日子|糊弄|敷衍|破图|别拍|气死|坑人|垃圾|难看|恶心|死|丑|骂|滚',x) or re.search(r'(.{3,}?)(?:.{0,4}\1){2,}',x): continue
    co=core(x)
    if len(co)<4 or co in texts: continue
    c['_sc']=0;texts.add(co);users.add(c['uid']);extra.append(c)
  CAND[pid]=[{'id':c['id'],'user':c['name'],'likes':c['l'],'text':c['x']} for c in pool+extra]
  if pid in PICKS:
    byid={c['id']:c for c in cm}
    pick=[byid[i] for i in PICKS[pid] if i in byid]
  else:
    pool=sorted(pool,key=lambda c:-c['_sc'])[:15]   # 没有人工挑选时：内容最多的 15 则里随机挑
    pick=random.Random(pid).sample(pool,min(5,len(pool)))
    if len(pick)<5: pick+=random.Random(pid+'x').sample(extra,min(5-len(pick),len(extra)))
  top=sorted([conv(c) for c in pick],key=lambda c:-c['likes'])
  auth=[]
  for c in cm:   # 她回复过的留言不受封杀名单限制，全收
    if c['sub']: auth.append({"comment":conv(c),"replies":[conv({**r,'v':0,'pn':0}) for r in c['sub']],"isAuthorComment":False})
  old=C.get(pid,{})
  have={a['comment']['id'] for a in auth}
  auth+=[a for a in old.get('author',[]) if a['comment']['id'] not in have]
  auth.sort(key=lambda a:a['comment']['time'])
  C[pid]={"scanned":len(cm),"top":top,"author":auth}
  report[pid]=(len(cm),len(pool))
if '--candidates' in ARG:
  json.dump(CAND,open(ARG['--candidates'],'w'),ensure_ascii=False,indent=0); print('candidates written'); sys.exit()
json.dump(C,open('public/data/comments.json','w',encoding='utf-8'),ensure_ascii=False)
need={}
for pid in R:
  v=C[pid]
  for c in v['top']+[a['comment'] for a in v['author']]+[r for a in v['author'] for r in a['replies']]:
    if c['avatar'] and not os.path.exists('public/avatars/u/%s.jpg'%c['avatar']): need[c['avatar']]=1
avs={c['av'] for raw in R.values() for c in raw}|{r['av'] for raw in R.values() for c in raw for r in c['sub']}
json.dump({a:[u for u in avs if a in u][0] for a in need},open(sys.argv[1]+'.avatars.json','w'))
print('pool sizes',sorted(report.values())[:5],'avatars needed',len(need))
