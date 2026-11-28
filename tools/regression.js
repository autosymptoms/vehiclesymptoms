// Regression checks on the built site (dist/). Run: node tools/regression.js  → audit/generated/regression-results.json
// Pages run in jsdom with their real scripts; network calls are stubbed with dated fixtures (tools/fixtures).
const fs=require('fs'),path=require('path');const {JSDOM,VirtualConsole}=require('jsdom');
const D=p=>path.join(__dirname,'..','dist',p);
const FIX=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/nhtsa-2026-11-21.json'),'utf8'));
const results=[];const T=(id,desc,pass,detail)=>{results.push({id,desc,pass:!!pass,detail:detail||''});console.log((pass?'PASS ':'FAIL ')+id+' '+desc+(pass?'':' :: '+detail))};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function load(route,{fetch,est,qs=''}={}){
  let html=fs.readFileSync(D(route+'index.html'),'utf8');
  html=html.replace(/<script defer src="\/_vercel[^>]*><\/script>/,'').replace(/<script (?:defer )?src="\/([a-z0-9.\/-]+\.js)"><\/script>/g,(m,f)=>{
    if(f==='price-est.js'&&est)return '<script>window.EST='+JSON.stringify(est)+'</script>';
    return fs.existsSync(D(f))?'<script>'+fs.readFileSync(D(f),'utf8').replace(/<\/script/g,'<\\/script')+'</script>':''});
  const calls=[],errors=[];const virtualConsole=new VirtualConsole();virtualConsole.on('jsdomError',e=>errors.push(String(e.message||e)));
  const dom=new JSDOM(html,{virtualConsole,runScripts:'dangerously',url:'https://www.vehiclesymptoms.com'+route+qs,pretendToBeVisual:true,beforeParse(w){
    w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.print=()=>{};
    w.fetch=(u,o)=>{calls.push(String(u));if(/\/data\/v\/(.+)\.json$/.test(u)){const f=D('data/v/'+RegExp.$1+'.json');return Promise.resolve({ok:true,status:200,json:async()=>JSON.parse(fs.readFileSync(f,'utf8'))})}
      return fetch?fetch(String(u),o):new Promise(()=>{})};}});
  return {dom,w:dom.window,doc:dom.window.document,calls,errors};
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
 T('REC-04','HTTP error shows an unknown recall count, a retry and an on-site VIN question',/lookup unavailable/i.test(t)&&/unknown/.test(t)&&!!box.querySelector('button')&&!!box.querySelector('#recQuestion')&&![...box.querySelectorAll('a[href^="http"]')].some(a=>!a.href.startsWith('https://www.nhtsa.gov/recalls'))&&!/No safety recalls/.test(t),t.slice(0,220))}

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
   ![...box.querySelectorAll('a[href^="https:"]')].some(a=>!a.href.startsWith('https://www.nhtsa.gov/recalls'))&&box.textContent.includes(sourceUrl)&&box.textContent.includes('Park outside until the dealer completes the repair.'));
 box.querySelector('#recCopy').click();await sleep(0);
 T('REC-MSG','VIN-specific question can be copied locally on a successful lookup',
   box.querySelector('#recQuestion').value.includes('2023 Acura')&&/selected/.test(box.querySelector('#recCopyStatus').textContent));
 p.w.TextEncoder=TextEncoder;p.w.TextDecoder=TextDecoder;
 p.w.eval(fs.readFileSync(D('vendor/jspdf.umd.min.js'),'utf8'));
 const Pdf=p.w.jspdf.jsPDF;let output='';
 p.w.jspdf.jsPDF=function(options){const doc=new Pdf(options);doc.save=()=>{output=doc.output()};return doc};
 p.w.eval(fs.readFileSync(D('pdf.js'),'utf8'));p.w.VS_PDF(p.w.VS_PAGE);
 T('REC-PDF','PDF retains all campaigns and the agency remedy without creating external link annotations',
   output.includes('23V000013')&&output.includes('Question for your dealer')&&output.includes('Park outside')&&!output.includes('/Subtype /Link'));
 p.w.close();
}

