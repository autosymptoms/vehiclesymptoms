// Price-check coverage: how much of the site's repair-price data is real, sourced repair pricing.
// Usage: node tools/vehicle-agents/price-stats.js [--list]   (--list prints every model under 80% priced, most unpriced issues first)
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', '..', 'src');
let nonRecall = 0, priced = 0, diag = 0, rough = 0;
const low = [];
for (const f of fs.readdirSync(path.join(root, 'deep'))) {
  const d = JSON.parse(fs.readFileSync(path.join(root, 'deep', f)));
  let items = [];
  try { items = JSON.parse(fs.readFileSync(path.join(root, 'prices', f))).items; } catch (e) {}
  const byT = new Map(items.map(i => [i.t, i]));
  let n = 0, p = 0;
  for (const is of d.issues) {
    const it = byT.get(is.t);
    if (it && it.recall) continue;
    n++;
    if (!it || !((it.parts && it.parts[1] > 0) || (it.hours && it.hours[1] > 0))) continue;
    p++;
    const txt = ((it.job || '') + ' ' + (it.note || '')).toLowerCase();
    if (/^(inspect|diagnos|check|test)/.test((it.job || '').toLowerCase()) || /diagnosis only|diagnostic only/.test(txt)) diag++;
    if (/rough estimate/.test(txt)) rough++;
  }
  nonRecall += n; priced += p;
  if (n && p / n < 0.8) low.push([d.id, Math.round(100 * p / n), n - p]);
}
low.sort((a, b) => b[2] - a[2] || a[1] - b[1]);
console.log(`non-recall issues: ${nonRecall} | priced: ${priced} (${(100 * priced / nonRecall).toFixed(1)}%) | diagnosis-only: ${diag} | rough estimates: ${rough} | models under 80% priced: ${low.length}`);
if (process.argv.includes('--list')) for (const [id, r, u] of low) console.log(`${id}\t${r}%\t${u} unpriced`);
