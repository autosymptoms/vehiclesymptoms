#!/usr/bin/env node
// Link-matching regression tests. Run from a repo with audit/links/proposed.patch applied:
//   node audit/links/test-links.js [repoRoot]
// Loads vehicles.js, builds the guide index exactly as build.js does (src/journeys + src/guide-links.json),
// then runs the site's own src/guide.js (forIssue / matchesGuide) in a sandbox.
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '../..'));
const win = {};
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'vehicles.js'), 'utf8'), { window: win });
const J = fs.readdirSync(path.join(ROOT, 'src/journeys')).filter(f => f.endsWith('.json')).sort()
  .map(f => JSON.parse(fs.readFileSync(path.join(ROOT, 'src/journeys', f), 'utf8')));
win.GUIDE_INDEX = J.map(j => ({ id: j.id, title: j.title, h1: j.h1, group: j.group, cat: j.cat, syn: j.synonyms }));
const linksFile = path.join(ROOT, 'src/guide-links.json');
if (!fs.existsSync(linksFile)) { console.error('src/guide-links.json missing: apply audit/links/proposed.patch first'); process.exit(2) }
const L = JSON.parse(fs.readFileSync(linksFile, 'utf8'));
win.GUIDE_LINKS = { not: L.not, order: L.order, guides: L.guides };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src/guide.js'), 'utf8'),
  { window: win, document: { getElementById: () => null, addEventListener() {} }, location: { hash: '', search: '' }, localStorage: {}, sessionStorage: {}, fetch: () => Promise.reject() });
const { forIssue, matchesGuide } = win.VS_GUIDES;
if (typeof matchesGuide !== 'function') { console.error('src/guide.js has no matchesGuide: patch not applied'); process.exit(2) }
const V = win.VEHICLES, byId = Object.fromEntries(V.map(v => [v.id, v]));
let fail = 0, pass = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log('FAIL', msg) } };
const link = i => (forIssue(i) || {}).id || null;

// 1. 2024 Tesla Model 3: no camera/screen issue links to the delayed engagement guide (nor any guide)
const m3 = byId['tesla-model-3'].issues.filter(i => i.y[0] <= 2024 && 2024 <= i.y[1]);
const cams = m3.filter(i => /camera/i.test(i.t));
ok(cams.length > 0, 'expected a 2024 Model 3 camera issue in the data');
for (const i of cams) {
  ok(link(i) !== 'delayed-engagement-into-gear', `Model 3 camera issue links to delayed engagement: ${i.t}`);
  ok(!matchesGuide('delayed-engagement-into-gear', i.t), `delayed engagement guide page lists camera issue: ${i.t}`);
}
for (const v of V) for (const i of v.issues) if (/camera/i.test(i.t)) ok(link(i) === null, `${v.id} camera issue links to ${link(i)}: ${i.t}`);

// 2. Acura wiper issues never link to "car pulls to one side"
for (const v of V.filter(v => v.make === 'Acura')) for (const i of v.issues) if (/wiper/i.test(i.t + ' ' + i.sym)) {
  ok(link(i) !== 'car-pulls-to-one-side', `${v.id} wiper issue links to pulls-to-one-side: ${i.t}`);
  ok(!matchesGuide('car-pulls-to-one-side', i.t), `pulls guide page lists wiper issue: ${i.t}`);
}

// 3. Real delayed-shift complaints link to the delayed engagement guide
for (const t of ['Delayed or harsh engagement into Reverse', 'Delay before Reverse engages', 'M4 dual-clutch delays engaging Drive or Reverse', 'Harsh shifts or delayed engagement into Reverse']) {
  ok(link({ t, sym: '', cat: 'Driving' }) === 'delayed-engagement-into-gear', `"${t}" should link to delayed-engagement-into-gear, got ${link({ t, sym: '' })}`);
  ok(matchesGuide('delayed-engagement-into-gear', t), `delayed engagement guide page should list "${t}"`);
}
const realDelayed = V.flatMap(v => v.issues.filter(i => /delayed or harsh engagement into reverse/i.test(i.t)));
ok(realDelayed.length > 0 && realDelayed.every(i => link(i) === 'delayed-engagement-into-gear'), 'data issue "Delayed or harsh engagement into Reverse" must link to delayed engagement');

// 4. Zero-wrong rule on the hand-labelled set (audit/links/labeled.json)
const LB = JSON.parse(fs.readFileSync(path.join(__dirname, 'labeled.json'), 'utf8'));
let exactHit = 0, exactN = 0;
for (const x of LB) {
  const v = byId[x.v], i = v && v.issues.find(i => i.t === x.t);
  ok(!!i, `labelled issue not found: ${x.v} ${x.t}`); if (!i) continue;
  if (x.label === 'wrong' || x.label === 'uncertain') {
    ok(link(i) !== x.guide, `labelled ${x.label} link produced: ${x.v} "${x.t}" -> ${x.guide}`);
    if (x.label === 'wrong') ok(!matchesGuide(x.guide, x.t), `guide page lists labelled-wrong issue: ${x.t} on ${x.guide}`);
  }
  if (x.label === 'exact') { exactN++; if (link(i) === x.guide) exactHit++ }
}
// 5. every guide in the rules exists
for (const id of L.order) ok(win.GUIDE_INDEX.some(g => g.id === id), `rule for unknown guide ${id}`);

let linked = 0, total = 0; for (const v of V) for (const i of v.issues) { total++; if (link(i)) linked++ }
console.log(`labelled: ${LB.length} (exact recall ${exactHit}/${exactN}); issues with a guide link: ${linked}/${total}`);
console.log(fail ? `${fail} FAILED, ${pass} passed` : `all ${pass} checks passed`);
process.exit(fail ? 1 : 0);
