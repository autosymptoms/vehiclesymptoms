const ICONS={
 "Warning Lights":'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3 2.5 20h19L12 3z"/><path d="M12 10v4M12 17.2v.3" stroke-linecap="round"/></svg>',
 "Smoke":'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M7 18c-2.5 0-4-1.6-4-3.5S4.6 11 7 11c.3-2.8 2.4-5 5.2-5 3 0 5 2.2 5.3 4.8 2.2.2 3.5 1.8 3.5 3.7 0 2-1.6 3.5-4 3.5H7z"/></svg>',
 "Leaks":'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/></svg>',
 "Noises":'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
 "Smells":'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M8 20c-2-3 2-5 0-8s2-5 0-8M13 20c-2-3 2-5 0-8s2-5 0-8M18 20c-2-3 2-5 0-8s2-5 0-8"/></svg>',
 "Starting Problems":'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="12" rx="2"/><path d="M7 7V5M17 7V5M7 13h3M15.5 11.5v3M14 13h3"/></svg>'
};
const CAT_DESC={
 "Warning Lights":"Check engine, oil, battery, temperature, ABS and more.",
 "Smoke":"White, blue or black smoke from the exhaust or engine bay.",
 "Leaks":"Puddles and drips — identify the fluid by color.",
 "Noises":"Squeals, grinding, knocking, clicking and humming.",
 "Smells":"Burning, sweet, rotten egg, gas and musty odors.",
 "Starting Problems":"Clicks, slow crank, cranks but won't start."
};
// Starter symptom library (draft content — to be reviewed before launch)
const S=[
 {t:"Check engine light is on (steady)",c:"Warning Lights",sev:"med",k:"cel mil engine light solid",s:"The engine computer stored a fault. Often minor, but have the code read soon.",causes:["Loose or worn gas cap","Faulty oxygen sensor","Ignition coil or spark plug wear","EVAP system leak"],next:"Tighten the gas cap and get the code read (many parts stores do it free). Drive normally but don't ignore it."},
 {t:"Check engine light is flashing",c:"Warning Lights",sev:"high",k:"cel blinking misfire",s:"A flashing light means an active misfire that can overheat and ruin the catalytic converter.",causes:["Failed ignition coil","Bad spark plug","Fuel injector problem","Vacuum leak"],next:"Reduce speed, avoid hard acceleration, and get it checked right away. Pull over if the car shakes badly."},
 {t:"Oil pressure light on",c:"Warning Lights",sev:"high",k:"oil can red light",s:"The engine may not be getting enough oil pressure. Running it this way can destroy the engine.",causes:["Low oil level","Failed oil pressure sensor","Worn oil pump","Clogged pickup"],next:"Pull over and shut the engine off. Check the oil level. Don't drive until the cause is known."},
 {t:"Battery / charging light on",c:"Warning Lights",sev:"med",k:"battery light alternator",s:"The charging system isn't keeping the battery charged. The car may die once the battery runs down.",causes:["Failing alternator","Broken or slipping serpentine belt","Bad battery cable connection"],next:"Turn off accessories and head straight to a shop. If the belt broke, the engine may also overheat."},
 {t:"Engine overheating / temp gauge high",c:"Warning Lights",sev:"high",k:"overheating hot temperature gauge steam coolant",s:"The engine is running hotter than normal. Driving overheated can warp the head or blow the head gasket.",causes:["Low coolant from a leak","Failed thermostat","Bad water pump","Radiator fan not working","Clogged radiator"],next:"Pull over and turn the engine off. Never open a hot radiator cap. Let it cool, then check coolant level."},
 {t:"ABS light on",c:"Warning Lights",sev:"med",k:"abs anti-lock brake light",s:"Anti-lock braking is disabled. Normal brakes usually still work.",causes:["Faulty wheel speed sensor","Damaged sensor wiring","Low brake fluid","ABS module fault"],next:"Drive carefully, leave extra stopping distance, and get the code scanned."},
 {t:"TPMS / tire pressure light",c:"Warning Lights",sev:"low",k:"tire pressure tpms",s:"One or more tires are low, or a tire pressure sensor has failed.",causes:["Low tire pressure (often after a cold night)","Slow leak or nail","Dead TPMS sensor battery"],next:"Check all tires with a gauge and fill to the pressure on the driver's door sticker."},
 {t:"White smoke from exhaust",c:"Smoke",sev:"med",k:"white smoke tailpipe sweet",s:"Thin white vapor on a cold morning is normal. Thick white smoke that smells sweet can mean coolant is burning.",causes:["Condensation (normal, goes away when warm)","Head gasket leak","Cracked cylinder head"],next:"If it continues after warm-up or coolant is dropping, stop driving and have it inspected."},
 {t:"Blue smoke from exhaust",c:"Smoke",sev:"med",k:"blue gray smoke burning oil",s:"Blue-gray smoke means oil is getting into the engine and burning.",causes:["Worn piston rings","Worn valve seals","Failing turbocharger seals","PCV valve problem"],next:"Check the oil level often and top up. Have a compression test done."},
 {t:"Black smoke from exhaust",c:"Smoke",sev:"med",k:"black smoke rich fuel",s:"Black smoke means too much fuel is being burned.",causes:["Clogged air filter","Leaking fuel injector","Bad mass airflow sensor","Faulty fuel pressure regulator"],next:"Check the air filter first. Get codes read — fuel economy will suffer until fixed."},
 {t:"Green, orange or pink puddle",c:"Leaks",sev:"med",k:"coolant leak antifreeze green orange pink",s:"Bright, slightly slimy fluid with a sweet smell is coolant (antifreeze).",causes:["Leaking radiator hose","Radiator leak","Water pump seal","Heater core"],next:"Watch the temp gauge and keep coolant topped up. Coolant is toxic to pets — clean it up."},
 {t:"Brown or black puddle",c:"Leaks",sev:"med",k:"oil leak brown black drip",s:"Brown or black fluid near the front of the car is usually engine oil.",causes:["Oil drain plug or filter","Valve cover gasket","Oil pan gasket","Rear main seal"],next:"Check the dipstick regularly. Small drips can wait a little; steady dripping should be fixed soon."},
 {t:"Red or pink fluid leak",c:"Leaks",sev:"med",k:"transmission fluid power steering red",s:"Red fluid is usually transmission fluid or, on some cars, power steering fluid.",causes:["Transmission pan gasket","Cooler line leak","Power steering hose"],next:"Check fluid levels. Low transmission fluid can damage the transmission — don't put it off."},
 {t:"Squealing when braking",c:"Noises",sev:"med",k:"brake squeal squeak",s:"A high-pitched squeal often comes from the brake pad wear indicator.",causes:["Worn brake pads","Glazed pads or rotors","Missing anti-squeal shims"],next:"Have the brakes inspected soon before it turns into grinding."},
 {t:"Grinding when braking",c:"Noises",sev:"high",k:"brake grinding metal",s:"Metal-on-metal grinding usually means the pads are worn through to the backing plate.",causes:["Pads completely worn","Damaged rotors","Debris stuck in caliper"],next:"Get the brakes fixed now. Stopping power is reduced and rotors are being damaged."},
 {t:"Squeal under the hood at startup",c:"Noises",sev:"low",k:"belt squeal serpentine",s:"A short squeal on cold starts or when turning the wheel is often the drive belt.",causes:["Worn or glazed serpentine belt","Weak belt tensioner","Belt contamination"],next:"Have the belt and tensioner inspected. Belts are inexpensive to replace."},
 {t:"Clicking when turning",c:"Noises",sev:"med",k:"cv joint clicking turning",s:"Clicking or popping during sharp turns usually means a worn CV joint.",causes:["Torn CV boot let dirt in","Worn outer CV joint"],next:"Have the axle checked. A failing CV joint can eventually break."},
 {t:"Knocking from the engine",c:"Noises",sev:"high",k:"engine knock rod knock ping",s:"Deep rhythmic knocking can mean serious internal engine wear.",causes:["Low oil / rod bearing wear","Wrong fuel octane (pinging)","Carbon buildup"],next:"Check the oil immediately. If it knocks with correct oil level, stop driving and get a diagnosis."},
 {t:"Burning smell",c:"Smells",sev:"med",k:"burning smell oil plastic",s:"Burning smells can come from oil on hot parts, brakes, a slipping clutch or electrical problems.",causes:["Oil leaking onto exhaust","Overheated brakes","Slipping clutch","Melting wiring or plastic"],next:"If you smell burning plastic or see smoke, pull over and turn the car off. Otherwise get it inspected soon."},
 {t:"Sweet smell (like syrup)",c:"Smells",sev:"med",k:"sweet smell coolant maple syrup",s:"A sweet smell usually means coolant is leaking somewhere hot.",causes:["Heater core leak (smell inside the cabin)","Radiator or hose leak","Head gasket"],next:"Check coolant level and watch the temp gauge. Foggy windows plus sweet smell points to the heater core."},
 {t:"Rotten egg smell",c:"Smells",sev:"med",k:"rotten egg sulfur",s:"A sulfur smell usually comes from the catalytic converter.",causes:["Failing catalytic converter","Engine running rich","Old gear oil (some vehicles)"],next:"Get the engine codes read. A converter problem often follows another engine issue."},
 {t:"Gasoline smell",c:"Smells",sev:"high",k:"gas smell fuel leak",s:"A raw fuel smell can mean a fuel leak, which is a fire risk.",causes:["Leaking fuel line or injector","Loose gas cap","Damaged EVAP canister"],next:"Don't smoke near the car. If the smell is strong or you see fuel dripping, don't drive it."},
 {t:"Clicking but won't start",c:"Starting Problems",sev:"med",k:"click no start dead battery",s:"Rapid clicking usually means the battery doesn't have enough charge to turn the starter.",causes:["Weak or dead battery","Corroded battery terminals","Failing starter"],next:"Try a jump start. If it starts, have the battery and alternator tested."},
 {t:"Cranks but won't start",c:"Starting Problems",sev:"med",k:"cranks no start turns over",s:"The engine turns over but doesn't fire — it's missing fuel, spark or air.",causes:["Out of fuel / bad fuel pump","Failed crankshaft sensor","Anti-theft system lockout","Clogged fuel filter"],next:"Check the fuel gauge and listen for the fuel pump hum when you turn the key to ON."},
 {t:"Slow crank in cold weather",c:"Starting Problems",sev:"low",k:"slow crank cold morning",s:"Cold weather weakens batteries, so a tired battery shows up first on cold mornings.",causes:["Aging battery (3–5+ years)","Corroded terminals","Wrong oil viscosity"],next:"Get a free battery test at a parts store before it leaves you stranded."}
];
const SEV={high:"Stop soon",med:"Get checked",low:"Monitor"};
const esc=s=>s.replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

