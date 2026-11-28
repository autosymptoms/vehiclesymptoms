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
  const first=location.href || result.querySelector('a:not([href^="/roadside/"]):not([target])')?.getAttribute('href');
  assert.equal(first,'/symptoms/'+id+'/',query);
}
const clarifications=[
  ['it sounds like a helicopter when I go faster','What do you hear as the car speeds up?','/symptoms/humming-noise-at-speed/'],
  ['my car died','When does the engine stop?','/symptoms/engine-stalls-while-driving/'],
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
{const r=submit('pineapple 2012 Honda Civic');assert.ok([...r.querySelectorAll('a')].some(a=>/^\/vehicles\/honda-civic\/2012\/$/.test(a.getAttribute('href'))),'vehicle link on no-match');
 assert.ok(r.firstElementChild.classList.contains('roadline'),'no-match starts with the roadside line');}
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
  ['I smell gas','gas-smell'],['engine is overheating','engine-overheating'],['tire blew out','tire-blowout-or-flat'],
  ['P0300 and check engine light flashing','check-engine-light-flashing'],['my gas pedal is stuck','car-speeds-up-by-itself'],
  ['my car is accelerating on its own','car-speeds-up-by-itself'],['my accelerator is stuck','car-speeds-up-by-itself'],
  ['red oil light and a leak','oil-pressure-light-on'],
  ['breaks dont work','soft-or-spongy-brake-pedal'],['my breaks went out','soft-or-spongy-brake-pedal'],['check engin lite flashin','check-engine-light-flashing'],
  ['overheting','engine-overheating'],['smoke inside the car','burning-smell'],['headache when driving','exhaust-smell-in-cabin'],['dizzy in car','exhaust-smell-in-cabin'],
  ['temperature light flashing','engine-overheating']
];
for(const [query,id] of emergencies){
  const result=submit(query);
  assert.equal(location.href,'',query+' should not redirect past the safety step');
  assert.ok(result.querySelector('.urgentnow'),query+' should show the urgent safety step');
  assert.equal(result.querySelector('.glist a:not([href^="/roadside/"])').getAttribute('href'),'/symptoms/'+id+'/',query);
}
for(const query of ['check engine light is not flashing','my car won’t stop beeping','car won’t stop running','squealing brakes','misfire',
  'shocks won’t stop bouncing','steering wheel locked','red oil under car','stuck in park no brake lights','transmission overheating light','oil change light'])
  assert.equal(window.VS_GUIDES.emergency(query),null,query+' is not an emergency');
// Under an emergency, unrelated guides that only share words like "stopped working" must not be listed.
assert.ok(!window.VS_GUIDES.search('my brakes stopped working',5).some(g=>g.id==='electrical-accessories-not-working'));
// Vague danger wording shows the safety step first, then the easy question.
{const r=submit('smoke is coming out of the car');assert.ok(r.querySelector('.urgentnow'));
 assert.ok(r.textContent.includes('Where do you see the smoke, and what color is it?'));
 assert.ok([...r.querySelectorAll('a')].some(a=>a.getAttribute('href')==='/symptoms/steam-from-under-hood/'));}
for(const query of ['white smoke from exhaust','blue smoke at startup','black smoke'])assert.equal(window.VS_GUIDES.emergency(query),null,query+' is not a fire emergency');
// A trouble code with a danger sign keeps the code lookup as a link under the safety step.
assert.ok([...submit('P0300 and check engine light flashing').querySelectorAll('.glist a')].some(a=>a.getAttribute('href')==='/codes/?q=P0300'));
submit('P0300');assert.equal(location.href,'/codes/?q=P0300','a code on its own still goes to code lookup');
location.href='';
const co=submit('exhaust smell in the car');
assert.match(co.querySelector('.urgentnow').textContent,/call 911/);

// Nov 24 re-audit phrases: the safety step must be the right one, first.
{const r=submit('Lost power steering while driving');assert.match(r.querySelector('.urgentnow').textContent,/lose steering control/,'power steering loss gets the steering step');
 assert.doesNotMatch(r.querySelector('.urgentnow').textContent,/engine dies/,'power steering loss is not an engine stall');}
assert.equal(window.VS_GUIDES.emergency('engine lost power on the highway').rule,'stall','a real stall still gets the stall step');
for(const q of ['Engine temperature gauge just went into the red','temp needle hit the red','my temperature gauge is in the red'])
  assert.equal(window.VS_GUIDES.emergency(q).rule,'overheat',q);
