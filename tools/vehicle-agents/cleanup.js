// Review pass for new vehicle data.
// 1. Drop issues whose ONLY sources are au7o.io (an AI-compiled site), with their price items.
// 2. Remove au7o.io links everywhere else (deep, prices, own); drop price items left with no source.
// 3. Turn api.nhtsa.gov JSON links into readable nhtsa.gov vehicle pages.
// 4. Never-sole-source list (Nov 27 audit VI-04): weak aggregator sites may stay as pointers, but an issue
//    whose ONLY sources are on this list gets "wk": true (shown as "Reported by owners; not yet confirmed by a
//    primary source") until someone adds an NHTSA campaign, maker bulletin/program or other primary source.
//    The issue is kept, not deleted. A recall ID (##V-###) anywhere in src counts as a primary pointer.
// Usage: node tools/vehicle-agents/cleanup.js id1 id2 ...   (or --all)
const fs = require('fs');
const path0 = require('path');
const R = path0.resolve(__dirname, '../../src');
const bad = (u) => /au7o\.io|cherishyourcar\.com/i.test(u);
const WEAK_DOMAINS = ['carwhere.com', 'vehicleflaws.com', 'forcar.org', 'carcomplaintdata.com', 'enginepatrol.com',
  '8020automotive.com', 'rerev.com', 'askmanual.pages.dev', 'autobarn.net', 'theweeklydriver.com', 'motorverso.com',
  'recallcheck.net', 'vindecoder.site', 'transmissionaudit.com', 'cardog.app', 'recalldex.com', 'motorillustrated.com',
  'garagedreams.net', 'testingautos.com', 'carproblemzoo.com'];
const weak = (u) => { let h; try { h = new URL(u).hostname.toLowerCase(); } catch (e) { return false; } return WEAK_DOMAINS.some((w) => h === w || h.endsWith('.' + w)); };
const weakOnly = (s) => s.length > 0 && s.every(weak) && !s.some((u) => /\b\d{2}V-?\d{3}\b/.test(u));
const fixApi = (u) => {
  const m = u.match(/^https:\/\/api\.nhtsa\.gov\/(recalls\/recallsByVehicle|complaints\/complaintsByVehicle)\?(.*)$/);
  if (!m) return u;
  const q = new URLSearchParams(m[2]);
  const mk = q.get('make'), md = q.get('model'), yr = q.get('modelYear');
  if (!mk || !md || !yr) return u;
  return `https://www.nhtsa.gov/vehicle/${yr}/${encodeURIComponent(mk.toUpperCase())}/${encodeURIComponent(md.toUpperCase())}`;
};
const clean = (arr) => [...new Set((arr || []).filter((u) => !bad(u)).map(fixApi))];
const ids = process.argv[2] === '--all' ? fs.readdirSync(`${R}/deep`).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)) : process.argv.slice(2);
for (const id of ids) {
  const dp = `${R}/deep/${id}.json`, pp = `${R}/prices/${id}.json`, op = `${R}/own/${id}.json`;
  if (!fs.existsSync(dp)) { console.log('missing', id); continue; }
  const raw = fs.readFileSync(dp, 'utf8');
  const d = JSON.parse(raw);
  // keep the file's own layout (most files use 1-space indent; a few are one line or 2-space)
  const ind = raw.startsWith('{\n  "') ? 2 : raw.startsWith('{\n "') ? 1 : 0, nl = raw.endsWith('\n') ? '\n' : '';
  const dropped = new Set();
  d.issues = d.issues.filter((i) => { const s = i.src || []; if (s.length && s.every(bad)) { dropped.add(i.t); return false; } return true; });
  let wk = 0;
  for (const i of d.issues) {
    i.src = clean(i.src);
    if (weakOnly(i.src)) { if (!i.wk) wk++; i.wk = true; } else if (i.wk) delete i.wk;
  }
  fs.writeFileSync(dp, JSON.stringify(d, null, ind || undefined) + nl);
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
  console.log(`${id}: dropped ${dropped.size} AI-site-only issues, ${pd} unsourced prices, newly marked ${wk} weak-source-only issues (wk); now ${d.issues.length} issues`);
}
