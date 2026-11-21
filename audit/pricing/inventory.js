#!/usr/bin/env node
// Price inventory for the VehicleSymptoms.com pricing audit (2026-11-21).
// Read-only: reads src/, build.js and dist/; writes only audit/pricing/price-inventory.csv and price-inventory-totals.csv.
// Run from the repo root:  node audit/pricing/inventory.js
// Mirrors build.js arithmetic: range = parts + hours x rate, rounded (floor low, ceil high) to $10/$25/$50 steps, hi >= lo+10.
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const R = p => path.join(ROOT, p);
const J = p => JSON.parse(fs.readFileSync(R(p), 'utf8'));
const OUT = __dirname;

// ---- constants taken from build.js (fail loudly if they change) ----
const B = fs.readFileSync(R('build.js'), 'utf8');
const rm = B.match(/const RATE=\[(\d+),(\d+)\]/); if (!rm) throw new Error('RATE not found in build.js');
const RATE = [+rm[1], +rm[2]];
const rnd = (n, up) => { const st = n < 500 ? 10 : n < 2000 ? 25 : 50; return (up ? Math.ceil(n / st) : Math.floor(n / st)) * st };
const range = (parts, hours, r) => { const lo = rnd(parts[0] + hours[0] * r[0], false); return [Math.max(lo, 0), Math.max(rnd(parts[1] + hours[1] * r[1], true), lo + 10)] };
const comp = (parts, hours, r) => `parts ${parts[0]}-${parts[1]} + hours ${hours[0]}-${hours[1]} x $${r[0]}-$${r[1]}/hr, rounded`;
const cm = B.slice(B.indexOf('const COMMON=['));
const COMMON = eval(cm.slice(cm.indexOf('['), cm.indexOf('];') + 1));

// ---- vehicles, loaded the way build.js loads them ----
global.window = {};
const vfiles = ['src/vehicles.js', ...fs.readdirSync(R('src/batches')).filter(f => /^batch\d+\.js$/.test(f)).sort((a, b) => parseInt(a.slice(5)) - parseInt(b.slice(5))).map(f => 'src/batches/' + f)];
for (const f of vfiles) eval(fs.readFileSync(R(f), 'utf8'));
let V = window.VEHICLES;
for (const f of fs.readdirSync(R('src/deep')).filter(f => f.endsWith('.json'))) { try { const d = J('src/deep/' + f); const k = V.findIndex(v => v.id === d.id); if (k >= 0) V[k] = d; else V.push(d) } catch (e) { } }
const CATS = ['Warning Lights', 'Smoke', 'Leaks', 'Noises', 'Smells', 'Starting Problems', 'Driving'];
for (const v of V) v.issues = v.issues.filter(i => i.y && i.y[0] >= v.years[0] && i.y[1] <= v.years[1] && i.y[0] <= i.y[1] && CATS.includes(i.cat) && ['high', 'med', 'low'].includes(i.sev) && i.t && i.sym && i.why && i.next);
const VID = new Map(V.map(v => [v.id, v]));

// ---- evidence helpers ----
const host = u => { try { return new URL(u).hostname.replace(/^(www|m|ww1)\./, '') } catch (e) { return '' } };
const isRP = u => /repairpal\.com/.test(host(u));
// Independent corroborators the release rule names (KBB, AAA, shop menus) plus other estimator sites. Owner complaint sites,
// recall pages and parts stores are NOT price corroborators for a parts+labor total.
const INDEP_EST = /kbb\.com|aaa\.com|yourmechanic\.com|jerry\.ai|carparts\.com|openlaborproject\.com|fixdapp\.com|carwhere\.com|truedelta\.com/;
const srcFlags = (srcs) => { const u = (srcs || []).map(s => typeof s === 'string' ? s : s.url).filter(Boolean); return [u.some(isRP) ? 'yes' : 'no', u.some(x => !isRP(x) && INDEP_EST.test(host(x))) ? 'yes' : 'no'] };

