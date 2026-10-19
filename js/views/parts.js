import { h, toast, posCat, put } from '../util.js';
import { DB, partWords, audioUrl, hasAudio } from '../data.js';
import * as st from '../store.js';
import { wordRow, emptyState } from '../ui.js';
import { refreshTop } from '../nav.js';
import { deacc } from '../match.js';

export const AUDIO_CACHE = 'french-audio-v1';

export const partLabel = P => P.kind === 'bagrut' ? '📜 בגרות' : `רמה ${P.label}`;
function partCard(P) {
  const c = st.counts(partWords(P.id)); const pct = Math.round(c.mastered / c.total * 100);
  return h('a.part', { href: `#/part/${P.id}` },
    h('div.pn', `חלק ${P.id}`), pct ? h('span.pct', pct + '%') : null,
    h('div.pr', `מילים ${P.from}–${P.to} · ${partLabel(P)}`),
    h('div.bar', h('i.m', { style: { width: c.mastered / c.total * 100 + '%' } }), h('i.l', { style: { width: c.learning / c.total * 100 + '%' } })));
}

export function partsView() {
  const results = h('div.words');
  const groups = [['A1', 'רמה A1 · מתחילים'], ['A2', 'רמה A2 · בסיסי'], ['B1', 'רמה B1 · עצמאי'], ['bagrut', '📜 מילים מחומרי הבגרות (ספרות, דקדוק, תיאור תמונה)']];
  const range = L => L.length ? ` · חלקים ${L[0].id}–${L[L.length - 1].id}` : '';
  const texts = h('div.chips-row', Object.entries(DB.texts).map(([k, v]) => h('a.chip.text-chip', { href: `#/flash?src=text&t=${k}` }, '📜 ', v, ' · ', DB.words.filter(w => w.tx.includes(k)).length)));
  const grid = h('div', groups.map(([k, t]) => { const L = DB.parts.filter(P => (P.kind === 'bagrut' ? 'bagrut' : P.label) === k); return L.length ? [h('h2', t + range(L)), h('div.parts', L.map(partCard))] : null; }),
    h('h2', '📜 לפי טקסט לבגרות (כולל מילים שמופיעות גם ברמות)'), texts);
  const search = h('input.search', { type: 'search', placeholder: '🔍 חיפוש מילה בצרפתית או בעברית…', 'aria-label': 'חיפוש' });
  let t;
  search.addEventListener('input', () => {
    clearTimeout(t); t = setTimeout(() => {
      const q = search.value.trim().toLowerCase();
      if (!q) { put(results, ); grid.hidden = false; return; }
      const strip = s => s.replace(/[\u0591-\u05C7]/g, '');   // ignore niqqud when searching Hebrew
      const qs = strip(q);
      const dq = deacc(q);
      const hits = DB.words.filter(w => deacc(w.fr.toLowerCase()).includes(dq) || strip(w.he).includes(qs) || (w.m || '').toLowerCase().includes(q)).slice(0, 60);
      grid.hidden = true;
      put(results, ...(hits.length ? hits.map(w => { const r = wordRow(w); r.prepend(h('a.small.res-part', { href: `#/part/${w.p}` }, `חלק ${w.p}`)); return r; }) : [emptyState('🔎', 'לא נמצאו מילים', 'נסי לחפש אחרת')]));
    }, 150);
  });
  return h('div',
    h('h1', 'צפייה ושמיעה'),
    h('p.muted', `${DB.words.length} מילים ב-${DB.parts.length} חלקים (80–100 מילים בכל חלק), מהקל לקשה. אפשר גם לחפש מילה.`),
    search, h('div', { style: { height: '10px' } }), results, grid);
}

