// Tolerant matching for the French typing quiz.
// - ignores case, punctuation, extra spaces, "…" and curly apostrophes; œ = oe
// - the article is optional ("livre" = "le livre"); a WRONG article is accepted with a note ('article')
// - any alternative of "ami, amie" / "ce, cette, ces" / "a / b" is accepted
// - missing or wrong accents are accepted with a note ('accent')
// - one typo in a long word ('typo'), unless the typed text is another word from the list
// - a DIFFERENT French word that differs only by an accent (ou/où, a/à, la/là, sur/sûr…) is wrong, not an "accent" slip
const ARTS = /^(le|la|les|l'|un|une|des)\s+/;

export function norm(s) {
  return String(s).toLowerCase().normalize('NFC')
    .replace(/[\u2019\u2018`´]/g, "'").replace(/œ/g, 'oe').replace(/æ/g, 'ae')
    .replace(/\u2026|\.{2,}/g, ' ')
    .replace(/[^a-z0-9à-ÿ'\s-]/g, ' ')
    .replace(/-/g, ' ').replace(/'\s*/g, "' ")
    .replace(/\s+/g, ' ').trim();
}
// real French words that are accent-only twins of other words (not all are list entries)
// (small grammar words only: for nouns such as "foret"/"forêt" a missing accent is still treated as an accent slip)
const ACCENT_TWINS = new Set(['a', 'la', 'ou', 'sur', 'du', 'des']);
export const deacc = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const stripArt = s => s.replace(ARTS, '');

/** all accepted normalized forms of a list entry */
export function variants(fr) {
  const out = new Set();
  const raw = String(fr);
  const add = s => { const n = norm(s); if (n) { out.add(n); const b = stripArt(n); if (b) out.add(b); } };
  add(raw);
  for (const piece of raw.split(/\s*[,/;]\s*/)) add(piece);
  // "ne... pas" style: also without the dots
  return [...out];
}
function lev(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1] ? d[i - 2][j - 2] + 1 : 99);
  return d[a.length][b.length];
}

/** returns 'exact' | 'article' | 'accent' | 'typo' | false
 *  opts.also  – other entries that are equally correct (same Hebrew translation)
 *  opts.taken – Set of normalized variants of ALL entries: typing another list word is never a "typo" */
export function check(input, fr, opts = {}) {
  const u = norm(input);
  if (!u) return false;
  const vs = new Set([fr, ...(opts.also || [])].flatMap(variants));
  if (vs.has(u)) return 'exact';
  const bare = stripArt(u);
  const hadArt = bare !== u;
  if (hadArt && vs.has(bare)) return 'article';
  const dv = new Set([...vs].map(deacc));
  // typed exactly another word (with its own accents), e.g. "ou" for "où": that is a different word
  const otherWord = x => (opts.taken && opts.taken.has(x) && !vs.has(x)) || (ACCENT_TWINS.has(x) && !vs.has(x));
  if (otherWord(u)) return false;
  if (dv.has(deacc(u))) return 'accent';
  if (otherWord(bare)) return false;
  if (dv.has(deacc(bare))) return 'accent';
  const takenD = opts.taken ? new Set([...opts.taken].map(deacc)) : null;
  if (takenD && (takenD.has(deacc(u)) || takenD.has(deacc(bare)))) return false;
  for (const c of [deacc(u), deacc(bare)]) for (const v of dv) {
    if (v.length >= 5 && lev(c, v) <= 1) return 'typo';
    if (v.length >= 10 && lev(c, v) <= 2) return 'typo';
  }
  return false;
}
