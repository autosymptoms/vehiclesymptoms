// Site script: homepage search, vehicle pages, VIN decoder. Guide helpers come from guide.js (window.VS_GUIDES).
const SEV={high:"Stop soon",med:"Get checked",low:"Monitor"};
// A high-severity issue whose first instruction is to stop says "Stop now", so the badge matches the first action.
const STOP_FIRST=/\b(?:pull over|stop driving|don['’]?t drive|do not drive|turn (?:the engine|it) off|turn off the engine|shut (?:the engine|it) off|have it towed|don['’]?t start|do not start)\b/i;
const sevLabel=i=>i.sev==='high'&&STOP_FIRST.test(String(i.next||'').split(/(?<=[.!])\s/)[0])?'Stop now':SEV[i.sev];
const {esc,search:searchGuides,forIssue,gurl}=window.VS_GUIDES;
// mark the tab you're on, and scroll the phone tab strip to it
(function(){const nav=document.getElementById('links');if(!nav)return;const p=location.pathname;
  let best=null,bl=0;nav.querySelectorAll('a').forEach(a=>{const h=a.getAttribute('href')||'';if(h==='/'){if(p==='/'&&!best){best=a;bl=1}return}
    if(h.startsWith('/')&&p.startsWith(h)&&h.length>bl){best=a;bl=h.length}});
  if(best){best.classList.add('on');if(nav.scrollWidth>nav.clientWidth)nav.scrollLeft=Math.max(0,best.offsetLeft-70)}})();