const rows = [];
const add = r => rows.push(Object.assign({ evidence_present: 'no', evidence_detail: '', rp_url_cited: 'no', indep_url_cited: 'no', evidence_pair: 'missing', pair_reason: '' }, r));
const NO_FIG = 'source URLs listed without a stated figure or access date; published range is our own parts+hours x rate arithmetic, not a figure any source states';

// 1. Vehicle issue cost (vehicle x issue), src/prices/<id>.json matched to an issue by title
for (const f of fs.readdirSync(R('src/prices')).filter(f => f.endsWith('.json')).sort()) {
  const P = J('src/prices/' + f), v = VID.get(P.id); if (!v) continue;
  const byT = new Map(P.items.map(x => [x.t, x]));
  v.issues.forEach((i, n) => {
    const x = byT.get(i.t); if (!x) return;
    const free = x.parts[1] === 0 && x.hours[1] === 0;
    const [lo, hi] = free ? [0, 0] : range(x.parts, x.hours, RATE);
    const [rp, ind] = srcFlags(x.src);
    add({ price_id: `issue:${v.id}:${n}`, family: free ? 'issue_cost_recall_free' : 'issue_cost', source_file: 'src/prices/' + f, vehicle_id_or_scope: `${v.id} ${i.y[0]}-${i.y[1]}`, job: x.job, unit_scope: 'one repair, national average, model-wide engine mix (' + i.t + ')', lo, hi,
      computation: free ? 'parts [0,0] hours [0,0] -> shown as free recall repair' : comp(x.parts, x.hours, RATE),
      routes_displayed: `/vehicles/${v.id}/ ; /vehicles/${v.id}/{${i.y[0]}..${i.y[1]}}/ ; /price-check/?v=${v.id} ; vehicle PDF download ; /symptoms/*/ (client, when this vehicle is picked)` + (free ? '' : ' ; feeds /price-check/ common ranges'),
      evidence_detail: free ? 'recall claim; NHTSA URLs cited, no date' : NO_FIG, rp_url_cited: rp, indep_url_cited: ind,
      pair_reason: free ? 'not a price; verify recall applicability separately' : (rp === 'yes' ? 'RepairPal URL cited but its figure, vehicle/engine, ZIP and date not recorded; no comparison to published range' : 'no RepairPal estimate recorded') });
  });
}
// 2/3. Ownership: maintenance items and annual average per vehicle
for (const f of fs.readdirSync(R('src/own')).filter(f => f.endsWith('.json')).sort()) {
  const O = J('src/own/' + f), v = VID.get(O.id); if (!v) continue;
  const rt = `/vehicles/${v.id}/ ; /vehicles/${v.id}/{year}/ ; vehicle PDF download`;
  if (O.annual) { const [rp, ind] = srcFlags(O.annual.src); const a = Math.round(O.annual.amount / 10) * 10;
    add({ price_id: `annual:${v.id}`, family: 'ownership_annual', source_file: 'src/own/' + f, vehicle_id_or_scope: v.id, job: 'Average yearly repair and maintenance', unit_scope: 'per year, model-wide' + (O.annual.label ? ' (' + O.annual.label + ')' : ''), lo: a, hi: a, computation: `stated amount ${O.annual.amount} rounded to $10`, routes_displayed: rt,
      evidence_detail: 'single source URL, no access date, model-wide (no year/engine/ZIP)', rp_url_cited: rp, indep_url_cited: ind,
      pair_reason: rp === 'yes' ? 'RepairPal is the only source; no independent corroboration recorded' : 'not from RepairPal; one non-RepairPal source only' }) }
  (O.maint || []).forEach(m => { const [lo, hi] = range(m.parts, m.hours, RATE); const [rp, ind] = srcFlags(m.src);
    add({ price_id: `maint:${v.id}:${m.key}`, family: 'maintenance_item', source_file: 'src/own/' + f, vehicle_id_or_scope: v.id + (O.ev ? ' (EV)' : ''), job: m.job, unit_scope: 'per service, model-wide (not year or engine specific); ' + (m.every || ''), lo, hi, computation: comp(m.parts, m.hours, RATE), routes_displayed: rt + ` ; /price-check/?v=${v.id}`,
      evidence_detail: NO_FIG, rp_url_cited: rp, indep_url_cited: ind, pair_reason: rp === 'yes' ? 'RepairPal page cited but figure/date not recorded and range is recomputed, not RepairPal\'s' : 'no RepairPal estimate recorded' }) });
}
// 4. Trouble-code repair cost (first occurrence of a code wins, as in build.js)
const cseen = new Set(), CODES = [];
for (const f of fs.readdirSync(R('src/codes')).filter(f => f.endsWith('.json')).sort()) for (const c of J('src/codes/' + f)) { if (cseen.has(c.code)) continue; cseen.add(c.code); CODES.push([c, f]) }
for (const [c, f] of CODES) if (c.cost) { const [lo, hi] = range(c.cost.parts, c.cost.hours, RATE); const [rp, ind] = srcFlags(c.src);
  add({ price_id: `code:${c.code}`, family: 'code_cost', source_file: 'src/codes/' + f, vehicle_id_or_scope: 'all vehicles', job: c.cost.job, unit_scope: 'typical fix for code ' + c.code + ', all vehicles', lo, hi, computation: comp(c.cost.parts, c.cost.hours, RATE), routes_displayed: `/codes/${c.code.toLowerCase()}/ ; /price-check/ (general estimate, if job name not already listed)`,
    evidence_detail: 'code-level source list (about the code, not the price); ' + NO_FIG, rp_url_cited: rp, indep_url_cited: ind, pair_reason: 'all-vehicle figure: no single vehicle to match a RepairPal estimate against' }) }
