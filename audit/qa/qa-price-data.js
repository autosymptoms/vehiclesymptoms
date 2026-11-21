// QA: static scan of dist/data/v/*.json, dist/vehicles.js and dist/price-est.js for withheld price figures,
// and the PDF code path (src/pdf.js) run against every vehicle/year with a recording jsPDF stub.
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIST = path.join(__dirname, '../../dist');
const res = [];
const check = (id, d, p, e) => { res.push({ id, desc: d, pass: !!p, evidence: String(e).slice(0, 400) }); console.log((p ? 'PASS ' : 'FAIL ') + id + ' ' + d + ' :: ' + String(e).slice(0, 300)) };

// 1. Walk every object in every per-vehicle data file
let files = 0, objsWithheld = 0, withheldWithNum = [], numericPriced = [], freeWithNum = 0, amountLeaks = [];
const NUMKEYS = ['lo', 'hi', 'amount', 'p', 'low', 'high', 'min', 'max', 'price'];
function walk(o, f, trail) {
  if (Array.isArray(o)) return o.forEach((x, i) => walk(x, f, trail + '[' + i + ']'));
  if (!o || typeof o !== 'object') return;
  if (o.withheld === true) { objsWithheld++; for (const k of NUMKEYS) if (k in o) withheldWithNum.push(f + ':' + trail + '.' + k + '=' + JSON.stringify(o[k])); }
  else if (typeof o.lo === 'number' || typeof o.hi === 'number' || typeof o.amount === 'number') { if (o.free) freeWithNum++; else numericPriced.push(f + ':' + trail); }
  for (const [k, v] of Object.entries(o)) walk(v, f, trail + '.' + k);
}
const dollarsInData = {};
for (const f of fs.readdirSync(path.join(DIST, 'data/v'))) { files++; const t = fs.readFileSync(path.join(DIST, 'data/v', f), 'utf8'); walk(JSON.parse(t), f, '');
  const m = t.match(/\$\d[\d,]*/g); if (m) dollarsInData[f] = m.length; }
check('QA-PRC-DATA-1', 'no withheld object in dist/data/v/*.json carries lo/hi/amount (' + files + ' files, ' + objsWithheld + ' withheld objects)', withheldWithNum.length === 0, withheldWithNum.slice(0, 5).join('; ') || 'none');
check('QA-PRC-DATA-2', 'no non-free numeric price objects at all in dist/data/v (all prices are withheld in this build)', numericPriced.length === 0, numericPriced.length + ' found; ' + numericPriced.slice(0, 5).join('; ') + '; free-with-number=' + freeWithNum);
const dFiles = Object.keys(dollarsInData);
res.push({ id: 'QA-PRC-DATA-INFO', desc: 'dollar strings inside prose of dist/data/v files (not structured prices)', pass: true, evidence: dFiles.length + ' files, ' + Object.values(dollarsInData).reduce((a, b) => a + b, 0) + ' occurrences' });
console.log('INFO dollar strings in prose of data/v files:', dFiles.length, 'files');

// 2. vehicles.js and price-est.js
global.window = {}; eval(fs.readFileSync(path.join(DIST, 'vehicles.js'), 'utf8')); const V = window.VEHICLES;
let vjNum = []; walk(V, 'vehicles.js', ''); // reuses arrays
eval(fs.readFileSync(path.join(DIST, 'price-est.js'), 'utf8')); const E = window.EST;
check('QA-PRC-EST', 'dist/price-est.js ships no estimator jobs (jobs=' + E.jobs.length + ', held=' + E.held.length + ')', E.jobs.length === 0, 'jobs=' + E.jobs.length);
check('QA-PRC-EST-SPARK', 'spark plug job is in the held list (so a search still mentions it)', E.held.some(h => /spark plug/i.test(h)), E.held.filter(h => /spark/i.test(h)).join());
eval(fs.readFileSync(path.join(DIST, 'price-index.js'), 'utf8'));
check('QA-PRC-GEN', 'GEN_PRICES (general fallback prices) is empty', Array.isArray(window.GEN_PRICES) && window.GEN_PRICES.length === 0, JSON.stringify(window.GEN_PRICES).slice(0, 80));

// 3. PDF code path: run src/pdf.js against every vehicle (all-years + each year) with a stub jsPDF that records text
const pdfSrc = fs.readFileSync(path.join(__dirname, '../../src/pdf.js'), 'utf8');
let texts = [];
class Stub { constructor() { } setFont() { } setFontSize() { } setTextColor() { } setDrawColor() { } setLineWidth() { } setFillColor() { } line() { } roundedRect() { } addPage() { } link() { } textWithLink(t) { texts.push(String(t)) }
  splitTextToSize(t) { return [String(t)] } getTextWidth(t) { return String(t).length * 4 } text(t) { texts.push(Array.isArray(t) ? t.join(' ') : String(t)) } save() { } output() { return '' } getNumberOfPages() { return 1 } setPage() { } }
const sb = { window: { jspdf: { jsPDF: Stub } }, Date, console, location: { href: 'https://www.vehiclesymptoms.com/vehicles/x/', pathname: '/vehicles/x/', origin: 'https://www.vehiclesymptoms.com' } }; vm.createContext(sb); vm.runInContext(pdfSrc, sb);
let runs = 0, pdfDollar = [], errs = [];
const DISC = 'Estimates only, not a quote.', NOTE = 'note';
for (const v0 of V) {
  const full = Object.assign({}, v0, JSON.parse(fs.readFileSync(path.join(DIST, 'data/v', v0.id + '.json'), 'utf8')));
  const years = [null]; for (let y = v0.years[0]; y <= v0.years[1]; y++) years.push(y);
  for (const y of years) {
    const list = full.issues.filter(i => !y || (y >= i.y[0] && y <= i.y[1]));
    texts = [];
    try { sb.window.VS_PDF({ v: full, year: y, list, name: (y ? y + ' ' : '') + full.make + ' ' + full.model, disc: DISC, note: NOTE, recalls: { status: 'unavailable' } }); } catch (e) { errs.push(v0.id + ' ' + y + ': ' + e.message); continue }
    runs++; const all = texts.join('\n'); const m = all.match(/\$\s?\d[\d,]*/g); if (m) pdfDollar.push(v0.id + '/' + (y || 'all') + ': ' + [...new Set(m)].slice(0, 4).join(' '));
    if (/undefined|NaN/.test(all)) errs.push(v0.id + ' ' + y + ': undefined/NaN in text');
  }
}
check('QA-PRC-PDF', 'PDF code path prints no "$<number>" for any vehicle/year (' + runs + ' PDFs generated with stub)', pdfDollar.length === 0, pdfDollar.length + ' PDFs with dollar figures; ' + pdfDollar.slice(0, 6).join(' | '));
check('QA-PRC-PDF-ERR', 'PDF generation threw no errors and printed no undefined/NaN', errs.length === 0, errs.length + ': ' + errs.slice(0, 4).join(' | '));
fs.writeFileSync(path.join(__dirname, 'qa-price-pdf-dollars.txt'), pdfDollar.join('\n'));
fs.writeFileSync(path.join(__dirname, 'qa-price-data.json'), JSON.stringify(res, null, 1));
