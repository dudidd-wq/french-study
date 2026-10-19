import { h, add, posHe, wMeta, posCat, shuffle, sample, toast, confetti, ringSVG, put } from '../util.js';
import { DB } from '../data.js';
import * as st from '../store.js';
import { playWord, stop, sfx } from '../audio.js';
import { parseSrc, pick, describe } from '../select.js';
import { onLeave, refreshTop } from '../nav.js';
import { sourcePicker, playBtn, emptyState, emo } from '../ui.js';
import { check, variants } from '../match.js';

const TYPES = {
  'fr-he': ['צרפתית ← עברית', 'רואים מילה, בוחרים תרגום'],
  'he-fr': ['עברית ← צרפתית', 'רואים תרגום, בוחרים מילה'],
  listen: ['שמיעה 🎧', 'שומעים, בוחרים פירוש'],
  type: ['הקלדה ⌨️', 'מקלידים את המילה בצרפתית'],
  mixed: ['מעורב 🎲', 'כל הסוגים יחד'],
};

export function quizView(_m, q) {
  const root = h('div');
  const s0 = q.has('src') ? parseSrc(q) : { type: st.dueList().length >= 5 ? 'due' : 'part', p: st.getSettings().lastPart || 1 };
  setup(root, s0, q.get('type'));
  return root;
}

function setup(root, s0, type0) {
  const set = st.getSettings();
  const counts = { due: st.dueList().length, weak: DB.words.filter(w => st.isWeak(w.n)).length };
  const picker = sourcePicker(s0, { allow: ['part', 'range', 'due', 'weak', 'mixed', 'all'], counts });
  const tname = 'qt' + Math.random().toString(36).slice(2, 6);
  const types = h('div.opts', Object.entries(TYPES).map(([k, [a, b]]) => h('label.opt', h('input', { type: 'radio', name: tname, value: k, checked: k === (type0 || 'mixed') }), h('span', a, h('small', b)))));
  const cnt = h('select', { 'aria-label': 'כמה שאלות' }, [10, 20, 30, 50, 0].map(n => h('option', { value: n, selected: n === set.quizCount }, n ? `${n} שאלות` : 'כל המילים')));
  const start = () => {
    const src = picker.get(); const type = types.querySelector('input:checked').value; const n = +cnt.value;
    st.setSettings({ quizCount: n }); if (src.type === 'part') st.setSettings({ lastPart: src.p });
    let words = pick(src, src.type === 'mixed' ? (n || 30) : 0);
    if (!words.length) { toast(src.type === 'due' ? 'אין חזרות להיום 🎉' : src.type === 'weak' ? 'אין עדיין מילים קשות' : 'אין מילים ברשימה'); return; }
    words = shuffle(words); if (n) words = words.slice(0, n);
    run(root, { src, type, words, back: () => setup(root, src, type) });
  };
  put(root, 
    h('h1', '✍️ בחינה עצמית'),
    h('p.muted', 'בחרי סוג שאלות ומילים. כל תשובה מעדכנת את מעקב הלמידה.'),
    h('a.card.row.s-entry', { href: `#/sentences?src=part&p=${s0.p || set.lastPart || 1}`, style: { textDecoration: 'none', color: 'inherit', marginBottom: '12px' } },
      h('span', { style: { fontSize: '2rem' } }, '💬'), h('div.grow', h('b', 'חדש: משפטי שיחה'), h('div.small.muted', 'השלמת מילה, בניית משפט ודיאלוג קצר')), h('span.btn.sm', 'לתרגול')),
    h('div.card', h('div.field', h('span.lbl', 'סוג הבחינה'), types)),
    h('div.card', { style: { marginTop: '12px' } }, picker.el, h('div.field', h('label', 'כמה שאלות?'), cnt)),
    h('div', { style: { height: '14px' } }),
    h('button.btn.block.lg', { type: 'button', onclick: start }, '🚀 להתחיל'));
}

