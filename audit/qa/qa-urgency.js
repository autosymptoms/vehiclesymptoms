// QA: misfire / ignition code pages, rendered dist HTML parsed by jsdom (no scripts).
// Checks: the first urgency element after the code H1 (document order) is the stop condition; FAQ JSON-LD "drive" answer starts with it.
const fs = require('fs'), path = require('path');
const { JSDOM } = require(path.join(__dirname, '../../node_modules/jsdom'));
const DIST = path.join(__dirname, '../../dist');
const res = []; const check = (id, d, p, e) => { res.push({ id, desc: d, pass: !!p, evidence: String(e).slice(0, 400) }); console.log((p ? 'PASS ' : 'FAIL ') + id + ' ' + d + (p ? '' : ' :: ' + String(e).slice(0, 300))) };
const STOP = /flashing|pull over|stop driving|turn the engine off|don't keep driving|do not drive/i;
function analyse(code) {
  const html = fs.readFileSync(path.join(DIST, 'codes', code, 'index.html'), 'utf8');
  const d = new JSDOM(html).window.document;
  const h1 = [...d.querySelectorAll('h1')].find(h => h.querySelector('.code-big'));
  if (!h1) return { err: 'no code H1' };
  const all = [...d.querySelectorAll('*')]; const start = all.indexOf(h1);
  const urgSel = el => /\burg(-first)?\b|\bdrivebox\b/.test(el.className || '') || el.getAttribute('role') === 'alert';
  const first = all.slice(start + 1).find(urgSel);
  const ld = [...d.querySelectorAll('script[type="application/ld+json"]')].map(s => { try { return JSON.parse(s.textContent) } catch (e) { return { _bad: true } } });
  const faq = ld.find(x => x['@type'] === 'FAQPage') || ld.find(x => x.mainEntity);
  const q = faq && (faq.mainEntity || []).find(q => /drive/i.test(q.name));
  const ans = q ? q.acceptedAnswer.text : '';
  const meta = (d.querySelector('meta[name="description"]') || {}).content || '';
  const firstText = first ? first.textContent.trim() : '';
  const firstSentence = firstText.replace(/^Stop-now condition\.\s*/, '').split(/(?<=\.)\s/)[0];
  return { title: h1.textContent.trim(), firstClass: first && first.className, firstText, ans, meta, ldBad: ld.some(x => x._bad), firstSentence,
    ansLeads: ans && firstSentence && ans.startsWith(firstSentence.slice(0, 40)), ansStop: STOP.test(ans.split(/(?<=\.)\s/)[0] || '') };
}
const pick = ['p0300', 'p0302', 'p0306', 'p0308', 'p0351', 'p0335']; // P0300 + 5 not used by tools/regression.js (it used 0301,0304,0316)
for (const c of pick) {
  const a = analyse(c);
  check('QA-URG-' + c, c.toUpperCase() + ' (' + (a.title || '') + '): first urgency element after code H1 is the stop condition', a.firstClass === 'urg-first' && STOP.test(a.firstText), 'first=' + a.firstClass + ' :: ' + (a.firstText || a.err || '').slice(0, 140));
  check('QA-URG-LD-' + c, c.toUpperCase() + ': FAQ JSON-LD drive answer opens with the stop condition', a.ansLeads && a.ansStop && !a.ldBad, 'ans=' + (a.ans || '').slice(0, 140));
}
// Sweep: every code page; which misfire/ignition-type pages lack a stop-first element?
const codes = fs.readdirSync(path.join(DIST, 'codes')).filter(c => fs.existsSync(path.join(DIST, 'codes', c, 'index.html')));
const rows = [['code', 'title', 'has_urg_first', 'first_urgency_class', 'ld_answer_starts_with_stop', 'drivebox_contradiction']];
let withFirst = 0, missing = [];
for (const c of codes) {
  const html = fs.readFileSync(path.join(DIST, 'codes', c, 'index.html'), 'utf8');
  const title = (html.match(/<h1><span class="code-big">[^<]*<\/span>([^<]*)/) || [])[1] || '';
  if (!/misfire|ignition|coil|crank(shaft)? position|camshaft position/i.test(title)) continue;
  const a = analyse(c); if (a.firstClass === 'urg-first') withFirst++; else missing.push(c + ' ' + title.trim());
  // contradiction: drive box "Otherwise:" paragraph repeats a flashing light with softer advice
  const contra = /Otherwise:[^<]*flashing[^<]*(slow down|ease off|soon)/i.test(html);
  rows.push([c, title.trim().replace(/,/g, ' '), a.firstClass === 'urg-first', a.firstClass || '', !!a.ansStop, contra]);
}
fs.writeFileSync(path.join(__dirname, 'qa-urgency-sweep.csv'), rows.map(r => r.join(',')).join('\n') + '\n');
check('QA-URG-SWEEP', 'misfire/ignition/crank/cam-titled code pages with stop-first element: ' + withFirst + '/' + (rows.length - 1), missing.length === 0, 'missing: ' + missing.slice(0, 12).join('; '));
const contra = rows.slice(1).filter(r => r[5]).map(r => r[0]);
check('QA-URG-CONTRA', 'no drive box repeats the flashing-light case under "Otherwise" with softer advice', contra.length === 0, contra.length + ' pages, e.g. ' + contra.slice(0, 8).join(' '));
fs.writeFileSync(path.join(__dirname, 'qa-urgency.json'), JSON.stringify(res, null, 1));
