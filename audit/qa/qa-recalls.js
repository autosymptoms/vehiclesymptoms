// QA: recall lookup behaviour on rendered vehicle year pages (independent of tools/regression.js)
const { open, wait, check, out } = require('./harness');
const fs = require('fs');
const rec = (n, make, model, year) => ({ Manufacturer: 'X', NHTSACampaignNumber: n, Component: 'BRAKES:X', Summary: 'qa summary ' + n, Remedy: 'qa remedy', ModelYear: String(year), Make: make, Model: model });
const ok = body => Promise.resolve({ ok: true, status: 200, json: async () => body });
const statusText = p => (p.d.getElementById('nhtsa') || {}).textContent || '';
const tile = p => ((p.d.querySelector('#recTile .tv') || {}).textContent || '').trim();
const models = p => p.calls.filter(u => /api\.nhtsa\.gov/.test(u)).map(u => new URL(u).searchParams.get('model'));
const hasVinLink = p => [...p.d.querySelectorAll('#nhtsa a')].some(a => a.href === 'https://www.nhtsa.gov/recalls');
const unavailable = p => /lookup unavailable/i.test(statusText(p)) && hasVinLink(p) && tile(p) !== '0' && !/No safety recalls/.test(statusText(p));
async function run(route, nhtsa, opt = {}) { const p = open(route, Object.assign({ nhtsa }, opt)); await p.ready; await wait(opt.wait || 400); return p; }

(async () => {
  const I = '/vehicles/acura-rsx-integra/2023/';
  // a. queried as INTEGRA, 2-result validated response shows 2
  let p = await run(I, q => ok({ Count: 2, Message: 'Results returned successfully', results: [rec('23V111000', 'ACURA', 'INTEGRA', 2023), rec('24V222000', 'ACURA', 'INTEGRA', 2023)] }));
  check('QA-REC-1', '2023 Integra queries model=INTEGRA make=ACURA year=2023', models(p).join() === 'INTEGRA' && p.calls.some(u => /make=ACURA/.test(u) && /modelYear=2023/.test(u)), p.calls.filter(u => /nhtsa/.test(u)).join(' '));
  check('QA-REC-2', 'validated 2-result response shows 2 (tile and box, both campaigns listed)', tile(p) === '2' && /2 safety recalls/.test(statusText(p)) && /23V111000/.test(statusText(p)) && /24V222000/.test(statusText(p)), 'tile=' + tile(p) + ' box=' + statusText(p).slice(0, 120));
  // duplicate campaign twice in the same response: Count must equal results.length; dedupe => total 1
  p = await run(I, q => ok({ Count: 2, results: [rec('23V111000', 'ACURA', 'INTEGRA', 2023), rec('23V111000', 'ACURA', 'INTEGRA', 2023)] }));
  check('QA-REC-3', 'duplicate campaign rows are counted once', tile(p) === '1', 'tile=' + tile(p));
  // error paths
  const cases = [
    ['HTTP 500', q => Promise.resolve({ ok: false, status: 500, json: async () => ({}) })],
    ['HTTP 200 but non-JSON', q => Promise.resolve({ ok: true, status: 200, json: async () => { throw new SyntaxError('bad json') } })],
    ['malformed: results not array', q => ok({ Count: 0, results: null })],
    ['malformed: Count missing', q => ok({ results: [] })],
    ['malformed: bad campaign number', q => ok({ Count: 1, results: [rec('ABC', 'ACURA', 'INTEGRA', 2023)] })],
    ['mismatched year', q => ok({ Count: 1, results: [rec('23V111000', 'ACURA', 'INTEGRA', 2022)] })],
    ['mismatched make', q => ok({ Count: 1, results: [rec('23V111000', 'HONDA', 'INTEGRA', 2023)] })],
    ['network reject', q => Promise.reject(new TypeError('Failed to fetch'))],
    ['timeout (abort after 10 s, timers accelerated)', (q, o) => new Promise((res, rej) => { if (o && o.signal) o.signal.addEventListener('abort', () => rej(new Error('aborted'))) }), { fastTimers: true }],
  ];
  for (const [name, fn, opt] of cases) { p = await run(I, fn, opt || {}); check('QA-REC-ERR ' + name, 'shows Lookup unavailable + NHTSA VIN link, never 0', unavailable(p), 'tile=' + tile(p) + ' box=' + statusText(p).slice(0, 140)); }
  // Rivian: R1T and R1S queried separately
  p = await run('/vehicles/rivian-r1s-r1t/2023/', q => ok({ Count: 1, results: [rec(q.get('model') === 'R1T' ? '23V333000' : '23V444000', 'RIVIAN', q.get('model'), 2023)] }));
  check('QA-REC-RIV', 'Rivian 2023 queries R1T and R1S (separately) and totals 2 distinct campaigns', models(p).sort().join() === 'R1S,R1T' && tile(p) === '2', models(p).join() + ' tile=' + tile(p));
  // Rivian: one of the two lookups fails -> whole thing unavailable (no partial count presented as complete)
  p = await run('/vehicles/rivian-r1s-r1t/2023/', q => q.get('model') === 'R1S' ? Promise.reject(new Error('x')) : ok({ Count: 0, results: [] }));
  check('QA-REC-RIV-PART', 'Rivian with one failed lookup shows Lookup unavailable', unavailable(p), statusText(p).slice(0, 120));

  // No combined "/" label ever sent: open every combined-label year page (561 expected) with an empty-result stub
  global.window = {}; eval(fs.readFileSync(require('path').join(__dirname, '../../dist/vehicles.js'), 'utf8'));
  const V = window.VEHICLES; const combined = V.filter(v => / \/ /.test(v.model));
  const dirs = []; for (const v of combined) { const base = require('path').join(__dirname, '../../dist/vehicles', v.id); if (fs.existsSync(base)) for (const y of fs.readdirSync(base)) if (/^\d{4}$/.test(y)) dirs.push('/vehicles/' + v.id + '/' + y + '/'); }
  let sent = [], bad = [], pages = 0, zeroShown = [];
  for (const r of dirs) {
    p = await run(r, q => ok({ Count: 0, Message: 'Results returned successfully', results: [] }), { wait: 150 });
    pages++; const ms = models(p); sent.push(...ms); for (const m of ms) if (/\//.test(m) || / \/ /.test(m)) bad.push(r + ' -> ' + m);
    p.w.close();
  }
  check('QA-REC-SLASH', 'no model value containing "/" sent from any of ' + pages + ' combined-label year pages', bad.length === 0 && pages > 0, 'pages=' + pages + ' queries=' + sent.length + ' bad=' + bad.slice(0, 5).join('; '));
  fs.writeFileSync(require('path').join(__dirname, 'combined-pages-tested.txt'), 'combined-label models=' + combined.length + ' year pages opened=' + pages + ' nhtsa queries=' + sent.length + '\n' + dirs.join('\n'));
  fs.writeFileSync(require('path').join(__dirname, 'qa-recalls.json'), JSON.stringify(out, null, 1));
  console.log(out.filter(x => x.pass).length + '/' + out.length + ' passed'); process.exit(0);
})();
