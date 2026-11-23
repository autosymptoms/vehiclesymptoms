// Site script: homepage search, vehicle pages, VIN decoder. Guide helpers come from guide.js (window.VS_GUIDES).
const SEV={high:"Stop soon",med:"Get checked",low:"Monitor"};
const {esc,search:searchGuides,forIssue,gurl}=window.VS_GUIDES;
// mark the tab you're on, and scroll the phone tab strip to it
(function(){const nav=document.getElementById('links');if(!nav)return;const p=location.pathname;
  let best=null,bl=0;nav.querySelectorAll('a').forEach(a=>{const h=a.getAttribute('href')||'';if(h==='/'){if(p==='/'&&!best){best=a;bl=1}return}
    if(h.startsWith('/')&&p.startsWith(h)&&h.length>bl){best=a;bl=h.length}});
  if(best){best.classList.add('on');if(nav.scrollWidth>nav.clientWidth)nav.scrollLeft=Math.max(0,best.offsetLeft-70)}})();
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
// These model names also occur as ordinary words in symptom descriptions.
const ambiguousModels=new Set(('accent air bolt breeze charger compass echo edge element escape express fit flex focus '+
  'insight ion journey kicks leaf matrix neon outlook pilot probe relay sonic spark terrain tracker transit vibe volt').split(' '));
const vehiclePattern=name=>name.toLowerCase().match(/[a-z0-9]+/g).join('[^a-z0-9]*');
let vehicleSearchNames;
function findVehicle(q){
  if(!vehicleSearchNames)vehicleSearchNames=V.map(v=>{
    const model=vehiclePattern(v.model),make=vehiclePattern(v.make);
    return {v,full:new RegExp('\\b'+make+'[^a-z0-9]*'+model+'\\b','i'),
      model:new RegExp('\\b'+model+'\\b','i'),dated:new RegExp('\\b(?:19|20)\\d{2}\\s+'+model+'\\b','i')};
  });
  let best=null,bestScore=0;
  for(const name of vehicleSearchNames){
    const full=q.match(name.full),dated=full?null:q.match(name.dated),match=full || dated || q.match(name.model);
    if(!match)continue;
    const model=norm(name.v.model);
    const ambiguous=ambiguousModels.has(model) || model.length<4 || /^\d+$/.test(model);
    if(!full && !dated && ambiguous && norm(q)!==model)continue;
    const score=(full?200:dated?100:0)+model.length;
    if(score>bestScore){bestScore=score;best={vehicle:name.v,text:match[0]}}
  }
  return best;
}
function soldY(v,y){return y>=v.years[0]&&y<=v.years[1]&&!(v.gaps||[]).some(g=>y>=g[0]&&y<=g[1])}
function clampYear(v,y){return y&&soldY(v,y)?y:null}
function url(v,y){return '/vehicles/'+v.id+'/'+(y?y+'/':'')}
function go(v,y,q){y=clampYear(v,y);location.href=url(v,y)+(q?'?q='+encodeURIComponent(q):'')}
const state={q:'',tab:'All'};
// "My car": remember the driver's vehicle in this browser (light convenience only)
const GKEY='vs_garage',MAXG=6;
// "My garage": up to 6 vehicles remembered in this browser (light convenience only). First one is the main vehicle.
function getG(){try{let g=JSON.parse(localStorage.getItem(GKEY)||'null');
    if(!g){const old=JSON.parse(localStorage.getItem('vs_mycar')||'null');g=old?[old]:[]}
    return (Array.isArray(g)?g:[]).filter(m=>m&&V.find(v=>v.id===m.id))}catch(_){return []}}
function saveG(g){try{localStorage.setItem(GKEY,JSON.stringify(g.slice(0,MAXG)));localStorage.removeItem('vs_mycar')}catch(_){}}
const sameCar=(a,b)=>a.id===b.id&&(a.y||null)===(b.y||null);
function inG(id,y){return getG().some(m=>sameCar(m,{id,y}))}
function addG(id,y){const g=getG();if(!g.some(m=>sameCar(m,{id,y})))g.push({id,y:y||null});saveG(g)}
function removeG(id,y){saveG(getG().filter(m=>!sameCar(m,{id,y})))}
function getMy(){return getG()[0]||null}
function setMy(id,y){addG(id,y)}
const carName=m=>{const v=V.find(x=>x.id===m.id);return (m.y?m.y+' ':'')+v.make+' '+v.model};
const carUrl=m=>url(V.find(x=>x.id===m.id),m.y);
function showMy(){
  const g=getG(),box=document.getElementById('mycarSaved'),pick=document.getElementById('mycarPick');
  const nav=document.getElementById('navMy');
  if(nav){if(!g.length){nav.textContent='My vehicle';nav.href='/#vehicle'}else if(g.length===1){nav.textContent='My '+carName(g[0]);nav.href=carUrl(g[0])}else{nav.textContent='My garage ('+g.length+')';nav.href='/#vehicle'}}
  if(!box||!pick)return;
  if(!g.length){box.hidden=true;pick.hidden=false;return}
  box.hidden=false;pick.hidden=true;
  box.innerHTML=`<div class="mysaved"><p class="eyebrow">${g.length>1?'Your garage':'Your vehicle'}</p>
  ${g.map((m,i)=>`<div class="gcar${i?'':' main'}"><a href="${carUrl(m)}"><b>${esc(carName(m))}</b><span>${i?'Problems and recalls':'Problems, upkeep and recalls'} →</span></a><button type="button" class="gx" data-i="${i}" aria-label="Remove ${esc(carName(m))}">✕</button></div>`).join('')}
  <div class="row2">${g.length<MAXG?'<button type="button" id="gAdd">+ Add another vehicle</button>':'<span></span>'}<a href="/symptoms/">Something wrong? Start here</a></div></div>`;
  box.querySelectorAll('.gx').forEach(b=>b.onclick=()=>{const m=g[+b.dataset.i];removeG(m.id,m.y);showMy()});
  const add=document.getElementById('gAdd');if(add)add.onclick=()=>{box.hidden=true;pick.hidden=false;const h=pick.querySelector('h2');if(h)h.textContent='Add another vehicle';
    if(!pick.querySelector('.gback')){const bk=document.createElement('button');bk.type='button';bk.className='gback';bk.textContent='← Back to my garage';bk.onclick=()=>{showMy()};pick.appendChild(bk)}}
}


// picker
const homePick=window.YMM(document.getElementById('pickYear'),document.getElementById('pickMake'),document.getElementById('pickModel'),null,()=>{const s=homePick.get();document.getElementById('pickGo').disabled=!s.v});
document.getElementById('pickForm').addEventListener('submit',e=>{e.preventDefault();const s=homePick.get();if(s.v){setMy(s.v.id||s.v,s.y);go(s.v,s.y)}});
const makes=[...new Set(V.map(v=>v.make))];
document.getElementById('mgrid').outerHTML=`<div id="mgrid">${makes.map(m=>`<details class="mk"><summary>${esc(m)} <span>${V.filter(v=>v.make===m).length} models</span></summary><div class="mgrid">${V.filter(v=>v.make===m).map(v=>`<a href="${url(v)}">${esc(v.model)}<span>${v.years[0]}–${v.years[1]}</span></a>`).join('')}</div></details>`).join('')}</div>`;

