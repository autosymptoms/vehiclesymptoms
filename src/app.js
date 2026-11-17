// Site script: homepage search, vehicle pages, VIN decoder. Guide helpers come from guide.js (window.VS_GUIDES).
const SEV={high:"Stop soon",med:"Get checked",low:"Monitor"};
const {esc,search:searchGuides,forIssue,gurl}=window.VS_GUIDES;
const menuBtn=document.getElementById('menuBtn');if(menuBtn)menuBtn.onclick=()=>document.getElementById('links').classList.toggle('open');
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
const homePick=window.YMM(document.getElementById('pickYear'),document.getElementById('pickMake'),document.getElementById('pickModel'),null,()=>{const s=homePick.get();document.getElementById('pickGo').disabled=!s.v});
document.getElementById('pickForm').addEventListener('submit',e=>{e.preventDefault();const s=homePick.get();if(s.v)go(s.v,s.y)});
const makes=[...new Set(V.map(v=>v.make))];
document.getElementById('mgrid').outerHTML=`<div id="mgrid">${makes.map(m=>`<details class="mk"><summary>${esc(m)} <span>${V.filter(v=>v.make===m).length} models</span></summary><div class="mgrid">${V.filter(v=>v.make===m).map(v=>`<a href="${url(v)}">${esc(v.model)}<span>${v.years[0]}–${v.years[1]}</span></a>`).join('')}</div></details>`).join('')}</div>`;

function issueCard(i){return `<div class="issue"><div class="meta"><span class="sev ${i.sev}">${SEV[i.sev]}</span><span class="pill">${i.y[0]===i.y[1]?i.y[0]:i.y[0]+'–'+i.y[1]}</span><span class="pill">${esc(i.sys)}</span>${i.eng?`<span class="pill">${esc(i.eng)}</span>`:''}</div>
<h3>${esc(i.t)}</h3><dl><div><dt>What you'll notice</dt><dd>${esc(i.sym)}</dd></div><div><dt>Why it happens</dt><dd>${esc(i.why)}</dd></div><div><dt>What to do</dt><dd>${esc(i.next)}</dd></div></dl>${(g=>g?`<a class="walk" href="${gurl(g.id)}?v=${i._v||''}${i._y?'&y='+i._y:''}">Walk through this symptom: ${esc(g.title)} →</a>`:'')(forIssue(i))}</div>`}

function renderVehicle(v,year){
  const el=document.getElementById('vehicleView');
  let list=year?v.issues.filter(i=>year>=i.y[0]&&year<=i.y[1]):v.issues.slice();
  const cats=['All',...new Set(list.map(i=>i.cat))];
  if(!cats.includes(state.tab))state.tab='All';
  const shown=state.tab==='All'?list:list.filter(i=>i.cat===state.tab);
  let yopts='<option value="">All years</option>';for(let y=v.years[1];y>=v.years[0];y--)yopts+=`<option ${y===year?'selected':''}>${y}</option>`;
  const name=(year?year+' ':'')+v.make+' '+v.model;
  const general=state.q?searchGuides(state.q,3):[];
  el.innerHTML=`<div class="crumb"><a href="/">Home</a> › ${esc(v.make)} › ${esc(v.model)}${year?' › '+year:''}</div>
  <div class="vhead"><div class="eyebrow">Known problems</div><h1>${esc(name)} problems</h1>
  <p class="sub">${year?`Problems owners and mechanics report most for the ${esc(name)}.`:`Problems reported most across ${v.years[0]}–${v.years[1]}. Pick your year to narrow it down.`}${v.alt?' '+esc(v.alt.replace(/\.$/,''))+'.':''}</p></div>
  <div class="yearbar"><label for="vy" style="color:var(--muted);font-size:14px">Model year</label><select id="vy">${yopts}</select></div>
  ${general.length?`<h2 style="font-size:20px">Walk through your symptom</h2><div class="glist" style="margin:10px 0 26px">${general.map(g=>`<a class="gcard" href="${gurl(g.id)}?v=${v.id}${year?'&y='+year:''}"><b>${esc(g.title)}</b><span>${esc(g.h1)}</span></a>`).join('')}</div>`:''}
  <h2 style="font-size:20px">${shown.length?'Known problems for this vehicle':'No model-specific problems on file for this year yet'}</h2>
  <p class="lead">${list.length?list.length+' documented issue'+(list.length>1?'s':'')+(year?' apply to '+year:' across all years')+'.':'That can mean a solid year, or one we have not finished researching. General symptom search still works.'}</p>
  ${cats.length>2?`<div class="tabs">${cats.map(c=>`<button class="tab ${c===state.tab?'on':''}" data-tab="${c}">${c}</button>`).join('')}</div>`:''}
  ${shown.map(i=>issueCard(Object.assign({},i,{_v:v.id,_y:year}))).join('')}
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


// ---- homepage: "What is your car doing?" ----
const hf=document.getElementById('helpForm');
if(hf){const hi=document.getElementById('helpInput'),out=document.getElementById('helpResults');
  hf.addEventListener('submit',e=>{e.preventDefault();const q=hi.value.trim();if(!q)return;
    const gs=searchGuides(q,5),v=findVehicle(q),y=(q.match(/\b(19|20)\d{2}\b/)||[])[0];
    const qs=v?`?v=${v.id}${clampYear(v,+y)?'&y='+y:''}`:'';
    if(gs.length&&gs[0]&&searchGuides(q,1)[0]===gs[0]&&gs.length===1){location.href=gurl(gs[0].id)+qs;return}
    out.innerHTML=gs.length?`<div class="muted" style="margin:4px 0 8px">Pick the one that fits best:</div><div class="glist">${gs.map(g=>`<a class="gcard" href="${gurl(g.id)}${qs}"><b>${esc(g.title)}</b><span>${esc(g.h1)}</span></a>`).join('')}</div>${v?`<p class="muted" style="margin-top:10px">Or see <a href="${url(v,clampYear(v,+y))}">known problems for the ${y&&clampYear(v,+y)?y+' ':''}${esc(v.make+' '+v.model)}</a>.</p>`:''}`
      :v?`<p>We don't have a guide for that wording yet. <a href="${url(v,clampYear(v,+y))}">See known problems for the ${esc(v.make+' '+v.model)} →</a></p>`
      :`<p>We couldn't match that yet. Try different words, like "squeal when braking", or pick a shortcut below.</p>`;
    out.classList.add('show');});
}
