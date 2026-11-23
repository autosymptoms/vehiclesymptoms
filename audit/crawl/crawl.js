#!/usr/bin/env node
// Static crawl of a built site directory (default: dist/).
// Usage: node audit/crawl/crawl.js [distDir] [outDir]
// Outputs (in outDir, default audit/crawl/):
//   routes.csv        one row per HTML route found in dist
//   broken-links.csv  every internal href/src that does not resolve to a dist file
//   reachability.csv  sitemap vs dist vs link-reachable-from-/ (BFS over <a href>)
//   duplicates.csv    duplicate titles / canonicals, canonical mismatches, H1 problems
//   stats.json        all counts used in SUMMARY.md
// Notes:
// - Static model: a route is 200 if dist/<route>/index.html (or the file) exists, else 404.
// - vercel.json trailingSlash:true => "/foo" (no extension) 308-redirects to "/foo/". Recorded as reason=redirect_no_trailing_slash
//   (not broken if the target exists; listed so internal links can point straight at the final URL).
// - Only <a href> inside the HTML counts as a crawlable link. Links that JS builds at runtime (home model grid,
//   year <select>, pickers) are NOT in the static HTML and are therefore not counted.
// - The template ships the home page block (#homeView) on every page, hidden with style="display:none".
//   Links/H1 inside that hidden block are tracked separately ("hidden_home").
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(process.argv[2] || 'dist');
const OUT = path.resolve(process.argv[3] || path.join(__dirname));
const SITE_HOSTS = new Set(['www.vehiclesymptoms.com', 'vehiclesymptoms.com']);
const ORIGIN = 'https://www.vehiclesymptoms.com';
// paths served by the platform, not by dist (see resolve())
const THIN_CHARS = 600; // visible main-content characters below which a page is flagged thin

fs.mkdirSync(OUT, { recursive: true });

// ---------- file inventory ----------
const files = new Set();
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p); else files.add('/' + path.relative(ROOT, p).split(path.sep).join('/'));
  }
})(ROOT);
const htmlFiles = [...files].filter(f => f.endsWith('.html')).sort();
const routeOf = f => f.endsWith('/index.html') ? f.slice(0, -'index.html'.length) : f; // "/a/b/index.html" -> "/a/b/"

