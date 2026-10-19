import { h, toast, download, dayNum, dayKey, fmtDay } from '../util.js';
import { DB, partWords } from '../data.js';
import * as st from '../store.js';
import { refreshTop } from '../nav.js';
import { playBtn } from '../ui.js';

const NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}, ...kids) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); kids.forEach(k => e.append(typeof k === 'string' ? document.createTextNode(k) : k)); return e; };

function donut(c) {
  const R = 52, C = 2 * Math.PI * R; const tot = c.total || 1; let off = 0;
  const g = svg('svg', { viewBox: '0 0 140 140', width: 140, height: 140, role: 'img', 'aria-label': 'התפלגות מילים' });
  g.append(svg('circle', { cx: 70, cy: 70, r: R, fill: 'none', stroke: 'var(--line)', 'stroke-width': 18 }));
  for (const [k, col] of [['mastered', 'var(--ok)'], ['learning', 'var(--warn)']]) {
    const len = c[k] / tot * C;
    if (len > 0) g.append(svg('circle', { cx: 70, cy: 70, r: R, fill: 'none', stroke: col, 'stroke-width': 18, 'stroke-dasharray': `${len} ${C - len}`, 'stroke-dashoffset': -off, transform: 'rotate(-90 70 70)' }));
    off += len;
  }
  g.append(svg('text', { x: 70, y: 68, 'text-anchor': 'middle', style: 'font-size:22px;font-weight:800;fill:var(--ink)' }, Math.round(c.mastered / tot * 100) + '%'));
  g.append(svg('text', { x: 70, y: 88, 'text-anchor': 'middle', style: 'font-size:11px' }, 'שליטה'));
  return g;
}