const money=n=>'$'+n.toLocaleString('en-US');
const WH='Insufficient verified pricing for this vehicle and repair';
const priced=c=>c&&!c.withheld&&!c.free&&typeof c.lo==='number';
const quoteRequestUrl=(repair,id,year)=>{const q=new URLSearchParams({repair});if(id)q.set('v',id);if(year)q.set('y',year);return '/price-check/?'+esc(q.toString())+'#pcApp'};
const costLine=(c,id,year)=>c&&c.withheld?`<div class="cost cost-wh"><div class="cost-top"><span class="cost-l">Repair cost</span><span class="cost-v sm">${WH}</span></div><div class="cost-job">${esc(c.job)}. <a href="${quoteRequestUrl(c.job,id,year)}">Prepare an itemized shop request</a>.${c.recall?' <span class="rc">A dealer can check your VIN for possible recall or extended-warranty coverage.</span>':''}</div></div>`:c&&c.free?`<div class="cost"><div class="cost-top"><span class="cost-l">Typical repair cost</span><span class="cost-v">No charge if your vehicle is in the recall</span></div><div class="cost-job">${esc(c.job)}${c.note?`<br><span class="cost-note">${esc(c.note)}</span>`:''}</div></div>`:c?`<div class="cost"><div class="cost-top"><span class="cost-l">Typical repair cost</span><span class="cost-v">${money(c.lo)}–${money(c.hi)}</span></div><div class="cost-job">${esc(c.job)}${c.recall?' <span class="rc">May be free under a recall or extended warranty.</span>':''}${c.note?`<br><span class="cost-note">${esc(c.note)}</span>`:''}</div></div>`:'';
const PRICE_DISC='Estimates only, not a quote. Ranges are averages built from typical parts prices plus standard book labor time at a typical shop labor rate. Your price will depend on your area, the shop, the parts used and what the shop finds. Dealers often charge more. Diagnosis and taxes are extra.';
const SNAP_NOTE="The problems here are the ones we've documented so far, not a complete list or a reliability rating.";
const rngTxt=c=>money(c.lo)+'–'+money(c.hi);
function priceGuide(list,name){
  const seen=new Set(),uniq=list.filter(i=>i.cost&&!seen.has(i.cost.job)&&seen.add(i.cost.job));
  const SR={high:0,med:1,low:2};
  const pay=uniq.filter(i=>priced(i.cost)&&!i.cost.recall).sort((a,b)=>SR[a.sev]-SR[b.sev]||b.cost.hi-a.cost.hi);
  const rec=uniq.filter(i=>i.cost.free||(i.cost.recall&&!i.cost.withheld));
  const wh=uniq.filter(i=>i.cost.withheld);
  if(!pay.length&&!rec.length&&!wh.length)return '';
  const max=Math.max(1,...pay.map(i=>i.cost.hi));
  const row=i=>{const c=i.cost,l=c.lo/max*100,w=Math.max((c.hi-c.lo)/max*100,1.5);return `<div class="pg-row"><div class="pg-lab"><span class="sev ${i.sev}">${SEV[i.sev]}</span><b>${esc(c.job)}</b><span class="pg-val">${rngTxt(c)}</span></div><div class="pg-track"><span class="pg-bar" style="left:${l.toFixed(1)}%;width:${w.toFixed(1)}%"></span></div></div>`};
  const first=pay.slice(0,8),rest=pay.slice(8);
  return `<section class="pguide" id="prices"><div class="pg-head"><div><div class="eyebrow">Price guide</div><h2>Repair prices for your ${esc(name)}</h2></div>${pay.length?'<span class="pg-badge">Average estimates</span>':''}</div>
  ${!pay.length&&wh.length?`<p class="pg-sub"><b>${WH}.</b> We have not yet matched these repairs to two independent, dated price sources for this vehicle, so we show no price, chart or verdict for them.</p><ul class="dots pg-wh">${wh.map(i=>`<li>${esc(i.cost.job)}</li>`).join('')}</ul>`:pay.length?`<p class="pg-sub">Repairs owners of this vehicle may have to pay for, most serious first. Bars show the low-to-high range.</p>${first.map(row).join('')}${rest.length?`<details class="pg-more"><summary>Show ${rest.length} more repair${rest.length>1?'s':''}</summary>${rest.map(row).join('')}</details>`:''}`:rec.length?`<p class="pg-sub">No common out-of-pocket repairs on file for this year. The repairs below are normally covered by recalls.</p>`:''}
  ${rec.length?`<div class="pg-rec"><h3>Recall repairs: usually free at the dealer</h3><p class="pg-sub">A dealer can confirm coverage by VIN. An eligible safety recall repair is provided at no charge.</p><ul>${rec.map(i=>`<li><b>${esc(i.cost.job.replace(/\s*\(recall\)$/i,''))}</b><span>No charge if your vehicle is included</span></li>`).join('')}</ul></div>`:''}
  <a class="walk big" href="/price-check/" id="pgQuote">Get help with a shop quote →</a><p class="pg-disc"><b>Disclaimer:</b> ${PRICE_DISC}</p></section>`;
}
function snapshot(v,year,list,name){
  const own=v.own,serious=list.filter(i=>i.sev==='high').length;
  const big=list.filter(i=>priced(i.cost)&&!i.cost.recall).sort((a,b)=>b.cost.hi-a.cost.hi)[0];
  const tiles=[];
  if(own&&own.annual&&!own.annual.withheld)tiles.push(`<div class="tile"><span class="tl">Average yearly repair and maintenance</span><span class="tv">${money(own.annual.amount)}<small>/yr</small></span><span class="tn">National average for the ${esc(v.make+' '+v.model)}, all years</span></div>`);
  tiles.push(list.length?`<div class="tile"><span class="tl">Problems documented${year?' for '+year:''}</span><span class="tv">${list.length}</span><span class="tn">${serious?serious+' rated serious':'None on file rated serious'}</span></div>`:`<div class="tile"><span class="tl">Problems documented${year?' for '+year:''}</span><span class="tv sm2">Not yet</span><span class="tn">We haven't documented issues for this year yet. Not a reliability rating.</span></div>`);
  tiles.push(`<div class="tile" id="recTile"><span class="tl">Safety recalls</span><span class="tv">${year?'…':'—'}</span><span class="tn">${year?'Checking NHTSA':'Pick a year'}</span></div>`);
  if(big)tiles.push(`<div class="tile"><span class="tl">Highest-cost issue covered here</span><span class="tv sm">${rngTxt(big.cost)}</span><span class="tn">${esc(big.cost.job)}</span></div>`);
  const m=own&&own.maint&&own.maint.length?`<div class="maint"><h3>Routine maintenance costs <small>(model-wide, not specific to one year or engine)</small></h3><div class="mt">${own.maint.map(x=>`<div class="mrow"><div><b>${esc(x.job)}</b><span>${esc(x.every)}${x.note?' · '+esc(x.note):''}</span></div><span class="mv">${x.withheld?`<small>Price not verified<br><a href="${quoteRequestUrl(x.job,v.id,year)}">Ask for an estimate</a></small>`:rngTxt(x)}</span></div>`).join('')}</div></div>`:'';
  return `<section class="snap"><div class="snap-h"><h2>At a glance</h2></div><div class="tiles">${tiles.join('')}</div>${m}<p class="snap-note">${SNAP_NOTE}</p></section>`;
}
// Oil change / maintenance reminder and tire pressure light reset steps for this model (and year), from src/resets/models.
function resetSection(v,year,name){
  const r=v.reset,mk=v.resetMake;if(!r&&!mk)return '';
  const pick=list=>(list||[]).filter(x=>!year||(year>=x.years[0]&&year<=x.years[1]));
  const block=(list,title)=>{const L=pick(list);if(!L.length)return '';return `<h3 class="rs-h">${title}</h3>${L.map((x,i)=>`<div class="rvar"><div class="rv-h">${L.length>1?`<span class="rv-n">${i+1}</span>`:''}<b>${esc(x.when)}</b></div>${x.none?'':`<ol class="nums">${x.steps.map(t=>`<li>${esc(t)}</li>`).join('')}</ol>`}${x.note?`<p class="lmuted">${esc(x.note)}</p>`:''}${x.src&&x.src.length?`<p class="lsrc">Source: ${x.src.map(esc).join(' · ')}</p>`:''}</div>`).join('')}`};
  const oil=r?block(r.oil,'Oil change or maintenance reminder'):'',tp=r?block(r.tpms,'Tire pressure (TPMS) light'):'';
  const mkLink=mk?`<a class="walk" href="/warning-lights/reset/${mk}/">Reset steps for other ${esc(v.make)} models →</a>`:'';
  if(!oil&&!tp)return mk?`<section class="card csec" id="reset"><h2>Reset the oil change or tire pressure light</h2><p>We have not checked the exact steps for ${year?'the '+esc(name):'this model'} yet. The usual ${esc(v.make)} steps are here: <a href="/warning-lights/reset/${mk}/">how to reset the oil change and tire pressure lights on ${/^[aeiou]/i.test(String(esc(v.make)))?'an':'a'} ${esc(v.make)}</a>.</p></section>`:'';
  return `<section class="card csec" id="reset"><h2>How to reset the oil change and tire pressure lights${year?' on '+(/^[aeiou]/i.test(name)?'an ':'a ')+esc(name):''}</h2><p class="pg-sub">These are reminders, not faults. Do the oil change or set the tire pressures first, then reset.${year?'':' Pick your model year above to see only the steps for your car.'}</p>${oil}${tp}${r.notes?`<p class="lmuted">${esc(r.notes)}</p>`:''}<p class="lmuted">Button names can differ by trim. Your owner's manual is the final word for your exact car. If the light comes straight back, or a tire pressure light blinks and then stays on, something else needs checking.</p>${mkLink}</section>`;
}
function issueCard(i){return `<div class="issue"><div class="meta"><span class="sev ${i.sev}">${SEV[i.sev]}</span><span class="pill">${i.y[0]===i.y[1]?i.y[0]:i.y[0]+'–'+i.y[1]}</span><span class="pill">${esc(i.sys)}</span>${i.eng?`<span class="pill">${esc(i.eng)}</span>`:''}</div>
<h3>${esc(i.t)}</h3><dl><div><dt>What you'll notice</dt><dd>${esc(i.sym)}</dd></div><div><dt>Why it happens</dt><dd>${esc(i.why)}</dd></div><div><dt>What to do</dt><dd>${esc(i.next)}</dd></div></dl>${costLine(i.cost,i._v,i._y)}${i.animation?`<a class="mv-issue" href="${esc(i.animation.href)}">Repair animation · ${esc(i.animation.title)}</a>`:''}${(g=>g?`<a class="walk" href="${gurl(g.id)}?v=${i._v||''}${i._y?'&y='+i._y:''}">Walk through this symptom: ${esc(g.title)} →</a>`:'')(forIssue(i))}</div>`}

