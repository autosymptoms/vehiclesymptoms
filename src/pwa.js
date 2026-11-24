// Home-screen app support: registers the offline service worker and shows a one-time
// "add to your home screen" hint on phones. Nothing here is required for the site to work.
(function () {
  'use strict';

  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (e) { return null; }
  }

  // ---------- offline support ----------
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function () {});
    });
  }

  // ---------- one-time install hint ----------
  var HINT_KEY = 'vs-home-hint';
  var VIEWS_KEY = 'vs-page-views';
  var ua = navigator.userAgent || '';
  var isIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  var isAndroid = /Android/.test(ua);
  var standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  var deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
  });

  window.addEventListener('appinstalled', function () {
    store(HINT_KEY, 'installed');
    removeHint();
    if (window.va) window.va('event', { name: 'home_screen_installed' });
  });

  if (standalone) {
    store(HINT_KEY, 'installed');
    return;
  }
  if (!(isIOS || isAndroid) || store(HINT_KEY)) return;

  // Show it on the second page a visitor opens, so the first visit stays about their car.
  var views = parseInt(store(VIEWS_KEY) || '0', 10) + 1;
  store(VIEWS_KEY, String(views));
  if (views < 2) return;

  var hint;
  function removeHint() {
    if (hint && hint.parentNode) hint.parentNode.removeChild(hint);
    hint = null;
  }

  function showHint() {
    if (store(HINT_KEY)) return;
    store(HINT_KEY, 'shown');

    hint = document.createElement('div');
    hint.className = 'home-hint';
    hint.setAttribute('role', 'dialog');
    hint.setAttribute('aria-label', 'Add VehicleSymptoms to your home screen');

    var icon = '<img src="/icon-192.png" alt="" width="40" height="40">';
    var text;
    if (deferredPrompt) {
      text = '<b>Keep VehicleSymptoms on your phone.</b> Warning lights and key guides work even with no signal.';
    } else if (isIOS) {
      text = '<b>Keep VehicleSymptoms on your phone.</b> Tap <span class="hh-share" aria-label="Share">' +
        '<svg width="14" height="16" viewBox="0 0 14 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 10V1M3.5 4.5 7 1l3.5 3.5M4.5 7H2v8h10V7H9.5"/></svg>' +
        ' Share</span>, then <b>Add to Home Screen</b>. Warning lights work even with no signal.';
    } else {
      text = '<b>Keep VehicleSymptoms on your phone.</b> Tap the <b>⋮</b> menu, then <b>Add to Home screen</b> or <b>Install app</b>.';
    }

    hint.innerHTML = icon + '<p>' + text + '</p>' +
      (deferredPrompt ? '<button type="button" class="hh-add">Add</button>' : '') +
      '<button type="button" class="hh-close" aria-label="Close">×</button>';
    document.body.appendChild(hint);

    var add = hint.querySelector('.hh-add');
    if (add) add.addEventListener('click', function () {
      var p = deferredPrompt;
      deferredPrompt = null;
      removeHint();
      if (p) p.prompt();
    });
    hint.querySelector('.hh-close').addEventListener('click', removeHint);
    if (window.va) window.va('event', { name: 'home_screen_hint_shown' });
  }

  // Wait a few seconds so the hint never covers the answer someone came for.
  window.addEventListener('load', function () { setTimeout(showHint, 8000); });
})();
