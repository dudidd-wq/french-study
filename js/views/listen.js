// Listening mode: FR audio → recall pause (countdown) → HE audio → repeat pause.
// Uses ONE <audio> element and plays short silent clips for the pauses, so playback keeps
// going when the screen is off / the tab is in the background (timers get throttled there, audio doesn't).
import { h, posHe, wMeta, posCat, shuffle, ringSVG, toast, put } from '../util.js';
import { DB, audioUrl, hasAudio } from '../data.js';
import * as st from '../store.js';
import { speak, spokenText, stop as stopAll } from '../audio.js';
import { parseSrc, pick, describe } from '../select.js';
import { onLeave, refreshTop } from '../nav.js';
import { sourcePicker, emptyState, emo } from '../ui.js';

const SIL = [{ url: 'audio/silence-1000.mp3', s: 1 }, { url: 'audio/silence-500.mp3', s: .5 }];
const BLOCK = 25;

export function listenView(_m, q) {
  const root = h('div');
  const s0 = q.has('src') ? parseSrc(q) : { type: 'part', p: st.getSettings().lastPart || 1 };
  showSetup(root, s0, q.get('autostart') === '1');
  return root;
}

function settingsControls(onChange) {
  const set = st.getSettings();
  const slider = (key, label, min, max, step, fmt) => {
    const out = h('b', fmt(set[key]));
    const inp = h('input', { type: 'range', min, max, step, value: set[key], 'aria-label': label });
    inp.addEventListener('input', () => { out.textContent = fmt(+inp.value); st.setSettings({ [key]: +inp.value }); onChange?.(); });
    return h('div.field', h('div.row', h('label.grow', label), out), inp);
  };
  const sw = (key, label) => {
    const inp = h('input', { type: 'checkbox', checked: !!set[key] });
    inp.addEventListener('change', () => { st.setSettings({ [key]: inp.checked }); onChange?.(); });
    return h('label.switch', h('span', label), inp);
  };
  const sec = v => v ? `${v} שנ׳` : 'בלי';
  return h('div',
    slider('recall', '⏳ הפסקת היזכרות (לפני התרגום)', 0.5, 8, 0.5, sec),
    slider('repeat', '🗣️ הפסקת חזרה (אחרי התרגום)', 0, 6, 0.5, sec),
    slider('rate', '🐢 מהירות הקול', 0.7, 1.3, 0.1, v => `×${(+v).toFixed(1)}`),
    sw('frAgain', 'להשמיע שוב את הצרפתית אחרי העברית'),
    sw('reviewEvery', 'חזרה מהירה כל 25 מילים'),
    sw('keepAwake', 'להשאיר את המסך דלוק'));
}

function showSetup(root, s0, autostart) {
  const set = st.getSettings();
  const picker = sourcePicker(s0, { allow: ['part', 'range', 'due', 'weak', 'all'] });
  const order = h('div.seg', [['fr-he', 'צרפתית ← עברית'], ['he-fr', 'עברית ← צרפתית']].map(([k, l]) =>
    h('button', { type: 'button', class: set.order === k ? 'on' : '', onclick: e => { st.setSettings({ order: k }); [...order.children].forEach(b => b.classList.toggle('on', b === e.currentTarget)); } }, l)));
  const shuf = h('input', { type: 'checkbox', checked: set.shuffle });
  shuf.onchange = () => st.setSettings({ shuffle: shuf.checked });
  const start = () => {
    const src = picker.get(); const words = pick(src);
    if (!words.length) { toast('אין מילים ברשימה הזו'); return; }
    if (src.type === 'part') st.setSettings({ lastPart: src.p });
    showPlayer(root, src, words);
  };
  put(root, 
    h('h1', '🎧 מצב האזנה'),
    h('p.muted', 'שומעים את המילה ← מנסים להיזכר (ספירה לאחור) ← שומעים את התרגום ← חוזרים בקול. אפשר לכבות את המסך ולהמשיך להקשיב באוזניות.'),
    h('div.card', picker.el,
      h('div.field', h('span.lbl', 'סדר'), order),
      h('label.switch', h('span', '🔀 סדר אקראי'), shuf)),
    h('div.card', { style: { marginTop: '12px' } }, h('h2.h3', { style: { marginTop: 0 } }, 'הגדרות'), settingsControls()),
    h('div', { style: { height: '14px' } }),
    h('button.btn.block.lg', { type: 'button', onclick: start }, '▶️ להתחיל להאזין'));
  if (autostart) start();
}