function renderVehicle(v,year){
  const el=document.getElementById('vehicleView');
  let list=year?v.issues.filter(i=>year>=i.y[0]&&year<=i.y[1]):v.issues.slice();
  // Engine choice: engine-only problems show for that engine; everything else shows for every engine.
  const engs=(v.engines||[]).filter(e=>!year||(year>=e.y[0]&&year<=e.y[1]));
  let esel='';try{esel=localStorage.getItem('vs_eng_'+v.id)||''}catch(e){}
  if(!engs.some(e=>e.k===esel))esel='';
  const allN=list.length;
  if(esel)list=list.filter(i=>!i.engs||i.engs.includes(esel));
  const ename=esel?engs.find(e=>e.k===esel).name:'';
  const cats=['All',...new Set(list.map(i=>i.cat))];
  if(!cats.includes(state.tab))state.tab='All';
  const shown=state.tab==='All'?list:list.filter(i=>i.cat===state.tab);
  let yopts='<option value="">All years</option>';for(let y=v.years[1];y>=v.years[0];y--)if(soldY(v,y))yopts+=`<option ${y===year?'selected':''}>${y}</option>`;
  const name=(year?year+' ':'')+v.make+' '+v.model;
  const general=state.q?searchGuides(state.q,3):[];
  const SR={high:0,med:1,low:2};const sorted=shown.slice().sort((a,b)=>SR[a.sev]-SR[b.sev]);
  const mslug=v.make.toLowerCase().replace(/[^a-z0-9]+/g,'-');
  let ylinks='';for(let y=v.years[1];y>=v.years[0];y--)if(soldY(v,y))ylinks+=y===year?`<span aria-current="page"><b>${y}</b></span>`:`<a href="${url(v,y)}">${y}</a>`;
  el.innerHTML=`<div class="crumb"><a href="/">Home</a> › <a href="/vehicles/#${mslug}">${esc(v.make)}</a> › ${year?`<a href="${url(v)}">${esc(v.model)}</a> › ${year}`:esc(v.model)}</div>
  <div class="vhead"><div class="vh-top"><div class="eyebrow">${year?'My vehicle':'Vehicle guide'}</div><div class="vh-btns"><button type="button" class="savecar dl" data-dl>Download this page (PDF)</button>${year?`<button type="button" class="savecar" id="saveCar">+ Save to my garage</button>`:''}</div></div><h1>${year?'Your '+esc(name):esc(name)} <span class="h1s">problems and recalls</span></h1>
  <p class="sub">${year?`What we've documented about the ${esc(name)}: problems owners and shops report, and safety recalls.`:`Problems reported across ${v.years[0]}–${v.years[1]}. Pick your model year below to see what applies to your vehicle.`}${v.alt?' '+esc(v.alt.replace(/\.$/,''))+'.':''}</p></div>
  <p class="byline">VehicleSymptoms team · Updated November 2026 · <a href="/about/">How we work</a></p>
  <div class="yearbar"><label for="vy" style="color:var(--muted);font-size:14px">Model year</label><select id="vy">${yopts}</select>${engs.length>1?`<label for="ve" style="color:var(--muted);font-size:14px;margin-left:6px">Engine</label><select id="ve"><option value="">All engines</option>${engs.map(e=>`<option value="${e.k}" ${e.k===esel?'selected':''}>${esc(e.name)}</option>`).join('')}</select>`:''}</div>${engs.length>1&&!esel&&list.some(i=>i.engs)?`<p class="enghint">Pick your engine to hide problems that only affect other engines. Not sure? It is on the sticker under the hood or in the owner's manual.</p>`:''}${esel?`<p class="enghint on">Showing problems for the <b>${esc(ename)}</b> plus everything that applies to every ${esc(v.model)}${allN>list.length?' ('+(allN-list.length)+' other-engine issue'+(allN-list.length>1?'s':'')+' hidden)':''}.</p>`:''}
  ${general.length?`<h2 style="font-size:20px">Walk through your symptom</h2><div class="glist" style="margin:10px 0 26px">${general.map(g=>`<a class="gcard" href="${gurl(g.id)}?v=${v.id}${year?'&y='+year:''}"><b>${esc(g.title)}</b><span>${esc(g.h1)}</span></a>`).join('')}</div>`:''}
  <h2 style="font-size:22px">${shown.length?'Known problems'+(year?' for your '+esc(name):''):'We haven\'t documented model-specific issues for this year yet'}</h2>
  <p class="lead">${list.length?list.length+' documented issue'+(list.length>1?'s':'')+(year?' apply to '+year:' across all years')+(esel?' with the '+esc(ename):'')+', most serious first.':'This is not a reliability rating. We simply haven\'t researched this year in depth yet. If something\'s wrong, start with what the car is doing: our symptom guides work for every vehicle.'}</p>
  ${cats.length>2?`<div class="tabs">${cats.map(c=>`<button class="tab ${c===state.tab?'on':''}" data-tab="${c}">${c}</button>`).join('')}</div>`:''}
  ${sorted.map(i=>issueCard(Object.assign({},i,{_v:v.id,_y:year}))).join('')}
  ${snapshot(v,year,list,name)}
  ${priceGuide(list,name)}
  ${resetSection(v,year,name)}
  <div class="livebox" id="nhtsa"><b>Safety recalls${year?' for the '+esc(name):''}</b><br>${year?'Checking the NHTSA recall database…':'Pick a model year to see its safety recalls.'}</div>
  <details class="vin-d yall"><summary>Other ${esc(v.make+' '+v.model)} model years</summary><nav class="ylinks" aria-label="${esc(v.make+' '+v.model)} model years">${ylinks}</nav></details>
  <div class="dlbox"><div><b>Keep a copy of this page</b><span>Download every problem and the recalls for ${year?'your ':'the '}${esc(name)} as a PDF you can save, print or bring to your shop.</span></div><button type="button" class="btn" data-dl>Download this page (PDF)</button></div>
  <div class="trust">This page is a general guide based on widely reported problems. Not every vehicle is affected, and it doesn't replace an in-person diagnosis.</div>`;
  window.VS_PAGE={v,year,list,name,ename};
  const pq=el.querySelector('#pgQuote');if(pq)pq.href='/price-check/?v='+v.id+(year?'&y='+year:'');
  const sc=el.querySelector('#saveCar');if(sc){const paint=()=>{const on=inG(v.id,year);sc.textContent=on?'✓ In my garage':'+ Save to my garage';sc.classList.toggle('on',on)};paint();sc.onclick=()=>{inG(v.id,year)?removeG(v.id,year):addG(v.id,year);paint();showMy()}}
  {const ve=el.querySelector('#ve');if(ve)ve.onchange=e=>{try{localStorage.setItem('vs_eng_'+v.id,e.target.value)}catch(x){}renderVehicle(v,year)}}
  el.querySelector('#vy').onchange=e=>{location.href=url(v,+e.target.value||null)};
  refreshRecalls(v,year);
  el.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;renderVehicle(v,year)});
}
function route(){
  const m=location.pathname.match(/^\/vehicles\/([a-z0-9-]+)\/(?:((?:19|20)\d{2})\/)?$/);
  const v=m&&V.find(x=>x.id===m[1]);
  if(v){state.q=new URLSearchParams(location.search).get('q')||'';document.getElementById('homeView').style.display='none';document.getElementById('vehicleView').style.display='';const go2=()=>renderVehicle(v,clampYear(v,m[2]?+m[2]:null));if(v._full||!window.VS_LOAD)go2();else window.VS_LOAD(v.id).then(go2);return}
  const h=location.hash.replace('#','');
  if(h&&document.getElementById(h))setTimeout(()=>document.getElementById(h).scrollIntoView(),50);
}
route();
// Safety recalls for one model year, live from NHTSA.
// Queries come from the verified make/model/year map (v.rq, built from src/recall-map.json); a combined label such as
// "R1T / R1S" is queried as each actual model. A count is shown only after a successful, validated lookup for the
// right vehicle. "0" is shown only when the mapping for that year is verified. Anything else: "Lookup unavailable".
// These are campaigns filed for the model year, not open recalls on a specific VIN.
window.VS_RECALL_QUERIES=function(v,year){
  const r=(v.rq||[]).find(x=>year>=x.from&&year<=x.to);
  if(r)return {verified:!!r.verified,queries:r.queries};
  if(/ \/ /.test(v.model))return {verified:false,queries:[]};// combined label with no mapping: never query the label itself
  return {verified:false,queries:[{make:(v.nmake||v.make).toUpperCase(),model:(v.nmodel||v.model).toUpperCase(),label:v.model}]};
};
window.VS_RECALL_VALIDATE=function(d,q,year){
  if(!d||typeof d!=='object'||!Array.isArray(d.results))return 'malformed response';
  const n=typeof d.Count==='number'?d.Count:typeof d.count==='number'?d.count:null;
  if(n===null||n!==d.results.length)return 'count does not match results';
  const nm=t=>String(t||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  for(const x of d.results){
    if(!/^\d{2}[VECT]\d{6}$/.test(String(x.NHTSACampaignNumber||'')))return 'bad campaign number';
    if(nm(x.Make)!==nm(q.make)||nm(x.Model)!==nm(q.model)||String(x.ModelYear)!==String(year))return 'result is for a different vehicle';
  }
  return '';
};
async function fetchRecalls(q,year){
  const ctl=typeof AbortController!=='undefined'?new AbortController():null;const t=setTimeout(()=>ctl&&ctl.abort(),10000);
  try{const r=await fetch('https://api.nhtsa.gov/recalls/recallsByVehicle?make='+encodeURIComponent(q.make)+'&model='+encodeURIComponent(q.model)+'&modelYear='+year,ctl?{signal:ctl.signal}:undefined);
    if(!r.ok)throw new Error('HTTP '+r.status);const d=await r.json();const bad=window.VS_RECALL_VALIDATE(d,q,year);if(bad)throw new Error(bad);
    return d.results}finally{clearTimeout(t)}
}
async function copyField(field,status,success){
  const value=field.value;
  try{
    await navigator.clipboard.writeText(value);
    if(field.value===value)status.textContent=success;
  }catch{
    field.focus();field.select();
    status.textContent='Message selected. Use your device’s Copy command.';
  }
}
function refreshRecalls(v,year){
  const pg=window.VS_PAGE;
  pg.recalls=null;
  pg.ready=loadNhtsa(v,year).then(result=>{pg.recalls=result});
}
async function loadNhtsa(v,year){
  const box=document.getElementById('nhtsa');if(!box||!year)return;
  const rt=document.getElementById('recTile'),name=year+' '+v.make+' '+v.model;
  function addVinNote(){
    const note='Could you check my '+name+' by VIN for open safety recalls, tell me which campaigns apply and whether any repairs are still outstanding?';
    box.insertAdjacentHTML('beforeend',`<details class="pg-more"><summary>Prepare a VIN question for my dealer</summary>
      <label for="recQuestion">Your message</label><textarea class="pc-request" id="recQuestion" readonly rows="3">${esc(note)}</textarea>
      <button class="btn ghost" type="button" id="recCopy">Copy recall question</button> <span id="recCopyStatus" role="status"></span></details>`);
    box.querySelector('#recCopy').onclick=()=>copyField(box.querySelector('#recQuestion'),box.querySelector('#recCopyStatus'),'Recall question copied.');
  }
  const fail=(why,retry=false)=>{
    if(rt)rt.innerHTML='<span class="tl">Model-year safety recalls</span><span class="tv">—</span><span class="tn">Recall count unavailable.</span>';
    box.innerHTML=`<b>Safety recalls: lookup unavailable</b><p>We could not confirm the NHTSA campaign list for the ${esc(name)}. The recall count and the status of your individual VIN are unknown.</p>`;
    if(retry){
      const button=document.createElement('button');button.className='btn ghost';button.type='button';button.textContent='Retry recall lookup';
      button.onclick=()=>{button.disabled=true;button.textContent='Checking NHTSA…';refreshRecalls(v,year)};
      box.appendChild(button);
    }
    addVinNote();
    return {status:'unavailable',reason:why,checked:new Date().toISOString()};
  };
  const M=window.VS_RECALL_QUERIES(v,year);if(!M.queries.length)return fail('no verified model mapping');
  let groups;try{groups=await Promise.all(M.queries.map(async q=>({label:q.label||q.model,query:q,results:await fetchRecalls(q,year)})))}catch(e){return fail(e&&e.message||'error',true)}
  // Several NHTSA names can cover one vehicle (e.g. 1 SERIES and 128I): merge by label and count each campaign once.
  {const by=new Map();for(const g of groups){const k=g.label.replace(/\s+/g,' ');const seen=by.get(k)||{label:g.label,query:g.query,results:[],ids:new Set()};for(const x of g.results)if(!seen.ids.has(x.NHTSACampaignNumber)){seen.ids.add(x.NHTSACampaignNumber);seen.results.push(x)}by.set(k,seen)}
   groups=[...by.values()].map(({ids,...g})=>g)}
  const total=new Set(groups.flatMap(g=>g.results.map(x=>x.NHTSACampaignNumber))).size;
  if(!total&&!M.verified)return fail('zero results under an unverified model mapping');
  const res={status:'ok',groups,total,checked:new Date().toISOString()};
  const multi=groups.length>1;
  if(rt)rt.innerHTML=`<span class="tl">Model-year safety recalls</span><span class="tv">${total}</span><span class="tn">${total?'<a href="#nhtsa">See model-year campaigns</a>':'None listed for this model year. Individual VIN status unknown.'}</span>`;
  const card=x=>`<div class="issue" style="margin:8px 0;padding:14px"><div class="meta"><span class="pill">${esc(x.NHTSACampaignNumber||'')}</span><span class="pill">${esc((x.Component||'').split(':')[0])}</span></div><dl><div><dt>Problem</dt><dd>${esc(x.Summary||'')}</dd></div><div><dt>Fix</dt><dd>${esc(x.Remedy||'')}</dd></div></dl></div>`;
  box.innerHTML=`<b>${total?total+' safety recall'+(total>1?'s':''):'No safety recalls'} filed for the ${esc(name)}</b><p style="margin:6px 0 0;font-size:14px">${total?'These are campaigns NHTSA lists for this model year. Not every vehicle is included in every campaign, and this does not show whether a recall is still open on your car.':'NHTSA\'s recall database returned no campaigns for this model year.'}</p>`+
    groups.map(g=>`${multi?`<h3 style="margin:14px 0 4px;font-size:16px">${esc(g.label)}: ${g.results.length}</h3>`:''}<div style="margin-top:10px">${g.results.slice(0,12).map(card).join('')}${g.results.length>12?`<details><summary>Show ${g.results.length-12} more campaigns</summary>${g.results.slice(12).map(card).join('')}</details>`:''}</div>`).join('')+
    '<p><b>Is a recall open on my vehicle?</b> A model-year search cannot confirm whether your VIN is included or whether its recall repair was completed. A dealer can check the status for your VIN.</p>';
  addVinNote();
  return res;
}

// Download this page as a PDF. The PDF code and library load only when someone asks for it.
function dlPdf(btn){
  const pg=window.VS_PAGE;if(!pg||btn.disabled)return;
  const label=btn.textContent;btn.disabled=true;btn.textContent='Preparing your PDF…';
  const ld=src=>new Promise((ok,no)=>{if(document.querySelector('script[data-dl-src="'+src+'"]'))return ok();const e=document.createElement('script');e.src=src;e.dataset.dlSrc=src;e.onload=ok;e.onerror=()=>{e.remove();no()};document.head.appendChild(e)});
  const wait=Promise.race([pg.ready||Promise.resolve(),new Promise(r=>setTimeout(r,6000))]);
  Promise.all([ld('/vendor/jspdf.umd.min.js'),ld('/pdf.js'),wait]).then(()=>{window.VS_PDF(Object.assign({disc:PRICE_DISC,note:SNAP_NOTE},pg));btn.textContent='✓ Downloaded';})
    .catch(()=>{btn.textContent="Couldn't make the PDF. Tap to try again"})
    .then(()=>{btn.disabled=false;setTimeout(()=>{btn.textContent=label},4000)});
}
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-dl]');if(b)dlPdf(b)});

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


