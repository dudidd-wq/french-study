// Shared UI pieces
import { h, posHe, wMeta, posCat, toast, put, nWords } from './util.js';
import { DB } from './data.js';
import * as st from './store.js';
import { playWord } from './audio.js';
import { describe } from './select.js';

export function playBtn(w, lang, label) {
  const b = h('button.play' + (lang === 'he' ? '.he' : ''), { type: 'button', 'aria-label': lang === 'he' ? 'השמעה בעברית' : 'השמעה בצרפתית', title: lang === 'he' ? 'עברית' : 'Français' }, label || (lang === 'he' ? 'עב' : 'FR'));
  b.addEventListener('click', e => { e.stopPropagation(); st.seen(w.n); playWord(w, lang, { btn: b }); });
  return b;
}
/** Emoji hint for a word (null when disabled in settings or missing). Hints at the meaning; never part of scoring. */
export function emo(w, cls = '') {
  if (!w.e || !st.getSettings().emoji) return null;
  return h('span.emo' + cls, { role: 'img', 'aria-label': 'רמז ציורי ' + w.e, title: 'רמז' }, w.e);
}
export function statusChip(n) {
  const s = st.status(n);
  return h('span.chip', { style: { '--c': s === 'mastered' ? 'var(--ok)' : s === 'learning' ? 'var(--warn-ink)' : 'var(--muted)' } },
    h('span.status-dot.st-' + s), { new: 'חדשה', learning: 'בלמידה', mastered: 'שלטת' }[s]);
}
export function markButtons(w, onChange) {
  const known = h('button.mark', { type: 'button', title: 'אני יודעת את המילה', 'aria-label': 'סמני כידועה', 'aria-pressed': String(st.isKnown(w.n)) }, '✅');
  const hard = h('button.mark', { type: 'button', title: 'מילה קשה', 'aria-label': 'סמני כקשה', 'aria-pressed': String(st.isHard(w.n)) }, '⭐');
  const sync = () => { known.classList.toggle('on', st.isKnown(w.n)); hard.classList.toggle('on', st.isHard(w.n)); known.setAttribute('aria-pressed', st.isKnown(w.n)); hard.setAttribute('aria-pressed', st.isHard(w.n)); };
  known.onclick = e => { e.stopPropagation(); const on = !st.isKnown(w.n); st.setKnown(w.n, on); sync(); toast(on ? 'סומנה כ"יודעת" ✅' : 'הסימון הוסר'); onChange?.(); };
  hard.onclick = e => { e.stopPropagation(); const on = !st.isHard(w.n); st.setHard(w.n, on); sync(); toast(on ? 'נוספה למילים הקשות ⭐' : 'הוסרה מהמילים הקשות'); onChange?.(); };
  sync(); return [known, hard];
}
export function wordRow(w, { hideHe = false, onChange } = {}) {
  const cat = posCat(w.pos);
  const [known, hard] = markButtons(w, () => { put(chipBox, statusChip(w.n)); onChange?.(); });
  const chipBox = h('span', statusChip(w.n));
  const he = h('div.w-he', w.he);
  const el = h('article.word.c-' + cat + (hideHe ? '.hidden-he' : ''), { 'data-n': w.n },
    h('div.w-main',
      h('div.w-top', h('div.w-en.fr.g-' + (w.pos === 'n' ? w.g : 'x'), w.fr), h('span.w-n', `#${w.n}`)),
      w.m ? h('div.w-hint', { dir: 'auto' }, w.m) : null,
      h('div.w-he-row', emo(w), he),
      h('div.w-meta', h('span.chip.c-' + cat, posHe(w.pos)), h('span.small.muted', wMeta(w)), chipBox, known, hard)),
    h('div.w-btns', playBtn(w, 'fr'), playBtn(w, 'he')));
  he.addEventListener('click', () => el.classList.remove('hidden-he'));
  return el;
}

/** A source picker (part / range / due / weak / mixed / all). Returns {el, get()} */
export function sourcePicker(initial = { type: 'part', p: 1 }, { allow = ['part', 'text', 'range', 'due', 'weak', 'mixed', 'all'], counts } = {}) {
  if (!allow.includes('text')) allow = [allow[0], 'text', ...allow.slice(1)];
  const labels = { part: ['חלק', `אחד מ-${DB.parts.length} החלקים`], text: ['טקסט לבגרות', 'מילים מיצירה אחת'], range: ['טווח', 'מספרי מילים'], due: ['חזרות להיום', ''], weak: ['מילים קשות', 'מסומנות / טעויות'], mixed: ['מעורב', 'חזרות + קשות + חדשות'], all: ['הכול', `${DB.words.length} מילים`], new: ['חדשות', 'שעוד לא נבחנו'] };
  const name = 'src' + Math.random().toString(36).slice(2, 7);
  const partSel = h('select', { 'aria-label': 'בחירת חלק' }, DB.parts.map(P => h('option', { value: P.id, selected: P.id === (initial.p || 1) }, `חלק ${P.id} · ${P.kind === 'bagrut' ? 'בגרות' : P.label} · מילים ${P.from}–${P.to}`)));
  const a = h('input', { type: 'number', min: 1, max: DB.words.length, value: initial.a || 1, inputmode: 'numeric', 'aria-label': 'ממילה' });
  const b = h('input', { type: 'number', min: 1, max: DB.words.length, value: initial.b || 200, inputmode: 'numeric', 'aria-label': 'עד מילה' });
  const partBox = h('div.field', h('label', 'איזה חלק?'), partSel);
  const textSel = h('select', { 'aria-label': 'בחירת טקסט' }, Object.entries(DB.texts).map(([k, v]) => h('option', { value: k, selected: k === initial.t }, `${v} · ${DB.words.filter(w => w.tx.includes(k)).length} מילים`)));
  const textBox = h('div.field', h('label', 'איזה טקסט?'), textSel);
  const rangeBox = h('div.field', h('span.lbl', `טווח מילים (1–${DB.words.length})`), h('div.row', h('span', 'מ־'), h('div.grow', a), h('span', 'עד'), h('div.grow', b)));
  const opts = h('div.opts', allow.map(t => {
    const c = counts?.[t];
    return h('label.opt', h('input', { type: 'radio', name, value: t, checked: t === initial.type }),
      h('span', labels[t][0], h('small', c != null ? nWords(c) : labels[t][1])));
  }));
  const sync = () => { const t = get().type; partBox.hidden = t !== 'part'; rangeBox.hidden = t !== 'range'; textBox.hidden = t !== 'text'; };
  opts.addEventListener('change', sync);
  function get() {
    const t = (opts.querySelector('input:checked') || {}).value || 'part';
    return { type: t, p: +partSel.value, t: textSel.value, a: Math.max(1, Math.min(DB.words.length, +a.value || 1)), b: Math.max(1, Math.min(DB.words.length, +b.value || 1)) };
  }
  const el = h('div', h('div.field', h('span.lbl', 'מה לתרגל?'), opts), partBox, textBox, rangeBox);
  sync();
  return { el, get, describe: () => describe(get()) };
}
export function emptyState(icon, title, sub, action) {
  return h('div.empty', h('div.ei', icon), h('h2.h3', title), sub ? h('p', sub) : null, action || null);
}
