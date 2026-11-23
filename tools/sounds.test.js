// Run after npm run build. Check the published local recording and all entry points.
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {createHash} = require('node:crypto');
const {JSDOM} = require('jsdom');

const dist = join(__dirname, '..', 'dist');
const read = file => readFileSync(join(dist, file), 'utf8');
const origin = 'https://www.vehiclesymptoms.com';
function openPage(route) {
  return new JSDOM(read(route+'index.html'), {url:origin+route, runScripts:'outside-only'});
}

const soundPage = openPage('/sounds/');
const main = soundPage.window.document.getElementById('vehicleView');
const audio = main.querySelectorAll('audio');
assert.equal(audio.length, 1);
assert.equal(audio[0].controls, true);
assert.equal(audio[0].autoplay, false);
assert.ok(audio[0].getAttribute('aria-label'));
const source = audio[0].querySelector('source[type="audio/mpeg"]');
assert.equal(source.getAttribute('src'), '/sounds/whir-while-driving.mp3');
assert.equal(audio[0].querySelector('a').href, source.src);
assert.equal(createHash('sha256').update(readFileSync(join(dist, new URL(source.src).pathname))).digest('hex'),
  'd09872f5909c9f4c18429cbcc7f1cc1bdc8f560295f04ba5443b6e51c59c1eb0');
assert.match(main.textContent, /8-second excerpt.*As\.m4a.*watercool.*CC0 1\.0/s);
assert.match(main.textContent, /did not identify the cause/);
assert.equal(main.querySelector('iframe, button, video, embed, object'), null);
for (const element of main.querySelectorAll('[href], [src]')) {
  assert.equal(new URL(element.href || element.src).origin, origin);
}
const guideLink = main.querySelector('section a.walk');
assert.equal(guideLink.pathname, '/symptoms/humming-noise-at-speed/');
const section = guideLink.closest('section');
const guide = openPage(guideLink.pathname);
assert.ok(guide.window.document.querySelector('#vehicleView a[href="/sounds/#'+section.id+'"]'));

const home = openPage('/');
const shortcuts = home.window.document.querySelectorAll('#homeView .shortcuts a');
assert.deepEqual([...shortcuts].map(a=>a.getAttribute('href')),[
  '/symptoms/car-wont-start/', '/warning-lights/', '/symptoms/#noise',
  '/symptoms/#shake', '/symptoms/#leaksmell', '/symptoms/engine-overheating/'
]);
assert.ok(home.window.document.querySelector('#homeView a[href="/sounds/"]'));
const hub = openPage('/symptoms/');
const checkNoiseLink = () => assert.equal(hub.window.document.querySelectorAll('#noise a[href="/sounds/"]').length, 1);
checkNoiseLink();
hub.window.eval(read('guide-index.js'));
hub.window.eval(read('guide.js'));
checkNoiseLink();
assert.ok(read('sitemap-pages.xml').includes('/sounds/</loc>'));
for (const page of [soundPage,guide,home,hub]) page.window.close();
console.log('PASS local audio, original recording hash, credit, internal links, guide round trip, all six shortcuts, hydrated noise hub and sitemap.');