const cats=document.getElementById('cats');
Object.keys(ICONS).forEach(c=>{
  const b=document.createElement('button');b.className='cat';
  b.innerHTML=ICONS[c]+`<h3>${c}</h3><p>${CAT_DESC[c]}</p>`;
  b.onclick=()=>showCategory(c);cats.appendChild(b);
});
["Overheating","Check engine light","Grinding brakes","Won't start","Sweet smell","Blue smoke"].forEach(q=>{
  const b=document.createElement('button');b.className='chip';b.type='button';b.textContent=q;
  b.onclick=()=>{input.value=q;run(q)};document.getElementById('chips').appendChild(b);
});

const input=document.getElementById('searchInput'),results=document.getElementById('results');
function render(list,label){
  results.classList.add('show');
  if(!list.length){results.innerHTML=`<div class="none">No match yet for “${esc(label)}”. On the live site, the AI assistant would pick up from here.</div>`;return}
  results.innerHTML=list.map((x,i)=>`<div class="res" data-i="${i}">
    <div class="res-top"><h4>${esc(x.t)}</h4><span class="sev ${x.sev}">${SEV[x.sev]}</span></div>
    <p>${esc(x.s)}</p>
    <div class="detail"><div class="lbl">Common causes</div><ul>${x.causes.map(c=>`<li>${esc(c)}</li>`).join('')}</ul><div class="lbl">What to do</div><div>${esc(x.next)}</div></div>
  </div>`).join('');
  results.querySelectorAll('.res').forEach(el=>el.onclick=()=>el.classList.toggle('open'));
}
function run(q){
  const words=q.toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(w=>w.length>2&&!["the","and","car","my","its","when","from","with"].includes(w));
  const scored=S.map(x=>{const hay=(x.t+' '+x.k+' '+x.c+' '+x.s).toLowerCase();let sc=0;words.forEach(w=>{if(hay.includes(w))sc+=(x.t.toLowerCase().includes(w)?3:1)});return{x,sc}}).filter(o=>o.sc>0).sort((a,b)=>b.sc-a.sc).slice(0,6).map(o=>o.x);
  render(scored,q);
}
function showCategory(c){input.value='';render(S.filter(x=>x.c===c),c);document.querySelector('.hero').scrollIntoView({behavior:'smooth'})}
document.getElementById('searchForm').addEventListener('submit',e=>{e.preventDefault();const q=input.value.trim();if(!q)return;
  const v=findVehicle(q);if(v){const y=(q.match(/\b(19|20)\d{2}\b/)||[])[0];go(v,y?+y:null,q);return}run(q)});
