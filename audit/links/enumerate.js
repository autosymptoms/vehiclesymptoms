#!/usr/bin/env node
// Enumerates every generated recommendation link on the CURRENT site and classifies it.
// Usage: node audit/links/enumerate.js   (run from the repo root; reads vehicles.js, src/journeys, src/codes, src/lights.js)
// Writes audit/links/generated-links.csv and audit/links/guide-page-issue-links.csv, prints counts.
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const OUT = __dirname;
global.window = {};
require(path.join(ROOT, 'vehicles.js'));
const V = window.VEHICLES;
const J = fs.readdirSync(path.join(ROOT, 'src/journeys')).filter(f => f.endsWith('.json')).sort()
  .map(f => JSON.parse(fs.readFileSync(path.join(ROOT, 'src/journeys', f), 'utf8')));
// same shape build.js writes to guide-index.js
const G = J.map(j => ({ id: j.id, title: j.title, h1: j.h1, cat: j.cat, syn: j.synonyms, match: j.issueMatch, related: j.related }));
const GT = Object.fromEntries(G.map(g => [g.id, g]));
const { compile, strictFor, matchesGuide } = require('./strict-matcher.js');
const C = compile(JSON.parse(fs.readFileSync(path.join(__dirname, 'guide-links.json'), 'utf8')));

// ---- current algorithm, copied from src/guide.js forIssue() and matches() ----
const escRe = w => w.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordRx = w => new RegExp('\\b' + escRe(w) + '[a-z0-9/-]*'); // same test as site (leading \b only); suffix captured for reporting
function forIssueCurrent(i) {
  const hay = (i.t + ' ' + i.sym).toLowerCase(); let best = null, bs = 0, bh = [];
  for (const g of G) {
    let s = 0, hits = []; if (g.match.cats.includes(i.cat)) s += 1;
    for (const w of g.match.words) { const m = hay.match(wordRx(w)); if (m) { s += 3; hits.push([w, m[0]]) } }
    if (hits.length && s > bs) { bs = s; best = g; bh = hits }
  }
  return bs >= 4 ? { g: best, hits: bh, score: bs } : null;
}
function guidePageHits(g, i) { // src/guide.js matches(): any word, no score, no category
  const hay = (i.t + ' ' + i.sym).toLowerCase(); const hits = [];
  for (const w of g.match.words) { const m = hay.match(wordRx(w)); if (m) hits.push([w, m[0]]) }
  return hits;
}

// ---- classification ----
const GENERIC = new Set(('pull drive reverse shift gear engage delay brake oil smell burning start crank steering tire wheel water leak battery sensor light ' +
  'fluid pump mount seal gasket short wiring switch window key valve idle stall hose drain flicker dim ground tick hum roar hiss clunk ' +
  'smoke belt caliper spring shock strut suspension vibration shake jerk slip slipping transmission engine coolant exhaust radiator ' +
  'temperature fan fuse actuator regulator radio play bushing alignment pad rotor drag seized park air heater thermostat hybrid inverter ' +
  'charging voltage turbo grind rattle jerk shudder creak groan squeal whine click knock pop squeak axle hub tire differential sag bounce flashing shaking misfire emissions catalytic odor mold musty').split(/\s+/));
const morph = (w, m) => { if (m === w) return true; const b = w.replace(/e$/, ''); return [w + 's', w + 'es', w + 'ed', w + 'd', w + 'ing', b + 'ing', w + 'er', w + 'y', w + 'ly'].includes(m) };
function classify(g, i, hits) {
  const t = i.t, s = i.sym;
  if (matchesGuide(C, g.id, t)) return ['exact', 'issue title names this guide\'s symptom'];
  const globalHit = C.not.find(x => x.test(t));
  if (globalHit) return ['wrong', 'issue is about "' + (t.match(globalHit) || [''])[0] + '", which is not this guide\'s symptom'];
  const other = strictFor(C, t);
  if (other && other.id !== g.id) return ['wrong', 'issue title names a different symptom: ' + other.id + ' ("' + other.term + '")'];
  if (matchesGuide(C, g.id, s, true)) return ['plausible', 'guide symptom is one of several listed in "What you\'ll notice", not the problem itself'];
  const incidental = hits.filter(([w, m]) => !morph(w, m) || GENERIC.has(w));
  if (hits.length && incidental.length === hits.length)
    return ['wrong', 'only incidental word match(es): ' + hits.map(([w, m]) => m === w ? w : w + '→' + m).join(', ')];
  return ['uncertain', 'shares a component word with the guide but the issue never states the guide\'s symptom'];
}