// ---- homepage: "What is your car doing?" ----
// A clarifying question as a row of easy choices; a target is a guide id or a site path.
// A target starting with "?" opens a follow-up question in place (window.VS_GUIDES.askFollow).
function askHtml(question,qs){return `<p><b>${esc(question.question)}</b></p><div class="nm-cats">${question.choices.map(([label,target])=>{
  if(target.startsWith('?'))return `<a href="/symptoms/#drive" data-ask="${esc(target.slice(1))}" data-qs="${esc(qs||'')}">${esc(label)}</a>`;
  const href=target.startsWith('/')?target:gurl(target)+(qs||'');return `<a href="${esc(href)}">${esc(label)}</a>`}).join('')}</div>`}
document.addEventListener('click',e=>{const a=e.target.closest&&e.target.closest('[data-ask]');if(!a)return;const f=window.VS_GUIDES.askFollow(a.dataset.ask);if(!f)return;
  e.preventDefault();const box=a.closest('.results')||a.parentNode.parentNode;box.innerHTML=askHtml(f,a.dataset.qs);const st=document.getElementById('helpStatus');if(st)st.textContent=f.question+' Choose an answer below.';
  const first=box.querySelector('a');if(first)first.focus()});
const hf=document.getElementById('helpForm');
if(hf){
  const hi=document.getElementById('helpInput'),out=document.getElementById('helpResults'),status=document.getElementById('helpStatus');
  hf.addEventListener('submit',e=>{
    e.preventDefault();
    const q=hi.value.trim();
    if(!q){out.innerHTML='';out.classList.remove('show');if(status)status.textContent='';return}
    const cm=q.match(/\b([PBCU][0-3][0-9A-F]{3})\b/i);
    // A code alone goes to code lookup; a code plus a danger sign ("P0300 and the light is flashing") shows the safety step first.
    if(cm&&!window.VS_GUIDES.emergency(q.replace(cm[0],' '))){location.href='/codes/?q='+cm[1].toUpperCase();return}
    const vehicleMatch=findVehicle(q),v=vehicleMatch?.vehicle;
    const year=(q.match(/\b(?:19|20)\d{2}\b/)||[])[0],y=v?clampYear(v,+year):null;
    const qs=v?`?v=${v.id}${y?'&y='+y:''}`:'';
    // Remove the matched vehicle and year so "2012 Honda Civic shakes" can ask about timing.
    const symptom=v?q.replace(vehicleMatch.text,' ').replace(/\b(?:19|20)\d{2}\b/g,' '):q;
    const urgent=window.VS_GUIDES.emergency(cm?symptom.replace(cm[0],' '):symptom);
    if(urgent){
      // Danger first: the immediate safe action, then the most urgent guide, then anything else that matched.
      const gs=searchGuides(symptom,5);
      // Vague wording ("smoke is coming out of the car"): safety step first, then the easy where/what question.
      const ask=window.VS_GUIDES.clarifySearch(symptom.replace(cm?cm[0]:'',' '));
      out.innerHTML=`<div class="safety urgentnow" role="alert"><b>Do this first</b><p>${esc(urgent.now)}</p>${urgent.also.map(t=>`<p>${esc(t)}</p>`).join('')}</div>`+(ask?askHtml(ask,qs):
        `<p><b>Then follow the guide:</b></p><div class="glist">${gs.map((g,i)=>`<a class="gcard${i===0?' first':''}" href="${gurl(g.id)}${qs}"><b>${esc(g.title)}</b><span>${esc(g.h1)}</span></a>`).join('')}`+
        `${cm?`<a class="gcard" href="/codes/?q=${cm[1].toUpperCase()}"><b>Look up ${esc(cm[1].toUpperCase())}</b><span>What this trouble code means</span></a>`:''}</div>`);
      out.classList.add('show');
      if(status)status.textContent='Urgent safety step shown first. '+urgent.now+(ask?' '+ask.question:'');
      return;
    }
    const question=window.VS_GUIDES.clarifySearch(symptom);
    const gs=question?[]:searchGuides(symptom,5);
    if(gs.length===1){location.href=gurl(gs[0].id)+qs;return}
    if(question){
      out.innerHTML=askHtml(question,qs);
    }else{
      out.innerHTML=gs.length?`<p><b>Which guide fits what you noticed?</b></p><div class="glist">${gs.map(g=>`<a class="gcard" href="${gurl(g.id)}${qs}"><b>${esc(g.title)}</b><span>${esc(g.h1)}</span></a>`).join('')}</div>${v?`<p class="muted">Or see <a href="${url(v,y)}">known problems for the ${y?y+' ':''}${esc(v.make+' '+v.model)}</a>.</p>`:''}`
        :v?`<p>We don't have a guide for that wording yet. <a href="${url(v,y)}">See known problems for the ${esc(v.make+' '+v.model)} →</a></p>`
      :`<div class="nomatch"><p class="muted" style="margin:0 0 6px">We couldn't match that wording yet. That's OK, one easy question:</p>${askHtml(window.VS_GUIDES.noticeFirst(),'')}<p class="muted" style="margin-top:8px">Have a trouble code from a scanner? <a href="/codes/">Look it up</a>. Or describe it differently, for example: "squeal when braking", "shakes at highway speed", "clicks when I turn the key".</p></div>`;
    }
    out.classList.add('show');
    if(status)status.textContent=question?question.question+' Choose an answer below.':
      gs.length?gs.length+' matching guides. Choose a guide below.':
      v?'No matching guide. A link to known problems for your vehicle is available.':'What did you notice first? Choose an answer below.';
  });
  // "I'm not sure" chip: ask what they noticed first instead of making them name the problem.
  const ns=document.getElementById('notSure');
  if(ns)ns.addEventListener('click',e=>{e.preventDefault();out.innerHTML=askHtml(window.VS_GUIDES.noticeFirst(),'');out.classList.add('show');
    if(status)status.textContent='What did you notice first? Choose an answer below.';const f=out.querySelector('a');if(f)f.focus()});
}

