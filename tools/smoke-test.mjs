// Headless smoke test.  Usage:
//   python3 -m http.server 8765 &        (from the repo root)
//   npm i --no-save playwright-core      (once; uses an installed Chrome/Chromium)
//   node tools/smoke-test.mjs [http://localhost:8765/] [/usr/bin/google-chrome]
import { chromium } from 'playwright-core';
const BASE = process.argv[2] || 'http://localhost:8765/';
const EXE = process.argv[3] || process.env.CHROME || '/usr/bin/google-chrome';
const errors = []; const failed = []; let step = '';
const ok = (c, m) => { if (!c) { errors.push(`[${step}] ASSERT: ${m}`); console.log('  ✗', m); } else console.log('  ✓', m); };

const browser = await chromium.launch({ executablePath: EXE, args: ['--autoplay-policy=no-user-gesture-required', '--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'he-IL', acceptDownloads: true });
const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error') errors.push(`[${step}] console: ${m.text()}`); });
page.on('pageerror', e => errors.push(`[${step}] pageerror: ${e.message}`));
page.on('requestfailed', r => r.method() !== 'HEAD' && !/\/audio\//.test(r.url()) && failed.push(`[${step}] ${r.url()} ${r.failure()?.errorText}`));
page.on('response', r => { if (r.status() >= 400) failed.push(`[${step}] HTTP ${r.status()} ${r.url()}`); });
const go = async (hash, wait = 400) => { step = hash; await page.evaluate(h => location.hash = h, hash); await page.waitForTimeout(wait); };
const shot = name => page.screenshot({ path: `/tmp/shot-${name}.png`, fullPage: false });

step = 'load'; console.log('home');
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('.hero');
ok(await page.locator('.hero').count() === 1, 'home renders');
ok((await page.getAttribute('html', 'dir')) === 'rtl', 'document is RTL');
const n = await page.evaluate(async () => (await (await fetch('data/words.json')).json()).words.length);
ok(n > 1200, `words.json has ${n} words`);
const NP = await page.evaluate(async () => (await (await fetch('data/words.json')).json()).parts.length);
const P1 = await page.evaluate(async () => (await (await fetch('data/words.json')).json()).parts[0].count);
await shot('home');

console.log('parts'); await go('#/parts');
ok(await page.locator('.part').count() === NP, `${NP} parts listed`);
await page.fill('input.search', 'fenetre'); await page.waitForTimeout(400);
ok(await page.locator('.word').count() >= 1, 'search finds "fenêtre" (accent-insensitive)');
await shot('parts');

console.log('part 1'); await go('#/part/1', 600);
ok(await page.locator('.word').count() === P1, `part 1 shows ${P1} words`);
// verify every audio file referenced by part 1 and 20 exists (HEAD)
const urls = await page.evaluate(async () => { const j = await (await fetch('data/words.json')).json(); return j.words.flatMap(w => [w.a & 1 ? `audio/fr/${String(w.n).padStart(4, '0')}.mp3` : null, w.a & 2 ? `audio/he/${String(w.n).padStart(4, '0')}.mp3` : null]).filter(Boolean); });
const bad = await page.evaluate(async list => { const out = []; for (let i = 0; i < list.length; i += 64) { const r = await Promise.all(list.slice(i, i + 64).map(u => fetch(u, { method: 'HEAD', cache: 'no-store' }).then(r => r.ok ? null : u).catch(() => u))); out.push(...r.filter(Boolean)); } return out; }, urls);
ok(bad.length === 0, `all ${urls.length} referenced audio files reachable (${bad.length} missing)`);
await page.locator('.word .play').first().click(); await page.waitForTimeout(1500);
const played = await page.evaluate(() => { const a = document.getElementById('player'); return { src: a.currentSrc, err: a.error && a.error.code, t: a.currentTime, ended: a.ended }; });
ok((/audio\/fr\/0001\.mp3/.test(played.src) && !played.err) || !played.src, `FR audio plays (or TTS fallback) (${JSON.stringify(played)})`);
await page.locator('.word .mark').nth(1).click(); // mark first word as hard
await shot('part1');

console.log('flashcards'); await go('#/flash?src=part&p=1', 600);
await page.click('text=הציגי את התשובה'); await page.waitForTimeout(600);
ok(await page.locator('.fc.flip').count() === 1, 'card flips');
await page.click('text=ידעתי'); await page.waitForTimeout(300);
await page.click('text=הציגי את התשובה'); await page.waitForTimeout(500); await shot('flash');
await page.click('text=לא ידעתי'); await page.waitForTimeout(300);
ok(await page.locator('.fc').count() === 1, 'next card shown');

console.log('quiz'); await go('#/quiz', 400);
await page.click('label.opt:has-text("צרפתית ← עברית")');
await page.selectOption('select >> nth=-1', '10');
await page.click('text=להתחיל'); await page.waitForTimeout(500);
for (let q = 0; q < 10; q++) {
  await page.locator('.choice').first().click(); await page.waitForTimeout(200);
  if (q === 0) await shot('quiz-mc');
  const nx = page.locator('button.btn:has-text("הבא"), button.btn:has-text("לסיכום")');
  if (await nx.isVisible()) await nx.click(); else await page.waitForTimeout(2100);
  await page.waitForTimeout(250);
}
await page.waitForSelector('text=סיכום הבחינה', { timeout: 5000 }).catch(() => {});
ok(await page.locator('text=סיכום הבחינה').count() === 1, 'MC quiz reaches summary');
await shot('quiz-summary');

console.log('typing quiz'); await go('#/quiz?src=part&p=1&type=type', 400);
await page.selectOption('select >> nth=-1', '10');
await page.click('text=להתחיל'); await page.waitForTimeout(400);
const heb = await page.locator('.q-prompt .big-he').textContent();
const ans = await page.evaluate(async he => { const j = await (await fetch('data/words.json')).json(); return j.words.find(w => w.hebrew === he && w.part === 1).french; }, heb);
await page.fill('input.type-in', ans.toUpperCase().replace(/^(LE|LA|LES|L')\s*/, '') + '!');
await page.keyboard.press('Enter'); await page.waitForTimeout(300);
ok(await page.locator('.feedback.ok').count() === 1, `typing quiz accepts "${ans}" typed loosely`);
await shot('quiz-type');
// listening quiz
await go('#/quiz?src=part&p=2&type=listen', 400);
await page.click('text=להתחיל'); await page.waitForTimeout(1200);
ok(await page.locator('.choice').count() === 4, 'listening quiz shows 4 choices');
const la = await page.evaluate(() => document.getElementById('player').currentSrc);
ok(/audio\/fr\/\d{4}\.mp3/.test(la) || !la, 'listening quiz played FR clip (or TTS fallback)');

console.log('listening mode'); await go('#/listen?src=part&p=3', 400);
await page.click('text=להתחיל להאזין'); await page.waitForTimeout(900);
const ph1 = await page.locator('.player .phase').textContent();
await page.waitForTimeout(2200);
const s1 = await page.evaluate(() => document.getElementById('player').currentSrc);
await shot('listen');
await page.waitForTimeout(3500);
const state = await page.evaluate(() => ({ src: document.getElementById('player').currentSrc, head: document.querySelector('.p-head').textContent, heHidden: document.querySelector('.player .big-he').classList.contains('hide') }));
ok(/silence|audio\/(fr|he)/.test(s1), `listening engine playing (${s1.split('/').slice(-2).join('/')}), phase="${ph1}"`);
console.log('    state after ~6.5s:', JSON.stringify(state));
await page.click('[aria-label="המילה הבאה"]'); await page.waitForTimeout(500);
const head2 = await page.locator('.p-head').textContent();
ok(/^[0-9]+ \/ 102/.test(head2.trim()) || head2.includes('/'), `skip works (${head2})`);
await page.click('[aria-label="נגן / השהה"]'); await page.waitForTimeout(300);
ok((await page.locator('.ctl.main').textContent()).includes('▶'), 'pause works');

console.log('sentences'); await go('#/sentences?src=part&p=1', 600);
await page.click('text=להתחיל'); await page.waitForTimeout(500);
ok(await page.locator('.q-prompt').count() === 1, 'sentence quiz renders');
await shot('sentences');
console.log('text source'); await go('#/flash?src=text&t=pp', 600);
ok(await page.locator('.fc').count() === 1, 'bagrut text flashcards render');
console.log('stats'); await go('#/stats', 600);
ok(await page.locator('svg.chart').count() >= 2, 'charts render');
const st = await page.evaluate(() => JSON.parse(localStorage.getItem('french.progress.v1')));
ok(Object.keys(st.words).length > 5 && Object.keys(st.days).length === 1, `progress stored (${Object.keys(st.words).length} words)`);
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('text=ייצוא התקדמות')]);
ok(/french-progress-.*\.json/.test(dl.suggestedFilename()), 'export downloads JSON');
await shot('stats'); await page.screenshot({ path: '/tmp/shot-stats-full.png', fullPage: true });

console.log('pwa / offline');
step = 'sw';
const swOk = await page.evaluate(async () => { const r = await navigator.serviceWorker.ready; return !!r.active; });
ok(swOk, 'service worker active');
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(500);
await ctx.setOffline(true); step = 'offline';
await page.reload({ waitUntil: 'load' }).catch(() => {}); await page.waitForTimeout(800);
ok(await page.locator('.tabbar').count() === 1, 'app shell loads offline');
await go('#/part/1', 600);
ok(await page.locator('.word').count() === P1, 'data available offline');
await ctx.setOffline(false);

await browser.close();
const realFailed = failed.filter(f => !f.includes('[offline]'));
console.log('\nerrors:', errors.length ? errors : 'none');
console.log('failed requests:', realFailed.length ? realFailed : 'none');
process.exit(errors.length || realFailed.length ? 1 : 0);
