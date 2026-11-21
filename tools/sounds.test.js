// Run after npm run build. This checks the published page, local recording and guide links.
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {createHash}=require('node:crypto');
const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const dist=join(__dirname,'..','dist');
const read=path=>readFileSync(join(dist,path),'utf8');
const page=path=>new JSDOM(read(path),{url:'https://www.vehiclesymptoms.com',runScripts:'outside-only'});
const {window}=page('sounds/index.html');
const document=window.document;
const knownVideos=new Set(['eqw0rFjsMjg','jA3xgegNVDg','K8jPtyBVdsg']);
const panels=[...document.querySelectorAll('[data-sound-video]')];
assert.deepEqual(new Set(panels.map(p=>p.dataset.soundVideo)),knownVideos);
assert.equal(document.querySelector('iframe'),null);
const playerSrc=document.querySelector('script[src="/sounds/player.js"]').getAttribute('src');
window.eval(read(playerSrc));
for(const panel of panels){
  const button=panel.querySelector('button'),section=panel.closest('section');
  assert.equal(button.hidden,false);
  assert.ok(section.querySelector('a[href^="https://www.1aauto.com/"]'));
  const guide=section.querySelector('a[href^="/symptoms/"]').getAttribute('href');
  assert.ok(page(guide+'index.html').window.document.querySelector('a[href="/sounds/#'+section.id+'"]'));
  button.click();
  const frame=panel.querySelector('iframe');
  assert.equal(frame.style.minHeight,'200px');
  assert.equal(new URL(frame.src).origin,'https://www.youtube-nocookie.com');
  assert.equal(new URL(frame.src).pathname,'/embed/'+panel.dataset.soundVideo);
  assert.equal(button.getAttribute('aria-expanded'),'true');
  button.click();
  assert.equal(panel.querySelector('iframe'),null);
  assert.equal(button.getAttribute('aria-expanded'),'false');
}
const asset=document.querySelector('audio[controls] source[type="audio/mpeg"]').getAttribute('src');
assert.equal(createHash('sha256').update(readFileSync(join(dist,asset))).digest('hex'),
 'd09872f5909c9f4c18429cbcc7f1cc1bdc8f560295f04ba5443b6e51c59c1eb0','Published file must equal the decoded and credited recording.');
assert.ok(page('index.html').window.document.querySelector('#homeView a[href="/sounds/"]'));
assert.ok(page('symptoms/index.html').window.document.querySelector('#noise a[href="/sounds/"]'));
assert.ok(read('sitemap.xml').includes('/sounds/</loc>'));
window.close();
console.log('PASS licensed audio bytes, three optional players and fallbacks, three guide round trips, homepage, symptom hub and sitemap.');