// Hebrew "senses" of a translation: comma/slash alternatives, without niqqud and (...) notes
const heSenses = he => String(he).replace(/\([^)]*\)/g, ' ').replace(/[\u0591-\u05C7]/g, '').split(/[,/;]|\s+או\s+/).map(t => t.replace(/\.{2,}|…/g, '').trim()).filter(Boolean);
const frKey = en => String(en).toLowerCase().trim();
/** true when x would ALSO be a correct answer for w (same French, same Hebrew, or a shared Hebrew sense) */
export function overlaps(w, x) {
  if (frKey(x.fr) === frKey(w.fr) || x.he.trim() === w.he.trim()) return true;
  const a = new Set(heSenses(w.he)); return heSenses(x.he).some(t => a.has(t));
}
// "near-duplicate" French forms: same word with/without article, reflexive se/s' or a trailing de/à,
// or one is the start of the other ("la carte" / "la carte bancaire", "pendant" / "pendant que")
const frBase = fr => String(fr).toLowerCase().replace(/[\u2019]/g, "'").split(/\s*[,/]\s*/)[0]
  .replace(/^(le|la|les|un|une)\s+|^l'/, '').replace(/^(se\s+|s')/, '').replace(/\s+(de|d'|à)$/, '').trim();
export function nearDup(a, b) { const x = frBase(a.fr), y = frBase(b.fr); return x === y || x.startsWith(y + ' ') || y.startsWith(x + ' '); }
export function distractors(w, field, k = 3) {
  const cat = posCat(w.pos); const val = x => x[field];
  const bad = new Set([val(w).trim()]);
  const ok = x => x.n !== w.n && !bad.has(val(x).trim()) && !overlaps(w, x) && !nearDup(w, x);
  let pool = DB.words.filter(x => ok(x) && posCat(x.pos) === cat && Math.abs(x.p - w.p) <= 2);
  if (pool.length < 12) pool = DB.words.filter(x => ok(x) && posCat(x.pos) === cat);
  const out = [];
  for (const x of shuffle(pool)) { if (out.length >= k) break; if (!bad.has(val(x).trim()) && !out.some(y => overlaps(x, y) || nearDup(x, y))) { bad.add(val(x).trim()); out.push(x); } }
  return out;
}
let TAKEN = null;   // normalized variants of every list entry (built once)
const taken = () => TAKEN || (TAKEN = new Set(DB.words.flatMap(x => variants(x.fr))));

/** Optional picture hint: hidden until tapped; does not affect scoring. */
function emoHint(w) {
  const e = emo(w, '.emo-md'); if (!e) return null;
  const box = h('div.emo-hint');
  const btn = h('button.btn.sm.ghost', { type: 'button', 'aria-label': 'הצגת רמז ציורי' }, '🫣 רמז ציורי');
  btn.onclick = ev => { ev.stopPropagation(); put(box, e); };
  return put(box, btn);
}
function run(root, cfg) {
  const { words, src } = cfg;
  let i = 0; const results = []; const t0 = Date.now(); let busy = false; let nextTimer = 0;
  const onKey = e => {
    if (e.key === 'Enter' && nextBtn && !nextBtn.hidden) { e.preventDefault(); goNext(); }
    else if (/^[1-4]$/.test(e.key) && !e.target.closest('input')) { const b = root.querySelectorAll('.choice')[+e.key - 1]; b?.click(); }
  };
  document.addEventListener('keydown', onKey);
  onLeave(() => { document.removeEventListener('keydown', onKey); clearTimeout(nextTimer); stop(); });
  let nextBtn;

  function goNext() { clearTimeout(nextTimer); i++; i < words.length ? ask() : summary(); }
  function ask() {
    busy = false; stop();
    const w = words[i]; const type = cfg.type === 'mixed' ? ['fr-he', 'he-fr', 'listen', 'type'][Math.floor(Math.random() * 4)] : cfg.type;
    const cat = posCat(w.pos);
    const promptBox = h('div.q-prompt.c-' + cat, { style: { borderTop: '5px solid var(--c)' } });
    const fb = h('div'); nextBtn = h('button.btn.block.lg', { type: 'button', hidden: true, onclick: goNext, style: { marginTop: '12px' } }, i + 1 < words.length ? 'הבא ←' : 'לסיכום 🏁');
    const metaRow = h('div.row', { style: { justifyContent: 'center', marginTop: '6px' } }, h('span.chip.c-' + cat, posHe(w.pos)), h('span.small.muted.fr', wMeta(w)));
    let body;
    if (type === 'fr-he' || type === 'listen' || type === 'he-fr') {
      const field = type === 'he-fr' ? 'fr' : 'he';
      const opts = shuffle([w, ...distractors(w, field)]);
      if (type === 'fr-he') add(promptBox, h('div.q-type', 'מה התרגום?'), h('div.big-en.fr', w.fr), w.m ? h('div.small.muted.fr', { style: { fontStyle: 'italic' } }, w.m) : null, metaRow, h('div', { style: { marginTop: '8px' } }, playBtn(w, 'fr')), emoHint(w));
      if (type === 'he-fr') add(promptBox, h('div.q-type', 'איך אומרים בצרפתית?'), h('div.big-he', w.he), metaRow);
      if (type === 'listen') {
        const big = h('button.play', { type: 'button', style: { width: '84px', height: '84px', fontSize: '2rem', margin: '6px auto' }, 'aria-label': 'השמעה חוזרת' }, '🔊');
        big.onclick = () => playWord(w, 'fr', { btn: big });
        add(promptBox, h('div.q-type', 'הקשיבי – מה הפירוש?'), big, h('div.small.muted', 'אפשר ללחוץ כדי לשמוע שוב'), emoHint(w));
        setTimeout(() => playWord(w, 'fr', { btn: big }), 250);
      }
      body = h('div.choices', opts.map((o, k) => h('button.choice' + (field === 'fr' ? '.fr-choice' : ''), { type: 'button', onclick: e => choose(o, e.currentTarget) }, o[field])));
      function choose(o, btn) {
        if (busy) return; busy = true;
        const ok = o.n === w.n;
        [...body.children].forEach((b, k) => { b.disabled = true; if (opts[k].n === w.n) b.classList.add('correct'); });
        if (!ok) btn.classList.add('wrong');
        done(ok, type, ok ? '' : o[field]);
      }
    } else {
      add(promptBox, h('div.q-type', 'הקלידי את המילה בצרפתית'), h('div.big-he', w.he), metaRow);
      const inp = h('input.type-in', { type: 'text', autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off', spellcheck: false, placeholder: 'écris ici…', lang: 'fr', 'aria-label': 'התשובה בצרפתית', enterkeyhint: 'done' });
      const hintBox = h('div.small.muted.fr', { style: { marginTop: '6px', minHeight: '1.2em' } });
      let hints = 0;
      const hintBtn = h('button.btn.sm.ghost', { type: 'button', onclick: () => { hints++; const first = w.fr; hintBox.textContent = hints === 1 ? `${first.slice(0, 1)}${'_'.repeat(Math.max(0, first.split(' ')[0].length - 1))}${w.m ? '  · ' + w.m : ''}` : first.replace(/[a-zà-ÿœ]/gi, (c, k) => k < Math.ceil(first.length / 2) ? c : '_'); } }, '💡 רמז');
      const submit = () => {
        if (busy) return; if (!inp.value.trim()) { inp.focus(); return; }
        busy = true; const also = DB.words.filter(x => x.n !== w.n && x.he.trim() === w.he.trim()).map(x => x.fr);
        const r = check(inp.value, w.fr, { also, taken: taken() }); inp.disabled = true;
        inp.classList.add(r ? 'correct' : 'wrong');
        done(!!r, type, r ? '' : inp.value, r === 'accent' ? 'נכון! רק שימי לב לסימנים (accents) 😉' : r === 'article' ? 'נכון! שימי לב: ' + w.fr : r === 'typo' ? 'כמעט מושלם – שימי לב לאיות' : '');
      };
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (!busy) submit(); else goNext(); } });
      const accents = h('div.accents', { 'aria-label': 'אותיות עם סימנים' }, ['é', 'è', 'ê', 'à', 'â', 'ç', 'ù', 'û', 'ô', 'î', 'ï', 'ë', 'œ', "'"].map(c =>
        h('button.acc-key', { type: 'button', onclick: () => { const a = inp.selectionStart ?? inp.value.length, b = inp.selectionEnd ?? a; inp.value = inp.value.slice(0, a) + c + inp.value.slice(b); inp.focus(); inp.setSelectionRange(a + 1, a + 1); } }, c)));
      body = h('div', h('form', { onsubmit: e => { e.preventDefault(); submit(); } }, inp), accents, hintBox,
        h('div.row', { style: { marginTop: '8px' } }, h('button.btn', { type: 'button', onclick: submit }, 'בדיקה'), hintBtn,
          h('button.btn.sm.ghost', { type: 'button', onclick: () => { if (busy) return; busy = true; inp.disabled = true; done(false, type, '(לא ידעתי)'); } }, 'לא יודעת')));
      setTimeout(() => inp.focus(), 50);
    }
    function done(ok, type, given, note) {
      st.answer(w.n, ok); refreshTop();
      results.push({ w, ok, type, given });
      sfx(ok ? 'ok' : 'bad');
      put(fb, h('div.feedback.' + (ok ? 'ok' : 'bad'),
        h('span', ok ? (note || ['מצוין! 🎉', 'נכון! ✨', 'יפה מאוד! 💪', 'בדיוק! 👏'][Math.floor(Math.random() * 4)]) : 'לא נורא – התשובה הנכונה:'),
        h('span.fb-word', h('b.fr', w.fr), ' = ', w.he, emo(w, '.emo-sm')), playBtn(w, 'fr'), playBtn(w, 'he')));
      nextBtn.hidden = false;
      // audio feedback: hear the word (French; Hebrew too when wrong)
      setTimeout(async () => { const r = await playWord(w, 'fr'); if (!ok && r) await playWord(w, 'he'); }, 350);
      if (ok) nextTimer = setTimeout(goNext, note ? 3000 : 1900);
      else nextBtn.focus({ preventScroll: true });
    }
    const score = results.filter(r => r.ok).length;
    put(root, 
      h('div.row', h('div.grow', h('div.small.muted', `${describe(src)} · ${TYPES[cfg.type][0]}`), h('b', `שאלה ${i + 1} מתוך ${words.length}`)),
        h('span.pill', '✅ ', score), h('button.btn.sm.ghost', { type: 'button', onclick: () => { if (results.length) summary(); else cfg.back(); } }, 'סיום')),
      h('div.progress-line', h('i', { style: { width: (i / words.length * 100) + '%' } })),
      promptBox, body, fb, nextBtn);
  }

  function summary() {
    clearTimeout(nextTimer); stop();
    const ok = results.filter(r => r.ok).length, tot = results.length, pct = tot ? Math.round(ok / tot * 100) : 0;
    const secs = Math.round((Date.now() - t0) / 1000);
    if (pct >= 80) { sfx('win'); confetti(); }
    const wrong = results.filter(r => !r.ok);
    const ring = h('div.score-ring', { html: ringSVG(150, 14, pct / 100) + `<div class="num">${pct}%</div>` });
    ring.querySelector('.fg').style.stroke = pct >= 80 ? 'var(--ok)' : pct >= 50 ? 'var(--warn)' : 'var(--bad)';
    ring.querySelector('.bg').style.stroke = 'var(--line)';
    const msg = pct === 100 ? 'מושלם! 🏆' : pct >= 85 ? 'מצוין! 🌟' : pct >= 70 ? 'יפה מאוד! 💪' : pct >= 50 ? 'בדרך הנכונה 🙂' : 'כדאי לחזור על המילים ולנסות שוב 💜';
    const byType = {}; results.forEach(r => { const b = byType[r.type] || (byType[r.type] = [0, 0]); b[1]++; if (r.ok) b[0]++; });
    put(root, 
      h('h1', 'סיכום הבחינה'),
      h('div.card.center', ring, h('h2', { style: { margin: '4px 0' } }, msg), h('p.muted', `${ok === 1 ? 'תשובה נכונה אחת' : ok + ' תשובות נכונות'} מתוך ${tot} · ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} דקות`),
        h('div.row', { style: { justifyContent: 'center' } }, Object.entries(byType).map(([t, [a, b]]) => h('span.pill', `${TYPES[t][0]}: ${a}/${b}`)))),
      wrong.length ? h('div.card', { style: { marginTop: '12px' } }, h('h2.h3', `טעויות (${wrong.length}) – נוספו לחזרות`),
        h('ul.list-plain', wrong.map(r => h('li', playBtn(r.w, 'fr'), h('div.grow', h('b.fr', r.w.fr), h('div', r.w.he), r.given ? h('div.small', { style: { color: 'var(--bad)' } }, 'ענית: ', h('span', { dir: 'auto' }, r.given)) : null))))) : null,
      h('div.row', { style: { marginTop: '14px' } },
        wrong.length ? h('button.btn.acc', { type: 'button', onclick: () => run(root, { ...cfg, words: shuffle(wrong.map(r => r.w)) }) }, '🔁 תרגול הטעויות') : null,
        h('button.btn', { type: 'button', onclick: () => run(root, { ...cfg, words: shuffle(words) }) }, 'שוב אותה בחינה'),
        h('button.btn.sec', { type: 'button', onclick: cfg.back }, 'בחינה חדשה'),
        h('a.btn.ghost', { href: '#/stats' }, '📈 למעקב')));
  }
  ask();
}