document.querySelectorAll('[data-cat]').forEach(a=>a.addEventListener('click',e=>{if(location.pathname!=='/')return;e.preventDefault();showCategory(a.dataset.cat)}));
document.getElementById('menuBtn').onclick=()=>document.getElementById('links').classList.toggle('open');

// VIN check: validates format + check digit, reads model year (pos 10) and manufacturer (WMI)
const WMI={"1HG":"Honda (USA)","JHM":"Honda (Japan)","2HG":"Honda (Canada)","1FA":"Ford","1FT":"Ford Truck","1FM":"Ford SUV","3FA":"Ford (Mexico)","1G1":"Chevrolet","1GC":"Chevrolet Truck","2G1":"Chevrolet (Canada)","1GT":"GMC Truck","1GN":"Chevrolet SUV","1C4":"Chrysler/Jeep/Dodge","1C6":"Ram Truck","2C3":"Chrysler/Dodge (Canada)","3C6":"Ram (Mexico)","4T1":"Toyota (USA)","5TD":"Toyota (USA)","JTD":"Toyota (Japan)","JTE":"Toyota (Japan)","2T1":"Toyota (Canada)","5YJ":"Tesla","7SA":"Tesla","1N4":"Nissan (USA)","JN1":"Nissan (Japan)","3N1":"Nissan (Mexico)","KMH":"Hyundai","5NP":"Hyundai (USA)","KNA":"Kia","5XY":"Kia (USA)","WBA":"BMW","5UX":"BMW (USA)","WDD":"Mercedes-Benz","4JG":"Mercedes-Benz (USA)","WVW":"Volkswagen","3VW":"Volkswagen (Mexico)","WAU":"Audi","JF1":"Subaru","4S4":"Subaru (USA)","JM1":"Mazda","1J4":"Jeep","1J8":"Jeep","19X":"Honda (USA)","5FN":"Honda (USA)","5J6":"Honda (USA)","2T3":"Toyota (Canada)","JTM":"Toyota (Japan)"};
const VAL={A:1,B:2,C:3,D:4,E:5,F:6,G:7,H:8,J:1,K:2,L:3,M:4,N:5,P:7,R:9,S:2,T:3,U:4,V:5,W:6,X:7,Y:8,Z:9};
const WT=[8,7,6,5,4,3,2,10,0,9,8,7,6,5,4,3,2];
const YR="ABCDEFGHJKLMNPRSTVWXY123456789";
function vinCheck(v){let s=0;for(let i=0;i<17;i++){const ch=v[i];const n=/\d/.test(ch)?+ch:VAL[ch];s+=n*WT[i]}const r=s%11;return (r===10?'X':String(r))===v[8]}
function vinYear(v){const i=YR.indexOf(v[9]);if(i<0)return null;const a=1980+i,b=2010+i;
  // position 7 letter => 2010+ cycle for North American passenger vehicles
  return /[A-Z]/.test(v[6])?b:(b<=new Date().getFullYear()+1?a+" or "+b:a)}