export function partView(m) {
  const p = Math.max(1, Math.min(DB.parts.length, +m[1])); const P = DB.parts[p - 1];
  st.setSettings({ lastPart: p });
  const words = partWords(p);
  let filter = 'all'; let hideHe = st.getSettings().hideHe;
  const list = h('div.words');
  const summary = h('div.small.muted');
  const draw = () => {
    const c = st.counts(words);
    summary.textContent = `${c.mastered} שלטת · ${c.learning} בלמידה · ${c.new} חדשות`;
    const L = words.filter(w => filter === 'all' || (filter === 'hard' ? st.isWeak(w.n) : st.status(w.n) === filter));
    put(list, ...(L.length ? L.map(w => wordRow(w, { hideHe, onChange: () => { summary.textContent = summaryText(); refreshTop(); } })) : [emptyState('✨', 'אין מילים בסינון הזה')]));
  };
  const summaryText = () => { const c = st.counts(words); return `${c.mastered} שלטת · ${c.learning} בלמידה · ${c.new} חדשות`; };
  const seg = h('div.seg', [['all', 'הכול'], ['new', 'חדשות'], ['learning', 'בלמידה'], ['mastered', 'שלטת'], ['hard', 'קשות']].map(([k, l]) =>
    h('button', { type: 'button', class: k === filter ? 'on' : '', onclick: e => { filter = k; [...seg.children].forEach(b => b.classList.toggle('on', b === e.currentTarget)); draw(); } }, l)));
  const hideToggle = h('input', { type: 'checkbox', checked: hideHe });
  hideToggle.onchange = () => { hideHe = hideToggle.checked; st.setSettings({ hideHe }); draw(); };
  const offBtn = h('button.btn.sm.ghost', { type: 'button' }, '⬇️ שמירה לשימוש בלי אינטרנט');
  offBtn.onclick = () => downloadPart(words, offBtn);
  checkCached(words).then(n => { if (n && n === words.reduce((s, w) => s + hasAudio(w, 'fr') + hasAudio(w, 'he'), 0)) offBtn.textContent = '✓ החלק זמין גם בלי אינטרנט'; });
  draw();
  return h('div',
    h('div.row', h('div.grow', h('h1', `חלק ${p}`), h('div.muted', `מילים ${P.from}–${P.to} · ${partLabel(P)} · ${P.count} מילים`), summary),
      h('div.row', p > 1 ? h('a.icon-btn', { href: `#/part/${p - 1}`, title: 'החלק הקודם', style: { textDecoration: 'none' } }, '→') : null,
        p < DB.parts.length ? h('a.icon-btn', { href: `#/part/${p + 1}`, title: 'החלק הבא', style: { textDecoration: 'none' } }, '←') : null)),
    h('div.actions', { style: { margin: '14px 0' } },
      h('a.action', { href: `#/flash?src=part&p=${p}` }, h('span.ai', '🃏'), h('b', 'כרטיסיות'), h('span', 'הפכי וענִי')),
      h('a.action', { href: `#/listen?src=part&p=${p}` }, h('span.ai', '🎧'), h('b', 'האזנה'), h('span', 'שמיעה והיזכרות')),
      h('a.action', { href: `#/quiz?src=part&p=${p}` }, h('span.ai', '✍️'), h('b', 'בחינה'), h('span', 'על החלק הזה')),
      h('a.action', { href: `#/flash?src=part&p=${p}&dir=he-fr` }, h('span.ai', '🔄'), h('b', 'עברית ← צרפתית'), h('span', 'כרטיסיות הפוכות'))),
    seg,
    h('label.switch', { style: { margin: '6px 0' } }, h('span', 'הסתרת התרגום (לחיצה על התרגום תחשוף אותו)'), hideToggle),
    list, h('div.center', { style: { marginTop: '14px' } }, offBtn));
}

async function checkCached(words) {
  if (!('caches' in window)) return 0;
  try { const c = await caches.open(AUDIO_CACHE); const keys = new Set((await c.keys()).map(r => new URL(r.url).pathname.split('/').slice(-3).join('/')));
    return words.reduce((s, w) => s + keys.has(audioUrl(w, 'fr')) + keys.has(audioUrl(w, 'he')), 0);
  } catch { return 0; }
}
async function downloadPart(words, btn) {
  if (!('caches' in window)) { toast('הדפדפן לא תומך בשמירה'); return; }
  btn.disabled = true; const urls = words.flatMap(w => ['fr', 'he'].filter(l => hasAudio(w, l)).map(l => audioUrl(w, l)));
  const c = await caches.open(AUDIO_CACHE); let done = 0, fail = 0;
  const q = urls.slice();
  const worker = async () => { while (q.length) { const u = q.shift(); try { if (!(await c.match(u))) { const r = await fetch(u); if (!r.ok) throw 0; await c.put(u, r); } } catch { fail++; } done++; btn.textContent = `שומרת… ${done}/${urls.length}`; } };
  await Promise.all([1, 2, 3, 4, 5, 6].map(worker));
  btn.disabled = false; btn.textContent = fail ? `נשמרו ${done - fail}, נכשלו ${fail} – נסי שוב` : '✓ החלק זמין גם בלי אינטרנט';
  toast(fail ? 'חלק מהקבצים לא נשמרו' : 'כל השמע של החלק נשמר במכשיר 🎉');
}
