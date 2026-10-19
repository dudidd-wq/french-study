import { $, $$, h, toast, put } from './util.js';
import { loadData } from './data.js';
import * as st from './store.js';
import { stop } from './audio.js';
import { go, runCleanup, refreshTop } from './nav.js';
import { homeView } from './views/home.js';
import { partsView, partView } from './views/parts.js';
import { flashView } from './views/flash.js';
import { listenView } from './views/listen.js';
import { quizView } from './views/quiz.js';
import { statsView } from './views/stats.js';
import { sentView } from './views/sent.js';

const routes = [
  [/^\/?$/, homeView, 'home'],
  [/^\/parts$/, partsView, 'parts'],
  [/^\/part\/(\d+)$/, partView, 'parts'],
  [/^\/flash$/, flashView, 'parts'],
  [/^\/listen$/, listenView, 'listen'],
  [/^\/quiz$/, quizView, 'quiz'],
  [/^\/sentences$/, sentView, 'quiz'],
  [/^\/stats$/, statsView, 'stats'],
];


async function render() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  const q = new URLSearchParams(qs || '');
  runCleanup();
  stop();
  const view = $('#view');
  let match = null, fn = homeView, tab = 'home';
  for (const [re, f, t] of routes) { const m = path.match(re); if (m) { match = m; fn = f; tab = t; break; } }
  $$('.tabbar a').forEach(a => a.classList.toggle('active', a.dataset.tab === tab));
  $$('.tabbar a').forEach(a => a.setAttribute('aria-current', a.dataset.tab === tab ? 'page' : 'false'));
  $('#backBtn').hidden = !['part', 'flash'].some(p => path.startsWith('/' + p)) && !(q.get('run'));
  const el = await fn(match || [], q);
  put(view, el);
  window.scrollTo(0, 0);
  refreshTop();
}

async function start() {
  $('#backBtn').onclick = () => history.length > 1 ? history.back() : go('#/');
  try { await loadData(); }
  catch (e) { put($('#view'), h('div.empty', h('div.ei', '😕'), h('h3', 'לא הצלחתי לטעון את רשימת המילים'), h('p.small', String(e)))); return; }
  window.addEventListener('hashchange', render);
  await render();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw?.addEventListener('statechange', () => { if (nw.state === 'installed' && navigator.serviceWorker.controller) toast('יש גרסה חדשה – היא תיטען בפעם הבאה שתפתחי את האפליקציה', 4000); });
      });
    }).catch(err => console.warn('SW failed', err));
  }
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
}
start();
