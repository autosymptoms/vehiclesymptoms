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
    const playable = items.filter(available);
    const direct = playable.filter(i => i.url);
    const overviews = playable.filter(i => !i.url);
    function group(name, entries) {
      if (!entries.length) return '';
      const rows = entries.map(i => '<li><a data-mv-id="' + esc(recordKey(i)) + '" href="' + esc(link(i)) + '">' +
        esc(i.title) + '</a></li>').join('');
      return '<section class="mv-group"><h2>' + esc(name) + '</h2><ul>' + rows + '</ul></section>';
    }
    const groups = group('Watch now', direct) + group('Watch through the system menu', overviews);
    return {
      data: { menu, items: playable },
      html: '<div class="crumb"><a href="/">Home</a> › Repair animations</div><div class="ghead"><h1>Repair animations</h1>' +
        '<p class="sub">Watch MotoVisuals videos about vehicle parts and systems.</p></div>' +
        '<section class="mv-related" id="mv-viewer" aria-labelledby="mv-title" hidden><h2 id="mv-title" tabindex="-1"></h2><div id="mv-content"></div></section>' +
        '<noscript><style>#mv-directory{display:none}</style>' + direct.map(i => '<section class="mv-related"><h2>' + esc(i.title) + '</h2>' +
          '<iframe class="mv-frame mv-video" title="' + esc(i.title) + '" src="' + esc(i.url) + '" referrerpolicy="strict-origin-when-cross-origin" loading="lazy" allowfullscreen></iframe></section>').join('') +
          (overviews.length ? '<h2>Vehicle system videos</h2><iframe class="mv-frame" title="MotoVisuals vehicle system overviews" src="' + esc(menu) +
            '" referrerpolicy="strict-origin-when-cross-origin" loading="lazy" allowfullscreen></iframe>' : '') + '</noscript>' +
        '<div id="mv-directory"><label for="mv-search">Find a part or system</label>' +
        '<input type="search" id="mv-search" placeholder="Try brake pads or steering" autocomplete="off" disabled>' +
        '<p id="mv-count" role="status" aria-live="polite"></p><div id="mv-groups">' + groups + '</div></div>'
    };
  }
  return { directory, contextual, guide, forText, link };
}

module.exports = { createLibrary, safeEmbed };
