// Symptom guides: search index helpers, the guided question flow, and the /symptoms/ hub.
(function(){
const G=window.GUIDE_INDEX||[];
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const GROUPS={start:"Won't start",light:"Warning light",noise:"Noise",shake:"Shaking",leaksmell:"Leak, smell or smoke",hot:"Running hot",drive:"Driving & handling"};
const URG={
  stop:{label:"Stop — don't drive it",cls:"high",line:"Don't drive it until it's checked."},
  soon:{label:"Get it checked in the next few days",cls:"med",line:"Drive only if you must, gently and close to home."},
  check:{label:"Book a check when convenient",cls:"info",line:"Not an emergency, but don't ignore it."},
  diy:{label:"Check it yourself first",cls:"low",line:"Start with the simple checks below."}
};
window.VS_GUIDES={G,GROUPS,URG,esc,search,emergency,exactGuide,clarifySearch,noticeFirst:()=>noticeFirst,askFollow:k=>askFollow[k]||null,forIssue,matchesGuide,gurl:id=>'/symptoms/'+id+'/',
  safeAsk,lights:lightMatches,lightQuery,fuelLight,lightGuides:id=>LIGHT_GUIDES[id]||[],track};
// Anonymous analytics (Vercel Web Analytics, as in pwa.js). Never send what the person typed.
function track(name,props){try{if(window.va)window.va('event',Object.assign({name},props||{}))}catch(e){}}

// ---- Year / Make / Model picker, used on the homepage and in guide results ----
// fill(ySel,mSel,moSel,{year,id},onChange): only offers makes/models actually sold in the chosen year.
window.YMM=function(ys,ms,mos,init,onChange){
  const V=window.VEHICLES||[];const sold=(v,y)=>y>=v.years[0]&&y<=v.years[1]&&!(v.gaps||[]).some(g=>y>=g[0]&&y<=g[1]);
  let maxY=Math.max(...V.map(v=>v.years[1])),minY=Math.min(...V.map(v=>v.years[0]));
  ys.innerHTML='<option value="">Year</option>';for(let y=maxY;y>=minY;y--)ys.add(new Option(y,y));
  function makes(){const y=+ys.value;ms.innerHTML='<option value="">Make</option>';mos.innerHTML='<option value="">Model</option>';mos.disabled=true;
    if(!y){ms.disabled=true;return}ms.disabled=false;[...new Set(V.filter(v=>sold(v,y)).map(v=>v.make))].sort().forEach(m=>ms.add(new Option(m,m)))}
  function models(){const y=+ys.value,m=ms.value;mos.innerHTML='<option value="">Model</option>';if(!m){mos.disabled=true;return}mos.disabled=false;
    V.filter(v=>v.make===m&&sold(v,y)).sort((a,b)=>a.model.localeCompare(b.model)).forEach(v=>mos.add(new Option(v.model,v.id)))}
  ys.onchange=()=>{makes();onChange&&onChange()};ms.onchange=()=>{models();onChange&&onChange()};mos.onchange=()=>{onChange&&onChange()};
  if(init&&init.id){const v=V.find(x=>x.id===init.id);if(v){if(init.year)ys.value=init.year;else ys.value=v.years[1];makes();ms.value=v.make;models();mos.value=v.id}}else{makes()}
  return{get:()=>({v:V.find(x=>x.id===mos.value)||null,y:+ys.value||null})};
};

// ---- search: ranks guides against free text ----
// Score each title or alias as a phrase. Words from unrelated aliases on the same guide
// should never combine to create an apparently exact match.
const searchNoise = new Set(('a an the i my me this that is are was were it its on and to in of or when at ' +
  'with as from while under car truck vehicle has have had why does did do just really very keeps ' +
  'like little looks looking there theres see saw some something makes making getting suddenly up').split(' '));
const searchWords = {
  lights:'light', pictures:'light', picture:'light', icon:'light', symbol:'light', indicator:'light',
  dashboard:'dash', shimmies:'shake', shimmy:'shake', shudders:'shake', shudder:'shake',
  shakes:'shake', shaking:'shake', shaky:'shake', vibrates:'shake', vibration:'shake', vibrating:'shake',
  wobbles:'shake', wobble:'shake', wobbling:'shake', brakes:'brake', braking:'brake',
  noises:'noise', sounds:'sound', smells:'smell', eggs:'egg', grinding:'grind', grinds:'grind',
  squealing:'squeal', squeals:'squeal', squeaking:'squeak', squeaks:'squeak',
  starts:'start', starting:'start', clicks:'click', clicking:'click', clicked:'click',
  leaks:'leak', leaking:'leak', turns:'turn', turning:'turn', accelerating:'accelerate',
  freeway:'highway', interstate:'highway', motor:'engine', quit:'stalls', quits:'stalls',
  flashes:'flashing', blinking:'flashing', blinks:'flashing',
  squeek:'squeak', squeeks:'squeak', squeeking:'squeak', squeeky:'squeak', squeaky:'squeak', squeel:'squeal', squeeling:'squeal',
  breaks:'brake', break:'brake', headlights:'headlight',
  strat:'start', strats:'start', smok:'smoke', steaming:'steam', steams:'steam'
};
// Words that say something is wrong without saying what. A guide needs at least one other word in common,
// so "wipers not working" doesn't land on "heater not working".
const searchGeneric = new Set(['not','working','work','works','wont','dont','doesnt','cant','stopped','stop','broken','broke','bad','problem','issue','issues','out','off','on','weird','strange','funny']);
function literalSymptom(text){
  return String(text).toLowerCase().replace(/['’]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
}
// "Is it safe to drive with the tire light on?" is a question about the tire light. The safety question
// itself must never outweigh the symptom, and we never answer it with a promise (RS-04).
const SAFE_LINE='We can’t promise any car is safe to drive. Pull over and get help now if a red light is on, the check engine light is flashing, you smell fuel or burning, see smoke, or the brakes or steering feel wrong.';
// First line of any search we can't match: someone may be typing from the shoulder (RS-02). Sources: AAA, NY DMV.
const ROAD_LINE='turn on your hazard lights and get off the road if you can. If you’re stuck in a traffic lane, stay inside with your seat belt on and call 911. Call 911 too if anyone is hurt. If you see smoke or fire, get out on the side away from traffic.';
const safeRx=/^(?:(?:so|ok|okay|hey|um|please) )*(?:(?:is it|its|it is|is|am i|are we|would it be|will it be) (?:still |really )?(?:safe|ok|okay|alright|all right|fine|bad|dangerous) (?:for me )?to (?:keep |still )?(?:drive|driving|drive on)|(?:can|should|could|may) i (?:still |keep |continue to |continue )?(?:drive|driving)|how (?:long|far) can i (?:drive|go|keep driving)|safe to drive)(?: (?:my|the|this|a) (?:car|truck|vehicle|suv|van))?(?: it)?(?: (?:with|on|when|if|while|after|like this|like that|anymore|now|today|still))*\b/;
Object.assign(window.VS_GUIDES,{SAFE_LINE,ROAD_LINE});
function safeAsk(text){
  const lit=literalSymptom(text);const m=lit.match(safeRx)||lit.match(/\b(?:is it |its )?safe to (?:keep )?drive(?: (?:with|on|when|if|while))?\b/);
  if(!m)return{text:String(text),asked:false};
  return{text:lit.replace(m[0],' ').replace(/\s+/g,' ').trim(),asked:true};
}
function symptomWords(text){
  const words = safeAsk(text).text.toLowerCase().replace(/['’]/g,'').replace(/[^a-z0-9]+/g,' ').trim()
    .replace(/\b(?:isnt|not|never) (?:flashing|blinking)\b|\b(?:doesnt|does not) (?:flash|blink)\b/g,'steady')
    .replace(/\b(?:will not)\b/g,'wont')
    .replace(/\b(?:came|comes|coming|turned) on\b/g,' ')
    .replace(/\b(?:slow|slows|slowing) down\b/g,'stopping')
    .replace(/\b(?:step|stepping|press|pressing|hit|hitting) (?:on )?(?:the |my )?(gas|accelerator)\b/g,'accelerate')
    .trim().split(/\s+/);
  return [...new Set(words.filter(word=>word && !searchNoise.has(word)).map(word=>Object.hasOwn(searchWords,word)?searchWords[word]:word))];
}
// Additional observations that lead into existing guides.
const everydayPhrases={
  'car-wont-start':['It just clicks when I try to start it','A clicking sound when I try to start'],
  'vibration-at-highway-speed':['Steering wheel shakes on the highway'],
  'car-wont-turn-off':['Car wont stop running','Engine wont shut off'],
  'engine-overheating':['Thermometer light on','Temperature light on','Temp light on','Thermometer in water light'],
  'brake-warning-light-on':['Emergency brake light on','Handbrake light on','Parking brake light on'],
  'fluid-leak-under-car':['Puddle where I parked','Puddle on my driveway','Puddle in my parking spot'],
  'headlights-dim-or-flickering':['Headlight out','Headlight not working','Headlight burned out'],
  'electrical-accessories-not-working':['Wipers not working','Windshield wipers stopped','Turn signals not working']
};
// "Won't crank" means the engine doesn't turn over at all: a no-start, not a slow crank.
everydayPhrases['car-wont-start'].push('Car wont crank','Engine wont crank','Wont turn over','Car wont turn over',
  // RS-08: "turn on" means start, not "won't shut off".
  'Car wont turn on','Car won’t turn on','Engine wont turn on');
// RS-08: dying at a stop light is not "won't shut off".
everydayPhrases['car-dies-when-coming-to-stop']=['Car turned off at a stop light','Car shuts off at red light','Turns off when I stop','Car turns off at stop signs'];
// RS-17: thumping or flapping from a tire can be the tread coming apart.
everydayPhrases['tire-blowout-or-flat']=['Thumping while driving','Thumping noise while driving','Flapping from tire','Flapping noise from tire','Popped tire','My tire is flat','Flat tire on the highway'];
// RS-21: a horn that won't sound is not the airbag light, even though the horn pad sits on the airbag.
everydayPhrases['horn-not-working']=['Horn not working','Horn doesnt work','Horn stopped working','Horn wont honk'];
// A "check gas cap" or "check fuel cap" message: a loose cap is a common reason for the steady check engine light.
everydayPhrases['check-engine-light-on']=['Check gas cap','Check fuel cap message','Gas cap light'];
// Fallbacks while a newer guide doesn't exist yet: the nearest existing guide keeps the phrase from matching nothing.
const phraseFallback={'tire-blowout-or-flat':'tire-keeps-losing-air','horn-not-working':'electrical-accessories-not-working'};
let searchIndex;
function getSearchIndex(){
  if(searchIndex)return searchIndex;
  const frequencies=new Map();
  const has=new Set(G.map(g=>g.id));
  const borrowed=id=>Object.keys(phraseFallback).filter(from=>phraseFallback[from]===id&&!has.has(from)).flatMap(from=>everydayPhrases[from]||[]);
  const guides=G.map(guide=>{
    const phrases=[guide.title,...(guide.syn||[]),...(everydayPhrases[guide.id] || []),...borrowed(guide.id)].map(text=>({literal:literalSymptom(text),words:symptomWords(text)}))
      .filter(phrase=>phrase.words.length);
    for(const word of new Set(phrases.flatMap(phrase=>phrase.words)))frequencies.set(word,(frequencies.get(word)||0)+1);
    return {guide,phrases};
  });
  // Common terms such as "light" carry less evidence than a word like "battery".
  const weight=word=>1+Math.log((G.length+1)/((frequencies.get(word)||0)+1));
  searchIndex={weight,guides:guides.map(({guide,phrases})=>({guide,
    phrases:phrases.map(({literal,words})=>({literal,words,weight:words.reduce((sum,word)=>sum+weight(word),0)}))}))};
  return searchIndex;
}
// ---- emergencies: checked before any ordinary word matching ----
// Plain-language danger phrases must put the urgent guide first, with the immediate safe action shown
// before anything else. Order matters: the first rule that matches supplies the "do this now" text.
const notStopping='(?! (?:\\w+ing|the|my|it|its)\\b)';
// Sources behind the "do this first" lines we rewrote or added in the Nov 27 sweep (shown under the step).
const SRC={
  aaaStay:['AAA','https://cluballiance.aaa.com/the-extra-mile/advice/car/staying-safe-when-your-car-breaks-down'],
  aaaBreak:['AAA','https://mwg.aaa.com/via/car/what-to-do-when-your-car-breaks-down'],
  aaaTire:['AAA','https://www.aaa.com/autorepair/articles/how-to-change-a-tire-in-11-easy-steps'],
  aaaJump:['AAA','https://www.aaa.com/autorepair/articles/how-to-jump-a-battery-and-get-yourself-back-on-the-road'],
  riDmv:['Rhode Island DMV driver manual','https://dmv.ri.gov/sites/g/files/xkgbur556/files/documents/manuals/Driver_Manual.pdf'],
  nyDmv:['New York DMV driver manual','https://dmv.ny.gov/new-york-state-drivers-manual-practice-tests/chapter-12-if-you-are-traffic-crash'],
  kia:['Kia owner’s manual','https://ownersmanual.kia.com/full_webhelp/MQ4KH/2027/en_US/topics/t00435.html'],
  nws:['National Weather Service','https://www.weather.gov/safety/flood-turn-around-dont-drown'],
  nwsDuring:['National Weather Service','https://www.weather.gov/safety/flood-during'],
  nhtsaWinter:['NHTSA','https://nhtsa.gov/winter-driving-tips']
};
const emergencyRules=[
  // RS-01: a suddenly hard pedal means the power assist is gone. Pumping uses up what assist is left: press steadily instead.
  {id:'brake-hard',topic:/brak/i,drops:['brakes'],page:'brakes-steering-pedal',
    rx:/\bbrake pedal\b.*\b(?:hard|stiff|rock|wont (?:go down|press|push|move)|cant (?:press|push)|stuck|jammed)\b|\b(?:hard|stiff)\b.*\bbrake pedal\b|\bbrakes? (?:are |is |feel |feels |got |went |suddenly )*(?:hard|stiff|rock hard) to (?:press|push)\b|\bbrakes? (?:suddenly )?(?:went|got|are|feel|feels) (?:really |very |super )?(?:hard|stiff|rock hard)\b/,
    // A pedal that sinks is the brake-failure step; a hard pedal with the engine off is normal.
    skip:/\b(?:floor|carpet|floorboard|sinks|sank|all the way down|goes down|went down|no resistance|soft|spongy|squishy)\b|\b(?:engine|car|truck|it) (?:is |was )?(?:off|not running)\b|\bbefore (?:i )?start|\bwhen (?:i )?(?:start|starting)\b|\bcold start\b|\bwont start\b/,
    guides:['hard-brake-pedal','brake-warning-light-on'],src:[SRC.kia],
    now:'If the brake pedal is suddenly very hard: push it with steady, heavy force and keep pushing. Don’t pump it. The car will take longer to stop. Turn on your hazard lights, steer to a safe spot, and don’t drive it again until it’s checked.'},
  {id:'brakes',topic:/brak/i,page:'brakes-steering-pedal',
    rx:new RegExp('\\bbrakes? (?:are |is |have |has |just |completely |totally )*(?:stopped|stop|quit|quits|failed|fail|failing|gave out|went out|gone|out|not working|dont work|do not work|doesnt work|does not work|arent working|wont work|isnt working|wont stop)\\b'+
      '|\\b(?:no|lost|losing|lose|without) (?:my |the |any )?brakes?\\b(?! lights?\\b)|\\bbrake failure\\b'+
      '|(?:^|\\b(?:car|it|truck|vehicle|suv|van|brakes?|i|we)\\s+)(?:wont|cant|will not|cannot|can not|couldnt|doesnt|does not|isnt) (?:stop|slow down|slow)\\b'+notStopping+
      '|\\b(?:pedal|brakes?) (?:goes |go |went |going |gone |sinks |sank |sink |dropped |drops |fell |falls )?(?:straight |right )?(?:all the way )?(?:to|on|into) (?:the )?(?:floor|carpet|mat|floorboard)\\b'+
      '|\\b(?:brakes?|pedal) (?:\\w+ ){0,2}(?:went|gone|suddenly went|suddenly got|suddenly feels?|all of a sudden went) (?:really |very |super |completely )?soft\\b'+
      '|\\b(?:barely|hardly|wont|doesnt|isnt|not) (?:slow|slows|slowing|stop|stops|stopping)(?: down)?\\b.*\\bbrak|\\bbrak\\w*\\b.*\\b(?:barely|hardly) (?:slow|slows|stop|stops)'+
      '|\\bpedal\\b.*\\b(?:barely|hardly) (?:slows?|stops?)\\b'+
      '|\\bbrake pedal\\b.*\\b(?:all the way down|goes down|went down|sinks|sank|no resistance)\\b'+
      '|\\b(?:cant|wont|cannot) stop\\b.*\\bbrak|\\bbrak\\w*\\b.*\\b(?:cant|wont) stop\\b'),
    skip:/^(?!.*\bbrak).*\b(?:gas pedal|accelerator|throttle|gas is stuck)\b/,
    guides:['soft-or-spongy-brake-pedal','brake-warning-light-on','brake-fluid-leak'],src:[SRC.riDmv],
    // Pumping is only for a pedal that sinks (it can build back some pressure). A hard pedal has its own rule above.
    now:'If your brakes fail while driving: turn on your hazard lights. If the pedal sinks to the floor, pump it hard and fast. Shift to a lower gear and pull the parking brake on gradually. Steer to a safe spot. Once stopped, don’t drive it again. Have it towed.'},
  // The red BRAKE warning on the dash (not the rear brake lamps). Wording from the brake warning light page.
  {id:'brake-light',topic:/brak/i,page:'red-light-on',
    rx:/\bred brake\b|\bbrake (?:warning|system) (?:light|lamp|indicator|warning)\b|\bbrake (?:warning )?(?:light|lamp)\b.*\b(?:dash|dashboard|cluster|stays on|still on|wont go off|wont turn off|keeps coming on|wont go out)\b|\b(?:dash|dashboard)\b.*\bbrake (?:light|lamp)\b/,
    skip:/\bbrake lights? (?:are |is )?(?:out|not working|dont work|doesnt work|burnt out|burned out)\b|\b(?:rear|third|tail) brake lights?\b/,
    guides:['brake-warning-light-on','soft-or-spongy-brake-pedal'],
    now:'Release the parking brake first. If the red brake light stays on, don’t drive until it’s checked, even if the pedal feels normal. Low brake fluid can mean a leak and brakes that may not stop the car. If the pedal feels soft or sinks, don’t drive: have it towed.'},
  {id:'accelerator',topic:/idle|rev|accelerat|gas pedal|throttle|cruise/i,drops:['brakes'],page:'brakes-steering-pedal',
    labels:{'engine-revs-high-at-idle':['Car speeds up on its own or gas pedal stuck','What to check after the car is safely stopped']},
    skip:/^(?!.*\b(?:gas|accelerator|throttle)\b).*\b(?:brake|clutch) pedal\b/,
    rx:/\b(?:gas pedal|accelerator|throttle|pedal)\b.*\b(?:stuck|sticking|sticks|jammed|wont come up|wont come back up|wont return|wont close|wont release|stays down|stuck down)\b|\b(?:keeps|kept|still|wont stop) (?:accelerating|speeding up|going faster|revving up)\b|\bfoot (?:is )?off the gas\b.*\b(?:accelerat|speed|faster)|\b(?:stuck|jammed)\b.*\b(?:gas pedal|accelerator|throttle)\b|\b(?:accelerat\w*|speeding up|speeds up|going faster|surging|surges) (?:on its own|by itself|without me|without pressing)|\b(?:wont|cant) (?:slow down|stop accelerating)\b|\bunintended acceleration\b|\b(?:speeding up|speeds up|accelerating|accelerates|going faster|revving)\b.*\bfoot (?:is )?(?:off|not on) the (?:gas|pedal|accelerator)\b|\bfoot (?:is )?(?:off|not on) the (?:gas|pedal|accelerator)\b.*\b(?:speeding up|speeds up|accelerating|accelerates|going faster)\b|\bcruise(?: control)?\b.*\b(?:wont|cant|doesnt|didnt|wouldnt|isnt|not) (?:turn off|turning off|shut off|shutting off|disengage|disengaging|cancel|canceling|cancelling|go off|release|let go|stop|slow down)\b|\bcruise(?: control)? (?:is |got |stays )?(?:stuck|locked|stuck on)\b/,
    guides:['engine-revs-high-at-idle'],
    now:'If the car speeds up on its own or the gas pedal sticks: press the brake firmly and hold it (don’t pump), shift to neutral, and steer to a safe spot. Once stopped, turn the engine off. With a push-button start you may need to hold the button for a few seconds. Check that a floor mat isn’t trapping the pedal, and don’t drive it again until it’s checked.'},
  {id:'fire',topic:/burn|smoke|steam|fire/i,page:'smoke-or-fire',
    rx:/\b(?:on fire|fire|flames?|flaming|caught fire|catching fire|burning up)\b|\bsmok(?:e|es|ing|ey|y)\b/,
    // Tailpipe smoke ("white smoke from exhaust") is not a fire emergency unless flames are mentioned.
    skip:/^(?!.*\b(?:fire|flames?|flaming|hood|bonnet|engine bay|engine compartment|front|front end|grille|wheel well|dash|dashboard|vents?|cabin|steering column|under the car)\b).*\b(?:exhaust|tailpipe|tail pipe|muffler|white|blue|black|gray|grey|idle|idling|startup|start up|starting|cold start|turbo|puff|burning oil|oil change)\b/,
    guides:['burning-smell','steam-from-under-hood'],
    now:'If you see smoke and think your car may be on fire, pull over as soon as it’s safe and turn off the engine. Get everyone out. Leave the hood closed. Move at least 100 feet from the car and stay away from traffic. Call 911 from a safe spot, even if you can’t see flames.'},
  {id:'exhaust',topic:/exhaust|fume|smell/i,
    rx:/\b(?:carbon monoxide|exhaust (?:smell|fumes?|inside|in the car|in the cabin|getting in)|exhaust (?:\w+ ){0,2}(?:into|inside|in) (?:the |my )?(?:car|cabin|truck|van|suv)|fumes? (?:inside|in the car|in the cabin)|smell(?:s|ing)? (?:like )?exhaust)\b|\b(?:headache|dizzy|dizziness|nausea|nauseous|sleepy|drowsy|lightheaded)\b.*\b(?:exhaust|fumes?|smell)\b|\b(?:exhaust|fumes?)\b.*\b(?:headache|dizzy|dizziness|nausea|nauseous|sleepy|drowsy|lightheaded)\b|\b(?:headaches?|dizzy|dizziness|nausea|nauseous|lightheaded|light headed|sleepy|drowsy)\b.*\b(?:driving|in (?:the |my )?car|in (?:the |my )?truck|inside the car|while i drive|when i drive)\b|\b(?:passengers?|everyone|everybody|kids|children|we all|all of us|we both|we)\b(?: \w+){0,3} (?:have|has|had|got|get|getting|feel|feels|felt|are|were)(?: \w+){0,2} (?:headaches?|dizzy|nauseous|sick|sleepy|drowsy|lightheaded|light headed)\b/,
    guides:['exhaust-smell-in-cabin'],
    now:'If anyone has a headache, dizziness, nausea, confusion or feels sleepy, this may be carbon monoxide poisoning. Get everyone into fresh air right away and call 911 from outside the car.'},
  {id:'gas',topic:/gas|fuel/i,
    rx:/\b(?:gas|gasoline|fuel)\b(?! (?:pedal|mileage|cap|light|gauge|tank is empty))(?: \w+){0,2} (?:smell|smells|smelling|leak|leaks|leaking|dripping|drips|puddle|pooling|pouring|spraying|sprays|squirting|gushing)\b|\b(?:leaking|dripping|pouring|spraying)\b(?: \w+){0,2} (?:gas|gasoline|fuel)\b|\bsmell(?:s|ing)? (?:like |of )?(?:gas|gasoline|fuel)\b|\bleaking (?:gas|gasoline|fuel)\b/,
    guides:['gas-smell'],
    now:'If you smell strong fuel or see it dripping: if you’re driving, pull over when it’s safe and turn the engine off; if you’re parked, don’t start it. Keep sparks and cigarettes away and move away from the car. Call 911 if the smell is strong or fuel is pooling.'},
  {id:'stall',topic:/stall|dies|shut|power|start/i,
    rx:/\b(?:died|dies|dying|stalled|stalls|stalling|stopped|shut off|shuts off|shut down|shuts down|cut out|cuts out|turned off|turns off|quit|quits|lost power(?! steering)|loses power(?! steering))\b.*\b(?:highway|freeway|interstate|driving|road|traffic|moving|at speed)\b|\b(?:highway|freeway|interstate|driving)\b.*\b(?:died|stalled|stopped|shut off|shut down|cut out|turned off|quit)\b/,
    skip:/^(?=.*\bsteering\b)(?!.*\b(?:engine|motor)\b)(?!.*\b(?:stalled|stalls|stalling|died|dies|dying|shut off|shuts off|cut out|cuts out)\b)/,
    guides:['engine-stalls-while-driving'],drops:['broke-down'],page:'broke-down',src:[SRC.aaaStay,SRC.riDmv],
    now:'If the engine dies while you’re moving: turn on your hazard lights, shift to neutral, hold the wheel firmly (steering and brakes get much heavier) and steer as far onto the shoulder as you can. Once stopped, stay inside with your seat belt on and call for help. If you’re stuck in a traffic lane, keep your hazard lights on, stay buckled in and call 911. Get out only if you see smoke or fire: use the side away from traffic and wait well back from the road, behind a guardrail if there is one.'},
  // Wrong fuel type (diesel in a gas car, gas in a diesel). A grade mix-up (regular instead of premium) is not this.
  {id:'wrong-fuel',topic:/fuel|diesel|gas|sputter|misfire|stall|dies/i,
    rx:/\bdiesel\b.*\b(?:in|into)\b.*\b(?:gas|gasoline|unleaded)\b|\b(?:gas|gasoline|unleaded)\b.*\b(?:in|into)\b.*\bdiesel\b|\b(?:put|putting|filled|fill|filling|pumped|pumping|added|adding|fueled|fuelled)\b(?: \w+){0,3} (?:diesel|the wrong fuel|wrong fuel)\b|\b(?:wrong|incorrect) (?:fuel|kind of fuel|type of fuel|fuel type)\b|\bmisfuel\w*\b/,
    skip:/^(?!.*\bdiesel\b).*\b(?:regular|premium|octane|mid ?grade|plus|87|89|91|93|e15|e85)\b/,
    guides:['engine-sputtering-misfire','starts-then-dies'],
    now:'If the wrong type of fuel went in (diesel in a gas car, or gas in a diesel): don’t start the engine. If it’s running, pull over when it’s safe and turn it off. Don’t restart it. Have it towed: the tank will need to be drained.'},
  {id:'cel-flashing',topic:/engine|misfire|shak/i,page:'red-light-on',
    rx:/\b(?:check engine|engine light|engine warning|cel|service engine)\b.*\b(?:flash|flashing|blinking|blink|blinks|flashes)\b|\b(?:flash|flashing|blinking|blink|blinks|flashes)\b.*\b(?:check engine|engine light|engine warning|cel|service engine)\b/,
    guides:['check-engine-light-flashing'],
    now:'A flashing check engine light means a severe misfire that can overheat the exhaust and start a fire. Ease off the gas, pull over when it’s safe and turn the engine off. Don’t keep driving.'},
  {id:'oil',topic:/oil/i,page:'red-light-on',
    rx:/\boil pressure\b(?! (?:sensor|switch|sending unit) (?:code|replacement))|\bred oil (?:light|can|lamp|symbol|icon|warning)\b|\b(?:low )?oil (?:light|warning|can|lamp|symbol|icon)\b(?!.*\b(?:change|life|service|maintenance|reset|due)\b)/,
    guides:['oil-pressure-light-on'],
    now:'A red oil light while the engine is running means low oil pressure. Pull over as soon as it’s safe and turn the engine off. Driving on can wreck the engine within minutes.'},
  {id:'overheat',skip:/\btransmission\b|\btrans temp\b/,topic:/overheat|temperature|coolant|steam/i,
    rx:/\b(?:overheat|overheating|overheated|temp(?:erature)? (?:light|warning|gauge)(?: is)? (?:red|high|on|hot|up|flashing|blinking)|(?:steam|smoke) (?:from|under|out of|coming out of) (?:the )?hood|running (?:very |really )?hot)\b|\b(?:temp|temperature) (?:gauge|needle|light)\b(?: \w+){0,5} (?:red|high|hot|max)\b|\b(?:temp|temperature|gauge|needle)\b.*\b(?:in|into|to|on|at|hit|hits|hitting) the red\b|\b(?:engine )?temp(?:erature)? (?:warning|light)\b|\bsteam\w*\b.*\b(?:hood|bonnet|radiator|engine bay)\b|\b(?:temp|temperature|gauge|needle)\b(?: \w+){0,4} (?:to|on|at|hit|hits|hitting|reads|reading|past|near|by) (?:the )?(?:h|hot)\b|\bboil(?:ing|ed|s)? over\b|\b(?:coolant|radiator|antifreeze)\b.*\bboil\w*|\bboil\w*\b.*\b(?:coolant|radiator|antifreeze)\b|\b(?:temp|temperature)\b(?: \w+){0,2} (?:high|hot|too high|too hot|way up)\b|\bsteam\w*\b.*\b(?:engine|motor|front)\b|^(?:(?:there is|theres|i see|im seeing|seeing|lots of|white) )?steam(?:ing)?(?: (?:coming out|coming from (?:the |my )?car|from (?:the |my )?car|everywhere))?$/,
    guides:['engine-overheating','steam-from-under-hood'],
    now:'If the engine is overheating: turn on your hazard lights, pull over when it’s safe and turn the engine off. Never open the radiator or coolant cap while it’s hot. Wait at least 30 minutes. If the steam turns to smoke, treat it as a fire: get everyone out and move well away from the car.'},
  {id:'blowout',topic:/tire|flat/i,
    rx:/\b(?:blow ?out|blew out|tire (?:\w+ ){0,2}(?:exploded|burst|popped|blew|shredded)|flat tire while driving)\b|\btire\b(?: \w+){0,3} (?:went|goes|going|gone|went totally|went completely) flat\b.*\b(?:highway|freeway|interstate|driving|moving|road|at speed)\b|\b(?:highway|freeway|interstate|driving|moving)\b.*\btire\b(?: \w+){0,3} (?:went|goes|going|gone) flat\b|\bflat\b(?: \w+){0,3} (?:while|when) (?:driving|moving)\b|\bpopped (?:a |my |the )?(?:front |back |rear )?tire\b/,
    guides:[['tire-blowout-or-flat','tire-keeps-losing-air']],drops:['flat'],page:'flat-tire',src:[SRC.riDmv],
    now:'If a tire blows out: hold the steering wheel firmly, keep going straight, and ease off the gas. Don’t slam the brakes. Brake gently once you’ve slowed down, then pull fully off the road.'},
  // A bulge or bubble on a tire can fail without warning. Wording from the tire guide's safety list.
  {id:'tire-bulge',topic:/tire|flat/i,
    rx:/\b(?:bulge|bulges|bulging|bubble|blister|lump|knot)\b.*\b(?:tire|sidewall)\b|\b(?:tire|sidewall)\b.*\b(?:bulge|bulges|bulging|bubble|blister|lump)\b|\b(?:cords?|belts?|wires?) (?:showing|show|sticking out|visible)\b.*\btire\b|\btire\b.*\b(?:cords?|wires?) (?:showing|sticking out|visible)\b/,
    skip:/\bsoap\w*|\bspray\w*|\bwater\b/,drops:['flat'],
    guides:[['tire-blowout-or-flat','tire-keeps-losing-air']],
    now:'If you see a bulge, bubble, deep cut or cords showing on a tire, don’t drive on it. Put on the spare or call roadside help.'},
  // A wheel or tire coming off at speed. Same first action as a blowout, then don't drive it.
  {id:'wheel-off',topic:/tire|wheel|flat/i,
    rx:/\b(?:tire|wheel|tyre)\b(?: \w+){0,2} (?:came|come|coming|fell|falls|flew|flying|is coming) off\b|\b(?:lost|losing) (?:a |the |my )?(?:front |rear |back )?(?:wheel|tire)\b|\bwheel (?:is )?(?:wobbling|loose)\b.*\b(?:driving|highway|moving|road)\b/,
    skip:/\b(?:cover|covers|hubcap|hub cap|center cap|trim|rim at|at the shop|tire shop|bead|valve)\b|^(?!.*\b(?:driving|drive|highway|freeway|moving|road|speed|while|lost|losing|wobbling)\b)/,
    guides:[['tire-blowout-or-flat','tire-keeps-losing-air']],drops:['flat'],
    now:'If a wheel or tire comes off while you’re driving: hold the steering wheel firmly, ease off the gas and don’t slam the brakes. Brake gently once you’ve slowed down, turn on your hazard lights and pull fully off the road. Don’t drive it again: have it towed.'},
  {id:'steering',topic:/steer/i,page:'brakes-steering-pedal',
    rx:/\b(?:(?:power )?steering (?:is |has |just |completely |totally )*(?:went out|failed|stopped working|gone|quit|not working|out|died)|(?:lost|losing|lose|no) (?:my |the |all )?(?:power )?steering|power steering (?:\w+ ){0,2}(?:while|when) (?:driving|moving)|lost control (?:of )?(?:the |my )?steering|cant steer|(?:cant|couldnt) turn (?:the |my )?(?:steering )?wheel\b.*\b(?:driving|moving|highway|road)|(?:car |it |truck )?(?:wont|doesnt) steer|steering (?:wheel )?(?:is )?(?:locked|locked up|wont turn|wont move|stopped responding|not responding|isnt responding|doesnt respond|wont respond)\b.*\b(?:driving|moving|highway|freeway|road|speed)|(?:driving|moving|highway|freeway)\b.*\bsteering (?:wheel )?(?:is )?(?:locked|locked up|stopped responding|not responding|wont turn))\b/,
    guides:['steering-hard-to-turn','loose-or-wandering-steering'],
    now:'If you lose steering control: grip the wheel firmly with both hands, ease off the gas, brake gently, turn on your hazard lights and steer to a safe stop. Don’t drive it again until it’s checked.'}
  ,{id:'steering-heavy',topic:/steer/i,page:'brakes-steering-pedal',
    rx:/\bsteering\b(?: \w+){0,5} (?:hard|heavy|stiff|tight)\b.*\b(?:while|when) (?:driving|moving)\b|\b(?:while|when) (?:driving|moving)\b.*\bsteering\b(?: \w+){0,5} (?:hard|heavy|stiff|tight)\b|\b(?:suddenly|all of a sudden|out of nowhere)\b.*\bsteering\b.*\b(?:hard|heavy|stiff|tight)\b|\bsteering\b.*\b(?:suddenly|all of a sudden)\b.*\b(?:hard|heavy|stiff|tight)\b/,
    guides:['steering-hard-to-turn'],
    now:'If the steering suddenly goes heavy while driving, grip the wheel firmly with both hands, slow down gradually, and pull over when it’s safe. Steering usually still works without assist, but it can take much more effort.'}
  // ---- On the road, not a car fault: each one points to a /roadside/ page with the full steps. ----
  ,{id:'crash',topic:/airbag|accident|crash/i,page:'after-a-crash',src:[SRC.nyDmv,SRC.riDmv],
    rx:/\b(?:accident|car accident|crash|crashed|wreck|wrecked|collision|fender ?bender|rear ?ended|t ?boned|sideswiped|totaled|totalled)\b|\b(?:hit|struck|ran into|crashed into|rammed|bumped into|backed into) (?:a |an |another |the |some |my |someones )?(?:parked )?(?:car|deer|pole|tree|guardrail|guard rail|animal|wall|truck|person|pedestrian|cyclist|bike|moose|vehicle|mailbox|fence|building)\b|\b(?:deer|car|truck|someone|somebody|another car|a car|a deer|other driver|guy|lady) (?:hit|ran into|crashed into|rear ended|backed into|sideswiped|bumped) (?:me|my|us|our)\b|\bairbags? (?:went off|deployed|deploy|blew|blew up|popped|popped out|go off|came out|opened|exploded)\b/,
    skip:/\b(?:crash test|accident history|vehicle history|carfax|accident report)\b|\b(?:computer|app|screen|radio|infotainment|phone|software)\b.*\bcrash/,
    guides:[],
    now:'If you’ve been in a crash: stop, turn on your hazard lights and check if anyone is hurt. Call 911 if anyone is hurt. If no one is hurt and the car can be driven, move it off the road, then call the police. If the airbags went off, don’t drive it.'}
  ,{id:'flood',topic:/water|flood/i,page:'flooded-road',src:[SRC.nws,SRC.nwsDuring],
    rx:/\bflood(?:ed|ing|s|water|waters)?\b|\b(?:deep|high|rising|moving|fast|rushing|standing) water\b(?!.*\b(?:leak|inside the car|in the car|floor|carpet|trunk)\b)|\bwater (?:\w+ ){0,2}(?:up )?(?:to|over|into|above|past) (?:the |my )?(?:doors?|hood|tires?|wheels?|bumper|seats?|windows?|engine)\b|\bdrove (?:through|into|in) (?:\w+ ){0,2}water\b|\b(?:car|engine|truck) (?:is |got |went )?(?:underwater|under water|submerged)\b/,
    // "Flooded the engine" is a starting problem, and a wet floor is a leak, not a flooded road.
    skip:/^(?!.*\b(?:road|street|water|rain|storm|drove|driving)\b).*\b(?:flooded (?:the |my )?engine|engine (?:is |got |was )?flooded|flooded it|flooding (?:the |my )?engine)\b|^(?!.*\b(?:road|street|drove|driving|storm)\b).*\b(?:floor|carpet|footwell|trunk|floorboards?|mats?|interior|inside)\b/,
    guides:[],
    now:'Never drive or walk into flood water. Just 12 inches of moving water can carry away most cars. Turn around and find another way. If moving water traps you, get to the highest point you can and call 911.'}
  ,{id:'skid',topic:/skid|slid|ice|snow/i,page:'skid-or-hydroplane',src:[SRC.riDmv],
    rx:/\bhydro ?plan\w*|\baquaplan\w*|\b(?:skid|skidded|skidding|slid|sliding|spun out|spin out|spinning out|spun around|spinning around|fishtail\w*)\b|\b(?:went|slid|drove|ran|go|going|ended up|veered) (?:off the road|into (?:a |the )?ditch|into (?:a |the )?snow ?bank|off the highway)\b|\bin (?:a |the )?ditch\b|\bblack ice\b|\blost control\b(?: \w+){0,3} (?:ice|snow|rain|wet)\b/,
    skip:/\b(?:light|lamp|symbol|icon|indicator|marks?|tcs|esc|vsc|traction|stability|door|seat|window|sunroof|tray|cover)\b/,
    guides:[],
    now:'If your car starts to skid or hydroplane: ease off the gas and don’t slam the brakes. Look and steer where you want the car to go. If you slid off the road, turn on your hazard lights and stay inside with your seat belt on. Call 911 if anyone is hurt or the car is in a dangerous spot.'}
  ,{id:'snow',topic:/snow|stuck|exhaust/i,page:'stuck-in-snow',src:[SRC.nhtsaWinter],
    rx:/\bstuck in (?:the |deep |a |some )?(?:snow|snowbank|snow bank|ice|mud|sand|ditch|drift|snowdrift)\b|\bsnowed in\b|\bstranded in (?:the )?(?:snow|cold|blizzard|storm)\b|\b(?:snow|mud)\b(?: \w+){0,4} (?:stuck|stranded|wont move|cant move|spinning)\b|\b(?:stuck|stranded)\b(?: \w+){0,4} (?:snow|blizzard|mud)\b|\btailpipe\b.*\bsnow\b|\bsnow\b.*\btailpipe\b/,
    guides:['exhaust-smell-in-cabin'],
    now:'If you’re stuck in snow or mud: stay with your car and call for roadside help, or 911 if you’re stranded in the cold or unsafe. In snow, clear the tailpipe before you run the engine, and run it only now and then to stay warm. Turn on the dome light or tie something bright to the car so help can see you.'}
  ,{id:'broke-down',topic:/stall|dies|start|power/i,page:'broke-down',src:[SRC.aaaStay,SRC.riDmv],
    rx:/\b(?:broke|broken|breaks|breaking|break|brake|brakes) ?down\b|\bstranded\b|\bstuck (?:on|at|by|in) (?:the )?(?:side of the road|roadside|shoulder|highway|freeway|interstate|middle of the road|road|breakdown lane)\b|\b(?:stopped|stalled|died|quit) in (?:the )?(?:middle of the )?(?:road|lane|traffic|intersection)\b|\bcar (?:just )?(?:stopped|quit) (?:running|working|moving)\b|\b(?:wont|cant) (?:re ?start|start again|start back up|start it again)\b.*\b(?:highway|road|freeway|interstate|shoulder)\b|\b(?:highway|freeway|interstate|shoulder)\b.*\b(?:wont|cant) (?:re ?start|start)\b/,
    skip:/\bbrakes? down (?:the|my|a)\b|\bpress(?:ing|ed)? (?:the |my )?brakes? down\b/,
    guides:['engine-stalls-while-driving','car-wont-start'],
    now:'If your car breaks down: turn on your hazard lights and get as far off the road as you can. Once stopped, stay inside with your seat belt on and call for roadside help. If you’re stuck in a traffic lane, keep your hazard lights on, stay buckled in and call 911. Get out only if you see smoke or fire: use the side away from traffic and wait well back from the road, behind a guardrail if there is one.'}
  ,{id:'out-of-gas',topic:/gas|fuel/i,page:'out-of-gas',src:[SRC.aaaBreak,SRC.aaaStay],
    rx:/\b(?:ran|run|running|runs|went|go|going|gone) out of (?:gas|fuel|diesel)\b|\bout of (?:gas|fuel)\b|\bno (?:gas|fuel) left\b|\b(?:gas|fuel) tank (?:is |went |ran )?(?:empty|dry)\b|\bempty (?:gas|fuel) tank\b/,
    guides:[],
    now:'If you run out of gas: turn on your hazard lights and coast as far onto the shoulder as you can. Stay inside with your seat belt on and call for roadside help to bring fuel. Don’t walk along a highway to find gas.'}
  // RS-11: a flat found while parked or after pulling over. A flat at speed is the blowout step above.
  ,{id:'flat',topic:/tire|flat/i,page:'flat-tire',src:[SRC.aaaTire],
    rx:/\bflat tires?\b|\btires? (?:is |went |was |got |are )?(?:completely |totally )?flat\b|\b(?:got|have|had|has|with|on|drive on|driving on) a flat\b|^(?:a |my )?flat$|\bchange (?:a |my |the |your )?(?:flat )?tire\b|\bchanging (?:a |my |the )?tire\b|\bput (?:on )?(?:the |my )?spare\b/,
    skip:/\bkeeps?\b|\bslow(?:ly)? leak|\bevery (?:day|morning|week|few days)\b|\blosing air\b|\bbattery\b|\bflat (?:spot|ride|rate|bed|head)\b/,
    guides:[['tire-blowout-or-flat','tire-keeps-losing-air']],
    now:'If a tire goes flat while you’re driving: don’t brake hard or turn sharply. Slow down gently, turn on your hazard lights and pull over on a straight, level spot well away from traffic. Don’t change a tire next to moving traffic: call for roadside help instead.'}
  // RS-20: "jump start" is a dead battery at rest, not the charging light while driving.
  ,{id:'jump',topic:/start|battery|crank|click/i,page:'jump-start',src:[SRC.aaaJump],
    rx:/\bjump(?:ing|ed)?[ -]?start\w*\b|\bjump (?:my |the |a |your )?(?:car|battery|truck)\b|\bneed (?:a )?jump\b|\bjumper cables?\b|\bbattery (?:is |went |just )?(?:dead|died)\b|\bdead battery\b/,
    skip:/\bkeeps?\b|\balways\b|\bevery\b|\bagain and again\b|\boften\b|\b(?:key ?)?fob\b|\bremote\b/,
    guides:['car-wont-start','battery-keeps-dying'],
    now:'Before you jump-start, look at the battery. If it’s cracked, leaking or smells like rotten eggs, don’t jump it: call for roadside help. Keep the clamps from touching each other, and connect them in the order shown in the steps.'}
  // Not sourced yet beyond general 911 advice: listed for the technician's review.
  ,{id:'locked-out',topic:/lock|key/i,page:'locked-out',
    rx:/\block(?:ed)? (?:my |the |our )?keys? (?:in|inside)\b|\blocked (?:my |the |our )?keys?\b|\bkeys? (?:are |is |got )?locked (?:in|inside)\b|\blocked out of (?:my |the |our )?(?:car|truck|vehicle|van|suv)\b|\blocked out\b|\b(?:child|kid|baby|dog|pet|toddler|cat)\b.*\blocked (?:in|inside)\b|\blocked (?:in|inside)\b.*\b(?:child|kid|baby|dog|pet|toddler|cat)\b|\b(?:car|truck|doors?) (?:wont|doesnt|will not) unlock\b|\bcant (?:get|open) (?:into|in) (?:my |the )?(?:car|truck)\b/,
    guides:[],
    now:'If a child or pet is locked inside, call 911 now: a closed car can get dangerously hot or cold fast. Otherwise, use a spare key or call for roadside help.'}
];
// Short card titles for the /roadside/ pages (the page itself is built from src/roadside/<id>.json).
const ROADSIDE={'after-a-crash':'After a crash: what to do now','broke-down':'Car broke down: where to wait and who to call',
  'out-of-gas':'Ran out of gas: what to do now','flooded-road':'Flooded road: turn around','skid-or-hydroplane':'Skidding, hydroplaning or slid off the road',
  'stuck-in-snow':'Stuck in snow or stranded in the cold','locked-out':'Locked out of your car','flat-tire':'Flat tire or blowout: what to do now',
  'jump-start':'How to jump-start a car safely','smoke-or-fire':'Smoke or fire: get out and away',
  'brakes-steering-pedal':'Brakes, steering or a stuck pedal','red-light-on':'Red light on the dash: what to do now','emergency-kit':'What to keep in your car'};
// Words that say something failed without saying what (they matched the radio guide to "brakes stopped working").
const emergencyGeneric=new Set(['flashing','blinking','flash','stopped','stop','working','work','wont','not','dont','doesnt','light','warning','on','out','failed','went','gone','quit','stalls','died']);
// Common misspellings and texting shortcuts, so "my breaks went out" or "check engin lite flashin" still get the safety step.
const emergencySpelling=[[/\bbreaks?\b/g,m=>m==='breaks'?'brakes':'brake'],[/\bbrakeing\b/g,'braking'],[/\bengin\b/g,'engine'],[/\blite\b/g,'light'],[/\blites\b/g,'lights'],
  [/\bflashin\b/g,'flashing'],[/\bblinkin\b/g,'blinking'],[/\bsmokin\b/g,'smoking'],[/\bsmokeing\b/g,'smoking'],[/\boverhe+t(?:ing|in)\b/g,'overheating'],[/\boverhe+ating\b/g,'overheating'],
  [/\bover heating\b/g,'overheating'],[/\bdont\b/g,'dont'],[/\bwont\b/g,'wont'],[/\bcuz\b/g,'because'],[/\bexaust\b/g,'exhaust'],[/\bexhuast\b/g,'exhaust'],[/\bpetal\b/g,'pedal'],[/\bgass\b/g,'gas'],[/\btyres?\b/g,'tire'],[/\bpetrol\b/g,'gas'],[/\bodou?rs?\b/g,'smell'],[/\bbonnet\b/g,'hood'],
  // RS-07: common typos that skipped the safety step.
  [/\bsmok\b/g,'smoke'],[/\bsmokin\b/g,'smoking'],[/\bstrat\b/g,'start'],[/\bstarte\b/g,'start'],[/\bhydroplanned\b/g,'hydroplaned']];
function emergency(q){
  let text=literalSymptom(q);
  for(const [rx,to] of emergencySpelling)text=text.replace(rx,to);
  text=text.replace(/\bwill not\b/g,'wont').replace(/\bcan not\b|\bcannot\b/g,'cant')
    .replace(/\b(?:isnt|is not|not|never|no longer|stopped) (?:flashing|blinking)\b|\b(?:doesnt|does not|didnt|did not) (?:flash|blink)\b/g,'steady')
    // "no smoke, just a rattle" or "there is no gas smell" is not a fire or fuel warning.
    .replace(/\b(?:no|not any|without|isnt any|there is no|theres no|dont see any|dont smell any|cant smell any)\s+(?:\w+\s+)?(?:smoke|fire|flames?|smell|fumes?|leak)\b/g,' ')
    // A trouble code with "the light is flashing" is a flashing check engine light.
    .replace(/\bp[0-3][0-9a-f]{3}\b/g,' check engine light ');
  let hits=emergencyRules.filter(rule=>rule.rx.test(text)&&!(rule.skip&&rule.skip.test(text)));
  // A more specific rule replaces a general one ("brake pedal is hard" is not "brakes failed: pump it").
  const dropped=new Set(hits.flatMap(rule=>rule.drops||[]));
  hits=hits.filter(rule=>!dropped.has(rule.id));
  if(!hits.length)return null;
  // A guide entry can be a list: the first guide in it that exists (a new guide, then the older one it replaces).
  const pickGuide=id=>Array.isArray(id)?id.find(x=>G.some(g=>g.id===x)):id;
  const ids=[...new Set(hits.flatMap(rule=>rule.guides.map(pickGuide)))].filter(id=>id&&G.some(g=>g.id===id));
  const pages=[...new Set(hits.map(rule=>rule.page).filter(Boolean))].map(id=>({id,u:'/roadside/'+id+'/',t:ROADSIDE[id]||'What to do now'}));
  return {rule:hits[0].id,now:hits[0].now,also:hits.slice(1).map(rule=>rule.now),guides:ids.map(id=>G.find(g=>g.id===id)),
    pages,src:hits[0].src||[],labels:Object.assign({},...hits.map(rule=>rule.labels||{})),
    sharesWord:g=>[g.title,...(g.syn||[])].some(t=>symptomWords(t).some(w=>!emergencyGeneric.has(w)&&symptomWords(q).includes(w))),
    related:g=>hits.some(rule=>rule.topic.test(g.title+' '+g.h1))||
      symptomWords(g.title).some(word=>!emergencyGeneric.has(word)&&symptomWords(q).includes(word))};
}
// Someone who types a guide's own heading ("Why does my car pull to one side?") goes straight to it.
function exactGuide(q){const lq=literalSymptom(q).replace(/^(?:why (?:does|do|is|wont|would) )?(?:my |the )?/,'');if(lq.split(' ').length<2)return null;
  return G.find(g=>[g.h1,g.title].some(t=>t&&literalSymptom(t).replace(/^(?:why (?:does|do|is|wont|would) )?(?:my |the )?/,'')===lq))||null}
function search(q,n=5){
  const urgent=emergency(q);
  const ordinary=searchWords_(q,n);
  if(!urgent)return ordinary;
  // Other word matches only if they're about the same danger (no radio guide under "brakes stopped working").
  // The best plain word match is also kept when it shares a real symptom word ("smoke from wheel" keeps brakes dragging).
  return [...urgent.guides,...ordinary.filter((g,i)=>!urgent.guides.includes(g)&&(urgent.related(g)||(i===0&&urgent.sharesWord(g))))].slice(0,n);
}
function searchWords_(q,n=5){
  const words=symptomWords(q);
  if(!words.length)return [];
  const {guides,weight}=getSearchIndex();
  const query=new Set(words),literal=literalSymptom(q),total=words.reduce((sum,word)=>sum+weight(word),0);
  const ranked=guides.map(({guide,phrases})=>{
    let best=0;
    for(const phrase of phrases){
      const matched=phrase.words.filter(word=>query.has(word));
      if(words.length>1 && matched.length<2)continue;
      if(!matched.some(word=>!searchGeneric.has(word)))continue;
      const overlap=matched.reduce((sum,word)=>sum+weight(word),0);
      const score=2*overlap/(total+phrase.weight);
      best=Math.max(best,score+(phrase.literal===literal?0.08:0));
    }
    return {guide,score:best};
  }).filter(match=>match.score>=0.54).sort((a,b)=>b.score-a.score);
  if(!ranked.length)return [];
  return ranked.filter(match=>match.score>=ranked[0].score-0.13).slice(0,n).map(match=>match.guide);
}

// Ask for a detail the driver can observe only when the wording leaves it open.
const searchQuestions=[
  {signal:['light','warning'],allowed:['light','warning','dash','red','orange','yellow','amber','flashing','lit','appeared','showed','got'],
    question:'Which dashboard symbol do you see?',choices:[
      ['A battery with a plus and minus','battery-light-on'],['An oil can','oil-pressure-light-on'],
      ['An engine outline or “check engine”','check-engine-light-on'],['See all dashboard symbols','/warning-lights/']]},
  {signal:['shake'],allowed:['shake','wheel','whole','feels','feel','driving','drive','bad','badly','so','really','violently','hard','lot','alot'],
    question:'When do you feel the shaking?',choices:[
      ['When I brake','car-shakes-when-braking'],['When I speed up','car-shakes-when-accelerating'],
      ['At highway speed','vibration-at-highway-speed'],['While stopped','rough-idle-shaking'],['Browse other shaking symptoms','/symptoms/#shake']]},
  {signal:['noise','sound','helicopter'],context:['speed','faster','highway','accelerate','mph'],
    allowed:['noise','sound','helicopter','speed','faster','go','going','gets','get','louder','driving','drive','highway','accelerate','mph','strange','weird'],
    question:'What do you hear as the car speeds up?',choices:[
      ['A hum or roar that gets louder with road speed','humming-noise-at-speed'],
      ['A high-pitched whine when I press the gas','whining-noise-when-accelerating'],
      ['A loud rumble from the exhaust','loud-exhaust-roaring'],['Browse other noises','/symptoms/#noise']]},
  {signal:['noise','sound'],allowed:['noise','sound','weird','strange','funny','loud','hear','hearing','driving','drive'],
    question:'What does the noise sound like?',choices:[
      ['Grinding when I brake','grinding-brakes'],['Clicking when I turn','clicking-when-turning'],
      ['Clunking over bumps','clunk-over-bumps'],['Browse other noises','/symptoms/#noise']]},
  {signal:['smell'],allowed:['smell','weird','strange','funny','bad','odd','driving','drive','inside'],
    question:'What does the smell remind you of?',choices:[
      ['Gasoline','gas-smell'],['Something burning','burning-smell'],['Sweet syrup','sweet-smell-from-car'],
      ['Rotten eggs','rotten-egg-smell'],['Browse other smells','/symptoms/#leaksmell']]},
  {signal:['smoke'],allowed:['smoke','coming','out','blowing','driving','drive','idle','idling','startup','start','exhaust','tailpipe'],
    question:'Where do you see the smoke, and what color is it?',choices:[
      ['Under the hood','steam-from-under-hood'],['White smoke from the tailpipe','white-smoke-from-exhaust'],
      ['Blue or gray smoke from the tailpipe','blue-smoke-from-exhaust'],['Black smoke from the tailpipe','black-smoke-from-exhaust'],
      ['Browse other smoke symptoms','/symptoms/#leaksmell']]},
  // RS-13: "steam" alone. The overheat safety step shows above this question.
  {signal:['steam'],allowed:['steam','coming','out','see','seeing','lots','white','everywhere','from','car'],
    question:'Where is the steam coming from?',choices:[
      ['From under the hood','steam-from-under-hood'],['From the tailpipe','white-smoke-from-exhaust'],
      ['From the vents, or the windows fog up inside','windows-fogging-up'],['Browse other smoke and smell symptoms','/symptoms/#leaksmell']]},
  {signal:['leak'],allowed:['leak','fluid','liquid','somewhere'],
    question:'Where do you see the fluid?',choices:[
      ['Under the car','fluid-leak-under-car'],['Water inside the car','water-leak-inside-car'],
      ['Browse other leaks','/symptoms/#leaksmell']]},
  {signal:['died','dies','stalls'],allowed:['engine','died','dies','stalls','out','cut','idling','idle','sometimes','randomly','keeps'],
    question:'When does the engine stop?',choices:[
      ['Right after starting','starts-then-dies'],['While driving','engine-stalls-while-driving'],
      ['When coming to a stop','car-dies-when-coming-to-stop'],['It won’t start now','car-wont-start']]}
];
// For drivers who can't name the problem yet ("my car is acting funny"): one easy question about what they noticed first.
const noticeFirst={question:'What did you notice first?',choices:[
  ['A sound','/symptoms/#noise'],['A smell or smoke','/symptoms/#leaksmell'],['A light on the dashboard','/warning-lights/'],
  ['A puddle or drip under the car','fluid-leak-under-car'],['A change in how it drives','?drive'],['It won’t start','car-wont-start']]};
// Follow-up for "a change in how it drives": still things a driver can feel, no part names.
const askFollow={drive:{question:'What feels different?',choices:[
  ['It shakes or vibrates','/symptoms/#shake'],['It pulls to one side','car-pulls-to-one-side'],
  ['The brake pedal feels soft, sinks or feels hard','/symptoms/#drive'],['The steering feels heavy or loose','/symptoms/#drive'],
  ['It feels weak, hesitates or jerks','loss-of-power-when-accelerating'],['It shifts roughly or late','harsh-or-hard-shifting'],
  ['Something else','/symptoms/#drive']]}};
const vagueWords=new Set(('my the a an i im its it is was are be been has have had with in on of to for and or but just really kind sort bit little '+
  'car cars vehicle truck suv van auto something somethings thing things stuff wrong right off funny weird weirdly strange odd acting act acts acted '+
  'up seems seem feels feel feeling going whats what dont do does doing know not sure unsure idk think lately today suddenly sudden all problem problems '+
  'issue issues help broken messed working work normal normally behaving like').split(' '));
function isVague(q){const w=literalSymptom(q).split(' ').filter(Boolean);return w.length>0&&w.every(x=>vagueWords.has(x))}
function clarifySearch(q){
  if(isVague(q))return noticeFirst;
  const words=symptomWords(q);
  return searchQuestions.find(rule=>words.some(word=>rule.signal.includes(word)) &&
    (!rule.context || words.some(word=>rule.context.includes(word))) && words.every(word=>rule.allowed.includes(word))) || null;
}
// ---- dashboard lights from the homepage search (RS-09) ----
// The /warning-lights/ hub keywords, shipped as window.LIGHT_INDEX = [[id, name, color, severity, keywords], ...]
// when the build provides it (severity is stop|soon|check|info or a label). Until then this smaller copy
// (names, nicknames and symbol shapes) keeps light searches working.
const LIGHT_FALLBACK=[
 ['oil-pressure-light','Oil pressure warning light','red','stop','oil pressure can genie lamp dripping low oil pressure'],
 ['engine-temperature-light','Engine temperature warning light','red','stop','engine temperature coolant thermometer temp hot overheating overheat water waves'],
 ['battery-light','Battery / charging system light','red','stop','battery charging alternator system check charging'],
 ['brake-warning-light','Brake system warning light','red','stop','brake system exclamation circle parentheses'],
 ['airbag-light','Airbag warning light','red','soon','airbag air bag srs supplemental restraint person seat ball'],
 ['parking-brake-light','Parking brake light','red','soon','parking brake handbrake hand emergency p'],
 ['seat-belt-light','Seat belt reminder light','red','info','seat belt seatbelt fasten person'],
 ['door-open-light','Door or hood open light','red','info','door hood open ajar trunk liftgate tailgate'],
 ['check-engine-light','Check engine light','amber','soon','check engine service soon malfunction mil cel motor submarine'],
 ['abs-light','ABS warning light','amber','soon','abs antilock brakes'],
 ['power-steering-light','Power steering warning light','amber','soon','power steering wheel eps exclamation'],
 ['transmission-warning-light','Transmission warning light','amber','soon','transmission gear cog temperature thermometer exclamation'],
 ['coolant-level-light','Low coolant level light','amber','soon','low coolant level radiator'],
 ['master-warning-light','Master warning light','amber','soon','master general warning triangle exclamation'],
 ['hybrid-system-light','Check hybrid system / EV warning','amber','soon','hybrid ev system car exclamation'],
 ['oil-level-light','Low engine oil level light','amber','soon','low engine oil level add can wavy'],
 ['brake-pad-wear-light','Brake pad wear light','amber','soon','brake pad pads wear worn linings dashed dashes broken circle'],
 ['electronic-parking-brake-light','Electronic parking brake fault light','amber','soon','electronic electric parking brake epb p auto hold fault'],
 ['4wd-light','4WD / AWD warning light','amber','soon','4wd awd 4x4 four wheel drive'],
 ['wrench-light','Wrench light','amber','soon','wrench powertrain reduced power spanner'],
 ['def-light','Low DEF / exhaust fluid light (diesel)','amber','soon','def adblue diesel exhaust fluid'],
 ['dpf-light','Diesel particulate filter light','amber','soon','dpf diesel particulate filter dots box'],
 ['water-in-fuel-light','Water in fuel light (diesel)','amber','soon','water in fuel wif filter separator'],
 ['epc-light','EPC light','amber','soon','epc electronic power control'],
 ['esp-bas-light','ESP BAS warning light','amber','soon','esp bas stability brake assist'],
 ['exhaust-emission-light','Exhaust emission system light','amber','soon','exhaust emission eml'],
 ['tire-pressure-light','Tire pressure warning light (TPMS)','amber','check','tire tyre pressure tpms low horseshoe exclamation flat u jar cup bubble'],
 ['traction-control-light','Traction / stability control light','amber','check','traction stability control esc esp vsc tcs skid skidding squiggly squiggles squiggle wavy lines slip'],
 ['stability-control-off-light','Stability control off light (ESC OFF)','amber','check','stability traction control esc vsc tcs dsc off skid'],
 ['slip-indicator-light','SLIP and VDC OFF indicators','amber','check','slip vdc off vehicle dynamic control'],
 ['security-light','Security / immobilizer light','amber','check','security immobilizer key lock padlock antitheft theft car'],
 ['glow-plug-light','Glow plug light (diesel)','amber','check','glow plug coil spiral pigtail spring squiggle preheat diesel'],
 ['service-light','Service due / maintenance light','amber','check','service due maintenance wrench spanner'],
 ['maintenance-required-light','Maintenance required light','amber','check','maintenance required maint reqd wrench reminder'],
 ['oil-change-light','Oil change due light','amber','check','oil change life due reminder'],
 ['lane-assist-light','Lane keeping / driver assist warning','amber','check','lane keeping departure assist lines camera collision driver'],
 ['blind-spot-light','Blind spot monitor warning light','amber','check','blind spot monitor bsm blis mirror'],
 ['low-fuel-light','Low fuel light','amber','info','low fuel gas pump station empty refuel'],
 ['washer-fluid-light','Low washer fluid light','amber','info','washer windshield wiper fluid'],
 ['key-battery-light','Key fob battery low','amber','info','key fob remote battery not detected'],
 ['high-beam-light','High beam indicator','blue','info','high beam headlight brights'],
 ['cruise-control-light','Cruise control indicator','green','info','cruise control speedometer arrow adaptive']];
const LIGHT_SEV={stop:'Stop driving as soon as it’s safe',soon:'Get it checked soon',check:'Check it when you can',info:'Information only'};
// The symptom guide that covers the same light: when it is the top guide match, the guide answers the search as before.
const LIGHT_GUIDES={'check-engine-light':['check-engine-light-on','check-engine-light-flashing'],'oil-pressure-light':['oil-pressure-light-on'],
  'engine-temperature-light':['engine-overheating'],'battery-light':['battery-light-on'],'brake-warning-light':['brake-warning-light-on'],
  'parking-brake-light':['brake-warning-light-on'],'abs-light':['abs-light-on'],'airbag-light':['airbag-light-on'],'tire-pressure-light':['tire-pressure-light-on'],
  'traction-control-light':['traction-control-light-on'],'power-steering-light':['power-steering-warning-light'],'transmission-warning-light':['transmission-warning-light'],
  'hybrid-system-light':['check-hybrid-system-warning'],'security-light':['security-light-flashing-wont-start'],'wrench-light':['reduced-engine-power-warning']};
// Same idea as the hub search: every described word must match a keyword. Flashing, colors and "point"/"mark" are not shapes.
const LIGHT_FILLER=new Set(('a an the my is it its on of in with and or that this like looks look shaped shape symbol symbols icon sign light lights lit lamp '+
  'dash dashboard warning came come comes coming just car cars little small flashing flash flashes blinking blink blinks steady solid stays stay keeps '+
  'point points mark marks inside picture pic image thing what whats means mean meaning does do i see there theres up showed showing shows appeared '+
  'indicator new now today all sudden suddenly why still').split(' '));
const LIGHT_COLOR={red:'red',yellow:'amber',orange:'amber',amber:'amber',green:'info',blue:'info'};
const lightNorm=t=>String(t).toLowerCase().replace(/!/g,' exclamation ').replace(/['’]/g,'').replace(/\banti[ -]?lock\b/g,'antilock').replace(/[^a-z0-9]+/g,' ').trim();
function lightWords(q){
  const w=lightNorm(q).split(' ').filter(Boolean);
  return{words:w.filter(x=>!LIGHT_FILLER.has(x)&&!LIGHT_COLOR[x]),colors:[...new Set(w.filter(x=>LIGHT_COLOR[x]).map(x=>LIGHT_COLOR[x]))]};
}
function lightKeyMatch(keys,w){return keys.some(x=>x===w||(w.length>=3&&x.startsWith(w))||(w.length>3&&w.endsWith('s')&&x===w.slice(0,-1)))}
// The search mentions a light, a symbol or a color: check the dashboard lights before the symptom guides.
function lightQuery(q){return /\b(?:light|lights|lamp|lamps|symbol|icon|indicator|dash|dashboard|exclamation|red|yellow|orange|amber|green|blue)\b|!/i.test(String(q))}
// "Gas light", "fuel light", "low fuel": straight to the low fuel light page.
function fuelLight(q){const t=literalSymptom(q);
  return !/\b(?:cap|exhaust|smell|smells|leak|leaking|pressure|filter|water|economy|mileage|pump light)\b/.test(t)&&
    /\b(?:gas|fuel|petrol)\b(?: \w+){0,2} (?:light|lamp|symbol|icon|indicator|warning)\b|\blow (?:on )?(?:gas|fuel)\b|\b(?:gas|fuel) (?:is |getting )?low\b|\brefuel\b/.test(t)}
// Lights whose keywords contain every described word: the color the driver named first, then red, amber, green/blue.
function lightMatches(q){
  const {words,colors}=lightWords(q);if(!words.length)return[];
  const rows=(Array.isArray(window.LIGHT_INDEX)&&window.LIGHT_INDEX.length?window.LIGHT_INDEX:LIGHT_FALLBACK)
    .map(r=>({id:r[0],n:r[1],c:r[2],s:LIGHT_SEV[r[3]]||r[3]||'',k:lightNorm(r[4]||'').split(' ')}));
  const grp=c=>c==='green'||c==='blue'?'info':c;
  const rank=c=>colors.length&&!colors.includes(grp(c))?1:0;
  const order={red:0,amber:1,green:2,blue:2};
  return rows.map((r,i)=>({r,i})).filter(({r})=>words.every(w=>lightKeyMatch(r.k,w)))
    .sort((a,b)=>rank(a.r.c)-rank(b.r.c)||(order[a.r.c]??3)-(order[b.r.c]??3)||a.i-b.i).map(x=>x.r);
}
// ---- known vehicle problem -> guide (strict) ----
// Rules come from src/guide-links.json (window.GUIDE_LINKS, written by build.js). An issue links to a guide only when its
// title names that guide's symptom (one of the guide's "any" patterns) and hits no exclusion. No match means no link:
// a wrong "walk through this symptom" link is worse than none. Keyword overlap in the description is never enough.
const GL=(function(R){if(!R||!R.order)return null;const rx=p=>new RegExp(p,'i');
  return{not:(R.not||[]).map(rx),order:R.order.filter(id=>R.guides[id]),g:Object.fromEntries(R.order.filter(id=>R.guides[id]).map(id=>[id,{any:R.guides[id].any.map(rx),not:(R.guides[id].not||[]).map(rx)}]))}})(window.GUIDE_LINKS);
const normT=t=>String(t==null?'':t).replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"');
const GBY=Object.fromEntries(G.map(g=>[g.id,g]));
// does guide <id> describe this issue title? (used by the guide page's "documented problems" list)
function matchesGuide(id,title){if(!GL||!GL.g[id])return false;const t=normT(title),r=GL.g[id];
  if(GL.not.some(x=>x.test(t))||r.not.some(x=>x.test(t)))return false;return r.any.some(x=>x.test(t))}
// the one guide a vehicle issue card links to, or null
function forIssue(i){if(!GL||!i)return null;const t=normT(i.t);if(GL.not.some(x=>x.test(t)))return null;
  for(const id of GL.order){const r=GL.g[id];if(!GBY[id]||r.not.some(x=>x.test(t)))continue;if(r.any.some(x=>x.test(t)))return GBY[id]}
  return null}

// ---- guided flow on /symptoms/<id>/ ----
const ASK=["Can I get a written estimate before any work starts?","Is there a charge to diagnose it, and does it count toward the repair?","Will you call me before doing anything that isn't on the estimate?","What warranty comes with the parts and labor? Can I have it in writing?","Can I see or keep the old parts?"];
window.VS_ASK=ASK;
const J=window.JOURNEY;const root=document.getElementById('guideApp');
if(J&&root){
  const V=window.VEHICLES||[];
  let path=[],cur=J.start,veh=null,vyear=null,EMAIL_ON=false,editingVeh=false,resumed=false;
  const SK='vs_j_'+J.id;
  fetch('/api/send-summary/').then(r=>r.ok?r.json():{}).then(d=>{EMAIL_ON=!!d.enabled;const eb=document.getElementById('emailbox');if(eb)eb.hidden=!EMAIL_ON}).catch(()=>{});
  const setVeh=(id,y)=>{const v=V.find(x=>x.id===id);veh=v||null;vyear=v&&y>=v.years[0]&&y<=v.years[1]&&!(v.gaps||[]).some(g=>y>=g[0]&&y<=g[1])?+y:null};
  try{const p=new URLSearchParams(location.search);if(p.get('v'))setVeh(p.get('v'),+p.get('y'));
    if(!veh){const g=JSON.parse(localStorage.getItem('vs_garage')||'[]');if(g[0])setVeh(g[0].id,g[0].y)}}catch(e){}
  try{const st=JSON.parse(sessionStorage.getItem(SK)||'null');if(st&&st.path&&st.path.length&&J.nodes[st.cur]){path=st.path;cur=st.cur;if(st.v)setVeh(st.v,st.y);resumed=true}}catch(e){}
  const save=()=>{try{path.length?sessionStorage.setItem(SK,JSON.stringify({path,cur,v:veh?veh.id:null,y:vyear})):sessionStorage.removeItem(SK)}catch(e){}};
  const node=k=>J.nodes[k];
  // The phone's back button steps back through the questions instead of leaving the guide.
  // Each answer adds a history entry that records how many answers were given.
  const ours=()=>!!(history.state&&history.state.vsg===path.length&&path.length);
  const toDepth=d=>{if(d<path.length){cur=path[d].k;path=path.slice(0,d);resumed=false;save();draw(true)}};
  window.addEventListener('popstate',e=>{const d=e.state&&typeof e.state.vsg==='number'?e.state.vsg:0;toDepth(d)});
  const vname=()=>veh?((vyear?vyear+' ':'')+veh.make+' '+veh.model):'';
  function vehBar(){
    if(veh&&!editingVeh)return`<div class="vbar"><span class="vb-l">Your vehicle</span><b>${esc(vname())}</b><button class="linkbtn" id="vChange">Change</button></div>`;
    return`<details class="vbar edit"${editingVeh?' open':''}><summary>${editingVeh?'Change your vehicle':'Add your vehicle'} <span>(optional)</span></summary><div class="picker ymm"><select id="gy" aria-label="Year"></select><select id="gm" aria-label="Make"></select><select id="gv" aria-label="Model"></select></div>
      <details class="notlisted"><summary>My vehicle isn't listed</summary><p>The vehicle library lists ${V.length} models. You can continue with the symptom questions if yours is missing.</p></details></details>`;
  }
  function wireVeh(after){
    const c=document.getElementById('vChange');if(c)c.onclick=()=>{editingVeh=true;after();document.getElementById('gy').focus()};
    const gy=document.getElementById('gy');if(gy){const pick=window.YMM(gy,document.getElementById('gm'),document.getElementById('gv'),veh?{id:veh.id,year:vyear}:null,()=>{const s=pick.get();if(s.v){veh=s.v;vyear=s.y;editingVeh=false;save();after();document.getElementById('vChange').focus()}})}
  }
  function crumbs(){
    if(!path.length)return'';
    return`<div class="answers"><span class="vb-l">Your answers</span>${path.map((p,i)=>`<button class="ans" data-i="${i}" title="Change this answer"><span>${esc(p.q)}</span><b>${esc(p.a)}</b></button>`).join('')}</div>`;
  }
  function wireCrumbs(){root.querySelectorAll('.ans').forEach(b=>b.onclick=()=>{const i=+b.dataset.i,mine=ours(),steps=i-path.length;toDepth(i);if(mine&&steps)history.go(steps)})}
  function draw(focusStep=false){
    const n=node(cur);
    const top=resumed&&path.length?`<div class="resumed">Picked up where you left off. <button class="linkbtn" id="fresh">Start fresh</button></div>`:'';
    if(n.q){
      root.innerHTML=`${top}<div class="flow card"><div class="step-n" id="stepNumber">Question ${path.length+1}</div>${crumbs()}<h2 class="fq" tabindex="-1" aria-describedby="stepNumber">${esc(n.q)}</h2>${n.help?`<p class="help">${esc(n.help)}</p>`:''}
      <div class="opts">${n.opts.map((o,i)=>`<button class="opt${/not sure/i.test(o.a)?' unsure':''}" data-i="${i}">${esc(o.a)}</button>`).join('')}</div>
      ${path.length?`<div class="flow-nav"><button class="linkbtn" id="back">← Back</button><button class="linkbtn" id="restart">Start over</button></div>`:''}</div>${vehBar()}`;
      root.querySelectorAll('.opt').forEach(b=>b.onclick=()=>{const o=n.opts[+b.dataset.i];path.push({k:cur,q:n.q,a:o.a,i:+b.dataset.i});cur=o.go;resumed=false;save();try{history.pushState({vsg:path.length},'')}catch(e){}draw(true)});
      wireCrumbs();
    } else drawResult(n.result,top);
    wireVeh(draw);
    const b=document.getElementById('back');if(b)b.onclick=()=>{const mine=ours();const p=path.pop();cur=p?p.k:J.start;resumed=false;save();draw(true);if(mine)history.back()};
    const r=document.getElementById('restart');if(r)r.onclick=()=>{path=[];cur=J.start;save();draw(true)};
    const f=document.getElementById('fresh');if(f)f.onclick=()=>{path=[];cur=J.start;resumed=false;save();draw(true)};
    if(focusStep){
      const heading=root.querySelector('.fq, .rt');
      heading.focus({preventScroll:true});
      // On a result, bring the urgency label into view too, not just the title under it.
      (root.querySelector('#resultUrgency')||heading).scrollIntoView({block:'start'});
    }
  }
  function matches(){if(!veh)return[];return veh.issues.filter(i=>(!vyear||(vyear>=i.y[0]&&vyear<=i.y[1]))&&matchesGuide(J.id,i.t))}
  function vehicleSection(){
    if(!veh)return`<p class="muted">Add your year, make and model above to see documented problems for your vehicle.</p>`;
    const list=matches(),nm=vname(),link=`/vehicles/${veh.id}/${vyear?vyear+'/':''}`;
    if(!list.length)return`<p class="muted">We haven't documented a problem on the ${esc(nm)} that matches this symptom. That doesn't rule anything out; the general guidance above applies. <a href="${link}">See what we've documented for the ${esc(nm)} →</a></p>`;
    return`<p class="muted">Documented problems on the ${esc(nm)} that can cause symptoms like this. They're known patterns to discuss with your shop, not a diagnosis of your car.</p>${list.slice(0,4).map(i=>`<div class="mini"><b>${esc(i.t)}</b> <span class="pill">${i.y[0]===i.y[1]?i.y[0]:i.y[0]+'–'+i.y[1]}</span><div>${esc(i.sym)}</div></div>`).join('')}<a href="${link}">Everything we've documented for the ${esc(nm)} →</a>`;
  }
  function observations(){
    return path.flatMap(({k,i})=>{
      const question=node(k);
      const choice=question?.opts?.[i];
      return choice ? [question.q+' → '+choice.a] : [];
    });
  }
  function messageForFamily(r){
    return [
      J.title+(veh?' · '+vname():''),
      'Urgency: '+URG[r.urgency].label,
      'What to do next: '+r.now,
      '',
      'Guide result: '+r.title,
      'What I noticed:',
      ...observations(),
      ...(r.if.length?['','Watch for:',...r.if]:[])
    ].join('\n');
  }
  function summary(r){
    const nm=veh?vname():'(add year, make and model)';
    return['SUMMARY FOR MY MECHANIC (from VehicleSymptoms.com)',
      'Not a confirmed diagnosis: please test before replacing parts.','',
      'Vehicle: '+nm,'Main concern: '+J.title,'What I noticed:',...observations().map(line=>'  - '+line),'',
      'How urgent the guide rated it: '+URG[r.urgency].label,
      'What to do next: '+r.now,
      ...(r.if.length?['Warning signs to watch for:',...r.if.map(x=>'  - '+x)]:[]),
      'Possible causes the guide listed: '+r.causes.map(c=>c.name).join('; '),
      'Tests a shop usually does: '+r.confirm.shop.join('; '),'',
      'Date: '+new Date().toLocaleDateString()].join('\n');
  }
  function drawResult(r,top){
    const u=URG[r.urgency];
    track('guide_result',{guide:J.id,urgency:r.urgency});
    root.innerHTML=`${top}<div class="result card">
      <div class="urg ${u.cls}" id="resultUrgency"><span>${esc(u.label)}</span></div>
      <h2 class="rt" tabindex="-1" aria-describedby="resultUrgency">${esc(r.title)}</h2>
      <section class="rsec"><h3>What to do next</h3><p>${esc(r.now)}</p>${(r.links||[]).filter(l=>l&&/^\/[a-z0-9\/#-]*$/.test(l.u)).map(l=>`<p><a class="rs-jump" href="${esc(l.u)}">${esc(l.t)} →</a></p>`).join('')}
        <div class="row-btns"><button type="button" class="btn sm" id="shareResult">Text this result</button><span class="muted" id="shareStatus" role="status"></span>
          <textarea class="summary share-text" id="shareText" aria-label="Result to copy into a text message" rows="6" readonly hidden></textarea></div>
        ${r.if.length?`<ul class="ifs">${r.if.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}</section>
      ${vehBar()}
      <section class="rsec"><h3>Possible causes</h3><p class="muted" style="margin:0 0 8px">Directions for testing, not confirmed failures.</p>${r.causes.map(c=>`<div class="cause"><b>${esc(c.name)}</b>${c.clues?`<div><span class="lbl2">Points here:</span> ${esc(c.clues)}</div>`:''}${c.against?`<div><span class="lbl2">Less likely if:</span> ${esc(c.against)}</div>`:''}</div>`).join('')}</section>
      <details class="rmore"><summary>Why this happens</summary><p>${esc(r.why)}</p></details>
      <details class="rmore"><summary>What you can check, and what a shop will test</summary><div class="two"><div><h4>You can check</h4><ul>${r.confirm.you.map(x=>`<li>${esc(x)}</li>`).join('')||'<li>Nothing safe to check yourself. Leave it to a technician.</li>'}</ul></div><div><h4>A shop will usually test</h4><ul>${r.confirm.shop.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div></div></details>
      <details class="rmore"${veh?' open':''}><summary>${veh?'Known problems for your '+esc(vname()):'Known problems for your vehicle'}</summary><div id="gvm">${vehicleSection()}</div></details>
      <details class="rmore"><summary>Questions to ask before you approve a repair</summary><ul class="dots">${ASK.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><p class="fine">Based on the U.S. Federal Trade Commission's auto repair tips.</p></details>
      <section class="rsec"><h3>Summary for your mechanic</h3><pre class="summary" id="sum">${esc(summary(r))}</pre>
        <div class="row-btns"><button class="btn sm" id="copy">Copy summary</button><button class="btn ghost sm" id="print">Print</button><span id="copied" class="muted"></span></div></section>
      <section class="rsec emailbox" id="emailbox" ${EMAIL_ON?'':'hidden'}><h3>Email this to yourself</h3><p class="muted" style="margin:0 0 10px">Get this result and your mechanic summary in your inbox, so it's handy at the shop.</p>
        <form id="emailForm" class="emailform" autocomplete="on"><input type="email" id="emailIn" placeholder="you@example.com" aria-label="Your email" required><input type="text" name="website" id="hp" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true"><button class="btn sm" type="submit">Send it</button></form>
        <div id="emailMsg" class="muted" role="status"></div><p class="fine">We send your address, this guide, your answers and your vehicle (if picked) to our email provider only to send this one email. We don't add you to any list or send marketing email. <a href="/privacy/">Privacy</a></p></section>
      ${crumbs()}
      <div class="flow-nav"><button class="linkbtn" id="back">← Change my last answer</button><button class="linkbtn" id="restart">Start over</button></div>
    </div>`;
    wireCrumbs();
    document.getElementById('shareResult').onclick=async()=>{
      const text=messageForFamily(r);
      const status=document.getElementById('shareStatus');
      const field=document.getElementById('shareText');
      status.textContent='';
      field.hidden=true;
      if(typeof navigator.share==='function'){
        try{
          await navigator.share({text});
          return;
        }catch(error){
          if(error?.name==='AbortError')return;
        }
      }
      try{
        await navigator.clipboard.writeText(text);
        status.textContent='Result copied. Paste it into a text message.';
      }catch{
        field.value=text;
        field.hidden=false;
        field.focus();
        field.select();
        status.textContent='Copy the selected result and paste it into a text message.';
      }
    };
    document.getElementById('copy').onclick=async()=>{try{await navigator.clipboard.writeText(summary(r));document.getElementById('copied').textContent='Copied'}catch(e){document.getElementById('copied').textContent='Select the text above and copy it'}};
    document.getElementById('print').onclick=()=>{root.querySelectorAll('details.rmore').forEach(d=>d.open=true);try{window.print()}catch(e){}};
    const ef=document.getElementById('emailForm');if(ef)ef.onsubmit=async e=>{e.preventDefault();const m=document.getElementById('emailMsg'),btn=ef.querySelector('button');btn.disabled=true;m.textContent='Sending…';
      try{const rs=await fetch('/api/send-summary/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:document.getElementById('emailIn').value,website:document.getElementById('hp').value,guide:J.id,answers:path.map(p=>p.i),vehicle:veh?veh.id:'',year:vyear||''})});
        const d=await rs.json().catch(()=>({}));if(rs.ok){m.textContent='Sent! Check your inbox (and spam folder, just in case).';ef.reset()}else{m.textContent=(d.error||'Could not send right now. (code '+rs.status+')')+(d.detail?' — '+d.detail:'');btn.disabled=false}}catch(err){m.textContent='Could not send right now. (code browser)';btn.disabled=false}};
  }
  draw();
  const ensure=()=>{if(veh&&!veh._full&&window.VS_LOAD)window.VS_LOAD(veh.id).then(()=>{const g=document.getElementById('gvm');if(g)g.innerHTML=vehicleSection()})};ensure();
  const _sv=save;
  document.addEventListener('click',e=>{if(e.target&&e.target.closest&&e.target.closest('#guideApp'))setTimeout(ensure,50)},true);
  document.addEventListener('change',()=>setTimeout(ensure,50),true);
}

// ---- /symptoms/ hub ----
const hub=document.getElementById('guideHub');
if(hub){
  if(!hub.querySelector('.hubsec'))hub.innerHTML=Object.entries(GROUPS).map(([k,label])=>{const list=G.filter(g=>g.group===k);if(!list.length)return'';
    return`<section class="hubsec" id="${k}"><h2>${esc(label)}</h2><div class="glist">${list.map(g=>`<a class="gcard" href="/symptoms/${g.id}/"><b>${esc(g.title)}</b><span>${esc(g.h1)}</span></a>`).join('')}</div></section>`}).join('');
  if(location.hash){const t=document.getElementById(location.hash.slice(1));if(t)setTimeout(()=>t.scrollIntoView(),60)}
}
})();
