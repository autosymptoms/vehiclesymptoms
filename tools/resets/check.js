#!/usr/bin/env node
// Checks reset files before they go on the site.
//   node tools/resets/check.js                 -> every file in src/resets/models and tools/resets/makes
//   node tools/resets/check.js honda-civic ... -> only those model ids
// Model files: src/resets/models/<vehicle-id>.json   (see tools/resets/BRIEF.md for the format)
// Make files:  tools/resets/makes/<make-slug>.json    (merged into src/resets.json by tools/resets/merge-makes.js)
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
global.window = {};
for (const f of ['src/vehicles.js', ...fs.readdirSync(path.join(ROOT, 'src/batches')).filter(f => /^batch\d+\.js$/.test(f)).map(f => 'src/batches/' + f)])
  eval(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const V = window.VEHICLES;
for (const f of fs.readdirSync(path.join(ROOT, 'src/deep')).filter(f => f.endsWith('.json'))) {
  const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/deep', f), 'utf8'));
  const k = V.findIndex(v => v.id === d.id); if (k >= 0) V[k] = d; else V.push(d);
}
const byId = new Map(V.map(v => [v.id, v]));
const publishers = require(path.join(ROOT, 'src/source-publishers.json'));
const BANNED = /(^|\.)(au7o\.io|openlaborproject\.com|carparts\.com\/blog|wikihow\.com|reddit\.com|quora\.com|youtube\.com|youtu\.be|facebook\.com|tiktok\.com|pinterest\.com|dodgeforum\.com|askmanual\.pages\.dev)$/i;
const EXTERNAL_TEXT = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|org|gov|net|io|co|ca|uk)\b)/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
let errors = 0, warnings = 0;
const unknownHosts = new Map();
const err = (f, m) => { errors++; console.log('ERROR ' + f + ': ' + m) };
const warn = (f, m) => { warnings++; console.log('warn  ' + f + ': ' + m) };
function hostOf(u) { try { return new URL(u).hostname.toLowerCase().replace(/^www\./, '') } catch { return null } }
function knownHost(h) { while (h && h.includes('.')) { if (publishers[h]) return true; h = h.slice(h.indexOf('.') + 1) } return false }
function checkSrc(f, where, src) {
  if (!Array.isArray(src) || !src.length) return err(f, where + ': needs at least one source URL');
  for (const u of src) {
    if (typeof u !== 'string' || !/^https:\/\//.test(u)) { err(f, where + ': source must be an https URL: ' + u); continue }
    const h = hostOf(u); if (!h) { err(f, where + ': bad URL ' + u); continue }
    if (BANNED.test(h) || BANNED.test(h + new URL(u).pathname)) err(f, where + ': banned source ' + h);
    if (!knownHost(h)) unknownHosts.set(h, (unknownHosts.get(h) || 0) + 1);
  }
}
function checkText(f, where, t, max) {
  if (typeof t !== 'string' || !t.trim()) return err(f, where + ': empty text');
  if (EXTERNAL_TEXT.test(t)) err(f, where + ': text must not contain web addresses: ' + t.slice(0, 80));
  if (t.length > max) warn(f, where + ': long (' + t.length + ' chars)');
}
function checkVariants(f, kind, list, years) {
  if (!Array.isArray(list)) return err(f, kind + ' must be a list');
  list.forEach((x, i) => {
    const w = kind + '[' + i + ']';
    if (!Array.isArray(x.years) || x.years.length !== 2 || !x.years.every(Number.isInteger) || x.years[0] > x.years[1]) return err(f, w + ': years must be [from, to]');
    if (years && (x.years[0] < years[0] || x.years[1] > years[1])) err(f, w + ': years ' + x.years.join('-') + ' outside the model years ' + years.join('-'));
    checkText(f, w + '.when', x.when, 160);
    if (x.none === true) { if (x.steps && x.steps.length) err(f, w + ': a "none" entry has no steps'); checkText(f, w + '.note', x.note, 400) }
    else {
      if (!Array.isArray(x.steps) || x.steps.length < 2 || x.steps.length > 12) err(f, w + ': needs 2 to 12 steps');
      else x.steps.forEach((s, k) => checkText(f, w + '.steps[' + k + ']', s, 300));
      if (x.note !== undefined && x.note !== '') checkText(f, w + '.note', x.note, 400);
    }
    if (!['manual', 'maker', 'secondary'].includes(x.basis)) err(f, w + ': basis must be "manual", "maker" or "secondary"');
    checkSrc(f, w, x.src);
  });
  // overlapping year ranges are allowed only when "when" tells them apart (trim, display, engine)
}
function checkModel(file) {
  const f = path.basename(file); let d;
  try { d = JSON.parse(fs.readFileSync(file, 'utf8')) } catch (e) { return err(f, 'not valid JSON: ' + e.message) }
  const v = byId.get(d.id);
  if (!v) return err(f, 'unknown vehicle id ' + d.id);
  if (f !== d.id + '.json') err(f, 'file name must be ' + d.id + '.json');
  if (!DATE.test(d.checked || '')) err(f, 'checked must be YYYY-MM-DD');
  if (!d.oil && !d.tpms) err(f, 'needs oil and/or tpms');
  if (d.oil) checkVariants(f, 'oil', d.oil, v.years);
  if (d.tpms) checkVariants(f, 'tpms', d.tpms, v.years);
  for (const k of Object.keys(d)) if (!['id', 'checked', 'oil', 'tpms', 'notes'].includes(k)) err(f, 'unexpected key ' + k);
  if (d.notes !== undefined) checkText(f, 'notes', d.notes, 500);
}
function checkMake(file) {
  const f = path.basename(file); let d;
  try { d = JSON.parse(fs.readFileSync(file, 'utf8')) } catch (e) { return err(f, 'not valid JSON: ' + e.message) }
  if (!d.make || !V.some(v => v.make === d.make)) err(f, 'make must match a make on the site exactly: ' + d.make);
  for (const kind of ['oil', 'tpms']) {
    const s = d[kind]; if (!s) continue;
    if (!Array.isArray(s.variants) || !s.variants.length) { err(f, kind + '.variants missing'); continue }
    s.variants.forEach((x, i) => {
      const w = kind + '.variants[' + i + ']'; checkText(f, w + '.when', x.when, 160);
      if (!Array.isArray(x.steps) || x.steps.length < 2) err(f, w + ': needs steps'); else x.steps.forEach((t, k) => checkText(f, w + '.steps[' + k + ']', t, 300));
      if (x.note) checkText(f, w + '.note', x.note, 400);
    });
    checkSrc(f, kind, s.src);
  }
  if (d.notes) checkText(f, 'notes', d.notes, 600);
}
const args = process.argv.slice(2);
const MD = path.join(ROOT, 'src/resets/models'), KD = path.join(ROOT, 'tools/resets/makes');
const models = fs.existsSync(MD) ? fs.readdirSync(MD).filter(f => f.endsWith('.json')) : [];
const makes = fs.existsSync(KD) ? fs.readdirSync(KD).filter(f => f.endsWith('.json')) : [];
let n = 0;
for (const f of models) if (!args.length || args.includes(f.replace(/\.json$/, ''))) { checkModel(path.join(MD, f)); n++ }
if (!args.length) for (const f of makes) { checkMake(path.join(KD, f)); n++ }
for (const a of args) if (a.startsWith('make:')) { checkMake(path.join(KD, a.slice(5) + '.json')); n++ }
if (unknownHosts.size) console.log('note  source sites with no publisher name yet (add to src/source-publishers.json): ' + [...unknownHosts.keys()].sort().join(', '));
console.log(`${n} files checked, ${errors} errors, ${warnings} warnings`);
process.exit(errors ? 1 : 0);
