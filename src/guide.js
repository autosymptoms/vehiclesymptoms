// Symptom guides: search index helpers, the guided question flow, and the /symptoms/ hub.
(function(){
const G=window.GUIDE_INDEX||[];
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const GROUPS={start:"Won't start",light:"Warning light",noise:"Noise",shake:"Shaking",leaksmell:"Leak, smell or smoke",hot:"Running hot",drive:"Driving & handling"};
const URG={
  stop:{label:"Stop — don't drive it",cls:"high",line:"Don't drive it until it's checked."},
  soon:{label:"Get it checked in the next few days",cls:"med",line:"Drive only if you must, gently and close to home."},
  check:{label:"Book a check when convenient",cls:"info",line:"Not an emergency, but don't ignore it."},
  diy:{label:"Safe to check yourself first",cls:"low",line:"Start with the simple checks below."}
};
window.VS_GUIDES={G,GROUPS,URG,esc,search,clarifySearch,forIssue,matchesGuide,gurl:id=>'/symptoms/'+id+'/'};

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
  flashes:'flashing', blinking:'flashing', blinks:'flashing'
};
function literalSymptom(text){
  return String(text).toLowerCase().replace(/['’]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
}
function symptomWords(text){
  const words = literalSymptom(text)
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
  'fluid-leak-under-car':['Puddle where I parked','Puddle on my driveway','Puddle in my parking spot']
};
let searchIndex;
function getSearchIndex(){
  if(searchIndex)return searchIndex;
  const frequencies=new Map();
  const guides=G.map(guide=>{
    const phrases=[guide.title,...guide.syn,...(everydayPhrases[guide.id] || [])].map(text=>({literal:literalSymptom(text),words:symptomWords(text)}))
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
function search(q,n=5){
  const words=symptomWords(q);
  if(!words.length)return [];
  const {guides,weight}=getSearchIndex();
  const query=new Set(words),literal=literalSymptom(q),total=words.reduce((sum,word)=>sum+weight(word),0);
  const ranked=guides.map(({guide,phrases})=>{
    let best=0;
    for(const phrase of phrases){
      const matched=phrase.words.filter(word=>query.has(word));
      if(words.length>1 && matched.length<2)continue;
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
  {signal:['shake'],allowed:['shake','wheel','whole','feels','feel','driving','drive'],
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
  {signal:['smoke'],allowed:['smoke','coming','out','blowing','driving','drive'],
    question:'Where do you see the smoke, and what color is it?',choices:[
      ['Under the hood','steam-from-under-hood'],['White smoke from the tailpipe','white-smoke-from-exhaust'],
      ['Blue or gray smoke from the tailpipe','blue-smoke-from-exhaust'],['Black smoke from the tailpipe','black-smoke-from-exhaust'],
      ['Browse other smoke symptoms','/symptoms/#leaksmell']]},
  {signal:['leak'],allowed:['leak','fluid','liquid','somewhere'],
    question:'Where do you see the fluid?',choices:[
      ['Under the car','fluid-leak-under-car'],['Water inside the car','water-leak-inside-car'],
      ['Browse other leaks','/symptoms/#leaksmell']]},
  {signal:['died','dies','stalls'],allowed:['engine','died','dies','stalls','out','cut'],
    question:'When does the engine stop?',choices:[
      ['Right after starting','starts-then-dies'],['While driving','engine-stalls-while-driving'],
      ['When coming to a stop','car-dies-when-coming-to-stop'],['It won’t start now','car-wont-start']]}
];
function clarifySearch(q){
  const words=symptomWords(q);
  return searchQuestions.find(rule=>words.some(word=>rule.signal.includes(word)) &&
    (!rule.context || words.some(word=>rule.context.includes(word))) && words.every(word=>rule.allowed.includes(word))) || null;
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
  function wireCrumbs(){root.querySelectorAll('.ans').forEach(b=>b.onclick=()=>{const i=+b.dataset.i;cur=path[i].k;path=path.slice(0,i);save();draw(true)})}
  function draw(focusStep=false){
    const n=node(cur);
    const top=resumed&&path.length?`<div class="resumed">Picked up where you left off. <button class="linkbtn" id="fresh">Start fresh</button></div>`:'';
    if(n.q){
      root.innerHTML=`${top}<div class="flow card"><div class="step-n" id="stepNumber">Question ${path.length+1}</div>${crumbs()}<h2 class="fq" tabindex="-1" aria-describedby="stepNumber">${esc(n.q)}</h2>${n.help?`<p class="help">${esc(n.help)}</p>`:''}
      <div class="opts">${n.opts.map((o,i)=>`<button class="opt${/not sure/i.test(o.a)?' unsure':''}" data-i="${i}">${esc(o.a)}</button>`).join('')}</div>
      ${path.length?`<div class="flow-nav"><button class="linkbtn" id="back">← Back</button><button class="linkbtn" id="restart">Start over</button></div>`:''}</div>${vehBar()}`;
      root.querySelectorAll('.opt').forEach(b=>b.onclick=()=>{const o=n.opts[+b.dataset.i];path.push({k:cur,q:n.q,a:o.a,i:+b.dataset.i});cur=o.go;resumed=false;save();draw(true)});
      wireCrumbs();
    } else drawResult(n.result,top);
    wireVeh(draw);
    const b=document.getElementById('back');if(b)b.onclick=()=>{const p=path.pop();cur=p?p.k:J.start;save();draw(true)};
    const r=document.getElementById('restart');if(r)r.onclick=()=>{path=[];cur=J.start;save();draw(true)};
    const f=document.getElementById('fresh');if(f)f.onclick=()=>{path=[];cur=J.start;resumed=false;save();draw(true)};
    if(focusStep){
      const heading=root.querySelector('.fq, .rt');
      heading.focus({preventScroll:true});
      heading.scrollIntoView({block:'start'});
    }
  }
  function matches(){if(!veh)return[];return veh.issues.filter(i=>(!vyear||(vyear>=i.y[0]&&vyear<=i.y[1]))&&matchesGuide(J.id,i.t))}
  const money=n=>'$'+n.toLocaleString('en-US');
  function vehicleSection(){
    if(!veh)return`<p class="muted">Add your year, make and model above to see documented problems and typical repair costs for your vehicle.</p>`;
    const list=matches(),nm=vname(),link=`/vehicles/${veh.id}/${vyear?vyear+'/':''}`;
    if(!list.length)return`<p class="muted">We haven't documented a problem on the ${esc(nm)} that matches this symptom. That doesn't rule anything out; the general guidance above applies. <a href="${link}">See what we've documented for the ${esc(nm)} →</a></p>`;
    return`<p class="muted">Documented problems on the ${esc(nm)} that can cause symptoms like this. They're known patterns to discuss with your shop, not a diagnosis of your car.</p>${list.slice(0,4).map(i=>`<div class="mini"><b>${esc(i.t)}</b> <span class="pill">${i.y[0]===i.y[1]?i.y[0]:i.y[0]+'–'+i.y[1]}</span><div>${esc(i.sym)}</div>${i.cost&&i.cost.withheld?`<div class="mcost muted">Repair (${esc(i.cost.job)}): insufficient verified pricing for this vehicle and repair.</div>`:i.cost?(i.cost.free?`<div class="mcost">Repair: no charge if your vehicle is in the recall</div>`:`<div class="mcost">Typical repair (${esc(i.cost.job)}): <b>${money(i.cost.lo)}–${money(i.cost.hi)}</b>${i.cost.recall?' · may be covered by a recall or extended warranty':''}</div>`):`<div class="mcost muted">No reliable cost range on file for this one yet.</div>`}</div>`).join('')}<p class="fine">Costs are U.S. national averages (parts plus standard labor at a typical shop labor rate), researched November 2026. Diagnosis is usually charged separately. Not a quote.</p><a href="${link}">Everything we've documented for the ${esc(nm)} →</a>`;
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
    root.innerHTML=`${top}<div class="result card">
      <div class="urg ${u.cls}" id="resultUrgency"><span>${esc(u.label)}</span></div>
      <h2 class="rt" tabindex="-1" aria-describedby="resultUrgency">${esc(r.title)}</h2>
      <section class="rsec"><h3>What to do next</h3><p>${esc(r.now)}</p>
        <div class="row-btns"><button type="button" class="btn sm" id="shareResult">Text this result</button><span class="muted" id="shareStatus" role="status"></span>
          <textarea class="summary share-text" id="shareText" aria-label="Result to copy into a text message" rows="6" readonly hidden></textarea></div>
        ${r.if.length?`<ul class="ifs">${r.if.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}</section>
      ${vehBar()}
      <section class="rsec"><h3>Possible causes</h3><p class="muted" style="margin:0 0 8px">Directions for testing, not confirmed failures.</p>${r.causes.map(c=>`<div class="cause"><b>${esc(c.name)}</b>${c.clues?`<div><span class="lbl2">Points here:</span> ${esc(c.clues)}</div>`:''}${c.against?`<div><span class="lbl2">Less likely if:</span> ${esc(c.against)}</div>`:''}</div>`).join('')}</section>
      <details class="rmore"><summary>Why this happens</summary><p>${esc(r.why)}</p></details>
      <details class="rmore"><summary>What you can check, and what a shop will test</summary><div class="two"><div><h4>You can check</h4><ul>${r.confirm.you.map(x=>`<li>${esc(x)}</li>`).join('')||'<li>Nothing safe to check yourself. Leave it to a technician.</li>'}</ul></div><div><h4>A shop will usually test</h4><ul>${r.confirm.shop.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div></div></details>
      <details class="rmore"${veh?' open':''}><summary>${veh?'Known problems and repair costs for your '+esc(vname()):'Known problems and repair costs for your vehicle'}</summary><div id="gvm">${vehicleSection()}</div></details>
      <details class="rmore"><summary>Questions to ask before you approve a repair</summary><ul class="dots">${ASK.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><p class="fine">Based on the U.S. Federal Trade Commission's auto repair tips. <a href="/price-check/${veh?'?v='+veh.id+(vyear?'&y='+vyear:''):''}">Got a quote? Check if it's fair →</a></p></details>
      <section class="rsec"><h3>Summary for your mechanic</h3><pre class="summary" id="sum">${esc(summary(r))}</pre>
        <div class="row-btns"><button class="btn sm" id="copy">Copy summary</button><button class="btn ghost sm" id="print">Print</button><span id="copied" class="muted"></span></div></section>
      <section class="rsec emailbox" id="emailbox" ${EMAIL_ON?'':'hidden'}><h3>Email this to yourself</h3><p class="muted" style="margin:0 0 10px">Get this result and your mechanic summary in your inbox, so it's handy at the shop.</p>
        <form id="emailForm" class="emailform" autocomplete="on"><input type="email" id="emailIn" placeholder="you@example.com" aria-label="Your email" required><input type="text" name="website" id="hp" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true"><button class="btn sm" type="submit">Send it</button></form>
        <div id="emailMsg" class="muted" role="status"></div><p class="fine">We only use your email for what you ask. <a href="/privacy/">Privacy</a></p></section>
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
