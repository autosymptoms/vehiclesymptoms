// Inspect the rendered pages, including their no-JavaScript and lazy-player markup.
const fs = require('node:fs');
const path = require('node:path');
const { parse, parseFragment } = require('parse5');
const players = require('../src/animations/config.json');

const dist = path.resolve(process.argv[2] || path.join(__dirname, '../dist'));
const origins = new Set(['https://vehiclesymptoms.com', 'https://www.vehiclesymptoms.com']);
const approvedPlayers = new Set([players.menu, ...Object.values(players.individual)].filter(Boolean));
const destinations = { a: 'href', area: 'href', base: 'href', form: 'action', button: 'formaction',
  input: 'formaction', object: 'data', embed: 'src', iframe: 'src' };
let pages = 0;
let violations = 0;

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

scan(dist);
console.log('Visitor navigation: ' + pages + ' HTML files checked, ' + violations + ' violations.');
if (!pages || violations) process.exitCode = 1;
