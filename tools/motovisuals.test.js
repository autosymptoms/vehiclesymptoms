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

test('guides offer verified playback and keep an overview distinct from a part', () => {
  const lib = createLibrary();
  assert.equal(lib.guide.get('grinding-brakes').title,'Brake Pads');
  assert.equal(lib.guide.get('humming-noise-at-speed').title,'Suspension System');
  assert.match(lib.contextual(lib.guide.get('humming-noise-at-speed')), /Vehicle system overview · Suspension System/);
  assert.equal(lib.guide.get('brakes-dragging').title,'Brake System');
  assert.equal(lib.guide.get('overheats-only-in-traffic').title,'Cooling System');
  assert.match(lib.contextual(lib.guide.get('overheats-only-in-traffic')), /Vehicle system overview · Cooling System/);
  assert.equal(lib.guide.has('clutch-slipping'),false);
  assert.equal(lib.forText('Front wheel bearings growl'),undefined);
  assert.equal(lib.forText('Throwout bearing noise'),undefined);
  assert.equal(lib.forText('Parking brake module'),undefined);
  assert.equal(lib.forText('Worn brake pads').title,'Brake Pads');
});

test('public directory exposes only playable videos across search, deep links and browser history', async () => {
  const { html, data } = createLibrary().directory();
  const dom = new JSDOM(html + '<script type="application/json" id="mv-data">' + JSON.stringify(data) + '</script>', {
    runScripts:'outside-only', url:'https://www.vehiclesymptoms.com/repair-animations/?animation=narrated%3A908518'
  });
  const w = dom.window, d = w.document;
  try {
    w.HTMLElement.prototype.scrollIntoView = function() {};
    w.eval(fs.readFileSync(require.resolve('../src/animations/browser.js'),'utf8'));
    assert.equal(d.querySelectorAll('details,select').length,0);
    const content = d.getElementById('mv-content');
    const search = d.getElementById('mv-search');
    assert.equal(d.querySelectorAll('#mv-groups [data-mv-id]').length,data.items.length);
    assert.equal(data.items.length,23);
    assert.equal(data.items.filter(i => i.url).length,3);
    assert.equal(data.items.filter(i => i.menuLabel).length,21);
    assert.ok(data.items.every(i => i.url || i.menuLabel));
    assert.equal(d.querySelectorAll('#mv-groups a[data-mv-id]').length,23);
    assert.doesNotMatch(html,/catalog.only|Wheel Bearing/i);
    assert.equal(w.location.search,'');
    assert.equal(d.getElementById('mv-viewer').hidden,true);
    assert.equal(content.querySelector('iframe'),null);
    assert.equal(d.getElementById('mv-count').textContent,'23 videos');
    search.value = 'wheel bearings'; search.dispatchEvent(new w.Event('input'));
    assert.equal(d.querySelectorAll('.mv-group:not([hidden]) li:not([hidden])').length,0);
    search.value = 'brake pads'; search.dispatchEvent(new w.Event('input'));
    assert.equal(d.getElementById('mv-count').textContent,'1 video');
    search.value=''; search.dispatchEvent(new w.Event('input'));
    d.querySelector('a[data-mv-id="narrated:902541"]').click();
    assert.equal(content.querySelector('iframe').title,'Brake Pads');
    assert.equal(content.querySelector('iframe').src,data.items.find(i=>i.id==='902541' && i.kind==='narrated').url);
    d.querySelector('a[data-mv-id="narrated:909201"]').click();
    assert.equal(content.querySelector('iframe').src,data.menu);
    assert.equal(d.getElementById('mv-title').textContent,'Spring Check');
    assert.match(content.textContent,/Choose Checks in the system menu/);
    const popped = new Promise(resolve => w.addEventListener('popstate',resolve,{once:true}));
    w.history.back(); await popped;
    assert.equal(content.querySelector('iframe').title,'Brake Pads');
    search.value='no such title exists'; search.dispatchEvent(new w.Event('input'));
    assert.ok(d.getElementById('mv-count').textContent.startsWith('No matching'));
  } finally { w.close(); }
});
