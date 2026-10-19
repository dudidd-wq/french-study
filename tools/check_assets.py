"""Static check: every word in data/words.json has the audio files it claims; report coverage."""
import json, os, sys
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
d = json.load(open(os.path.join(root, 'data/words.json')))
W = d['words']; miss = []; fr = he = 0
for w in W:
    for bit, lang in ((1, 'fr'), (2, 'he')):
        p = os.path.join(root, f"audio/{lang}/{w['n']:04d}.mp3")
        if w.get('a', 0) & bit:
            if not os.path.isfile(p) or os.path.getsize(p) < 500: miss.append(p)
            elif lang == 'fr': fr += 1
            else: he += 1
parts = d['parts']
assert sum(p['count'] for p in parts) == len(W) and all(80 <= p['count'] <= 100 for p in parts), [p['count'] for p in parts]
assert len({w['french'] + w['pos'] for w in W}) == len(W), 'duplicate entries'
size = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(os.path.join(root, 'audio')) for f in fs)
print(f"words={len(W)} parts={len(parts)} fr_audio={fr} he_audio={he} fallback_fr={len(W)-fr} fallback_he={len(W)-he} missing={len(miss)} audio_MB={size/1e6:.1f}")
sys.exit(1 if miss else 0)
