// Small DOM + misc helpers
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/** h('div.cls#id', {attrs/on*}, ...children) */
export function h(tag, attrs, ...kids) {
  const m = tag.match(/^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i);
  const el = document.createElement(m[1] || 'div');
  (m[2].match(/[.#][\w-]+/g) || []).forEach(t => t[0] === '.' ? el.classList.add(t.slice(1)) : (el.id = t.slice(1)));
  if (attrs != null && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k in el && k !== 'list' && k !== 'form' && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  const add = k => { if (k == null || k === false) return; if (Array.isArray(k)) k.forEach(add); else el.append(k instanceof Node ? k : document.createTextNode(String(k))); };
  kids.forEach(add);
  return el;
}

/** append children, skipping null/false */
export function add(el, ...kids) { el.append(...kids.filter(k => k != null && k !== false)); return el; }

/** replace children, skipping null/false and flattening arrays */
export function put(el, ...kids) { el.replaceChildren(...kids.flat(9).filter(k => k != null && k !== false)); return el; }

export function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// Local-date helpers (day numbers are days since epoch in the device's local time zone)
export function dayNum(d = new Date()) { return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000); }
export function dayKey(n = dayNum()) { const d = new Date(n * 86400000); return d.toISOString().slice(0, 10); }
export function fmtDay(n) { const d = new Date(n * 86400000); return `${d.getUTCDate()}.${d.getUTCMonth() + 1}`; }

export function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export function sample(a, k) { return shuffle(a).slice(0, k); }
/** Hebrew count of words with correct singular: 1 → 'מילה אחת' */
export const nWords = n => n === 1 ? 'מילה אחת' : `${n} מילים`;
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

let toastT;
export function toast(msg, ms = 2200) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms);
}

export function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = h('div.confetti'); const cols = ['#1d4ed8', '#ffffff', '#e11d48', '#fcd34d', '#16a36a'];
  for (let i = 0; i < 60; i++) box.append(h('i', { style: { left: Math.random() * 100 + '%', background: cols[i % 5], animationDelay: Math.random() * .6 + 's', animationDuration: 1.6 + Math.random() * 1.4 + 's' } }));
  document.body.append(box); setTimeout(() => box.remove(), 3500);
}

// Parts of speech
const POS_HE = { n: 'שם עצם', v: 'פועל', adj: 'שם תואר', adv: 'תואר הפועל', prep: 'מילת יחס', pron: 'כינוי', conj: 'מילת חיבור',
  det: 'מילה מגדירה', num: 'מספר', int: 'מילת קריאה', phr: 'ביטוי' };
export function posTokens(pos) { return (pos || '').split(',').map(s => s.trim()).filter(Boolean); }
export function posHe(pos) { const t = posTokens(pos); return t.length ? t.map(x => POS_HE[x] || x).join(' / ') : 'ביטוי'; }
/** short French-grammar meta line: gender (nouns) · CEFR level · bagrut badge */
export function wMeta(w) {
  const g = w.pos === 'n' ? ({ m: 'm. · זכר', f: 'f. · נקבה', a: 'm./f.' }[w.g] || '') : '';
  return [g, w.src === 'bagrut' ? '📜 בגרות' : w.lv, w.src === 'both' ? '📜' : ''].filter(Boolean).join(' · ');
}
export function posCat(pos) { const t = posTokens(pos)[0] || ''; return t === 'n' ? 'noun' : t === 'v' ? 'verb' : t === 'adj' ? 'adj' : 'other'; }

export function download(name, text, type = 'application/json') {
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

export function ringSVG(size, stroke, frac, cls = '') {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="${cls}"><circle class="bg" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"/>` +
    `<circle class="fg" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - frac)}"/></svg>`;
}
