// Regression checks on the built site (dist/). Run: node tools/regression.js  → audit/generated/regression-results.json
// Pages run in jsdom with their real scripts; network calls are stubbed with dated fixtures (tools/fixtures).
const fs=require('fs'),path=require('path');const {JSDOM}=require('jsdom');
const D=p=>path.join(__dirname,'..','dist',p);
const FIX=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/nhtsa-2026-11-21.json'),'utf8'));
const results=[];const T=(id,desc,pass,detail)=>{results.push({id,desc,pass:!!pass,detail:detail||''});console.log((pass?'PASS ':'FAIL ')+id+' '+desc+(pass?'':' :: '+detail))};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function load(route,{fetch,est,qs=''}={}){
  let html=fs.readFileSync(D(route+'index.html'),'utf8');
  html=html.replace(/<script defer src="\/_vercel[^>]*><\/script>/,'').replace(/<script src="\/([a-z0-9.\/-]+\.js)"><\/script>/g,(m,f)=>{
    if(f==='price-est.js'&&est)return '<script>window.EST='+JSON.stringify(est)+'</script>';
    return fs.existsSync(D(f))?'<script>'+fs.readFileSync(D(f),'utf8').replace(/<\/script/g,'<\\/script')+'</script>':''});
  const calls=[];
  const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://www.vehiclesymptoms.com'+route+qs,pretendToBeVisual:true,beforeParse(w){
    w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.print=()=>{};
    w.fetch=(u,o)=>{calls.push(String(u));if(/\/data\/v\/(.+)\.json$/.test(u)){const f=D('data/v/'+RegExp.$1+'.json');return Promise.resolve({ok:true,status:200,json:async()=>JSON.parse(fs.readFileSync(f,'utf8'))})}
      return fetch?fetch(String(u),o):new Promise(()=>{})};}});
  return {dom,w:dom.window,doc:dom.window.document,calls};
}
const nh=(map)=>u=>{const q=new URL(u).searchParams;const k=[q.get('make'),q.get('model'),q.get('modelYear')].join('|').toUpperCase();
  const r=map(k,u);if(r instanceof Error)return Promise.reject(r);if(r&&r.status)return Promise.resolve({ok:false,status:r.status,json:async()=>({})});
  return Promise.resolve({ok:true,status:200,json:async()=>r})};
const empty=k=>{const [mk,md,y]=k.split('|');return {Count:0,Message:'Results returned successfully',results:[]}};

