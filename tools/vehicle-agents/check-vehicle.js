// Validate one new model's data files without running the full site build.
// Usage: node tools/vehicle-agents/check-vehicle.js <model-id>
// Checks src/deep/<id>.json, src/prices/<id>.json, src/own/<id>.json and /tmp/vs-newgaps/<id>.json
const fs = require('fs'), path = require('path');
const path0 = require('path');
const R = path0.resolve(__dirname, '../../src');
const id = process.argv[2];
if (!id) { console.log('usage: node check-vehicle.js <model-id>'); process.exit(1); }
const errs = [], warns = [];
const read = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { errs.push(`${p}: ${e.message}`); return null; } };
const d = read(`${R}/deep/${id}.json`), P = read(`${R}/prices/${id}.json`), O = read(`${R}/own/${id}.json`);
let gaps = [];
if (fs.existsSync(`/tmp/vs-newgaps/${id}.json`)) { const g = read(`/tmp/vs-newgaps/${id}.json`); if (g) gaps = g; }
const CATS = ['Warning Lights', 'Smoke', 'Leaks', 'Noises', 'Smells', 'Starting Problems', 'Driving'];
const SYS = new Set();
if (d) {
  if (d.id !== id) errs.push('deep id does not match file name');
  if (!/^[a-z0-9-]+$/.test(id)) errs.push('id must be lowercase letters, digits and hyphens');
  if (!d.make || !d.model) errs.push('make/model missing');
  if (!Array.isArray(d.years) || d.years[0] < 1996 || d.years[1] > 2027 || d.years[0] > d.years[1]) errs.push('years must be [first,last] within 1996-2027');
  if (!Array.isArray(d.wmi) || !d.wmi.length || d.wmi.some(w => !/^[A-Z0-9]{3}$/.test(w))) errs.push('wmi must be a non-empty list of 3-character VIN prefixes');
  const ek = new Set();
  for (const e of d.engines || []) {
    if (!e.k || !e.name || !Array.isArray(e.y)) errs.push('engine needs k, name, y: ' + JSON.stringify(e));
    else if (e.y[0] < d.years[0] || e.y[1] > d.years[1]) errs.push('engine years outside model years: ' + e.k);
    if (ek.has(e.k)) errs.push('duplicate engine key ' + e.k); ek.add(e.k);
  }
  if (!(d.engines || []).length) errs.push('engines list is empty');
  const titles = new Set();
  for (const i of d.issues || []) {
    const tag = `issue "${i.t}"`;
    if (!(i.y && i.y[0] >= d.years[0] && i.y[1] <= d.years[1] && i.y[0] <= i.y[1])) errs.push(tag + ': y outside model years');
    if (!CATS.includes(i.cat)) errs.push(tag + ': bad cat ' + i.cat);
    if (!['high', 'med', 'low'].includes(i.sev)) errs.push(tag + ': bad sev');
    for (const k of ['sys', 't', 'sym', 'why', 'next']) if (!i[k]) errs.push(tag + ': missing ' + k);
    if (!Array.isArray(i.src) || i.src.length < 1) errs.push(tag + ': needs src URLs');
    if (titles.has(i.t)) errs.push('duplicate issue title ' + i.t); titles.add(i.t);
    if (i.engs) { for (const k of i.engs) if (!ek.has(k)) errs.push(tag + ': engs key not in engines: ' + k); if (!i.eng) warns.push(tag + ': has engs but no eng display name'); }
    if (i.eng && !i.engs) errs.push(tag + ': has eng but no engs keys');
    SYS.add(i.sys);
  }
  const n = (d.issues || []).length;
  const minN = (d.years[1]-d.years[0]+1) <= 8 ? 12 : 18;
  if (n < minN) errs.push(`only ${n} issues; aim for 20-35 (minimum ${minN} for this span)`);
  const sold = (y) => y >= d.years[0] && y <= d.years[1] && !gaps.some(g => y >= g[0] && y <= g[1]);
  const thin = [];
  for (let y = d.years[0]; y <= d.years[1]; y++) if (sold(y) && d.issues.filter(i => y >= i.y[0] && y <= i.y[1]).length < 3) thin.push(y);
  if (thin.length) errs.push('years with fewer than 3 issues (thin pages): ' + thin.join(', '));
  for (const i of d.issues || []) { let any = false; for (let y = i.y[0]; y <= i.y[1]; y++) if (sold(y)) any = true; if (!any) errs.push(`issue "${i.t}" only covers years the model was not sold`); }
  const exist = fs.readdirSync(`${R}/deep`).map(f => f.slice(0, -5)).filter(x => x !== id);
  for (const x of exist) { try { const o = JSON.parse(fs.readFileSync(`${R}/deep/${x}.json`, 'utf8')); if (o.make === d.make && o.model === d.model) errs.push('same make+model already exists as ' + x); } catch (e) {} }
}
if (P && d) {
  if (P.id !== id) errs.push('prices id mismatch');
  const titles = new Set(d.issues.map(i => i.t));
  for (const x of P.items || []) {
    if (!titles.has(x.t)) errs.push('price item title not found among issues: ' + x.t);
    if (!x.job || !Array.isArray(x.parts) || !Array.isArray(x.hours) || x.parts.length !== 2 || x.hours.length !== 2) errs.push('price item needs job, parts[lo,hi], hours[lo,hi]: ' + x.t);
    if (!Array.isArray(x.src) || !x.src.length) errs.push('price item needs src: ' + x.t);
  }
  const priced = new Set((P.items || []).map(x => x.t));
  const unpriced = d.issues.filter(i => !priced.has(i.t)).length;
  if (unpriced > d.issues.length * 0.2) warns.push(`${unpriced} of ${d.issues.length} issues have no price; price nearly all of them`);
}
if (O) {
  if (O.id !== id) errs.push('own id mismatch');
  if (typeof O.ev !== 'boolean') errs.push('own.ev must be true/false');
  if (!O.annual || !O.annual.amount) warns.push('own.annual missing');
  const keys = (O.maint || []).map(m => m.key);
  const need = O.ev ? ['front-brakes', 'rear-brakes', 'battery', 'coolant'] : ['oil', 'front-brakes', 'rear-brakes', 'battery', 'spark-plugs', 'coolant'];
  for (const k of need) if (!keys.includes(k)) warns.push('own.maint missing ' + k);
  for (const m of O.maint || []) if (!m.job || !m.every || !Array.isArray(m.parts) || !Array.isArray(m.hours)) errs.push('own.maint item incomplete: ' + m.key);
}
console.log(errs.length ? 'ERRORS:\n - ' + errs.join('\n - ') : 'No errors.');
if (warns.length) console.log('Warnings:\n - ' + warns.join('\n - '));
if (d) console.log(`${d.make} ${d.model} ${d.years.join('-')}: ${d.issues.length} issues, ${(d.engines || []).length} engines, ${(P && P.items || []).length} priced, systems: ${[...SYS].join(', ')}`);
process.exit(errs.length ? 1 : 0);