// StoryBrand homepage: CTA buttons jump to the symptom box and focus it
['planCta','finalCta'].forEach(id=>{const a=document.getElementById(id);if(a)a.onclick=e=>{e.preventDefault();window.scrollTo({top:0,behavior:'smooth'});setTimeout(()=>{const i=document.getElementById('helpInput');if(i)i.focus({preventScroll:true})},400)}});
document.querySelectorAll('.hcta').forEach(a=>a.onclick=e=>{const i=document.getElementById('helpInput');if(i&&document.getElementById('homeView').style.display!=='none'){e.preventDefault();window.scrollTo({top:0,behavior:'smooth'});setTimeout(()=>i.focus({preventScroll:true}),400)}});

showMy();

// Code lookup hub search
(function(){const f=document.getElementById('codeForm');if(!f||!window.CODE_INDEX)return;const qi=document.getElementById('codeQ'),out=document.getElementById('codeRes');
  const run=q=>{q=q.trim();if(!q){out.innerHTML='';return}const Q=q.toUpperCase().replace(/\s+/g,'');
    const exact=CODE_INDEX.find(c=>c[0]===Q);if(exact){location.href='/codes/'+exact[0].toLowerCase()+'/';return}
    const words=q.toLowerCase().split(/\s+/).filter(Boolean);
    const hits=CODE_INDEX.filter(c=>c[0].startsWith(Q)||words.every(w=>(c[1]+' '+c[2]).toLowerCase().includes(w))).slice(0,30);
    out.innerHTML=hits.length?hits.map(c=>`<a class="gcard" href="/codes/${c[0].toLowerCase()}/"><b>${c[0]}</b><span>${esc(c[1])}</span></a>`).join(''):`<p class="muted">We don't have ${esc(q)} yet. Manufacturer-specific codes (like P1xxx) are being added. Try the first letters, like P04.</p>`};
  f.onsubmit=e=>{e.preventDefault();run(qi.value)};qi.oninput=()=>{if(qi.value.trim().length>=2&&!/^[pbcu]\d{4}$/i.test(qi.value.trim()))run(qi.value)};
  const q0=new URLSearchParams(location.search).get('q');if(q0){qi.value=q0;run(q0)}})();
// personal touch on code pages
(function(){const box=document.getElementById('codeMy');if(!box)return;const g=getG();if(!g.length)return;
  box.innerHTML=`<div class="codemy"><span>Your ${g.length>1?'vehicles':'vehicle'}:</span>${g.map(m=>`<a href="${carUrl(m)}">${esc(carName(m))} ›</a>`).join('')}</div>`})();
// warning light hub filter
(function(){const f=document.getElementById('lfilter');if(!f)return;f.querySelectorAll('button').forEach(b=>b.onclick=()=>{f.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));const c=b.dataset.c;
  document.querySelectorAll('#lgrid .lcard').forEach(a=>{const k=a.dataset.c;a.hidden=!(c==='all'||k===c||(c==='info'&&(k==='green'||k==='blue')))});
  const s=document.getElementById('lsearch');if(s)s.value='';const n=document.getElementById('lnone');if(n)n.hidden=true})})();
(function(){const s=document.getElementById('lsearch');if(!s)return;
  // Match each word the visitor typed against the light's names and how its symbol looks ("oil can", "thermometer").
  const filler=new Set('a an the my is it its on of in with and or that this like looks look shaped shape symbol icon sign light lights lit dash dashboard warning came come comes just car cars little small yellow orange red'.split(' '));
  const words=q=>q.toLowerCase().replace(/['’]/g,'').replace(/[^a-z0-9]+/g,' ').trim().split(' ').filter(w=>w&&!filler.has(w));
  s.oninput=()=>{const q=s.value.trim();const qw=words(q);let shown=0;
    document.querySelectorAll('#lgrid .lcard').forEach(a=>{const k=(a.dataset.k||a.textContent.toLowerCase()).split(' ');
      const hit=!qw.length||qw.every(w=>k.some(x=>x===w||(w.length>=3&&x.startsWith(w))||(w.length>3&&w.endsWith('s')&&x===w.slice(0,-1))));a.hidden=!hit;if(hit)shown++});
    const n=document.getElementById('lnone');
    if(n){n.hidden=!!shown||!q;
      // Never a dead end: the safety rule for red lights, symptom guides that match, and the color filters.
      if(!shown&&q){const G=window.VS_GUIDES,urgent=G&&G.emergency(q),gs=G?G.search(q,4):[];
        n.innerHTML=(urgent?`<div class="safety urgentnow" role="alert"><b>Do this first</b><p>${esc(urgent.now)}</p></div>`:'')+
          `<p><b>No symbol matched “${esc(q)}”.</b> If the light is red, pull over when it's safe and turn the engine off, then find it below.</p>`+
          `<div class="nm-cats"><button type="button" class="nm-cat" data-c="red">Show red lights</button><button type="button" class="nm-cat" data-c="amber">Show amber lights</button><button type="button" class="nm-cat" data-c="info">Green or blue lights</button></div>`+
          (gs.length?`<p><b>Or follow a guide for what the car is doing:</b></p><div class="glist">${gs.map(g=>`<a class="gcard" href="${gurl(g.id)}"><b>${esc(g.title)}</b><span>${esc(g.h1)}</span></a>`).join('')}</div>`:
            `<p><a href="/">Describe what the car is doing instead →</a></p>`);
        n.querySelectorAll('button[data-c]').forEach(b=>b.onclick=()=>{const t=document.querySelector('#lfilter button[data-c="'+b.dataset.c+'"]');if(t)t.click();const g=document.getElementById('lgrid');if(g)g.scrollIntoView({block:'start'})})}}
    const f=document.getElementById('lfilter');if(f&&q)f.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x.dataset.c==='all'))}})();