(async()=>{
const HAS_PC=fs.existsSync(D('price-check/index.html'))&&/id="pcJob"/.test(fs.readFileSync(D('price-check/index.html'),'utf8'));
// ---- Recalls ----
{const p=load('/vehicles/acura-rsx-integra/2023/',{fetch:nh(k=>FIX[k]||empty(k))});await sleep(300);
 const box=p.doc.getElementById('nhtsa').textContent,tile=p.doc.getElementById('recTile').textContent;
 T('REC-01','2023 Acura Integra shows the 2 NHTSA campaigns (fixture 2026-11-21)',/\b2 safety recalls/.test(box)&&/23V430000/.test(box)&&/24V744000/.test(box)&&p.doc.querySelector('#recTile .tv').textContent.trim()==='2','tile='+tile+' | has23V='+/23V430000/.test(box)+' has24V='+/24V744000/.test(box));
 T('REC-02','Combined label is never sent to NHTSA',p.calls.filter(u=>/nhtsa/.test(u)).every(u=>!/%2F|\//.test(new URL(u).searchParams.get('model'))),p.calls.join(' '));
 T('REC-03','Integra 2023 is queried as INTEGRA',p.calls.some(u=>/model=INTEGRA&/.test(u)),p.calls.join(' '))}
{const p=load('/vehicles/acura-rsx-integra/2023/',{fetch:nh(()=>({status:503}))});await sleep(300);
 const box=p.doc.getElementById('nhtsa'),t=box.textContent;
 T('REC-04','HTTP error shows an unknown recall count, a retry and an on-site VIN question',/lookup unavailable/i.test(t)&&/unknown/.test(t)&&!!box.querySelector('button')&&!!box.querySelector('#recQuestion')&&!box.querySelector('a[href^="http"]')&&!/No safety recalls/.test(t),t.slice(0,220))}

{const p=load('/vehicles/acura-rsx-integra/2023/',{fetch:()=>Promise.resolve({ok:true,status:200,json:async()=>({Count:3,results:[]})})});await sleep(300);
 T('REC-05','Malformed response (Count mismatch) shows Lookup unavailable',/lookup unavailable/i.test(p.doc.getElementById('nhtsa').textContent))}
{const p=load('/vehicles/acura-rsx-integra/2023/',{fetch:nh(k=>({Count:1,results:[Object.assign({},FIX['ACURA|INTEGRA|2023'].results[0],{Model:'RDX'})]}))});await sleep(300);
 T('REC-06','Result for a different vehicle is rejected (Lookup unavailable)',/lookup unavailable/i.test(p.doc.getElementById('nhtsa').textContent))}
{const p=load('/vehicles/acura-rsx-integra/2023/',{fetch:nh(()=>new Error('network'))});await sleep(300);
 T('REC-07','Network failure shows Lookup unavailable',/lookup unavailable/i.test(p.doc.getElementById('nhtsa').textContent))}
{const p=load('/vehicles/rivian-r1s-r1t/2023/',{fetch:nh(k=>empty(k))});await sleep(300);
 const q=p.calls.filter(u=>/nhtsa/.test(u)).map(u=>new URL(u).searchParams.get('model')).sort().join(',');
 T('REC-08','Rivian R1T / R1S is resolved to separate R1S and R1T lookups',q==='R1S,R1T',q)}
{// unverified default mapping with zero results must not show 0
 const w=load('/vehicles/acura-rsx-integra/2023/',{fetch:()=>new Promise(()=>{})}).w;const v=w.VEHICLES.find(x=>!/ \/ /.test(x.model)&&!(x.rq||[]).length);
 const M=w.VS_RECALL_QUERIES(v,2020);T('REC-09','Single-name model without a verified mapping is flagged unverified (zero would show Lookup unavailable)',M.verified===false&&M.queries.length===1,JSON.stringify(M))}
{const w=load('/vehicles/acura-rsx-integra/2023/',{fetch:()=>new Promise(()=>{})}).w;const v=w.VEHICLES.find(x=>x.id==='acura-rsx-integra');
 const m=y=>(w.VS_RECALL_QUERIES(v,y).queries[0]||{}).model;T('REC-10','Integra/RSX name change mapped by year (1999 INTEGRA, 2004 RSX, 2023 INTEGRA)',m(1999)==='INTEGRA'&&m(2004)==='RSX'&&m(2023)==='INTEGRA',[m(1999),m(2004),m(2023)].join(','))}

// A transient failure can recover in place. Test more than twelve campaigns so the rest
// remain readable on the page and in the saved PDF, including the individual VIN caveat.
{
 let attempts=0;const fixed=FIX['ACURA|INTEGRA|2023'].results[0];
 const thirteen=Array.from({length:13},(_,i)=>({...fixed,NHTSACampaignNumber:'23V'+String(i+1).padStart(6,'0')}));
 const sourceUrl='https://manufacturer.example/recall-campaign';
 thirteen[12].Summary='Test agency text with a literal <a href="'+sourceUrl+'">record reference</a>.';
 thirteen[12].Remedy='Park outside until the dealer completes the repair. Source reference '+sourceUrl+'.';
 const p=load('/vehicles/acura-rsx-integra/2023/',{fetch:nh(()=>++attempts===1?{status:503}:{Count:13,results:thirteen})});
 await sleep(300);const box=p.doc.getElementById('nhtsa');
 [...box.querySelectorAll('button')].find(b=>b.textContent.includes('Retry')).click();
 await p.w.VS_PAGE.ready;
 T('REC-RETRY','Retry restores validated campaigns including details beyond the first twelve',
   attempts===2&&/13 safety recalls/.test(box.textContent)&&/Show 1 more campaign/.test(box.textContent)&&/23V000013/.test(box.textContent)&&p.w.VS_PAGE.recalls.total===13);
 T('REC-SOURCE-TEXT','Agency text retains the remedy and original reference as inert text',
   !box.querySelector('a[href^="https:"]')&&box.textContent.includes(sourceUrl)&&box.textContent.includes('Park outside until the dealer completes the repair.'));
 box.querySelector('#recCopy').click();await sleep(0);
 T('REC-MSG','VIN-specific question can be copied locally on a successful lookup',
   box.querySelector('#recQuestion').value.includes('2023 Acura')&&/selected/.test(box.querySelector('#recCopyStatus').textContent));
 p.w.TextEncoder=TextEncoder;p.w.TextDecoder=TextDecoder;
 p.w.eval(fs.readFileSync(D('vendor/jspdf.umd.min.js'),'utf8'));
 const Pdf=p.w.jspdf.jsPDF;let output='';
 p.w.jspdf.jsPDF=function(options){const doc=new Pdf(options);doc.save=()=>{output=doc.output()};return doc};
 p.w.eval(fs.readFileSync(D('pdf.js'),'utf8'));p.w.VS_PDF(p.w.VS_PAGE);
 T('REC-PDF','PDF retains all campaigns and the agency remedy without creating external link annotations',
   output.includes('23V000013')&&output.includes('Question for your dealer')&&output.includes('Park outside')&&!output.includes('/Subtype /Link')&&!output.includes('nhtsa.gov/recalls'));
 p.w.close();
}

// ---- Price check eligibility (only while the price check is published; it was removed Nov 22, 2026) ----
if(HAS_PC){
const job={job:'Spark plug replacement (general test estimate)',aka:['Replace spark plugs'],note:'',unit:'per job (all cylinders)',conf:'medium',checked:'TEST FIXTURE',extras:'',menu:[],bm:[],
  cls:{economy:{p:[49,78],h:[0.5,1],ex:'TEST',src:[]},midsize:{p:[40,90],h:[1,1.5],ex:'TEST',src:[]},truck:{p:[60,160],h:[1,2],ex:'TEST',src:[]},luxury:{p:[65.22,148.62],h:[2,2],ex:'2008-2013 BMW 335i (TEST)',src:[]}}};
const EST={jobs:[job],held:[],vc:{'tesla-model-y':'l','toyota-camry':'m'},rates:{CT:[125,141,1]},nat:[120,160],states:[['CT','Connecticut']],rsrc:[]};
async function quote(qs,term,amount,state){const p=load('/price-check/',{est:EST,qs});await sleep(300);const d=p.doc;
  const st=d.getElementById('pcSt');if(st&&state){st.value=state;st.dispatchEvent(new p.w.Event('change'))}
  const ji=d.getElementById('pcJob');ji.value=term;ji.dispatchEvent(new p.w.Event('input'));await sleep(50);
  const bs=[...d.querySelectorAll('#pcSug button')].filter(b=>/spark plug/i.test(b.textContent));const btn=bs.find(b=>/general test estimate/.test(b.textContent));
  return {p,d,btn,sug:d.getElementById('pcSug').textContent,go:async()=>{if(!btn)return '';btn.click();const a=d.getElementById('pcAmt');a.value=String(amount);a.dispatchEvent(new p.w.Event('input'));d.getElementById('pcGo').click();await sleep(20);return d.getElementById('pcOut').textContent}}}
{const r=await quote('?v=tesla-model-y&y=2023','spark plug',400,'CT');
 T('PRC-01','2023 Tesla Model Y: spark plug job is not suggested',!r.btn,r.sug.slice(0,200));
 T('PRC-02','2023 Tesla Model Y: driver is told the repair does not apply to a battery-electric vehicle',/does not apply to a battery-electric/i.test(r.sug),r.sug.slice(0,200));
 T('PRC-03','2023 Tesla Model Y CT $400: no $310–$440 range and no verdict',!/310|440|Within the typical range/.test(r.d.getElementById('pcOut').textContent))}
{const r=await quote('?v=toyota-camry&y=2015','spark plug',400,'CT');const o=await r.go();
 T('PRC-04','2015 Toyota Camry (gasoline): spark plug estimate is still offered and gets a verdict',!!r.btn&&/typical/i.test(o),o.slice(0,200));
 const st=r.d.getElementById('pcSt');st.value='';st.dispatchEvent(new r.p.w.Event('change'));
 T('PRC-05','Changing the state after a quote clears the verdict',r.d.getElementById('pcOut').textContent.trim()==='',r.d.getElementById('pcOut').textContent.slice(0,80))}
{const r=await quote('?v=toyota-camry&y=2015','spark plug',400,'CT');await r.go();const a=r.d.getElementById('pcAmt');a.value='900';a.dispatchEvent(new r.p.w.Event('input'));
 T('PRC-06','Changing the quote amount clears the old verdict',r.d.getElementById('pcOut').textContent.trim()==='')}
{const PT=require('../src/powertrain.js');global.window={};eval(fs.readFileSync(path.join(__dirname,'../vehicles.js'),'utf8'));const V=window.VEHICLES,g=id=>V.find(v=>v.id===id);
 const cases=[['gas','toyota-camry',2015,true],['diesel spark plugs','ram-2500',2015,null],['hybrid','toyota-prius',2015,true],['plug-in hybrid','chevrolet-volt',2014,true],['battery-electric','tesla-model-y',2023,false]];
 for(const [n,id,y,exp] of cases){const v=g(id);const e=v?PT.eligible('Spark plug replacement',v,y):{ok:'missing'};T('PRC-PT-'+n.replace(/\W+/g,'-'),'Spark plugs eligibility for '+n+' ('+id+' '+y+') = '+exp,v&&e.ok===exp,JSON.stringify(e))}
 const e2=PT.eligible('Spark plug replacement',g('ram-2500'),2015,(g('ram-2500').engines.find(e=>/cummins|diesel/i.test(e.name)&&2015>=e.y[0]&&2015<=e.y[1])||{}).k);T('PRC-PT-diesel-engine','Diesel engine chosen: spark plugs do not apply',e2.ok===false,JSON.stringify(e2))}

{const r=await quote('?v=toyota-camry&y=2015','spark plug',311,'CT');await r.go();
 T('PRC-BOUNDARY','A quote just above the displayed range is labeled above it',r.d.querySelector('#pcOut h2')?.textContent==='Above the estimated range');
 r.p.dom.window.close()}
// A shop request must work before the driver knows a price or picks a listed repair.
{
 const p=load('/price-check/',{qs:'?v=toyota-camry&y=2017&repair=unexpected+rattle'});await sleep(30);
 const d=p.doc,request=d.getElementById('pcRequest'),copy=d.getElementById('pcCopy');
 T('PRC-REQUEST','Unmatched free text produces a vehicle-specific shop request before a quote',
   request.value.includes('2017 Toyota Camry')&&request.value.includes('unexpected rattle')&&
   d.getElementById('pcQuoteStep').hidden&&/No matching repair/.test(d.getElementById('pcSug').textContent));
 let copied='';Object.defineProperty(p.w.navigator,'clipboard',{value:{writeText:async value=>{copied=value}}});
 copy.click();await sleep(0);
 T('PRC-COPY','Copy writes the displayed request',copied===request.value&&/copied/.test(d.getElementById('pcCopyStatus').textContent));
 p.w.navigator.clipboard.writeText=async()=>{throw new Error('unavailable')};copy.click();await sleep(0);
 T('PRC-MANUAL','When clipboard access fails, the full message is selected for manual copying',
   request.selectionStart===0&&request.selectionEnd===request.value.length&&/selected/.test(d.getElementById('pcCopyStatus').textContent));
 p.dom.window.close();
}
{
 const records=JSON.parse(fs.readFileSync(path.join(__dirname,'../src/evidence/quote-references.json'),'utf8'));
 const valid=[];
 for(const ref of records){
   const qs='?'+new URLSearchParams({v:ref.vehicleId,y:String(ref.year),repair:ref.job});
   const p=load('/price-check/',{qs});await sleep(25);
   const notes=p.doc.getElementById('pcServiceNotes'),question=notes.querySelector('p')?.textContent;
   valid.push(Boolean(question)&&!notes.querySelector('a')&&ref.sources.every(source=>notes.textContent.includes(source.name)&&notes.textContent.includes(source.checked))&&
     p.doc.getElementById('pcRequest').value.includes(question)&&p.doc.getElementById('pcRequest').value.includes(ref.job)&&p.doc.getElementById('pcQuoteStep').hidden);
   p.dom.window.close();
 }
 T('PRC-SOURCES','Each matched repair provides a local, source-credited question in the shop request without a price verdict',records.length>0&&valid.every(Boolean),valid.filter(Boolean).length+'/'+records.length);
 const first=records[0],qs='?'+new URLSearchParams({v:first.vehicleId,repair:first.job});
 const p=load('/price-check/',{qs});await sleep(25);
 T('PRC-SCOPE','A model-only URL cannot assume a year or expose exact-year references',!p.doc.getElementById('pcY').value&&!p.doc.getElementById('pcServiceNotes').textContent.trim());
 p.dom.window.close();
}

} else T('PRC-OFF','Price check is not published (no estimator on /price-check/) and /price-check/ redirects home',JSON.parse(fs.readFileSync(path.join(__dirname,'../vercel.json'),'utf8')).redirects.some(r=>r.source==='/price-check'&&r.destination==='/'),'')
// ---- Price display: no withheld numbers or charts in public output ----
{const p=load('/vehicles/toyota-camry/2015/',{});await sleep(300);const h=p.doc.getElementById('vehicleView').innerHTML;
 T('PRC-07','Vehicle page shows no price bars, ranges or dollar figures',h.length>500&&!/class="pg-bar"/.test(h)&&!/\$\d/.test(h),h.length+' chars')
 const dj=fs.readFileSync(D('data/v/toyota-camry.json'),'utf8');T('PRC-08','Per-vehicle data file carries no withheld lo/hi figures',!/"lo":\d+,"hi":\d+/.test(dj.replace(/"free":true[^}]*/g,'')),'')}

// ---- Urgency ----
for(const code of ['p0300','p0301','p0304','p0316']){const h=fs.readFileSync(D('codes/'+code+'/index.html'),'utf8');const main=h.slice(h.indexOf('code-big'));
  const a=main.indexOf('urg-first'),b=main.indexOf('class="urg ');T('URG-'+code,code.toUpperCase()+': flashing/shaking stop condition renders before the softer badge, near the top',a>0&&a<b&&a<2500,'first='+a+' badge='+b)}
{const h=fs.readFileSync(D('codes/p0300/index.html'),'utf8');const ld=JSON.parse(h.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1]);const a=ld.mainEntity.find(q=>/Can I drive/.test(q.name)).acceptedAnswer.text;
 T('URG-ld','P0300 FAQ structured data leads with the flashing/shaking condition',/^If the check engine light is flashing/.test(a),a.slice(0,80))}

for(const id of ['oil-pressure-light','engine-temperature-light','battery-light','brake-warning-light']){const h=fs.readFileSync(D('warning-lights/'+id+'/index.html'),'utf8');
  const u=h.indexOf('class="urg '),f=h.indexOf('urg-next'),m=h.indexOf('<h2>What it means');
  T('URG-'+id,id+': first step sits inside the urgency box, above "What it means", and links to the full steps',u>0&&f>u&&f<m&&/id="todo"/.test(h)&&/href="#todo"/.test(h),'urg='+u+' next='+f+' means='+m)}

// Vehicle badges match the first action: a high-severity issue that starts with "pull over" says Stop now.
{const p=load('/vehicles/acura-zdx/2011/',{});await sleep(400);const cards=[...p.doc.querySelectorAll('#vehicleView .issue')];
 const c=cards.find(x=>/Low oil pressure light with correct oil level/.test(x.textContent));
 T('SEV-01','Acura ZDX oil-pressure issue badge says Stop now, matching "Pull over" as the first step',c&&/Stop now/.test(c.querySelector('.sev').textContent),c?c.querySelector('.sev').textContent:'card not found ('+cards.length+' cards)')}
for(const f of ['hesitation-when-accelerating','engine-sputtering-misfire']){const j=JSON.parse(fs.readFileSync(path.join(__dirname,'../src/journeys/'+f+'.json'),'utf8'));
 T('FUEL-'+f,f+': wrong fuel is its own stop result, and the poor-fuel result leads its warnings with the wrong-fuel stop',j.nodes.r_wrong_fuel.result.urgency==='stop'&&!/drive gently/i.test(j.nodes.r_wrong_fuel.result.now)&&/^If you put diesel/.test(j.nodes.r_bad_fuel.result.if[0]),'')}

// ---- QA follow-ups (2026-11-21) ----
if(HAS_PC){const r=await quote('?v=tesla-model-y&y=2023','spark',400,'CT');T('PRC-09','Tesla Model Y "spark" search (real held list) says it does not apply, not "no sourced range"',/does not apply to a battery-electric/i.test(r.sug)&&!/No sourced range yet for[^.]*spark/i.test(r.sug),r.sug.slice(0,200))}
{const p=load('/symptoms/grinding-brakes/',{qs:'?v=toyota-camry&y=2015'});await sleep(300);let err='';p.w.addEventListener('error',e=>{err=e.message});
 const b=[...p.doc.querySelectorAll('#guideApp .opt')];let n=0;while(b.length&&n<6){b[0].click();await sleep(30);n++;const nb=[...p.doc.querySelectorAll('#guideApp .opt')];if(!nb.length)break;b.splice(0,b.length,...nb)}
 const t=p.doc.getElementById('guideApp').textContent;T('GDE-01','Guide result with a vehicle picked renders without error (withheld prices)',!err&&t.length>200&&!/NaN|undefined/.test(t),err||t.slice(0,120))}
for(const code of ['p2300','p2335','p06d1']){const h=fs.readFileSync(D('codes/'+code+'/index.html'),'utf8');const main=h.slice(h.indexOf('code-big'));const a=main.indexOf('urg-first'),b=main.indexOf('class="urg ');T('URG-'+code,code.toUpperCase()+': stop condition before the softer badge',a>0&&a<b)}
{const h=fs.readFileSync(D('codes/p0300/index.html'),'utf8');T('HTML-01','Inner pages have exactly one <h1> and no malformed closing tags',(h.match(/<h1[\s>]/g)||[]).length===1&&!/<\/p class=/.test(h)&&!/{{HOMEH1/.test(h))}

fs.mkdirSync(path.join(__dirname,'../audit/generated'),{recursive:true});
fs.writeFileSync(path.join(__dirname,'../audit/generated/regression-results.json'),JSON.stringify({ran:new Date().toISOString(),results},null,1));
const f=results.filter(r=>!r.pass).length;console.log(`\n${results.length-f}/${results.length} passed`);process.exit(f?1:0);
})();
