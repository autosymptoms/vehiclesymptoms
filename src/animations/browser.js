(() => {
  function loadPlayer(details) {
    const template = details.querySelector('template');
    if (details.open && template) template.replaceWith(template.content.cloneNode(true));
  }
  document.querySelectorAll('[data-mv-player]').forEach(details => {
    details.addEventListener('toggle', () => {
      if (details.open) loadPlayer(details);
      else {
        const frame = details.querySelector('iframe');
        if (!frame) return;
        const template = document.createElement('template');
        template.content.append(frame.cloneNode(false));
        frame.replaceWith(template);
      }
    });
  });
  const directory = document.querySelector('#mv-directory');
  if (!directory) return;
  const data = JSON.parse(document.getElementById('mv-data').textContent);
  const records = new Map(data.items.map(item => [item.kind + ':' + item.id, item]));
  const viewer = document.getElementById('mv-viewer');
  const title = document.getElementById('mv-title');
  const content = document.getElementById('mv-content');
  const search = document.getElementById('mv-search');
  search.disabled = false;
  const groups = [...directory.querySelectorAll('.mv-group')].map(group => ({
    group, rows: [...group.querySelectorAll('[data-mv-id]')].map(a => ({ row:a.parentElement, item:records.get(a.dataset.mvId) }))
  }));
  const fold = text => text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).map(w => w.length > 3 ? w.replace(/s$/, '') : w);
  function filter() {
    const terms = fold(search.value).filter(Boolean);
    let count = 0;
    groups.forEach(({ group, rows }) => {
      let visible = 0;
      rows.forEach(({ row, item }) => {
        const words = fold(item.title + ' ' + item.system + ' ' + item.menuLabel);
        row.hidden = !terms.every(t => words.some(w => w.startsWith(t)));
        if (!row.hidden) visible++;
      });
      group.hidden = !visible;
      count += visible;
    });
    document.getElementById('mv-count').textContent = count ? count + (count === 1 ? ' video' : ' videos') : 'No matching videos. Try another part or system.';
  }
  function select(id, focus) {
    const item = records.get(id);
    content.replaceChildren();
    viewer.hidden = !item;
    if (!item) return;
    title.textContent = item.title;
    if (!item.url) {
      const hint = document.createElement('p');
      hint.className = 'mv-hint';
      hint.textContent = 'Choose ' + item.menuLabel + ' in the system menu.';
      content.append(hint);
    }
    const frame = document.createElement('iframe');
    frame.className = 'mv-frame' + (item.url ? ' mv-video' : '');
    frame.title = item.url ? item.title : 'MotoVisuals vehicle system overviews';
    frame.allowFullscreen = true;
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    frame.loading = 'lazy';
    frame.src = item.url || data.menu;
    content.append(frame);
    if (focus) title.focus();
  }
  function fromUrl(focus) {
    const url = new URL(location.href);
    const id = url.searchParams.get('animation');
    if (id !== null && !records.has(id)) {
      url.searchParams.delete('animation');
      history.replaceState(null, '', url);
    }
    select(id, focus);
  }
  directory.addEventListener('click', event => {
    const a = event.target.closest('a[data-mv-id]');
    if (!a || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    history.pushState(null, '', a.href);
    select(a.dataset.mvId, true);
    viewer.scrollIntoView({ block: 'nearest' });
  });
  addEventListener('popstate', () => fromUrl(false));
  search.addEventListener('input', filter);
  filter();
  fromUrl(false);
})();
