"""Encode cached TTS clips into /workspace/french-study/audio/{fr,he}/NNNN.mp3 and set the 'a' bits
(1 = FR clip, 2 = HE clip) in words.json. Words without a clip fall back to speechSynthesis in the app.
Re-encodes only files whose source clip changed (audio_map.json)."""
import os, json, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
__file__ = '/workspace/french-build/tts.py'; exec(open(__file__).read().split('if __name__')[0])
OUT = '/workspace/french-study'; P = OUT + '/data/words.json'
d = json.load(open(P)); MAP_F = '/workspace/french-build/audio_map.json'
old = json.load(open(MAP_F)) if os.path.exists(MAP_F) else {}
new = {}; jobs_ = []; fr = he = 0
for w in d['words']:
    a = 0
    for bit, lang, text, voice in ((1, 'fr', fr_tts_text(w['french']), FR_VOICE), (2, 'he', he_tts_text(w['hebrew']), HE_VOICE)):
        src = path(text, voice, lang); dst = f"audio/{lang}/{w['n']:04d}.mp3"
        if os.path.exists(src) and os.path.getsize(src) > 1000:
            a |= bit; new[dst] = src
            if lang == 'fr': fr += 1
            else: he += 1
            if old.get(dst) != src or not os.path.exists(os.path.join(OUT, dst)): jobs_.append((dst, src))
    w['a'] = a
# remove stale outputs
for dst in set(old) - set(new):
    try: os.remove(os.path.join(OUT, dst))
    except FileNotFoundError: pass
os.makedirs(OUT + '/audio/fr', exist_ok=True); os.makedirs(OUT + '/audio/he', exist_ok=True)
def enc(item):
    dst, srcp = item; dst = os.path.join(OUT, dst)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', srcp, '-af',
        'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08,areverse,loudnorm=I=-18:TP=-1.5:LRA=11',
        '-ac', '1', '-ar', '22050', '-c:a', 'libmp3lame', '-b:a', '32k', '-map_metadata', '-1', dst], check=True)
with ThreadPoolExecutor(os.cpu_count() or 4) as ex: list(ex.map(enc, jobs_))
json.dump(new, open(MAP_F, 'w'))
json.dump(d, open(P, 'w'), ensure_ascii=False, separators=(',', ':'))
print({'words': len(d['words']), 'fr_audio': fr, 'he_audio': he, 'encoded_now': len(jobs_)})