// ---- Analytics (contract 5): Vercel Web Analytics events. Counts only: never anything the person typed. ----
function track(name,props){try{if(window.va)window.va('event',Object.assign({name},props||{}))}catch(_){}}
document.addEventListener('click',e=>{const t=e.target;if(!t||!t.closest)return;
  // Outbound NHTSA links and the VIN recall check carry data-ev (nhtsa_open / recall_check) and data-kind (where on the page).
  const a=t.closest('a[data-ev]');if(a){track(a.dataset.ev,a.dataset.kind?{kind:a.dataset.kind}:{});return}
  const c=t.closest('[data-tsb-copy]');if(c){const no=c.dataset.tsbCopy,st=c.parentNode&&c.parentNode.querySelector('.tsb-st'),say=m=>{if(st)st.textContent=m};
    (navigator.clipboard&&navigator.clipboard.writeText?navigator.clipboard.writeText(no):Promise.reject()).then(()=>say('Copied '+no+'.'),()=>say('Write down: '+no));
    track('bulletin_copy',{bulletin:no});return}
  // Warning-light pages: the link from the urgency box's first step to the full "What to do now" steps.
  if(t.closest('.urg a[href="#todo"]')){const m=location.pathname.match(/^\/warning-lights\/([a-z0-9-]+)\/$/);if(m)track('light_first_step',{light:m[1]})}
});
// Emailed result: guide.js writes "Sent!" into #emailMsg once the server accepted the email. Only the guide id is sent.
document.addEventListener('submit',e=>{if(!e.target||e.target.id!=='emailForm')return;const t0=Date.now(),g=(location.pathname.match(/^\/symptoms\/([a-z0-9-]+)\//)||[])[1]||'';
  const iv=setInterval(()=>{const m=document.getElementById('emailMsg'),s=m?m.textContent:'';
    if(/^Sent\b/.test(s)){clearInterval(iv);track('result_emailed',g?{guide:g}:{})}else if(Date.now()-t0>30000||(s&&!/^Sending/.test(s)))clearInterval(iv)},300)},true);
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
  ${g.map((m,i)=>`<div class="gcar${i?'':' main'}"><a href="${carUrl(m)}"><b>${esc(carName(m))}</b><span>${i?'Problems and recalls':'Problems, upkeep and recalls'} →</span></a><button type="button" class="gx" data-i="${i}" aria-label="Remove ${esc(carName(m))} from my garage">Remove</button></div>`).join('')}
  <div class="row2">${g.length<MAXG?'<button type="button" id="gAdd">+ Add another vehicle</button>':'<span></span>'}<a href="/symptoms/">Something wrong? Start here</a></div></div>`;
  box.querySelectorAll('.gx').forEach(b=>b.onclick=()=>{const m=g[+b.dataset.i];removeG(m.id,m.y);showMy()});
  const add=document.getElementById('gAdd');if(add)add.onclick=()=>{box.hidden=true;pick.hidden=false;const h=pick.querySelector('h2');if(h)h.textContent='Add another vehicle';
    if(!pick.querySelector('.gback')){const bk=document.createElement('button');bk.type='button';bk.className='gback';bk.textContent='← Back to my garage';bk.onclick=()=>{showMy()};pick.appendChild(bk)}}
}


// picker
if(document.getElementById('pickForm')&&window.YMM){const homePick=window.YMM(document.getElementById('pickYear'),document.getElementById('pickMake'),document.getElementById('pickModel'),null,()=>{const s=homePick.get();document.getElementById('pickGo').disabled=!s.v});
document.getElementById('pickForm').addEventListener('submit',e=>{e.preventDefault();const s=homePick.get();if(s.v){setMy(s.v.id||s.v,s.y);go(s.v,s.y)}})}
const makes=[...new Set(V.map(v=>v.make))];
if(document.getElementById('mgrid'))document.getElementById('mgrid').outerHTML=`<div id="mgrid">${makes.map(m=>`<details class="mk"><summary>${esc(m)} <span>${V.filter(v=>v.make===m).length} ${V.filter(v=>v.make===m).length===1?'model':'models'}</span></summary><div class="mgrid">${V.filter(v=>v.make===m).map(v=>`<a href="${url(v)}">${esc(v.model)}<span>${v.years[0]===v.years[1]?v.years[0]:v.years[0]+'–'+v.years[1]}</span></a>`).join('')}</div></details>`).join('')}</div>`;

const SNAP_NOTE="The problems here are the ones we've documented so far, not a complete list or a reliability rating.";
function snapshot(v,year,list){
  const serious=list.filter(i=>i.sev==='high').length,tiles=[];
  tiles.push(list.length?`<div class="tile"><span class="tl">Problems documented${year?' for '+year:''}</span><span class="tv">${list.length}</span><span class="tn">${serious?serious+' rated serious':'None on file rated serious'}</span></div>`:`<div class="tile"><span class="tl">Problems documented${year?' for '+year:''}</span><span class="tv sm2">Not yet</span><span class="tn">We haven't documented issues for this year yet. Not a reliability rating.</span></div>`);
  tiles.push(`<div class="tile" id="recTile"><span class="tl">Safety recalls</span><span class="tv">${year?'…':'—'}</span><span class="tn">${year?'Checking NHTSA':'Pick a year'}</span></div>`);
  return `<section class="snap"><div class="snap-h"><h2>At a glance</h2></div><div class="tiles">${tiles.join('')}</div><p class="snap-note">${SNAP_NOTE}</p></section>`;
}
// ---- Outbound links (owner approved nhtsa.gov links, Nov 27 2026). Everything else comes from the build's source whitelist. ----
const NHTSA_RECALLS='https://www.nhtsa.gov/recalls';
const BAD_SRC=/(?:^|\.)(?:au7o\.io|carwhere\.com|vehicleflaws\.com|forcar\.org|carcomplaintdata\.com|enginepatrol\.com|8020automotive\.com|rerev\.com|askmanual\.pages\.dev|autobarn\.net|alldata\.com|alldatadiy\.com|mitchell1\.com)$/i;
function safeUrl(u){try{const x=new URL(String(u||''));return x.protocol==='https:'&&!BAD_SRC.test(x.hostname)?x.href:''}catch(_){return ''}}
const LS='style="color:var(--blue2);text-decoration:underline"';
const ext=(href,text,ev,kind)=>`<a href="${esc(href)}" target="_blank" rel="noopener nofollow" ${LS}${ev?` data-ev="${ev}"`:''}${kind?` data-kind="${kind}"`:''}>${text}</a>`;
const vinLink=where=>ext(NHTSA_RECALLS,'Check your VIN for recalls at NHTSA ↗','recall_check',where);
// NHTSA campaign ids ("24V-064", "24V064", "24V064000") → shown as 24V-064, looked up at nhtsa.gov/recalls?nhtsaId=24V064
function recallId(s){const m=String(s||'').toUpperCase().match(/^\s*(\d{2})([VECT])-?(\d{3})(?:\d{3})?\s*$/);return m?{d:m[1]+m[2]+'-'+m[3],q:m[1]+m[2]+m[3]}:null}
function issueRecallIds(i){const seen=new Set();
  return [...(Array.isArray(i.rid)?i.rid:[]),...(String((i.t||'')+' '+(i.next||'')).match(/\b\d{2}[VECT]-?\d{3}(?:\d{3})?\b/gi)||[])]
    .map(recallId).filter(r=>r&&!seen.has(r.q)&&seen.add(r.q))}
const isRecallIssue=i=>/\brecall\b/i.test(i.t||'')||issueRecallIds(i).length>0;
// Sources on an issue card: publisher names; a link only where the build kept a URL (contract 3). Older data: names only.
function issueSources(i){
  if(Array.isArray(i.sl))return i.sl.filter(x=>x&&x.n).map(x=>({n:String(x.n),u:safeUrl(x.u)}));
  return (Array.isArray(i.src)?i.src:[]).map(x=>{x=String(x||'').trim();if(!/^https?:\/\//i.test(x))return x?{n:x,u:''}:null;
    try{return {n:new URL(x).hostname.replace(/^www\./,''),u:''}}catch(_){return null}}).filter(Boolean)}
// ---- Manufacturer bulletins (contract 2): v.tsbs from /data/v/<id>.json. Never shown above urgent items. ----
const MON=['January','February','March','April','May','June','July','August','September','October','November','December'];
const bDate=d=>{const m=String(d||'').match(/^(\d{4})-(\d{2})/);return m&&+m[2]>=1&&+m[2]<=12?MON[+m[2]-1]+' '+m[1]:''};
const bPdf=b=>/^https:\/\/static\.nhtsa\.gov\//.test(String(b.nhtsa_pdf||''))?b.nhtsa_pdf:'';
const B_TAG={warranty_ext:'Extended warranty: repair may be covered',campaign:'Service campaign',ota:'Software update'};
function bulletinsFor(v,year,esel){
  const all=(Array.isArray(v.tsbs)?v.tsbs:[]).filter(b=>b&&b.mfr_no&&b.title&&Array.isArray(b.years)&&b.years.length===2&&b.needs_tech_review!==true);
  const gone=new Set(all.flatMap(b=>Array.isArray(b.supersedes)?b.supersedes.map(String):[]));
  const offered=(v.engines||[]).filter(e=>!year||(year>=e.y[0]&&year<=e.y[1])).map(e=>e.k);
  const fits=b=>{const E=Array.isArray(b.engines)?b.engines:[];if(!E.length)return true;if(esel)return E.includes(esel);return !offered.length||E.some(k=>offered.includes(k))};
  const score=b=>(b.symptom_tags||[]).length+(b.links_to_issue||[]).length;
  return all.filter(b=>!gone.has(String(b.nhtsa_id))&&(!year||(year>=b.years[0]&&year<=b.years[1]))&&fits(b))
    .sort((a,b)=>(a.type==='warranty_ext'?0:1)-(b.type==='warranty_ext'?0:1)||score(b)-score(a));
}
function bulletinRow(v,b){
  const E=v.engines||[],eng=(b.engines||[]).length?b.engines.map(k=>(E.find(e=>e.k===k)||{name:k}).name).join(', '):'may apply to some engines';
  const yrs=b.years[0]===b.years[1]?b.years[0]:b.years[0]+'–'+b.years[1],pdf=bPdf(b),date=bDate(b.date);
  const cov=(b.type==='warranty_ext'||b.type==='campaign')&&b.coverage&&b.coverage.term?'Coverage: '+b.coverage.term+(b.coverage.from?' from '+b.coverage.from:'')+(b.coverage.until?', until '+b.coverage.until:''):'';
  return `<div class="issue tsb">${B_TAG[b.type]?`<div class="meta"><span class="sev ${b.type==='warranty_ext'?'low':'info'}" style="white-space:normal">${B_TAG[b.type]}</span></div>`:''}<h3>${esc(b.title)}</h3>${b.plain_summary?`<p style="margin:0 0 8px">${esc(b.plain_summary)}</p>`:''}
<p style="margin:0"><b>Ask the dealer about bulletin <span style="white-space:nowrap">${esc(b.mfr_no)}</span></b> <button type="button" class="savecar" data-tsb-copy="${esc(b.mfr_no)}">Copy</button> <span class="tsb-st" role="status"></span></p>
<p class="lsrc" style="margin-top:6px">${yrs} ${esc(v.model)} · ${esc(eng)}${b.trans==='manual'?' · manual transmission':b.trans==='auto'?' · automatic transmission':''}${date?' · Issued '+date:''}${cov?'<br>'+esc(cov):''}${pdf?'<br>'+ext(pdf,'Read NHTSA’s copy ↗','nhtsa_open','bulletin'):''}</p></div>`;
}
function bulletinCard(v,list){
  if(!list.length)return '';const first=list.slice(0,5),rest=list.slice(5);
  return `<section class="card csec" id="bulletins" style="margin:18px 0"><h2>Known fixes from the manufacturer (${list.length})</h2>
<p class="pg-sub">A bulletin is a note from the maker to its dealers about a known problem and how to fix it. <a href="/bulletins/" ${LS}>What’s a bulletin?</a></p>
<p style="margin:0 0 14px"><b>A bulletin is not a recall. If your car has an open recall, that comes first.</b> ${vinLink('bulletins')}</p>
${first.map(b=>bulletinRow(v,b)).join('')}${rest.length?`<details class="pg-more"><summary>Show all ${list.length}</summary>${rest.map(b=>bulletinRow(v,b)).join('')}</details>`:''}</section>`;
}
// One line under an issue card: a matching bulletin from v.tsbs, or (older data) a bulletin number plus NHTSA's PDF from the sources.
const TSB_NO=/\b(?:TSB|bulletin|PIP|SB)\s*#?\s*([A-Z]{0,3}\d[A-Z0-9]*(?:-[A-Z0-9]+)+|[A-Z]{0,2}\d{2,}[A-Z0-9]*)/i;
function bulletinLine(i,src){
  const what=`<a href="/bulletins/" ${LS}>What’s a bulletin?</a>`;
  const hit=(i._b||[]).filter(b=>(b.links_to_issue||[]).includes(i.t));
  if(hit.length)return hit.map(b=>`<p class="lsrc tsb-line">Manufacturer bulletin ${esc(b.mfr_no)}${b.type==='warranty_ext'?' · extended warranty':''}${bPdf(b)?' · '+ext(bPdf(b),'NHTSA copy ↗','nhtsa_open','bulletin'):''} · ${what}</p>`).join('');
  const pdf=src.find(x=>/^https:\/\/static\.nhtsa\.gov\/odi\/tsbs\//.test(x.u));if(!pdf)return '';
  const m=[i.t,...src.map(x=>x.n)].map(t=>String(t).match(TSB_NO)).find(Boolean);if(!m)return '';
  return `<p class="lsrc tsb-line">Manufacturer bulletin ${esc(m[1])} · ${ext(pdf.u,'NHTSA copy ↗','nhtsa_open','bulletin')} · ${what}</p>`;
}
function issueFoot(i){
  const src=issueSources(i),rids=issueRecallIds(i),out=[bulletinLine(i,src)];
  if(rids.length)out.push(`<p class="lsrc">NHTSA recall ${rids.map(r=>ext('https://www.nhtsa.gov/recalls?nhtsaId='+r.q,esc(r.d)+' ↗','nhtsa_open','recall')).join(', ')} · ${vinLink('issue')}</p>`);
  else if(/\bVIN\b/.test(i.next||'')&&/recall/i.test(i.next||''))out.push(`<p class="lsrc">${vinLink('issue')}</p>`);
  if(src.length)out.push(`<p class="lsrc">Sources: ${src.map(x=>x.u?ext(x.u,esc(x.n)+' ↗',/(?:^|\.)nhtsa\.gov$/.test(new URL(x.u).hostname)?'nhtsa_open':'','source'):esc(x.n)).join(' · ')}</p>`);
  if(i.wk)out.push('<p class="lsrc"><i>Reported by owners; not yet confirmed by a primary source.</i></p>');
  return out.join('');
}
// Oil change / maintenance reminder and tire pressure light reset steps for this model (and year), from src/resets/models.
// Makes whose reset page carries notes only, no steps (src/resets.json, Nov 27 2026). The build may also set v.resetMakeNoSteps.
const NOTES_ONLY_MAKES=new Set(['porsche','isuzu','daewoo','plymouth','smart','lucid']);
function resetSection(v,year,name){
  const r=v.reset,mk=v.resetMake;if(!r&&!mk)return '';
  const pick=list=>(list||[]).filter(x=>!year||(year>=x.years[0]&&year<=x.years[1]));
  const block=(list,title)=>{const L=pick(list);if(!L.length)return '';return `<h3 class="rs-h">${title}</h3>${L.map((x,i)=>`<div class="rvar"><div class="rv-h">${L.length>1?`<span class="rv-n">${i+1}</span>`:''}<b>${esc(x.when)}</b></div>${x.none?'':`<ol class="nums">${x.steps.map(t=>`<li>${esc(t)}</li>`).join('')}</ol>`}${x.note?`<p class="lmuted">${esc(x.note)}</p>`:''}${x.src&&x.src.length?`<p class="lsrc">Source: ${x.src.map(esc).join(' · ')}</p>`:''}</div>`).join('')}`};
  // Battery-electric years have no oil change: name the service reminder instead, everywhere on the page.
  const pts=window.VS_PT&&window.VS_PT.powertrains?window.VS_PT.powertrains(v,year):[],ev=pts.length>0&&pts.every(p=>p==='bev');
  const svc=ev?'service reminder':'oil change';
  const oil=r?block(r.oil,ev?'Service or maintenance reminder':'Oil change or maintenance reminder'):'',tp=r?block(r.tpms,'Tire pressure (TPMS) light'):'';
  const mkLink=mk?`<a class="walk" href="/warning-lights/reset/${mk}/">Reset steps for other ${esc(v.make)} models →</a>`:'';
  // Some makes have a notes-only reset page with no steps (a12-resets): don't promise "the usual steps" there.
  if(!oil&&!tp&&mk&&(v.resetMakeNoSteps===true||NOTES_ONLY_MAKES.has(mk)))return `<section class="card csec" id="reset"><h2>Reset the ${svc} or tire pressure light</h2><p>Check your owner's manual for the reset steps for this car. <a href="/warning-lights/reset/${mk}/">Our ${esc(v.make)} reset notes</a> say what to check first.</p></section>`;
  if(!oil&&!tp)return mk?`<section class="card csec" id="reset"><h2>Reset the ${svc} or tire pressure light</h2><p>We have not checked the exact steps for ${year?'the '+esc(name):'this model'} yet. The usual ${esc(v.make)} steps are here: <a href="/warning-lights/reset/${mk}/">how to reset the ${svc} and tire pressure lights on ${/^[aeiou]/i.test(String(esc(v.make)))?'an':'a'} ${esc(v.make)}</a>.</p></section>`:'';
  return `<section class="card csec" id="reset"><h2>How to reset the ${svc} and tire pressure lights${year?' on '+(/^[aeiou]/i.test(name)?'an ':'a ')+esc(name):''}</h2><p class="pg-sub">The ${svc} message is a reminder: reset it after the service. The tire pressure light is a warning that a tire is low or, if it flashed first, that the system has a fault: set the pressures first, and have the system checked if it flashed.${year?'':' Pick your model year above to see only the steps for your car.'}</p>${oil}${tp}${r.notes?`<p class="lmuted">${esc(r.notes)}</p>`:''}<p class="lmuted">Button names can differ by trim. Your owner's manual is the final word for your exact car. If the light comes straight back, or a tire pressure light blinks and then stays on, something else needs checking.</p>${mkLink}</section>`;
}
// An engine-specific issue shows for a year only if that engine was offered that year
// (the gas-engine Fit problems don't belong on the 2014 Fit, which was EV-only in the U.S.).
function issueInYear(v,i,y){if(!(y>=i.y[0]&&y<=i.y[1]))return false;const tags=i.engs||[],E=v.engines||[];
  if(!tags.length||!E.length||!tags.every(t=>E.some(e=>e.k===t)))return true;
  return E.some(e=>tags.includes(e.k)&&y>=e.y[0]&&y<=e.y[1])}
function issueCard(i){return `<div class="issue"${i._k!=null?` id="iss-${i._k}"`:''}><div class="meta"><span class="sev ${i.sev}">${sevLabel(i)}</span><span class="pill">${i.y[0]===i.y[1]?i.y[0]:i.y[0]+'–'+i.y[1]}</span><span class="pill">${esc(i.sys)}</span>${i.eng?`<span class="pill">${esc(i.eng)}</span>`:''}</div>
<h3>${esc(i.t)}</h3><dl><div><dt>What you'll notice</dt><dd>${esc(i.sym)}</dd></div><div><dt>Why it happens</dt><dd>${esc(i.why)}</dd></div><div><dt>What to do</dt><dd>${esc(i.next)}</dd></div></dl>${issueFoot(i)}${i.animation?`<a class="mv-issue" href="${esc(i.animation.href)}">Repair animation · ${esc(i.animation.title)}</a>`:''}${(g=>g?`<a class="walk" href="${gurl(g.id)}?v=${i._v||''}${i._y?'&y='+i._y:''}">Walk through this symptom: ${esc(g.title)} →</a>`:'')(forIssue(i))}</div>`}

// Phone-first summary right under the title (T-05): the serious problems, recall-related ones first, and the recall count.
function yearSummary(keyed,name){
  const high=keyed.filter(i=>i.sev==='high').sort((a,b)=>(isRecallIssue(b)?1:0)-(isRecallIssue(a)?1:0)),top=high.slice(0,4);
  const li=i=>`<li><a href="#iss-${i._k}" data-iss="${i._k}" style="color:var(--blue2);text-decoration:underline">${esc(i.t)}</a> <span class="sev high">${sevLabel(i)}</span></li>`;
  return `<section class="${high.length?'safety':'livebox'}" id="vsum" aria-label="Summary for the ${esc(name)}" style="margin:0 0 14px">`+
    (high.length?`<b>${high.length} serious problem${high.length>1?'s':''} reported for this year</b><ul>${top.map(li).join('')}</ul>${high.length>top.length?`<p style="margin:4px 0 0">and ${high.length-top.length} more below.</p>`:''}<p style="margin:6px 0 0">Not every car has these problems. Tap one to see the signs and what to do.</p>`
      :`<strong>No problems on file rated “Stop soon” for this year.</strong><p style="margin:6px 0 0">This is not a safety check of your car. If a warning light is on or the car feels wrong, <a href="/symptoms/">start with what it is doing</a>.</p>`)+
    `<p id="vsumRec" style="margin:10px 0 0"><strong>Safety recalls:</strong> checking NHTSA… · ${vinLink('summary')}</p></section>`;
}
function renderVehicle(v,year){
  const el=document.getElementById('vehicleView');
  let list=year?v.issues.filter(i=>issueInYear(v,i,year)):v.issues.slice();
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
  // Stable anchors for the summary links, and the manufacturer bulletins that fit this year and engine.
  const keyed=list.map((i,k)=>Object.assign({},i,{_k:k,_v:v.id,_y:year}));
  const bulletins=year?bulletinsFor(v,year,esel):[];
  const btns=`<div class="vh-btns" style="margin:0 0 12px"><button type="button" class="savecar dl" data-dl>Download this page (PDF)</button>${year?`<button type="button" class="savecar" id="saveCar">+ Save to my garage</button><button type="button" class="savecar rm" id="rmCar" hidden>Remove from garage</button>`:''}</div>`;
  let ylinks='';for(let y=v.years[1];y>=v.years[0];y--)if(soldY(v,y))ylinks+=y===year?`<span aria-current="page"><b>${y}</b></span>`:`<a href="${url(v,y)}">${y}</a>`;
  el.innerHTML=`<div class="crumb"><a href="/">Home</a> › <a href="/vehicles/#${mslug}">${esc(v.make)}</a> › ${year?`<a href="${url(v)}">${esc(v.model)}</a> › ${year}`:esc(v.model)}</div>
  <div class="vhead"><div class="vh-top"><div class="eyebrow">${year?'My vehicle':'Vehicle guide'}</div></div><h1>${year?'Your '+esc(name):esc(name)} <span class="h1s">problems and recalls</span></h1>
  <p class="sub">${year?`What we've documented about the ${esc(name)}: problems owners and shops report, and safety recalls.`:`Problems reported across ${v.years[0]}–${v.years[1]}. Pick your model year below to see what applies to your vehicle.`}${v.alt?' '+esc(v.alt.replace(/\.$/,''))+'.':''}</p></div>
  ${year?yearSummary(keyed,name):''}${btns}
  <p class="byline">VehicleSymptoms team · Updated November 2026 · <a href="/about/">How we work</a></p>
  <div class="yearbar"><label for="vy" style="color:var(--muted);font-size:14px">Model year</label><select id="vy">${yopts}</select>${engs.length>1?`<label for="ve" style="color:var(--muted);font-size:14px;margin-left:6px">Engine</label><select id="ve"><option value="">All engines</option>${engs.map(e=>`<option value="${e.k}" ${e.k===esel?'selected':''}>${esc(e.name)}</option>`).join('')}</select>`:''}</div>${engs.length>1&&!esel&&list.some(i=>i.engs)?`<p class="enghint">Pick your engine to hide problems that only affect other engines. Not sure? It is on the sticker under the hood or in the owner's manual.</p>`:''}${esel?`<p class="enghint on">Showing problems for the <b>${esc(ename)}</b> plus everything that applies to every ${esc(v.model)}${allN>list.length?' ('+(allN-list.length)+' other-engine issue'+(allN-list.length>1?'s':'')+' hidden)':''}.</p>`:''}
  ${general.length?`<h2 style="font-size:20px">Walk through your symptom</h2><div class="glist" style="margin:10px 0 26px">${general.map(g=>`<a class="gcard" href="${gurl(g.id)}?v=${v.id}${year?'&y='+year:''}"><b>${esc(g.title)}</b><span>${esc(g.h1)}</span></a>`).join('')}</div>`:''}
  <h2 style="font-size:22px">${shown.length?'Known problems'+(year?' for your '+esc(name):''):'We haven\'t documented model-specific issues for this year yet'}</h2>
  <p class="lead">${list.length?list.length+' documented issue'+(list.length>1?'s':'')+(year?' apply to '+year:' across all years')+(esel?' with the '+esc(ename):'')+', most serious first.':'This is not a reliability rating. We simply haven\'t researched this year in depth yet. If something\'s wrong, start with what the car is doing: our symptom guides work for every vehicle.'}</p>
  ${cats.length>2?`<div class="tabs">${cats.map(c=>`<button class="tab ${c===state.tab?'on':''}" data-tab="${c}">${c}</button>`).join('')}</div>`:''}
  ${sorted.map(i=>issueCard(Object.assign({},keyed[list.indexOf(i)],{_b:bulletins}))).join('')}
  ${bulletinCard(v,bulletins)}
  ${snapshot(v,year,list)}
  ${resetSection(v,year,name)}
  <div class="livebox" id="nhtsa"><b>Safety recalls${year?' for the '+esc(name):''}</b><br>${year?'Checking the NHTSA recall database…':'Pick a model year to see its safety recalls.'}</div>
  <details class="vin-d yall"><summary>Other ${esc(v.make+' '+v.model)} model years</summary><nav class="ylinks" aria-label="${esc(v.make+' '+v.model)} model years">${ylinks}</nav></details>
  <div class="dlbox"><div><b>Keep a copy of this page</b><span>Download every problem and the recalls for ${year?'your ':'the '}${esc(name)} as a PDF you can save, print or bring to your shop.</span></div><button type="button" class="btn" data-dl>Download this page (PDF)</button></div>
  <div class="trust">This page is a general guide based on widely reported problems. Not every vehicle is affected, and it doesn't replace an in-person diagnosis.</div>`;
  window.VS_PAGE={v,year,list,name,ename,bulletins};
  // A summary link to a problem hidden by the category tabs shows every problem first.
  el.querySelectorAll('[data-iss]').forEach(a=>a.onclick=e=>{const id='iss-'+a.dataset.iss;if(document.getElementById(id))return;
    e.preventDefault();state.tab='All';renderVehicle(v,year);const t=document.getElementById(id);if(t)t.scrollIntoView({block:'start'})});
  const sc=el.querySelector('#saveCar'),rm=el.querySelector('#rmCar');if(sc){
    // Saved: "✓ In my garage" is a status, and a separate, plainly labelled button removes it.
    const paint=()=>{const on=inG(v.id,year);sc.textContent=on?'✓ In my garage':'+ Save to my garage';sc.classList.toggle('on',on);sc.disabled=on;sc.setAttribute('aria-disabled',String(on));if(rm)rm.hidden=!on};
    paint();sc.onclick=()=>{if(!inG(v.id,year)){addG(v.id,year);paint();showMy();if(rm)rm.focus()}};
    if(rm)rm.onclick=()=>{removeG(v.id,year);paint();showMy();sc.focus()}}
  {const ve=el.querySelector('#ve');if(ve)ve.onchange=e=>{try{localStorage.setItem('vs_eng_'+v.id,e.target.value)}catch(x){}renderVehicle(v,year)}}
  el.querySelector('#vy').onchange=e=>{location.href=url(v,+e.target.value||null)};
  refreshRecalls(v,year);
  el.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;renderVehicle(v,year)});
}
function route(){
  const m=location.pathname.match(/^\/vehicles\/([a-z0-9-]+)\/(?:((?:19|20)\d{2})\/)?$/);
  const v=m&&V.find(x=>x.id===m[1]);
  if(v&&document.getElementById('vehicleView')){state.q=new URLSearchParams(location.search).get('q')||'';const hv=document.getElementById('homeView');if(hv)hv.style.display='none';document.getElementById('vehicleView').style.display='';const go2=()=>renderVehicle(v,clampYear(v,m[2]?+m[2]:null));if(v._full||!window.VS_LOAD)go2();else window.VS_LOAD(v.id).then(go2);return}
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
  const sum=t=>{const e=document.getElementById('vsumRec');if(e)e.innerHTML='<strong>Safety recalls:</strong> '+t+' · '+vinLink('summary')};
  function addVinNote(){
    const note='Could you check my '+name+' by VIN for open safety recalls, tell me which campaigns apply and whether any repairs are still outstanding?';
    box.insertAdjacentHTML('beforeend',`<details class="pg-more"><summary>Prepare a VIN question for my dealer</summary>
      <label for="recQuestion">Your message</label><textarea class="pc-request" id="recQuestion" readonly rows="3">${esc(note)}</textarea>
      <button class="btn ghost" type="button" id="recCopy">Copy recall question</button> <span id="recCopyStatus" role="status"></span></details>`);
    box.querySelector('#recCopy').onclick=()=>copyField(box.querySelector('#recQuestion'),box.querySelector('#recCopyStatus'),'Recall question copied.');
  }
  const fail=(why,retry=false)=>{
    if(rt)rt.innerHTML='<span class="tl">Model-year safety recalls</span><span class="tv">—</span><span class="tn">Recall count unavailable.</span>';
    box.innerHTML=`<b>Safety recalls: lookup unavailable</b><p>We could not confirm the NHTSA campaign list for the ${esc(name)}. The recall count and the status of your individual VIN are unknown.</p><p>${vinLink('recall_box')} A dealer can also check it.</p>`;
    sum('count unavailable right now.');
    if(retry){
      const button=document.createElement('button');button.className='btn ghost';button.type='button';button.textContent='Retry recall lookup';
      button.onclick=()=>{button.disabled=true;button.textContent='Checking NHTSA…';refreshRecalls(v,year)};
      box.appendChild(button);
    }
    addVinNote();
    return {status:'unavailable',reason:why,checked:new Date().toISOString()};
  };
  const M=window.VS_RECALL_QUERIES(v,year);if(!M.queries.length)return fail('no verified model mapping');
  // Each NHTSA name is looked up on its own. One name that fails (NHTSA answers some aliases with HTTP 400 for years
  // they don't cover) must not hide campaigns the other names returned: show those, and say the list may be partial.
  const settled=await Promise.allSettled(M.queries.map(async q=>({label:q.label||q.model,query:q,results:await fetchRecalls(q,year)})));
  let groups=settled.filter(x=>x.status==='fulfilled').map(x=>x.value);
  const failed=settled.map((x,i)=>x.status==='rejected'?{name:M.queries[i].model,why:x.reason&&x.reason.message||'error'}:null).filter(Boolean);
  if(!groups.length)return fail(failed.map(f=>f.why).join('; ')||'error',true);
  // Several NHTSA names can cover one vehicle (e.g. 1 SERIES and 128I): merge by label and count each campaign once.
  {const by=new Map();for(const g of groups){const k=g.label.replace(/\s+/g,' ');const seen=by.get(k)||{label:g.label,query:g.query,results:[],ids:new Set()};for(const x of g.results)if(!seen.ids.has(x.NHTSACampaignNumber)){seen.ids.add(x.NHTSACampaignNumber);seen.results.push(x)}by.set(k,seen)}
   groups=[...by.values()].map(({ids,...g})=>g)}
  const total=new Set(groups.flatMap(g=>g.results.map(x=>x.NHTSACampaignNumber))).size;
  if(!total&&!M.verified)return fail('zero results under an unverified model mapping');
  // Never say "no recalls" while this page lists a recall problem for the same year (T-23).
  if(!total&&v.issues.some(i=>issueInYear(v,i,year)&&isRecallIssue(i)))return fail('zero results but this page lists recall problems for '+year);
  // Zero is only a real answer when every name was checked.
  if(!total&&failed.length)return fail('zero results with '+failed.length+' name(s) not checked',true);
  const res={status:failed.length?'partial':'ok',groups,total,failed,checked:new Date().toISOString()};
  const multi=groups.length>1;
  if(rt)rt.innerHTML=`<span class="tl">Model-year safety recalls</span><span class="tv">${total}</span><span class="tn">${total?'<a href="#nhtsa">See model-year campaigns</a>':'None listed for this model year. Individual VIN status unknown.'}</span>`;
  const card=x=>`<div class="issue" style="margin:8px 0;padding:14px"><div class="meta"><span class="pill">${esc(x.NHTSACampaignNumber||'')}</span><span class="pill">${esc((x.Component||'').split(':')[0])}</span></div><dl><div><dt>Problem</dt><dd>${esc(x.Summary||'')}</dd></div><div><dt>Fix</dt><dd>${esc(x.Remedy||'')}</dd></div></dl></div>`;
  box.innerHTML=`<b>${total?total+' safety recall'+(total>1?'s':''):'No safety recalls'} filed for the ${esc(name)}</b><p style="margin:6px 0 0;font-size:14px">${total?'These are campaigns NHTSA lists for this model year. Not every vehicle is included in every campaign, and this does not show whether a recall is still open on your car.':'NHTSA\'s recall database returned no campaigns for this model year.'}</p>`+
    groups.map(g=>`${multi?`<h3 style="margin:14px 0 4px;font-size:16px">${esc(g.label)}: ${g.results.length}</h3>`:''}<div style="margin-top:10px">${g.results.slice(0,12).map(card).join('')}${g.results.length>12?`<details><summary>Show ${g.results.length-12} more campaigns</summary>${g.results.slice(12).map(card).join('')}</details>`:''}</div>`).join('')+
    (failed.length?`<p class="muted" style="font-size:14px"><b>This list may be incomplete.</b> NHTSA didn't answer for ${failed.length===1?'one name':failed.length+' names'} this model is filed under, so a dealer VIN check is the way to confirm.</p>`:'')+
    `<p><b>Is a recall open on my vehicle?</b> A model-year search cannot confirm whether your VIN is included or whether its recall repair was completed. ${vinLink('recall_box')} A dealer can also check it.</p>`;
  sum(total?`${total} filed for this model year. <a href="#nhtsa">See them</a>`:'none listed for this model year');
  addVinNote();
  return res;
}

// Download this page as a PDF. The PDF code and library load only when someone asks for it.
function dlPdf(btn){
  const pg=window.VS_PAGE;if(!pg||btn.disabled)return;
  const label=btn.textContent;btn.disabled=true;btn.textContent='Preparing your PDF…';
  const ld=src=>new Promise((ok,no)=>{if(document.querySelector('script[data-dl-src="'+src+'"]'))return ok();const e=document.createElement('script');e.src=src;e.dataset.dlSrc=src;e.onload=ok;e.onerror=()=>{e.remove();no()};document.head.appendChild(e)});
  const wait=Promise.race([pg.ready||Promise.resolve(),new Promise(r=>setTimeout(r,6000))]);
  Promise.all([ld('/vendor/jspdf.umd.min.js'),ld('/pdf.js'),wait]).then(()=>{window.VS_PDF(Object.assign({note:SNAP_NOTE},pg));btn.textContent='✓ Downloaded';})
    .catch(()=>{btn.textContent="Couldn't make the PDF. Tap to try again"})
    .then(()=>{btn.disabled=false;setTimeout(()=>{btn.textContent=label},4000)});
}
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-dl]');if(b)dlPdf(b)});