for(const q of ['I accidentally put diesel in my gas car','put gas in my diesel truck','filled up with the wrong fuel','I pumped diesel by mistake'])
  {const e=window.VS_GUIDES.emergency(q);assert.equal(e&&e.rule,'wrong-fuel',q);assert.match(e.now,/don’t start the engine/i,q)}
for(const q of ['put regular gas instead of premium','wrong octane gas','put gas in my car'])assert.equal(window.VS_GUIDES.emergency(q),null,q+' is not a wrong-fuel emergency');
// Permanent table (tools/emergency-phrases.json): what the visitor sees first on the homepage.
{const T=JSON.parse(fs.readFileSync(path.join(__dirname,'emergency-phrases.json'),'utf8'));
 for(const [q,rule] of T.urgent){const e=window.VS_GUIDES.emergency(q);assert.equal(e&&e.rule,rule,q+' should raise '+rule);
   const r=submit(q);assert.equal(location.href,'',q+' must not redirect before the safety step');
   const box=r.firstElementChild;assert.ok(box&&box.classList.contains('urgentnow'),q+': the safety step must come first');assert.ok(box.textContent.includes(e.now),q+': wrong safety step shown')}
 for(const q of T.routine)assert.equal(window.VS_GUIDES.emergency(q),null,q+' is routine');
 submit('oil change light');assert.equal(location.href,'/warning-lights/oil-change-light/','a plain oil change reminder still goes to the routine page');location.href='';}
// ---- Nov 27 sweep (01-roadside-usability, 02-warning-lights) ----
const events=[];window.va=(kind,e)=>{if(kind==='event')events.push(e)};
const first=r=>r.firstElementChild;
const hrefs=r=>[...r.querySelectorAll('a')].map(a=>a.getAttribute('href'));
const urgentText=q=>{const r=submit(q);assert.equal(location.href,'',q);const b=first(r);assert.ok(b&&b.classList.contains('urgentnow'),q+': safety step first');return b.textContent};
// RS-01 + owner policy (Nov 27): no brake-pumping advice either way, on any brake step.
for(const q of ['brake pedal is hard as a rock','my brake pedal is hard and wont go down','brake pedal stiff and car barely slows','brake pedal hard and car wont stop']){
  const t=urgentText(q);assert.doesNotMatch(t,/pump/i,q);assert.match(t,/steady, heavy force/,q);assert.match(t,/hazard lights/,q);
  assert.ok(hrefs(submit(q)).includes('/symptoms/hard-brake-pedal/'),q+' lists the hard pedal guide')}
for(const q of ['brake pedal to floor','my brakes went to the floor','pedal went to the floor','brakes went out'])
  {const t=urgentText(q);assert.doesNotMatch(t,/pump/i,q);assert.match(t,/keep pressing the brake/,q);assert.match(t,/hazard lights/,q)}
// RS-03: after a stall, stay buckled in off the road; get out away from traffic only if stuck in a lane or smoke.
for(const q of ['my car died on the highway','car broke down on the highway']){const t=urgentText(q);assert.match(t,/stay inside with your seat belt on/,q);
  assert.match(t,/stuck in a traffic lane, keep your hazard lights on, stay buckled in and call 911/,q);assert.match(t,/Get out only if you see smoke or fire/,q)}
assert.match(submit('purple banana').firstElementChild.textContent,/stuck in a traffic lane, stay inside with your seat belt on/);
{submit('what should i keep in my car');assert.equal(location.href,'/roadside/emergency-kit/');location.href='';}
for(const [q,id] of [['my car is on fire','smoke-or-fire'],['brake pedal is hard as a rock','brakes-steering-pedal'],['red oil light','red-light-on']])
  assert.ok(hrefs(submit(q)).includes('/roadside/'+id+'/'),q);
// U-3: overheating says hazards and smoke means fire.
assert.match(urgentText('engine is overheating'),/hazard lights.*treat it as a fire/s);
// RS-06, RS-16: cruise control uses the stuck-pedal step; the card title says what is happening.
{const r=submit('cruise control wont turn off');assert.match(first(r).textContent,/press the brake firmly/);
 assert.match(r.querySelector('.glist a[href^="/symptoms/"] b').textContent,/speeds up on its own/);}
