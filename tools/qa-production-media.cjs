'use strict';
// Run from the release checkout after npm ci and npm run build. Reads production; writes nothing.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const { pathToFileURL } = require('node:url');
const fromRoot = createRequire(path.resolve('package.json'));
const { JSDOM } = fromRoot('jsdom');
const origin = 'https://www.vehiclesymptoms.com';
const siteOrigins = [origin, 'https://vehiclesymptoms.com'];
const dist = path.resolve('dist');
const config = fromRoot('./src/animations/config.json');
const approved = [config.menu, ...Object.values(config.individual)].filter(Boolean);
const routes = ['/', '/sounds/', '/repair-animations/', '/price-check/', '/symptoms/',
  '/symptoms/grinding-brakes/', '/symptoms/clicking-when-turning/', '/symptoms/humming-noise-at-speed/',
  '/vehicles/', '/vehicles/toyota-camry/2017/', '/codes/p0300/', '/about/'];
const failures = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const normalized = text => String(text || '').replace(/\s+/g, ' ').trim();
const localHtml = route => fs.readFileSync(path.join(dist, route.slice(1), 'index.html'), 'utf8');
const evidence = new Map();

async function check(label, test) {
  try { const result = await test(); console.log('PASS', label, result || ''); }
  catch (e) { const message = label + ' — ' + e.message; failures.push(message); console.error('FAIL', message); }
}

async function fetchProduction(input) {
  const url = new URL(input, origin);
  assert.equal(url.origin, origin);
  const r = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(30000) });
  assert.equal(r.status, 200, url.pathname + ' status: ' + r.status);
  return r;
}