function accuracyChart(daysBack = 30) {
  // RTL time axis (time flows right→left): oldest day on the right, today on the left.
  const D = st.days(); const t = dayNum(); const W = 340, H = 170, pr = 30, pl = 8, pt = 12, pb = 24;
  const pts = []; let maxA = 1;
  for (let i = daysBack - 1; i >= 0; i--) { const n = t - i; const d = D[dayKey(n)] || {}; pts.push({ n, a: d.a || 0, c: d.c || 0 }); maxA = Math.max(maxA, d.a || 0); }
  const g = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': 'דיוק לאורך זמן' });
  const iw = W - pl - pr, ih = H - pt - pb, bw = iw / pts.length;
  const X = i => W - pr - (i + 1) * bw;          // left edge of slot i (i=0 oldest, at the right)
  for (const y of [0, 50, 100]) { const yy = pt + ih * (1 - y / 100); g.append(svg('line', { x1: pl, x2: W - pr, y1: yy, y2: yy, stroke: 'var(--line)', 'stroke-dasharray': '3 3' }), svg('text', { x: W - pr + 4, y: yy + 4, 'text-anchor': 'start' }, y + '%')); }
  pts.forEach((p, i) => { const bh = p.a / maxA * ih * .9; if (p.a) g.append(svg('rect', { x: X(i) + 1.5, y: pt + ih - bh, width: Math.max(1, bw - 3), height: bh, rx: 2, fill: 'color-mix(in srgb, var(--pri) 22%, transparent)' }, svg('title', {}, `${fmtDay(p.n)}: ${p.a} תשובות, ${Math.round(p.c / p.a * 100)}% נכון`))); });
  const line = pts.map((p, i) => p.a ? [X(i) + bw / 2, pt + ih * (1 - p.c / p.a)] : null).filter(Boolean);
  if (line.length > 1) g.append(svg('polyline', { points: line.map(p => p.join(',')).join(' '), fill: 'none', stroke: 'var(--pri)', 'stroke-width': 2.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
  line.forEach(([x, y]) => g.append(svg('circle', { cx: x, cy: y, r: 3.5, fill: 'var(--card)', stroke: 'var(--pri)', 'stroke-width': 2 })));
  [0, Math.floor(pts.length / 2), pts.length - 1].forEach(i => g.append(svg('text', { x: X(i) + bw / 2, y: H - 6, 'text-anchor': 'middle' }, i === pts.length - 1 ? 'היום' : fmtDay(pts[i].n))));
  if (!line.length) g.append(svg('text', { x: W / 2, y: H / 2, 'text-anchor': 'middle', style: 'font-size:13px' }, 'עוד אין תשובות – עשי בחינה ראשונה ✍️'));
  return g;
}

function upcomingChart() {
  const t = dayNum(); const W = 340, H = 120, pb = 22, pt = 14; const bins = Array(7).fill(0);
  for (const w of DB.words) { const r = st.rec(w.n); if (!r || r.d == null || r.k) continue; const k = Math.max(0, r.d - t); if (k < 7) bins[k]++; }
  const max = Math.max(1, ...bins); const g = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': 'חזרות בשבוע הקרוב' });
  const bw = W / 7; const names = ['היום', 'מחר'];
  bins.forEach((v, i) => {
    const x = W - (i + 1) * bw;   // RTL: today on the right
    const bh = v / max * (H - pb - pt);
    g.append(svg('rect', { x: x + 6, y: H - pb - bh, width: bw - 12, height: Math.max(bh, 1), rx: 5, fill: i === 0 ? 'var(--acc)' : 'var(--pri2)' }));
    g.append(svg('text', { x: x + bw / 2, y: H - pb - bh - 3, 'text-anchor': 'middle', style: 'font-weight:700;fill:var(--ink)' }, String(v)));
    g.append(svg('text', { x: x + bw / 2, y: H - 6, 'text-anchor': 'middle' }, names[i] || fmtDay(t + i)));
  });
  return g;
}

function calendar() {
  const D = st.days(); const t = dayNum(); const weeks = 10; const box = h('div.cal', { 'aria-label': 'ימי פעילות' });
  // align so the last column ends today (rows = weeks, Sun..Sat)
  const dow = new Date(t * 86400000).getUTCDay(); const start = t - dow - (weeks - 1) * 7;
  for (let n = start; n < start + weeks * 7; n++) {
    const d = D[dayKey(n)]; const v = d ? (d.a || 0) + (d.v || 0) : 0;
    const lvl = n > t ? '' : v === 0 ? '' : v < 15 ? 'l1' : v < 50 ? 'l2' : 'l3';
    box.append(h('i', { class: [lvl, n === t ? 'today' : ''].join(' ').trim(), title: `${dayKey(n)}: ${v}`, style: n > t ? { opacity: .25 } : null }));
  }
  return box;
}

export function statsView() {
  const c = st.counts(); const s = st.streak(); const best = st.bestStreak(); const tot = st.totals();
  const due = st.dueList(); const weak = DB.words.filter(w => st.isWeak(w.n));
  const fileIn = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
  fileIn.onchange = async () => {
    const f = fileIn.files[0]; if (!f) return;
    try { st.importJSON(await f.text()); toast('ההתקדמות יובאה בהצלחה ✅'); refreshTop(); location.hash = '#/stats?r=' + Date.now(); }
    catch (e) { toast('הקובץ לא תקין 😕'); }
  };
  const doExport = () => download(`french-progress-${dayKey()}.json`, st.exportJSON());
  const doReset = () => {
    if (!confirm('למחוק את כל ההתקדמות? אי אפשר לבטל את זה.\nמומלץ לייצא גיבוי קודם.')) return;
    if (!confirm('בטוח? כל הנתונים יימחקו.')) return;
    st.resetAll(); toast('ההתקדמות אופסה'); refreshTop(); location.hash = '#/stats?r=' + Date.now();
  };
  return h('div.stack',
    h('h1', '📈 מעקב למידה'),
    h('div.card', h('div.donut-wrap', donut(c),
      h('div', h('div.legend', { style: { flexDirection: 'column', gap: '6px', fontSize: '.95rem' } },
        h('span', h('i', { style: { background: 'var(--ok)' } }), `שלטת: `, h('b', c.mastered)),
        h('span', h('i', { style: { background: 'var(--warn)' } }), `בלמידה: `, h('b', c.learning)),
        h('span', h('i', { style: { background: 'var(--line)' } }), `חדשות: `, h('b', c.new)))))),
    h('div.kpis',
      h('div.kpi', h('b', '🔥 ' + s.days), h('span', 'ימים ברצף')),
      h('div.kpi', h('b', best), h('span', 'השיא שלך')),
      h('div.kpi', h('b', tot.a ? Math.round(tot.c / tot.a * 100) + '%' : '–'), h('span', `דיוק (${tot.a} תשובות)`))),
    h('div.card',
      h('div.row', h('h2.h3.grow', { style: { margin: 0 } }, `🔁 חזרות להיום: ${due.length}`),
        due.length ? h('a.btn.sm', { href: '#/flash?src=due' }, 'כרטיסיות') : null, due.length ? h('a.btn.sm.sec', { href: '#/quiz?src=due' }, 'בחינה') : null),
      due.length ? h('ul.list-plain', { style: { marginTop: '8px' } }, due.slice(0, 8).map(w => h('li', playBtn(w, 'fr'), h('div.grow', h('b.fr', w.fr), h('div.small.muted', w.he)), h('span.small.muted', `תיבה ${st.rec(w.n).b}`))),
        due.length > 8 ? h('li.small.muted', `ועוד ${due.length - 8}…`) : null) : h('p.muted.small', 'אין חזרות שמחכות. מילים שתלמדי יופיעו כאן בזמן המתאים לחזרה.'),
      h('h2.h3', 'חזרות בשבוע הקרוב'), upcomingChart()),
    h('div.card', h('h2.h3', { style: { marginTop: 0 } }, 'דיוק ב-30 הימים האחרונים'), accuracyChart(),
      h('div.legend', h('span', h('i', { style: { background: 'var(--pri)' } }), 'אחוז תשובות נכונות'), h('span', h('i', { style: { background: 'color-mix(in srgb, var(--pri) 22%, transparent)' } }), 'כמות תשובות'))),
    h('div.card', h('h2.h3', { style: { marginTop: 0 } }, 'ימי פעילות'), calendar(), h('p.small.muted', 'כל ריבוע הוא יום. ירוק כהה יותר = יותר תרגול.')),
    h('div.card', h('h2.h3', { style: { marginTop: 0 } }, 'התקדמות לפי חלקים'),
      h('div.part-rows', DB.parts.map(P => { const pc = st.counts(partWords(P.id)); return h('a.part-row', { href: `#/part/${P.id}` }, h('span', `חלק ${P.id}`), h('div.bar', h('i.m', { style: { width: pc.mastered / pc.total * 100 + '%' } }), h('i.l', { style: { width: pc.learning / pc.total * 100 + '%' } })), h('b.small', Math.round(pc.mastered / pc.total * 100) + '%')); })),
      h('div.legend', h('span', h('i', { style: { background: 'var(--ok)' } }), 'שלטת'), h('span', h('i', { style: { background: 'var(--warn)' } }), 'בלמידה'), h('span', h('i', { style: { background: 'var(--line)' } }), 'חדשות'))),
    h('div.card', h('div.row', h('h2.h3.grow', { style: { margin: 0 } }, `⭐ מילים קשות: ${weak.length}`), weak.length ? h('a.btn.sm', { href: '#/quiz?src=weak' }, 'לתרגל') : null),
      weak.length ? h('ul.list-plain', weak.slice(0, 10).map(w => h('li', playBtn(w, 'fr'), h('div.grow', h('b.fr', w.fr), h('div.small.muted', w.he))))) : h('p.small.muted', 'מילים שטעית בהן או סימנת ⭐ יופיעו כאן.')),
    h('details.card', h('summary', { style: { fontWeight: 600, cursor: 'pointer' } }, 'ℹ️ איך עובד המעקב?'),
      h('p.small', 'כל מילה נמצאת ב"תיבה" (שיטת לייטנר). תשובה נכונה מקדמת אותה לתיבה הבאה ומרחיקה את החזרה הבאה: 1, 2, 4, 8, 16 ו-32 ימים. טעות מחזירה אותה לתיבה 1 – והיא תופיע שוב היום. מילה בתיבה 4 ומעלה (או שסימנת ✅) נחשבת "שלטת". קידום אפשרי פעם אחת ביום לכל מילה, כדי ששינון אינטנסיבי לא "יעבוד" על המעקב.'),
      h('p.small', 'הנתונים נשמרים רק במכשיר הזה (localStorage). כדי לעבור למכשיר אחר – ייצאי קובץ וייבאי אותו שם.')),
    h('div.card', h('h2.h3', { style: { marginTop: 0 } }, '💾 גיבוי ונתונים'),
      h('div.row', h('button.btn.sec', { type: 'button', onclick: doExport }, '⬇️ ייצוא התקדמות'), h('button.btn.sec', { type: 'button', onclick: () => fileIn.click() }, '⬆️ ייבוא מקובץ'), fileIn,
        h('button.btn.ghost', { type: 'button', onclick: doReset, style: { color: 'var(--bad)' } }, '🗑️ איפוס'))),
    settingsCard());
}

function settingsCard() {
  const set = st.getSettings();
  const sw = (key, label) => { const inp = h('input', { type: 'checkbox', checked: !!set[key] }); inp.onchange = () => st.setSettings({ [key]: inp.checked }); return h('label.switch', h('span', label), inp); };
  return h('div.card', h('h2.h3', { style: { marginTop: 0 } }, '⚙️ הגדרות'),
    sw('sfx', 'צלילי משוב בבחינה'), sw('autoplayCards', 'השמעה אוטומטית בכרטיסיות'), sw('emoji', 'רמזי אימוג׳י (ציור קטן שעוזר להיזכר)'),
    h('p.small.muted', { style: { marginTop: '10px' } }, 'הקולות: Jeanne (צרפתית) ו-Tomer (עברית), ElevenLabs. הרשימה: אוצר מילים A1–B1 ומילים מחומרי הבגרות בצרפתית תשפ״ו (משרד החינוך).'));
}
