"""Merge lists/*.txt -> /workspace/french-study/data/words.json (+ build/words.csv for QA)."""
import re, json, glob, math, csv, unicodedata, sys
OUT='/workspace/french-study/data/words.json'
CEFR_FILES=['a1_1','a1_2','a1_3','a2_1','a2_2','a2_3','a2_4','b1_1','b1_2','b1_3','b1_4']
BG_FILES=['bg_pp','bg_lf','bg_hu','bg_io','bg_gr']
TEXTS={'pp':'Le Petit Prince (ch. 8)','lf':'Le Lion et le Rat','hu':'Le mot – Victor Hugo','io':'Rhinocéros (II, 2)','gr':'דקדוק, ניתוח ובחינה'}
LV={'A1':1,'A2':2,'B1':3}
def key(s):
    s=s.lower().replace('’',"'")
    s=re.sub(r"^(le|la|les|un|une)\s+|^l'",'',s)
    s=re.sub(r"[!?.,]"," ",s); s=re.sub(r'\s+',' ',s).strip()
    return s
def wkey(r): return key(r['fr'])+('#n' if r['pos']=='n' else '')
def read(f):
    rows=[]
    for i,l in enumerate(open(f'lists/{f}.txt',encoding='utf-8')):
        l=l.rstrip('\n')
        if not l.strip(): continue
        p=l.split('|')
        assert len(p)==6, (f,i,l)
        fr,g,pos,he,tag,hint=[x.strip() for x in p]
        assert g in 'mfan' and len(g)==1, (f,l)
        assert pos in ('n','v','adj','adv','prep','pron','conj','det','num','int','phr'), (f,l)
        assert fr and he, (f,l)
        rows.append(dict(fr=fr,g=g,pos=pos,he=he,tag=tag,hint=hint,file=f))
    return rows
words={}; order=[]; dups=[]
for f in CEFR_FILES:
    for r in read(f):
        k=wkey(r)
        if k in words: dups.append((f,r['fr'],words[k]['file'])); continue
        assert r['tag'] in LV,(f,r)
        words[k]=dict(r,cefr=r['tag'],texts=[]); order.append(k)
merged=[]
for f in BG_FILES:
    for r in read(f):
        k=wkey(r); t=r['tag']
        if k in words:
            w=words[k]
            if t not in w['texts']: w['texts'].append(t)
            if w['file'].startswith('bg_'): continue    # dup across bagrut lists
            if r['hint'] and not w['hint']: w['hint']=r['hint']
            tok=lambda x:set(re.findall(r'[\u0590-\u05FF"]+',x))
            if not tok(r['he'])<=tok(w['he']):
                merged.append((w['fr'],w['he'],r['he']))
                lab='בדקדוק / בספרות' if t=='gr' else 'בטקסט'
                w['hint']=(w['hint']+' · ' if w['hint'] else '')+f"{lab}: {r['he']}"
            continue
        words[k]=dict(r,cefr='B1',texts=[t]); order.append(k)
# grouping: A1, A2, B1 (CEFR / both), then bagrut-only by text
groups=[]
for lv in ('A1','A2','B1'): groups.append((lv,'cefr',[k for k in order if not words[k]['file'].startswith('bg_') and words[k]['cefr']==lv]))
for t in TEXTS: groups.append((t,'bagrut',[k for k in order if words[k]['file'].startswith('bg_') and words[k]['texts'][0]==t]))
# put small bagrut groups together so parts stay 80-100
out=[]; parts=[]; n=0
def chunk(keys,label,kind):
    global n
    k=max(1,math.ceil(len(keys)/100)); q,r=divmod(len(keys),k); i=0
    for j in range(k):
        s=q+(1 if j<r else 0); ch=keys[i:i+s]; i+=s
        pid=len(parts)+1; frm=n+1
        for kk in ch:
            n+=1; w=words[kk]
            src='bagrut' if w['file'].startswith('bg_') else ('both' if w['texts'] else 'cefr')
            out.append({'n':n,'french':w['fr'],'gender':w['g'],'pos':w['pos'],'hebrew':w['he'],'hint':w['hint'],
                        'cefr':w['cefr'],'source':src,'texts':w['texts'],'part':pid})
        parts.append({'id':pid,'kind':kind,'label':label,'from':frm,'to':n,'count':len(ch)})
for lv,kind,keys in groups[:3]: chunk(keys,lv,kind)
bg=groups[3:]
# bagrut-only: literature texts (pp+lf), (hu+io), grammar
chunk([k for g in bg for k in g[2]],'בגרות','bagrut')
json.dump({'version':1,'title':'Français – אוצר מילים לבגרות','texts':TEXTS,'parts':parts,'words':out},
          open(OUT,'w',encoding='utf-8'),ensure_ascii=False,separators=(',',':'))
with open('words.csv','w',newline='',encoding='utf-8') as fh:
    wr=csv.writer(fh); wr.writerow(['n','french','gender','pos','hebrew','hint','cefr','source','texts','part'])
    for w in out: wr.writerow([w['n'],w['french'],w['gender'],w['pos'],w['hebrew'],w['hint'],w['cefr'],w['source'],' '.join(w['texts']),w['part']])
from collections import Counter
print('words',len(out),'cefr-level',Counter(w['cefr'] for w in out),'source',Counter(w['source'] for w in out))
print('parts',[(p['id'],p['label'][:12],p['count']) for p in parts])
print('dups(cefr)',len(dups),dups[:40])
if '-v' in sys.argv:
    for m in merged: print('MERGE',m)
