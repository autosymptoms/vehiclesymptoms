// Review pass for new vehicle data.
// 1. Drop issues whose ONLY sources are au7o.io (an AI-compiled site), with their price items.
// 2. Remove au7o.io links everywhere else (deep, prices, own); drop price items left with no source.
// 3. Turn api.nhtsa.gov JSON links into readable nhtsa.gov vehicle pages.
// Usage: node cleanup-wave.js id1 id2 ...
const fs = require('fs');
const path0 = require('path');
const R = path0.resolve(__dirname, '../../src');
const bad = (u) => /au7o\.io/i.test(u);
const fixApi = (u) => {
  const m = u.match(/^https:\/\/api\.nhtsa\.gov\/(recalls\/recallsByVehicle|complaints\/complaintsByVehicle)\?(.*)$/);
  if (!m) return u;
  const q = new URLSearchParams(m[2]);
  const mk = q.get('make'), md = q.get('model'), yr = q.get('modelYear');
  if (!mk || !md || !yr) return u;
  return `https://www.nhtsa.gov/vehicle/${yr}/${encodeURIComponent(mk.toUpperCase())}/${encodeURIComponent(md.toUpperCase())}`;
};
const clean = (arr) => [...new Set((arr || []).filter((u) => !bad(u)).map(fixApi))];
for (const id of process.argv.slice(2)) {
  const dp = `${R}/deep/${id}.json`, pp = `${R}/prices/${id}.json`, op = `${R}/own/${id}.json`;
  if (!fs.existsSync(dp)) { console.log('missing', id); continue; }
  const d = JSON.parse(fs.readFileSync(dp, 'utf8'));
  const dropped = new Set();
  d.issues = d.issues.filter((i) => { const s = i.src || []; if (s.length && s.every(bad)) { dropped.add(i.t); return false; } return true; });
  for (const i of d.issues) i.src = clean(i.src);
  fs.writeFileSync(dp, JSON.stringify(d, null, 1) + '\n');
  let pd = 0;
  if (fs.existsSync(pp)) {
    const P = JSON.parse(fs.readFileSync(pp, 'utf8'));
    P.items = P.items.filter((x) => { if (dropped.has(x.t)) return false; x.src = clean(x.src); if (!x.src.length) { pd++; return false; } return true; });
    fs.writeFileSync(pp, JSON.stringify(P, null, 1) + '\n');
  }
  if (fs.existsSync(op)) {
    const O = JSON.parse(fs.readFileSync(op, 'utf8'));
    if (O.annual && O.annual.src) O.annual.src = clean(O.annual.src);
    for (const m of O.maint || []) if (m.src) m.src = clean(m.src);
    fs.writeFileSync(op, JSON.stringify(O, null, 1) + '\n');
  }
  console.log(`${id}: dropped ${dropped.size} AI-site-only issues, ${pd} unsourced prices; now ${d.issues.length} issues`);
}
