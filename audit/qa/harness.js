// Independent QA harness (does not reuse tools/regression.js). Loads dist pages in jsdom with a ResourceLoader
// that serves the real /*.js files from dist, and a stubbed fetch for NHTSA + /data/v/*.json.
const fs = require('fs'), path = require('path');
const { JSDOM, ResourceLoader, VirtualConsole } = require(path.join(__dirname, '../../node_modules/jsdom'));
const DIST = path.join(__dirname, '../../dist');
class DistLoader extends ResourceLoader {
  constructor(over) { super(); this.over = over || {}; }
  fetch(url) {
    const u = new URL(url);
    if (this.over[u.pathname] !== undefined) return Promise.resolve(Buffer.from(this.over[u.pathname]));
    if (u.pathname.startsWith('/_vercel')) return Promise.resolve(Buffer.from(''));
    const f = path.join(DIST, u.pathname);
    return Promise.resolve(fs.existsSync(f) ? fs.readFileSync(f) : Buffer.from(''));
  }
}
function open(route, { nhtsa, qs = '', over, fastTimers = false, ls } = {}) {
  const html = fs.readFileSync(path.join(DIST, route, 'index.html'), 'utf8');
  const calls = []; const errors = [];
  const vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(String(e && e.message || e)));
  const dom = new JSDOM(html, {
    url: 'https://www.vehiclesymptoms.com' + route + qs, runScripts: 'dangerously', resources: new DistLoader(over), pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      w.HTMLElement.prototype.scrollIntoView = function () {}; w.scrollTo = () => {};
      if (ls) for (const [k, v] of Object.entries(ls)) w.localStorage.setItem(k, v);
      if (fastTimers) { const st = w.setTimeout.bind(w); w.setTimeout = (fn, ms, ...a) => st(fn, ms >= 10000 ? 5 : ms, ...a); }
      w.fetch = (u, o) => {
        u = String(u); calls.push(u);
        const m = u.match(/\/data\/v\/([a-z0-9-]+)\.json/);
        if (m) { const f = path.join(DIST, 'data/v', m[1] + '.json'); return Promise.resolve({ ok: true, status: 200, json: async () => JSON.parse(fs.readFileSync(f, 'utf8')) }); }
        if (/api\.nhtsa\.gov/.test(u) && nhtsa) return nhtsa(new URL(u).searchParams, o);
        return new Promise(() => {});
      };
    }
  });
  const ready = new Promise(r => dom.window.addEventListener('load', r));
  return { dom, w: dom.window, d: dom.window.document, calls, errors, ready };
}
const wait = ms => new Promise(r => setTimeout(r, ms));
const out = [];
function check(id, desc, pass, evidence) { out.push({ id, desc, pass: !!pass, evidence: String(evidence || '').slice(0, 400) }); console.log((pass ? 'PASS ' : 'FAIL ') + id + ' ' + desc + (pass ? '' : ' :: ' + String(evidence).slice(0, 300))); }
module.exports = { open, wait, check, out, DIST };
