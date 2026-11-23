// Exercise the homepage form and the full guide vocabulary with the production scripts.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {JSDOM} = require('jsdom');

const src = path.join(__dirname, '..', 'src');
const journeys = fs.readdirSync(path.join(src, 'journeys')).filter(name=>name.endsWith('.json'))
  .map(name=>JSON.parse(fs.readFileSync(path.join(src, 'journeys', name), 'utf8')));
const dom = new JSDOM(fs.readFileSync(path.join(src, 'template.html'), 'utf8'), {url:'https://www.vehiclesymptoms.com/'});
const {window} = dom;
const {document, Option, localStorage} = window;
const location = {pathname:'/', hash:'', search:'', href:''};
window.GUIDE_INDEX = journeys.map(j=>({id:j.id, title:j.title, h1:j.h1, group:j.group, syn:j.synonyms}));
window.VEHICLES = [{id:'honda-civic', make:'Honda', model:'Civic', years:[1996,2026]},
  {id:'ford-f-150', make:'Ford', model:'F-150', years:[1996,2026]},
  {id:'chevrolet-volt', make:'Chevrolet', model:'Volt', years:[2011,2019]},
  {id:'chevrolet-spark', make:'Chevrolet', model:'Spark', years:[2013,2022]},
  {id:'ram-1500', make:'Ram', model:'1500', years:[2011,2026]}];
const context = vm.createContext({window, document, Option, localStorage, location, URLSearchParams});
for(const name of ['guide','app'])vm.runInContext(fs.readFileSync(path.join(src, name+'.js'),'utf8'),context);

function submit(query){
  location.href='';
  document.getElementById('helpInput').value=query;
  document.getElementById('helpForm').dispatchEvent(new window.Event('submit',{cancelable:true}));
  return document.getElementById('helpResults');
}

