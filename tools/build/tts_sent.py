"""ElevenLabs TTS for conversation sentences (Jeanne, FR) -> audio_cache, then encode to french-study/audio/sent/.
Same cache/ledger rules as tts.py (never re-issues a possibly-billed call). Usage: python3 tts_sent.py [--encode-only]"""
import os, json, sys, subprocess
__file__ = '/workspace/french-build/tts.py'; exec(open(__file__).read().split('if __name__')[0])
S = json.load(open('/workspace/french-study/data/sentences.json'))['items']
J = []
for it in S:
    for t, dst in zip(it['say'], it['au']): J.append((t, dst))
if '--encode-only' not in sys.argv:
    state = ledger_state(); from collections import Counter; C = Counter(); cost = 0
    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(4) as ex:
        for st_, c in ex.map(lambda j: synth(j[0], FR_VOICE, 'fr', state), J): C[st_] += 1; cost += c
    print('TTS', dict(C), 'cost', cost)
os.makedirs('/workspace/french-study/audio/sent', exist_ok=True)
keep = set(); miss = []
for t, dst in J:
    src = path(t, FR_VOICE, 'fr'); out = '/workspace/french-study/' + dst; keep.add(os.path.basename(dst))
    if not (os.path.exists(src) and os.path.getsize(src) > 1000): miss.append(t); continue
    if not os.path.exists(out):
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-af',
            'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08,areverse,loudnorm=I=-18:TP=-1.5:LRA=11',
            '-ac', '1', '-ar', '22050', '-c:a', 'libmp3lame', '-b:a', '40k', '-map_metadata', '-1', out], check=True)
for f in os.listdir('/workspace/french-study/audio/sent'):
    if f not in keep: os.remove('/workspace/french-study/audio/sent/' + f)
print('sentence clips', len(J), 'missing', len(miss), 'chars', sum(len(t) for t, _ in J))