// RS-13: "steam" alone: overheat step first, then where it's coming from.
{const r=submit('steam');assert.ok(first(r).classList.contains('urgentnow'));assert.match(r.textContent,/Where is the steam coming from\?/);}
// Roadside situations: the safe step first, then the matching /roadside/ page (built from src/roadside/<id>.json).
const roadside={'got in an accident':'after-a-crash','airbags went off':'after-a-crash','deer hit my car':'after-a-crash',
  'car broke down on the highway':'broke-down','im stuck on the highway':'broke-down','my car died on the highway':'broke-down',
  'my car ran out of gas on the highway':'out-of-gas','water came up to the doors':'flooded-road','car hydroplaned':'skid-or-hydroplane',
  'car slid on ice':'skid-or-hydroplane','car stuck in snow':'stuck-in-snow','locked keys in car':'locked-out',
  'flat tire':'flat-tire','tire blew out':'flat-tire','popped tire':'flat-tire','how to jump start a car':'jump-start'};
for(const [q,id] of Object.entries(roadside)){const r=submit(q);assert.ok(first(r).classList.contains('urgentnow'),q);
  assert.ok(hrefs(r).includes('/roadside/'+id+'/'),q+' links /roadside/'+id+'/')}
assert.ok(hrefs(submit('how to jump start a car')).includes('/symptoms/car-wont-start/'),'jump start lists the no-start guide');
// Sources sit under the rewritten steps.
assert.match(submit('brake pedal is hard as a rock').querySelector('.urgentnow .fine').textContent,/Kia/);
// RS-02: every phrase that matched nothing in the Nov 27 audit now starts with a safety step or the roadside line, or goes to a page.
const audit72=["ran out of gas","got in an accident","hit a pothole","car slid on ice","locked keys in car","light shaped like a horseshoe","exclamation point light","how to change a tire","i hit a curb and now my car pulls","car broke down on the highway","my car broke down","stuck on the side of the road","car stuck in snow","car stuck in mud","how to jump start a car","car hydroplaned","drove through deep water","car stalled in flood water","i got rear ended","crashed my car","fender bender what do i do","deer hit my car","car is beeping","car went into the ditch","slid off the road","car spun out","car makes loud bang","popped tire","windshield wont defrost cant see","no headlights at night","airbag deployed","car wont unlock","out of gas","how far can i drive with gas light on","car rolling backwards","hood wont close","trunk light","door ajar light","seat belt light","check gas cap","car temp high","light looks like a submarine","i see sparks","thumping noise while driving","car rolled away","car wont strat","smok from hood","my car is making a loud noise and shaking","car stopped running","tire with exclamation point","feel sleepy in car","bumpy ride","door wont open","hazard lights not working","car revving high","car idling rough","my car ran out of gas on the highway","car broke down on the freeway","im stuck on the highway","feel sleepy in the car","my passengers have headaches","car hit deer and now wont start","airbags went off","water came up to the doors","drove through a flood and now it wont start","car slid into a ditch in the snow","stuck in snow tailpipe","i locked my keys in the car and its running","hood popped up while driving","door flew open while driving","car rolling while in park","hazard lights"];
for(const q of audit72){const r=submit(q);if(location.href)continue;const b=first(r);
  if(r.querySelector('.nomatch'))assert.ok(b.classList.contains('roadline')&&/hazard lights/.test(b.textContent)&&hrefs(r).includes('/roadside/'),q+': no-match must start with the roadside line')}
// RS-04: the safety question never outweighs the symptom, and is never answered with a promise.
{const r=submit('can i drive my car');assert.equal(location.href,'');assert.ok(first(r).classList.contains('safeline'));assert.match(r.textContent,/can’t promise any car is safe/);assert.match(r.textContent,/What did you notice first\?/);}
for(const q of ['is it safe to drive with the tire light on','Is it safe to drive with a tire pressure light?']){const r=submit(q);assert.equal(location.href,'',q);
  assert.ok(first(r).classList.contains('safeline'),q+': never-a-promise line first');assert.match(hrefs(r).slice(0,2).join(' '),/tire-pressure-light/,q+' finds the tire pressure light');}
// RS-09: light searches find the light pages.
for(const [q,to] of [['low fuel light','/warning-lights/low-fuel-light/'],['gas light on','/warning-lights/low-fuel-light/'],['how far can i drive with gas light on','/warning-lights/low-fuel-light/'],
  ['seat belt light','/warning-lights/seat-belt-light/'],['door ajar light','/warning-lights/door-open-light/'],['red triangle light','/warning-lights/master-warning-light/'],
  ['light shaped like a horseshoe','/warning-lights/tire-pressure-light/']]){submit(q);assert.equal(location.href,to,q);location.href=''}
{const r=submit('exclamation point light');assert.equal(location.href,'');assert.match(r.textContent,/Which light do you see\?/);
 assert.equal(r.querySelector('.glist a').getAttribute('href'),'/warning-lights/brake-warning-light/','red brake light listed first')}
