// Conversation-sentence quizzes ("משפטי שיחה"): fill-in, build-a-sentence (tap or drag), mini dialogue.
// Items live in data/sentences.json (built by tools/sentences/build_sentences.py). Each answer updates the
// Leitner record of the item's target word(s), exactly like the word quizzes.
import { h, shuffle, confetti, ringSVG, toast, put } from '../util.js';
import { DB, word } from '../data.js';
import * as st from '../store.js';
import { playSentence, stop, sfx } from '../audio.js';
import { onLeave, refreshTop } from '../nav.js';
import { playBtn, emptyState, emo } from '../ui.js';

const KINDS = {
  mix: ['הכול מעורב 🎲', 'השלמה, בנייה ודיאלוג'],
  fill: ['השלמת מילה ✏️', 'משפט עם מילה חסרה'],
  build: ['בניית משפט 🧩', 'מסדרים מילים לפי הסדר'],
  dialog: ['דיאלוג קצר 💬', 'שיחה עם מילה חסרה'],
};
const SRCS = {
  part: ['חלק', 'משפטים של חלק אחד'],
  review: ['חזרה', 'מילים לחזרה / קשות'],
  mix: ['מעורב', 'מכל החלקים שלמדת'],
  all: ['הכול', 'כל המשפטים'],
};
let ITEMS = null;
async function load() {
  if (ITEMS) return ITEMS;
  const r = await fetch('data/sentences.json'); if (!r.ok) throw new Error('sentences.json ' + r.status);
  ITEMS = (await r.json()).items; return ITEMS;
}
const norm = s => String(s).toLowerCase().normalize('NFC').replace(/[’]/g, "'").match(/[a-zà-ÿœ0-9'-]+/g)?.join(' ') || '';

export async function sentView(_m, q) {
  const root = h('div');
  try { await load(); } catch (e) { return emptyState('😕', 'לא הצלחתי לטעון את המשפטים', String(e)); }
  setup(root, { src: q.get('src') || 'part', p: +q.get('p') || st.getSettings().lastPart || 1, kind: q.get('kind') || 'mix' });
  return root;
}

function pickItems(cfg) {
  const byKind = it => cfg.kind === 'mix' || it.type === cfg.kind;
  let L = ITEMS.filter(byKind);
  if (cfg.src === 'part') L = L.filter(it => it.part === cfg.p);
  else if (cfg.src === 'review') L = L.filter(it => it.t.some(n => st.isDue(n) || st.isWeak(n)));
  else if (cfg.src === 'mix') {
    const studied = new Set(DB.words.filter(w => st.rec(w.n)).map(w => w.p)); studied.add(st.getSettings().lastPart || 1);
    const maxP = Math.max(...studied); L = L.filter(it => it.part <= maxP);
  }
  return shuffle(L);
}

function radios(name, obj, cur) {
  return h('div.opts', Object.entries(obj).map(([k, [a, b]]) => h('label.opt', h('input', { type: 'radio', name, value: k, checked: k === cur }), h('span', a, h('small', b)))));
}

function setup(root, c0) {
  const kinds = radios('sk', KINDS, c0.kind);
  const srcs = radios('ss', SRCS, c0.src);
  const partSel = h('select', { 'aria-label': 'בחירת חלק' }, DB.parts.map(P => h('option', { value: P.id, selected: P.id === c0.p }, `חלק ${P.id} · ${P.kind === 'bagrut' ? 'בגרות' : P.label} · מילים ${P.from}–${P.to}`)));
  const partBox = h('div.field', h('label', 'איזה חלק?'), partSel);
  const cnt = h('select', { 'aria-label': 'כמה משפטים' }, [8, 16, 24, 0].map(n => h('option', { value: n, selected: n === 8 }, n ? `${n} משפטים` : 'כל המשפטים')));
  const info = h('div.small.muted');
  const get = () => ({ kind: kinds.querySelector('input:checked').value, src: srcs.querySelector('input:checked').value, p: +partSel.value, n: +cnt.value });
  const sync = () => { const c = get(); partBox.hidden = c.src !== 'part'; const k = pickItems(c).length; info.textContent = k ? `${k} משפטים זמינים` : 'אין משפטים בבחירה הזו'; };
  [kinds, srcs, partSel].forEach(el => el.addEventListener('change', sync));
  const start = () => {
    const c = get(); let L = pickItems(c);
    if (!L.length) { toast(c.src === 'review' ? 'אין עדיין מילים לחזרה – נסי חלק או מעורב' : 'אין משפטים בבחירה הזו'); return; }
    if (c.src === 'part') st.setSettings({ lastPart: c.p });
    if (c.n) L = L.slice(0, c.n);
    run(root, { ...c, items: L, back: () => setup(root, c) });
  };
  put(root,
    h('h1', '💬 משפטי שיחה'),
    h('p.muted', 'משפטים קצרים מהחיים ומהטקסטים לבגרות. אחרי כל תשובה שומעים את המשפט המלא בצרפתית (Jeanne). כל תשובה מעדכנת את מעקב הלמידה של המילה.'),
    h('div.card', h('div.field', h('span.lbl', 'סוג התרגול'), kinds)),
    h('div.card', { style: { marginTop: '12px' } }, h('div.field', h('span.lbl', 'מאילו משפטים?'), srcs), partBox,
      h('div.field', h('label', 'כמה משפטים?'), cnt), info),
    h('div', { style: { height: '14px' } }),
    h('button.btn.block.lg', { type: 'button', onclick: start }, '🚀 להתחיל'),
    h('p.small.muted.center', h('a.btn.ghost', { href: '#/quiz' }, '← חזרה לבחינת מילים')));
  sync();
}

/** sentence with a blank → DOM (LTR French), blank shown as a slot */
function withBlank(text, slot) {
  const [a, b] = text.split('___');
  return h('span', a, slot, b);
}

function run(root, cfg) {
  const { items } = cfg;
  let i = 0; const results = []; let busy = false, nextBtn = null, keyPick = null;
  const onKey = e => {
    if (e.target.closest('input,select,textarea')) return;
    if (e.key === 'Enter' && nextBtn && !nextBtn.hidden) { e.preventDefault(); goNext(); }
    else if (/^[1-4]$/.test(e.key) && keyPick) keyPick(+e.key - 1);
  };
  document.addEventListener('keydown', onKey);
  onLeave(() => { document.removeEventListener('keydown', onKey); stop(); });
  const goNext = () => { i++; i < items.length ? ask() : summary(); };

  function sayBtn(it) {
    const b = h('button.play.say-btn', { type: 'button', 'aria-label': '🔊 – השמעת המשפט המלא', title: 'המשפט המלא' }, '🔊');
    b.addEventListener('click', e => { e.stopPropagation(); playSentence(it, { btn: b }); });
    return b;
  }
  function targetRow(it) {
    return it.t.map(n => word(n)).filter(Boolean).map(w => h('div.s-target',
      h('div.grow', h('b.fr', w.fr), ' = ', h('span', w.he), emo(w, '.emo-sm')), playBtn(w, 'fr'), playBtn(w, 'he')));
  }
  function hintBtn(it) {
    const w = word(it.t[0]); const e = w && emo(w, '.emo-md'); if (!e) return null;
    const box = h('div.emo-hint'); const b = h('button.btn.sm.ghost', { type: 'button', 'aria-label': 'הצגת רמז ציורי' }, '🫣 רמז ציורי');
    b.onclick = () => put(box, e); return put(box, b);
  }

  function ask() {
    busy = false; keyPick = null; stop();
    const it = items[i]; const fb = h('div');
    nextBtn = h('button.btn.block.lg', { type: 'button', hidden: true, onclick: goNext, style: { marginTop: '12px' } }, i + 1 < items.length ? 'הבא ←' : 'לסיכום 🏁');
    const prompt = h('div.q-prompt.s-prompt');
    let body;
    const done = (ok, given) => {
      busy = true; keyPick = null;
      it.t.forEach(n => st.answer(n, ok)); refreshTop();
      results.push({ it, ok, given }); sfx(ok ? 'ok' : 'bad');
      const full = it.type === 'build' ? it.s : null;
      put(fb, h('div.feedback.' + (ok ? 'ok' : 'bad'), { role: 'status' },
        h('span', ok ? ['מצוין! 🎉', 'נכון! ✨', 'יפה מאוד! 💪', 'בדיוק! 👏'][Math.floor(Math.random() * 4)] : 'כמעט! התשובה הנכונה:'),
        full ? h('span.fb-word.fr', { dir: 'ltr' }, full) : null),
        h('div.card.s-after', h('div.row', h('div.s-he.grow', it.he), sayBtn(it)), ...targetRow(it)));
      nextBtn.hidden = false; nextBtn.focus({ preventScroll: true });
      requestAnimationFrame(() => nextBtn.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
      setTimeout(() => playSentence(it, { btn: fb.querySelector('.say-btn') }), 300);
    };
    const choiceBody = (slot) => {
      const opts = shuffle(it.opts);
      const btns = opts.map((o, k) => h('button.choice.fr-choice', { type: 'button', onclick: () => choose(k) }, o));
      function choose(k) {
        if (busy) return; const o = opts[k]; const ok = it.ans.some(a => norm(a) === norm(o));
        btns.forEach((b, j) => { b.disabled = true; if (it.ans.some(a => norm(a) === norm(opts[j]))) b.classList.add('correct'); });
        if (!ok) btns[k].classList.add('wrong');
        slot.textContent = it.ans[0]; slot.classList.add(ok ? 'ok' : 'bad');
        done(ok, ok ? '' : o);
      }
      keyPick = k => btns[k] && choose(k);
      return h('div.choices', btns);
    };
    if (it.type === 'fill') {
      const slot = h('span.s-slot', { role: 'group', 'aria-label': 'מילה חסרה' }, '\u00a0');
      put(prompt, h('div.q-type', '✏️ השלימי את המילה החסרה'), h('div.s-sent.fr', { dir: 'ltr' }, withBlank(it.s, slot)), hintBtn(it));
      body = choiceBody(slot);
    } else if (it.type === 'dialog') {
      const slot = h('span.s-slot', { role: 'group', 'aria-label': 'מילה חסרה' }, '\u00a0');
      const bubble = (ln, k) => h('div.s-bub.' + (k ? 'b' : 'a'), h('span.s-av', { 'aria-hidden': 'true' }, k ? '🧑' : '👧'),
        h('div.s-txt.fr', { dir: 'ltr' }, ln.fr.includes('___') ? withBlank(ln.fr, slot) : ln.fr));
      put(prompt, h('div.q-type', '💬 השלימי את השיחה'), h('div.s-chat', it.lines.map(bubble)), hintBtn(it));
      body = choiceBody(slot);
    } else {
      body = buildBody(it, done);
      put(prompt, h('div.q-type', '🧩 סדרי את המילים למשפט נכון'), h('div.s-he-q', it.he), hintBtn(it));
    }
    const score = results.filter(r => r.ok).length;
    put(root,
      h('div.row', h('div.grow', h('div.small.muted', `💬 משפטי שיחה · ${KINDS[cfg.kind][0]}`), h('b', `משפט ${i + 1} מתוך ${items.length}`)),
        h('span.pill', '✅ ', score), h('button.btn.sm.ghost', { type: 'button', onclick: () => results.length ? summary() : cfg.back() }, 'סיום')),
      h('div.progress-line', h('i', { style: { width: (i / items.length * 100) + '%' } })),
      prompt, body, fb, nextBtn);
  }

  function buildBody(it, done) {
    // tiles: tap to move between bank and line; or drag (pointer events) to place/reorder
    const tiles = shuffle(it.tiles.map((t, k) => ({ t, k })));
    if (tiles.map(x => x.t).join(' ') === it.tiles.join(' ') && tiles.length > 1) tiles.push(tiles.shift());   // never start solved
    const line = h('div.s-line.fr', { dir: 'ltr', role: 'group', 'aria-label': 'המשפט שלך' });
    const bank = h('div.s-bank.fr', { dir: 'ltr', role: 'group', 'aria-label': 'מילים לבחירה' });
    const checkBtn = h('button.btn.lg', { type: 'button', disabled: true }, 'בדיקה');
    const resetBtn = h('button.btn.sm.ghost', { type: 'button' }, '↺ להתחיל מחדש');
    const els = tiles.map(x => { const b = h('button.s-tile', { type: 'button', 'data-k': x.k }, x.t); b._t = x.t; return b; });
    els.forEach(b => bank.append(b));
    const sync = () => { checkBtn.disabled = busy || bank.children.length > 0; line.classList.toggle('empty', !line.children.length); };
    const moveTo = (b, box, before = null) => { box.insertBefore(b, before); sync(); };
    els.forEach(b => {
      let sx = 0, sy = 0, dragging = false, ghost = null, pid = null;
      b.addEventListener('pointerdown', e => { if (busy) return; sx = e.clientX; sy = e.clientY; dragging = false; pid = e.pointerId; });
      b.addEventListener('pointermove', e => {
        if (pid !== e.pointerId || busy) return;
        if (!dragging && Math.hypot(e.clientX - sx, e.clientY - sy) > 8) {
          dragging = true; b.setPointerCapture(pid); ghost = b.cloneNode(true); ghost.classList.add('s-ghost'); document.body.append(ghost); b.classList.add('s-drag');
        }
        if (dragging) { ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px'; e.preventDefault(); }
      });
      const end = e => {
        if (pid !== e.pointerId) return; pid = null;
        if (!dragging) return;
        ghost?.remove(); ghost = null; b.classList.remove('s-drag');
        const r = line.getBoundingClientRect(); const inLine = e.clientY >= r.top - 20 && e.clientY <= r.bottom + 20;
        if (inLine) { const before = [...line.children].find(c => c !== b && (() => { const cr = c.getBoundingClientRect(); return e.clientY < cr.bottom && e.clientX < cr.left + cr.width / 2; })()); moveTo(b, line, before || null); }
        else moveTo(b, bank);
        b._dragged = true; setTimeout(() => { b._dragged = false; }, 50);
      };
      b.addEventListener('pointerup', end); b.addEventListener('pointercancel', end);
      b.addEventListener('click', () => { if (busy || b._dragged) return; moveTo(b, b.parentElement === bank ? line : bank); });
    });
    resetBtn.onclick = () => { if (busy) return; els.forEach(b => bank.append(b)); sync(); };
    checkBtn.onclick = () => {
      if (busy || bank.children.length) return;
      const given = [...line.children].map(c => c._t).join(' ');
      const ok = it.ans.includes(norm(given));
      line.classList.add(ok ? 'ok' : 'bad'); [...line.children].forEach(c => c.disabled = true); [...bank.children].forEach(c => c.disabled = true);
      checkBtn.hidden = true; resetBtn.hidden = true;
      done(ok, ok ? '' : given);
    };
    sync();
    return h('div', line, h('div.small.muted.center', { style: { margin: '6px 0' } }, 'הקישי על מילה כדי להוסיף או להחזיר אותה · אפשר גם לגרור'), bank,
      h('div.row', { style: { marginTop: '10px', justifyContent: 'center' } }, checkBtn, resetBtn));
  }

  function summary() {
    stop(); keyPick = null; nextBtn = null;
    const ok = results.filter(r => r.ok).length, tot = results.length, pct = tot ? Math.round(ok / tot * 100) : 0;
    if (pct >= 80) { sfx('win'); confetti(); }
    const ring = h('div.score-ring', { html: ringSVG(150, 14, pct / 100) + `<div class="num">${pct}%</div>` });
    ring.querySelector('.fg').style.stroke = pct >= 80 ? 'var(--ok)' : pct >= 50 ? 'var(--warn)' : 'var(--bad)';
    ring.querySelector('.bg').style.stroke = 'var(--line)';
    const wrong = results.filter(r => !r.ok);
    const sent = it => it.type === 'build' ? it.s : it.type === 'fill' ? it.s.replace('___', it.ans[0]) : it.lines.map(l => l.fr.replace('___', it.ans[0])).join(' / ');
    put(root,
      h('h1', 'סיכום משפטי שיחה'),
      h('div.card.center', ring, h('h2', { style: { margin: '4px 0' } }, pct === 100 ? 'מושלם! 🏆' : pct >= 70 ? 'יפה מאוד! 🌟' : pct >= 50 ? 'בדרך הנכונה 🙂' : 'כדאי לנסות שוב 💜'),
        h('p.muted', `${ok} נכונים מתוך ${tot}`)),
      wrong.length ? h('div.card', { style: { marginTop: '12px' } }, h('h2.h3', `טעויות (${wrong.length}) – המילים נוספו לחזרות`),
        h('ul.list-plain', wrong.map(r => { return h('li', sayBtn(r.it),
          h('div.grow', h('div.fr', { dir: 'ltr' }, sent(r.it)), h('div.small', r.it.he),
            r.given ? h('div.small', { style: { color: 'var(--bad)' } }, 'ענית: ', h('span.fr', { dir: 'ltr' }, r.given)) : null)); }))) : null,
      h('div.row', { style: { marginTop: '14px' } },
        wrong.length ? h('button.btn.acc', { type: 'button', onclick: () => run(root, { ...cfg, items: shuffle(wrong.map(r => r.it)) }) }, '🔁 תרגול הטעויות') : null,
        h('button.btn', { type: 'button', onclick: () => run(root, { ...cfg, items: shuffle(items) }) }, 'שוב אותם משפטים'),
        h('button.btn.sec', { type: 'button', onclick: cfg.back }, 'תרגול חדש'),
        h('a.btn.ghost', { href: '#/stats' }, '📈 למעקב')));
  }
  ask();
}