// Self-contained so these same checks can also inspect the live browser DOM.
function inspectPage(root, base, allowed, knownFrames) {
  const errors = [];
  function visit(tree) {
    for (const el of tree.querySelectorAll('a,area,base,form,button[formaction],input[formaction],object,embed,iframe,meta[http-equiv],template')) {
      const tag = el.localName;
      if (tag === 'template') { visit(el.content); continue; }
      if (tag === 'iframe') {
        const tokens = (el.getAttribute('sandbox') || '').trim().split(/\s+/).sort().join(' ');
        if (tokens !== 'allow-same-origin allow-scripts' || el.hasAttribute('srcdoc')) errors.push('unsafe iframe sandbox or srcdoc');
      }
      let attr = ({a:'href',area:'href',base:'href',form:'action',button:'formaction',input:'formaction',object:'data',embed:'src',iframe:'src'})[tag];
      let value = attr && el.getAttribute(attr);
      if (tag === 'meta' && (el.httpEquiv || '').toLowerCase() === 'refresh') {
        const content = el.getAttribute('content') || '';
        value = content.match(/^[\d.\s]+[;,]\s*(?:url\s*=\s*)?(.+)$/i)?.[1].trim().replace(/^['"]|['"]$/g, '');
      }
      if (!value) continue;
      try {
        const u = new URL(value, base);
        if (!allowed.includes(u.origin) && !(tag === 'iframe' && knownFrames.includes(u.href))) errors.push(tag + ' to ' + (u.host || u.protocol));
      } catch { errors.push(tag + ' has an invalid URL'); }
    }
  }
  visit(root); return errors;
}

function getAsset(doc, tag, pattern, base) {
  return [...doc.querySelectorAll(tag)].map(e => e.getAttribute('src')).filter(Boolean)
    .map(s => new URL(s, base)).find(u => pattern.test(u.pathname));
}

async function liveRoute(route) {
  const response = await fetchProduction(route);
  assert.match(response.headers.get('content-type') || '', /text\/html/i);
  const url = origin + route;
  const local = new JSDOM(localHtml(route), {url});
  const live = new JSDOM(await response.text(), {url});
  try {
    const l = local.window.document, d = live.window.document;
    const headline = normalized(d.querySelector('h1')?.textContent);
    assert(headline, 'no h1'); assert.equal(headline, normalized(l.querySelector('h1')?.textContent));
    assert.deepEqual(inspectPage(d, url, siteOrigins, approved), []);
    for (const [key, tag, pattern] of [
      ['app','script[src]',/\/app(?:\.[a-z\d_-]+)?\.js$/i],
      ['repair-animations','script[src]',/\/repair-animations(?:\.[a-z\d_-]+)?\.js$/i],
      ['audio','audio[src],audio source[src]',/\.mp3$/i]
    ]) {
      const expected = getAsset(l, tag, pattern, url);
      if (!expected) continue;
      const actual = getAsset(d, tag, pattern, url);
      assert(actual, key + ' missing'); assert.equal(actual.href, expected.href);
      evidence.set(key, expected);
    }
    return headline;
  } finally { live.window.close(); local.window.close(); }
}

async function sitemap() {
  const res = await fetchProduction('/sitemap.xml');
  const dom = new JSDOM(await res.text(), { contentType: 'application/xml' });
  try {
    const d = dom.window.document;
    assert(['urlset','sitemapindex'].includes(d.documentElement.localName), 'invalid XML root');
    const locs = [...d.getElementsByTagName('loc')].map(e => new URL(e.textContent.trim()));
    assert(locs.length > 0); assert(locs.every(u => siteOrigins.includes(u.origin)), 'off-site location');
    return locs.length + ' sitemap entries';
  } finally { dom.window.close(); }
}

async function asset(key) {
  const url = evidence.get(key);
  assert(url, key + ' not referenced by the local and production pages');
  const local = fs.readFileSync(path.join(dist, decodeURIComponent(url.pathname.slice(1))));
  const r = await fetchProduction(url);
  const live = Buffer.from(await r.arrayBuffer());
  assert(local.length > 0); assert.equal(hash(live), hash(local), 'served file differs from checked-out build');
  return url.pathname + ' sha256=' + hash(live);
}

async function clock(media) {
  const initial = await media.evaluate(v => ({time:v.currentTime, source:v.currentSrc}));
  const until = Date.now() + 15000;
  while (Date.now() < until) {
    const v = await media.evaluate(el => ({time:el.currentTime, ready:el.readyState, paused:el.paused,
      duration:el.duration, source:el.currentSrc, error:el.error?.code || 0}));
    assert(!v.error, 'media error ' + v.error);
    if (v.source && (!initial.source || v.source === initial.source) && !v.paused && v.ready >= 2 &&
      Number.isFinite(v.duration) && v.time > initial.time + 0.45) {
      return 'advanced ' + initial.time.toFixed(2) + ' to ' + v.time.toFixed(2) + 's';
    }
    await sleep(220);
  }
  throw new Error('media clock did not advance');
}

function descendants(frame) { return [frame, ...frame.childFrames().flatMap(descendants)]; }

async function control(root, selector, exactText, timeout=18000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    for (const frame of descendants(root)) {
      try {
        for (const handle of await frame.$$(selector)) {
          if (await handle.isVisible() && (exactText === null || normalized(await handle.evaluate(e => e.textContent)) === exactText)) return handle;
          await handle.dispose();
        }
      } catch (e) { if (!/detached|context was destroyed|Cannot find context/i.test(e.message)) throw e; }
    }
    await sleep(180);
  }
  throw new Error('player control not visible: ' + (exactText || selector));
}

async function main() {
  for (const route of routes) await check('route ' + route, () => liveRoute(route));
  await check('sitemap', sitemap);
  for (const key of ['app','repair-animations','audio']) await check('asset ' + key, () => asset(key));
  const module = await import(pathToFileURL(fromRoot.resolve('puppeteer-core')).href);
  const puppeteer = module.default || module;
  const chrome = [process.env.CHROME_PATH, '/usr/bin/google-chrome-stable','/usr/bin/google-chrome','/usr/bin/chromium'].find(p => p && fs.existsSync(p));
  assert(chrome, 'Google Chrome missing');
  const browser = await puppeteer.launch({executablePath:chrome, headless:true, args:['--no-sandbox','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required']});
  try {
    const page = await browser.newPage();
    const exits = [];
    page.on('popup', popup => { exits.push('popup'); if (popup) void popup.close().catch(() => {}); });
    page.on('framenavigated', frame => {
      if (frame === page.mainFrame() && frame.url() && frame.url() !== 'about:blank' && new URL(frame.url()).origin !== origin) exits.push('off-site top navigation: ' + frame.url());
    });
    page.setDefaultTimeout(22000);
    for (const route of routes) await check('browser navigation ' + route, async () => {
      await page.goto(origin + route, {waitUntil:'load', timeout:35000});
      const doc = await page.evaluateHandle(() => document);
      try { assert.deepEqual(await page.evaluate(inspectPage, doc, page.url(), siteOrigins, approved), []); }
      finally { await doc.dispose(); }
      assert.equal(new URL(page.url()).pathname, route);
    });
    await check('on-site audio playback', async () => {
      await page.goto(origin+'/sounds/', {waitUntil:'domcontentloaded'});
      const el = await page.waitForSelector('audio', {visible:true});
      const src = await el.evaluate(v => new URL(v.currentSrc || v.getAttribute('src') || v.querySelector('source').src, location.href).href);
      assert.equal(src, evidence.get('audio')?.href);
      await el.evaluate(async v => {
        let timer; try { await Promise.race([v.play(), new Promise((_,reject) => {
          timer = setTimeout(() => reject(new Error('Audio did not start')), 15000);
        })]); } finally { clearTimeout(timer); }
      });
      return clock(el);
    });
    await page.goto(origin+'/repair-animations/', {waitUntil:'domcontentloaded'});
    await page.waitForSelector('#mv-search:not([disabled])');
    const doc = new JSDOM(localHtml('/repair-animations/'));
    const expected = [...doc.window.document.querySelectorAll('#mv-directory a[data-mv-id]')].map(a => [a.dataset.mvId, normalized(a.textContent)]);
    doc.window.close();
    const menu = await page.$$eval('#mv-directory a[data-mv-id]', as => as.map(a => [a.dataset.mvId,a.textContent.trim().replace(/\s+/g,' ')]));
    assert.equal(expected.length, 23); assert.equal(new Set(menu.map(x => x[0])).size, 23); assert.deepEqual(menu, expected);
    for (const [id,title] of menu) await check('animation ' + title, async () => {
      assert(/^[\w:-]+$/.test(id));
      await page.goto(origin+'/repair-animations/', {waitUntil:'domcontentloaded'});
      await page.waitForSelector('#mv-search:not([disabled])');
      const token = crypto.randomUUID();
      await page.evaluate(t => { document.documentElement.dataset.productionQa=t; }, token);
      const selector = '#mv-directory a[data-mv-id="'+id+'"]';
      const link = await page.waitForSelector(selector, {visible:true});
      const selected = await link.evaluate(a => a.href);
      assert.equal(new URL(selected).origin, origin);
      const aim=await link.evaluate(async a => {
        a.scrollIntoView({behavior:'instant',block:'center'});
        await new Promise(requestAnimationFrame);
        const r=a.getBoundingClientRect(), x=r.x+r.width/2, y=r.y+r.height/2;
        return {x,y,hit:a.contains(document.elementFromPoint(x,y))};
      });
      assert(aim.hit,'directory choice is covered');
      await page.mouse.click(aim.x,aim.y);
      await page.waitForFunction(wanted => location.href===wanted, {timeout:5000}, selected)
        .catch(() => {throw new Error('directory selection did not navigate to '+selected+'; current '+page.url());});
      const heading=await page.$eval('#mv-title',e=>e.textContent.trim()); assert.equal(heading,title,'selected heading');
      const el = await page.waitForSelector('#mv-content iframe', {visible:true, timeout:8000});
      await el.evaluate(e=>e.scrollIntoView({behavior:'instant',block:'center'}));
      assert.deepEqual(await el.evaluate(e=>[...e.sandbox].sort()),['allow-same-origin','allow-scripts']);
      assert(approved.includes(await el.evaluate(e=>e.src)),'unapproved player');
      const frame=await el.contentFrame(); assert(frame,'no embedded frame');
      const hint=await page.$eval('#mv-content',e=>e.querySelector('.mv-hint')?.textContent.trim()||'');
      const label=hint ? hint.match(/^Choose (.+) in the system menu\.$/)?.[1] : null;
      if(hint)assert(label,'unrecognized menu cue');
      const button=await control(frame,label?'a':'.StartSplashDefaultPlayButton',label);
      await button.evaluate(e=>e.click());
      const video=await control(frame,'video',null);
      const advanced=await clock(video);
      assert.equal(await page.evaluate(()=>document.documentElement.dataset.productionQa),token,'outer document replaced');
      assert.equal(page.url(),selected);assert.deepEqual(exits,[]);
      return advanced;
    });
    await check('page containment', async () => { assert.deepEqual(exits, []); assert.equal((await browser.pages()).length <= 2, true, 'unexpected browser tab'); });
  } finally { await browser.close(); }
  if (failures.length) throw new Error(failures.length + ' production check(s) failed');
}
main().catch(error => { console.error(error); process.exitCode=1; });
