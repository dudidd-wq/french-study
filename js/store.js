// Progress tracking: Leitner-style spaced repetition stored in localStorage.
import { dayNum, dayKey } from './util.js';
import { DB } from './data.js';

const KEY = 'french.progress.v1';
const SKEY = 'french.settings.v1';
// box -> interval in days until next review
export const INTERVALS = [0, 1, 2, 4, 8, 16, 32];
export const MASTER_BOX = 4;   // box >= 4  ==> "mastered" (next review in 8+ days)
const MAX_BOX = INTERVALS.length - 1;

const blank = () => ({ v: 1, words: {}, days: {}, created: Date.now() });
let S = load();
function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.words) return s; } catch {}
  return blank();
}
export function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { console.warn('save failed', e); } }

export const rec = n => S.words[n];
export function status(n) {
  const r = S.words[n];
  if (!r || (!r.s && !r.k && !r.h)) return 'new';
  if (r.k || r.b >= MASTER_BOX) return 'mastered';
  return 'learning';
}
export const isHard = n => !!S.words[n]?.h;
export const isKnown = n => !!S.words[n]?.k;
export function isWeak(n) {
  const r = S.words[n]; if (!r) return false;
  if (r.h) return true;
  if (!r.s) return false;
  return (r.w || 0) > 0 && (r.b <= 2 || (r.c || 0) / r.s < 0.7);
}
export const isDue = (n, t = dayNum()) => { const r = S.words[n]; return !!r && r.d != null && r.d <= t && !r.k; };

function touchDay(fn) {
  const k = dayKey(); const d = S.days[k] || (S.days[k] = { a: 0, c: 0, nw: 0, m: 0 });
  fn(d);
}
/** Record an answer (quiz or flashcard). correct: boolean */
export function answer(n, correct, { learnOnly = false } = {}) {
  const t = dayNum();
  const r = S.words[n] || (S.words[n] = { b: 0, s: 0, c: 0, w: 0 });
  const wasNew = !r.s; const wasMastered = status(n) === 'mastered';
  r.s++; r.last = t;
  if (correct) {
    r.c++;
    // only advance once per day so cramming does not fake mastery (except brand-new box 0)
    if (r.adv !== t || r.b === 0) { r.b = Math.min(MAX_BOX, r.b + 1); r.adv = t; }
  } else { r.w++; r.b = 1; r.k = false; }
  r.d = t + (correct ? INTERVALS[r.b] : 0);
  touchDay(d => { if (!learnOnly) { d.a++; if (correct) d.c++; } if (wasNew) d.nw++; if (!wasMastered && status(n) === 'mastered') d.m++; });
  save();
}
/** Just viewed/heard (counts for streak + marks word as seen, without grading) */
export function seen(n) {
  const r = S.words[n] || (S.words[n] = { b: 0, s: 0, c: 0, w: 0 });
  r.seen = (r.seen || 0) + 1;
  touchDay(d => d.v = (d.v || 0) + 1);
  save();
}
export function setKnown(n, on = true) {
  const t = dayNum(); const r = S.words[n] || (S.words[n] = { b: 0, s: 0, c: 0, w: 0 });
  r.k = on; if (on) { r.h = false; r.b = MAX_BOX; r.d = t + INTERVALS[MAX_BOX]; } else { r.b = Math.min(r.b, 2); r.d = t; }
  touchDay(d => d.v = (d.v || 0) + 1); save();
}
export function setHard(n, on = true) {
  const t = dayNum(); const r = S.words[n] || (S.words[n] = { b: 0, s: 0, c: 0, w: 0 });
  r.h = on; if (on) { r.k = false; r.b = Math.min(r.b, 1); r.d = t; }
  touchDay(d => d.v = (d.v || 0) + 1); save();
}

export function dueList(t = dayNum()) {
  return DB.words.filter(w => isDue(w.n, t)).sort((a, b) => (S.words[a.n].d - S.words[b.n].d) || (S.words[a.n].b - S.words[b.n].b));
}
export function counts(list = DB.words) {
  const c = { new: 0, learning: 0, mastered: 0, total: list.length };
  for (const w of list) c[status(w.n)]++;
  return c;
}
export function streak() {
  const t = dayNum(); let s = 0;
  const active = k => { const d = S.days[k]; return d && ((d.a || 0) + (d.v || 0) + (d.nw || 0)) > 0; };
  let i = active(dayKey(t)) ? t : t - 1;           // today not yet active? streak still alive from yesterday
  while (active(dayKey(i))) { s++; i--; }
  return { days: s, today: active(dayKey(t)) };
}
export function bestStreak() {
  const ks = Object.keys(S.days).filter(k => { const d = S.days[k]; return ((d.a || 0) + (d.v || 0) + (d.nw || 0)) > 0; }).sort();
  let best = 0, cur = 0, prev = null;
  for (const k of ks) { const n = Math.round(Date.parse(k) / 86400000); cur = prev != null && n === prev + 1 ? cur + 1 : 1; best = Math.max(best, cur); prev = n; }
  return best;
}
export const days = () => S.days;
export function totals() {
  let a = 0, c = 0; for (const d of Object.values(S.days)) { a += d.a || 0; c += d.c || 0; }
  return { a, c };
}

export function exportJSON() { return JSON.stringify({ app: 'french-study', exported: new Date().toISOString(), progress: S, settings: getSettings() }, null, 1); }
export function importJSON(text) {
  const j = JSON.parse(text); const p = j.progress || j;
  if (!p || typeof p.words !== 'object' || typeof p.days !== 'object') throw new Error('bad file');
  S = { v: 1, created: p.created || Date.now(), words: p.words, days: p.days }; save();
  if (j.settings) setSettings(j.settings);
}
export function resetAll() { S = blank(); save(); }

// ---- settings
const DEF = { recall: 2, repeat: 1.5, rate: 1, reviewEvery: true, frAgain: false, order: 'fr-he', shuffle: false, keepAwake: false, sfx: true, autoplayCards: true, hideHe: false, emoji: true, quizCount: 20, lastPart: 1 };
export function getSettings() { try { return { ...DEF, ...JSON.parse(localStorage.getItem(SKEY) || '{}') }; } catch { return { ...DEF }; } }
export function setSettings(patch) { const s = { ...getSettings(), ...patch }; localStorage.setItem(SKEY, JSON.stringify(s)); return s; }