// "Is my quote fair?" price check
(function(){const app=document.getElementById('pcApp');if(!app)return;
  const qs=new URLSearchParams(location.search);const g=getG();
  const requested=qs.get('v')?{id:qs.get('v'),year:+qs.get('y')||null}:(g[0]?{id:g[0].id,year:g[0].y}:null);
  // A model-only link does not establish a model year for price coverage.
  const selectedVehicle=requested&&V.find(v=>v.id===requested.id);
  const init=selectedVehicle&&clampYear(selectedVehicle,requested.year)?requested:null;
  const E=window.EST||{jobs:[],rates:{},nat:null,states:[],rsrc:[]};const norm=t=>t.toLowerCase().replace(/\s*\(.*?\)\s*/g,' ').trim();
  const CL={economy:'Economy or compact car',midsize:'Midsize car or crossover',truck:'Truck or large SUV',luxury:'Luxury car'};
  let clsSaved='';
  const estBox=document.getElementById('pcEst'),clsS=document.getElementById('pcCls'),stS=document.getElementById('pcSt');
  // Any change to an input clears the previous verdict, so a result never describes inputs the driver has since changed.
  const clearOut=()=>{const o=document.getElementById('pcOut');if(o)o.innerHTML=''};
  if(clsS){clsS.innerHTML='<option value="">Any kind</option>'+Object.entries(CL).map(([k,l])=>`<option value="${k}">${l}</option>`).join('');stS.innerHTML='<option value="">Whole U.S.</option>'+E.states.map(([k,l])=>`<option value="${k}">${esc(l)}</option>`).join('');
    // Remember the optional kind of vehicle and state on this device only, so a returning driver does not pick them again.
    try{const p=JSON.parse(localStorage.getItem('vs_pc')||'{}');if(p.c&&CL[p.c])clsS.value=clsSaved=p.c;if(p.s&&E.rates[p.s])stS.value=p.s}catch(_){}
    const sv=()=>{try{localStorage.setItem('vs_pc',JSON.stringify({c:clsSaved,s:stS.value}))}catch(_){}};stS.onchange=()=>{sv();clearOut()};clsS.onchange=()=>{clsMan=true;clsSaved=clsS.value;sv();clsHint();clearOut();ready()}}
  // When a vehicle is picked in step 1, pre-select its kind (economy, midsize, truck, luxury) so the range is the one for that kind. The driver can change it; a change made by hand is kept.
  let clsMan=false,clsAuto='';const VCN={e:'economy',m:'midsize',t:'truck',l:'luxury'};
  function clsHint(){if(!estBox)return;let h=document.getElementById('pcClsHint');if(!h){h=document.createElement('p');h.id='pcClsHint';h.className='muted';h.style.cssText='font-size:13.5px;margin:0;grid-column:1/-1';estBox.appendChild(h)}let v=null;try{v=pick.get().v}catch(_){}const on=!!(v&&clsAuto&&clsS.value===clsAuto&&!clsMan);h.hidden=!on;if(on)h.textContent='Kind of vehicle set from your '+v.make+' '+v.model+'. Change it if it does not fit.'}
  function clsSet(){if(!clsS)return;let v=null;try{v=pick.get().v}catch(_){}const c=v&&E.vc&&VCN[E.vc[v.id]];clsAuto=c||'';if(!clsMan)clsS.value=c||clsSaved;clsHint()}
  const rnd=(n,up)=>{const st=n<500?10:n<2000?25:50;return (up?Math.ceil(n/st):Math.floor(n/st))*st};
  function estR(e,c,st){const r=st&&E.rates[st]?E.rates[st]:E.nat;let lo=1/0,hi=0;const rows=(c?[c]:Object.keys(e.cls)).map(k=>{const x=e.cls[k],a=rnd(x.p[0]+x.h[0]*r[0],false),b=Math.max(rnd(x.p[1]+x.h[1]*r[1],true),a+10);lo=Math.min(lo,a);hi=Math.max(hi,b);return {k,x,a,b}});return {lo,hi,rows,r}}
  let job=null;const ji=document.getElementById('pcJob'),sug=document.getElementById('pcSug'),picked=document.getElementById('pcPicked'),amt=document.getElementById('pcAmt'),goB=document.getElementById('pcGo'),out=document.getElementById('pcOut');
  const request=document.getElementById('pcRequest'),copyStatus=document.getElementById('pcCopyStatus');
  const quoteStep=document.getElementById('pcQuoteStep'),referenceBox=document.getElementById('pcServiceNotes');
  ji.value=(qs.get('repair')||'').trim().slice(0,ji.maxLength);
  function refreshRequest(ref){
    const {v,y}=pick.get();
    const model=v||(!y&&requested&&!requested.year?selectedVehicle:null);
    const car=model?(y?y+' ':'')+model.make+' '+model.model:'my vehicle';
    const repair=job?job.job:ji.value.trim();
    const intro=repair?'I have a question about “'+repair+'” for '+car+'. Could you confirm what you find and explain any work you recommend?':'Could you explain the work you recommend for '+car+'?';
    request.value=intro+(ref?'\n\n'+ref.question:'')+'\n\nPlease send a written estimate before I approve any work. Please list each part, its price and quality, the labor hours and hourly rate, any diagnostic fee, taxes and shop fees, the total, and the warranty on parts and labor.';
    copyStatus.textContent='';
  }
  document.getElementById('pcCopy').onclick=()=>copyField(request,copyStatus,'Request copied.');
  function vehicleReferences(s){
    return s.v&&s.y?(E.references||[]).filter(r=>r.vehicleId===s.v.id&&r.year===s.y):[];
  }
  function showReferences(ref){
    referenceBox.innerHTML=ref?`<h3>What to confirm for this repair</h3><p>${esc(ref.question)}</p><p class="fine">Service descriptions checked against ${ref.sources.map(s=>esc(s.name)+' ('+esc(s.checked)+')').join(' and ')}.</p>`:'';

  }
  const pick=window.YMM(document.getElementById('pcY'),document.getElementById('pcM'),document.getElementById('pcMo'),init,()=>{job=null;clearOut();picked.hidden=true;if(estBox)estBox.hidden=true;ji.hidden=false;clsMan=false;clsSet();ready();list();const sv=pick.get().v;if(sv&&!sv._full&&window.VS_LOAD)window.VS_LOAD(sv.id).then(list)});
  const gb=document.getElementById('pcGarage');if(g.length)gb.innerHTML='<span>Your garage:</span>'+g.map((m,i)=>`<button type="button" data-i="${i}">${esc(carName(m))}</button>`).join('');
  gb.querySelectorAll('button').forEach(b=>b.onclick=()=>{const m=g[+b.dataset.i];location.search='?v='+m.id+(m.y?'&y='+m.y:'')});
  // Eligibility comes first: a repair that does not apply to the picked vehicle's powertrain is not suggested, linked, priced or judged.
  const PT=window.VS_PT;let blocked=[];
  function elig(job,s){if(!s.v)return {ok:true,general:true};return PT?PT.eligible(job,s.v,s.y):{ok:null,reason:'Eligibility check unavailable.'}}
  function jobs(){const s=pick.get(),out=[];const seen=new Set();blocked=[];
    const add=o=>{const e=elig(o.job,s);if(e.ok===true){if(e.general&&o.gen)o.src+=' · general, not specific to your vehicle';out.push(o)}else blocked.push({job:o.job,reason:e.reason,hay:(o.hay||o.job).toLowerCase()})};
    if(s.v){const vname=(s.y?s.y+' ':'')+s.v.make+' '+s.v.model;
      for(const i of s.v.issues)if(i.cost&&!i.cost.free&&(!s.y||(s.y>=i.y[0]&&s.y<=i.y[1]))&&!seen.has(i.cost.job)){seen.add(i.cost.job);add({job:i.cost.job,lo:i.cost.lo,hi:i.cost.hi,withheld:!!i.cost.withheld,src:'Known problem on the '+vname,recall:i.cost.recall})}
      if(s.v.own)for(const m of s.v.own.maint)if(!seen.has(m.job)){seen.add(m.job);add({job:m.job,lo:m.lo,hi:m.hi,withheld:!!m.withheld,src:'Routine maintenance for the '+s.v.make+' '+s.v.model})}}
    const en=new Set();for(const e of E.jobs){en.add(norm(e.job));(e.aka||[]).forEach(a=>en.add(norm(a)));if(!seen.has(e.job)){seen.add(e.job);add({job:e.job,hay:(e.job+' '+(e.aka||[]).join(' ')).toLowerCase(),est:e,src:'Sourced estimate: parts prices plus stated labor time',gen:true})}}
    for(const x of (window.GEN_PRICES||[]))if(!seen.has(x[0])&&!en.has(norm(x[0])))add({job:x[0],lo:x[1],hi:x[2],src:'General estimate (all vehicles)',gen:true});
    return out}
  function selectJob(selected){
    job=selected;clearOut();sug.innerHTML='';ji.hidden=true;picked.hidden=false;
    picked.innerHTML=`<b>${esc(job.job)}</b><span>${job.withheld?'Verified price unavailable. ':''}${esc(job.src)}</span><button type="button" id="pcRe">Change</button>`;
    if(estBox){
      estBox.hidden=!job.est;
      let note=document.getElementById('pcNote');
      if(!note){note=document.createElement('p');note.id='pcNote';estBox.appendChild(note)}
      note.textContent=job.est&&job.est.note||'';note.hidden=!note.textContent;
    }
    document.getElementById('pcRe').onclick=()=>{
      job=null;clearOut();picked.hidden=true;if(estBox)estBox.hidden=true;ji.hidden=false;list();ji.focus();
    };
    showReferences(job.ref);refreshRequest(job.ref);ready();
    if(quoteStep.hidden)document.getElementById('pcCopy').focus();else amt.focus();
  }
  function list(){
    if(job)return;
    const q=ji.value.trim().toLowerCase(),words=q.split(/\s+/).filter(Boolean),s=pick.get();
    const matches=text=>words.every(word=>text.toLowerCase().includes(word));
    const all=jobs(),byName=new Map(all.map(j=>[norm(j.job),j]));
    const references=vehicleReferences(s).filter(r=>elig(r.job,s).ok===true);
    for(const ref of references){
      const existing=[ref.job,...ref.aliases].map(name=>byName.get(norm(name))).find(Boolean);
      const reference=existing||{job:ref.job,withheld:true,src:'Vehicle-specific shop question'};
      reference.ref=ref;
      reference.hay=[reference.hay||reference.job,ref.job,...ref.aliases].join(' ').toLowerCase();
      if(!existing){all.unshift(reference);byName.set(norm(ref.job),reference)}
    }
    const hits=(q?all.filter(j=>matches(j.hay||j.job)):all.filter(j=>!j.gen)).slice(0,q?12:8);
    const allowed=new Set(all.map(j=>norm(j.job)));
    if(q)for(const name of (E.held||[]).filter(matches)){
      if(allowed.has(norm(name)))continue;
      const e=elig(name,s);
      if(e.ok!==true){blocked.push({job:name,reason:e.reason,hay:name.toLowerCase()});continue}
      if(hits.length<12)hits.push({job:name,withheld:true,src:'No verified price range. Prepare a shop request.'});
    }
    const excluded=q?blocked.filter(b=>matches(b.hay)).filter((b,i,arr)=>arr.findIndex(x=>x.job===b.job)===i).slice(0,2):[];
    sug.innerHTML=hits.map((j,k)=>`<button type="button" data-k="${k}"><b>${esc(j.job)}</b><span>${esc(j.src)}</span></button>`).join('');
    if(excluded.length)sug.insertAdjacentHTML('beforeend',excluded.map(b=>`<p class="pc-inel"><b>${esc(b.job)}</b> ${esc(b.reason)}</p>`).join(''));
    if(q&&!hits.length&&!excluded.length)sug.innerHTML='<p class="muted" role="status">No matching repair. Your wording is in the shop request below.</p>';
    sug.querySelectorAll('button').forEach(b=>b.onclick=()=>selectJob(hits[+b.dataset.k]));
    const exactRef=q&&references.find(r=>[r.job,...r.aliases].some(name=>norm(name)===norm(q)));
    showReferences(exactRef);refreshRequest(exactRef);ready();
  }
  function ready(){
    const available=job&&!job.withheld&&elig(job.job,pick.get()).ok===true&&
      (job.est?(!clsS.value||job.est.cls[clsS.value]):Number.isFinite(job.lo)&&Number.isFinite(job.hi));
    quoteStep.hidden=!available;goB.disabled=!(available&&Number.isFinite(+amt.value)&&+amt.value>0);
  }
  ji.oninput=list;amt.oninput=()=>{clearOut();ready()};clsSet();list();
  {const sv=pick.get().v;if(sv&&!sv._full&&window.VS_LOAD)window.VS_LOAD(sv.id).then(list)}
  const m$=n=>'$'+Math.round(n).toLocaleString('en-US');
  const m2c=n=>'$'+n.toLocaleString('en-US',{minimumFractionDigits:n%1?2:0,maximumFractionDigits:2});
  const m2=n=>'$'+(Math.round(n*100)/100).toLocaleString('en-US',{maximumFractionDigits:0});
  function estHtml(e,R,c,st){const stn=st?(E.states.find(x=>x[0]===st)||[])[1]:'';const weak=st&&E.rates[st]&&!E.rates[st][2];
    const conf=e.conf==='high'?['Well sourced','every labor time is the maker\'s own for the example vehicle']:e.conf==='medium'?['Estimate','every class has a stated labor time and at least two parts sources']:['Rough estimate','some labor times come from a comparable vehicle or a general guide, not the example vehicle'];
    const rate=`${m2(R.r[0])}–${m2(R.r[1])} an hour (${st?'typical repair shop rate in '+esc(stn)+(weak?', limited data':''):'the national middle: about half of U.S. shops'})`;
    const rows=R.rows.map(o=>`<tr><th scope="row">${CL[o.k]}<small>${esc(o.x.ex)}</small></th><td>${m2(o.x.p[0])}–${m2(o.x.p[1])}</td><td>${o.x.h[0]===o.x.h[1]?o.x.h[0]:o.x.h[0]+'–'+o.x.h[1]} hr</td><td><b>${m$(o.a)}–${m$(o.b)}</b></td></tr>`).join('');
    const src=R.rows.map(o=>`<h4>${CL[o.k]}: ${esc(o.x.ex)}</h4>${[0,1].map(g=>{const L=o.x.src.filter(x=>(x[3]?1:0)===g);return L.length?`${g?'<p class="muted" style="font-size:13.5px;margin:8px 0 2px">Also checked, not used in the range:</p>':''}<ul class="pcr-src">${L.map(x=>`<li><span>${x[1]==='p'?'Parts':'Labor'}</span> <b>${esc(x[0])}</b>: ${esc(x[2])}</li>`).join('')}</ul>`:''}).join('')}`).join('');
    return `<h3>How this range is built <span class="pcr-conf ${e.conf==='low'?'lowc':''}">${conf[0]}</span></h3>
      <p class="muted" style="font-size:13.5px">${esc(e.job)}, ${esc(e.unit)}. Parts run from a good aftermarket part to the dealer's list price. Labor is the stated time multiplied by ${rate}. ${conf[0]}: ${conf[1]}. Last checked ${esc(e.checked)}.</p>
      <div class="pcr-tw"><table class="pcr-t"><thead><tr><th scope="col">Kind of vehicle</th><th scope="col">Parts</th><th scope="col">Labor</th><th scope="col">Total</th></tr></thead><tbody>${rows}</tbody></table></div>${R.rows.some(o=>o.x.h[0]===o.x.h[1])?'<p class="muted" style="font-size:13.5px;margin-top:6px">Where labor shows a single figure, we found only one stated time for that vehicle. Real jobs take more or less than that, so treat the range as narrower than it should be, not as more certain.</p>':''}

      ${c?'':'<p class="muted" style="font-size:13.5px">The typical range above covers all four kinds of vehicle. Pick your kind of vehicle in step 2 to narrow it.</p>'}${st?'<p class="muted" style="font-size:13.5px">State rates are averages across general repair shops. Dealers and big-city shops often charge more; nobody publishes dealer rates by state.</p>':''}
      <h3>What a quote often adds</h3><p>${esc(e.extras)}</p>
      <details class="pcr-d"><summary>Sources for every number (${R.rows.reduce((a,o)=>a+o.x.src.filter(x=>!x[3]).length,0)} references${R.rows.some(o=>o.x.src.some(x=>x[3]))?', plus '+R.rows.reduce((a,o)=>a+o.x.src.filter(x=>x[3]).length,0)+' also checked':''})</summary>${src}<h4>Labor rates</h4><ul class="pcr-src">${E.rsrc.map(u=>`<li><span>${esc(u)}</span></li>`).join('')}</ul></details>
      <p class="muted" style="font-size:13.5px">An estimate is not a quote and not a diagnosis. Your vehicle and your shop may differ.</p>`}
  goB.onclick=()=>{if(goB.disabled||!job)return;const q=+amt.value;const ec=job.est&&clsS?clsS.value:'',es=job.est&&stS?stS.value:'';
    // Re-check eligibility at quote time (the vehicle may have changed since the job was picked).
    const s0=pick.get(),e0=elig(job.job,s0);
    const noRange=e0.ok!==true||job.withheld||(job.est&&ec&&!job.est.cls[ec])||(!job.est&&typeof job.lo!=='number');
    if(noRange){const vn=s0.v?(s0.y?s0.y+' ':'')+s0.v.make+' '+s0.v.model:'';out.innerHTML=`<section class="card pcr none"><div class="eyebrow">Your result${vn?' · '+esc(vn):''}</div><h2>${e0.ok===false?'This repair does not apply':'Insufficient verified pricing for this vehicle and repair'}</h2><p class="pcr-job">${esc(job.job)}: you were quoted <b>${'$'+Math.round(q).toLocaleString('en-US')}</b>.</p><p>${e0.ok===false?esc(e0.reason)+' Ask the shop to show you, in writing, which part they plan to replace and why.':e0.ok===null?esc(e0.reason)+' We show no range or verdict rather than guess.':'We have not matched this repair to two independent, dated price sources for this vehicle, so we show no range, chart or verdict.'}</p>
      <h3>Questions to ask your shop</h3><ul class="dots"><li>Is that the total, including diagnosis, taxes and shop fees?</li><li>How many labor hours is that, and at what hourly rate?</li><li>Are the parts new original (OEM), aftermarket or remanufactured?</li><li>What warranty comes with the parts and the labor?</li><li>Can you show me the worn or failed part before it's replaced?</li></ul></section>`;out.scrollIntoView({behavior:'smooth',block:'start'});return}
    const ER=job.est?estR(job.est,ec,es):null;const lo=ER?ER.lo:job.lo,hi=ER?ER.hi:job.hi;let cls,head,txt;
    if(q<lo){cls='low';head='Below the estimated range';txt='Check that your quote covers the same parts, labor and warranty.'}
    else if(q<=hi){cls='ok';head='Within the estimated range';txt='Ask the shop to confirm the parts, labor, warranty and total in writing.'}
    else{cls='high';head='Above the estimated range';txt='Ask what additional work, parts or fees the shop included. A second itemized quote can help you compare.'}
    // Say what the gap between the quote and the built range amounts to, so the driver knows what to ask about. Only for sourced jobs.
    let gapTxt='';if(ER){const hr=n=>(Math.round(n*10)/10).toLocaleString('en-US');if(q>hi){const gp=q-hi,h0=gp/ER.r[1],h1=gp/ER.r[0];gapTxt=`<p class="pcr-gap">Your quote is <b>${m2c(gp)}</b> above the top of this range. At ${m2(ER.r[0])}–${m2(ER.r[1])} an hour, that is the same as about ${hr(h0)}${hr(h0)===hr(h1)?'':'–'+hr(h1)} more hours of labor than the stated time. It could also be a dearer part, a higher hourly rate, or extra work. Ask the shop which it is.</p>`}else if(q<lo){gapTxt=`<p class="pcr-gap">Your quote is <b>${m2c(lo-q)}</b> below the bottom of this range. Ask whether it covers every part and all the labor, and which brand of part it uses.</p>`}}
    // No kind of vehicle picked: the range covers all four kinds, so say where the quote lands for each kind (same cut-offs as the verdict above). Shown only when the kinds differ.
    let kindTxt='';if(ER&&!ec&&ER.rows.length>1){const KN={economy:'an economy or compact car',midsize:'a midsize car or crossover',truck:'a truck or large SUV',luxury:'a luxury car'},G={b:[],w:[],a:[]};ER.rows.forEach(o=>G[q<o.a?'b':q<=o.b?'w':'a'].push(KN[o.k]));const jn=L=>L.length>1?L.slice(0,-1).join(', ')+' and '+L[L.length-1]:L[0];
      if([G.b,G.w,G.a].filter(L=>L.length).length>1){const ps=[];if(G.w.length)ps.push('within the range for '+jn(G.w));if(G.a.length)ps.push('above it for '+jn(G.a));if(G.b.length)ps.push('below it for '+jn(G.b));kindTxt=`<p class="pcr-gap pcr-kind"><b>It depends on the kind of vehicle.</b> This quote is ${ps.join('; ')}. Pick your kind of vehicle in step 2 to check it against that range alone.</p>`}}
    // Optional: the labor hours written on the quote, compared with the stated time behind the range. Only for sourced jobs; changes no number and no verdict.
    const hrsBox=ER?`<div class="pcr-hrs"><label for="pcHrs">Does the quote list labor hours? <span>(optional)</span></label><div class="pcr-hrs-r"><input id="pcHrs" type="number" inputmode="decimal" min="0" step="0.1" placeholder="e.g. 2.5" aria-describedby="pcHrsOut"><button type="button" id="pcHrsGo" class="btn ghost">Compare hours</button></div><p id="pcHrsOut" class="pcr-gap" aria-live="polite" hidden></p></div>`:'';
    const max=Math.max(hi*1.6,q*1.08),L=lo/max*100,W=(hi-lo)/max*100,Q=Math.min(q/max*100,99);
    const s=pick.get();const vname=s.v?(s.y?s.y+' ':'')+s.v.make+' '+s.v.model:'';
    out.innerHTML=`<section class="card pcr ${cls}"><div class="eyebrow">Your result${vname?' · '+esc(vname):''}</div><h2>${head}</h2><p class="pcr-job">${esc(job.job)}: you were quoted <b>${m2c(q)}</b>. Typical${ER?(ec?' for '+({economy:'an economy or compact car',midsize:'a midsize car or crossover',truck:'a truck or large SUV',luxury:'a luxury car'})[ec]:'')+(es?' in '+esc((E.states.find(x=>x[0]===es)||[])[1]):''):''}: <b>${m$(lo)}–${m$(hi)}</b>.</p>
      <div class="pcr-bar"><span class="band" style="left:${L.toFixed(1)}%;width:${W.toFixed(1)}%"></span><span class="mark" style="left:${Q.toFixed(1)}%"><i></i><em>Your quote</em></span></div>
      <div class="pcr-scale"><span>${m$(0)}</span><span>${m$(max)}</span></div>
      <p>${txt}</p>${ER&&job.est.note?`<p class="pcr-gap pcr-note"><b>Check this first:</b> ${esc(job.est.note)}</p>`:''}${kindTxt}${gapTxt}${hrsBox}${job.recall?'<p class="rc">This repair may be covered by a recall or extended warranty. Check your VIN before paying.</p>':''}${ER?estHtml(job.est,ER,ec,es):''}${job.gen&&!ER?'<p class="muted" style="font-size:13.5px">This is a general estimate across all vehicles. Prices for trucks, luxury and European models usually run higher.</p>':''}
      <h3>Questions to ask your shop</h3><ul class="dots"><li>Is that the total, including diagnosis, taxes and shop fees?</li><li>How many labor hours is that, and at what hourly rate?</li><li>Are the parts new original (OEM), aftermarket or remanufactured?</li><li>What warranty comes with the parts and the labor?</li><li>Can you show me the worn or failed part before it's replaced?</li>${job.recall?'<li>Is there a recall, service bulletin or extended warranty that covers this?</li>':''}</ul>
      <div class="row-btns"><button class="btn" type="button" onclick="window.print()">Print or save this</button>${s.v?`<a class="btn ghost" href="${url(s.v,s.y)}">See your vehicle's page</a>`:''}</div></section>`;
    if(ER){const hi_=document.getElementById('pcHrs'),ho=document.getElementById('pcHrsOut'),hf=n=>(Math.round(n*10)/10).toLocaleString('en-US'),h0=Math.min(...ER.rows.map(o=>o.x.h[0])),h1=Math.max(...ER.rows.map(o=>o.x.h[1]));
      const cmp=()=>{const v=+hi_.value;if(!(v>0)||v>200){ho.hidden=true;return}const st=`The stated time behind this range is <b>${h0===h1?hf(h0):hf(h0)+'–'+hf(h1)} ${h1===1&&h0===1?'hour':'hours'}</b>${ec?'':' across all four kinds of vehicle'}.`;let t;
        if(v>h1){const ex=v-h1;t=`Your quote lists <b>${hf(v)} ${v===1?'hour':'hours'}</b>. ${st} That is ${hf(ex)} ${hf(ex)==='1'?'hour':'hours'} more than the longest stated time, or about <b>${m$(ex*ER.r[0])}${m$(ex*ER.r[0])===m$(ex*ER.r[1])?'':'–'+m$(ex*ER.r[1])}</b> of the quote at ${m2(ER.r[0])}–${m2(ER.r[1])} an hour. Stated times are often what a maker pays its own dealers, which is the low end of what shops bill, and rust, seized parts or added work take longer. Ask the shop what the extra time covers and whether it includes diagnosis.`}
        else if(v<h0)t=`Your quote lists <b>${hf(v)} ${v===1?'hour':'hours'}</b>. ${st} The shop is billing less time than that. Ask whether the quote covers the whole job as described here.`;
        else t=`Your quote lists <b>${hf(v)} ${v===1?'hour':'hours'}</b>. ${st} The hours on your quote are in line with it, so any gap in price comes from the parts or the hourly rate.`;
        ho.innerHTML=t;ho.hidden=false};
      document.getElementById('pcHrsGo').onclick=cmp;hi_.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();cmp()}}}
    out.scrollIntoView({behavior:'smooth',block:'start'})};
})();
