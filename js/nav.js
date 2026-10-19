// Navigation helpers shared by views (kept separate from app.js to avoid import cycles)
import { $, h, put } from './util.js';
import * as st from './store.js';
let cleanup = null;
export function go(hash) { location.hash = hash; }
/** register a function to run when leaving the current view */
export function onLeave(fn) { cleanup = fn; }
export function runCleanup() { if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; } }
export function refreshTop() {
  const s = st.streak(); const due = st.dueList().length;
  put($('#topStats'), 
    h('span.pill', { title: 'רצף ימי למידה' }, '🔥 ', s.days),
    h('a.pill', { href: '#/flash?src=due', title: 'חזרות להיום', style: { textDecoration: 'none', color: 'inherit' } }, '🔁 ', due));
}