// RS-07, RS-08, RS-17, RS-21: wording that went to the wrong place.
for(const [q,id] of [['car wont strat','car-wont-start'],['car turned off at a stop light','car-dies-when-coming-to-stop'],['my car wont turn on','car-wont-start']]){
  const r=submit(q);assert.equal(location.href||r.querySelector('.glist a')?.getAttribute('href'),'/symptoms/'+id+'/',q);location.href=''}
assert.match(submit('my car is shaking really bad').textContent,/When do you feel the shaking\?/);
{const r=submit('horn not working');assert.doesNotMatch(location.href+hrefs(r).join(' '),/airbag/,'horn is not the airbag light');location.href='';}
// Nov 27 finish (a15): the new guides are where these phrases land.
{const land=q=>{const r=submit(q);const to=location.href||r.querySelector('.glist a[href^="/symptoms/"]')?.getAttribute('href');location.href='';return {r,to}};
 for(const [q,id] of [['car wont stay in park','car-wont-stay-in-park'],['car rolls when parked','car-wont-stay-in-park'],
   ['horn not working','horn-not-working'],['hit a pothole','after-hitting-pothole'],['wipers not working','wipers-not-working'],
   ['ev wont charge','ev-wont-charge'],['car keeps beeping','car-keeps-beeping'],['car rolling while in park','car-wont-stay-in-park'],
   ['car rolling backwards','car-wont-stay-in-park'],['no headlights at night','light-out'],['headlights went out while driving','light-out']])assert.equal(land(q).to,'/symptoms/'+id+'/',q);
 for(const q of ['temp gauge rising','car is steaming'])assert.match(urgentText(q),/overheating/,q);
 assert.equal(window.VS_GUIDES.emergency('temp gauge going up and down'),null,'a gauge that moves up and down is the fluctuating-gauge guide');
 // RS-21: the rear lamps get the "drivers behind can't see you stop" line first, then the brake lights guide (not the red dash light).
 for(const q of ['brake lights out','brake lights not working']){const t=urgentText(q);assert.match(t,/drivers behind you can’t see you stop/,q);
   const {r,to}=land(q);assert.equal(to,'/symptoms/brake-lights-not-working/',q);assert.ok(!hrefs(r).includes('/symptoms/brake-warning-light-on/'),q+' is not the dash light')}
 // Tire emergencies: the blowout guide and the flat-tire roadside page.
 for(const q of ['tire blew out','flat tire on highway','popped tire']){const {r,to}=land(q);assert.ok(first(r).classList.contains('urgentnow'),q);
   assert.equal(to,'/symptoms/tire-blowout-or-flat/',q);assert.ok(hrefs(r).includes('/roadside/flat-tire/'),q+' links the flat-tire page')}
 // RS-16: the stuck-pedal card is the new guide under a title that says what is happening.
 for(const q of ['my gas pedal is stuck','car speeds up by itself']){const {r,to}=land(q);assert.equal(to,'/symptoms/car-speeds-up-by-itself/',q);
   assert.match(r.querySelector('.glist a[href^="/symptoms/"] b').textContent,/speeds up on its own or gas pedal stuck/,q);
   assert.ok(![...r.querySelectorAll('.glist a[href^="/symptoms/engine-revs-high-at-idle/"] b')].some(b=>/speeds up/.test(b.textContent)),q+': the idle guide keeps its own title')}
 {const t=urgentText('put diesel in my car');assert.match(t,/don’t start the engine/);assert.equal(land('put diesel in my car').to,'/symptoms/wrong-fuel/')}}
