// Loads data/words.json and exposes lookups.
// words.json uses descriptive field names (french, hebrew, gender, …); the app works with short aliases.
export const DB = { words: [], parts: [], byN: new Map(), texts: {} };

export async function loadData() {
  const res = await fetch('data/words.json');
  if (!res.ok) throw new Error('words.json ' + res.status);
  const j = await res.json();
  DB.words = j.words.map(o => ({
    n: o.n, p: o.part, fr: o.french, he: o.hebrew, m: o.hint || '', pos: o.pos, g: o.gender,
    lv: o.cefr, src: o.source, tx: o.texts || [], a: o.a || 0, e: o.e || '', key: o.key || '',
  }));
  DB.parts = j.parts; DB.texts = j.texts || {};
  DB.byN = new Map(DB.words.map(w => [w.n, w]));
  return DB;
}
export const word = n => DB.byN.get(n);
export const partWords = p => DB.words.filter(w => w.p === p);
export const rangeWords = (a, b) => DB.words.filter(w => w.n >= a && w.n <= b);
export const textWords = t => DB.words.filter(w => w.tx.includes(t));
export const audioUrl = (w, lang) => `audio/${lang}/${String(w.n).padStart(4, '0')}.mp3`;
export const hasAudio = (w, lang) => !!(w.a & (lang === 'fr' ? 1 : 2));
