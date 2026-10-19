import json,glob
P='/workspace/french-study/data/words.json'; d=json.load(open(P))
M={}
for f in sorted(glob.glob('/workspace/french-build/emoji_*.txt')):
    for l in open(f):
        l=l.rstrip('\n')
        if '=' in l: k,v=l.rsplit('=',1); M.setdefault(k,v)
hit=0; miss=[]; used=set()
for w in d['words']:
    e=M.get(w['french'])
    if e: w['e']=e; hit+=1; used.add(w['french'])
    else: w.pop('e',None); miss.append(w['french'])
json.dump(d,open(P,'w'),ensure_ascii=False,separators=(',',':'))
print('emoji',hit,'/',len(d['words']),'missing',len(miss),miss[:60]); print('unused keys',[k for k in M if k not in used][:40])
