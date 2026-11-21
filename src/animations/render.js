const titleIndex = require('./titles.json');
const topics = require('./topics');
const config = require('./config.json');

function safeEmbed(value) {
  if (!value) return '';
  const url = new URL(value);
  const allowedParams = new Set(['useriframeid', 'userid', 'domain', 'tempdomain', 'businessentityid', 'animationname']);
  if (url.origin !== 'https://technet.motovisuals.com' || url.username || url.password || url.hash ||
      !['/embed/embed_systems.php', '/embed/embed_single.php'].includes(url.pathname) ||
      !url.searchParams.has('useriframeid') || !url.searchParams.has('domain') ||
      [...url.searchParams.keys()].some(k => !allowedParams.has(k))) {
    throw new Error('Use the public iframe src from the MotoVisuals website embed tool.');
  }
  return url.href;
}

const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const library = '/repair-animations/';
const recordKey = item => item.kind + ':' + item.id;

function createLibrary(settings = config) {
  const menu = safeEmbed(settings.menu);
  if (!menu) return null;
  const embeds = new Map(Object.entries(settings.individual).map(([id, url]) => [id, safeEmbed(url)]));
  const items = Object.entries(titleIndex).flatMap(([kind, systems]) =>
    Object.entries(systems).flatMap(([system, rows]) =>
      rows.map(([id, title]) => ({ id, title, system, kind }))));
  items.sort((a,b) => a.title.localeCompare(b.title, 'en') || a.kind.localeCompare(b.kind));
  const byId = new Map(items.map(i => [recordKey(i), i]));
  const match = t => t && byId.get('narrated:' + t.id);
  const guide = new Map(topics.flatMap(t => t.guides.map(slug => [slug, match(t)])));
  const forText = text => match(topics.find(t => t.issue && t.issue.test(text)));
  const link = i => library + '?animation=' + encodeURIComponent(recordKey(i));
  function player(i) {
    const src = i && embeds.get(recordKey(i));
    const hint = i && !src ? '<p class="mv-hint">In the MotoVisuals menu, choose <b>' + esc(i.system) + '</b> and look for <b>' + esc(i.title) + '</b>.</p>' : '';
    const title = src ? i.title : 'MotoVisuals repair animation menu';
    const frame = '<iframe class="mv-frame' + (src ? ' mv-video' : '') + '" title="' + esc(title) + '" src="' + esc(src || menu) + '" referrerpolicy="strict-origin-when-cross-origin" loading="lazy" allowfullscreen></iframe>';
    return hint + '<template>' + frame + '</template><noscript>' + frame + '</noscript>';
  }
  function contextual(i) {
    if (!i) return '';
    return '<details class="mv-related" data-mv-player><summary>Repair animation · ' + esc(i.title) + '</summary>' +
      player(i) + '<a href="' + library + '">Browse repair animations</a></details>';
  }
  function directory() {
    const groups = new Map();
    const text = items.map(i => {
      const entry = { ...i, url: embeds.get(recordKey(i)) || '' };
      if (!groups.has(i.system)) groups.set(i.system, []);
      groups.get(i.system).push(entry);
      return entry;
    });
    const rows = [...groups].sort(([a],[b]) => a.localeCompare(b)).map(([name, entries]) =>
      '<details class="mv-group"><summary>' + esc(name) + '</summary><ul>' +
      entries.map(i => '<li><a href="' + esc(link(i)) + '" data-mv-id="' + esc(recordKey(i)) + '">' + esc(i.title) +
        '</a> <small>' + esc(i.kind) + '</small></li>').join('') + '</ul></details>').join('');
    return {
      data: { menu, items: text },
      html: '<div class="crumb"><a href="/">Home</a> › Repair animations</div><div class="ghead"><h1>Repair animations</h1>' +
        '<p class="sub">See how a part works with MotoVisuals.</p></div>' +
        '<details class="mv-related" id="mv-viewer" data-mv-player><summary id="mv-title">Open the full MotoVisuals menu</summary>' +
        '<div id="mv-content">' + player(null) + '</div></details>' +
        '<div id="mv-directory"><label for="mv-search">Find a part or system</label>' +
        '<input type="search" id="mv-search" placeholder="Try brake pads or wheel bearing" autocomplete="off" disabled>' +
        '<label for="mv-format">Format</label><select id="mv-format" disabled><option value="">All formats</option>' +
        '<option value="narrated">Narrated</option><option value="interactive">Interactive</option></select>' +
        '<p id="mv-count" role="status" aria-live="polite"></p><div id="mv-groups">' + rows + '</div></div>'
    };
  }
  return { directory, contextual, guide, forText, link };
}

module.exports = { createLibrary, safeEmbed };