function buildTimeline(words, set) {
  const TL = []; const reviewOn = set.reviewEvery && words.length > BLOCK;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    TL.push({ w, i, t: 'first', start: true }, { w, i, t: 'recall' }, { w, i, t: 'second' });
    if (set.frAgain) TL.push({ w, i, t: 'firstAgain' });
    TL.push({ w, i, t: 'repeat' });
    const endBlock = (i + 1) % BLOCK === 0 || i === words.length - 1;
    if (reviewOn && endBlock) {
      const a = i - ((i % BLOCK)); const blk = words.slice(a, i + 1);
      if (blk.length >= 5) {
        TL.push({ t: 'revTitle', i, a, b: i, start: true, w: blk[0] });
        blk.forEach((rw, k) => TL.push({ w: rw, i: a + k, t: 'first', rev: true }, { w: rw, i: a + k, t: 'revPause', rev: true }, { w: rw, i: a + k, t: 'second', rev: true, silent: true }, { w: rw, i: a + k, t: 'revShow', rev: true }));
      }
    }
  }
  return TL;
}

function showPlayer(root, src, words0) {
  const set0 = st.getSettings();
  const words = set0.shuffle ? shuffle(words0) : words0;
  let TL = buildTimeline(words, set0);
  const A = document.getElementById('player');
  let idx = 0, playing = false, chunks = [], remaining = 0, total = 0, token = 0, wakeLock = null, ended = false;

  // ---- UI
  const ui = {
    head: h('div.p-head'), tag: h('div'), emo: h('div.emo-slot'), fr: h('div.big-en.fr'), meta: h('div.row', { style: { justifyContent: 'center' } }),
    he: h('div.big-he.hide'), phase: h('div.phase'), ring: h('div.ring', { html: ringSVG(96, 8, 0) + '<div class="num"></div>' }),
    playBtn: h('button.ctl.main', { type: 'button', 'aria-label': 'נגן / השהה' }, '▶'),
    prog: h('i', { style: { width: '0%' } }),
  };
  const card = h('div.player', ui.head, ui.tag, ui.emo, ui.fr, ui.meta, ui.he, ui.phase, ui.ring,
    h('div.controls',
      h('button.ctl', { type: 'button', 'aria-label': 'המילה הקודמת', onclick: () => jump(-1) }, '⏮'),
      ui.playBtn,
      h('button.ctl', { type: 'button', 'aria-label': 'המילה הבאה', onclick: () => jump(1) }, '⏭')));
  ui.playBtn.onclick = () => playing ? pause() : resume();
  const settingsBox = h('details.card', { style: { marginTop: '12px' } }, h('summary', { style: { fontWeight: 600, cursor: 'pointer' } }, '⚙️ הגדרות הפסקות ומהירות'), h('div', { style: { marginTop: '10px' } }, settingsControls()));
  put(root, 
    h('div.row', h('div.grow', h('h1', { style: { margin: 0 } }, '🎧 האזנה'), h('div.small.muted', describe(src) + ` · ${words.length} מילים`)),
      h('button.btn.sm.sec', { type: 'button', onclick: () => { cleanup(); showSetup(root, src); } }, 'שינוי')),
    h('div.progress-line', ui.prog), card, settingsBox,
    h('p.small.muted.center', 'טיפ: אפשר לשלוט גם מהאוזניות או ממסך הנעילה (הפעלה/השהיה/דילוג).'));

  const lang1 = () => (st.getSettings().order === 'he-fr' ? 'he' : 'fr');
  const lang2 = () => (lang1() === 'fr' ? 'he' : 'fr');
  function show(it) {
    const w = it.w; const cat = posCat(w.pos); const o = st.getSettings().order;
    card.className = 'player c-' + cat;
    put(ui.head, h('span', it.rev ? 'חזרה מהירה' : `${it.i + 1} / ${words.length}`), h('span', `#${w.n} · חלק ${w.p}`));
    ui.prog.style.width = ((it.i + (it.t === 'repeat' ? 1 : 0)) / words.length * 100) + '%';
    if (it.t === 'revTitle') {
      put(ui.tag, h('span.review-tag', '⚡ חזרה מהירה'));
      ui.fr.textContent = ''; put(ui.meta, ); put(ui.emo, ); ui.he.textContent = `${it.b - it.a + 1} המילים האחרונות`; ui.he.classList.remove('hide');
      ui.phase.textContent = ''; return;
    }
    put(ui.tag, it.rev ? h('span.review-tag', '⚡ חזרה מהירה') : '');
    put(ui.emo, emo(w, '.emo-lg'));   // hint appears once the French is heard: during the recall countdown and after
    ui.emo.classList.toggle('wait', it.t === 'first');
    const frEl = [w.fr, w.m ? h('div.small.muted', { style: { fontStyle: 'italic', fontWeight: 400 } }, w.m) : null];
    put(ui.fr, ...(o === 'he-fr' ? [w.he] : frEl)); ui.fr.className = o === 'he-fr' ? 'big-en' : 'big-en fr';
    put(ui.meta, h('span.chip.c-' + cat, posHe(w.pos)), h('span.small.muted.fr', wMeta(w)));
    put(ui.he, ...(o === 'he-fr' ? frEl : [w.he])); ui.he.className = 'big-he' + (o === 'he-fr' ? ' fr' : '');
    const revealed = ['second', 'firstAgain', 'repeat', 'revShow'].includes(it.t);
    ui.he.classList.toggle('hide', !revealed);
  }
  function setPhase(txt, ringOn, rep) { ui.phase.textContent = txt; ui.ring.style.visibility = ringOn ? 'visible' : 'hidden'; ui.ring.classList.toggle('rep', !!rep); }
  function updRing(frac, num) {
    const fg = ui.ring.querySelector('.fg'); const c = 2 * Math.PI * 44;
    fg.style.strokeDashoffset = c * (1 - Math.max(0, Math.min(1, frac)));
    ui.ring.querySelector('.num').textContent = num;
  }
  let raf = 0;
  function tick() {
    if (total > 0 && playing) {
      const cur = Math.min(A.currentTime || 0, 1);
      const left = Math.max(0, remaining - cur);
      updRing(left / total, Math.ceil(left - 0.05) || '');
    }
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  // ---- media session
  function mediaMeta(it) {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: it.w.fr, artist: it.w.he, album: `Français · ${describe(src)}`,
        artwork: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }] });
    } catch {}
  }
  if ('mediaSession' in navigator) {
    const ms = navigator.mediaSession; const set = (a, f) => { try { ms.setActionHandler(a, f); } catch {} };
    set('play', () => resume()); set('pause', () => pause()); set('nexttrack', () => jump(1)); set('previoustrack', () => jump(-1));
    set('seekforward', () => jump(1)); set('seekbackward', () => jump(-1)); set('stop', () => pause());
  }

  // ---- engine
  function playSrc(url, rate, onend) {
    const my = ++token;
    A.onended = () => { if (my === token) onend(true); };
    A.onerror = () => { if (my === token) onend(false); };
    A.src = url; A.playbackRate = rate; A.defaultPlaybackRate = rate;
    const p = A.play(); if (p) p.catch(err => { if (my !== token) return; if (err?.name === 'NotAllowedError') { playing = false; syncBtn(); toast('לחצי ▶ כדי להתחיל'); } else onend(false); });
  }
  function clip(w, lang) {
    const rate = st.getSettings().rate;
    const fallback = () => { const my = ++token; speak(spokenText(w, lang), lang, rate).then(() => { if (my === token && playing) next(); }); };
    if (hasAudio(w, lang)) playSrc(audioUrl(w, lang), rate, ok => ok ? next() : fallback());
    else fallback();
  }
  function silence(secs, label, rep) {
    total = remaining = secs; chunks = [];
    let left = Math.round(secs * 2) / 2; while (left >= 1) { chunks.push(SIL[0]); left -= 1; } if (left > 0) chunks.push(SIL[1]);
    if (!chunks.length) { total = 0; return next(); }
    setPhase(label, true, rep); updRing(1, Math.ceil(secs));
    const step = () => {
      if (!chunks.length) { total = 0; return next(); }
      const c = chunks[0];
      playSrc(c.url, 1, () => { chunks.shift(); remaining = Math.max(0, remaining - c.s); step(); });
    };
    step();
  }
  function runStep() {
    if (idx >= TL.length) return finish();
    const it = TL[idx]; const set = st.getSettings(); total = 0;
    show(it);
    if (it.start || it.t === 'first') mediaMeta(it);
    switch (it.t) {
      case 'first': if (!it.rev) st.seen(it.w.n); setPhase(it.rev ? '' : '🎧 הקשיבי…', false); return clip(it.w, lang1());
      case 'recall': return silence(set.recall, '🤔 נסי להיזכר…');
      case 'second': if (it.silent) return next(); setPhase('', false); return clip(it.w, lang2());
      case 'firstAgain': setPhase('', false); return clip(it.w, lang1());
      case 'repeat': return silence(set.repeat, '🗣️ חזרי בקול!', true);
      case 'revTitle': setPhase('', false); return silence(1.5, '⚡ חזרה מהירה');
      case 'revPause': return silence(Math.max(1, Math.min(2, set.recall)), '', false);
      case 'revShow': return silence(1, '', true);
    }
  }
  function next() { if (!playing) return; idx++; runStep(); }
  function syncBtn() {
    ui.playBtn.textContent = playing ? '⏸' : '▶';
    if ('mediaSession' in navigator) try { navigator.mediaSession.playbackState = playing ? 'playing' : 'paused'; } catch {}
  }
  function pause() {
    playing = false; syncBtn(); A.pause(); if ('speechSynthesis' in window) speechSynthesis.cancel();
    releaseWake(); refreshTop();
  }
  function resume() {
    if (ended) { ended = false; idx = 0; TL = buildTimeline(words, st.getSettings()); }
    playing = true; syncBtn(); acquireWake();
    // continue the current clip/silence if possible, otherwise restart the step
    if (A.src && A.paused && A.currentTime > 0 && !A.ended && A.onended) { const p = A.play(); if (p) p.catch(() => runStep()); }
    else runStep();
  }
  function jump(d) {
    token++; A.pause(); ended = false;
    if (d > 0) { let j = idx + 1; while (j < TL.length && !TL[j].start) j++; idx = j; }
    else {
      let j = Math.min(idx, TL.length - 1); while (j > 0 && !TL[j].start) j--;   // start of current word
      if (idx - j <= 1 && j > 0) { j--; while (j > 0 && !TL[j].start) j--; }   // already at its start → previous word
      idx = Math.max(0, j);
    }
    if (playing) runStep(); else if (idx < TL.length) { show(TL[idx]); setPhase('', false); A.removeAttribute('src'); } else finish();
  }
  function finish() {
    playing = false; ended = true; syncBtn(); releaseWake(); total = 0;
    setPhase('🎉 סיימת את הרשימה!', false); ui.prog.style.width = '100%';
    ui.he.classList.remove('hide');
    if (src.type === 'part' && src.p < DB.parts.length) {
      put(ui.tag, h('a.btn.sm', { href: `#/listen?src=part&p=${src.p + 1}&autostart=1` }, `לחלק ${src.p + 1} ←`), ' ', h('a.btn.sm.sec', { href: `#/quiz?src=part&p=${src.p}` }, 'בחינה על החלק'));
    }
    refreshTop();
  }
  async function acquireWake() {
    if (!st.getSettings().keepAwake || !('wakeLock' in navigator)) return;
    try { wakeLock = await navigator.wakeLock.request('screen'); } catch {}
  }
  function releaseWake() { try { wakeLock?.release(); } catch {} wakeLock = null; }
  const onVis = () => { if (document.visibilityState === 'visible' && playing) acquireWake(); };
  document.addEventListener('visibilitychange', onVis);
  function cleanup() {
    playing = false; token++; cancelAnimationFrame(raf); A.onended = A.onerror = null; try { A.pause(); } catch {}
    stopAll(); releaseWake(); document.removeEventListener('visibilitychange', onVis);
    if ('mediaSession' in navigator) { ['play', 'pause', 'nexttrack', 'previoustrack', 'seekforward', 'seekbackward', 'stop'].forEach(a => { try { navigator.mediaSession.setActionHandler(a, null); } catch {} }); try { navigator.mediaSession.metadata = null; } catch {} }
  }
  onLeave(cleanup);
  show(TL[0]); setPhase('לחצי ▶ כדי להתחיל', false);
  // Start immediately (user just tapped "start", so autoplay is allowed)
  resume();
}
