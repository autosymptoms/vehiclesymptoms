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
      rows.map(([id, title]) => ({
        id, title, system, kind,
        url: embeds.get(kind + ':' + id) || '',
        menuLabel: kind === 'narrated' ? settings.overviews?.[id] || '' : ''
      }))));
  items.sort((a,b) => a.title.localeCompare(b.title, 'en') || a.kind.localeCompare(b.kind));
  const byId = new Map(items.map(i => [recordKey(i), i]));
  const available = item => item && (item.url || item.menuLabel) ? item : undefined;
  const match = t => t && available(byId.get('narrated:' + t.id));
  const broadOverviews = new Map(items.filter(i => i.menuLabel === i.system && i.title === i.system)
    .map(i => [i.system, i]));
  const guide = new Map();
  for (const topic of topics) {
    const part = byId.get('narrated:' + topic.id);
    const item = available(part) || broadOverviews.get(part?.system);
    if (item) for (const slug of topic.guides) guide.set(slug, item);
  }
  const forText = text => match(topics.find(t => t.issue && t.issue.test(text)));
  const link = i => library + '?animation=' + encodeURIComponent(recordKey(i));
  function player(i) {
    const src = i?.url || menu;
    const title = i?.url ? i.title : 'MotoVisuals vehicle system overviews';
    const hint = i && !i.url ? '<p class="mv-hint">Choose <b>' + esc(i.menuLabel) + '</b> in the system menu.</p>' : '';
    const frame = '<iframe class="mv-frame' + (i?.url ? ' mv-video' : '') + '" title="' + esc(title) + '" src="' + esc(src) + '" referrerpolicy="strict-origin-when-cross-origin" loading="lazy" allowfullscreen></iframe>';
    return hint + '<template>' + frame + '</template><noscript>' + frame + '</noscript>';
  }
  function contextual(i) {
    if (!available(i)) return '';
    const label = i.menuLabel ? 'Vehicle system overview' : 'Repair animation';
    return '<details class="mv-related" data-mv-player><summary>' + label + ' · ' + esc(i.title) + '</summary>' +
      player(i) + '<a href="' + library + '">Browse repair animations</a></details>';
  }
  function directory() {
    const direct = items.filter(i => i.url);
    const overviews = items.filter(i => i.menuLabel && !i.url);
    const catalog = new Map();
    for (const item of items) {
      if (available(item)) continue;
      if (!catalog.has(item.system)) catalog.set(item.system, []);
      catalog.get(item.system).push(item);
    }
    function group(name, entries, featured = false) {
      if (!entries.length) return '';
      const rows = entries.map(i => {
        const id = ' data-mv-id="' + esc(recordKey(i)) + '"';
        const title = available(i)
          ? '<a' + id + ' href="' + esc(link(i)) + '">' + esc(i.title) + '</a>'
          : '<span' + id + '>' + esc(i.title) + '</span>';
        const status = i.url ? 'Direct player' : i.menuLabel ? 'In system menu' : 'Catalog only';
        return '<li>' + title + ' <small>' + esc(i.kind) + ' · ' + status + '</small></li>';
      }).join('');
      return '<details class="mv-group"' + (featured ? ' open data-mv-featured' : '') + '><summary>' + esc(name) + '</summary><ul>' + rows + '</ul></details>';
    }
    const groups = group('Watch now', direct, true) + group('Watch through the system menu', overviews) +
      [...catalog].sort(([a],[b]) => a.localeCompare(b)).map(([name, entries]) => group(name, entries)).join('');
    return {
      data: { menu, items },
      html: '<div class="crumb"><a href="/">Home</a> › Repair animations</div><div class="ghead"><h1>Repair animations</h1>' +
        '<p class="sub">Watch available repair videos and search the MotoVisuals title catalog. Catalog-only titles have no player on this site.</p></div>' +
        '<details class="mv-related" id="mv-viewer" data-mv-player hidden><summary id="mv-title"></summary><div id="mv-content"></div></details>' +
        '<noscript>' + direct.map(i => '<details class="mv-related"><summary>' + esc(i.title) + '</summary>' +
          '<iframe class="mv-frame mv-video" title="' + esc(i.title) + '" src="' + esc(i.url) + '" referrerpolicy="strict-origin-when-cross-origin" loading="lazy" allowfullscreen></iframe></details>').join('') + '</noscript>' +
        '<details class="mv-related" data-mv-player><summary>Browse vehicle system overviews</summary>' + player(null) + '</details>' +
        '<div id="mv-directory"><label for="mv-search">Find a part or system</label>' +
        '<input type="search" id="mv-search" placeholder="Try brake pads or wheel bearing" autocomplete="off" disabled>' +
        '<label for="mv-format">Format</label><select id="mv-format" disabled><option value="">All formats</option>' +
        '<option value="narrated">Narrated</option><option value="interactive">Interactive</option></select>' +
        '<p id="mv-count" role="status" aria-live="polite"></p><div id="mv-groups">' + groups + '</div></div>'
    };
  }
  return { directory, contextual, guide, forText, link };
}

module.exports = { createLibrary, safeEmbed };
