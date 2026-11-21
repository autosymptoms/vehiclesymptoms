// Builds recall-map-single.json from raw-models.txt (NHTSA lists fetched 2026-11-21).
// Run from repo root: node audit/recalls/single/build-single-map.js
const fs = require('fs');
const path = require('path');
const dir = __dirname;
global.window = {};
eval(fs.readFileSync(path.join(dir, '../../../vehicles.js'), 'utf8'));
const V = window.VEHICLES;
const existing = JSON.parse(fs.readFileSync(path.join(dir, '../../../src/recall-map.json'), 'utf8')).models;

// lists[MAKE][year] = {names:Set(upper), src}
const lists = {}; const recalls = {}; // recalls['MAKE|MODEL|year']=count
for (const line of fs.readFileSync(path.join(dir, 'raw-models.txt'), 'utf8').split('\n')) {
  if (!line.trim() || line.startsWith('#')) continue;
  const p = line.split('|');
  if (p[0] === 'RECALLS') {
    const m = /Count (\d+)/.exec(p[3]); if (!m || +m[1] === 0) continue;
    const sp = p[2].indexOf(' '); const make = p[2].slice(0, sp), model = p[2].slice(sp + 1);
    recalls[make + '|' + model + '|' + p[1]] = +m[1]; continue;
  }
  const [make, year, type, rest] = p;
  if (!rest || /same as c/.test(rest)) continue;
  const names = rest.replace(/\(\+motorcycles\)/g, '').split(',').map(s => s.trim().replace(/\s+/g, ' ').toUpperCase()).filter(Boolean);
  lists[make] = lists[make] || {};
  const e = lists[make][year] = lists[make][year] || { names: new Set(), src: [] };
  names.forEach(n => e.names.add(n)); e.src.push(type.startsWith('catalog') ? 'catalog' : 'issueType=' + type[0]);
}

const MAKE = { Ram: 'RAM', GMC: 'GMC', Volkswagen: 'VOLKSWAGEN' };
const SKIP = new Set(['ford-e-series', 'honda-clarity']); // no single NHTSA name; see NOTES.md
const C = {
  'toyota-sienna': ['SIENNA', 'SIENNA HYBRID'], 'toyota-venza': ['VENZA', 'VENZA HYBRID'],
  'toyota-sequoia': ['SEQUOIA', 'SEQUOIA HYBRID'], 'toyota-camry': ['CAMRY', 'CAMRY HYBRID'],
  'toyota-land-cruiser': ['LAND CRUISER', 'LANDCRUISER', 'LAND CRUISER HYBRID'], 'toyota-crown': ['CROWN'],
  'toyota-supra': ['SUPRA'], 'kia-optima': ['OPTIMA', 'K5'], 'subaru-crosstrek': ['CROSSTREK', 'XV CROSSTREK'],
  'honda-prologue': ['PROLOGUE'], 'chevrolet-silverado-2500hd': ['SILVERADO 2500'],
  'chevrolet-silverado-3500hd': ['SILVERADO 3500'], 'gmc-sierra-2500hd': ['SIERRA 2500'], 'gmc-sierra-3500hd': ['SIERRA 3500'],
  'chevrolet-captiva-sport': ['CAPTIVA'], 'mazda-mx-5-miata': ['MX-5'], 'ford-f-250-super-duty': ['F-250 SD'],
  'ford-f-350-super-duty': ['F-350 SD'],
};
const PRIORITY = ['Toyota', 'Honda', 'Ford', 'Chevrolet', 'Nissan', 'Jeep', 'Hyundai', 'Kia', 'Subaru', 'Ram', 'GMC', 'Dodge', 'Tesla', 'Mazda', 'Volkswagen'];

const out = {}; const report = [];
for (const v of V) {
  if (existing[v.id] || !PRIORITY.includes(v.make) || SKIP.has(v.id)) continue;
  const make = MAKE[v.make] || v.make.toUpperCase();
  const cands = C[v.id] || [v.model.toUpperCase()];
  const inGap = y => (v.gaps || []).some(([a, b]) => y >= a && y <= b);
  const yrs = [];
  for (let y = v.years[0]; y <= v.years[1]; y++) {
    if (inGap(y)) continue;
    let hit = null;
    for (const n of cands) {
      const l = lists[make] && lists[make][y];
      const rc = recalls[make + '|' + n + '|' + y];
      if (l && l.names.has(n)) { hit = { y, name: n, ev: `products/vehicle/models ${y} ${make} ${l.src.join('+')} lists ${n}` + (rc ? `; recallsByVehicle ${y} ${make} ${n} Count ${rc}` : '') }; break; }
      if (rc) { hit = { y, name: n, ev: `recallsByVehicle ${y} ${make} ${n} Count ${rc}` }; break; }
    }
    if (hit) yrs.push(hit);
  }
  if (!yrs.length) continue;
  const ranges = [];
  for (const h of yrs) {
    const last = ranges[ranges.length - 1];
    if (last && last.to === h.y - 1 && last._name === h.name) { last.to = h.y; last._ev.push(h.ev); continue; }
    ranges.push({ from: h.y, to: h.y, _name: h.name, _ev: [h.ev] });
  }
  out[v.id] = ranges.map(r => ({
    from: r.from, to: r.to, verified: true,
    queries: [{ make, model: r._name, label: v.model }],
    evidence: r._ev.join('; ') + '; accessed 2026-11-21',
  }));
  report.push({ id: v.id, label: v.model, years: yrs.length, names: [...new Set(yrs.map(h => h.name))].join('/'), ranges: ranges.map(r => r.from === r.to ? r.from : r.from + '-' + r.to).join(',') });
}
fs.writeFileSync(path.join(dir, 'recall-map-single.json'), JSON.stringify({ generated: '2026-11-21', source: 'NHTSA api.nhtsa.gov products/vehicle/models (issueType=c, max=500) and recalls/recallsByVehicle spot checks', models: out }, null, 1) + '\n');
fs.writeFileSync(path.join(dir, 'coverage.tsv'), 'id\tsite label\tyears verified\tNHTSA name(s)\tranges\n' + report.map(r => [r.id, r.label, r.years, r.names, r.ranges].join('\t')).join('\n') + '\n');
console.log('ids', report.length, 'model-years', report.reduce((a, r) => a + r.years, 0));
