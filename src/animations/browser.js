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
  const format = document.getElementById('mv-format');
  search.disabled = format.disabled = false;
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
        const words = fold(item.title + ' ' + item.system);
        row.hidden = Boolean((format.value && format.value !== item.kind) || !terms.every(t => words.some(w => w.startsWith(t))));
        if (!row.hidden) visible++;
      });
      group.hidden = !visible;
      group.open = Boolean(visible && (terms.length || format.value));
      count += visible;
    });
    document.getElementById('mv-count').textContent = count ? count + (count === 1 ? ' title' : ' titles') : 'No matching titles. Try another part or clear the filter.';
  }
  function select(id, focus) {
    const item = records.get(id);
    content.replaceChildren();
    title.textContent = item ? item.title : 'Open the full MotoVisuals menu';
    if (item && !item.url) {
      const hint = document.createElement('p');
      hint.className = 'mv-hint';
      hint.textContent = 'In the MotoVisuals menu, choose ' + item.system + ' and look for ' + item.title + '.';
      content.append(hint);
    }
    const template = document.createElement('template');
    const frame = document.createElement('iframe');
    frame.className = 'mv-frame' + (item && item.url ? ' mv-video' : '');
    frame.title = item && item.url ? item.title : 'MotoVisuals repair animation menu';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.loading = 'lazy';
    frame.src = item && item.url || data.menu;
    template.content.append(frame);
    content.append(template);
    if (item) {
      const reset = document.createElement('a');
      reset.href = '/repair-animations/';
      reset.textContent = 'Back to the full menu';
      content.append(reset);
    }
    viewer.open = Boolean(item);
    if (viewer.open) loadPlayer(viewer);
    if (focus) title.focus();
  }
  function fromUrl(focus) {
    const params = new URLSearchParams(location.search);
    select(params.get('animation'), focus);
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
  format.addEventListener('change', filter);
  filter();
  fromUrl(false);
})();