// One failed NHTSA name must not hide campaigns the other names returned (2021 Pacifica: PACIFICA ok, PLUG-IN HYBRID 400).
{const camp=(m,id)=>({Manufacturer:'FCA US LLC',NHTSACampaignNumber:id,ReportReceivedDate:'01/01/2024',Component:'ELECTRICAL SYSTEM',Summary:'Test summary',Consequence:'',Remedy:'Dealers will fix it free.',Notes:'',ModelYear:'2021',Make:'CHRYSLER',Model:m});
 const p=load('/vehicles/chrysler-pacifica/2021/',{fetch:nh(k=>/PLUG-IN/.test(k)?{status:503}:/HYBRID/.test(k)?{Count:1,Message:'ok',results:[camp('PACIFICA HYBRID','24V536000')]}:{Count:2,Message:'ok',results:[camp('PACIFICA','21V111000'),camp('PACIFICA','22V222000')]})});
 await sleep(400);const t=p.doc.getElementById('nhtsa').textContent;
 T('REC-PARTIAL','A failed alias keeps the campaigns other names returned and says the list may be incomplete',/3 safety recalls/.test(t)&&/24V536000/.test(t)&&/may be incomplete/i.test(t)&&!/lookup unavailable/i.test(t),t.slice(0,160))}
{const p=load('/vehicles/chrysler-pacifica/2021/',{fetch:nh(k=>/PLUG-IN/.test(k)?{status:503}:{Count:0,Message:'ok',results:[]})});
 await sleep(400);T('REC-PARTIAL-0','Zero campaigns with an unchecked alias is not shown as zero',/lookup unavailable/i.test(p.doc.getElementById('nhtsa').textContent),'')}

// Whole-site health check (Nov 24): engine-specific issues, EV reset heading, code descriptions, no contact-list write.
{const p=load('/vehicles/honda-fit/2014/',{});await sleep(400);const h=p.doc.getElementById('vehicleView').textContent;
 T('VEH-FIT14','2014 Fit (EV only in the U.S.) shows no gasoline ignition-coil issue',!/Ignition coil failure/.test(h),'')}
{const p=load('/vehicles/honda-fit/2013/',{});await sleep(400);T('VEH-FIT13','Gas-engine issue still shows on a gas year (2013 Fit)',/Ignition coil failure/.test(p.doc.getElementById('vehicleView').textContent),'')}
{const p=load('/vehicles/lexus-is/2021/',{});await sleep(400);T('VEH-IS21','2021 Lexus IS shows no V8 throttle card',!/on the V8/.test(p.doc.getElementById('vehicleView').textContent),'')}
{const p=load('/vehicles/jeep-grand-cherokee/2020/',{});await sleep(400);T('VEH-GC20','2020 Grand Cherokee keeps the EcoDiesel fuel-pump recall',/Diesel high-pressure fuel pump/.test(p.doc.getElementById('vehicleView').textContent),'')}
{const p=load('/vehicles/ford-explorer/2024/',{});await sleep(400);T('VEH-EXP24','2024 Explorer does not show 2025-only recall 25V-164',!/25V-164/.test(p.doc.getElementById('vehicleView').textContent),'')}
{const p=load('/vehicles/tesla-model-3/2023/',{});await sleep(400);const r=p.doc.getElementById('reset');
 T('EV-RESET','Electric model year has no oil-change reset heading',!r||!/oil change/i.test(r.textContent),r?r.querySelector('h2').textContent:'no reset section')}
for(const code of ['c0031','p0520','u0131','p0455']){const h=fs.readFileSync(D('codes/'+code+'/index.html'),'utf8');const m=h.match(/<meta name="description" content="([^"]*)"/)[1];
 T('META-'+code,code.toUpperCase()+' description names its own urgent condition',!/flashing check engine/i.test(m),m.slice(0,90))}
T('PRIV-01','Result email no longer writes to a contact list',!/api\.resend\.com\/contacts/.test(fs.readFileSync(path.join(__dirname,'../api/send-summary.js'),'utf8')),'')

{// A 400 for one name means NHTSA has nothing filed under it that year: not a failed lookup (Nov 27).
 const p=load('/vehicles/chrysler-pacifica/2021/',{fetch:nh(k=>/PLUG-IN/.test(k)?{status:400}:{Count:1,Message:'ok',results:[{NHTSACampaignNumber:'21V111000',Make:'CHRYSLER',Model:k.split('|')[1],ModelYear:'2021',Component:'X',Summary:'s',Remedy:'r'}]})});await sleep(400);
 const t=p.doc.getElementById('nhtsa').textContent;
 T('REC-400-NONE','A name NHTSA answers with HTTP 400 counts as no records once another name answered',/safety recall/.test(t)&&!/may be incomplete|lookup unavailable/i.test(t),t.slice(0,160))}