// VIN decoder: live NHTSA lookup, with an offline fallback
function vinLinks(make,year){const ms=V.filter(v=>make&&norm(make).includes(norm(v.make))||make&&norm(v.make).includes(norm(make).slice(0,4)));
  return ms.length?`<div style="margin-top:10px;color:var(--muted)">Open your vehicle:</div><div class="chips">${ms.map(v=>`<a class="chip" href="${url(v,clampYear(v,year))}">${esc(v.make)} ${esc(v.model)}</a>`).join('')}</div>`:''}
if(document.getElementById('vinForm'))document.getElementById('vinForm').addEventListener('submit',async e=>{
  e.preventDefault();const out=document.getElementById('vinOut');
  const v=document.getElementById('vinInput').value.toUpperCase().replace(/\s/g,'');
  if(!/^[A-HJ-NPR-Z0-9]{17}$/.test(v)){out.innerHTML='<div class="err">A VIN is 17 characters and never uses I, O or Q. Check it and try again.</div>';return}
  out.innerHTML='<div style="color:var(--muted)">Decoding…</div>';
  const row=(a,b)=>b?`<div class="row"><span>${a}</span><span>${esc(String(b))}</span></div>`:'';
  try{
    const r=await fetch('https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/'+v+'?format=json');
    const d=(await r.json()).Results[0];if(!d.Make)throw 0;
    // Link straight to a model page only on an exact model match (a Mustang Mach-E is not a Mustang) and a clean decode.
    const yr=+d.ModelYear,code=String(d.ErrorCode||'0').split(',').map(x=>x.trim()),clean=code.every(x=>x==='0');
    const exact=V.filter(x=>norm(x.make)===norm(d.Make)&&[x.model,x.nmodel].filter(Boolean).some(m=>norm(m)===norm(d.Model)));
    const match=clean&&exact.length===1?exact[0]:null;
    const warn=clean?'':`<div class="err" style="margin-bottom:8px">NHTSA flagged a problem with this VIN${d.ErrorText?': '+esc(String(d.ErrorText).split(';')[0].replace(/^\d+\s*-\s*/,''))+'.':'.'} Check it for a typo, or pick your vehicle by year, make and model above.</div>`;
    out.innerHTML=warn+row('Year',d.ModelYear)+row('Make',d.Make)+row('Model',d.Model)+row('Trim',d.Trim)+row('Engine',[d.DisplacementL&&(+d.DisplacementL).toFixed(1)+'L',d.EngineCylinders&&d.EngineCylinders+'-cyl',d.FuelTypePrimary].filter(Boolean).join(' '))+row('Drive',d.DriveType)+row('Built in',d.PlantCountry)
      +(match?`<a class="btn" style="display:inline-block;margin-top:12px;padding:12px 18px" href="${url(match,clampYear(match,yr))}">See ${esc(d.ModelYear)} ${esc(match.model)} problems</a>`:`<div style="margin-top:10px;color:var(--muted)">We couldn't match this VIN to one model for sure. Pick yours:</div>`+vinLinks(d.Make,yr));
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
  const VG=window.VS_GUIDES;
  // Which kind of answer the search gave (never what was typed): urgent, guide, question or nomatch.
  const outcome=(type,via)=>VG.track('search_outcome',via?{type,via}:{type});
  const go=(href,type,via)=>{outcome(type,via);location.href=href};
  const srcLine=list=>list&&list.length?`<p class="fine">Based on: ${list.map(([n,u])=>`<a href="${esc(u)}" target="_blank" rel="noopener nofollow">${esc(n)}</a>`).join(', ')}</p>`:'';
  // The roadside step-by-step pages that go with a danger step (/roadside/<id>/).
  const pageCards=ps=>ps.length?`<p><b>Step by step:</b></p><div class="glist">${ps.map((p,i)=>`<a class="gcard${i===0?' first':''}" href="${esc(p.u)}"><b>${esc(p.t)}</b><span>What to do now, one step at a time</span></a>`).join('')}</div>`:'';
  const lightCards=ls=>`<div class="glist">${ls.map(l=>`<a class="gcard" href="/warning-lights/${esc(l.id)}/"><b>${esc(l.n)}</b><span>${l.c==='red'?'Red':l.c==='amber'?'Amber/yellow':l.c==='green'?'Green':'Blue'}${l.s?' · '+esc(l.s):''}</span></a>`).join('')}</div>`;
  const roadLine=()=>`<div class="safety roadline"><p><b>If you’re on the road right now:</b> ${esc(VG.ROAD_LINE)}</p><p><a href="/roadside/">Stuck on the road? What to do now →</a></p></div>`;
  hf.addEventListener('submit',e=>{
    e.preventDefault();
    const q=hi.value.trim();
    if(!q){out.innerHTML='';out.classList.remove('show');if(status)status.textContent='';return}
    const cm=q.match(/\b([PBCU][0-3][0-9A-F]{3})\b/i);
    // A code alone goes to code lookup; a code plus a danger sign ("P0300 and the light is flashing") shows the safety step first.
    if(cm&&!VG.emergency(q)){go('/codes/?q='+cm[1].toUpperCase(),'guide','code');return}
    // An oil change or oil life reminder is routine, not the red oil pressure warning. A danger sign always wins:
    // "I just got an oil change and my car is on fire" gets the fire step, not the reminder page.
    if(/\boil (?:change|life)\b|\bchange (?:the |my |engine )?oil\b|\boil service\b|\bmaint(?:enance)? (?:reqd|required)\b/i.test(q)&&!VG.emergency(q)&&!/\bpressure\b|\bred\b|\blow oil\b|\bflicker/i.test(q)){go('/warning-lights/'+(/maint/i.test(q)?'maintenance-required-light':'oil-change-light')+'/','guide','light');return}
    const vehicleMatch=findVehicle(q),v=vehicleMatch?.vehicle;
    const year=(q.match(/\b(?:19|20)\d{2}\b/)||[])[0],y=v?clampYear(v,+year):null;
    const qs=v?`?v=${v.id}${y?'&y='+y:''}`:'';
    // Remove the matched vehicle and year so "2012 Honda Civic shakes" can ask about timing.
    const raw=v?q.replace(vehicleMatch.text,' ').replace(/\b(?:19|20)\d{2}\b/g,' '):q;
    // "Is it safe to drive with …?" is answered by the symptom after it, never with a promise (RS-04).
    const safe=VG.safeAsk(raw),symptom=safe.asked?safe.text:raw;
    const safeTop=safe.asked?`<div class="safety safeline"><p>${esc(VG.SAFE_LINE)}</p></div>`:'';
    const urgent=VG.emergency(raw)||(safe.asked&&symptom?VG.emergency(symptom):null);
    if(urgent){
      // Danger first: the immediate safe action, then the roadside steps, then the most urgent guide, then anything else that matched.
      const ex=VG.exactGuide&&VG.exactGuide(symptom);
      const gs=ex?[ex,...searchGuides(symptom,5).filter(g=>g.id!==ex.id)].slice(0,5):searchGuides(symptom,5);
      // Vague wording ("smoke is coming out of the car"): safety step first, then the easy where/what question.
      const ask=VG.clarifySearch(symptom.replace(cm?cm[0]:'',' '));
      const label=g=>urgent.labels&&urgent.labels[g.id];
      out.innerHTML=`<div class="safety urgentnow" role="alert"><b>Do this first</b><p>${esc(urgent.now)}</p>${urgent.also.map(t=>`<p>${esc(t)}</p>`).join('')}${srcLine(urgent.src)}</div>`+
        pageCards(urgent.pages||[])+(ask?askHtml(ask,qs):gs.length||cm?
        `<p><b>${urgent.pages&&urgent.pages.length?'Related guides:':'Then follow the guide:'}</b></p><div class="glist">${gs.map((g,i)=>`<a class="gcard${i===0&&!(urgent.pages||[]).length?' first':''}" href="${gurl(g.id)}${qs}"><b>${esc(label(g)?label(g)[0]:g.title)}</b><span>${esc(label(g)?label(g)[1]:g.h1)}</span></a>`).join('')}`+
        `${cm?`<a class="gcard" href="/codes/?q=${cm[1].toUpperCase()}"><b>Look up ${esc(cm[1].toUpperCase())}</b><span>What this trouble code means</span></a>`:''}</div>`:'');
      out.classList.add('show');outcome('urgent');
      if(status)status.textContent='Urgent safety step shown first. '+urgent.now+(ask?' '+ask.question:'');
      return;
    }
    // Nothing left after "can I drive my car?": what did you notice, with the never-a-promise line first.
    if(safe.asked&&!symptom){
      out.innerHTML=safeTop+askHtml(VG.noticeFirst(),qs);out.classList.add('show');outcome('question','safe');
      if(status)status.textContent=VG.SAFE_LINE+' What did you notice first? Choose an answer below.';return}
    // What to keep in the car, or the roadside help list itself (a08 routes).
    if(/\b(?:emergency|roadside|car|winter|survival|safety) kit\b|\bwhat (?:should i |to |do i )?(?:keep|carry|have) in (?:my |the |your )?car\b/i.test(symptom)){go('/roadside/emergency-kit/','guide','roadside');return}
    if(/^(?:roadside|roadside help|roadside assistance|stuck on the road|help im stuck|what do i do now|emergency)$/i.test(VG.safeAsk(symptom).text.replace(/[^a-z ]/gi,'').trim())){go('/roadside/','guide','roadside');return}
    // Gas light / fuel light: the low fuel page answers it (RS-09).
    if(VG.fuelLight(symptom)){go('/warning-lights/low-fuel-light/','guide','light');return}
    const exact=VG.exactGuide&&VG.exactGuide(symptom);
    if(exact){go(gurl(exact.id)+qs,'guide');return}
    const question=VG.clarifySearch(symptom);
    const gs=question?[]:searchGuides(symptom,5);
    // A light, symbol or color: look through the dashboard lights first, unless the top guide is about the same light (RS-09).
    const ls=VG.lightQuery(symptom)?VG.lights(symptom):[];
    const guideCovers=gs.length&&ls.some(l=>VG.lightGuides(l.id).includes(gs[0].id));
    if(ls.length&&!guideCovers&&!question){
      if(ls.length===1&&!safe.asked){go('/warning-lights/'+ls[0].id+'/','guide','light');return}
      const top=ls.slice(0,6);
      out.innerHTML=safeTop+`<p><b>Which light do you see?</b></p><p class="muted" style="margin:0 0 8px">If the light is red, pull over when it’s safe and turn the engine off.</p>${lightCards(top)}`+
        (gs.length?`<p><b>Or follow a guide for what the car is doing:</b></p><div class="glist">${gs.map(g=>`<a class="gcard" href="${gurl(g.id)}${qs}"><b>${esc(g.title)}</b><span>${esc(g.h1)}</span></a>`).join('')}</div>`:'');
      out.classList.add('show');outcome('guide','light');
      if(status)status.textContent=top.length+' matching dashboard lights. If the light is red, pull over when it’s safe. Choose a light below.';return}
    if(gs.length===1&&!safe.asked){go(gurl(gs[0].id)+qs,'guide');return}
    if(question){
      out.innerHTML=safeTop+askHtml(question,qs);outcome('question');
    }else if(gs.length){
      out.innerHTML=safeTop+`<p><b>Which guide fits what you noticed?</b></p><div class="glist">${gs.map(g=>`<a class="gcard" href="${gurl(g.id)}${qs}"><b>${esc(g.title)}</b><span>${esc(g.h1)}</span></a>`).join('')}</div>${v?`<p class="muted">Or see <a href="${url(v,y)}">known problems for the ${y?y+' ':''}${esc(v.make+' '+v.model)}</a>.</p>`:''}`;outcome('guide');
    }else{
      // No match: someone may be typing from the shoulder. The roadside line comes before any question (RS-02).
      out.innerHTML=safeTop+roadLine()+(v?`<p>We don't have a guide for that wording yet. <a href="${url(v,y)}">See known problems for the ${esc(v.make+' '+v.model)} →</a></p>`
        :`<div class="nomatch"><p class="muted" style="margin:0 0 6px">We couldn't match that wording yet. That's OK, one easy question:</p>${askHtml(VG.noticeFirst(),'')}<p class="muted" style="margin-top:8px">Have a trouble code from a scanner? <a href="/codes/">Look it up</a>. Or describe it differently, for example: "squeal when braking", "shakes at highway speed", "clicks when I turn the key".</p></div>`);
      outcome('nomatch');
    }
    out.classList.add('show');
    if(status)status.textContent=(safe.asked?VG.SAFE_LINE+' ':'')+(question?question.question+' Choose an answer below.':
      gs.length?gs.length+' matching guides. Choose a guide below.':
      'If you’re on the road right now: '+VG.ROAD_LINE+' '+(v?'No matching guide. A link to known problems for your vehicle is available.':'What did you notice first? Choose an answer below.'));
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
  const run=q=>{q=q.trim();if(!q){out.innerHTML='';return}let Q=q.toUpperCase().replace(/\s+/g,'');if(/^[0-3][0-9A-F]{3}$/.test(Q))Q='P'+Q;// "0442" means P0442
    const exact=CODE_INDEX.find(c=>c[0]===Q);if(exact){location.href='/codes/'+exact[0].toLowerCase()+'/';return}
    const words=q.toLowerCase().split(/\s+/).filter(Boolean);
    const hits=CODE_INDEX.filter(c=>c[0].startsWith(Q)||words.every(w=>(c[1]+' '+c[2]).toLowerCase().includes(w))).slice(0,30);
    out.innerHTML=hits.length?hits.map(c=>`<a class="gcard" href="/codes/${c[0].toLowerCase()}/"><b>${c[0]}</b><span>${esc(c[1])}</span></a>`).join(''):(!/^[PBCU][0-3][0-9A-F]{3}$/.test(Q)&&/^[A-Z]?\d/.test(Q)&&Q.length>=5?`<p class="muted">${esc(q)} isn't a valid trouble code. Codes are a letter (P, B, C or U) followed by four characters, like P0420. Check the scanner screen again.</p>`
      :/^B/.test(Q)?`<p class="muted">We don't have ${esc(q)} yet. B codes are body codes, and many (B00xx) are airbag faults: if the airbag light is on, have it checked right away. <a href="/warning-lights/airbag-light/">Airbag light guide</a>.</p>`
      :/^[PBCU]1/.test(Q)?`<p class="muted">We don't have ${esc(q)} yet. Codes with a 1 after the letter are set by the carmaker, so their meaning depends on your make. A shop or dealer scanner can read the exact description. Meanwhile, <a href="/symptoms/">start with what the car is doing</a>.</p>`
      :`<p class="muted">We don't have ${esc(q)} yet. Try the first letters, like P04, or <a href="/symptoms/">start with what the car is doing</a>.</p>`)};
  f.onsubmit=e=>{e.preventDefault();run(qi.value)};qi.oninput=()=>{if(qi.value.trim().length>=2&&!/^[pbcu]\d{4}$/i.test(qi.value.trim()))run(qi.value)};
  const q0=new URLSearchParams(location.search).get('q');if(q0){qi.value=q0;run(q0)}})();
// personal touch on code pages
(function(){const box=document.getElementById('codeMy');if(!box)return;const g=getG();if(!g.length)return;
  box.innerHTML=`<div class="codemy"><span>Your ${g.length>1?'vehicles':'vehicle'}:</span>${g.map(m=>`<a href="${carUrl(m)}">${esc(carName(m))} ›</a>`).join('')}</div>`})();
// warning light hub filter
(function(){const f=document.getElementById('lfilter');if(!f)return;f.querySelectorAll('button').forEach(b=>b.onclick=()=>{f.querySelectorAll('button').forEach(x=>{x.classList.toggle('on',x===b);x.setAttribute('aria-pressed',String(x===b))});const c=b.dataset.c;
  document.querySelectorAll('#lgrid .lcard').forEach(a=>{const k=a.dataset.c;a.hidden=!(c==='all'||k===c||(c==='info'&&(k==='green'||k==='blue')))});
  const s=document.getElementById('lsearch');if(s)s.value='';const n=document.getElementById('lnone');if(n)n.hidden=true;
  const shown=[...document.querySelectorAll('#lgrid .lcard')].filter(a=>!a.hidden).length,lc=document.getElementById('lcount');if(lc)lc.textContent=c==='all'?'':shown+' '+(shown===1?'light':'lights')+' shown: '+b.textContent})})();
(function(){const s=document.getElementById('lsearch');if(!s)return;
  // Match each word the visitor typed against the light's names and how its symbol looks ("oil can", "thermometer").
  // "Flashing", "point", "mark" and the like describe the light, not its shape, so they never rule a light out (WL-H1).
  // Color words don't rule a light out either: they move lights of that color to the top (WL-M11).
  const filler=new Set(('a an the my is it its on of in with and or that this like looks look shaped shape symbol symbols icon sign light lights lit lamp dash dashboard warning '+
    'came come comes coming just car cars little small flashing flash flashes blinking blink blinks steady solid stays stay keeps point points mark marks inside picture pic image thing '+
    'what whats means mean meaning indicator').split(' '));
  const colors={red:'red',yellow:'amber',orange:'amber',amber:'amber',green:'info',blue:'info'};
  // "!" is how people type the exclamation symbol; "anti lock" is one word, so "lock" finds the security light, not ABS (WL-L7).
  const norm=t=>String(t).toLowerCase().replace(/!/g,' exclamation ').replace(/['’]/g,'').replace(/\banti[ -]?lock\b/g,'antilock').replace(/[^a-z0-9]+/g,' ').trim();
  const words=q=>norm(q).split(' ').filter(w=>w&&!filler.has(w)&&!colors[w]);
  const named=q=>[...new Set(norm(q).split(' ').filter(w=>colors[w]).map(w=>colors[w]))];
  const group=c=>c==='green'||c==='blue'?'info':c;
  const lf=document.getElementById('lfilter');if(lf)lf.addEventListener('click',()=>document.querySelectorAll('#lgrid .lcard').forEach(a=>a.style.order=''));
  s.oninput=()=>{const q=s.value.trim();const qw=words(q),qc=named(q);let shown=0;
    document.querySelectorAll('#lgrid .lcard').forEach(a=>{const k=norm(a.dataset.k||a.textContent).split(' ');
      // Only a color ("yellow light"): show the lights of that color. A color plus a shape: that color first, others still shown.
      const hit=!qw.length?(!qc.length||qc.includes(group(a.dataset.c))):qw.every(w=>k.some(x=>x===w||(w.length>=3&&x.startsWith(w))||(w.length>3&&w.endsWith('s')&&x===w.slice(0,-1))));
      // Named color first; then lights whose keywords match every typed word exactly ("squiggles" on traction before "squiggle" on glow plug).
      a.hidden=!hit;a.style.order=!hit||!qw.length?'':qc.length&&qc.includes(group(a.dataset.c))?'-2':qw.every(w=>k.includes(w))?'-1':'';if(hit)shown++});
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
