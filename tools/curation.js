// Line curation used for the dialogue document: picks the hardest lines (most profanity / outrage, short and punchy) per Bamboul bark category.
/* ---------- how many lines each category keeps ---------- */
const QUOTA = {
  'pain:walk:early': 9, 'pain:walk:mid': 9, 'pain:walk:late': 10, 'pain:drink': 7, 'pain:owner': 8, 'pain:lazy': 3, 'pain:pain': 3,
  'pain:room:hall': 2, 'pain:room:living': 2, 'pain:room:kitchen': 2, 'pain:room:bath': 2, 'pain:room:work': 2,
  'idle': 6, 'idle:l1': 2, 'idle:l2': 2, 'idle:l3': 2, 'idle:l4': 2, 'idle:l5': 2, 'tired': 3, 'wait': 3, 'chore:avoid': 4, 'oops': 3,
  'pickup': 8, 'toss': 4, 'owner:comes': 6, 'sofa': 4, 'success': 5, 'fail': 6, 'time:300': 3, 'time:120': 3, 'time:60': 3, 'time:30': 3, 'time:10': 3,
  'chaos:pipe': 3, 'chaos:washer': 3, 'chaos:spill': 3, 'chaos:trash': 3, 'chaos:neighbor': 3, 'chaos:owner': 2
};
const quotaOf = (cat, size) => QUOTA[cat] != null ? QUOTA[cat] : size <= 3 ? 2 : size < 10 ? 2 : size < 20 ? 3 : 4;
const SKIP = new Set(['move']);                        // legacy pool, already merged into pain:walk:*

/* ---------- how hard is a line ---------- */
const MAT = [[/^(на|по|о|за|рас|при|ни|от|до)?ху[йеёяи]/, 3], [/^хул[иье]/, 3], [/^(за|на|про|у|съ|вы|до|раз|от|по)?[её]б(а|у|и|е|ы|н|л|ись|ат|ыч|$)/, 3], [/^(рас|вы|по|за|на|ис|в|с|до|при)?(пизд|пезд)/, 3], [/^бля/, 3],
  [/^(сука|суки|суку|суке|сучь|сучар)/, 2], [/^(муда|муди|мудо)/, 2], [/^(мраз|гондон|гандон|ублюд|падл|скотин|тварь|твар|урод|долбо|дебил|кретин|придур|чмо|паразит|сволоч|хамье)/, 2],
  [/^(говн|жоп|дерьм|сран|срач|срать|сри)/, 1]];
function score(t) {
  const words = (t.toLowerCase().replace(/ё/g, 'е').match(/[а-я]+/g) || []);
  let mat = 0, hits = 0; for (const w of words) for (const [rx, v] of MAT) if (rx.test(w)) { mat += v; hits++; break; }
  mat = Math.min(mat, 9);
  const caps = Math.min(3, (t.match(/[А-ЯЁ]{3,}/g) || []).length) * .8, excl = Math.min(3, (t.match(/!/g) || []).length) * .6, q = /\?!|!\?/.test(t) ? .8 : 0;
  const theme = /хозя|убира|убор|бух|пив|выпить|заебал|не хочу|мудил|хуил/i.test(t) ? 1 : 0;
  const len = t.length, lenAdj = len > 95 ? -Math.min(3, (len - 95) / 40) : len < 60 ? .5 : 0;
  return { s: mat + caps + excl + q + theme + lenAdj, mat: hits };
}
const head = t => t.toLowerCase().replace(/[^а-яё ]/g, '').split(/\s+/).slice(0, 3).join(' ');


function curate(pools) {
  const cats = {}, usedText = new Set();
  for (const c of Object.keys(pools)) {
    const p = pools[c]; if (p.who !== 'bamboul' || SKIP.has(c)) continue;
    const n = Math.min(p.e.length, quotaOf(c, p.e.length));
    const ranked = p.e.filter(e => !usedText.has(e.t)).map(e => Object.assign({ sc: score(e.t) }, e)).sort((a, b) => b.sc.s - a.sc.s);
    const pick = [], heads = new Set(), groups = [...new Set(p.e.map(e => e.cond))];
    const take = e => { pick.push(e); heads.add(head(e.t)); usedText.add(e.t); };
    if (groups.length > 1) for (const g of groups) { const best = ranked.find(e => e.cond === g && !pick.includes(e)); if (best) take(best); }
    for (const e of ranked) { if (pick.length >= Math.max(n, groups.length > 1 ? groups.length : 0)) break; if (pick.includes(e) || heads.has(head(e.t))) continue; take(e); }
    for (const e of ranked) { if (pick.length >= n) break; if (!pick.includes(e)) take(e); }
    cats[c] = pick.map(e => ({ t: e.t, mat: e.sc.mat, s: e.sc.s, cond: e.cond }));
  }
  return cats;
}
module.exports = { head, QUOTA, quotaOf, score, curate, SKIP };