// 5/6. Warning-light cause costs and diagnosis fees
const LD = J('src/lights-deep.json');
for (const [id, d] of Object.entries(LD)) { const [rp, ind] = srcFlags(d.src);
  (d.causes2 || []).forEach((c, n) => add({ price_id: `light:${id}:${n}`, family: 'light_cause_cost', source_file: 'src/lights-deep.json', vehicle_id_or_scope: 'all vehicles', job: c.name, unit_scope: 'typical US parts+labor total for this cause of the ' + id, lo: c.lo, hi: c.hi, computation: 'hand-entered lo/hi (no parts/hours breakdown)', routes_displayed: `/warning-lights/${id}/`,
    evidence_detail: 'light-level source list, not tied to this cause; no figure or access date recorded', rp_url_cited: rp, indep_url_cited: ind, pair_reason: 'all-vehicle figure; no per-cause source/figure recorded' }));
  if (d.diag) add({ price_id: `lightdiag:${id}`, family: 'light_diag_fee', source_file: 'src/lights-deep.json', vehicle_id_or_scope: 'all vehicles', job: 'Diagnose ' + id, unit_scope: 'shop diagnosis fee', lo: d.diag[0], hi: d.diag[1], computation: 'hand-entered', routes_displayed: `/warning-lights/${id}/`, evidence_detail: 'no source tied to this fee', rp_url_cited: rp, indep_url_cited: ind, pair_reason: 'no RepairPal or other fee source recorded' });
}
// 7. Common repair ranges (recomputed exactly like build.js; checked against dist/price-index.js)
const pct = (a, q) => { a = [...a].sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(q * (a.length - 1)))] };
const costed = rows.filter(r => r.family === 'issue_cost' && r.lo > 0 && !/^(inspect|diagnose|check|test)/i.test(r.job));
const est = []; const heldJ = [];
for (const f of fs.readdirSync(R('src/estimator/jobs')).filter(f => f.endsWith('.json')).sort()) { const j = J('src/estimator/jobs/' + f); const ks = ['economy', 'midsize', 'truck', 'luxury'];
  const okR = a => Array.isArray(a) && a.length === 2 && a.every(n => typeof n === 'number' && n >= 0) && a[0] <= a[1];
  if (j.status === 'held' || !ks.every(k => j.classes[k] && okR(j.classes[k].parts) && okR(j.classes[k].hours))) heldJ.push(j.job); else est.push([j, f]) }