const searches = [
  ['there’s a puddle where I parked','fluid-leak-under-car'],['there is a puddle under my car','fluid-leak-under-car'],
  ['puddle on my driveway','fluid-leak-under-car'],['found a puddle in my parking spot','fluid-leak-under-car'],
  ['my car will not start','car-wont-start'],['battery light came on','battery-light-on'],['battery light just came on','battery-light-on'],
  ['the red battery picture came on','battery-light-on'],['a red light looks like a little oil can','oil-pressure-light-on'],
  ['airbag light came on after moving seat','airbag-light-on'],['my car shimmies when I slow down','car-shakes-when-braking'],
  ['shimmies when slowing down','car-shakes-when-braking'],['my brakes sound like metal on metal','grinding-brakes'],
  ['my car shakes when I step on the gas','car-shakes-when-accelerating'],['shaking on the freeway','vibration-at-highway-speed'],
  ['it makes a clicking sound when I try to start it','car-wont-start'],['smells like rotten eggs','rotten-egg-smell'],
  ['check engine light blinking','check-engine-light-flashing'],['check engine light is not flashing','check-engine-light-on']
];
for(const [query,id] of searches){
  const result=submit(query);
  const first=location.href || result.querySelector('a')?.getAttribute('href');
  assert.equal(first,'/symptoms/'+id+'/',query);
}
const clarifications=[
  ['it sounds like a helicopter when I go faster','What do you hear as the car speeds up?','/symptoms/humming-noise-at-speed/'],
  ['my car died','When does the engine stop?','/symptoms/engine-stalls-while-driving/'],
  ['smoke is coming out of the car','Where do you see the smoke, and what color is it?','/symptoms/steam-from-under-hood/'],
  ['my car smells strange','What does the smell remind you of?','/symptoms/rotten-egg-smell/'],
  ['my car is leaking','Where do you see the fluid?','/symptoms/fluid-leak-under-car/'],
  ['a red dashboard light just came on','Which dashboard symbol do you see?','/warning-lights/'],
  ['my 2012 Honda Civic shakes','When do you feel the shaking?','/symptoms/car-shakes-when-braking/?v=honda-civic&y=2012'],
  ['my 2012 Ford F150 makes a weird noise','What does the noise sound like?','/symptoms/grinding-brakes/?v=ford-f-150&y=2012']
];
for(const [query,question,href] of clarifications){
  const result=submit(query);
  assert.equal(location.href,'',query);
  assert.equal(result.querySelector('b').textContent,question);
  assert.ok([...result.querySelectorAll('a')].some(a=>a.getAttribute('href')===href),href);
  assert.ok(document.getElementById('helpStatus').textContent.includes(question));
}
submit('P0301 battery light');
assert.equal(location.href,'/codes/?q=P0301');
submit('2012 Honda Civic the red battery picture came on');
assert.equal(location.href,'/symptoms/battery-light-on/?v=honda-civic&y=2012');
assert.match(submit('my oil is black').textContent,/couldn't match/i);
assert.match(submit('pineapple 2012 Honda Civic').querySelector('a').getAttribute('href'),/^\/vehicles\/honda-civic\/2012\/$/);
for(const query of ['battery low voltage','voltage warning','a 12 volt battery light','spark plugs squealing','idles at 1500 rpm']){
  const result=submit(query);
  assert.doesNotMatch(location.href+result.innerHTML,/v=(chevrolet|ram)|vehicles\/(chevrolet|ram)/,query);
}
for(const query of ['2016 Volt battery light','2016 Chevrolet Volt battery light']){
  submit(query);
  assert.equal(location.href,'/symptoms/battery-light-on/?v=chevrolet-volt&y=2016',query);
}
assert.equal(submit('').textContent,'');
assert.equal(document.getElementById('helpStatus').textContent,'');

// Danger phrases: the homepage must show the immediate safe action first and list the urgent guide first.
const emergencies=[
  ['my brakes stopped working','soft-or-spongy-brake-pedal'],['brakes failed','soft-or-spongy-brake-pedal'],
  ['my brakes don’t work','soft-or-spongy-brake-pedal'],['my car won’t stop','soft-or-spongy-brake-pedal'],
  ['brake pedal goes to the floor','soft-or-spongy-brake-pedal'],['my brakes are out','soft-or-spongy-brake-pedal'],
  ['red oil light','oil-pressure-light-on'],['my car is on fire','burning-smell'],
  ['my car shakes and the check engine light is flashing','check-engine-light-flashing'],
  ['flashing check engine light and shaking','check-engine-light-flashing'],
  ['my car died on the highway','engine-stalls-while-driving'],['smell exhaust inside the car and have a headache','exhaust-smell-in-cabin'],
  ['I smell gas','gas-smell'],['engine is overheating','engine-overheating'],['tire blew out','tire-keeps-losing-air']
];
for(const [query,id] of emergencies){
  const result=submit(query);
  assert.equal(location.href,'',query+' should not redirect past the safety step');
  assert.ok(result.querySelector('.urgentnow'),query+' should show the urgent safety step');
  assert.equal(result.querySelector('.glist a').getAttribute('href'),'/symptoms/'+id+'/',query);
}
for(const query of ['check engine light is not flashing','my car won’t stop beeping','car won’t stop running','squealing brakes','misfire',
  'shocks won’t stop bouncing','steering wheel locked','red oil under car','stuck in park no brake lights','transmission overheating light','oil change light'])
  assert.equal(window.VS_GUIDES.emergency(query),null,query+' is not an emergency');
// Under an emergency, unrelated guides that only share words like "stopped working" must not be listed.
assert.ok(!window.VS_GUIDES.search('my brakes stopped working',5).some(g=>g.id==='electrical-accessories-not-working'));
const co=submit('exhaust smell in the car');
assert.match(co.querySelector('.urgentnow').textContent,/call 911/);

let aliases=0;
for(const j of journeys){
  for(const phrase of j.synonyms){
    assert.ok(window.VS_GUIDES.search(phrase,5).some(hit=>hit.id===j.id),phrase+' should find '+j.id);
    aliases++;
  }
}
dom.window.close();
console.log('PASS raw homepage submissions, vehicle and code routing, clarifications and '+aliases+' published guide aliases.');
