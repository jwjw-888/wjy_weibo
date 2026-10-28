# 用法：python3 tools/refill.py <staging 下载的 json> <要移除的 uid>
# 移除该 uid 的热门评论，按点赞顺延补上下一位（json 由浏览器抓取，格式 {postId: [评论...]}）。
import json,re,base64,io,os,sys
from PIL import Image
R=json.load(open(sys.argv[1])); BAD=set(sys.argv[2:])
C=json.load(open('public/data/comments.json'))
for pid,new in R.items():
  old=[c for c in C[pid]['top'] if c['uid'] not in BAD]
  have={c['id'] for c in old}; need=len(C[pid]['top'])-len(old)
  fill=[c for c in new if c['id'] not in have][:need]
  for c in fill:
    print(pid,'+',c['user'],c['likes'],c['text'][:40],c['pics'])
    p='public/avatars/u/%s.jpg'%c['avatar']
    if not os.path.exists(p): Image.open(io.BytesIO(base64.b64decode(c['_av']))).convert('RGB').resize((120,120),Image.LANCZOS).save(p,'JPEG',quality=85)
    for k,b in c['_pics'].items():
      im=Image.open(io.BytesIO(base64.b64decode(b))).convert('RGB'); w,h=im.size; s=min(w,h)
      im.crop(((w-s)//2,(h-s)//2,(w-s)//2+s,(h-s)//2+s)).resize((288,288),Image.LANCZOS).save('public/thumbs/cmt/%s.jpg'%k,'JPEG',quality=80)
    if c['pics']: c['text']=re.sub(r'\s*http://t\.cn/\w+','',c['text']).strip()
    c.pop('_av');c.pop('_pics')
  C[pid]['top']=sorted(old+fill,key=lambda c:-c['likes'])
json.dump(C,open('public/data/comments.json','w',encoding='utf-8'),ensure_ascii=False)
