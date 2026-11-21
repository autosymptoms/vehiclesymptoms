const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const { JSDOM } = require('jsdom');
const { createLibrary, safeEmbed } = require('../src/animations/render');
const { catalogEntries } = require('./motovisuals-catalog');

test('only provider-issued website player endpoints can be rendered', () => {
  const config = require('../src/animations/config.json');
  assert.equal(new URL(safeEmbed(config.menu)).pathname, '/embed/embed_systems.php');
  for (const src of Object.values(config.individual)) assert.equal(safeEmbed(src), src);
  for (const u of ['https://example.com/embed/embed_single.php', config.menu + '&api_key=example',
    'https://technet.motovisuals.com/login.php?api_key=example']) assert.throws(() => safeEmbed(u));
  assert.equal(createLibrary({ menu: '', individual: {} }), null);
});

test('catalog import keeps labels for nested entries, deduplicates IDs and drops private fields', () => {
  const child = { part_id: '2', en_US: 'Brake Pads', description_en_US: 'private description' };
  const data = { root: { part_id:'1', en_US:'Brake System', children:{ child, duplicate:child } } };
  assert.deepEqual(catalogEntries(data,'narrated'), [
    { id:'1', title:'Brake System', system:'Brake System', kind:'narrated' },
    { id:'2', title:'Brake Pads', system:'Brake System', kind:'narrated' }
  ]);
  assert.throws(() => catalogEntries({ error:'Unavailable' },'narrated'));
});

test('topic matching separates named brake and wheel-bearing problems', () => {
  const lib = createLibrary();
  assert.equal(lib.guide.get('grinding-brakes').title,'Brake Pads');
  assert.equal(lib.guide.get('humming-noise-at-speed').title,'Wheel Bearing');
  assert.equal(lib.forText('Front wheel bearings growl').title,'Wheel Bearing');
  assert.equal(lib.forText('Throwout bearing noise'),undefined);
  assert.equal(lib.forText('Parking brake module').title,'Parking Brake');
});

test('directory search, direct players, menu fallback and browser back', async () => {
  const { html, data } = createLibrary().directory();
  const dom = new JSDOM(html + '<script type="application/json" id="mv-data">' + JSON.stringify(data) + '</script>', {
    runScripts:'outside-only', url:'https://www.vehiclesymptoms.com/repair-animations/'
  });
  const w = dom.window, d = w.document;
  try {
    w.HTMLElement.prototype.scrollIntoView = function() {};
    w.eval(fs.readFileSync(require.resolve('../src/animations/browser.js'),'utf8'));
    const content = d.getElementById('mv-content');
    const search = d.getElementById('mv-search'), format = d.getElementById('mv-format');
    assert.equal(content.querySelector('iframe'),null);
    search.value = 'wheel bearings'; search.dispatchEvent(new w.Event('input'));
    format.value = 'narrated'; format.dispatchEvent(new w.Event('change'));
    const visible = [...d.querySelectorAll('.mv-group:not([hidden]) li:not([hidden]) a')];
    const wheel = visible.find(a => a.textContent === 'Wheel Bearing');
    assert.ok(wheel);
    assert.ok(visible.every(a => a.dataset.mvId.startsWith('narrated:')));
    wheel.click();
    assert.equal(content.querySelector('iframe').title,'Wheel Bearing');
    assert.equal(content.querySelector('iframe').src, data.items.find(i => i.title === 'Wheel Bearing' && i.kind === 'narrated').url);
    const entry = data.items.find(i => !i.url);
    d.querySelector('[data-mv-id="' + entry.kind + ':' + entry.id + '"]').click();
    assert.equal(content.querySelector('iframe').src,data.menu);
    assert.ok(content.textContent.includes(entry.system));
    const popped = new Promise(resolve => w.addEventListener('popstate',resolve,{once:true}));
    w.history.back(); await popped;
    assert.equal(content.querySelector('iframe').title,'Wheel Bearing');
    search.value='no such title exists'; search.dispatchEvent(new w.Event('input'));
    assert.ok(d.getElementById('mv-count').textContent.startsWith('No matching'));
  } finally { w.close(); }
});
