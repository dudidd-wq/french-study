import { h, nWords } from '../util.js';
import { DB } from '../data.js';
import * as st from '../store.js';

function greeting() {
  const hr = new Date().getHours();
  return hr < 5 ? 'לילה טוב' : hr < 12 ? 'בוקר טוב' : hr < 17 ? 'צהריים טובים' : hr < 21 ? 'ערב טוב' : 'לילה טוב';
}
export function homeView() {
  const c = st.counts(); const due = st.dueList().length; const s = st.streak(); const weak = DB.words.filter(w => st.isWeak(w.n)).length;
  const set = st.getSettings(); const lp = DB.parts[(set.lastPart || 1) - 1];
  const pc = st.counts(DB.words.filter(w => w.p === lp.id));
  const tip = [
    'טיפ: אמרי את המילה בקול לפני שאת שומעת את התרגום – זה מחזק את הזיכרון.',
    'טיפ: 10 דקות כל יום עדיפות על שעה פעם בשבוע.',
    'טיפ: מצב ההאזנה עובד גם באוזניות בדרך לבית הספר 🎧',
    'טיפ: סמני ⭐ ליד מילים קשות, ואז תרגלי רק אותן בבחינה העצמית.',
    'טיפ: בשמות עצם למדי את המילה יחד עם le / la – כך זוכרים את המין.',
  ][new Date().getDate() % 5];
  return h('div.stack',
    h('section.hero',
      h('h1', `${greeting()}! 👋`),
      h('p', s.days ? `רצף של ${s.days === 1 ? 'יום אחד' : s.days + ' ימים'} ${s.today ? '– כל הכבוד! 🔥' : '– תרגלי היום כדי לשמור עליו 💪'}` : 'בואי נתחיל ללמוד מילים בצרפתית! 🇫🇷'),
      h('div.kpis',
        h('div.kpi', h('b', c.mastered), h('span', 'מילים שאת שולטת בהן')),
        h('div.kpi', h('b', c.learning), h('span', 'בלמידה')),
        h('div.kpi', h('b', c.new), h('span', 'עוד לא נלמדו')))),
    due ? h('a.card.row', { href: '#/flash?src=due', style: { textDecoration: 'none', color: 'inherit' } },
      h('span', { style: { fontSize: '2rem' } }, '🔁'),
      h('div.grow', h('b', due === 1 ? 'מילה אחת מחכה לחזרה היום' : `${due} מילים מחכות לחזרה היום`), h('div.small.muted', 'חזרה קצרה בכרטיסיות שומרת את המילים בזיכרון')),
      h('span.btn.sm', 'לחזרה'))
      : h('div.card.row', h('span', { style: { fontSize: '2rem' } }, '🎉'), h('div.grow', h('b', 'אין חזרות שמחכות היום'), h('div.small.muted', 'אפשר ללמוד חלק חדש או לעשות בחינה עצמית'))),
    h('div.card',
      h('div.row', h('div.grow', h('div.small.muted', 'להמשיך מאיפה שהפסקת'), h('h2.h3', { style: { margin: '2px 0' } }, `חלק ${lp.id} · מילים ${lp.from}–${lp.to}`)),
        h('b', { style: { color: 'var(--ok)' } }, Math.round(pc.mastered / pc.total * 100) + '%')),
      h('div.bar', { style: { margin: '8px 0 12px' } }, h('i.m', { style: { width: pc.mastered / pc.total * 100 + '%' } }), h('i.l', { style: { width: pc.learning / pc.total * 100 + '%' } })),
      h('div.row',
        h('a.btn.sm', { href: `#/part/${lp.id}` }, '📖 צפייה'),
        h('a.btn.sm.sec', { href: `#/flash?src=part&p=${lp.id}` }, '🃏 כרטיסיות'),
        h('a.btn.sm.sec', { href: `#/listen?src=part&p=${lp.id}` }, '🎧 האזנה'),
        h('a.btn.sm.sec', { href: `#/quiz?src=part&p=${lp.id}` }, '✍️ בחינה'))),
    h('div.actions',
      h('a.action', { href: '#/parts' }, h('span.ai', '📚'), h('b', 'צפייה ושמיעה'), h('span', `${DB.parts.length} חלקים, כרטיסי מילים`)),
      h('a.action', { href: '#/listen' }, h('span.ai', '🎧'), h('b', 'מצב האזנה'), h('span', 'צרפתית ← הפסקה ← עברית, גם עם מסך כבוי')),
      h('a.action', { href: '#/quiz' }, h('span.ai', '✍️'), h('b', 'בחינה עצמית'), h('span', 'אמריקאית, שמיעה, הקלדה')),
      h('a.action', { href: weak ? '#/quiz?src=weak' : '#/stats' }, h('span.ai', '⭐'), h('b', 'מילים קשות'), h('span', weak ? `${nWords(weak)} לתרגול` : 'עוד אין – מעולה!'))),
    h('a.card.row.bagrut-card', { href: '#/parts', style: { textDecoration: 'none', color: 'inherit' } },
      h('span', { style: { fontSize: '2rem' } }, '📜'), h('div.grow', h('b', 'מילים לבגרות תשפ"ו'), h('div.small.muted', 'Le Petit Prince · Le Lion et le Rat · Le mot (Hugo) · Rhinocéros')), h('span.btn.sm', 'לטקסטים')),
    h('p.small.muted.center', tip));
}
