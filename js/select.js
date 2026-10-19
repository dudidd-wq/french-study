// Word-set selection shared by flashcards / listening / quiz
import { DB, partWords, rangeWords, textWords } from './data.js';
import * as st from './store.js';
import { shuffle } from './util.js';

export function parseSrc(q) {
  const src = q.get('src') || 'part';
  return { type: src, p: +q.get('p') || 1, t: q.get('t') || 'pp', a: +q.get('a') || 1, b: +q.get('b') || DB.words.length };
}
export function srcQuery(s) {
  const u = new URLSearchParams({ src: s.type });
  if (s.type === 'part') u.set('p', s.p);
  if (s.type === 'text') u.set('t', s.t);
  if (s.type === 'range') { u.set('a', s.a); u.set('b', s.b); }
  return u.toString();
}
export function describe(s) {
  switch (s.type) {
    case 'part': { const P = DB.parts[s.p - 1]; return `חלק ${s.p} · ${P.kind === 'bagrut' ? 'בגרות' : P.label} (מילים ${P.from}–${P.to})`; }
    case 'range': return `מילים ${s.a}–${s.b}`;
    case 'due': return 'חזרות להיום';
    case 'weak': return 'מילים קשות / חלשות';
    case 'new': return 'מילים חדשות';
    case 'mixed': return 'תרגול מעורב';
    case 'all': return `כל ${DB.words.length} המילים`;
    case 'text': return `בגרות: ${DB.texts[s.t] || s.t}`;
  }
  return '';
}
/** Returns words in natural order (caller may shuffle). */
export function pick(s, limit = 0) {
  let L;
  switch (s.type) {
    case 'part': L = partWords(s.p); break;
    case 'text': L = textWords(s.t); break;
    case 'range': { const a = Math.min(s.a, s.b), b = Math.max(s.a, s.b); L = rangeWords(a, b); break; }
    case 'due': L = st.dueList(); break;
    case 'weak': L = DB.words.filter(w => st.isWeak(w.n)); break;
    case 'new': L = DB.words.filter(w => st.status(w.n) === 'new'); break;
    case 'all': L = DB.words.slice(); break;
    case 'mixed': {
      const due = shuffle(st.dueList()), weak = shuffle(DB.words.filter(w => st.isWeak(w.n) && !st.isDue(w.n)));
      const learning = shuffle(DB.words.filter(w => st.status(w.n) === 'learning' && !st.isDue(w.n) && !st.isWeak(w.n)));
      const studiedParts = new Set(DB.words.filter(w => st.rec(w.n)).map(w => w.p));
      if (!studiedParts.size) studiedParts.add(st.getSettings().lastPart || 1);
      const fresh = shuffle(DB.words.filter(w => st.status(w.n) === 'new' && studiedParts.has(w.p)));
      const n = limit || 20; const seen = new Set(); L = [];
      const take = (arr, k) => { for (const w of arr) { if (L.length >= k) break; if (!seen.has(w.n)) { seen.add(w.n); L.push(w); } } };
      take(due, Math.ceil(n * .5)); take(weak, Math.ceil(n * .75)); take(learning, Math.ceil(n * .9)); take(fresh, n);
      take(shuffle(DB.words), n);
      return L;
    }
    default: L = [];
  }
  return limit ? L.slice(0, limit) : L;
}
