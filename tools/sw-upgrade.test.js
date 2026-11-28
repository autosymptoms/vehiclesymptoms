// Simulates an offline-app upgrade on a phone that already has an older version saved.
// Checks that a failed refresh never copies the older page into the new version's cache,
// that a successful refresh replaces it, and that old caches go only after the new one is ready.
// Runs on src/sw.js directly with mocked fetch and caches, so it does not need a build.
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const vm = require('node:vm');

const CORE = ['/', '/offline/', '/site.css'];
const PAGES = ['/warning-lights/', '/warning-lights/oil-pressure-light/', '/symptoms/engine-overheating/', '/symptoms/gas-smell/'];
const ORIGIN = 'https://www.vehiclesymptoms.com';
const src = readFileSync(join(__dirname, '..', 'src', 'sw.js'), 'utf8')
  .replace('__BUILD_ID__', 'new').replace('__CORE__', JSON.stringify(CORE)).replace('__PAGES__', JSON.stringify(PAGES));

const key = u => new URL(typeof u === 'string' ? u : u.url, ORIGIN).pathname;
const res = (body, extra = {}) => ({status: 200, ok: true, type: 'basic', redirected: false, body, ...extra});

// Each test gets its own phone: caches left by the old version, and a network that answers per URL.
function phone(network) {
  const store = new Map();
  const open = name => {
    if (!store.has(name)) store.set(name, new Map());
    const c = store.get(name);
    return {
      match: async u => c.get(key(u)),
      put: async (u, r) => { c.set(key(u), r); },
      addAll: async list => { for (const u of list) { const r = await fetchMock(u); if (!r.ok) throw new TypeError('addAll failed'); c.set(key(u), r); } },
      keys: async () => [...c.keys()].map(p => ({url: ORIGIN + p})),
      delete: async u => c.delete(key(u)),
    };
  };
  const fetchMock = async u => {
    const answer = network[key(u)];
    if (answer === undefined || answer === 'offline') throw new TypeError('Failed to fetch');
    return answer;
  };
  const caches = {
    open: async name => open(name),
    keys: async () => [...store.keys()],
    delete: async name => store.delete(name),
    match: async u => { for (const c of store.values()) if (c.has(key(u))) return c.get(key(u)); },
  };
  const listeners = {};
  const self = {
    location: new URL(ORIGIN + '/'),
    addEventListener: (type, fn) => { listeners[type] = fn; },
    skipWaiting: async () => {},
    clients: {claim: async () => {}},
  };
  vm.runInNewContext(src, {self, caches, fetch: fetchMock, Request: class { constructor(u) { this.url = ORIGIN + u; } },
    URL, Set, Promise, Headers, Response, setTimeout});
  const fire = type => new Promise((resolve, reject) => listeners[type]({waitUntil: p => p.then(resolve, reject)}));
  return {store, open, fire};
}

function seedOldVersion(p) {
  const core = p.open('vs-core-old'), pages = p.open('vs-pages-old');
  for (const u of CORE) core.put(u, res('old ' + u));
  for (const u of PAGES) pages.put(u, res('old ' + u));
}

const goodNetwork = () => Object.fromEntries([...CORE, ...PAGES].map(u => [u, res('new ' + u)]));

(async () => {
  // 1. Upgrade where some refreshes fail in different ways.
  {
    const net = goodNetwork();
    net['/warning-lights/oil-pressure-light/'] = 'offline';                                    // connection dropped
    net['/symptoms/engine-overheating/'] = res('error page', {status: 503, ok: false});        // server error
    net['/symptoms/gas-smell/'] = res('', {status: 0, ok: false, type: 'opaque'});             // opaque
    const p = phone(net);
    seedOldVersion(p);
    await p.fire('install');
    const fresh = p.store.get('vs-pages-new');
    assert.equal(fresh.get('/warning-lights/').body, 'new /warning-lights/', 'a successful refresh replaces the old page');
    for (const u of ['/warning-lights/oil-pressure-light/', '/symptoms/engine-overheating/', '/symptoms/gas-smell/'])
      assert.equal(fresh.has(u), false, u + ': a failed refresh must leave the page out, not copy the old one forward');
    for (const r of fresh.values()) assert.ok(!String(r.body).startsWith('old '), 'no old copy in the new cache');
    assert.ok(p.store.has('vs-pages-old') && p.store.has('vs-core-old'), 'old caches are kept while the new version installs');
    await p.fire('activate');
    assert.deepEqual([...p.store.keys()].sort(), ['vs-core-new', 'vs-pages-new', 'vs-runtime'], 'old caches deleted once the new one is ready');
    console.log('PASS failed refreshes (offline, 503, opaque) are left out; a successful refresh replaces the old page.');
  }

  // 2. Install interrupted while saving the core files: the old version stays untouched.
  {
    const net = goodNetwork();
    net['/site.css'] = 'offline';
    const p = phone(net);
    seedOldVersion(p);
    await assert.rejects(p.fire('install'), 'install must fail when core files cannot be saved');
    assert.equal(p.store.get('vs-pages-old').get('/warning-lights/').body, 'old /warning-lights/');
    assert.equal(p.store.get('vs-core-old').get('/site.css').body, 'old /site.css');
    console.log('PASS an interrupted install leaves the old version and its saved guides in place.');
  }

  // 3. Activate never deletes old caches if this version's core cache is incomplete.
  {
    const p = phone(goodNetwork());
    seedOldVersion(p);
    p.open('vs-core-new').put('/', res('new /'));
    await p.fire('activate');
    assert.ok(p.store.has('vs-pages-old') && p.store.has('vs-core-old'), 'old caches kept when the new one is not complete');
    console.log('PASS old caches are deleted only after the new cache is complete.');
  }

  // 4. A full, successful upgrade replaces every saved guide.
  {
    const p = phone(goodNetwork());
    seedOldVersion(p);
    await p.fire('install');
    await p.fire('activate');
    for (const u of PAGES) assert.equal(p.store.get('vs-pages-new').get(u).body, 'new ' + u);
    assert.equal(p.store.has('vs-pages-old'), false);
    console.log('PASS a full upgrade saves every guide fresh and removes the old copies.');
  }
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