const norm = t => t.toLowerCase().replace(/\s*\(.*?\)\s*/g, ' ').trim();
const estNames = new Set(est.flatMap(([j]) => [norm(j.job), ...(j.aka || []).map(norm)]));
const gen = new Map();
for (const [name, re, ex] of COMMON) { const L = costed.filter(r => re.test(r.job.toLowerCase()) && !(ex && ex.test(r.job.toLowerCase()))); if (L.length < 5) continue;
  const lo = rnd(pct(L.map(r => r.lo), .25), false), hi = Math.max(rnd(pct(L.map(r => r.hi), .75), true), lo + 10); gen.set(name, { lo, hi, n: L.length, kind: 'common' }) }
for (const [c] of CODES) if (c.cost) { const k = c.cost.job.replace(/\s*\(.*?\)\s*/g, ' ').trim(); if (gen.has(k)) continue; const [lo, hi] = range(c.cost.parts, c.cost.hours, RATE); gen.set(k, { lo, hi, kind: 'code' }) }
let distCheck = 'dist/price-index.js not found';
try { global.window = {}; eval(fs.readFileSync(R('dist/price-index.js'), 'utf8')); const D = new Map(window.GEN_PRICES.map(x => [x[0], x])); let diff = 0; for (const [k, g] of gen) { const d = D.get(k); if (!d || d[1] !== g.lo || d[2] !== g.hi) diff++ } distCheck = `${gen.size} recomputed vs ${D.size} in dist/price-index.js, ${diff} differ` } catch (e) { }
for (const [name, g] of gen) { if (g.kind !== 'common') continue; const shadow = estNames.has(norm(name));
  add({ price_id: `common:${name}`, family: 'common_range', source_file: 'build.js COMMON + src/prices/*', vehicle_id_or_scope: 'all vehicles', job: name, unit_scope: 'general estimate, all vehicles', lo: g.lo, hi: g.hi, computation: `25th pct of ${g.n} vehicle issue lows to 75th pct of highs`, routes_displayed: shadow ? '(hidden on /price-check/: a sourced estimator job has the same name)' : '/price-check/ (General estimate (all vehicles))',
    evidence_detail: 'derived statistic over unevidenced issue ranges', pair_reason: 'derived from records that themselves lack an evidence pair' }) }