const V=window.VEHICLES||[];
const norm=t=>t.toLowerCase().replace(/[^a-z0-9]/g,'');
function findVehicle(q){const n=norm(q);let best=null,bs=0;
  V.forEach(v=>{const m=norm(v.model),mk=norm(v.make);let sc=0;
    if(n.includes(mk+m))sc=100+m.length;else if(m.length>=4&&n.includes(m))sc=m.length+(n.includes(mk)?50:0);else if(n.includes(mk)&&new RegExp('\\b'+v.model.toLowerCase().replace(/[^a-z0-9]+/g,'\\W*')+'\\b').test(q.toLowerCase()))sc=40;
    if(sc>bs){bs=sc;best=v}});return best}
function clampYear(v,y){return y&&y>=v.years[0]&&y<=v.years[1]?y:null}
function url(v,y){return '/vehicles/'+v.id+'/'+(y?y+'/':'')}
function go(v,y,q){y=clampYear(v,y);location.href=url(v,y)+(q?'?q='+encodeURIComponent(q):'')}
const state={q:'',tab:'All'};

// picker
const pm=document.getElementById('pickModel'),py=document.getElementById('pickYear');
V.forEach(v=>pm.add(new Option(v.make+' '+v.model,v.id)));
function fillYears(){const v=V.find(x=>x.id===pm.value);py.innerHTML='';for(let y=v.years[1];y>=v.years[0];y--)py.add(new Option(y,y))}
pm.onchange=fillYears;fillYears();
document.getElementById('pickForm').addEventListener('submit',e=>{e.preventDefault();go(V.find(x=>x.id===pm.value),+py.value)});
const makes=[...new Set(V.map(v=>v.make))];
document.getElementById('mgrid').outerHTML=`<div id="mgrid">${makes.map(m=>`<details class="mk"><summary>${esc(m)} <span>${V.filter(v=>v.make===m).length} models</span></summary><div class="mgrid">${V.filter(v=>v.make===m).map(v=>`<a href="${url(v)}">${esc(v.model)}<span>${v.years[0]}–${v.years[1]}</span></a>`).join('')}</div></details>`).join('')}</div>`;

