// Last-updated dates on guide and roadside pages, and accessibility basics on the homepage, a symptom guide and a
// vehicle year page. Runs on the built site: npm run build, then node tools/trust-a11y.test.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const dist = p => path.join(ROOT, 'dist', p);
const html = route => fs.readFileSync(dist(route + 'index.html'), 'utf8');
const doc = route => new JSDOM(html(route)).window.document;
const LM = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/lastmod.json'), 'utf8'));
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shown = d => { const [y, m, day] = d.split('-').map(Number); return `${MONTHS[m - 1]} ${day}, ${y}`; };
const pagesIn = dir => fs.readdirSync(dist(dir), { withFileTypes: true })
  .filter(e => e.isDirectory() && fs.existsSync(dist(dir + e.name + '/index.html'))).map(e => dir + e.name + '/');

const GUIDE = '/symptoms/grinding-brakes/';
const HOME = '/';
const YEAR = (() => {
  const v = fs.readdirSync(dist('vehicles'), { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort()
    .find(id => pagesIn('/vehicles/' + id + '/').some(p => /\/\d{4}\/$/.test(p)));
  return pagesIn('/vehicles/' + v + '/').find(p => /\/\d{4}\/$/.test(p));
})();

function checkDateLine(route, line) {
  const entry = LM[route];
  assert.ok(entry, 'no lastmod entry for ' + route);
  assert.ok(line, route + ' has no date line');
  assert.match(line.textContent, new RegExp('Last updated ' + shown(entry.d).replace(/ /g, '\\s')), route);
  assert.equal(line.querySelector('time').getAttribute('datetime'), entry.d, route);
}

test('symptom guides show their real lastmod date in the byline under the intro', () => {
  const guides = pagesIn('/symptoms/');
  assert.ok(guides.length > 50);
  for (const route of guides) {
    const d = doc(route);
    if (!d.getElementById('guideApp')) continue;
    const line = d.querySelector('.byline');
    checkDateLine(route, line);
    assert.equal(line.nextElementSibling.id, 'guideApp', route + ': date line sits right above the questions');
  }
});

test('roadside pages show their real lastmod date under the title', () => {
  const routes = ['/roadside/', ...pagesIn('/roadside/')];
  assert.ok(routes.length > 5);
  for (const route of routes) {
    const line = doc(route).querySelector('.ghead h1 + .byline');
    checkDateLine(route, line);
  }
});

test('no unfilled date marker is left in any built page', () => {
  for (const route of [HOME, GUIDE, '/roadside/', ...pagesIn('/roadside/'), ...pagesIn('/symptoms/')])
    assert.ok(!html(route).includes('<!--LASTMOD-->'), route);
});

test('guide result urgency is announced in words, not only by colour', () => {
  const guide = require('../src/journeys/grinding-brakes.json');
  const dom = new JSDOM('<main id="guideApp"></main>', { runScripts: 'outside-only', url: 'https://www.vehiclesymptoms.com' + GUIDE });
  const w = dom.window;
  w.JOURNEY = guide; w.VEHICLES = [];
  w.fetch = async () => ({ ok: true, json: async () => ({ enabled: false }) });
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.eval(fs.readFileSync(path.join(ROOT, 'src/guide.js'), 'utf8'));
  // Keep choosing the first answer until a result shows.
  for (let i = 0; i < 20 && w.document.querySelector('.opt'); i++) w.document.querySelector('.opt').click();
  const urg = w.document.getElementById('resultUrgency');
  assert.ok(urg, 'a result was reached');
  assert.match(urg.textContent, /^How urgent: \S/);
  assert.ok(urg.querySelector('.sr-only'));
  assert.equal(w.document.querySelector('.rt').getAttribute('aria-describedby'), 'resultUrgency');
  dom.window.close();
  // The full-guide list on the built page says the rating in words for each outcome.
  const summaries = [...doc(GUIDE).querySelectorAll('.fullguide summary')];
  assert.ok(summaries.length > 1);
  for (const s of summaries) assert.match(s.querySelector('.urg').textContent, /How urgent: \S/);
});

test('branching answers are real buttons with a visible keyboard focus style', () => {
  const opts = [...doc(GUIDE).querySelectorAll('#guideApp .opt')];
  assert.ok(opts.length >= 2);
  for (const o of opts) { assert.equal(o.tagName, 'BUTTON'); assert.ok(o.textContent.trim()); }
  const css = fs.readFileSync(dist('site.css'), 'utf8');
  assert.match(css, /\.opt:focus-visible[^{]*\{[^}]*outline:2px solid var\(--blue\)/);
  assert.match(css, /\.ans:focus-visible[^{]*\{[^}]*outline:2px solid var\(--blue\)/);
  // The :focus-visible rule must come after the rule that removes the outline on :focus.
  assert.ok(css.indexOf('.opt:focus-visible') > css.indexOf('.opt:hover,.opt:focus{'));
});

function labelled(d, el) {
  if (el.getAttribute('aria-label')?.trim() || el.getAttribute('aria-labelledby')) return true;
  if (el.closest('label')) return true;
  return !!(el.id && d.querySelector(`label[for="${el.id}"]`)?.textContent.trim());
}

test('form fields on the homepage, a guide and a vehicle year page have labels', () => {
  for (const route of [HOME, GUIDE, YEAR]) {
    const d = doc(route);
    for (const el of d.querySelectorAll('input:not([type=hidden]), select, textarea')) {
      if (el.getAttribute('aria-hidden') === 'true') continue; // honeypot
      assert.ok(labelled(d, el), `${route}: ${el.outerHTML.slice(0, 80)} has no label`);
    }
  }
  const h = doc(HOME);
  for (const id of ['helpInput', 'pickYear', 'pickMake', 'pickModel', 'vinInput']) assert.ok(h.getElementById(id), id);
});

test('roadside button and symptom chips have meaningful names', () => {
  const d = doc(HOME);
  const cta = d.querySelector('.rs-cta');
  assert.ok(cta);
  assert.match(cta.textContent, /Stuck on the road or something feels dangerous\?/);
  const chips = [...d.querySelectorAll('.shortcuts .sc')];
  assert.ok(chips.length >= 5);
  for (const c of chips) assert.ok(c.textContent.trim().length > 3, c.outerHTML);
});

test('svg icons are hidden from screen readers or named', () => {
  for (const route of [HOME, GUIDE, YEAR]) {
    for (const svg of doc(route).querySelectorAll('svg')) {
      const hidden = svg.getAttribute('aria-hidden') === 'true';
      const named = svg.getAttribute('role') === 'img' && (svg.getAttribute('aria-label') || svg.querySelector('title'));
      assert.ok(hidden || named, `${route}: ${svg.outerHTML.slice(0, 120)}`);
    }
  }
  for (const pi of doc(HOME).querySelectorAll('.pain .pi')) assert.equal(pi.getAttribute('aria-hidden'), 'true');
});

test('live result areas are announced', () => {
  const h = doc(HOME);
  assert.equal(h.getElementById('helpStatus').getAttribute('role'), 'status');
  assert.equal(h.getElementById('vinOut').getAttribute('role'), 'status');
  const y = doc(YEAR);
  assert.equal(y.getElementById('vsumRec')?.getAttribute('role'), 'status', YEAR);
  assert.equal(fs.readFileSync(path.join(ROOT, 'src/guide.js'), 'utf8').includes('id="copied" class="muted" role="status"'), true);
});