// Analytics: only the outcome type is sent, never the words typed.
events.length=0;submit('flat tire');submit('purple banana');submit('my car died');location.href='';
assert.deepEqual(events.filter(e=>e.name==='search_outcome').map(e=>e.type),['urgent','nomatch','question']);
assert.ok(!JSON.stringify(events).match(/banana|flat|died/),'analytics never carries the query');
let aliases=0;
for(const j of journeys){
  for(const phrase of j.synonyms){
    assert.ok(window.VS_GUIDES.search(phrase,5).some(hit=>hit.id===j.id),phrase+' should find '+j.id);
    aliases++;
  }
}
// Audit Nov 27: plain-language danger, codes mixed with danger, and negation.
const auditUrgent=[
  ['P0420 and my brakes barely work','brakes'],['brakes barely work','brakes'],['almost no brakes','brakes'],
  ['I have to push the brake pedal all the way to stop','brakes'],
  ['I was driving and my wheel stopped turning','steering'],['my steering wheel locked up while driving','steering'],
  ['battery light and wheel got hard to turn','steering-heavy'],['my wheel fell off','wheel-off'],['wheel came off while driving','wheel-off'],
  ['P0420 and my engine is hot','engine-hot'],['dash says stop safely now','stop-message'],['car says pull over safely','stop-message'],
  ['car running hot and no oil warning','overheat'],['check engine light flashing and car shaking','cel-flashing'],
  ['exhaust in the cabin','exhaust'],
  // Long stops and a pedal on the floor, with or without a trouble code.
  ['P0420 and the car takes forever to stop','brakes'],['P0420 and it takes twice as far to stop','brakes'],
  ['P0420 and I have to stand on the brakes','brakes'],['P0420 and the brake pedal is on the floor','brakes'],
  ['car takes forever to stop','brakes'],['have to stand on the brakes','brakes'],['brake pedal is on the floor','brakes'],
  ['takes much longer to stop','brakes'],['won\'t stop in time','brakes']
];
for(const [query,rule] of auditUrgent){
  const r=submit(query);
  assert.equal(location.href,'',query+': stays on the safety step');
  assert.ok(r.querySelector('.urgentnow'),query+': safety step first');
  assert.equal(window.VS_GUIDES.emergency(query).rule,rule,query);
}
for(const query of ['I push the clutch pedal all the way down to start','car says stop start system not available',
  'my steering wheel is hard to turn when parked','my hubcap fell off','brake pedal feels hard when the engine is off','my seat is hot',
  'wheel bearing noise while driving','brakes squeak when I stop',
  'takes forever to start','car stops fine','pedal goes to the floor when I accelerate',
  'engine takes forever to stop after I turn it off']){
  assert.equal(window.VS_GUIDES.emergency(query),null,query+': not an emergency');
}
for(const query of ['P0420 and my brakes barely work','P0420 and the car takes forever to stop','P0420 and it takes twice as far to stop',
  'P0420 and I have to stand on the brakes','P0420 and the brake pedal is on the floor']){
  const r=submit(query);
  assert.ok(r.querySelector('.urgentnow').compareDocumentPosition(r.querySelector('a[href="/codes/?q=P0420"]'))&4,query+': code link comes after the safety step');
}
// The parking brake is not the service brakes: no brake-failure step (it says to use the parking brake); the parking brake guide instead.
for(const query of ['parking brake barely works','parking brake doesn\'t hold','e-brake won\'t hold','emergency brake barely works','hand brake doesn\'t work']){
  assert.equal(window.VS_GUIDES.emergency(query),null,query+': not the brake-failure step');
  document.getElementById('helpResults').innerHTML='';
  const r=submit(query);
  assert.ok(!r.querySelector('.urgentnow'),query+': no safety step');
  assert.ok(location.href.startsWith('/symptoms/parking-brake-not-holding/')||r.querySelector('a[href^="/symptoms/parking-brake-not-holding/"]'),query+': parking brake guide');
}
assert.equal(window.VS_GUIDES.emergency('parking brake barely works and the brake pedal goes to the floor').rule,'brakes','service brakes still count beside the parking brake');
// A code alone still goes straight to the code page.
submit('P0420');assert.equal(location.href,'/codes/?q=P0420','code alone goes to the code page');
assert.notEqual(window.VS_GUIDES.emergency('car running hot and no oil warning').rule,'oil');
assert.ok(!window.VS_GUIDES.emergency('the oil light is off but the engine is overheating').also.some(t=>/oil light/i.test(t)));
// Everyday verb forms land on the same guide as the -ing form (Nov 27: "bucks" found nothing, "bucking" worked).
for(const [query,id] of [['bucks','car-jerks-when-accelerating'],['my car bucks when I accelerate','car-jerks-when-accelerating'],['truck bucked','car-jerks-when-accelerating'],['jerked','car-jerks-when-accelerating'],['lurching','car-jerks-when-accelerating'],['engine surges','engine-revs-high-at-idle'],['rpm surging','engine-revs-high-at-idle']]){
  submit(query);assert.equal(location.href,'/symptoms/'+id+'/',query);
}
dom.window.close();
console.log('PASS raw homepage submissions, vehicle and code routing, clarifications and '+aliases+' published guide aliases.');