function issueCard(i){return `<div class="issue"><div class="meta"><span class="sev ${i.sev}">${SEV[i.sev]}</span><span class="pill">${i.y[0]===i.y[1]?i.y[0]:i.y[0]+'–'+i.y[1]}</span><span class="pill">${esc(i.sys)}</span>${i.eng?`<span class="pill">${esc(i.eng)}</span>`:''}</div>
<h3>${esc(i.t)}</h3><dl><div><dt>What you'll notice</dt><dd>${esc(i.sym)}</dd></div><div><dt>Why it happens</dt><dd>${esc(i.why)}</dd></div><div><dt>What to do</dt><dd>${esc(i.next)}</dd></div></dl></div>`}

function renderVehicle(v,year){
  const el=document.getElementById('vehicleView');
  let list=year?v.issues.filter(i=>year>=i.y[0]&&year<=i.y[1]):v.issues.slice();
  const cats=['All',...new Set(list.map(i=>i.cat))];
  if(!cats.includes(state.tab))state.tab='All';
  const shown=state.tab==='All'?list:list.filter(i=>i.cat===state.tab);
  let yopts='<option value="">All years</option>';for(let y=v.years[1];y>=v.years[0];y--)yopts+=`<option ${y===year?'selected':''}>${y}</option>`;
  const name=(year?year+' ':'')+v.make+' '+v.model;
  const general=state.q?S.map(x=>{const hay=(x.t+' '+x.k).toLowerCase();return{x,sc:state.q.toLowerCase().split(/\s+/).filter(w=>w.length>3&&hay.includes(w)).length}}).filter(o=>o.sc).sort((a,b)=>b.sc-a.sc).slice(0,3).map(o=>o.x):[];
  el.innerHTML=`<div class="crumb"><a href="/">Home</a> › ${esc(v.make)} › ${esc(v.model)}${year?' › '+year:''}</div>
  <div class="vhead"><div class="eyebrow">Known problems</div><h1>${esc(name)} problems</h1>
  <p class="sub">${year?`Problems owners and mechanics report most for the ${esc(name)}.`:`Problems reported most across ${v.years[0]}–${v.years[1]}. Pick your year to narrow it down.`}${v.alt?' '+esc(v.alt.replace(/\.$/,''))+'.':''}</p></div>
  <div class="yearbar"><label for="vy" style="color:var(--muted);font-size:14px">Model year</label><select id="vy">${yopts}</select></div>
  ${general.length?`<h2 style="font-size:20px">Matching your search</h2><div class="results show" style="margin:10px 0 26px;max-width:none">${general.map(x=>`<div class="res open"><div class="res-top"><h4>${esc(x.t)}</h4><span class="sev ${x.sev}">${SEV[x.sev]}</span></div><p>${esc(x.s)}</p><div class="detail"><div class="lbl">What to do</div><div>${esc(x.next)}</div></div></div>`).join('')}</div>`:''}
  <h2 style="font-size:20px">${shown.length?'Known problems for this vehicle':'No model-specific problems on file for this year yet'}</h2>
  <p class="lead">${list.length?list.length+' documented issue'+(list.length>1?'s':'')+(year?' apply to '+year:' across all years')+'.':'That can mean a solid year, or one we have not finished researching. General symptom search still works.'}</p>
  ${cats.length>2?`<div class="tabs">${cats.map(c=>`<button class="tab ${c===state.tab?'on':''}" data-tab="${c}">${c}</button>`).join('')}</div>`:''}
  ${shown.map(issueCard).join('')}
  <div class="livebox" id="nhtsa"><b>Safety recalls${year?' for the '+esc(name):''}</b><br>${year?'Checking the NHTSA recall database…':'Pick a model year to see its safety recalls.'}</div>
  <div class="trust">This page is a general guide based on widely reported problems. Not every vehicle is affected, and it doesn't replace an in-person diagnosis.</div>`;
  el.querySelector('#vy').onchange=e=>{location.href=url(v,+e.target.value||null)};
  loadNhtsa(v,year);
  el.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;renderVehicle(v,year)});
}
function route(){
  const m=location.pathname.match(/^\/vehicles\/([a-z0-9-]+)\/(?:((?:19|20)\d{2})\/)?$/);
  const v=m&&V.find(x=>x.id===m[1]);
  if(v){state.q=new URLSearchParams(location.search).get('q')||'';document.getElementById('homeView').style.display='none';document.getElementById('vehicleView').style.display='';renderVehicle(v,clampYear(v,m[2]?+m[2]:null));return}
  const h=location.hash.replace('#','');
  if(h&&document.getElementById(h))setTimeout(()=>document.getElementById(h).scrollIntoView(),50);
}
route();
async function loadNhtsa(v,year){
  const box=document.getElementById('nhtsa');if(!box||!year)return;
  const link='<a style="color:var(--blue2)" href="https://www.nhtsa.gov/recalls" target="_blank" rel="noopener">nhtsa.gov/recalls</a>';
  try{
    const r=await fetch('https://api.nhtsa.gov/recalls/recallsByVehicle?make='+encodeURIComponent(v.nmake||v.make)+'&model='+encodeURIComponent(v.nmodel||v.model)+'&modelYear='+year);
    const d=await r.json();const list=(d.results||[]);
    if(!list.length){box.innerHTML=`<b>Safety recalls for the ${year} ${esc(v.make)} ${esc(v.model)}</b><br>No recalls found under this exact model name. Enter your VIN at ${link} to be sure — recalls are fixed free at a dealer.`;return}
    box.innerHTML=`<b>${list.length} safety recall${list.length>1?'s':''} for the ${year} ${esc(v.make)} ${esc(v.model)}</b><div style="margin-top:10px">${list.slice(0,12).map(x=>`<div class="issue" style="margin:8px 0;padding:14px"><div class="meta"><span class="pill">${esc(x.NHTSACampaignNumber||'')}</span><span class="pill">${esc((x.Component||'').split(':')[0])}</span></div><dl><div><dt>Problem</dt><dd>${esc(x.Summary||'')}</dd></div><div><dt>Fix</dt><dd>${esc(x.Remedy||'')}</dd></div></dl></div>`).join('')}</div>Not every vehicle is included in every recall. Enter your VIN at ${link} to see which apply to yours. Recall repairs are free at a dealer.`;
  }catch(_){box.innerHTML=`<b>Safety recalls</b><br>Couldn't reach the recall database right now. Check your VIN at ${link}.`}
}

