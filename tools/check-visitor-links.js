// Inspect the rendered pages, including their no-JavaScript and lazy-player markup.
// Visitors may leave the site only through links on the outbound whitelist below (Nov 27 2026 sweep, T-03):
// U.S. government sites (nhtsa.gov and its subdomains, ecfr.gov, any *.gov), AAA, and carmakers' owner's-manual pages.
// Every such link must open in a new tab with rel="noopener nofollow". Any other off-site link fails the build.
const fs = require('node:fs');
const path = require('node:path');
const { parse, parseFragment } = require('parse5');
const players = require('../src/animations/config.json');

const dist = path.resolve(process.argv[2] || path.join(__dirname, '../dist'));
const origins = new Set(['https://vehiclesymptoms.com', 'https://www.vehiclesymptoms.com']);
const approvedPlayers = new Set([players.menu, ...Object.values(players.individual)].filter(Boolean));
const destinations = { a: 'href', area: 'href', base: 'href', form: 'action', button: 'formaction',
  input: 'formaction', object: 'data', embed: 'src', iframe: 'src' };
// Carmaker domains whose owner's-manual pages may be linked. A link on these domains counts only when the
// host or path is clearly an owner's manual or owner page ("owner", "manual", or Honda's /OM/ publications).
const MAKER_DOMAINS = ['honda.com', 'acura.com', 'toyota.com', 'lexus.com', 'ford.com', 'lincoln.com', 'fordservicecontent.com',
  'gm.com', 'chevrolet.com', 'gmc.com', 'buick.com', 'cadillac.com', 'mopar.com', 'ramtrucks.com', 'jeep.com', 'dodge.com',
  'chrysler.com', 'nissanusa.com', 'infinitiusa.com', 'hyundai.com', 'hyundaiusa.com', 'kia.com', 'genesis.com', 'mazda.com',
  'mazdausa.com', 'subaru.com', 'vw.com', 'audiusa.com', 'bmwusa.com', 'mbusa.com', 'tesla.com', 'volvocars.com',
  'mitsubishicars.com', 'porsche.com', 'mini.com', 'miniusa.com', 'landroverusa.com', 'jaguarusa.com', 'rivian.com'];
const onDomain = (host, d) => host === d || host.endsWith('.' + d);
function isAllowedOutbound(href) {
  let url;
  try { url = new URL(href); } catch { return false; }
  if (url.protocol !== 'https:' || url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  if (host.endsWith('.gov')) return true;                 // nhtsa.gov, static.nhtsa.gov, ecfr.gov, weather.gov, state DMVs
  if (onDomain(host, 'aaa.com')) return true;
  if (onDomain(host, 'hyundaiantitheft.com')) return true;   // Hyundai's anti-theft program site (manufacturer)
  if (MAKER_DOMAINS.some(d => onDomain(host, d))) return /owner|manual/i.test(host) || /owner|manual|\/om\//i.test(url.pathname);
  return false;
}
module.exports = { isAllowedOutbound, MAKER_DOMAINS };

let pages = 0;
let violations = 0;
let outbound = 0;

function violation(file, message) {
  if (++violations <= 12) console.error(path.relative(dist, file) + ': ' + message);
}

function inspect(node, pageUrl, file) {
  const tag = node.tagName;
  const attrs = Object.fromEntries((node.attrs || []).map(a => [a.name, a.value]));
  let target = attrs[destinations[tag]];
  if (tag === 'meta' && attrs['http-equiv']?.toLowerCase() === 'refresh') {
    target = attrs.content?.match(/^[\d.]+\s*[,;]\s*(?:url\s*=\s*)?([^]*)/i)?.[1].trim().replace(/^['"]|['"]$/g, '');
  }
  if (target) {
    let url;
    try { url = new URL(target, pageUrl); } catch { violation(file, 'Invalid ' + tag + ' destination'); }
    if (url && !origins.has(url.origin)) {
      if (tag === 'iframe' && approvedPlayers.has(url.href)) {
        const sandbox = attrs.sandbox;
        if (sandbox === undefined || /\ballow-(?:top-navigation|popups|downloads)/i.test(sandbox))
          violation(file, 'Player permits navigation outside the site');
      } else if (tag === 'a' && isAllowedOutbound(url.href)) {
        const rel = (attrs.rel || '').toLowerCase().split(/\s+/);
        if (!rel.includes('noopener') || !rel.includes('nofollow') || attrs.target !== '_blank')
          violation(file, 'Whitelisted link to ' + url.host + ' needs target="_blank" rel="noopener nofollow"');
        outbound++;
      } else {
        violation(file, tag + ' opens ' + (url.host || url.protocol));
      }
    }
  }
  if (tag === 'iframe' && attrs.srcdoc) inspect(parseFragment(attrs.srcdoc), pageUrl, file);
  if (node.content) inspect(node.content, pageUrl, file);
  for (const child of node.childNodes || []) inspect(child, pageUrl, file);
}

function scan(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) scan(file);
    else if (entry.name.endsWith('.html')) {
      const pageUrl = new URL(path.relative(dist, file), 'https://www.vehiclesymptoms.com/');
      inspect(parse(fs.readFileSync(file, 'utf8'), { scriptingEnabled: false }), pageUrl, file);
      pages++;
    }
  }
}

if (require.main === module) {
  scan(dist);
  console.log('Visitor navigation: ' + pages + ' HTML files checked, ' + outbound + ' whitelisted outbound links, ' + violations + ' violations.');
  if (!pages || violations) process.exitCode = 1;
}