for (const [name, g] of gen) if (g.kind === 'code') add({ price_id: `gencode:${name}`, family: 'common_range_from_code', source_file: 'src/codes/*', vehicle_id_or_scope: 'all vehicles', job: name, unit_scope: 'general estimate, all vehicles', lo: g.lo, hi: g.hi, computation: 'code cost re-used', routes_displayed: estNames.has(norm(name)) ? '(hidden on /price-check/: estimator job of same name)' : '/price-check/ (General estimate (all vehicles))', evidence_detail: 'duplicate of a code_cost record', pair_reason: 'as code_cost' });
// 8. Estimator job x class (+ shown benchmarks and posted menu prices)
const VEH_RE = s => (s || '').toLowerCase();
for (const [j, f] of est) for (const k of ['economy', 'midsize', 'truck', 'luxury']) { const c = j.classes[k]; const [lo, hi] = range(c.parts, c.hours, RATE);
  const ex = c.example || ''; const exW = ex.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !/^\d/.test(w)).slice(0, 3); // make + model words
  const bm = (j.benchmarks || []).filter(b => typeof b.lo === 'number' && typeof b.hi === 'number');
  const veh = b => exW.slice(0, 2).every(w => VEH_RE(b.name + ' ' + b.url).includes(w.replace(/[^a-z0-9-]/g, '')));
  const ov = b => b.lo <= hi && b.hi >= lo;
  const rpM = bm.filter(b => /repairpal/i.test(b.url) && veh(b) && ov(b));
  const inM = bm.filter(b => !/repairpal/i.test(b.url) && !/repairpal/i.test(b.name + ' ' + (b.note || '')) && veh(b) && ov(b));
  const rpAny = bm.some(b => /repairpal/i.test(b.url));
  let pair = 'missing', why;
  if (rpM.length && inM.length) { pair = 'candidate_unverified'; why = `RepairPal (${rpM.map(b => b.name).join('; ')}) and ${inM.map(b => b.name).join('; ')} name the example vehicle and overlap; year/engine/ZIP match and provider independence not verified` }
  else why = rpM.length ? 'vehicle-matched RepairPal overlaps, but no independent vehicle-matched source' : rpAny ? 'RepairPal benchmark is all-vehicle or a different vehicle, or does not overlap this class range' : 'no RepairPal benchmark recorded';
  const srcs = [...(c.parts_src || []), ...(c.hours_src || [])];
  add({ price_id: `est:${f.replace(/\.json$/, '')}:${k}`, family: 'estimator_job_class', source_file: 'src/estimator/jobs/' + f, vehicle_id_or_scope: `${k} (example: ${ex})`, job: j.job, unit_scope: j.unit || '', lo, hi, computation: comp(c.parts, c.hours, RATE) + ' (national; state rate replaces RATE when a state is picked)', routes_displayed: '/price-check/ (Sourced estimate; offered for every vehicle, any powertrain)',
    evidence_present: 'no', evidence_detail: `components: ${srcs.length} part/labor source notes, job checked ${j.checked}; no source states the total; confidence ${j.confidence}`, rp_url_cited: rpAny ? 'yes' : 'no', indep_url_cited: bm.some(b => !/repairpal/i.test(b.url)) ? 'yes' : 'no', evidence_pair: pair, pair_reason: why });
  }
