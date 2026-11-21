// QA: guide links as rendered in the built pages (jsdom, real dist scripts), not the matcher in isolation.
const { open, wait, check, out } = require('./harness');
const fs = require('fs'), path = require('path');
// Each issue card on a vehicle page: title + any "Walk through this symptom" link
async function cards(route) {
  const p = open(route, {}); await p.ready; await wait(500);
  const cs = [...p.d.querySelectorAll('#vehicleView .issue')].map(c => ({ t: (c.querySelector('h3') || {}).textContent || '', walk: [...c.querySelectorAll('a.walk')].map(a => new URL(a.href).pathname) }));
  return { p, cs };
}
// Guide page with a vehicle: click the first option until a result appears; return the vehicle section text and any errors
async function guide(id, v, y) {
  const p = open('/symptoms/' + id + '/', { qs: '?v=' + v + '&y=' + y }); await p.ready; await wait(400);
  for (let k = 0; k < 12; k++) { const o = p.d.querySelector('.opt:not(.unsure)') || p.d.querySelector('.opt'); if (!o) break; o.click(); await wait(30); }
  await wait(300);
  return { p, text: p.d.body.textContent, minis: [...p.d.querySelectorAll('.mini b')].map(b => b.textContent), errors: p.errors };
}
(async () => {
  // d1. 2024 Tesla Model 3 camera recall issue
  { const { cs } = await cards('/vehicles/tesla-model-3/2024/');
    const cam = cs.filter(c => /camera/i.test(c.t));
    check('QA-LNK-M3-render', '2024 Model 3 page renders the camera recall issue card', cam.length > 0, cs.map(c => c.t).join(' | ').slice(0, 300));
    check('QA-LNK-M3', '2024 Model 3 camera issue card has no delayed-engagement link', cam.length && cam.every(c => !c.walk.some(h => /delayed-engagement/.test(h))), JSON.stringify(cam));
    const anyDelay = cs.filter(c => c.walk.some(h => /delayed-engagement/.test(h)));
    check('QA-LNK-M3-any', 'no issue on 2024 Model 3 page links to delayed engagement', anyDelay.length === 0, JSON.stringify(anyDelay)); }
  { const g = await guide('delayed-engagement-into-gear', 'tesla-model-3', 2024);
    check('QA-LNK-M3-guide', 'delayed-engagement guide with 2024 Model 3 does not list the camera issue', !g.minis.some(t => /camera/i.test(t)) && !/Rearview camera image lost/.test(g.text), 'minis=' + JSON.stringify(g.minis) + ' errors=' + g.errors.join(';')); }
  // d2. Acura wiper issues
  for (const [id, y] of [['acura-rsx-integra', 2023], ['acura-tl', 2004], ['acura-tl', 2005]]) {
    const { cs } = await cards('/vehicles/' + id + '/' + y + '/');
    const wip = cs.filter(c => /wiper/i.test(c.t));
    check('QA-LNK-WIPER ' + id + ' ' + y, 'wiper issue rendered and has no pulls-to-one-side link', wip.length > 0 && wip.every(c => !c.walk.some(h => /car-pulls-to-one-side/.test(h))), JSON.stringify(wip));
    const g = await guide('car-pulls-to-one-side', id, y);
    check('QA-LNK-WIPER-guide ' + id + ' ' + y, 'pulls-to-one-side guide with this vehicle does not list the wiper issue', !g.minis.some(t => /wiper/i.test(t)) && !/Wipers stop|Windshield wipers stop/.test(g.text), 'minis=' + JSON.stringify(g.minis) + ' errors=' + g.errors.join(';'));
  }
  // d3. genuine delayed-shift issues still link
  for (const [id, y, re] of [['lincoln-aviator', 2004, /Delayed or harsh engagement into Reverse/i], ['ford-thunderbird', 2004, /Delayed or harsh engagement into reverse/i], ['lincoln-town-car', 2003, /Delay before Reverse engages/i]]) {
    const { cs } = await cards('/vehicles/' + id + '/' + y + '/');
    const hit = cs.filter(c => re.test(c.t));
    check('QA-LNK-DELAY ' + id + ' ' + y, 'genuine delayed-shift issue card links to the delayed-engagement guide', hit.length > 0 && hit.every(c => c.walk.some(h => h === '/symptoms/delayed-engagement-into-gear/')), JSON.stringify(hit));
    const g = await guide('delayed-engagement-into-gear', id, y);
    const listed = g.minis.some(t => re.test(t));
    check('QA-LNK-DELAY-guide ' + id + ' ' + y, 'delayed-engagement guide with this vehicle lists the genuine issue without a script error', listed && g.errors.length === 0, 'minis=' + JSON.stringify(g.minis) + ' errors=' + g.errors.slice(0, 2).join(';') + ' tail=' + (g.p.d.querySelector('#guideRoot, .guide-root, main') || g.p.d.body).textContent.replace(/\s+/g, ' ').slice(-200));
  }
  fs.writeFileSync(path.join(__dirname, 'qa-links.json'), JSON.stringify(out, null, 1));
  console.log(out.filter(x => x.pass).length + '/' + out.length + ' passed'); process.exit(0);
})();
