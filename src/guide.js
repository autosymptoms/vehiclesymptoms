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
window.VS_GUIDES={G,GROUPS,URG,esc,search,forIssue,gurl:id=>'/symptoms/'+id+'/'};

// ---- search: ranks guides against free text ----
const STOP=new Set('the a an my is it its and or of to in on when i car vehicle truck it\'s im i\'m with from at some keeps very really just'.split(' '));
const toks=t=>t.toLowerCase().replace(/[^a-z0-9' ]/g,' ').split(/\s+/).filter(w=>w.length>2&&!STOP.has(w));
function search(q,n){
  const ql=' '+q.toLowerCase().replace(/[^a-z0-9' ]/g,' ').replace(/\s+/g,' ')+' ',qt=toks(q);if(!qt.length)return[];
  return G.map(g=>{let s=0;
    for(const syn of g.syn){const sl=syn.toLowerCase();if(ql.includes(' '+sl+' ')||ql.includes(sl))s+=6+sl.split(' ').length;}
    const hay=(g.title+' '+g.syn.join(' ')).toLowerCase();for(const w of qt){if(hay.includes(w))s+=2;const st=w.replace(/(ing|es|s|ed)$/,'');if(st.length>3&&st!==w&&hay.includes(st))s+=1;}
    if(g.title.toLowerCase().split(' ').some(w=>qt.includes(w)))s+=1;
    return{g,s}}).filter(o=>o.s>=3).sort((a,b)=>b.s-a.s).slice(0,n||5).map(o=>o.g);
}
// best guide for a known vehicle problem
function forIssue(i){
  const hay=(i.t+' '+i.sym).toLowerCase();let best=null,bs=0;
  for(const g of G){let s=0,hits=0;if(g.match.cats.includes(i.cat))s+=1;for(const w of g.match.words)if(new RegExp('\\b'+w.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).test(hay)){s+=3;hits++}if(hits&&s>bs){bs=s;best=g}}
  return bs>=4?best:null;
}

// ---- guided flow on /symptoms/<id>/ ----
const J=window.JOURNEY;const root=document.getElementById('guideApp');
if(J&&root){
  const V=window.VEHICLES||[];
  let path=[],cur=J.start,veh=null,vyear=null;
  try{const p=new URLSearchParams(location.search);const v=V.find(x=>x.id===p.get('v'));if(v){veh=v;const y=+p.get('y');if(y>=v.years[0]&&y<=v.years[1])vyear=y}}catch(e){}
  const node=k=>J.nodes[k];
  function draw(){
    const n=node(cur);
    if(n.q){
      root.innerHTML=`<div class="flow card"><div class="step-n">Question ${path.length+1}</div><h2 class="fq">${esc(n.q)}</h2>${n.help?`<p class="help">${esc(n.help)}</p>`:''}
      <div class="opts">${n.opts.map((o,i)=>`<button class="opt${/not sure/i.test(o.a)?' unsure':''}" data-i="${i}">${esc(o.a)}</button>`).join('')}</div>
      ${path.length?`<div class="flow-nav"><button class="linkbtn" id="back">← Back</button><button class="linkbtn" id="restart">Start over</button></div>`:''}</div>`;
      root.querySelectorAll('.opt').forEach(b=>b.onclick=()=>{const o=n.opts[+b.dataset.i];path.push({k:cur,q:n.q,a:o.a});cur=o.go;draw();root.scrollIntoView({behavior:'smooth',block:'start'})});
    } else drawResult(n.result);
    const b=document.getElementById('back');if(b)b.onclick=()=>{const p=path.pop();cur=p.k;draw()};
    const r=document.getElementById('restart');if(r)r.onclick=()=>{path=[];cur=J.start;draw()};
  }
  function vehicleMatches(){
    if(!veh)return'';
    const list=veh.issues.filter(i=>(!vyear||(vyear>=i.y[0]&&vyear<=i.y[1]))&&J.issueMatch.words.some(w=>new RegExp('\\b'+w.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).test((i.t+' '+i.sym).toLowerCase())));
    const nm=(vyear?vyear+' ':'')+veh.make+' '+veh.model;
    if(!list.length)return`<p class="muted">No documented problem on the ${esc(nm)} matches this symptom, so the general guidance above applies. <a href="/vehicles/${veh.id}/${vyear?vyear+'/':''}">See all known ${esc(nm)} problems →</a></p>`;
    return`<p class="muted">Documented problems on the ${esc(nm)} that can cause symptoms like this. They're known patterns, not a diagnosis of your car.</p>${list.slice(0,4).map(i=>`<div class="mini"><b>${esc(i.t)}</b> <span class="pill">${i.y[0]===i.y[1]?i.y[0]:i.y[0]+'–'+i.y[1]}</span><div>${esc(i.sym)}</div></div>`).join('')}<a href="/vehicles/${veh.id}/${vyear?vyear+'/':''}">All known ${esc(nm)} problems →</a>`;
  }
  function summary(r){
    const nm=veh?((vyear?vyear+' ':'')+veh.make+' '+veh.model):'(add year, make and model)';
    return['SUMMARY FOR MY MECHANIC — from VehicleSymptoms.com',
      'Vehicle: '+nm,'Main concern: '+J.title,'What I noticed:',...path.map(p=>'  - '+p.q+' → '+p.a),
      'Guide suggested: '+r.title+' ('+URG[r.urgency].label+')',
      'Possible causes to check: '+r.causes.map(c=>c.name).join('; '),
      'Tests the guide lists for a shop: '+r.confirm.shop.join('; '),
      'Date: '+new Date().toLocaleDateString()].join('\n');
  }
  function drawResult(r){
    const u=URG[r.urgency];
    let vopts='<option value="">Choose your vehicle</option>'+V.map(v=>`<option value="${v.id}" ${veh&&veh.id===v.id?'selected':''}>${esc(v.make+' '+v.model)}</option>`).join('');
    let yopts='<option value="">Year</option>';if(veh)for(let y=veh.years[1];y>=veh.years[0];y--)yopts+=`<option ${y===vyear?'selected':''}>${y}</option>`;
    root.innerHTML=`<div class="result card">
      <div class="urg ${u.cls}"><span>${esc(u.label)}</span></div>
      <h2 class="rt">${esc(r.title)}</h2>
      <section class="rsec"><h3>What to do now</h3><p>${esc(r.now)}</p>${r.if.length?`<ul class="ifs">${r.if.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}</section>
      <section class="rsec"><h3>Why</h3><p>${esc(r.why)}</p></section>
      <section class="rsec"><h3>Possible causes</h3>${r.causes.map(c=>`<div class="cause"><b>${esc(c.name)}</b>${c.clues?`<div><span class="lbl2">Points here:</span> ${esc(c.clues)}</div>`:''}${c.against?`<div><span class="lbl2">Less likely if:</span> ${esc(c.against)}</div>`:''}</div>`).join('')}</section>
      <section class="rsec two"><div><h3>You can check</h3><ul>${r.confirm.you.map(x=>`<li>${esc(x)}</li>`).join('')||'<li>Nothing safe to check yourself. Leave it to a technician.</li>'}</ul></div><div><h3>Your shop will test</h3><ul>${r.confirm.shop.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div></section>
      <section class="rsec"><h3>Make it specific to your vehicle</h3><div class="picker"><select id="gv">${vopts}</select><select id="gy">${yopts}</select></div><div id="gvm" style="margin-top:10px">${vehicleMatches()}</div></section>
      <section class="rsec"><h3>Summary for your mechanic</h3><pre class="summary" id="sum">${esc(summary(r))}</pre>
        <div class="row-btns"><button class="btn sm" id="copy">Copy summary</button><button class="btn ghost sm" id="print">Print</button><span id="copied" class="muted"></span></div></section>
      <div class="flow-nav"><button class="linkbtn" id="back">← Change my last answer</button><button class="linkbtn" id="restart">Start over</button></div>
    </div>`;
    const gv=document.getElementById('gv'),gy=document.getElementById('gy');
    gv.onchange=()=>{veh=V.find(x=>x.id===gv.value)||null;vyear=null;drawResult(r)};
    gy.onchange=()=>{vyear=+gy.value||null;document.getElementById('gvm').innerHTML=vehicleMatches();document.getElementById('sum').textContent=summary(r)};
    document.getElementById('copy').onclick=async()=>{try{await navigator.clipboard.writeText(summary(r));document.getElementById('copied').textContent='Copied'}catch(e){document.getElementById('copied').textContent='Select the text above and copy it'}};
    document.getElementById('print').onclick=()=>{try{window.print()}catch(e){}};
    const b=document.getElementById('back');b.onclick=()=>{const p=path.pop();cur=p?p.k:J.start;draw()};
    document.getElementById('restart').onclick=()=>{path=[];cur=J.start;draw()};
  }
  draw();
}

// ---- /symptoms/ hub ----
const hub=document.getElementById('guideHub');
if(hub){
  hub.innerHTML=Object.entries(GROUPS).map(([k,label])=>{const list=G.filter(g=>g.group===k);if(!list.length)return'';
    return`<section class="hubsec" id="${k}"><h2>${esc(label)}</h2><div class="glist">${list.map(g=>`<a class="gcard" href="/symptoms/${g.id}/"><b>${esc(g.title)}</b><span>${esc(g.h1)}</span></a>`).join('')}</div></section>`}).join('');
  if(location.hash){const t=document.getElementById(location.hash.slice(1));if(t)setTimeout(()=>t.scrollIntoView(),60)}
}
})();