const csvq = x => { x = String(x == null ? '' : x); return /[",\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x };
const HEAD = 'source_route,source_item,dest_route,match_basis,verdict,reason,link_type';
const rows = [HEAD], counts = {}, bump = (type, v) => { counts[type] = counts[type] || {}; counts[type][v] = (counts[type][v] || 0) + 1 };
const yr = i => i.y[0] === i.y[1] ? '' + i.y[0] : i.y[0] + '-' + i.y[1];

// 1. vehicle page "Walk through this symptom" (forIssue) — one per issue card
for (const v of V) for (const i of v.issues) {
  const r = forIssueCurrent(i); if (!r) continue;
  const [verdict, reason] = classify(r.g, i, r.hits);
  bump('vehicle_issue_walkthrough', verdict);
  rows.push([`/vehicles/${v.id}/`, `${v.id} ${yr(i)}: ${i.t}`, `/symptoms/${r.g.id}/`,
    `score ${r.score}${r.g.match.cats.includes(i.cat) ? ' (cat ' + i.cat + ' +1)' : ''}; ` + r.hits.map(([w, m]) => m === w ? w : w + '→' + m).join('; '),
    verdict, reason, 'vehicle_issue_walkthrough'].map(csvq).join(','));
}
// 2. code page "Walk through it step by step" (c.guide, hand-assigned)
let CODES = []; for (const f of fs.readdirSync(path.join(ROOT, 'src/codes')).filter(f => f.endsWith('.json'))) CODES = CODES.concat(JSON.parse(fs.readFileSync(path.join(ROOT, 'src/codes', f), 'utf8')));
const LIGHTGUIDE = new Set(['check-engine-light-on', 'abs-light-on', 'airbag-light-on', 'traction-control-light-on', 'transmission-warning-light', 'tire-pressure-light-on', 'power-steering-warning-light', 'check-hybrid-system-warning', 'oil-pressure-light-on', 'battery-light-on', 'reduced-engine-power-warning', 'dashboard-lights-all-on', 'security-light-flashing-wont-start', 'brake-warning-light-on']);
for (const c of CODES) {
  if (!c.guide) continue; const g = GT[c.guide];
  if (!g) { bump('code_guide', 'wrong'); rows.push([`/codes/${c.code.toLowerCase()}/`, c.code + ' ' + c.title, `/symptoms/${c.guide}/`, 'c.guide (hand-assigned)', 'wrong', 'guide does not exist', 'code_guide'].map(csvq).join(',')); continue }
  const sym = (c.symptoms || []).join('. ');
  let verdict, reason;
  if (matchesGuide(C, g.id, c.title)) { verdict = 'exact'; reason = 'code title names the guide symptom' }
  else if (LIGHTGUIDE.has(g.id) && (c.symptoms || []).some(x => matchesGuide(C, g.id, x))) { verdict = 'exact'; reason = 'the code\'s first-listed symptom is this warning light' }
  else if ((c.symptoms || []).some(x => matchesGuide(C, g.id, x, true))) { verdict = 'plausible'; reason = 'guide symptom is one of the code\'s listed symptoms: ' + sym.slice(0, 120) }
  else { verdict = 'uncertain'; reason = 'hand-assigned; the code\'s listed symptoms do not state the guide symptom: ' + sym.slice(0, 120) }
  bump('code_guide', verdict);
  rows.push([`/codes/${c.code.toLowerCase()}/`, c.code + ' ' + c.title, `/symptoms/${g.id}/`, 'c.guide (hand-assigned)', verdict, reason, 'code_guide'].map(csvq).join(','));
}
// 3. warning-light page guides (l.guides, hand-assigned) — reviewed by hand, see LIGHT_REVIEW
const LIGHTS = require(path.join(ROOT, 'src/lights.js'));
const LIGHT_REVIEW = {
  'check-engine-light>check-engine-light-on': ['exact', 'same light'], 'check-engine-light>check-engine-light-flashing': ['exact', 'same light, flashing state'],
  'oil-pressure-light>oil-pressure-light-on': ['exact', 'same light'], 'oil-pressure-light>burning-oil-low-oil-level': ['plausible', 'low oil level is a main cause'], 'oil-pressure-light>oil-leak': ['plausible', 'oil loss is a main cause'],
  'engine-temperature-light>engine-overheating': ['exact', 'same warning'], 'engine-temperature-light>overheats-only-in-traffic': ['plausible', 'overheating variant'], 'engine-temperature-light>losing-coolant-no-visible-leak': ['plausible', 'common cause'],
  'battery-light>battery-light-on': ['exact', 'same light'], 'battery-light>battery-keeps-dying': ['plausible', 'charging fault drains battery'], 'battery-light>headlights-dim-or-flickering': ['plausible', 'charging fault symptom'],
  'brake-warning-light>brake-warning-light-on': ['exact', 'same light'], 'brake-warning-light>brake-fluid-leak': ['plausible', 'low fluid is a main cause'], 'brake-warning-light>soft-or-spongy-brake-pedal': ['plausible', 'related brake symptom'],
  'abs-light>abs-light-on': ['exact', 'same light'], 'airbag-light>airbag-light-on': ['exact', 'same light'],
  'tire-pressure-light>tire-pressure-light-on': ['exact', 'same light'], 'tire-pressure-light>tire-keeps-losing-air': ['plausible', 'main cause'],
  'traction-control-light>traction-control-light-on': ['exact', 'same light'],
  'power-steering-light>power-steering-warning-light': ['exact', 'same light'], 'power-steering-light>steering-hard-to-turn': ['plausible', 'what the light usually comes with'], 'power-steering-light>power-steering-fluid-leak': ['plausible', 'hydraulic systems only'],
  'transmission-warning-light>transmission-warning-light': ['exact', 'same light'], 'transmission-warning-light>transmission-slipping': ['plausible', 'related'], 'transmission-warning-light>transmission-fluid-leak': ['plausible', 'related'],
  'coolant-level-light>losing-coolant-no-visible-leak': ['exact', 'low coolant is the light\'s meaning'], 'coolant-level-light>engine-overheating': ['plausible', 'consequence'],
  'seat-belt-light>airbag-light-on': ['wrong', 'seat belt reminder is not the airbag/SRS light; the airbag guide does not help a driver with a seat belt reminder'],
  'master-warning-light>dashboard-lights-all-on': ['plausible', 'master warning usually accompanies other messages'],
  'hybrid-system-light>check-hybrid-system-warning': ['exact', 'same warning'], 'security-light>security-light-flashing-wont-start': ['exact', 'same light'],
  'door-open-light>battery-keeps-dying': ['uncertain', 'door left ajar can drain the battery, but the light\'s subject is a door switch'],
  'key-battery-light>security-light-flashing-wont-start': ['plausible', 'weak fob battery can cause a no-start with key/security warning'],
  'high-beam-light>headlights-dim-or-flickering': ['uncertain', 'high-beam indicator is informational; dim/flickering lights guide is a different symptom'],
  'oil-level-light>burning-oil-low-oil-level': ['exact', 'low oil level is the light\'s meaning'], 'oil-level-light>oil-leak': ['plausible', 'common cause'],
};
for (const l of LIGHTS) for (const gid of l.guides || []) {
  const k = l.id + '>' + gid; const [verdict, reason] = LIGHT_REVIEW[k] || ['uncertain', 'not reviewed'];
  bump('light_guide', verdict);
  rows.push([`/warning-lights/${l.id}/`, l.name, `/symptoms/${gid}/`, 'l.guides (hand-assigned)', verdict, reason, 'light_guide'].map(csvq).join(','));
}
// 4. guide page "Related guides" (j.related, hand-assigned, filtered to existing guides by build.js)
for (const g of G) for (const r of g.related.filter(r => GT[r] && r !== g.id)) {
  bump('guide_related', 'plausible');
  rows.push([`/symptoms/${g.id}/`, g.title, `/symptoms/${r}/`, 'j.related (hand-assigned)', 'plausible', 'curated related symptom; by design a different symptom, labelled as related, never as the answer', 'guide_related'].map(csvq).join(','));
}
fs.writeFileSync(path.join(OUT, 'generated-links.csv'), rows.join('\n') + '\n');

// 5. guide page "Documented problems on the <vehicle>" (matches() in src/guide.js): every issue any guide word hits
const rows2 = [HEAD];
for (const g of G) for (const v of V) for (const i of v.issues) {
  const hits = guidePageHits(g, i); if (!hits.length) continue;
  const [verdict, reason] = classify(g, i, hits);
  bump('guide_page_vehicle_issue', verdict);
  rows2.push([`/symptoms/${g.id}/?v=${v.id}`, `${v.id} ${yr(i)}: ${i.t}`, `/vehicles/${v.id}/`, hits.map(([w, m]) => m === w ? w : w + '→' + m).join('; '), verdict, reason, 'guide_page_vehicle_issue'].map(csvq).join(','));
}
fs.writeFileSync(path.join(OUT, 'guide-page-issue-links.csv'), rows2.join('\n') + '\n');
console.log(JSON.stringify(counts, null, 1));
console.log('issues', V.reduce((a, v) => a + v.issues.length, 0), 'guides', G.length);