for (const [j, f] of est) { (j.benchmarks || []).filter(b => typeof b.lo === 'number' && /^https:\/\//.test(b.url)).forEach((b, n) => add({ price_id: `bm:${f.replace(/\.json$/, '')}:${n}`, family: 'estimator_benchmark_shown', source_file: 'src/estimator/jobs/' + f, vehicle_id_or_scope: b.name, job: j.job, unit_scope: 'third-party figure shown as cross-check', lo: b.lo, hi: b.hi, computation: 'transcribed', routes_displayed: '/price-check/ (How other estimators compare)', evidence_present: b.date ? 'yes' : 'no', evidence_detail: `${b.url} accessed ${b.date || '?'}`, rp_url_cited: /repairpal/i.test(b.url) ? 'yes' : 'no', evidence_pair: 'n/a', pair_reason: 'third-party figure attributed to its source, not our price' }));
  const mn = (Array.isArray(j.menu) ? j.menu : []).filter(m => m && typeof m.lo === 'number' && typeof m.hi === 'number' && m.lo > 0 && m.lo <= m.hi && /^https:\/\//.test(m.url) && m.name && m.where && !/^different service/i.test(m.what || ''));
  if (mn.length >= 4) mn.forEach((m, n) => add({ price_id: `menu:${f.replace(/\.json$/, '')}:${n}`, family: 'estimator_menu_price', source_file: 'src/estimator/jobs/' + f, vehicle_id_or_scope: `${m.name} (${m.where})`, job: j.job, unit_scope: 'posted shop menu price', lo: m.lo, hi: m.hi, computation: 'transcribed', routes_displayed: '/price-check/ (What shops advertise)', evidence_present: (m.date || j.checked) ? 'yes' : 'no', evidence_detail: `${m.url} read ${m.date || j.checked}`, evidence_pair: 'n/a', pair_reason: 'attributed shop posting, not our price' })) }
// 9. Labor rates
const RT = J('src/estimator/rates.json');
add({ price_id: 'rate:national', family: 'labor_rate', source_file: 'build.js', vehicle_id_or_scope: 'US', job: 'Shop labor rate', unit_scope: '$/hour, national middle', lo: RATE[0], hi: RATE[1], computation: 'constant RATE', routes_displayed: 'every computed price on the site; disclaimer text on /vehicles/*, /price-check/', evidence_present: 'yes', evidence_detail: 'rates.json _national.middle_src_notes: PartsTech survey via AAA/Stacker, 49% of shops $120-$159 (checked 2026-11-19); code uses 160 not 159', evidence_pair: 'n/a', pair_reason: 'survey statistic, not a repair estimate; release rule pairing does not apply' });
for (const [k, v] of Object.entries(RT)) { if (k.startsWith('_') || !Array.isArray(v.indep)) continue;
  add({ price_id: `rate:${k}`, family: 'labor_rate', source_file: 'src/estimator/rates.json', vehicle_id_or_scope: k, job: 'Shop labor rate', unit_scope: '$/hour, all-shop state figure (not independent-only)', lo: v.indep[0], hi: v.indep[1], computation: 'span of Tekmetric state average and AutoLeap state range', routes_displayed: '/price-check/ (when state picked)', evidence_present: v.checked ? 'yes' : 'no', evidence_detail: `${(v.src || []).length} URLs, checked ${v.checked}, confidence ${v.confidence}`, evidence_pair: v.confidence === 'medium' ? 'n/a (2 sources, AutoLeap soft)' : 'n/a (weak)', pair_reason: 'labor-rate statistic' }) }

// ---- write ----
const COLS = ['price_id', 'family', 'source_file', 'vehicle_id_or_scope', 'job', 'unit_scope', 'lo', 'hi', 'computation', 'routes_displayed', 'evidence_present', 'evidence_detail', 'rp_url_cited', 'indep_url_cited', 'evidence_pair', 'pair_reason'];
const q = s => { s = String(s ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s };
fs.writeFileSync(path.join(OUT, 'price-inventory.csv'), [COLS.join(','), ...rows.map(r => COLS.map(c => q(r[c])).join(','))].join('\n') + '\n');
const fam = {}; for (const r of rows) { const t = fam[r.family] = fam[r.family] || { n: 0, ev: 0, pair_ok: 0, cand: 0, na: 0 }; t.n++; if (r.evidence_present === 'yes') t.ev++; if (r.evidence_pair === 'present') t.pair_ok++; if (r.evidence_pair === 'candidate_unverified') t.cand++; if (/^n\/a/.test(r.evidence_pair)) t.na++ }
const tl = [['family', 'records', 'evidence_present_yes', 'evidence_pair_present', 'evidence_pair_candidate_unverified', 'pair_not_applicable', 'evidence_pair_missing']];
let T = { n: 0, ev: 0, pair_ok: 0, cand: 0, na: 0 };
for (const [k, t] of Object.entries(fam)) { tl.push([k, t.n, t.ev, t.pair_ok, t.cand, t.na, t.n - t.pair_ok - t.cand - t.na]); for (const x in T) T[x] += t[x] }
tl.push(['TOTAL', T.n, T.ev, T.pair_ok, T.cand, T.na, T.n - T.pair_ok - T.cand - T.na]);
fs.writeFileSync(path.join(OUT, 'price-inventory-totals.csv'), tl.map(r => r.join(',')).join('\n') + '\n');
console.table(tl.slice(1).map(r => Object.fromEntries(tl[0].map((h, i) => [h, r[i]]))));
console.log('common-range check:', distCheck, '| estimator jobs shown', est.length, 'held', heldJ.length, '| EV models with own.ev=true:', fs.readdirSync(R('src/own')).filter(f => J('src/own/' + f).ev).length);
