# 把 en-NN.json 合并进 tr.json（检查 key 对得上、JSON 正确）
import json,glob
tr=json.load(open('tr.json'))
for f in sorted(glob.glob('en-*.json')):
  e=json.load(open(f)); s=json.load(open(f.replace('en-','src-')))
  miss=[k for k in s if k not in e]; extra=[k for k in e if k not in s]
  if miss or extra: print(f,'MISSING',miss,'EXTRA',extra)
  tr.update({k:v for k,v in e.items() if k in s})
json.dump(tr,open('tr.json','w'),ensure_ascii=False,indent=0); print('tr',len(tr))
