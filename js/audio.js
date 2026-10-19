// Audio playback: recorded ElevenLabs clips (French voice / Tomer HE), with speechSynthesis fallback for missing clips.
import { audioUrl, hasAudio } from './data.js';
import { getSettings } from './store.js';

const player = () => document.getElementById('player');
let token = 0;           // increments on every new play/stop to cancel stale promises
let activeBtn = null;

export function spokenText(w, lang) {
  if (lang === 'he') return w.he.replace(/\//g, ' או ').replace(/[()…]/g, ' ');
  return w.fr.replace(/\.{2,}|…/g, ' ').replace(/\s*\/\s*/g, ', ').replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
}
let voices = [];
if ('speechSynthesis' in window) { const lv = () => voices = speechSynthesis.getVoices(); lv(); speechSynthesis.onvoiceschanged = lv; }
export function speak(text, lang, rate = 1) {
  return new Promise(res => {
    if (!('speechSynthesis' in window)) return res(false);
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === 'he' ? 'he-IL' : 'fr-FR'; u.rate = rate;
    const v = voices.find(v => v.lang.replace('_', '-').toLowerCase().startsWith(lang === 'he' ? 'he' : 'fr-fr')) || voices.find(v => v.lang.toLowerCase().startsWith(lang === 'he' ? 'he' : 'iw') || v.lang.toLowerCase().startsWith(lang));
    if (v) u.voice = v;
    let done = false; const fin = ok => { if (!done) { done = true; res(ok); } };
    u.onend = () => fin(true); u.onerror = () => fin(false);
    setTimeout(() => fin(false), 8000 + text.length * 120);
    speechSynthesis.speak(u);
  });
}

/** Play a URL on the shared <audio>. Resolves true when it ended, false on error/cancel. */
export function playUrl(url, { rate = 1 } = {}) {
  const a = player(); const my = ++token;
  return new Promise(res => {
    const clean = () => { a.onended = a.onerror = null; };
    a.onended = () => { clean(); res(my === token); };
    a.onerror = () => { clean(); res(false); };
    a.src = url; a.playbackRate = rate; a.defaultPlaybackRate = rate;
    const p = a.play(); if (p) p.catch(err => { if (my === token) { clean(); res(err && err.name === 'NotAllowedError' ? 'blocked' : false); } });
  });
}

/** Play a word in 'fr' or 'he'. Uses recorded clip when available; else speech synthesis. */
export async function playWord(w, lang, opts = {}) {
  const rate = opts.rate ?? getSettings().rate;
  const btn = opts.btn; setActive(btn);
  let ok = false;
  if (hasAudio(w, lang)) {
    const my = token + 1;
    ok = await playUrl(audioUrl(w, lang), { rate });
    if (ok === 'blocked') { setActive(null); return 'blocked'; }
    if (!ok && my !== token) { setActive(null); return false; } // cancelled by newer play
  }
  if (!ok) ok = await speak(spokenText(w, lang), lang, rate);
  if (activeBtn === btn) setActive(null);
  return ok;
}
function setActive(btn) { if (activeBtn) activeBtn.classList.remove('playing'); activeBtn = btn || null; if (btn) btn.classList.add('playing'); }

export function stop() { token++; const a = player(); a.onended = a.onerror = null; try { a.pause(); } catch {} if ('speechSynthesis' in window) speechSynthesis.cancel(); setActive(null); }
export const currentToken = () => token;

// --- tiny feedback sounds (WebAudio, no files)
let ctx;
export function sfx(kind) {
  if (!getSettings().sfx) return;
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    const notes = kind === 'ok' ? [660, 880] : kind === 'win' ? [523, 659, 784, 1047] : [300, 220];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain(); const t = ctx.currentTime + i * .1;
      o.type = kind === 'bad' ? 'triangle' : 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.18, t + .015); g.gain.exponentialRampToValueAtTime(.001, t + .22);
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + .25);
    });
  } catch {}
}