// ---- Audit Nov 27: Lexus IS names, partial counts, year names ----
{// Campaign ids per NHTSA name for the 2011 Lexus IS, as NHTSA answered on 2026-11-27 (the bare "IS" name finds only one).
 const L11={'IS 250':['19V741000','19V005000','16V340000','13V030000'],'IS 350':['19V005000','19V741000','18V432000','16V340000','14V647000','13V395000','13V030000'],
  'IS 250C':['19V741000','19V005000','16V340000','13V030000'],'IS 350C':['19V005000','19V741000','18V432000','16V340000','13V395000','13V030000'],'IS F':['19V005000','16V340000','13V030000'],'IS':['26V748000']};
 const mk=(model,year,ids)=>({Count:ids.length,Message:'Results returned successfully',results:ids.map(id=>({NHTSACampaignNumber:id,Make:'LEXUS',Model:model,ModelYear:String(year),Component:'X',Summary:'s',Remedy:'r'}))});
 const p=load('/vehicles/lexus-is/2011/',{fetch:nh(k=>{const [,md,y]=k.split('|');const ids=L11[Object.keys(L11).find(n=>n.toUpperCase()===md)];return ids&&y==='2011'?mk(md,2011,ids):{status:400}})});await sleep(400);
 const box=p.doc.getElementById('nhtsa').textContent,models=p.calls.filter(u=>/recallsByVehicle/.test(u)).map(u=>new URL(u).searchParams.get('model'));
 T('LEX-IS-2011','2011 Lexus IS queries every IS name and counts 8 distinct campaigns',/\b8 safety recalls filed/.test(box)&&['IS 250','IS 350','IS 250C','IS 350C','IS F'].every(n=>models.includes(n)),box.slice(0,120)+' | '+models.join(','));
 const p2=load('/vehicles/lexus-is/2012/',{fetch:nh(k=>{const [,md]=k.split('|');return md==='IS 350'?mk('IS 350',2012,['13V030000','16V340000']):empty(k)})});await sleep(400);
 const b2=p2.doc.getElementById('nhtsa').textContent,t2=p2.doc.getElementById('recTile').textContent;
 T('REC-UNVERIFIED','A positive count under an unconfirmed name list says "found" with the in-progress line, no caution label',/\b2 safety recalls found/.test(b2)&&!/At least|lookup incomplete|may be incomplete/i.test(b2)&&/in progress/.test(b2)&&p2.doc.querySelector('#recTile .tv').textContent.trim()==='2'&&/Checked /.test(b2),b2.slice(0,200)+' | '+t2);
 const eng=JSON.parse(fs.readFileSync(D('data/v/lexus-is.json'),'utf8')).engines.filter(e=>e.y[0]<=2011&&e.y[1]>=2011).map(e=>e.name).join('; ');
 T('LEX-IS-ENG','2011 Lexus IS engines do not list the later IS 300 AWD',!/IS 300/.test(eng)&&/IS 350/.test(eng),eng);
 const ti=r=>(fs.readFileSync(D(r+'index.html'),'utf8').match(/<title>([^<]*)/)||[])[1]||'';
 T('YEAR-NAMES','Combined labels show the name sold that year',/^2005 Acura RSX:/.test(ti('vehicles/acura-rsx-integra/2005/'))&&/^1998 Acura Integra:/.test(ti('vehicles/acura-rsx-integra/1998/'))&&/^2002 Porsche Boxster:/.test(ti('vehicles/porsche-boxster-cayman/2002/'))&&/^2010 Porsche Boxster \/ Cayman:/.test(ti('vehicles/porsche-boxster-cayman/2010/')),[ti('vehicles/acura-rsx-integra/2005/'),ti('vehicles/porsche-boxster-cayman/2002/')].join(' | '));
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

// ---- Nov 27 2026 sweep: build and template (a04) ----
{const R=f=>fs.existsSync(D(f))?fs.readFileSync(D(f),'utf8'):'';const main=h=>h.slice(h.indexOf('<main'));
 const home=R('index.html'),code=R('codes/p0300/index.html'),sm=R('sitemap.xml')+['roadside','symptoms','warning-lights','codes','vehicles','pages'].map(n=>R('sitemap-'+n+'.xml')).join('');
 // T-11: the homepage block ships only on the homepage.
 T('T11-HOME','Homepage keeps its search box, FAQ and hero',/id="helpForm"/.test(home)&&/Is it really free\?/.test(home)&&/<h1>What/.test(home));
 T('T11-INNER','Inner pages carry no hidden homepage text, headings or FAQ',!/Is it really free\?|Three steps to a clear answer|id="helpForm"|id="homeView"|id="pickForm"|id="vinForm"/.test(code));
 // T-24: scripts are deferred.
 T('T24-DEFER','Site scripts load with defer',/<script defer src="\/app\.js">/.test(code)&&/<script defer src="\/vehicles\.js">/.test(code)&&!/<script src="\/app\.js">/.test(code));
 // T-20: font self-hosted.
 T('T20-FONT','Public Sans is served from the site, not Google',!/fonts\.googleapis|fonts\.gstatic/.test(code)&&fs.existsSync(D('fonts/public-sans-latin-wght-normal.woff2'))&&/\/fonts\/public-sans/.test(R('site.css')));
 // T-14: breadcrumb structured data.
 {const lds=[...code.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map(m=>JSON.parse(m[1]));const bc=lds.find(x=>x['@type']==='BreadcrumbList');
  T('T14-CRUMB','Code page has BreadcrumbList Home › Code lookup › P0300',bc&&bc.itemListElement.length===3&&bc.itemListElement[2].name==='P0300'&&bc.itemListElement[0].item==='https://www.vehiclesymptoms.com/',JSON.stringify(bc||{}).slice(0,160))}
 // T-12: a year with no documented problems is noindex and not in the sitemap.
 {const empty=fs.readdirSync(D('vehicles')).flatMap(m=>fs.existsSync(D('vehicles/'+m))&&fs.statSync(D('vehicles/'+m)).isDirectory()?fs.readdirSync(D('vehicles/'+m)).filter(y=>/^\d{4}$/.test(y)).map(y=>'/vehicles/'+m+'/'+y+'/'):[]).filter(u=>/name="robots" content="noindex"/.test(R(u.slice(1)+'index.html')));
  T('T12-NOINDEX','Empty year pages are noindex and left out of the sitemap',empty.length>0&&empty.every(u=>!sm.includes('vehiclesymptoms.com'+u+'<')),empty.length+' noindex year pages')}
 // T-13: code titles.
 T('T13-TITLE','Code titles drop "Meaning, Causes & Fixes" and stay short',/<title>P0300: [^<]*Can I Drive\?<\/title>/.test(code)&&!/Meaning, Causes/.test(code),(code.match(/<title>[^<]*/)||[''])[0]);
 // TC-03/07/08/10 on code pages.
 const p0420=R('codes/p0420/index.html');
 T('TC03-SRC','Code pages name their own sources and link the NHTSA VIN recall lookup',/Code title: SAE J2012 standard definition\./.test(code)&&/href="https:\/\/www\.nhtsa\.gov\/recalls" target="_blank" rel="noopener nofollow"/.test(code));
 T('TC07-READ','Code pages explain how to get codes read',/How to get your code read/.test(code)&&/auto parts stores will read your codes/.test(code));
 T('TC08-LABEL','Stop box label reads "Stop-driving signs:" and says other serious signs also mean stop',/<b class="urg-first-h">Stop-driving signs:<\/b>/.test(p0420)&&/class="urg-first"[^>]*>(?:(?!<\/div>).)*Also stop if the brakes or steering feel wrong, or you notice overheating, smoke or a burning smell\./s.test(p0420)&&!/Pull over now only if/.test(p0420)&&!/Stop-now condition/.test(p0420));
 // No built code page heads its stop box "Pull over now only if" or claims four-cylinder engines have only one bank (flat/boxer fours have two).
 {const bad={pull:[],bank:[]};for(const d of fs.readdirSync(D('codes'))){const f=D('codes/'+d+'/index.html');if(!fs.existsSync(f))continue;const h=fs.readFileSync(f,'utf8');
   if(/Pull over now only if/i.test(h))bad.pull.push(d);if(/(?:four|4)[- ]cylinder[^.<]*\b(?:only one|one|a single) bank|only one bank/i.test(h))bad.bank.push(d)}
  T('TC08-NOONLY','No code page heads its stop box "Pull over now only if"',!bad.pull.length,bad.pull.length+' pages, e.g. '+bad.pull.slice(0,5).join(', '));
  T('TC21-NOONEBANK','No code page says four-cylinder engines have only one bank',!bad.bank.length,bad.bank.length+' pages, e.g. '+bad.bank.slice(0,5).join(', '))}
 T('TC10-REL','P0420 related codes start with P0430, not the P042x neighbours',/Related codes<\/h2><div class="codechips"><a href="\/codes\/p0430\/">/.test(p0420));
 T('TC21-BANK','P0420 explains bank 1, and that V and flat (boxer) engines have two banks',/Bank 1 is the side of the engine with cylinder 1/.test(p0420)&&/V and flat \(boxer\) engines have two/.test(p0420));
 T('TC20-404','404 page sends unknown /codes/<code>/ to the code lookup',/location\.replace\("\/codes\/\?q="/.test(R('404.html')));
 // Guides: safety box under the H1, then the intro; pull-over line; linked sources; recall line.
 const g=main(R('symptoms/engine-overheating/index.html'));
 T('SG-ORDER','Guide: pull-over line and safety box come before the intro',g.indexOf('class="pullover"')>0&&g.indexOf('id="safety"')>g.indexOf('</h1>')&&g.indexOf('id="safety"')<g.indexOf('gintro'));
 T('SG-M5','Guide safety heading is "Stop and get help right away:" with a separate "Stay safe while you check:"',/Stop and get help right away:<\/b>/.test(g)&&/Stay safe while you check:/.test(g)&&!/right away if:/.test(g));
 T('SG-H1','Guide sources link whitelisted pages with titles',/<ul class="srcs"><li><a href="https:\/\/www\.aaa\.com\/[^"]+" target="_blank" rel="noopener nofollow">AAA: /.test(g));
 // Warning lights.
 const op=R('warning-lights/oil-pressure-light/index.html');
 T('T10-META','Oil pressure light description leads with the action',/<meta name="description" content="Red oil pressure light on\? Stop driving/.test(op));
 T('WL-M7','Oil pressure light: "Can I reset this light?" heading',/<h2>Can I reset this light\?<\/h2><p><b>No\. This light goes out when the problem is fixed\.<\/b>/.test(op));
 T('WL-HUB','Hub tip about flashing lights',/A flashing red light or a flashing check engine light is more urgent than a steady one\./.test(R('warning-lights/index.html')));
 T('LIGHT-INDEX','guide-index.js ships window.LIGHT_INDEX',/window\.LIGHT_INDEX=\[\["/.test(R('guide-index.js')));
 // Resets.
 const hon=R('warning-lights/reset/honda/index.html');
 T('R-09','Reset make page opens with "Before you reset anything"',hon.indexOf('Before you reset anything')>0&&hon.indexOf('Before you reset anything')<hon.indexOf('class="rvar"'));
 {const ld=[...hon.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map(m=>JSON.parse(m[1])).find(x=>x['@type']==='FAQPage');
  T('R-15','Reset FAQ answers end with the "steps differ" note',ld&&ld.mainEntity.every(q=>/Steps differ by model and year/.test(q.acceptedAnswer.text)))}
 // Privacy, about, bulletins, llms.
 const pr=R('privacy/index.html');
 T('T18-PRIV','Privacy page covers offline copies, recall lookups and hosting; no Google Fonts',/Offline copies/.test(pr)&&/Recall lookups\./.test(pr)&&/Our host, Vercel, processes IP addresses/.test(pr)&&!/Google Fonts/.test(pr));
 T('T08-ABOUT','About page heading order H1 then H2',/<h2>How we work<\/h2>/.test(R('about/index.html')));
 T('TSB-PAGE','/bulletins/ explains a bulletin is not a recall',/A bulletin is not a recall\. If your car has an open recall, that comes first\./.test(R('bulletins/index.html'))&&!/\bfree\b/i.test(main(R('bulletins/index.html')).replace(/<footer[\s\S]*/,'')));
 T('T17-LLMS','llms.txt lists stop-driving pages and says no prices',/## Stop-driving pages/.test(R('llms.txt'))&&/oil-pressure-light/.test(R('llms.txt'))&&/No prices or repair quotes are published/.test(R('llms.txt')));
 // COUNT: site counts are filled in from the data at build time, so they can't go stale (the homepage said 100 guides when the index had 120).
 {const win=f=>{const w={};require('vm').runInNewContext(R(f),{window:w,fetch:()=>Promise.reject()});return w};
  const G=(win('guide-index.js').GUIDE_INDEX||[]).length,VV=win('vehicles.js').VEHICLES||[],C=(win('codes-index.js').CODE_INDEX||[]).length;
  const y0=Math.min(...VV.map(v=>v.years[0])),y1=Math.max(...VV.map(v=>v.years[1]));
  const home=R('index.html'),strip=(home.match(/<ul class="proof proof-strip">([\s\S]*?)<\/ul>/)||['',''])[1],llms=R('llms.txt');
  const hg=(strip.match(/<b>(\d+)<\/b> step-by-step symptom guides/)||[])[1];
  T('COUNT-GUIDES','Homepage guide count matches the number of guides in the guide index',G>0&&hg===String(G),'homepage='+hg+' index='+G);
  T('COUNT-MODELS','Homepage model count and years match the vehicle list',strip.includes('<b>'+VV.length+'</b> popular models, '+y0+' to '+y1+'<')&&home.includes('Browse all '+VV.length+' models')&&home.includes('covers '+VV.length+' popular models from '+y0+' on'),strip.replace(/\s+/g,' ').slice(0,200));
  T('COUNT-LLMS','llms.txt counts match the guide index, vehicle list and code list',llms.includes(': '+G+' step-by-step guides')&&llms.includes(': '+VV.length+' popular models, '+y0+' to '+y1+',')&&llms.includes(': '+C+' OBD-II codes'),'guides='+G+' models='+VV.length+' codes='+C);
  T('COUNT-NOHOLES','No count placeholder is left unfilled on the homepage or vehicles hub',!/{{[A-Z]+}}/.test(home)&&!/{{[A-Z]+}}/.test(R('vehicles/index.html'))&&R('vehicles/index.html').includes('cover, '+y0+' and newer.'))}
 // Contract 3: issue sources in vehicle data; internal fields stay out.
 {const v=JSON.parse(R('data/v/toyota-camry.json'));const all=JSON.stringify(v);
  T('C3-SL','Vehicle data carries sl (links only on the whitelist) and no internal review fields',v.issues.some(i=>Array.isArray(i.sl)&&i.sl.length)&&v.issues.every(i=>(i.sl||[]).every(x=>x.u===null||/^https:\/\/([a-z0-9-]+\.)*(nhtsa\.gov|[a-z0-9-]+\.gov|aaa\.com)\//.test(x.u)||/owner|manual/i.test(x.u)))&&!/sevReviewed|sevReason/.test(all)&&Array.isArray(v.tsbs))}
 // Roadside (only when src/roadside, or ROADSIDE_DIR, had pages).
 if(fs.existsSync(D('roadside/index.html'))){const hub=R('roadside/index.html'),pages=fs.readdirSync(D('roadside')).filter(d=>fs.existsSync(D('roadside/'+d+'/index.html')));
  T('RS10-BTN','Homepage: six symptom chips ending with Smoke or fire, red roadside button right below them',home.indexOf('class="rs-cta" href="/roadside/"')>0&&home.indexOf('class="rs-cta"')>home.indexOf('class="shortcuts"')&&/class="sc sc-danger"[^>]*>Smoke or fire<\/a>\s*<\/div>\s*<a class="rs-cta"/.test(home)&&!home.includes('id="notSure"'));
  T('RS-HUB','Roadside hub lists every page as a big tile',pages.every(d=>hub.includes('href="/roadside/'+d+'/"')),pages.length+' pages');
  T('RS-FIRST','Every roadside page opens with "Do this first" right under the H1',pages.every(d=>{const h=main(R('roadside/'+d+'/index.html'));const a=h.indexOf('</h1>'),b=h.indexOf('Do this first');return a>0&&b>a&&b-a<200}));
  T('RS-SW','Every roadside page is saved for offline use',pages.every(d=>R('sw.js').includes('"/roadside/'+d+'/"'))&&R('sw.js').includes('"/roadside/"'));
  T('RS-SITEMAP','Roadside pages are in the sitemap',pages.every(d=>sm.includes('/roadside/'+d+'/<')))}
}
// Search still works with deferred scripts, on the homepage and on an inner page (T-11, T-24).
{const p=load('/',{});await sleep(200);const err=p.errors.filter(e=>!/Not implemented/.test(e)).join(' | ');
 const i=p.doc.getElementById('helpInput');i.value='my brakes went out';p.doc.getElementById('helpForm').dispatchEvent(new p.w.Event('submit',{cancelable:true}));await sleep(50);
 const out=p.doc.getElementById('helpResults').textContent;T('SEARCH-HOME','Homepage search answers an emergency with scripts deferred',!err&&out.length>40,err||out.slice(0,100));p.w.close()}
{const p=load('/codes/p0300/',{});await sleep(200);const errs=p.errors.filter(e=>!/Not implemented/.test(e));
 T('SEARCH-INNER','Inner page scripts start without errors and without the homepage block',!errs.length&&p.doc.getElementById('navMy'),errs.join(' | '));p.w.close()}
{const p=load('/warning-lights/',{});await sleep(200);const errs=p.errors.filter(e=>!/Not implemented/.test(e));const s=p.doc.getElementById('lsearch');
 s.value='oil';s.dispatchEvent(new p.w.Event('input'));await sleep(20);const shown=[...p.doc.querySelectorAll('#lgrid .lcard')].filter(a=>!a.hidden).length;
 T('SEARCH-LIGHTS','Warning-light hub search runs with deferred scripts',!errs.length&&shown>0&&shown<20,errs.join(' | ')+' shown='+shown);p.w.close()}
// Inner pages with their own search still work without the homepage block (T-11): symptom hub, a guide, a vehicle page.
for(const r of ['/symptoms/','/symptoms/brake-lights-not-working/','/vehicles/honda-civic/2012/','/roadside/flat-tire/']){if(!fs.existsSync(D(r+'index.html')))continue;
 const p=load(r,{});await sleep(250);const errs=p.errors.filter(e=>!/Not implemented/.test(e));
 T('T11-'+r.replace(/\W+/g,'-').replace(/^-|-$/g,''),r+' starts without errors and has no homepage block',!errs.length&&!p.doc.getElementById('homeView'),errs.join(' | '));p.w.close()}
// TC-06: code search fallbacks for codes we don't have yet.
{const msg=async q=>{const p=load('/codes/',{qs:'?q='+q});await sleep(150);const t=(p.doc.getElementById('codeRes')||{}).textContent||'';const errs=p.errors.filter(e=>!/Not implemented/.test(e));p.w.close();return errs.length?'ERR '+errs.join(' | '):t};
 const known=c=>fs.readFileSync(D('codes/index.html'),'utf8').includes('/codes/'+c.toLowerCase()+'/')||fs.existsSync(D('codes/'+c.toLowerCase()+'/index.html'));
 const pick=list=>list.find(c=>!known(c));
 const mfr=[pick(['U3000','U3099','U3FFE']),pick(['P3399','P33FF','P3300']),pick(['U2299','U2FFE','U2220'])].filter(Boolean);
 const out=[];for(const c of mfr)out.push([c,await msg(c)]);
 T('TC06-MFR','Carmaker ranges (P30-P33, U2/U3) get the carmaker line',out.length>=2&&out.every(([c,t])=>/range set by the carmaker/.test(t)&&!/Try the first letters/.test(t)),JSON.stringify(out).slice(0,300));
 const cc=pick(['C1999','C2FFE','C3FFE','C0FFE']);const ct=cc?await msg(cc):'';
 T('TC06-C','Missing C codes get the brake-safety line',cc&&/C codes are chassis codes/.test(ct)&&/pull over safely and have it towed/.test(ct)&&(!/^C[1-3]/.test(cc)||/set by the carmaker/.test(ct)),cc+': '+ct.slice(0,200));
 const gp=pick(['P0FFF','P0FFE','P2FFE']);const gt=gp?await msg(gp):'';
 T('TC06-GEN','Generic missing codes keep the try-the-first-letters line',gp&&/Try the first letters/.test(gt)&&!/carmaker/.test(gt),gp+': '+gt.slice(0,200))}

// ---- Nov 27 evening: summaries agree with the detailed instructions (power steering, wrench light, cabin exhaust) ----
{const staticDoc=r=>new JSDOM(fs.readFileSync(D(r+'index.html'),'utf8')).window.document;
 const sentences=t=>t.replace(/\s+/g,' ').split(/(?<=[.!?])\s+/);
 // Restart advice given as an instruction (not "a restart is not a fix", "even after a restart" or "don't restart the engine").
 const RESTART=/(?<!(?:n't|not) )\b(?:then )?restart (?:once|it|the engine)\b|start it again|light stays out|steering systems reset/i;
 // Walk a guide in the browser by answer text; returns the result's urgency, next step and mechanic summary.
 const walk=async(route,answers)=>{const p=load(route,{});await sleep(250);const app=()=>p.doc.getElementById('guideApp');
  for(const a of answers){const b=[...app().querySelectorAll('.opt')].find(x=>x.textContent.trim().startsWith(a));if(!b){const q=(app().querySelector('.fq')||{}).textContent;p.w.close();return {missing:a,q}}b.click();await sleep(30)}
  const out={q:(app().querySelector('.fq')||{}).textContent||'',urg:((p.doc.getElementById('resultUrgency')||{}).textContent||'').replace(/^\s*How urgent:\s*/,''),title:(app().querySelector('.rt')||{}).textContent||'',
   now:([...app().querySelectorAll('.rsec')].find(s=>/What to do next/.test(s.textContent))||{querySelector:()=>({})}).querySelector('p').textContent||'',sum:(p.doc.getElementById('sum')||{}).textContent||''};p.w.close();return out};
 // Power steering light page: top summary, steps, DIY checks, reset box and FAQ all say stop when heavy or red, with no restart-to-clear advice.
 {const d=staticDoc('/warning-lights/power-steering-light/');const all=d.querySelector('main').textContent;
  const stopIf=(d.querySelector('.urg-stopif')||{}).textContent||'',drive=(d.querySelector('.drivebox p')||{}).textContent||'',first=(d.querySelector('#todo li')||{}).textContent||'';
  const ld=JSON.parse([...d.querySelectorAll('script[type="application/ld+json"]')].map(s=>s.textContent).find(t=>/FAQPage/.test(t)));const faq=ld.mainEntity.map(q=>q.acceptedAnswer.text).join(' ');
  T('ED-PS-LIGHT','Power steering light: summary, first step and FAQ say stop when heavy or red; no restart-to-clear advice anywhere',
   /the light is red or the steering feels heavy/.test(stopIf)&&/red or the steering takes more effort than normal, pull over[^.]*stop\. Don't drive it until it's checked/.test(drive)&&/A restart is not a fix/.test(drive)
   &&/^If the steering feels heavy or the light is red, stop somewhere safe and don't drive it until it's checked\. Restarting the engine is not a fix\./.test(first)&&!RESTART.test(all)&&!RESTART.test(faq),
   'stopIf='+stopIf+' | drive='+drive.slice(0,120)+' | first='+first.slice(0,80)+' | restart='+((all.match(RESTART)||faq.match(RESTART)||[''])[0]))}
 // Power steering guide: heavy or red outcomes say stop, and the on-screen step, the saved/printed summary and the text-message share agree.
 {const paths=[['Very heavy','None of these'],['Very heavy',"I'm not sure"],['Very heavy','It happened right after a jump start'],['Very heavy','The battery light is on too'],['Normal, and the light is red'],['Sometimes heavy']];const bad=[];
  for(const a of paths){const r=await walk('/symptoms/power-steering-warning-light/',a);
   if(r.missing||!/^Stop/.test(r.urg)||!/Don't drive it|Avoid driving it|rather than driving on/.test(r.now)||RESTART.test(r.now)||!r.sum.includes('What to do next: '+r.now))bad.push(a.join(' > ')+': '+JSON.stringify(r).slice(0,200))}
  const j=JSON.parse(fs.readFileSync(path.join(__dirname,'../src/journeys/power-steering-warning-light.json'),'utf8'));
  const heavy=j.safety.find(t=>/steering suddenly gets heavy/.test(t))||'';
  T('ED-PS-GUIDE','Power steering guide: heavy-steering and red-light outcomes say stop in the result and the mechanic summary; top safety note says a restart is not a fix',
   !bad.length&&/Don't drive it again until it's checked\. A restart is not a fix\./.test(heavy)&&!Object.values(j.nodes).some(n=>n.result&&RESTART.test(n.result.now+' '+n.result.if.join(' '))),bad.join(' || ')||heavy)}
 // Wrench light: gentle driving only when the car drives normally; power loss, slipping or jerking means stop somewhere safe and tow or check it there.
 {const bad=[];for(const id of ['wrench-light','service-light']){const d=staticDoc('/warning-lights/'+id+'/');
   const ld=JSON.parse([...d.querySelectorAll('script[type="application/ld+json"]')].map(s=>s.textContent).find(t=>/FAQPage/.test(t)));
   const text=[d.querySelector('main').textContent,...ld.mainEntity.map(q=>q.acceptedAnswer.text)].join(' ');
   for(const s of sentences(text)){
    if(/drive (?:it )?gently|drive carefully|head straight for a shop|get yourself home/i.test(s)&&!/normally/.test(s))bad.push(id+' allows driving without "normally": '+s);
    if(/(?:power is (?:clearly )?(?:reduced|down)|reduced power|slip|jerk|pedal feels dead|won't speed up|will not pick up speed)/i.test(s)&&/drive (?:it )?gently|drive (?:it )?straight|head straight|stay off the highway and drive|keep driving hard/i.test(s))bad.push(id+' lets you drive on with power loss or slipping: '+s)}}
  const w=staticDoc('/warning-lights/wrench-light/'),drive=(w.querySelector('.drivebox p')||{}).textContent||'',stopIf=(w.querySelector('.urg-stopif')||{}).textContent||'';
  T('ED-WRENCH','Wrench light: details match the summary (power loss, slipping or jerking: no further than a safe place to stop, tow or check it there)',
   !bad.length&&/slip or jerk, don't drive further than a safe place to stop\. Have it towed or checked where it is\./.test(drive)&&/slip or jerk/.test(stopIf),bad.join(' || ')||drive.slice(0,200))}
 // Cabin exhaust: the open-hatch branch asks about fumes with everything closed before the lower-urgency rear-seal advice.
 {const j=JSON.parse(fs.readFileSync(path.join(__dirname,'../src/journeys/exhaust-smell-in-cabin.json'),'utf8'));
  const parents=Object.entries(j.nodes).filter(([,n])=>(n.opts||[]).some(o=>o.go==='r_rear_seal')).map(([k])=>k);
  const base=['No','When the rear hatch'];const ask=await walk('/symptoms/exhaust-smell-in-cabin/',base);
  const yes=await walk('/symptoms/exhaust-smell-in-cabin/',[...base,'Yes, I still smell it']),unsure=await walk('/symptoms/exhaust-smell-in-cabin/',[...base,"I'm not sure"]),no=await walk('/symptoms/exhaust-smell-in-cabin/',[...base,'No, it goes away']);
  T('ED-EXHAUST','Cabin exhaust: hatch branch asks whether fumes persist with everything closed; yes or unsure is a stop result, only "no" gets the seal check within days',
   parents.join()==='q_rear_closed'&&/hatch, trunk and all the windows closed/.test(ask.q)&&/^Stop/.test(yes.urg)&&/^Stop/.test(unsure.urg)&&/Avoid using the car/.test(yes.sum)&&/^Get it checked/.test(no.urg)&&/through the back of the car/.test(no.title),
   JSON.stringify({parents,ask:ask.q,yes:yes.urg,unsure:unsure.urg,no:no.urg+' '+no.title}).slice(0,300))}
}

fs.mkdirSync(path.join(__dirname,'../audit/generated'),{recursive:true});
fs.writeFileSync(path.join(__dirname,'../audit/generated/regression-results.json'),JSON.stringify({ran:new Date().toISOString(),results},null,1));
const f=results.filter(r=>!r.pass).length;console.log(`\n${results.length-f}/${results.length} passed`);process.exit(f?1:0);
})();
