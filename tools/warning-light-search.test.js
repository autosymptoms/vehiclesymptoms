// The /warning-lights/ search box, run against the built page with the production scripts.
// People describe symbols by shape ("oil can", "thermometer", "horseshoe"); every search must
// either show the right light or give a next step, never a bare "no match".
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {JSDOM} = require('jsdom');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'dist', 'warning-lights', 'index.html'), 'utf8')
  .replace(/<script[\s\S]*?<\/script>/g, '');
const dom = new JSDOM(html, {url: 'https://www.vehiclesymptoms.com/warning-lights/'});
const {window} = dom;
const {document, Option, localStorage} = window;
const location = {pathname: '/warning-lights/', hash: '', search: '', href: ''};
const journeys = fs.readdirSync(path.join(root, 'src', 'journeys')).filter(n => n.endsWith('.json'))
  .map(n => JSON.parse(fs.readFileSync(path.join(root, 'src', 'journeys', n), 'utf8')));
window.GUIDE_INDEX = journeys.map(j => ({id: j.id, title: j.title, h1: j.h1, group: j.group, syn: j.synonyms}));
window.VEHICLES = [];
window.HTMLElement.prototype.scrollIntoView = () => {};
const context = vm.createContext({window, document, Option, localStorage, location, URLSearchParams});
for (const name of ['guide', 'app']) vm.runInContext(fs.readFileSync(path.join(root, 'src', name + '.js'), 'utf8'), context);

const box = document.getElementById('lsearch');
function search(q) {
  box.value = q;
  box.dispatchEvent(new window.Event('input'));
  const shown = [...document.querySelectorAll('#lgrid .lcard')].filter(a => !a.hidden)
    .map(a => a.getAttribute('href').split('/')[2]);
  return {shown, none: document.getElementById('lnone')};
}

// Shape and nickname searches find the right light.
const expected = {
  'oil can': 'oil-pressure-light', 'red oil can light': 'oil-pressure-light', 'thermometer': 'engine-temperature-light',
  'thermometer in water': 'engine-temperature-light', 'temp light': 'engine-temperature-light', 'horseshoe': 'tire-pressure-light',
  'tpms': 'tire-pressure-light', 'red exclamation in a circle': 'brake-warning-light', 'battery': 'battery-light',
  'car with squiggly lines': 'traction-control-light', 'skid': 'traction-control-light', 'steering wheel': 'power-steering-light',
  'seatbelt': 'seat-belt-light', 'service engine soon': 'check-engine-light', 'engine': 'check-engine-light', 'handbrake': 'parking-brake-light',
  'emergency brake': 'parking-brake-light', 'srs': 'airbag-light', 'abs': 'abs-light', 'key': 'security-light', 'wrench': 'service-light',
  'gas pump': 'low-fuel-light', 'adblue': 'def-light', 'coil': 'glow-plug-light', 'triangle': 'master-warning-light', 'esc off': 'stability-control-off-light'
};
for (const [q, id] of Object.entries(expected)) {
  const r = search(q);
  assert.ok(r.shown.includes(id), `"${q}" should show ${id}, showed ${r.shown.join(', ') || 'nothing'}`);
  assert.ok(r.none.hidden, `"${q}" found lights, so no fallback`);
}

// Nothing matched: a next step is always shown, with the red-light rule and the color filters.
for (const q of ['purple unicorn', 'weird light', 'blinking thing near speedometer']) {
  const r = search(q);
  if (r.shown.length) continue;
  assert.equal(r.none.hidden, false, q);
  assert.match(r.none.textContent, /If the light is red, pull over/, q);
  assert.equal(r.none.querySelectorAll('button[data-c]').length, 3, q);
}
// A danger phrase with no matching symbol still shows the safety step.
const fire = search('smoke from dashboard');
assert.ok(fire.shown.length || fire.none.querySelector('.urgentnow'), 'smoke from dashboard');

// Clearing the box shows every light again.
assert.equal(search('').shown.length, document.querySelectorAll('#lgrid .lcard').length);

// The battery light (red badge) sits with the other red lights, ahead of amber ones.
const order = [...document.querySelectorAll('#lgrid .lcard')].map(a => a.getAttribute('href').split('/')[2]);
assert.ok(order.indexOf('battery-light') < order.indexOf('abs-light'), 'battery light before ABS');

console.log(`PASS warning-light search: ${Object.keys(expected).length} symbol descriptions found, no dead ends, battery light grouped with red lights.`);
