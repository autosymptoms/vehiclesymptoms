// QA: price-check and vehicle-page pricing behaviour in jsdom (independent of tools/regression.js)
const { open, wait, check, out } = require('./harness');
const fs = require('fs'), path = require('path');
const ev = (p, el, t) => el.dispatchEvent(new p.w.Event(t, { bubbles: true }));
const txt = (p, id) => (p.d.getElementById(id) || {}).textContent || '';
const dollars = s => (s.match(/\$\s?\d[\d,]*/g) || []);
async function pc(qs, opt = {}) { const p = open('/price-check/', Object.assign({ qs }, opt)); await p.ready; await wait(300); return p; }
async function search(p, term) { const ji = p.d.getElementById('pcJob'); ji.value = term; ev(p, ji, 'input'); await wait(30); return txt(p, 'pcSug'); }
const sparkBtns = p => [...p.d.querySelectorAll('#pcSug button')].filter(b => /spark/i.test(b.textContent));
const qaBtn = p => [...p.d.querySelectorAll('#pcSug button')].find(b => /QA estimate/.test(b.textContent));
// QA-authored estimator fixture (made-up, clearly labelled numbers) so verdict logic can be exercised; production ships jobs=[].
const FIX = { jobs: [{ job: 'Spark plug replacement (QA estimate)', aka: ['spark plugs'], note: '', unit: 'per job', conf: 'medium', checked: 'QA FIXTURE', extras: 'x', menu: [], bm: [],
  cls: { economy: { p: [50, 80], h: [1, 1], ex: 'QA', src: [] }, midsize: { p: [50, 90], h: [1, 1.5], ex: 'QA', src: [] }, truck: { p: [60, 150], h: [1, 2], ex: 'QA', src: [] }, luxury: { p: [70, 150], h: [2, 2], ex: 'QA', src: [] } } }],
  held: [], vc: { 'toyota-camry': 'm', 'tesla-model-y': 'l', 'honda-civic': 'e' }, rates: { CT: [130, 150, 1], TX: [100, 120, 1] }, nat: [120, 160], states: [['CT', 'Connecticut'], ['TX', 'Texas']], rsrc: [] };
const over = { '/price-est.js': 'window.EST=' + JSON.stringify(FIX) + ';' };
async function quote(p, amount) { const b = qaBtn(p); if (!b) return null; b.click(); const a = p.d.getElementById('pcAmt'); a.value = String(amount); ev(p, a, 'input'); p.d.getElementById('pcGo').click(); await wait(20); return txt(p, 'pcOut'); }