// VIN decoder: live NHTSA lookup, with an offline fallback
function vinLinks(make,year){const ms=V.filter(v=>make&&norm(make).includes(norm(v.make))||make&&norm(v.make).includes(norm(make).slice(0,4)));
  return ms.length?`<div style="margin-top:10px;color:var(--muted)">Open your vehicle:</div><div class="chips">${ms.map(v=>`<a class="chip" href="${url(v,clampYear(v,year))}">${esc(v.make)} ${esc(v.model)}</a>`).join('')}</div>`:''}
document.getElementById('vinForm').addEventListener('submit',async e=>{
  e.preventDefault();const out=document.getElementById('vinOut');
  const v=document.getElementById('vinInput').value.toUpperCase().replace(/\s/g,'');
  if(!/^[A-HJ-NPR-Z0-9]{17}$/.test(v)){out.innerHTML='<div class="err">A VIN is 17 characters and never uses I, O or Q. Check it and try again.</div>';return}
  out.innerHTML='<div style="color:var(--muted)">Decoding…</div>';
  const row=(a,b)=>b?`<div class="row"><span>${a}</span><span>${esc(String(b))}</span></div>`:'';
  try{
    const r=await fetch('https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/'+v+'?format=json');
    const d=(await r.json()).Results[0];if(!d.Make)throw 0;
    const yr=+d.ModelYear,match=V.find(x=>norm(x.make)===norm(d.Make)&&norm(d.Model).includes(norm(x.model)));
    out.innerHTML=row('Year',d.ModelYear)+row('Make',d.Make)+row('Model',d.Model)+row('Trim',d.Trim)+row('Engine',[d.DisplacementL&&(+d.DisplacementL).toFixed(1)+'L',d.EngineCylinders&&d.EngineCylinders+'-cyl',d.FuelTypePrimary].filter(Boolean).join(' '))+row('Drive',d.DriveType)+row('Built in',d.PlantCountry)
      +(match?`<a class="btn" style="display:inline-block;margin-top:12px;padding:12px 18px" href="${url(match,clampYear(match,yr))}">See ${esc(d.ModelYear)} ${esc(match.model)} problems</a>`:vinLinks(d.Make,yr));
  }catch(_){
    const ok=vinCheck(v),mk=WMI[v.slice(0,3)],yr=vinYear(v);
    out.innerHTML=`<div class="row"><span>Check digit</span><span style="color:${ok?'var(--green)':'var(--amber)'}">${ok?'Valid':'Doesn’t match — possible typo'}</span></div>`
      +row('Model year',yr||'Unknown')+row('Manufacturer',mk||'Unknown')+vinLinks(mk,typeof yr==='number'?yr:null);
  }
});
