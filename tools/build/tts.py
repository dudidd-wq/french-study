"""ElevenLabs TTS for the French study app. Cache by hash, append-only ledger, never re-issue a call
that may have been billed (pending/uncertain). Usage: python3 tts.py [max_jobs]
Reads /workspace/french-study/data/words.json; writes audio_cache/{fr,he}_<hash>.mp3"""
import os, json, re, hashlib, time, threading, requests, sys
from concurrent.futures import ThreadPoolExecutor
KEY = os.environ['ELEVENLABS_API_KEY']
FR_VOICE = 'txtf1EDouKke753vN8SL'   # Jeanne – Parisian female narrator (shared library voice)
HE_VOICE = 'yGpVFXFoImvRvaURKypy'   # Tomer
MODEL = 'eleven_v4'
os.chdir(os.path.dirname(os.path.abspath(__file__)))
CACHE = 'audio_cache'; os.makedirs(CACHE, exist_ok=True)
LEDGER = 'tts_ledger.jsonl'; lock = threading.Lock()

FR_OVR = {'le XVIIe siècle': 'le dix-septième siècle', 'le 14 juillet': 'le quatorze juillet', 'le CV': 'le C.V.'}
def fr_tts_text(s):
    if s in FR_OVR: return FR_OVR[s]
    s = re.sub(r'\s*(…|\.{2,})\s*', ', ', s)
    s = re.sub(r'\s*/\s*', ', ', s).replace('(', ' ').replace(')', ' ')
    s = re.sub(r'\s+', ' ', s).strip(' ,;')
    return s
HE_OVR = {'מסך': 'מָסָךְ'}   # plain form came out unintelligible (STT audit)
def he_tts_text(s):
    if s in HE_OVR: return HE_OVR[s]
    s = re.sub(r'\s*\([^)]*[A-Za-z0-9][^)]*\)', '', s)   # drop (Latin / dates) notes
    s = s.replace('…', '').replace('...', '').replace('״', '"').replace('׳', "'")
    s = re.sub(r'\s*/\s*', ' או ', s); s = re.sub(r'\s*\(\s*', ', ', s).replace(')', '')
    s = re.sub(r'\s*,\s*(,\s*)+', ', ', s); s = re.sub(r'\s+', ' ', s).strip(' ,;')
    NQ = {'ל': 'לְ', 'מ': 'מִ', 'ב': 'בְּ', 'ש': 'שֶׁ', 'ה': 'הַ', 'ו': 'וְ', 'כ': 'כְּ'}
    s = re.sub(r'(?<![\u0590-\u05FF"\'])([למבשהוכ])(?![\u0590-\u05FF])', lambda m: NQ[m.group(1)], s)
    s = s.replace('...', '').replace('..', '')
    return s
def key(text, voice, lang): return hashlib.sha1(f'{MODEL}|{voice}|{lang}|{text}'.encode()).hexdigest()[:16]
def path(text, voice, lang): return f'{CACHE}/{lang}_{key(text, voice, lang)}.mp3'
def led(d):
    with lock:
        with open(LEDGER, 'a') as f: f.write(json.dumps(d, ensure_ascii=False) + '\n')
def ledger_state():
    st = {}
    if os.path.exists(LEDGER):
        for l in open(LEDGER):
            d = json.loads(l); st[d['key']] = {**st.get(d['key'], {}), **d}
    return st
STOP = threading.Event()
def synth(text, voice, lang, state):
    p = path(text, voice, lang); k = key(text, voice, lang)
    if os.path.exists(p) and os.path.getsize(p) > 1000: return ('cached', 0)
    prev = state.get(k)
    if prev and prev['status'] in ('pending', 'uncertain'): return ('skip_uncertain', 0)
    if STOP.is_set(): return ('stopped', 0)
    for attempt in range(6):
        led({'key': k, 'status': 'pending', 'text': text, 'lang': lang, 't': time.time()})
        try:
            r = requests.post(f'https://api.elevenlabs.io/v1/text-to-speech/{voice}?output_format=mp3_44100_128',
                headers={'xi-api-key': KEY, 'Content-Type': 'application/json'},
                json={'text': text, 'model_id': MODEL, 'language_code': lang}, timeout=(10, 120))
        except Exception as ex:
            led({'key': k, 'status': 'uncertain', 'err': repr(ex)[:200]}); return ('uncertain', 0)
        if r.status_code == 200 and len(r.content) > 1000:
            tmp = p + '.tmp'; open(tmp, 'wb').write(r.content); os.replace(tmp, p)
            cost = int(r.headers.get('character-cost') or 0)
            led({'key': k, 'status': 'done', 'cost': cost, 'req': r.headers.get('request-id')}); return ('done', cost)
        if r.status_code == 429 and 'quota' not in r.text:
            led({'key': k, 'status': 'failed_429'}); time.sleep(3 * (attempt + 1)); continue
        led({'key': k, 'status': 'failed', 'code': r.status_code, 'body': r.text[:300]})
        if 'quota' in r.text or r.status_code in (401, 402): STOP.set()
        return ('failed', 0)
    return ('failed', 0)
def jobs():
    W = json.load(open('/workspace/french-study/data/words.json'))['words']
    J = []
    for w in W:
        J.append((fr_tts_text(w['french']), FR_VOICE, 'fr'))
        J.append((he_tts_text(w['hebrew']), HE_VOICE, 'he'))
    return list(dict.fromkeys(J))
if __name__ == '__main__':
    J = jobs()
    if len(sys.argv) > 1: J = J[:int(sys.argv[1])]
    state = ledger_state()
    from collections import Counter
    C = Counter(); cost = 0; done = 0
    with ThreadPoolExecutor(4) as ex:
        for st_, c in ex.map(lambda j: synth(*j, state), J):
            C[st_] += 1; cost += c; done += 1
            if done % 100 == 0: print(done, '/', len(J), dict(C), 'cost', cost, flush=True)
    print('FINAL', len(J), dict(C), 'cost', cost, flush=True)
