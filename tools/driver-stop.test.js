// Run after npm run build: node --test tools/driver-stop.test.js
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const path = require('node:path');
const {test} = require('node:test');
const {JSDOM} = require('jsdom');

const dist = path.join(__dirname, '..', 'dist');

function stopResult(guide, key) {
  const raw = readFileSync(path.join(dist, 'symptoms', guide, 'index.html'), 'utf8');
  const dom = new JSDOM(raw);
  try {
    const page = dom.window.document;
    const data = [...page.scripts].find(script => script.textContent.startsWith('window.JOURNEY='));
    const journey = JSON.parse(data.textContent.slice('window.JOURNEY='.length, -1));
    const result = journey.nodes[key].result;
    const record = [...page.querySelectorAll('.fullguide > details')].find(item =>
      item.querySelector('summary').firstChild.textContent === result.title);
    assert.equal(result.urgency, 'stop', guide+' / '+key);
    assert.match(record.querySelector('.urg.high').textContent, /stop/i);
    assert.ok(record.querySelector('.fg').textContent.includes(result.now));
    return [result.title, result.now, ...result.if, ...result.confirm.you].join('\n');
  } finally {
    dom.window.close();
  }
}

test('stop outcomes keep the driver parked for brake, steering and tire problems', () => {
  const held = [
    ['hard-brake-pedal', 'r_caliper'], ['hard-brake-pedal', 'r_fade'], ['hard-brake-pedal', 'r_new_brakes'],
    ['grinding-brakes', 'r_unsure_grind'], ['power-steering-warning-light', 'r_after_battery_heavy'],
    ['uneven-tire-wear', 'r_replace_soon']
  ];
  for (const [guide, key] of held) {
    const advice = stopResult(guide, key);
    assert.doesNotMatch(advice, /after a short drive|next few drives|test the brakes gently at low speed|try the slow lock-to-lock steering reset/i);
    assert.match(advice, /parked|tow|before driving|inspection|replace it before/i);
  }
});

test('engine knock and uncontrolled engine speed do not ask drivers to reproduce the fault', () => {
  const knock = stopResult('engine-knocking','r_rod_knock');
  assert.match(knock,/engine off/i);
  assert.doesNotMatch(knock,/record a short video with sound at idle|rev the engine to/i);
  const runaway = stopResult('car-wont-turn-off','r_diesel_runaway');
  assert.match(runaway,/away.*911/is);
  assert.doesNotMatch(runaway,/highest gear|release the clutch/i);
});

test('transmission overheating follows the specific vehicle instructions before another drive', () => {
  for (const key of ['r_temp_load','r_temp_no_load']) {
    const advice = stopResult('transmission-warning-light',key);
    assert.match(advice,/dashboard or in your owner's manual/i);
    assert.match(advice,/stay parked/i);
    assert.doesNotMatch(advice,/let it idle until the warning goes out|comes back on a normal drive/i);
  }
});

test('charging code pages lead with the stop condition, then explain a stored code alone', () => {
  for (const code of ['p0562','p0563','p0620','p0621','p0622']) {
    const dom = new JSDOM(readFileSync(path.join(dist, 'codes', code, 'index.html'), 'utf8'));
    try {
      const page = dom.window.document;
      const alert = page.querySelector('#vehicleView .urg-first');
      const badge = page.querySelector('#vehicleView .urg');
      assert.match(alert.textContent,/charging.system warning.*pull over/is);
      assert.ok(alert.compareDocumentPosition(badge) & dom.window.Node.DOCUMENT_POSITION_FOLLOWING);
      assert.match(badge.textContent,/otherwise/i);
      const schema = JSON.parse(page.querySelector('script[type="application/ld+json"]').textContent);
      const answer = schema.mainEntity.find(q => q.name.startsWith('Can I drive')).acceptedAnswer.text;
      assert.match(answer,/charging.system warning.*pull over.*otherwise.*stored code/is);
      assert.match(page.querySelector('meta[name="description"]').content,/charging.system warning/i);
    } finally {
      dom.window.close();
    }
  }
});