// ---------- helpers ----------
const csv = v => { v = v == null ? '' : String(v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
const writeCsv = (name, header, rows) => fs.writeFileSync(path.join(OUT, name), [header.join(','), ...rows.map(r => r.map(csv).join(','))].join('\n') + '\n');
const decode = s => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
const text = h => decode(h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const attr = (tag, name) => { const m = tag.match(new RegExp('\\s' + name + '\\s*=\\s*("([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i')); return m ? decode(m[2] ?? m[3] ?? m[4] ?? '') : null; };

// Resolve an href against a page route. Returns {internal:false} for external/non-http,
// or {internal:true, path, status, reason, target} where target is the final route/file.
function resolve(href, fromRoute) {
  href = href.trim();
  if (!href || href.startsWith('#') || /^(mailto|tel|javascript|data|sms):/i.test(href)) return { internal: false, skip: true };
  let u;
  try { u = new URL(href, ORIGIN + fromRoute); } catch (e) { return { internal: true, path: href, status: 404, reason: 'unparseable_url' }; }
  if (!/^https?:$/.test(u.protocol) || !SITE_HOSTS.has(u.hostname)) return { internal: false };
  let p = decodeURI(u.pathname);
  const r = { internal: true, path: p, query: u.search };
  // Vercel injects /_vercel/* (Web Analytics, Speed Insights) at the edge; it is never in dist/. Not counted as broken.
  if (p.startsWith('/_vercel/')) return { ...r, skip: true, platform: true };
  if (p.endsWith('/')) {
    if (files.has(p + 'index.html')) return { ...r, status: 200, target: p };
    return { ...r, status: 404, reason: 'missing_index_html' };
  }
  if (files.has(p)) return { ...r, status: 200, target: p, asset: !p.endsWith('.html') };
  const ext = path.posix.extname(p);
  if (!ext || !/^\.[a-z0-9]{1,5}$/i.test(ext)) {
    if (files.has(p + '/index.html')) return { ...r, status: 308, target: p + '/', reason: 'redirect_no_trailing_slash' };
    return { ...r, status: 404, reason: 'missing_route' };
  }
  return { ...r, status: 404, reason: 'missing_file' };
}

function family(route) {
  const s = route.split('/').filter(Boolean);
  if (!s.length) return '/';
  if (route.endsWith('.html')) return route;
  if (s[0] === 'vehicles') return s.length === 2 ? '/vehicles/<id>/' : s.length === 3 && /^\d{4}$/.test(s[2]) ? '/vehicles/<id>/<year>/' : '/vehicles/' + (s.length > 1 ? '…' : '');
  if (s[0] === 'warning-lights') { if (s.length === 1) return '/warning-lights/'; if (s[1] === 'reset') return s.length === 2 ? '/warning-lights/reset/' : '/warning-lights/reset/<make>/'; return '/warning-lights/<id>/'; }
  if (s.length === 1) return '/' + s[0] + '/';
  return '/' + s[0] + '/<id>/';
}

// ---------- per-page extraction ----------
const pages = new Map(); // route -> record
const broken = [];
const rawLinks = new Map(); // route -> {all:[targets], visible:[targets]}
let assetRefs = 0;
for (const f of htmlFiles) {
  const route = routeOf(f);
  const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
  // JSON-LD
  const ld = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const ldTypes = []; let ldOk = true;
  for (const m of ld) {
    try {
      const j = JSON.parse(m[1]);
      const walk = o => { if (Array.isArray(o)) return o.forEach(walk); if (o && typeof o === 'object') { if (o['@type']) ldTypes.push(...[].concat(o['@type'])); if (o['@graph']) walk(o['@graph']); } };
      walk(j);
    } catch (e) { ldOk = false; }
  }
  // strip scripts/comments for link + text extraction
  const body = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  const title = (body.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [, ''])[1];
  let canonical = null, robots = null;
  for (const m of body.matchAll(/<link\b[^>]*>/gi)) if (/rel\s*=\s*["']?canonical/i.test(m[0])) canonical = attr(m[0], 'href');
  for (const m of body.matchAll(/<meta\b[^>]*>/gi)) { const n = (attr(m[0], 'name') || '').toLowerCase(); if (n === 'robots' || n === 'googlebot') robots = (robots ? robots + '; ' : '') + attr(m[0], 'content'); }
  // hidden #homeView block (shipped on every page by the template)
  let hidStart = -1, hidEnd = -1;
  const hv = body.match(/<div id="homeView"([^>]*)>/);
  if (hv && /display\s*:\s*none/i.test(hv[1])) { hidStart = hv.index; const vv = body.indexOf('<div id="vehicleView"'); hidEnd = vv > hidStart ? vv : body.length; }
  const isHidden = i => hidStart >= 0 && i >= hidStart && i < hidEnd;
  // H1s
  const h1s = [...body.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(m => ({ t: text(m[1]), hidden: isHidden(m.index) }));
  const visH1 = h1s.filter(h => !h.hidden);
  // main content = #vehicleView on inner pages, #homeView on home
  let main = '';
  const vvi = body.indexOf('<div id="vehicleView"');
  if (hidStart < 0 && hv) main = body.slice(hv.index, vvi > 0 ? vvi : undefined);
  else if (vvi >= 0) main = body.slice(vvi, (body.indexOf('</main>', vvi) + 1 || body.length + 1) - 1);
  else main = (body.match(/<main[\s\S]*?<\/main>/i) || [body])[0];
  const mainText = text(main);
  const thinReasons = [];
  if (mainText.length < THIN_CHARS) thinReasons.push('main_text<' + THIN_CHARS);
  if (/page not found|doesn't exist|does not exist|\b404\b/i.test(visH1.map(h => h.t).join(' ') + ' ' + mainText.slice(0, 400))) thinReasons.push('not_found_text');
  if (/haven't documented model-specific issues for this year/i.test(mainText)) thinReasons.push('no_documented_issues');
  // links
  const all = [], vis = []; let intN = 0, extN = 0, hidN = 0;
  for (const m of body.matchAll(/<(a|link|img|script|source|iframe)\b[^>]*>/gi)) {
    const tag = m[1].toLowerCase(); const a = tag === 'a' || tag === 'link' ? 'href' : 'src';
    const href = attr(m[0], a); if (href == null) continue;
    if (tag === 'link' && /rel\s*=\s*["']?(canonical|alternate|preconnect|dns-prefetch)/i.test(m[0])) continue;
    const r = resolve(href, route);
    if (r.skip) continue;
    if (!r.internal) { if (tag === 'a') extN++; continue; }
    if (tag !== 'a') assetRefs++;
    const hidden = isHidden(m.index);
    if (tag === 'a') { intN++; if (hidden) hidN++; }
    if (r.status === 404 || r.reason) broken.push([route, href, r.reason, tag, r.status, hidden ? 'hidden_home' : '']);
    if (tag === 'a' && r.target && !r.asset) { all.push(r.target); if (!hidden) vis.push(r.target); }
  }
  // <script src> refs were stripped with the script blocks above; check them from the raw HTML
  for (const m of html.matchAll(/<script\b[^>]*\ssrc\s*=[^>]*>/gi)) {
    const href = attr(m[0], 'src'); const r = resolve(href, route); if (r.skip || !r.internal) continue; assetRefs++;
    if (r.status === 404 || r.reason) broken.push([route, href, r.reason, 'script', r.status, '']);
  }
  rawLinks.set(route, { all, vis });
  // static <script src> for vehicles.js etc are fine; record runtime-only nav widgets
  const jsOnly = [];
  if (/<div id="mgrid"><\/div>/.test(body)) jsOnly.push('home_model_grid_empty');
  if (/<select id="vy"/.test(body)) jsOnly.push('year_select');
  if (/<select id="pickYear"/.test(body) && !isHidden(body.indexOf('<select id="pickYear"'))) jsOnly.push('ymm_picker');
  pages.set(route, {
    route, file: f, family: family(route), http_status: f === '/404.html' ? 404 : 200, canonical, canonical_self: canonical === ORIGIN + route,
    title: decode(title).trim(), h1_count: h1s.length, h1_visible_count: visH1.length, h1_text: visH1.map(h => h.t).join(' | ') || h1s.map(h => h.t).join(' | '),
    robots: robots || '', jsonld_types: [...new Set(ldTypes)].join('|'), jsonld_blocks: ld.length, jsonld_ok: ld.length ? ldOk : '',
    internal_links: intN, internal_links_hidden_home: hidN, unique_internal_targets: new Set(all).size, external_links: extN,
    main_text_chars: mainText.length, thin: thinReasons.length > 0, thin_reason: thinReasons.join('|'), js_only_nav: jsOnly.join('|'), bytes: Buffer.byteLength(html)
  });
}

// ---------- sitemap ----------
const sm = fs.readdirSync(ROOT).filter(f => /^sitemap-.+\.xml$/.test(f)).map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
const smUrls = [...sm.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(m => decode(m[1]));
const smRoutes = new Set(), smOffsite = [];
for (const u of smUrls) { try { const x = new URL(u); if (x.origin !== ORIGIN) smOffsite.push(u); smRoutes.add(x.pathname); } catch (e) { smOffsite.push(u); } }

// ---------- BFS from / ----------
function bfs(key) {
  const depth = new Map([['/', 0]]), q = ['/'];
  while (q.length) { const r = q.shift(); const L = rawLinks.get(r); if (!L) continue; for (const t of L[key]) if (!depth.has(t) && pages.has(t)) { depth.set(t, depth.get(r) + 1); q.push(t); } }
  return depth;
}
const dAll = bfs('all'), dVis = bfs('vis');
const inlinks = new Map();
for (const [r, L] of rawLinks) for (const t of new Set(L.all)) if (t !== r) inlinks.set(t, (inlinks.get(t) || 0) + 1);

const routes = [...pages.keys()].filter(r => r !== '/404.html');
const allRoutes = new Set([...routes, ...smRoutes]);
const reach = [...allRoutes].sort().map(r => [r, family(r), smRoutes.has(r), pages.has(r), dAll.has(r), dAll.get(r) ?? '', dVis.has(r), dVis.get(r) ?? '', inlinks.get(r) || 0]);
writeCsv('reachability.csv', ['route', 'family', 'in_sitemap', 'in_dist', 'reachable_any_a_href', 'depth_any', 'reachable_visible_a_href', 'depth_visible', 'pages_linking_in'], reach);

// ---------- routes.csv ----------
const cols = ['route', 'family', 'http_status', 'canonical', 'canonical_self', 'title', 'h1_count', 'h1_visible_count', 'h1_text', 'robots', 'jsonld_types', 'jsonld_blocks', 'jsonld_ok', 'internal_links', 'internal_links_hidden_home', 'unique_internal_targets', 'external_links', 'main_text_chars', 'thin', 'thin_reason', 'js_only_nav', 'in_sitemap', 'reachable_any', 'reachable_visible', 'bytes'];
const recs = [...pages.values()].sort((a, b) => a.route.localeCompare(b.route));
for (const p of recs) { p.in_sitemap = smRoutes.has(p.route); p.reachable_any = dAll.has(p.route); p.reachable_visible = dVis.has(p.route); }
writeCsv('routes.csv', cols, recs.map(p => cols.map(c => p[c])));
writeCsv('broken-links.csv', ['source', 'href', 'reason', 'element', 'status', 'location'], broken);

// ---------- duplicates ----------
const groupBy = (arr, k) => { const m = new Map(); for (const x of arr) { const v = x[k]; if (!v) continue; (m.get(v) || m.set(v, []).get(v)).push(x.route); } return [...m].filter(([, l]) => l.length > 1); };
const real = recs.filter(p => p.http_status === 200);
const dupT = groupBy(real, 'title'), dupC = groupBy(real, 'canonical');
const dupRows = [];
for (const [t, l] of dupT) dupRows.push(['duplicate_title', t, l.length, l.join(' ')]);
for (const [c, l] of dupC) dupRows.push(['duplicate_canonical', c, l.length, l.join(' ')]);
for (const p of real) {
  if (!p.canonical) dupRows.push(['missing_canonical', '', 1, p.route]);
  else if (!p.canonical_self) dupRows.push(['canonical_not_self', p.canonical, 1, p.route]);
  if (p.h1_visible_count === 0) dupRows.push(['missing_visible_h1', '', 1, p.route]);
  if (p.h1_visible_count > 1) dupRows.push(['multiple_visible_h1', p.h1_text, 1, p.route]);
  if (p.h1_count > 1) dupRows.push(['multiple_h1_in_html', p.h1_count + ' (incl. hidden)', 1, p.route]);
  if (!p.title) dupRows.push(['missing_title', '', 1, p.route]);
  if (p.jsonld_ok === false) dupRows.push(['jsonld_parse_error', '', 1, p.route]);
}
writeCsv('duplicates.csv', ['issue', 'value', 'count', 'routes'], dupRows);

// ---------- stats ----------
const famStats = {};
for (const r of allRoutes) {
  const f = family(r); const s = famStats[f] = famStats[f] || { dist: 0, sitemap: 0, reach_any: 0, reach_visible: 0, thin: 0, no_documented_issues: 0 };
  if (pages.has(r)) s.dist++; if (smRoutes.has(r)) s.sitemap++; if (dAll.has(r)) s.reach_any++; if (dVis.has(r)) s.reach_visible++;
  const p = pages.get(r); if (p && p.thin) s.thin++; if (p && /no_documented/.test(p.thin_reason)) s.no_documented_issues++;
}
const reasonCounts = {}; for (const b of broken) { const k = b[2] + (b[5] ? '(' + b[5] + ')' : ''); reasonCounts[k] = (reasonCounts[k] || 0) + 1; }
const brokenUniq = {}; for (const b of broken) if (b[4] === 404) brokenUniq[new URL(b[1], ORIGIN + b[0]).pathname] = (brokenUniq[new URL(b[1], ORIGIN + b[0]).pathname] || 0) + 1;
const stats = {
  html_files: htmlFiles.length, routes: routes.length, sitemap_urls: smUrls.length, sitemap_unique: smRoutes.size, sitemap_offsite: smOffsite.length,
  in_sitemap_not_dist: [...smRoutes].filter(r => !pages.has(r)), in_dist_not_sitemap: routes.filter(r => !smRoutes.has(r)),
  reachable_any: routes.filter(r => dAll.has(r)).length, reachable_visible: routes.filter(r => dVis.has(r)).length,
  unreachable_any: routes.filter(r => !dAll.has(r)).length, sitemap_only_no_links: [...smRoutes].filter(r => pages.has(r) && !dAll.has(r)).length,
  max_depth_any: Math.max(...dAll.values()), families: famStats,
  broken_link_rows: broken.length, broken_by_reason: reasonCounts, broken_404_targets: brokenUniq,
  duplicate_title_groups: dupT.length, duplicate_title_pages: dupT.reduce((a, [, l]) => a + l.length, 0),
  duplicate_canonical_groups: dupC.length, canonical_not_self: real.filter(p => p.canonical && !p.canonical_self).length, missing_canonical: real.filter(p => !p.canonical).length,
  missing_visible_h1: real.filter(p => p.h1_visible_count === 0).length, multiple_visible_h1: real.filter(p => p.h1_visible_count > 1).length,
  multiple_h1_in_html: real.filter(p => p.h1_count > 1).length, robots_meta_pages: real.filter(p => p.robots).length, noindex_pages: real.filter(p => /noindex/i.test(p.robots)).length,
  jsonld_pages: real.filter(p => p.jsonld_blocks).length, jsonld_errors: real.filter(p => p.jsonld_ok === false).length,
  thin_pages: real.filter(p => p.thin).length, thin_by_reason: real.filter(p => p.thin).reduce((a, p) => { for (const k of p.thin_reason.split('|')) a[k] = (a[k] || 0) + 1; return a; }, {}),
  pages_with_hidden_home_block: real.filter(p => p.internal_links_hidden_home > 0).length, asset_refs_checked: assetRefs,
  page_404: pages.get('/404.html') ? { canonical: pages.get('/404.html').canonical } : null
};
fs.writeFileSync(path.join(OUT, 'stats.json'), JSON.stringify(stats, null, 2));
console.log(JSON.stringify({ ...stats, in_dist_not_sitemap: stats.in_dist_not_sitemap.length, in_sitemap_not_dist: stats.in_sitemap_not_dist.length, broken_404_targets: Object.keys(brokenUniq).length }, null, 1));
