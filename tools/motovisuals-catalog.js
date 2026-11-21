// Build-only. The browser receives navigation labels, never credentials or media files.
const endpoint = 'https://technet.motovisuals.com/api/animation_link/api/api.php';

function catalogEntries(tree, kind) {
  const items = new Map();
  function visit(nodes, system) {
    for (const node of Object.values(nodes || {})) {
      if (!node || typeof node !== 'object') continue;
      const title = typeof node.en_US === 'string' ? node.en_US.trim() : '';
      const group = system || title;
      const id = String(node.part_id || '');
      if (title && group && /^\d+$/.test(id)) items.set(id, { id, title, system: group, kind });
      if (node.children) visit(node.children, group);
    }
  }
  visit(tree, '');
  if (!items.size) throw new Error('Empty MotoVisuals ' + kind + ' catalog');
  return [...items.values()];
}

async function fetchCatalog(key) {
  const catalogs = await Promise.all(['narrated', 'interactive'].map(async kind => {
    const body = new URLSearchParams({ api_key: key, moduleName: 'animation',
      methodName: 'getAnimationDetails', animation_type: kind, lang: 'en_US' });
    const response = await fetch(endpoint, { method: 'POST', body, redirect: 'error', signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error('MotoVisuals ' + kind + ' catalog returned HTTP ' + response.status);
    return catalogEntries(await response.json(), kind);
  }));
  return catalogs.flat();
}

function serialize(items) {
  const formats = {};
  for (const item of items) {
    const groups = formats[item.kind] ||= new Map();
    if (!groups.has(item.system)) groups.set(item.system, []);
    groups.get(item.system).push([item.id, item.title]);
  }
  const sections = Object.entries(formats).map(([kind, groups]) => {
    const lines = [...groups.keys()].sort().map(name =>
      '    ' + JSON.stringify(name) + ': ' + JSON.stringify(groups.get(name)));
    return '  ' + JSON.stringify(kind) + ': {\n' + lines.join(',\n') + '\n  }';
  });
  return '{\n' + sections.join(',\n') + '\n}\n';
}

async function refresh() {
  const fs = require('node:fs/promises');
  const path = require('node:path');
  const key = process.env.MOTOVISUALS_API_KEY;
  if (!key) throw new Error('Missing local MotoVisuals key');
  const index = path.resolve(__dirname, '../src/animations/titles.json');
  const items = await fetchCatalog(key);
  const temporary = index + '.' + process.pid + '.tmp';
  try {
    await fs.writeFile(temporary, serialize(items));
    await fs.rename(temporary, index);
  } finally {
    await fs.rm(temporary, { force: true });
  }
  console.log('Updated ' + items.length + ' named MotoVisuals catalog entries.');
}

module.exports = { catalogEntries, serialize };
if (require.main === module) refresh().catch(() => {
  console.error('Could not update the MotoVisuals index. Check the key, connectivity and file permissions.');
  process.exitCode = 1;
});