(async () => {
  // --- production data (real dist/price-est.js) ---
  for (const term of ['spark plug', 'spark plugs', 'plugs']) {
    const p = await pc('?v=tesla-model-y&y=2023'); const s = await search(p, term);
    check('QA-PRC-TY-PROD "' + term + '"', '2023 Model Y, production data: no spark-plug button, no $ figure, no verdict', sparkBtns(p).length === 0 && dollars(s).length === 0 && txt(p, 'pcOut').trim() === '', 'sug=' + s.slice(0, 260));
    if (term === 'spark plug') check('QA-PRC-TY-PROD-MSG', '2023 Model Y, production data: driver told spark plugs "does not apply" to a battery-electric vehicle', /does not apply/i.test(s), 'sug=' + s.slice(0, 300));
  }
  // --- QA fixture data ---
  {
    const p = await pc('?v=tesla-model-y&y=2023', { over }); const s = await search(p, 'spark plug');
    check('QA-PRC-TY-FIX', '2023 Model Y (fixture with a spark-plug estimate): not offered, says does not apply to battery-electric', sparkBtns(p).length === 0 && /does not apply to a battery-electric/i.test(s) && dollars(s).length === 0, s.slice(0, 240));
    const go = p.d.getElementById('pcGo'); check('QA-PRC-TY-GO', 'Get-verdict button stays disabled for Model Y (no job selectable)', go.disabled, 'disabled=' + go.disabled);
  }
  {
    const p = await pc('?v=toyota-camry&y=2015', { over }); await search(p, 'spark plug');
    const o = await quote(p, 300);
    check('QA-PRC-GAS', '2015 Camry (gasoline) with fixture: spark plug offered and gets a verdict', o && /typical/i.test(o), String(o).slice(0, 160));
    { const p2 = await pc('?v=toyota-camry&y=2015', { over }); await search(p2, 'spark plug'); const ob = [...p2.d.querySelectorAll('#pcSug button')].find(b => /Routine maintenance/.test(b.textContent)); let o2 = '';
      if (ob) { ob.click(); const a2 = p2.d.getElementById('pcAmt'); a2.value = '300'; ev(p2, a2, 'input'); p2.d.getElementById('pcGo').click(); await wait(20); o2 = txt(p2, 'pcOut'); }
      check('QA-PRC-GAS-OWN', '2015 Camry own (withheld) spark plug job: offered, result says Insufficient verified pricing, no range/verdict', ob && /Insufficient verified pricing/.test(o2) && !/typical/i.test(o2.replace(/Insufficient[^.]*/,'')) && dollars(o2).every(x => x === '$300'), o2.slice(0, 200)); }
    const st = p.d.getElementById('pcSt'); st.value = 'TX'; ev(p, st, 'change');
    check('QA-PRC-CLR-STATE', 'verdict clears when state changes', txt(p, 'pcOut').trim() === '', txt(p, 'pcOut').slice(0, 80));
    p.d.getElementById('pcGo').click(); await wait(10);
    check('QA-PRC-REQUOTE', 'requote after state change produces a verdict again', /typical/i.test(txt(p, 'pcOut')), txt(p, 'pcOut').slice(0, 80));
    const a = p.d.getElementById('pcAmt'); a.value = '1200'; ev(p, a, 'input');
    check('QA-PRC-CLR-AMT', 'verdict clears when amount changes', txt(p, 'pcOut').trim() === '', txt(p, 'pcOut').slice(0, 80));
    p.d.getElementById('pcGo').click(); await wait(10);
    const cls = p.d.getElementById('pcCls'); cls.value = 'truck'; ev(p, cls, 'change');
    check('QA-PRC-CLR-CLASS', 'verdict clears when kind of vehicle changes', txt(p, 'pcOut').trim() === '', txt(p, 'pcOut').slice(0, 80));
    p.d.getElementById('pcGo').click(); await wait(10);
    const y = p.d.getElementById('pcY'); y.value = '2016'; ev(p, y, 'change'); await wait(50);
    check('QA-PRC-CLR-YEAR', 'verdict clears when the vehicle year changes', txt(p, 'pcOut').trim() === '', txt(p, 'pcOut').slice(0, 80));
  }
  {
    // Change vehicle from Camry to Tesla Model Y after a verdict: verdict and job must clear, and spark plugs must no longer be offered
    const p = await pc('?v=toyota-camry&y=2023', { over }); await search(p, 'spark plug'); const o = await quote(p, 300);
    const y = p.d.getElementById('pcY'), m = p.d.getElementById('pcM'), mo = p.d.getElementById('pcMo');
    y.value = '2023'; ev(p, y, 'change'); m.value = 'Tesla'; ev(p, m, 'change'); mo.value = 'tesla-model-y'; ev(p, mo, 'change'); await wait(80);
    const outNow = txt(p, 'pcOut').trim(); const s = await search(p, 'spark plug');
    check('QA-PRC-CLR-VEH', 'switching vehicle Camry -> 2023 Model Y clears verdict and spark plugs become "does not apply"', o && /typical/i.test(o) && outNow === '' && sparkBtns(p).length === 0 && /does not apply/i.test(s), 'before=' + String(o).slice(0, 40) + ' after="' + outNow.slice(0, 40) + '" sug=' + s.slice(0, 120));
  }
  // --- vehicle pages: rendered price areas ---
  for (const r of ['/vehicles/tesla-model-y/2023/', '/vehicles/toyota-camry/2015/', '/vehicles/acura-ilx/2016/', '/vehicles/acura-cl/1999/']) {
    const p = open(r, {}); await p.ready; await wait(400);
    const vv = p.d.getElementById('vehicleView'); const h = vv ? vv.textContent : '';
    const spark = /spark plug/i.test(h) && r.includes('tesla');
    const ds = [...new Set(dollars(h))];
    check('QA-PRC-VPAGE ' + r, 'rendered vehicle view has no dollar figures' + (r.includes('tesla') ? ' and no spark plug job' : ''), ds.length === 0 && !spark, 'dollars=' + ds.slice(0, 8).join(' ') + (spark ? ' SPARK PLUG MENTIONED' : ''));
  }
  fs.writeFileSync(path.join(__dirname, 'qa-pricing.json'), JSON.stringify(out, null, 1));
  console.log(out.filter(x => x.pass).length + '/' + out.length + ' passed'); process.exit(0);
})();
