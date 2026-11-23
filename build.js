// Builds the static site into dist/.
// 1. Vehicle data: src/vehicles.js + src/batches/*.js, then src/deep/<id>.json overrides a model by id.
// 2. Symptom guides: src/journeys/<id>.json (each checked by tools/check_journey.js).
// 3. Pages: home, /symptoms/ hub, /symptoms/<id>/, /vehicles/<id>/, /vehicles/<id>/<year>/, sitemap.
const fs=require('fs'),path=require('path');
const {JSDOM}=require('jsdom');
const animations = require('./src/animations/render').createLibrary();
const SITE='https://www.vehiclesymptoms.com';
const CONTACT='autosymptoms@gmail.com';
const BYLINE='<p class="byline">VehicleSymptoms team · Updated November 2026 · <a href="/about/">How we work</a> · <a href="/about/#contact">Contact the team</a></p>';
const CRED='Built by people who fix cars. Guides are written for drivers and checked against recalls, service bulletins and repair records.';

const {createHash}=require('node:crypto');
const publisherNames=require('./src/source-publishers.json');
const publisherAliases={'Cars.com':'Cars Commerce','FuelEconomy.gov':'U.S. Department of Energy'};
const knownPublishers=new Set(Object.values(publisherNames).map(name=>publisherAliases[name]||name));
const isExternal=value=>/(?:\b[a-z][a-z0-9+.-]*:\s*\/\/|\b(?:mailto|tel|sms|javascript|file|blob):|\bdata:[^,\s]*,|\bwww\.|(?:^|[\s"'(=])\/\/[a-z0-9]|\b[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.(?:com|org|gov|edu|net|info|biz|io|co|us|ca|uk|au|de|jp|app|site|auto|autos|repair|shop|inc|news)\b|\b[a-z0-9][a-z0-9.-]*\.[a-z]{2,63}(?=[/?#])|^(?:[a-z0-9-]+\.)+[a-z]{2,63}$)/i.test(value);
function publisherLabel(source){
  if(typeof source!=='string')return null;
  const name=publisherAliases[source]||source;
  if(knownPublishers.has(name))return name;
  let host;
  try{host=new URL(source).hostname.toLowerCase().replace(/^www\./,'')}catch{return null}
  while(host.includes('.')){
    const label=publisherNames[host];
    if(label)return publisherAliases[label]||label;
    host=host.slice(host.indexOf('.')+1);
  }
  return null;
}
const publishers=sources=>[...new Set(sources.map(publisherLabel).filter(Boolean))];
function assertPublicData(value,context){
  if(typeof value==='string'){
    if(isExternal(value))throw new Error('Outside URL in public data: '+context);
  }else if(value&&typeof value==='object'){
    for(const [key,child] of Object.entries(value)){
      if(isExternal(key))throw new Error('Outside URL in public data key: '+context);
      assertPublicData(child,context+'.'+key);
    }
  }
}
function publicJson(value,context){
  const serialized=JSON.stringify(value,(key,item)=>{
    if((key==='src'||key==='sources')&&Array.isArray(item)&&item.every(v=>typeof v==='string'))return publishers(item);
    return item;
  });
  assertPublicData(JSON.parse(serialized),context);
  return serialized;
}
const instructionRows=JSON.parse(fs.readFileSync('src/onsite-instructions.json','utf8'));
if(!Array.isArray(instructionRows)||!instructionRows.length)throw new Error('Expected reviewed on-site instructions');
const instructionMap=new Map(),appliedInstructions=new Set();
const instructionKey=(id,title,field)=>JSON.stringify([id,title,field]);
for(const row of instructionRows){
  if(!row||Object.keys(row).sort().join(',')!=='after,before,field,id,title'||
    !/^[a-z0-9-]+$/.test(row.id)||typeof row.title!=='string'||!row.title.trim()||
    !['next','note'].includes(row.field)||!/^[0-9a-f]{64}$/.test(row.before)||
    typeof row.after!=='string'||!row.after.trim()||isExternal(row.after)||isExternal(row.title))
    throw new Error('Invalid reviewed on-site instruction');
  const key=instructionKey(row.id,row.title,row.field);
  if(instructionMap.has(key))throw new Error('Duplicate reviewed instruction: '+key);
  instructionMap.set(key,row);
}
function applyInstruction(id,record,field){
  const key=instructionKey(id,record.t,field),edit=instructionMap.get(key);
  if(!edit)return;
  if(appliedInstructions.has(key))throw new Error('Ambiguous source instruction: '+key);
  if(typeof record[field]!=='string'||createHash('sha256').update(record[field],'utf8').digest('hex')!==edit.before)
    throw new Error('Source instruction changed; review required: '+key);
  if(record[field]===edit.after)throw new Error('Instruction already matches replacement: '+key);
  record[field]=edit.after;
  appliedInstructions.add(key);
}

// ---------- vehicles ----------
const files=['src/vehicles.js',...fs.readdirSync('src/batches').filter(f=>/^batch\d+\.js$/.test(f)).sort((a,b)=>parseInt(a.slice(5))-parseInt(b.slice(5))).map(f=>'src/batches/'+f)];
global.window={};
for(const f of files)eval(fs.readFileSync(f,'utf8'));
let V=window.VEHICLES;
const deepDir='src/deep';let deepN=0;
if(fs.existsSync(deepDir))for(const f of fs.readdirSync(deepDir).filter(f=>f.endsWith('.json'))){
  try{const d=JSON.parse(fs.readFileSync(path.join(deepDir,f),'utf8'));const k=V.findIndex(v=>v.id===d.id);if(k>=0){V[k]=d;deepN++}else{V.push(d);deepN++}}catch(e){console.log('BAD deep file',f,e.message)}}
for(const v of V)for(const issue of v.issues)applyInstruction(v.id,issue,'next');
// Years a model was not sold in the US (src/gaps.json): no year page, not offered in pickers.
{const G=JSON.parse(fs.readFileSync('src/gaps.json','utf8'));for(const v of V){if(G[v.id])v.gaps=G[v.id];else delete v.gaps}}
const sold=(v,y)=>y>=v.years[0]&&y<=v.years[1]&&!(v.gaps||[]).some(g=>y>=g[0]&&y<=g[1]);
const firstSold=(v,i)=>{for(let y=i.y[0];y<=i.y[1];y++)if(sold(v,y))return y;return null};
// ---------- repair price estimates (src/prices/<id>.json) ----------
// Range = parts + book hours x labor rate. Rate band from 2025-26 industry surveys (about half of US shops charge $120-$159/hr).
const RATE=[120,160];let priced=0;
// Prices are switched off site-wide (Daniel, Nov 22 2026): no repair costs, price guide, ownership costs or price check anywhere.
// The price data stays in src/ so this can be turned back on later by setting SHOW_PRICES to true.
const SHOW_PRICES=false;
const EV=require('./tools/evidence.js'),PT=require('./src/powertrain.js');const LEDGER=[];// every price record, shown or withheld (written to audit/generated/price-ledger.json)
const rnd=(n,up)=>{const st=n<500?10:n<2000?25:50;return (up?Math.ceil(n/st):Math.floor(n/st))*st};
if(fs.existsSync('src/prices'))for(const f of fs.readdirSync('src/prices').filter(f=>f.endsWith('.json'))){
  const P=JSON.parse(fs.readFileSync('src/prices/'+f,'utf8'));const v=V.find(v=>v.id===P.id);if(!v){console.log('price file for unknown vehicle',f);continue}
  for(const item of P.items)applyInstruction(P.id,item,'note');
  const byT=new Map(P.items.map(x=>[x.t,x]));
  for(const i of v.issues){const x=byT.get(i.t);if(!x)continue;
    const lo=rnd(x.parts[0]+x.hours[0]*RATE[0],false),hi=Math.max(rnd(x.parts[1]+x.hours[1]*RATE[1],true),lo+10);
    if(x.parts[1]===0&&x.hours[1]===0){i.cost={job:x.job,free:true,note:x.note||'',recall:true};LEDGER.push({id:EV.ids.issue(v.id,i.t),family:'vehicle-issue',scope:v.id,job:x.job,lo:0,hi:0,status:'recall-no-charge',reason:'conditional no-charge recall remedy; recall applicability is a claim, not a price'});priced++;continue}
    const g=EV.priceQualifies(EV.ids.issue(v.id,i.t));LEDGER.push({id:EV.ids.issue(v.id,i.t),family:'vehicle-issue',scope:v.id+' '+i.y.join('-'),job:x.job,lo:Math.max(lo,0),hi,status:g.ok?'shown':'withheld',reason:g.reason||''});
    i.cost=g.ok?{job:x.job,lo:Math.max(lo,0),hi,note:x.note||'',recall:!!x.recall}:{job:x.job,withheld:true,recall:!!x.recall};priced++}
}
if(!SHOW_PRICES)for(const v of V)for(const i of v.issues)delete i.cost;
if(appliedInstructions.size!==instructionMap.size){
  const missed=[...instructionMap.keys()].filter(key=>!appliedInstructions.has(key));
  throw new Error('Unmatched reviewed instructions ('+missed.length+'): '+missed.slice(0,5).join(', '));
}
// ---------- ownership costs (src/own/<id>.json) ----------
let ownN=0;
if(fs.existsSync('src/own'))for(const f of fs.readdirSync('src/own').filter(f=>f.endsWith('.json'))){
  const O=JSON.parse(fs.readFileSync('src/own/'+f,'utf8'));const v=V.find(v=>v.id===O.id);if(!v)continue;
  const order=['oil','front-brakes','rear-brakes','battery','spark-plugs','coolant'];
  const ga=O.annual?EV.priceQualifies(EV.ids.annual(v.id)):null;if(O.annual)LEDGER.push({id:EV.ids.annual(v.id),family:'annual-average',scope:v.id,job:'Average yearly maintenance and repair',lo:Math.round(O.annual.amount/10)*10,hi:Math.round(O.annual.amount/10)*10,status:ga.ok?'shown':'withheld',reason:ga.reason||''});
  v.own={annual:O.annual?(ga.ok?{amount:Math.round(O.annual.amount/10)*10,label:O.annual.label||''}:{withheld:true}):null,
    maint:(O.maint||[]).sort((a,b)=>order.indexOf(a.key)-order.indexOf(b.key)).map(m=>{const lo=rnd(m.parts[0]+m.hours[0]*RATE[0],false),hi=Math.max(rnd(m.parts[1]+m.hours[1]*RATE[1],true),lo+10);
      const el=PT.eligible(m.job,v,null);const g=EV.priceQualifies(EV.ids.maint(v.id,m.job));
      LEDGER.push({id:EV.ids.maint(v.id,m.job),family:'maintenance',scope:v.id,job:m.job,lo,hi,status:el.ok===false?'ineligible':g.ok?'shown':'withheld',reason:el.ok===false?el.reason:(g.reason||'')});
      if(el.ok===false)return null;return g.ok?{job:m.job,every:m.every,note:m.note||'',lo,hi}:{job:m.job,every:m.every,note:m.note||'',withheld:true}}).filter(Boolean)};ownN++}
if(!SHOW_PRICES)for(const v of V)delete v.own;
const CATS=['Warning Lights','Smoke','Leaks','Noises','Smells','Starting Problems','Driving'],ids=new Set();let bad=0;
V.forEach(v=>{if(ids.has(v.id)){console.log('DUP',v.id);bad++}ids.add(v.id);
 if(!/^[a-z0-9-]+$/.test(v.id)||v.years[0]<1996||v.years[1]>2027){console.log('BADV',v.id);bad++}
 v.issues=v.issues.filter(i=>{const ok=i.y&&i.y[0]>=v.years[0]&&i.y[1]<=v.years[1]&&i.y[0]<=i.y[1]&&CATS.includes(i.cat)&&['high','med','low'].includes(i.sev)&&i.t&&i.sym&&i.why&&i.next;if(!ok){console.log('dropped bad issue',v.id,i.t);bad++}return ok})});
V.sort((a,b)=>(a.make+a.model).localeCompare(b.make+b.model));
// Recall queries per model year (src/recall-map.json). Combined labels resolve to the actual NHTSA model(s); every sold year must be covered.
{const RM=fs.existsSync('src/recall-map.json')?JSON.parse(fs.readFileSync('src/recall-map.json','utf8')).models:{};
 for(const v of V){if(RM[v.id])v.rq=RM[v.id].map(r=>({from:r.from,to:r.to,verified:r.verified!==false,queries:r.queries}));
  if(/ \/ /.test(v.model)){for(let y=v.years[0];y<=v.years[1];y++)if(sold(v,y)&&!(v.rq||[]).some(r=>y>=r.from&&y<=r.to)){console.log('RECALL MAP MISSING',v.id,y);bad++}}}}
if (animations) for (const v of V) for (const issue of v.issues) {
  const item = animations.forText(issue.t);
  if (item) issue.animation = { title: item.title, href: animations.link(item) };
}
const data='// Generated by build.js — edit files in src/ instead.\nwindow.VEHICLES='+publicJson(V,'vehicles')+';\n';
fs.writeFileSync('vehicles.js',data);
const thin=V.reduce((a,v)=>{for(let y=v.years[0];y<=v.years[1];y++)if(sold(v,y)&&v.issues.filter(i=>y>=i.y[0]&&y<=i.y[1]).length<2)a++;return a},0);
for(const v of V)for(const i of v.issues)if(firstSold(v,i)===null)console.log('issue only in not-sold years',v.id,i.t,i.y);
console.log(`${priced} issues priced, ${ownN} ownership snapshots`);
console.log(`${V.length} models (${deepN} deepened), ${V.reduce((a,v)=>a+v.issues.length,0)} issues, ${thin} thin year pages${bad?', '+bad+' problems':''}`);

// ---------- symptom guides ----------
const JDIR='src/journeys';const J=[];
for(const f of fs.readdirSync(JDIR).filter(f=>f.endsWith('.json')).sort()){
  const id=f.slice(0,-5);const r=require('child_process').spawnSync('node',['tools/check_journey.js',id,JDIR],{encoding:'utf8'});
  if(r.status!==0){console.log('SKIPPED guide '+id+':\n'+r.stdout);continue}
  J.push(JSON.parse(fs.readFileSync(path.join(JDIR,f),'utf8')));
}
const jids=new Set(J.map(j=>j.id));
J.forEach(j=>{j.related=j.related.filter(r=>jids.has(r)&&r!==j.id)});
fs.mkdirSync('api/_data',{recursive:true});
fs.writeFileSync('api/_data/journeys.json',publicJson(Object.fromEntries(J.map(j=>[j.id,{id:j.id,title:j.title,start:j.start,nodes:j.nodes}])), 'guide email data'));
fs.writeFileSync('api/_data/vehicles-lite.json',publicJson(Object.fromEntries(V.map(v=>[v.id,{name:v.make+' '+v.model,y0:v.years[0],y1:v.years[1]}])), 'vehicle email index'));
const INDEX=J.map(j=>({id:j.id,title:j.title,h1:j.h1,group:j.group,cat:j.cat,syn:j.synonyms}));
// Strict issue->guide links (see src/guide-links.json). Fail the build on a bad pattern or an unknown guide id.
const GLINKS=JSON.parse(fs.readFileSync('src/guide-links.json','utf8'));
{const bad=[];for(const p of GLINKS.not)try{new RegExp(p,'i')}catch(e){bad.push('global: '+p)}
 for(const id of GLINKS.order){const r=GLINKS.guides[id];if(!r){bad.push('order lists '+id+' with no rule');continue}if(!jids.has(id))bad.push('rule for unknown guide '+id);
   for(const p of [...r.any,...(r.not||[])])try{new RegExp(p,'i')}catch(e){bad.push(id+': '+p)}}
 for(const id in GLINKS.guides)if(!GLINKS.order.includes(id))bad.push(id+' missing from order');
 if(bad.length){console.error('guide-links.json problems:\n  '+bad.join('\n  '));process.exit(1)}}
const indexJs='window.GUIDE_INDEX='+publicJson(INDEX,'guide index')+';\nwindow.GUIDE_LINKS='+JSON.stringify({not:GLINKS.not,order:GLINKS.order,guides:GLINKS.guides})+';\n';
console.log(`${J.length} symptom guides`);

// ---------- output ----------
const tpl=fs.readFileSync('src/template.html','utf8')
  .replace('{{ANIMATIONLINK}}', animations ? ' · <a href="/repair-animations/">Repair animations</a>' : '')
  .replace(/{{NMODELS}}/g,String(V.length));
fs.rmSync('dist',{recursive:true,force:true});fs.mkdirSync('dist');
// Phones only download what a page needs: a small vehicle list everywhere, full data per vehicle on demand.
{const lite=V.map(v=>{const o={};for(const k of Object.keys(v))if(k!=='issues'&&k!=='own')o[k]=v[k];o.issues=[];o.n=v.issues.length;return o});
 fs.writeFileSync('dist/vehicles.js','// Generated by build.js. Full per-vehicle data lives in /data/v/<id>.json\nwindow.VEHICLES='+publicJson(lite,'vehicle index')+';\n'+
  "(function(){const c={};window.VS_LOAD=function(id){const v=(window.VEHICLES||[]).find(x=>x.id===id);if(!v)return Promise.resolve(null);if(v._full)return Promise.resolve(v);"+
  "return c[id]=c[id]||fetch('/data/v/'+id+'.json').then(r=>r.json()).then(d=>{Object.assign(v,d,{_full:true});return v}).catch(()=>v)}})();\n");
 fs.mkdirSync('dist/data/v',{recursive:true});for(const v of V)fs.writeFileSync('dist/data/v/'+v.id+'.json',publicJson({issues:v.issues,own:v.own||null,engines:v.engines||[]},'vehicle '+v.id));}fs.writeFileSync('dist/guide-index.js',indexJs);
for(const f of ['app.js','guide.js','site.css','pdf.js','powertrain.js'])fs.copyFileSync('src/'+f,'dist/'+f);
fs.mkdirSync('dist/vendor',{recursive:true});fs.copyFileSync('src/vendor/jspdf.umd.min.js','dist/vendor/jspdf.umd.min.js');
fs.mkdirSync('dist/email',{recursive:true});for(const f of fs.readdirSync('src/email'))fs.copyFileSync('src/email/'+f,'dist/email/'+f);
// ---------- warning lights data (src/lights.js + optional depth in src/lights-deep.json) ----------
const LIGHTS=require('./src/lights.js');
const RESETS=fs.existsSync('src/resets.json')?JSON.parse(fs.readFileSync('src/resets.json','utf8')):{};
const LDEEP=fs.existsSync('src/lights-deep.json')?JSON.parse(fs.readFileSync('src/lights-deep.json','utf8')):{};
const LCOL={red:'#FF5A5F',amber:'#FFB020',green:'#34C77B',blue:'#5AB0FF'};
const LSEV={stop:["Stop driving as soon as it's safe","high"],soon:["Get it checked soon","med"],check:["Check it when you can","info"],info:["Information only","low"]};
const LCOLNAME={red:'Red: serious, act now',amber:'Amber/yellow: check soon',green:'Green: system on',blue:'Blue: information'};
const lIcon=(l,size)=>`<svg class="licon" width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" style="color:${LCOL[l.color]}" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${l.icon}</svg>`;
// the row of most-looked-up lights shown high on the home page
const ROWIDS=['check-engine-light','oil-pressure-light','engine-temperature-light','battery-light','brake-warning-light','tire-pressure-light','abs-light','airbag-light','service-light','oil-change-light','traction-control-light','master-warning-light'];
const escA=t=>String(t).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
const escH=t=>String(t==null?'':t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const VERIFY=JSON.parse(fs.readFileSync('src/verify.json','utf8'));
const VMETA=(VERIFY.google?`<meta name="google-site-verification" content="${VERIFY.google}">`:'')+(VERIFY.bing?`<meta name="msvalidate.01" content="${VERIFY.bing}">`:'');
const LIGHTSROW=(()=>{const pick=ROWIDS.map(id=>LIGHTS.find(l=>l.id===id)).filter(Boolean);
 return `<div class="lrow dashboard-lights">${pick.map(l=>`<a class="lr" href="/warning-lights/${l.id}/">${lIcon(l,56)}<b>${escH(l.name.replace(/ \(.*\)$/,'').replace(/ light$/i,'').replace(/ warning$/i, l.id === 'master-warning-light' ? ' warning' : ''))}</b><span class="lsev ${LSEV[l.sev][1]}">${escH(LSEV[l.sev][0])}</span></a>`).join('')}<a class="lr lr-all" href="/warning-lights/"><b>All lights</b><span>Red, amber, green and blue</span></a></div>`})();
const scripts=['vehicles.js','guide-index.js','guide.js','powertrain.js','app.js'].map(f=>f==='vehicles.js'?data:f==='guide-index.js'?indexJs:fs.readFileSync('src/'+f,'utf8'));

// one browser instance renders every vehicle page
const shell=tpl.replace(/{{[A-Z]+}}/g,'').replace(/<script src="\/[a-z-]+\.js"><\/script>\n?/g,'');
const R=new JSDOM(shell.replace('</body>',()=>scripts.map(s=>'<script>'+s+'</script>').join('')+'</body>'),{runScripts:'dangerously',url:SITE+'/vehicles/x/'});
R.window.fetch=()=>new Promise(()=>{});R.window.scrollTo=()=>{};R.window.HTMLElement.prototype.scrollIntoView=()=>{};
const RW=R.window;

function write(p,html){const f='dist'+p+'index.html';fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,html)}
const PAGEHASH={};
function page(p,title,desc,{inner='',pageData='',home=false}={}){
  const h=tpl.replace(/{{TITLE}}/g,escA(title)).replace(/{{DESC}}/g,escA(desc)).replace(/{{CANON}}/g,SITE+p).replace('{{CRED}}',escH(CRED))
    .replace(/{{HOMEH1}}/g,home?'h1':'p class="hh1"').replace(/{{HOMEH1C}}/g,home?'h1':'p').replace('{{HOMEHIDE}}',home?'':' style="display:none"').replace('{{VMETA}}',()=>VMETA).replace('{{HOMEHIDE2}}',home?'':' style="display:none"').replace('{{LIGHTSROW}}',()=>home?LIGHTSROW:'').replace('{{VEHSTYLE}}',home?'display:none;':'')
    .replace('{{PAGEDATA}}',()=>pageData).replace('{{VEHHTML}}',()=>inner);
  // Fingerprint of this page's own content (not the shared template), used for its sitemap lastmod date.
  PAGEHASH[p]=createHash('sha1').update(JSON.stringify([title,desc,inner,pageData,home])).digest('hex').slice(0,16);
  write(p,h);return p;
}
const urls=[];
const animationScript = '<script defer src="/repair-animations.js"></script>';
if (animations) {
  fs.copyFileSync('src/animations/browser.js', 'dist/repair-animations.js');
  const directory = animations.directory();
  const pageData = '<script type="application/json" id="mv-data">' +
    JSON.stringify(directory.data).replace(/</g,'\\u003c') + '</script>' + animationScript;
  urls.push(page('/repair-animations/', 'Repair Animations | VehicleSymptoms.com',
    'Browse MotoVisuals animations to see how vehicle parts and systems work.', {inner: directory.html, pageData}));
}
const sound = require('./src/sounds/page.js');
if (!J.some(j => j.id === sound.guide)) throw new Error('Missing guide for the car sound recording');
urls.push(page('/sounds/', 'Car Sounds | VehicleSymptoms.com', 'Listen to a real whir inside a moving car and open the matching symptom guide.', {inner: sound.html}));
fs.copyFileSync('src/sounds/'+sound.clip, 'dist/sounds/'+sound.clip);
const HOMEFAQ=[...fs.readFileSync('src/template.html','utf8').matchAll(/<details class="faq"><summary>(.*?)<\/summary><p>(.*?)<\/p><\/details>/g)].map(m=>({'@type':'Question',name:m[1],acceptedAnswer:{'@type':'Answer',text:m[2]}}));
const homeLd='<script type="application/ld+json">'+JSON.stringify([{'@context':'https://schema.org','@type':'WebSite',name:'VehicleSymptoms.com',url:SITE+'/'},{'@context':'https://schema.org','@type':'FAQPage',mainEntity:HOMEFAQ}]).replace(/</g,'\\u003c')+'</script>\n';
urls.push(page('/',"What's Wrong With My Car? Free Car Symptom Help | VehicleSymptoms.com",'Free, plain-English help for car problems: what to check, how urgent it may be and what to ask your mechanic. From people who fix cars.',{home:true,pageData:homeLd}));

function sourceCredits(sources){return publishers(sources).map(escH).join(' · ')||'Editorial evidence on file'}
// symptom guide pages
const GL={start:"Won't start",light:"Warning light",noise:"Noise",shake:"Shaking",leaksmell:"Leak, smell or smoke",hot:"Running hot",drive:"Driving & handling"};
const UL={stop:["Stop — don't drive it","high"],soon:["Get it checked in the next few days","med"],check:["Book a check when convenient","info"],diy:["Safe to check yourself first","low"]};
for(const j of J){
  const results=Object.values(j.nodes).filter(n=>n.result).map(n=>n.result);
  const firstQ=j.nodes[j.start];
  const animation = animations?.contextual(animations.guide.get(j.id)) || '';
  const inner=`<div class="crumb"><a href="/">Home</a> › <a href="/symptoms/">Symptom guides</a> › ${escH(j.title)}</div>
<div class="ghead"><div class="eyebrow">${escH(GL[j.group])}</div><h1>${escH(j.h1)}</h1><p class="sub">${escH(j.intro)}</p></div>
${j.safety.length?`<div class="safety"><b>Stop and get help right away if:</b><ul>${j.safety.map(s=>`<li>${escH(s)}</li>`).join('')}</ul></div>`:''}
${j.id===sound.guide?`<p><a href="/sounds/#${sound.section}">Hear a whir inside a moving car</a></p>`:''}
${BYLINE}<div id="guideApp"><div class="flow card"><div class="step-n">Question 1</div><h2 class="fq">${escH(firstQ.q)}</h2>${firstQ.help?`<p class="help">${escH(firstQ.help)}</p>`:''}<div class="opts">${firstQ.opts.map(o=>`<button class="opt">${escH(o.a)}</button>`).join('')}</div></div></div>
${animation}
<div class="fullguide"><h2 style="font-size:20px">Full guide: every possible outcome</h2><p class="muted" style="margin-top:-4px">Prefer to read it all? Here's every result this guide can reach.</p>
${results.map(r=>`<details><summary>${escH(r.title)}<span class="urg ${UL[r.urgency][1]}">${UL[r.urgency][0]}</span></summary><div class="fg"><p><b>What to do now:</b> ${escH(r.now)}</p><p><b>Why:</b> ${escH(r.why)}</p><p><b>Possible causes:</b> ${r.causes.map(c=>escH(c.name)).join('; ')}.</p><p><b>A shop will usually test:</b> ${r.confirm.shop.map(escH).join('; ')}.</p></div></details>`).join('\n')}
${j.related.length?`<h2 style="font-size:20px;margin-top:26px">Related guides</h2><div class="glist">${j.related.map(id=>{const r=J.find(x=>x.id===id);return`<a class="gcard" href="/symptoms/${r.id}/"><b>${escH(r.title)}</b><span>${escH(r.h1)}</span></a>`}).join('')}</div>`:''}
<p class="srcs" style="margin-top:22px">Sources and references: ${sourceCredits(j.sources)}</p>
<div class="trust" style="margin-top:18px">This guide helps you understand what may be going on and how urgent it is. It doesn't replace an in-person inspection.</div></div>`;
  urls.push(page(`/symptoms/${j.id}/`,`${j.h1.replace(/\?$/,'')}? Causes & What to Do | VehicleSymptoms.com`.replace('??','?'),j.metaDesc,{inner,pageData:`${animation ? animationScript : ''}<script>window.JOURNEY=${publicJson(j,'guide '+j.id).replace(/</g,'\\u003c')};</script>\n`}));
}
// ---------- trouble codes (src/codes/*.json) ----------
const CODES=[];const cseen=new Set();
if(fs.existsSync('src/codes'))for(const f of fs.readdirSync('src/codes').filter(f=>f.endsWith('.json')).sort()){
  for(const c of JSON.parse(fs.readFileSync('src/codes/'+f,'utf8'))){if(cseen.has(c.code))continue;cseen.add(c.code);CODES.push(c)}}
CODES.sort((a,b)=>a.code.localeCompare(b.code));
// vehicles whose known problems mention a code
const codeVeh={};
for(const v of V)for(const i of v.issues){const t=[i.t,i.sym,i.why,i.next].join(' ');for(const m of new Set(t.match(/\b[PBCU][0-3][0-9A-F]{3}\b/g)||[])){(codeVeh[m]=codeVeh[m]||[]).push({v,i})}}
const CURG={stop:["Stop driving as soon as it's safe. This can cause damage or be unsafe.","high"],soon:["Get it checked in the next few days","med"],check:["Book a check when convenient","info"]};
const cpr=k=>{const lo=rnd(k.parts[0]+k.hours[0]*RATE[0],false),hi=Math.max(rnd(k.parts[1]+k.hours[1]*RATE[1],true),lo+10);return '$'+lo.toLocaleString('en-US')+'–$'+hi.toLocaleString('en-US')};
const WH='Insufficient verified pricing for this vehicle and repair';
// Code pages: a general repair range is shown only with a qualifying evidence pair; otherwise the price is withheld.
for(const c of CODES)if(c.cost){const lo=rnd(c.cost.parts[0]+c.cost.hours[0]*RATE[0],false),hi=Math.max(rnd(c.cost.parts[1]+c.cost.hours[1]*RATE[1],true),lo+10),g=EV.priceQualifies(EV.ids.code(c.code));
  LEDGER.push({id:EV.ids.code(c.code),family:'code-general',scope:'general (all vehicles)',job:c.cost.job,lo,hi,status:g.ok?'shown':'withheld',reason:g.reason||''});c.costOk=g.ok}
if(!SHOW_PRICES)for(const c of CODES)delete c.cost;
const famName=c=>({P:'Powertrain',B:'Body',C:'Chassis',U:'Network'})[c[0]];
const JT=Object.fromEntries(J.map(j=>[j.id,j]));
for(let k=0;k<CODES.length;k++){const c=CODES[k],low=c.code.toLowerCase(),u=CURG[c.sev];
  const fam=CODES.filter(x=>x.code.slice(0,3)===c.code.slice(0,3)&&x.code!==c.code).slice(0,12);
  const veh=(codeVeh[c.code]||[]).slice(0,10);const g=c.guide&&JT[c.guide];
  const drive=c.drive||(c.sev==='stop'?'Stop driving as soon as it is safe and have it checked before going further; this problem can cause damage or affect safety.':c.sev==='soon'?'If the check engine light flashes, the engine runs rough, overheats, loses power or stalls, pull over when it is safe and get help. Otherwise get it checked in the next few days and drive gently until then.':'Usually you can keep driving while you book a check. If other warning lights come on, or the car starts running or shifting differently, get it checked sooner.');
  const testFirst=c.test_first||'A shop should confirm the fault with a scan tool and a few tests before replacing parts. The code points to where to test, not to a confirmed failed part.';
  const faq=[{q:`What does ${c.code} mean?`,a:c.plain},{q:`Can I drive with code ${c.code}?`,a:(c.urgent_if?c.urgent_if+' Otherwise: ':'')+drive},{q:`What causes ${c.code}?`,a:'Common possibilities to test include: '+c.causes.slice(0,4).map(x=>x.name.toLowerCase()).join('; ')+'. A shop should confirm the cause before replacing parts.'}];
  const ld='<script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@type':'FAQPage',mainEntity:faq.map(f=>({'@type':'Question',name:f.q,acceptedAnswer:{'@type':'Answer',text:f.a}}))}).replace(/</g,'\\u003c')+'</script>\n';
  const inner=`<div class="crumb"><a href="/">Home</a> › <a href="/codes/">Code lookup</a> › ${c.code}</div>
<div class="ghead"><div class="eyebrow">${escH(famName(c.code))} code · ${escH(c.sys)}</div><h1><span class="code-big">${c.code}</span> ${escH(c.title)}</h1></div>
${c.urgent_if?`<div class="urg-first" role="alert"><b>Stop-now condition.</b> ${escH(c.urgent_if)}</div>`:''}<div class="urg ${u[1]}"><b>How urgent?</b> ${c.urgent_if?'Otherwise: ':''}${escH(u[0])}</div>
${BYLINE}<div id="codeMy"></div>
<section class="card csec"><h2>What it means</h2><p class="lead2">${escH(c.plain)}</p></section>
<section class="card csec drivebox" style="border-left-color:${c.sev==='stop'||c.urgent_if?'#C62F37':c.sev==='soon'?'#D08700':'#0B63CE'}"><h2>Can I keep driving?</h2>${c.urgent_if?`<p><b>${escH(c.urgent_if)}</b></p><p>Otherwise: ${escH(drive)}</p>`:`<p>${escH(drive)}</p>`}</section>
<section class="card csec"><h2>What to test before replacing parts</h2><p>${escH(testFirst)}</p><ol class="nums">${c.checks.map(x=>`<li>${escH(x)}</li>`).join('')}</ol></section>
<div class="cgrid">
<section class="card csec"><h2>Signs you may notice</h2><ul class="dots">${c.symptoms.map(x=>`<li>${escH(x)}</li>`).join('')}</ul></section>
<section class="card csec"><h2>Possible causes</h2><p class="muted" style="margin:0 0 6px">Most likely first. Directions for testing, not confirmed failures.</p><ul class="causes2">${c.causes.map(x=>`<li><span class="ctag ${x.how}">${x.how==='common'?'Common':'Possible'}</span>${escH(x.name)}</li>`).join('')}</ul></section>
</div>
<section class="card csec"><h2>Typical repair once the cause is confirmed</h2><p>${escH(c.fix)}</p>${c.cost&&c.costOk?`<div class="cost"><div class="cost-top"><span class="cost-l">General estimate (all vehicles)</span><span class="cost-v">${cpr(c.cost)}</span></div><div class="cost-job">${escH(c.cost.job)}</div></div><p class="pg-disc" style="margin-top:12px"><b>Estimate only, not a quote.</b> General U.S. reference across many vehicles, not specific to yours. Diagnosis is usually charged separately.</p>`:c.cost?`<div class="cost cost-wh"><div class="cost-top"><span class="cost-l">Repair cost</span><span class="cost-v sm">${WH}</span></div><div class="cost-job">${escH(c.cost.job)}. <a href="/price-check/?repair=${encodeURIComponent(c.cost.job)}#pcApp">Prepare an itemized shop request</a>.</div></div>`:''}</section>
${c.examples&&c.examples.length?`<section class="card csec"><h2>Where it shows up</h2><ul class="dots">${c.examples.map(x=>`<li>${escH(x)}</li>`).join('')}</ul></section>`:''}
${veh.length?`<section class="card csec"><h2>Known on these vehicles</h2><div class="glist">${veh.map(({v,i})=>`<a class="gcard" href="/vehicles/${v.id}/${firstSold(v,i)||''}${firstSold(v,i)?'/':''}"><b>${escH(v.make+' '+v.model)} ${i.y[0]===i.y[1]?i.y[0]:i.y[0]+'–'+i.y[1]}</b><span>${escH(i.t)}</span></a>`).join('')}</div></section>`:''}
${g?`<a class="walk big" href="/symptoms/${g.id}/">Walk through it step by step: ${escH(g.title)} →</a>`:''}
<section class="csec"><h2 style="font-size:18px">Common questions</h2>${faq.map(f=>`<details class="faq"><summary>${escH(f.q)}</summary><p>${escH(f.a)}</p></details>`).join('')}</section>
${fam.length?`<section class="csec"><h2 style="font-size:18px">Related codes</h2><div class="codechips">${fam.map(x=>`<a href="/codes/${x.code.toLowerCase()}/"><b>${x.code}</b> ${escH(x.title)}</a>`).join('')}</div></section>`:''}
<div class="trust">Trouble codes point to where a problem was detected, not always to the failed part. A scan and a few tests confirm the cause before parts are replaced. This is a general guide, not a diagnosis.</div>`;
  urls.push(page('/codes/'+low+'/',`${c.code} Code: ${c.title} — Meaning, Causes & Fixes | VehicleSymptoms.com`.slice(0,140),(c.urgent_if?`${c.code}: flashing check engine light or hard shaking means get off the road. ${c.plain}`:`${c.code} means: ${c.plain}`).slice(0,165),{inner,pageData:ld}));
}
if(CODES.length){
  const groups={};for(const c of CODES){const k=c.code.slice(0,3);(groups[k]=groups[k]||[]).push(c)}
  const common=CODES.filter(c=>c.common);
  const idx='window.CODE_INDEX='+JSON.stringify(CODES.map(c=>[c.code,c.title,c.sys])).replace(/</g,'\\u003c')+';';
  fs.writeFileSync('dist/codes-index.js',idx);
  urls.push(page('/codes/','Car Trouble Code Lookup (OBD-II): What Every Code Means | VehicleSymptoms.com','Look up any OBD-II trouble code like P0420 or P0300. Plain-English meaning, how urgent it is, common causes, and what to check first.',{pageData:'<script src="/codes-index.js"></script>\n',inner:`<div class="crumb"><a href="/">Home</a> › Code lookup</div>
<div class="ghead"><div class="eyebrow">Code lookup</div><h1>What does your trouble code mean?</h1><p class="sub">Type the code from your scanner or parts-store scan, like <b>P0420</b> or <b>P0300</b>. You'll get the meaning in plain English, how urgent it is, the likely causes and what to check first.</p></div>
<form class="codesearch" id="codeForm" autocomplete="off"><input id="codeQ" type="search" placeholder="Enter a code, e.g. P0420, or a word like misfire" aria-label="Trouble code"><button class="btn" type="submit">Look it up</button></form>
<div id="codeRes" class="glist" style="margin-top:12px"></div>
<p class="muted" style="font-size:14px">${CODES.length.toLocaleString('en-US')} codes so far: the universal codes every car uses. Manufacturer-specific codes are being added.</p>
<section class="csec"><h2>Most common codes</h2><div class="codechips">${common.map(c=>`<a href="/codes/${c.code.toLowerCase()}/"><b>${c.code}</b> ${escH(c.title)}</a>`).join('')}</div></section>
<section class="csec"><h2>Browse all codes</h2>${Object.entries(groups).map(([k,l])=>`<details class="mk"><summary>${k}xx codes <span>${l.length} codes</span></summary><div class="codechips">${l.map(c=>`<a href="/codes/${c.code.toLowerCase()}/"><b>${c.code}</b> ${escH(c.title)}</a>`).join('')}</div></details>`).join('')}</section>
<div class="trust">A code tells you which system detected a problem. It doesn't always name the failed part, so a few checks before buying parts can save money.</div>`}));
}
console.log(`${CODES.length} trouble codes`);

// ---------- warning lights: pages (data and helpers are defined above page()) ----------
const SEE={
 'oil-pressure-light':['oil-level-light','oil-change-light'],'oil-level-light':['oil-pressure-light','oil-change-light'],'oil-change-light':['oil-level-light','oil-pressure-light','maintenance-required-light'],
 'maintenance-required-light':['oil-change-light','service-light','wrench-light'],'service-light':['maintenance-required-light','oil-change-light','wrench-light'],'wrench-light':['service-light','check-engine-light'],
 'brake-warning-light':['parking-brake-light','brake-pad-wear-light','abs-light'],'parking-brake-light':['brake-warning-light','electronic-parking-brake-light'],'electronic-parking-brake-light':['parking-brake-light','brake-warning-light'],'brake-pad-wear-light':['brake-warning-light','abs-light'],
 'abs-light':['brake-warning-light','traction-control-light'],'traction-control-light':['stability-control-off-light','slip-indicator-light','esp-bas-light'],'stability-control-off-light':['traction-control-light','slip-indicator-light'],'slip-indicator-light':['traction-control-light','stability-control-off-light'],'esp-bas-light':['traction-control-light','abs-light'],
 'check-engine-light':['exhaust-emission-light','wrench-light','epc-light'],'exhaust-emission-light':['check-engine-light','dpf-light'],'epc-light':['check-engine-light','wrench-light'],
 'def-light':['dpf-light','water-in-fuel-light'],'dpf-light':['def-light','exhaust-emission-light'],'water-in-fuel-light':['def-light','check-engine-light'],
 'engine-temperature-light':['coolant-level-light'],'coolant-level-light':['engine-temperature-light'],
 'master-warning-light':['check-engine-light','door-open-light'],'washer-fluid-light':['low-fuel-light'],'key-battery-light':['security-light'],'security-light':['key-battery-light']};
const codeSet=new Set(CODES.map(c=>c.code));
const money=n=>'$'+Number(n).toLocaleString('en-US');
const rngC=(lo,hi)=>lo===0&&hi===0?'No charge':money(lo)+'–'+money(hi);
// Warning-light cause prices and diagnosis fees go through the same evidence gate.
const lPrice=(lid,c)=>{const id=EV.ids.light(lid,c.name),g=EV.priceQualifies(id);LEDGER.push({id,family:'light-cause',scope:'general (all vehicles)',job:c.name,lo:c.lo,hi:c.hi,status:g.ok?'shown':'withheld',reason:g.reason||''});return g.ok?rngC(c.lo,c.hi):'Price not verified'};
const lDiag=(lid,d)=>{const id=EV.ids.lightDiag(lid),g=EV.priceQualifies(id);LEDGER.push({id,family:'light-diagnosis',scope:'general (all vehicles)',job:'Diagnose '+lid,lo:d[0],hi:d[1],status:g.ok?'shown':'withheld',reason:g.reason||''});return g.ok?rngC(d[0],d[1]):null};
for(const l of LIGHTS){const u=LSEV[l.sev];const gs=l.guides.filter(g=>JT[g]).map(g=>JT[g]);const cs=l.codes.filter(c=>codeSet.has(c));
  const d=LDEEP[l.id]||{};
  const animation = animations?.contextual(animations.guide.get(l.id)) || '';
  const faq=[{q:`What does the ${l.name.toLowerCase()} mean?`,a:l.meaning},{q:`Can I drive with the ${l.name.toLowerCase()} on?`,a:l.drive},...(d.faqs||[])];
  const ld='<script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@type':'FAQPage',mainEntity:faq.map(f=>({'@type':'Question',name:f.q,acceptedAnswer:{'@type':'Answer',text:f.a}}))}).replace(/</g,'\\u003c')+'</script>\n';
  const inner=`<div class="crumb"><a href="/">Home</a> › <a href="/warning-lights/">Warning lights</a> › ${escH(l.name)}</div>
<div class="lhead"><div class="lbig" style="border-color:${LCOL[l.color]}55">${lIcon(l,72)}</div><div><div class="eyebrow">${escH(LCOLNAME[l.color])}</div><h1>${escH(l.name)}</h1>${l.aka.length?`<p class="muted" style="margin:4px 0 0">Also called: ${l.aka.map(escH).join(', ')}</p>`:''}</div></div>
<div class="urg ${u[1]}"><b>How urgent?</b> ${escH(u[0])}</div>
${BYLINE}<section class="card csec"><h2>What it means</h2><p class="lead2">${escH(l.meaning)}</p>${d.look?`<p class="lmuted">${escH(d.look)}</p>`:''}</section>
<section class="card csec drivebox" style="border-left-color:${LCOL[l.color]}"><h2>Can I keep driving?</h2><p>${escH(l.drive)}</p>${d.flash?`<p class="lflash"><b>If it's flashing or blinking:</b> ${escH(d.flash)}</p>`:''}</section>
<div class="cgrid"><section class="card csec"><h2>What to do now</h2><ol class="nums">${l.todo.map(x=>`<li>${escH(x)}</li>`).join('')}</ol></section>
<section class="card csec"><h2>Common causes</h2><ul class="dots">${l.causes.map(x=>`<li>${escH(x)}</li>`).join('')}</ul></section></div>
${animation}
${d.diy&&d.diy.length?`<section class="card csec ldiy"><div class="pg-head"><h2>Checks you can do yourself</h2><span class="pg-badge">Safe, no tools in most cases</span></div>
<p class="pg-sub">Do these with the car parked and the engine off and cool. If anything looks or smells hot, wait.</p>
${d.diy.map((x,i)=>`<div class="diy"><div class="diy-n">${i+1}</div><div><b>${escH(x.t)}</b><p>${escH(x.how)}</p><span class="diy-m">${escH(x.mins)} · ${escH(x.tools)}</span></div></div>`).join('')}
<p class="lsoon-note">Step-by-step repair walkthroughs for the fixes below are on the way.</p></section>`:''}
${d.dont&&d.dont.length?`<section class="card csec ldont"><h2>What not to do</h2><ul class="xs">${d.dont.map(x=>`<li>${escH(x)}</li>`).join('')}</ul></section>`:''}
${d.causes2&&d.causes2.length?`<section class="card csec"><div class="pg-head"><h2>What it usually turns out to be</h2></div>
<p class="pg-sub">Most likely first.${SHOW_PRICES?' Prices are typical US parts-and-labor totals for that repair, not a quote for your vehicle.':''}</p>
${d.causes2.map(c=>`<div class="c2"><div class="c2-h"><b>${escH(c.name)}</b>${SHOW_PRICES?`<span class="c2-p">${lPrice(l.id,c)}</span>`:''}</div><p><span class="c2-l">How you can tell</span> ${escH(c.tell)}</p><p><span class="c2-l">The repair</span> ${escH(c.fix)}</p></div>`).join('')}
${SHOW_PRICES&&d.diag&&lDiag(l.id,d.diag)?`<p class="lsoon-note">A shop usually charges ${lDiag(l.id,d.diag)} just to diagnose this light, and many put that toward the repair.</p>`:''}</section>`:''}
${d.shop?`<section class="card csec"><h2>What a shop will do</h2><p>${escH(d.shop)}</p></section>`:''}
${d.reset?`<section class="card csec lreset" id="reset"><h2>How to reset this light</h2><p>${escH(d.reset.how)}</p>${d.reset.note?`<p class="lmuted">${escH(d.reset.note)}</p>`:''}
${d.reset.real?(Object.keys(RESETS).length&&/oil|service|maint|tire|tyre/i.test(l.id)?`<div class="lsoon"><p class="eyebrow">Step by step</p><b>Pick your make for the button sequence</b><div class="mkrow">${Object.keys(RESETS).sort((a,b)=>RESETS[a].make.localeCompare(RESETS[b].make)).map(m=>`<a href="/warning-lights/reset/${m}/">${escH(RESETS[m].make)}</a>`).join('')}</div><p class="lsoon-note">Exact steps for every single year and model are still being added. If your make isn't here yet, your owner's manual has the sequence.</p></div>`:`<div class="lsoon"><p class="eyebrow">Coming soon</p><b>Reset steps for your exact vehicle</b><p>We're building the button-by-button reset for each year, make and model. Tell us what you drive and it will be here when it's ready.</p><a class="btn btn-ghost" href="/#vehicle">Pick my vehicle</a></div>`):''}</section>`:''}
${gs.length?`<section class="csec"><h2 style="font-size:18px">Walk through it step by step</h2><div class="glist">${gs.map(g=>`<a class="gcard" href="/symptoms/${g.id}/"><b>${escH(g.title)}</b><span>${escH(g.h1)}</span></a>`).join('')}</div></section>`:''}
${cs.length?`<section class="csec"><h2 style="font-size:18px">Trouble codes often stored with this light</h2><div class="codechips">${cs.map(c=>{const x=CODES.find(y=>y.code===c);return `<a href="/codes/${c.toLowerCase()}/"><b>${c}</b> ${escH(x.title)}</a>`}).join('')}</div></section>`:''}
<section class="csec"><h2 style="font-size:18px">Common questions</h2>${faq.map((f,i)=>`<details class="faq"${i===0?' open':''}><summary>${escH(f.q)}</summary><p>${escH(f.a)}</p></details>`).join('')}</section>
${d.src&&d.src.length?`<p class="lsrc">Sources: ${sourceCredits(d.src)}</p>`:''}
${(SEE[l.id]||[]).length?`<section class="csec"><h2 style="font-size:18px">Not your light? These get mixed up with it</h2><div class="lrow">${(SEE[l.id]||[]).map(x=>LIGHTS.find(y=>y.id===x)).filter(Boolean).map(x=>`<a class="lr" href="/warning-lights/${x.id}/">${lIcon(x,34)}<b>${escH(x.name.replace(/ (warning )?light$/i,''))}</b><span class="lsev ${LSEV[x.sev][1]}">${escH(LSEV[x.sev][0])}</span></a>`).join('')}</div></section>`:''}
<div class="trust">Symbols vary a little between makes. Your owner's manual shows the exact lights for your vehicle. This is a general guide, not a diagnosis.</div>`;
  urls.push(page('/warning-lights/'+l.id+'/',`${l.name}: What It Means & Can You Drive? | VehicleSymptoms.com`,`${l.meaning} ${l.drive}`.slice(0,165),{inner,pageData:ld+(animation ? animationScript : '')}));
}
const lcard=l=>`<a class="lcard c-${l.color}" href="/warning-lights/${l.id}/" data-c="${l.color}">${lIcon(l,44)}<b>${escH(l.name.replace(/ \(.*\)$/,''))}</b><span class="lsev ${LSEV[l.sev][1]}">${escH(LSEV[l.sev][0])}</span></a>`;
urls.push(page('/warning-lights/','Dashboard Warning Lights: What Each Light Means | VehicleSymptoms.com','Every common dashboard warning light explained: what it means, whether you can keep driving, and what to do now. Red, amber, green and blue lights.',{inner:`<div class="crumb"><a href="/">Home</a> › Warning lights</div>
<div class="ghead"><div class="eyebrow">Warning lights</div><h1>Which light is on?</h1><p class="sub">Tap the symbol that matches your dashboard. Each light tells you what it means, whether it's safe to keep driving, what you can check yourself, what the repair usually costs and how to reset it when resetting is the right thing to do.</p></div>
<div class="lkey"><span><i style="background:#FF5A5F"></i>Red: serious, act now</span><span><i style="background:#FFB020"></i>Amber: check soon</span><span><i style="background:#34C77B"></i>Green or blue: information</span></div>
<div class="codesearch"><input id="lsearch" type="search" placeholder="Search a light by name, like &quot;oil&quot; or &quot;ABS&quot;" aria-label="Search warning lights"></div>
<div class="lfilter" id="lfilter"><button class="on" data-c="all">All</button><button data-c="red">Red</button><button data-c="amber">Amber</button><button data-c="info">Green / blue</button></div>
<div class="lgrid" id="lgrid">${[...LIGHTS].sort((a,b)=>{const r={stop:0,soon:1,check:2,info:3};return r[a.sev]-r[b.sev]||a.name.localeCompare(b.name)}).map(lcard).join('')}</div>
<p class="lnone" id="lnone" hidden>No light matches that. Try a shorter word, or browse the symbols above.</p>
${LIGHTS.some(l=>(LDEEP[l.id]||{}).reset&&LDEEP[l.id].reset.real)?`<section class="csec"><h2 style="font-size:18px">Service and reminder lights you can reset</h2><p class="pg-sub">These come on by mileage or time, not because something broke. Once the work is done they are meant to be reset. ${Object.keys(RESETS).length?`<a href="/warning-lights/reset/">Reset steps by make</a>.`:''}</p><div class="glist">${LIGHTS.filter(l=>(LDEEP[l.id]||{}).reset&&LDEEP[l.id].reset.real).map(l=>`<a class="gcard" href="/warning-lights/${l.id}/#reset"><b>${escH(l.name)}</b><span>How to reset it</span></a>`).join('')}</div></section>`:''}
<p class="muted" style="margin-top:18px;font-size:14px">Several lights on at once, or the whole dash lit up? See <a href="/symptoms/dashboard-lights-all-on/" style="color:var(--blue2)">all dashboard lights on</a>. Got a code from a scanner? Use <a href="/codes/" style="color:var(--blue2)">Code lookup</a>.</p>`}));
console.log(`${LIGHTS.length} warning lights`);
// ---------- reset pages (src/resets.json) ----------
if(Object.keys(RESETS).length){
  const mkeys=Object.keys(RESETS).sort((a,b)=>RESETS[a].make.localeCompare(RESETS[b].make));
  const varBlock=(s,title)=>s?`<section class="card csec"><h2>${escH(title)}</h2>${s.variants.map((x,i)=>`<div class="rvar"><div class="rv-h"><span class="rv-n">${i+1}</span><b>${escH(x.when)}</b></div><ol class="nums">${x.steps.map(t=>`<li>${escH(t)}</li>`).join('')}</ol>${x.note?`<p class="lmuted">${escH(x.note)}</p>`:''}</div>`).join('')}${s.src&&s.src.length?`<p class="lsrc">Sources: ${sourceCredits(s.src)}</p>`:''}</section>`:'';
  for(const m of mkeys){const r=RESETS[m];const models=V.filter(v=>v.make===r.make);
    const faq=[{q:`How do I reset the oil change light on a ${r.make}?`,a:(r.oil&&r.oil.variants[0]?r.oil.variants[0].steps.join(' '):'')},
               {q:`How do I reset the tire pressure light on a ${r.make}?`,a:(r.tpms&&r.tpms.variants[0]?r.tpms.variants[0].steps.join(' '):'')}].filter(f=>f.a);
    const ld='<script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@type':'FAQPage',mainEntity:faq.map(f=>({'@type':'Question',name:f.q,acceptedAnswer:{'@type':'Answer',text:f.a}}))}).replace(/</g,'\\u003c')+'</script>\n';
    const inner=`<div class="crumb"><a href="/">Home</a> › <a href="/warning-lights/">Warning lights</a> › <a href="/warning-lights/reset/">Reset a light</a> › ${escH(r.make)}</div>
<div class="ghead"><div class="eyebrow">Reset a reminder light</div><h1>How to reset the oil change and tire pressure lights on a ${escH(r.make)}</h1>
<p class="sub">These two lights are reminders, not faults. Do the work first, then reset. Everything else on your dash is a warning, and clearing it does not fix anything.</p></div>
${BYLINE}
${varBlock(r.oil,'Oil change or maintenance reminder')}
${varBlock(r.tpms,'Tire pressure (TPMS) light')}
${r.notes?`<section class="card csec"><h2>Worth knowing on a ${escH(r.make)}</h2><p>${escH(r.notes)}</p></section>`:''}
<section class="csec"><h2 style="font-size:18px">If the light comes straight back</h2><div class="glist"><a class="gcard" href="/warning-lights/oil-change-light/"><b>Oil change light</b><span>What it means and what it is not</span></a><a class="gcard" href="/warning-lights/tire-pressure-light/"><b>Tire pressure light</b><span>Low air, a leak, or a dead sensor</span></a><a class="gcard" href="/warning-lights/check-engine-light/"><b>Check engine light</b><span>A fault, not a reminder</span></a></div></section>
${models.length?`<section class="csec"><h2 style="font-size:18px">${escH(r.make)} models on the site</h2><div class="mgrid">${models.map(v=>`<a href="/vehicles/${v.id}/">${escH(v.model)}<span>${v.years[0]}–${v.years[1]}</span></a>`).join('')}</div></section>`:''}
<div class="trust">Button sequences vary by model year and trim. Your owner's manual is the final word for your exact vehicle. If a reminder will not clear after the service, something else is setting it.</div>`;
    urls.push(page('/warning-lights/reset/'+m+'/',`How to Reset the Oil Change & Tire Pressure Light on a ${r.make} | VehicleSymptoms.com`,`Step-by-step: reset the ${r.make} oil change or maintenance reminder and the tire pressure (TPMS) light, in plain English, free.`.slice(0,165),{inner,pageData:ld}));}
  urls.push(page('/warning-lights/reset/','How to Reset a Service or Tire Pressure Light | VehicleSymptoms.com','Reset the oil change, maintenance and tire pressure lights by make. Plain-English steps, free, no sign-up.',{inner:`<div class="crumb"><a href="/">Home</a> › <a href="/warning-lights/">Warning lights</a> › Reset a light</div>
<div class="ghead"><div class="eyebrow">Reset a reminder light</div><h1>Which make are you resetting?</h1><p class="sub">Only reminder lights are meant to be reset: the oil change or maintenance message, and the tire pressure light after you have set the pressures. Do the work first, then reset.</p></div>
<div class="lrow">${mkeys.map(m=>`<a class="lr lr-all" href="/warning-lights/reset/${m}/"><b>${escH(RESETS[m].make)}</b><span>Oil change · tire pressure</span></a>`).join('')}</div>
<section class="csec"><h2 style="font-size:18px">Lights you should not just clear</h2><p class="pg-sub">A check engine light, an oil pressure light, a brake light or an airbag light is a fault. Clearing it hides the warning until the fault sets it again.</p><div class="glist">${['check-engine-light','oil-pressure-light','brake-warning-light','airbag-light'].map(id=>{const l=LIGHTS.find(x=>x.id===id);return l?`<a class="gcard" href="/warning-lights/${id}/"><b>${escH(l.name)}</b><span>${escH(LSEV[l.sev][0])}</span></a>`:''}).join('')}</div></section>`}));
  console.log(`${mkeys.length} reset-by-make pages`);
}


// ---------- "Is my quote fair?" price check (off while SHOW_PRICES is false; /price-check/ redirects home in vercel.json) ----------
if(SHOW_PRICES){const gen=new Map();
 // Common repairs: typical range drawn from every sourced, priced job in src/prices (25th percentile of low ends to 75th of high ends).
 // Grows automatically as models are added. A job needs at least 5 priced examples to be listed.
 const references=JSON.parse(fs.readFileSync('src/evidence/quote-references.json','utf8'));
 const shopQuestions={
   'Brake pad replacement (pads only, one axle)':'Which axle needs pads? Please list any rotor work as a separate item.',
   'Cabin air filter replacement':'Does this include the passenger-compartment filter and the labor to install it?',
   'Engine air filter replacement':'Does this include the engine intake filter and the labor to install it?',
   'Spark plug replacement':'Which engine is this quote for, and how many spark plugs does it include?',
   'Tire rotation':'Is this for tire rotation alone? Please list balancing separately if you recommend it.'
 };
 const referenceKeys=new Set();
 for(const ref of references){
   const vehicle=V.find(v=>v.id===ref.vehicleId);
   const key=[ref.vehicleId,ref.year,ref.job].join('|');
   if(!vehicle||!Number.isInteger(ref.year)||ref.year<vehicle.years[0]||ref.year>vehicle.years[1]||
      (vehicle.gaps||[]).some(([lo,hi])=>ref.year>=lo&&ref.year<=hi)||!shopQuestions[ref.job]||referenceKeys.has(key)||
      !Array.isArray(ref.aliases)||!ref.aliases.every(a=>typeof a==='string')||!Array.isArray(ref.sources)||!ref.sources.length)
     throw new Error('Invalid quote reference: '+key);
   for(const source of ref.sources){
     if(!source.name||!source.scope||!/^https:\/\//.test(source.url)||!/^\d{4}-\d{2}-\d{2}$/.test(source.checked))
       throw new Error('Invalid quote source: '+key);
   }
   referenceKeys.add(key);
 }
 // Keep dated evidence and URLs in the source ledger. Publish the service question and attribution.
 const repairNotes=references.map(({vehicleId,year,job,aliases,sources})=>({
   vehicleId,year,job,aliases,question:shopQuestions[job],sources:sources.map(({name,checked})=>({name,checked}))
 }));
 const COMMON=[['Control arm replacement (one side)',/control arm/,/bolt|fastener|bushing|hardware/],['Ball joint replacement',/ball joint/],['Tie rod end replacement',/tie rod/],['Strut or shock absorber replacement',/strut|shock/,/mount only|liftgate|hood|tailgate|trunk|air (spring|strut)/],['Wheel bearing or hub replacement',/wheel bearing|hub (assembly|bearing)|hub and bearing/],['CV axle replacement',/cv axle|cv joint|half ?shaft|axle shaft/],['Sway bar link or bushing replacement',/sway bar|stabilizer (bar|link)/],['Alternator replacement',/alternator/],['Starter replacement',/starter/,/relay|cable|wire|switch|interrupt/],['Water pump replacement',/water pump/],['Radiator replacement',/radiator(?! hose| cap| fan)/],['Radiator fan replacement',/radiator fan|cooling fan/],['Thermostat replacement',/thermostat/,/water pump|head|radiator|timing/],['Fuel pump replacement',/fuel pump/,/relay|module only|driver|control/],['A/C compressor replacement',/a\/c compressor|ac compressor/],['Blower motor replacement',/blower motor/],['Window regulator or motor replacement',/window regulator|window motor/],['Door lock actuator replacement',/lock actuator/],['Power steering pump replacement',/power steering pump/],['Ignition coil replacement',/ignition coil|coil pack/],['Spark plug replacement',/spark plug/],['Timing belt replacement',/timing belt/],['Timing chain replacement',/timing chain/],['Valve cover gasket replacement',/valve cover gasket/],['Head gasket repair',/head gasket/],['Catalytic converter replacement',/catalytic/],['Oxygen sensor replacement',/oxygen sensor|o2 sensor/],['Brake pads and rotors',/pads and rotors|pad and rotor/],['Brake caliper replacement',/caliper/],['Engine or motor mount replacement',/engine mount|motor mount/],['Serpentine belt or tensioner replacement',/serpentine|belt tensioner/],['Wheel speed (ABS) sensor replacement',/wheel speed sensor|abs sensor/],['Heater core replacement',/heater core/],['Intake manifold gasket replacement',/intake manifold gasket/],['Oil pan gasket replacement',/oil pan gasket/],['Rear main seal replacement',/rear main seal/],['Clutch replacement',/clutch (kit|replacement)|replace (the )?clutch/],['Transmission replacement (remanufactured)',/(replace|rebuild).*(transmission|transaxle)|transmission (replacement|rebuild)/,/sensor|solenoid|mount|cooler|line|fluid|valve body|software|seal|switch|module|filter|pan|harness|range|shift|cable|tcm|clutch pack|torque converter only|pump/],['Throttle body cleaning or replacement',/throttle body/],['Mass air flow sensor replacement',/mass air ?flow|maf sensor/],['EGR valve replacement',/egr valve/],['Turbocharger replacement',/turbo(charger)?/,/hose|pipe|line|sensor|solenoid|intercooler|boost|valve|actuator|gasket|clean|pump|wiring|harness|clamp|wastegate|if needed/]];
 const pct=(a,q)=>{a=[...a].sort((x,y)=>x-y);return a[Math.min(a.length-1,Math.floor(q*(a.length-1)))]};
 for(const [name,re,ex] of COMMON){const los=[],his=[];
   // Computed from the raw (pre-gate) issue figures in the ledger, so the common record is inventoried even while every input is withheld.
   for(const c of LEDGER.filter(r=>r.family==='vehicle-issue'&&r.lo>0)){const j=c.job.toLowerCase();if(/^(inspect|diagnose|check|test)/.test(j))continue;if(re.test(j)&&!(ex&&ex.test(j))){los.push(c.lo);his.push(c.hi)}}
   if(los.length<5)continue;const lo=rnd(pct(los,.25),false),hi=Math.max(rnd(pct(his,.75),true),lo+10);const g=EV.priceQualifies(EV.ids.common(name));
   LEDGER.push({id:EV.ids.common(name),family:'common-general',scope:'general (all vehicles)',job:name,lo,hi,status:g.ok?'shown':'withheld',reason:g.reason||''});if(g.ok)gen.set(name,[name,lo,hi])}
 console.log(gen.size+' common repair price ranges');
 for(const c of CODES)if(c.cost){const k=c.cost.job.replace(/\s*\(.*?\)\s*/g,' ').trim();if(gen.has(k))continue;
   if(!c.costOk)continue;const lo=rnd(c.cost.parts[0]+c.cost.hours[0]*RATE[0],false),hi=Math.max(rnd(c.cost.parts[1]+c.cost.hours[1]*RATE[1],true),lo+10);gen.set(k,[k,lo,hi])}
 fs.writeFileSync('dist/price-index.js','window.GEN_PRICES='+publicJson([...gen.values()].sort((a,b)=>a[0].localeCompare(b[0])),'general repair costs').replace(/</g,'\\u003c')+';');
 // Sourced estimator (src/estimator): per-job parts prices and stated labor hours by vehicle class, plus state labor rates.
 // Only files that passed review are shown: no "held" status and no nulls. Every number links back to its source.
 {const ED='src/estimator/jobs',est=[],heldJ=[];const okR=a=>Array.isArray(a)&&a.length===2&&a.every(n=>typeof n==='number'&&n>=0)&&a[0]<=a[1];
  if(fs.existsSync(ED))for(const f of fs.readdirSync(ED).filter(f=>f.endsWith('.json')).sort()){const j=JSON.parse(fs.readFileSync(ED+'/'+f,'utf8'));
   const ks=['economy','midsize','truck','luxury'];if(j.status==='held'||!ks.every(k=>j.classes[k]&&okR(j.classes[k].parts)&&okR(j.classes[k].hours))){heldJ.push(j.job);console.log('estimator: not shown (held or incomplete):',f);continue}
   const cls={};for(const k of ks){const c=j.classes[k],seen=new Set(),src=[];for(const x of [...c.parts_src.map(x=>[x,'p']),...c.hours_src.map(x=>[x,'h'])]){const s=x[0];if(!/^https:\/\//.test(s.url)||seen.has(s.url)||/^(not used|not in the range)/i.test(s.what))continue;seen.add(s.url);const publisher=publisherLabel(s.url);if(!publisher)continue;src.push([publisher,x[1],x[1]==='p'?'Parts reference':'Labor reference',/cross-check|not used|context only|outlier|not a range end|not in the range|corroboration/i.test(s.what.slice(0,70))?1:0])}
    src.sort((a,b)=>a[3]-b[3]);
    {const lo=rnd(c.parts[0]+c.hours[0]*RATE[0],false),hi=Math.max(rnd(c.parts[1]+c.hours[1]*RATE[1],true),lo+10),g=EV.priceQualifies(EV.ids.est(f,k));
     LEDGER.push({id:EV.ids.est(f,k),family:'estimator',scope:k+': '+c.example,job:j.job,lo,hi,status:g.ok?'shown':'withheld',reason:g.reason||''});if(!g.ok)continue}
    cls[k]={p:c.parts,h:c.hours,ex:c.example,src}}
   if(!Object.keys(cls).length){heldJ.push(j.job);continue}
   est.push({job:j.job,aka:Array.isArray(j.aka)?j.aka.filter(a=>typeof a==='string'):[],note:typeof j.note==='string'?j.note:'',unit:j.unit,conf:j.confidence,checked:j.checked,extras:j.extras,cls})}
  const R=JSON.parse(fs.readFileSync('src/estimator/rates.json','utf8')),rates={};for(const [k,v] of Object.entries(R))if(!k.startsWith('_')&&okR(v.indep))rates[k]=[v.indep[0],v.indep[1],v.confidence==='medium'?1:0];
  const STN={AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',DC:'District of Columbia',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming'};
  for(const k of Object.keys(rates))if(!STN[k])throw new Error('estimator: unknown state '+k);
  // Kind of vehicle per model (src/estimator/vehicle-classes.json): only pre-selects the optional kind on the price check; never changes a number.
  const vc={};if(fs.existsSync('src/estimator/vehicle-classes.json')){const VC=JSON.parse(fs.readFileSync('src/estimator/vehicle-classes.json','utf8')),vid=new Set(V.map(v=>v.id));for(const [k,c] of Object.entries(VC)){if(k.startsWith('_'))continue;if(!['economy','midsize','truck','luxury'].includes(c))throw new Error('estimator: bad vehicle class '+k);if(vid.has(k))vc[k]=c[0]}}
  const rsrc=[...new Set(Object.entries(R).filter(([k])=>!k.startsWith('_')).flatMap(([,v])=>publishers(v.src)))].slice(0,3);
  // Labor rates, the national rate band and their sources are published only when at least one estimator job is shown;
  // with no job shown they would be unbacked price figures.
  const anyJob=est.length>0;
  fs.writeFileSync('dist/price-est.js','window.EST='+publicJson({references:repairNotes,...(anyJob?{jobs:est,held:heldJ,vc,rates,nat:RATE,states:Object.keys(STN).filter(k=>rates[k]).map(k=>[k,STN[k]]),rsrc}:{jobs:[],held:heldJ,vc,rates:{},nat:null,states:[],rsrc:[]})},'quote estimator').replace(/</g,'\\u003c')+';');
  console.log(est.length+' sourced estimator jobs, '+Object.keys(rates).length+' state labor rates')}
 const hasPrice=LEDGER.some(row=>row.status==='shown'&&['vehicle-issue','maintenance','estimator','common-general','code-general'].includes(row.family));
 const coverage=hasPrice?'Select a repair to see whether we have a verified range that applies to it.':'We do not currently have a verified repair price range to compare with your quote.';
 const referenceGroups=new Map();
 for(const ref of references){
   const v=V.find(v=>v.id===ref.vehicleId),name=ref.year+' '+v.make+' '+v.model;
   if(!referenceGroups.has(name))referenceGroups.set(name,[]);
   const query=new URLSearchParams({v:v.id,y:ref.year,repair:ref.job});
   referenceGroups.get(name).push(`<li><a href="/price-check/?${escH(query.toString())}#pcApp">${escH(ref.job)}</a></li>`);
 }
 const sourceList=references.length?`<details class="pg-more"><summary>Vehicle-specific questions for your shop</summary>${[...referenceGroups].map(([name,links])=>`<h3>${escH(name)}</h3><ul>${links.join('')}</ul>`).join('')}</details>`:'';
 urls.push(page('/price-check/','Repair Quote Help and Price Check | VehicleSymptoms.com','Prepare a written estimate request for your mechanic and compare what a repair quote includes.',{pageData:'<script src="/price-index.js"></script>\n<script src="/price-est.js"></script>\n',inner:`<div class="crumb"><a href="/">Home</a> › Price check</div>
<div class="ghead"><div class="eyebrow">Price check</div><h1>Get a repair quote you can compare</h1><p class="sub">Enter the work your shop suggested, or describe what you noticed. You can copy a request for an itemized estimate before you have a price.</p></div>
<div class="card"><h2>Price coverage</h2><p>${coverage}</p>${sourceList}</div>
<div class="card pc" id="pcApp">
  <div class="pc-step"><span class="pn">1</span><div class="pc-body"><h2>Your vehicle</h2><div id="pcGarage" class="pc-garage"></div>
    <div class="ymm-row"><select id="pcY" aria-label="Year"></select><select id="pcM" aria-label="Make" disabled></select><select id="pcMo" aria-label="Model" disabled></select></div></div></div>
  <div class="pc-step"><span class="pn">2</span><div class="pc-body"><h2>The repair</h2><input id="pcJob" type="search" maxlength="240" placeholder="e.g. front brake pads, or a squeak when braking" autocomplete="off" aria-label="Repair"><div id="pcSug" class="pc-sug"></div><div id="pcPicked" class="pc-picked" hidden></div><div id="pcEst" class="pc-est" hidden><label>Kind of vehicle <span>(optional)</span><select id="pcCls" aria-label="Kind of vehicle"></select></label><label>Your state <span>(optional)</span><select id="pcSt" aria-label="Your state"></select></label></div></div></div>
  <div id="pcServiceNotes"></div>
  <div class="pc-step"><span class="pn">3</span><div class="pc-body"><h2><label for="pcRequest">Your message to the shop</label></h2>
    <textarea class="pc-request" id="pcRequest" readonly rows="6">Could you give me a written estimate? Please list the parts and labor separately, include any diagnostic fee, tax and shop fees, and tell me the total and warranty before I approve the work.</textarea>
    <button class="btn ghost" id="pcCopy" type="button">Copy shop request</button><span id="pcCopyStatus" role="status"></span></div></div>
  <div class="pc-step" id="pcQuoteStep" hidden><span class="pn">4</span><div class="pc-body"><h2>Compare your quote</h2><div class="pc-q"><span>$</span><input id="pcAmt" type="number" inputmode="decimal" min="0" placeholder="Total quoted, parts and labor" aria-label="Quoted price"></div>
    <button class="btn" id="pcGo" type="button" disabled>Check my quote</button></div></div>
</div>
<div id="pcOut"></div>
<p class="pg-disc" style="margin-top:18px">For a local price, ask a shop to quote your vehicle, the same repair and the same parts quality. We show a comparison only when the supporting sources cover the repair. The written-estimate guidance draws on the Federal Trade Commission’s <cite>Auto Repair Basics</cite>.</p>`}));}

// hub
urls.push(page('/symptoms/','All Car Symptom Guides | VehicleSymptoms.com','Step-by-step guides for car problems: won\'t start, warning lights, noises, shaking, leaks, smells, smoke, overheating and more.',{inner:`<div class="crumb"><a href="/">Home</a> › Symptom guides</div><div class="ghead"><h1>Symptom guides</h1><p class="sub">Pick what your car is doing. Each guide asks a few quick questions and tells you how urgent it is and what to do next.</p></div><div id="guideHub">${Object.entries(GL).map(([k,l])=>{const list=J.filter(j=>j.group===k);return list.length?`<section class="hubsec" id="${k}"><h2>${escH(l)}</h2>${k==='noise'?'<p><a href="/sounds/">Listen to a car sound</a></p>':''}<div class="glist">${list.map(j=>`<a class="gcard" href="/symptoms/${j.id}/"><b>${escH(j.title)}</b><span>${escH(j.h1)}</span></a>`).join('')}</div></section>`:''}).join('')}</div>`}));

// privacy, about / our standards, contact
urls.push(page('/privacy/','Privacy | VehicleSymptoms.com','How VehicleSymptoms.com handles your information.',{inner:`<div class="crumb"><a href="/">Home</a> › Privacy</div><div class="ghead"><h1>Privacy</h1><p class="sub">Short version: we collect as little as possible and never sell your information.</p></div>
<div class="card prose"><h3>No account, no sign-up</h3><p>You can use everything on the site without an account.</p>
<h3>"My garage" and saved progress</h3><p>If you save a vehicle to "My garage", or start a symptom guide, those details are stored only in your own browser on your device (browser local storage and session storage). They are not sent to us. To clear them, remove vehicles with the ✕ in My garage, or clear this site's data in your browser settings.</p>
<h3>Emailing yourself a result</h3><p>If you ask us to email you a result, we use your address to send it through our email provider, Resend, and we keep your address in our email provider's contact list, marked as not subscribed. We don't send you marketing email. For deletion requests, our contact details are below.</p>
<h3>VIN and recall lookups</h3><p>VINs are decoded directly by the U.S. government's free NHTSA database from your browser. We don't store them. Recall information comes from NHTSA's public database.</p>
${animations ? '<h3>Repair animations</h3><p>Opening an animation loads the MotoVisuals player. Your browser connects to MotoVisuals and sends the site origin so it can check the approved domain.</p>' : ''}
<h3>Visitor statistics</h3><p>We use Vercel Web Analytics to count page views and visits. It doesn't use cookies and doesn't identify you personally.</p>
<h3>Selling or sharing</h3><p>We don't sell or rent your personal information. We don't run ads or affiliate links.</p>
<h3>Contact</h3><p>Privacy contact<span aria-hidden="true"> · </span><span>${CONTACT}</span></p><p class="muted">Last updated November 2026.</p></div>`}));
urls.push(page('/about/','About VehicleSymptoms.com','What VehicleSymptoms.com is, how our guides work, and how to reach us.',{inner:`<div class="crumb"><a href="/">Home</a> › About</div><div class="ghead"><div class="eyebrow">About</div><h1>About VehicleSymptoms.com</h1><p class="sub">Free, plain-English help for drivers with a car problem: what to check, how urgent it may be and what to ask a mechanic.</p></div>
<div class="card prose"><h3>How we work</h3>
<ul><li><b>Guidance, not a diagnosis.</b> A website can't inspect your car. Possible causes are directions for testing, and we say what a shop should test before replacing parts.</li>
<li><b>Safety first.</b> When symptoms point to a possible brake, steering, fire or engine-damage risk, we tell you to stop and get help.</li>
<li><b>Honest about gaps.</b> If we haven't documented problems for a vehicle or year, we say so. A short list is not a reliability rating.</li>
<li><b>Free, no sign-up.</b> No ads and no affiliate links.</li></ul>
<h3 id="contact">Contact</h3><p>Questions and corrections<span aria-hidden="true"> · </span><span>${CONTACT}</span></p></div>`}));

// Model guides selected from the November Search Console report.
const modelSearchCopy = {
  "honda-accord": ["Honda Accord Common Problems by Year", "Looking at a used Honda Accord? Choose a model year to see reported problems, symptoms to watch for and questions to ask before buying."],
  "mazda-mazda6": ["Mazda6 Common Problems by Year, Including 2016", "Explore common Mazda6 problems by model year. Select the 2016 Mazda6 or another year to check symptoms and see what to ask a mechanic."],
  "mercedes-benz-c-class": ["Mercedes-Benz C-Class Common Problems by Year", "Researching a used Mercedes-Benz C-Class? Choose the model year, then check which listed issues match the engine and symptoms of the car you are considering."],
  "audi-q5": ["Used Audi Q5 Common Problems by Model Year", "Compare reported Audi Q5 problems by year. Choose the year of a used Q5 to review symptoms and questions to bring to a pre-purchase inspection."],
  "honda-civic": ["Used Honda Civic Common Problems by Year", "Choose a Honda Civic model year to see reported faults, the symptoms a driver might notice and what to ask about a used Civic."],
};

// vehicle pages
for(const v of V){
  const nm=v.make+' '+v.model;
  const render=y=>{RW.eval(`state.q='';state.tab='All';renderVehicle(VEHICLES.find(x=>x.id==='${v.id}'),${y||null})`);return RW.document.getElementById('vehicleView').innerHTML};
  const copy = modelSearchCopy[v.id];
  const title = copy ? copy[0] : `${nm} Common Problems by Model Year`;
  urls.push(page(`/vehicles/${v.id}/`,`${title} | VehicleSymptoms.com`,copy?.[1] ?? `Known ${nm} problems from ${v.years[0]} to ${v.years[1]}: ${v.issues.slice(0,3).map(i=>i.t.toLowerCase()).join('; ')}. Symptoms, causes and what to do.`.slice(0,300),{inner:render(null)}));
  for(let y=v.years[0];y<=v.years[1];y++){if(!sold(v,y))continue;
    const is=v.issues.filter(i=>y>=i.y[0]&&y<=i.y[1]);
    const systems = [...new Set(is.map(issue => issue.sys).filter(Boolean))];
    const subject = systems.length ? systems.slice(0, 2).join(' & ') + ' Problems' : 'Symptoms & Recall Lookup';
    urls.push(page(`/vehicles/${v.id}/${y}/`,`${y} ${nm}: ${subject} | VehicleSymptoms.com`,
      (is.length?`${is.length} known problem${is.length>1?'s':''} for the ${y} ${nm}: ${is.slice(0,3).map(i=>i.t.toLowerCase()).join('; ')}. Plus safety recalls and what to do.`:`Common symptoms, safety recalls and what to do for the ${y} ${nm}. Free, plain-English guide.`).slice(0,300),{inner:render(y)}));
  }
}
// Plain make -> model links so every vehicle page is reachable without JavaScript dropdowns.
{const mk=[...new Set(V.map(v=>v.make))].sort((a,b)=>a.localeCompare(b));const ms=m=>m.toLowerCase().replace(/[^a-z0-9]+/g,'-');
 urls.push(page('/vehicles/','All Makes and Models: Car Problems and Recalls | VehicleSymptoms.com','Browse every make and model we cover, 1996 and newer. Pick yours to see known problems and safety recalls by model year.',{inner:`<div class="crumb"><a href="/">Home</a> › All vehicles</div>
<div class="ghead"><div class="eyebrow">All vehicles</div><h1>Find your car by make and model</h1><p class="sub">${V.length} models from ${mk.length} makes. Pick your model, then your year.</p></div>
<p class="codechips">${mk.map(m=>`<a href="#${ms(m)}">${escH(m)}</a>`).join('')}</p>
${mk.map(m=>`<section class="csec" id="${ms(m)}"><h2>${escH(m)}</h2><div class="glist">${V.filter(v=>v.make===m).map(v=>`<a class="gcard" href="/vehicles/${v.id}/"><b>${escH(m+' '+v.model)}</b><span>${v.years[0]}–${v.years[1]}</span></a>`).join('')}</div></section>`).join('')}`}));}
// Safety-critical instruction inventory: every rendered stop/urgent instruction and each place it appears.
// The group is the normalized text, so one documented sign-off covers equivalent wording; each context is still listed and tested.
const SAFE=[];{const grp=t=>'t:'+EV.slug(t).slice(0,70)+':'+require('crypto').createHash('sha1').update(String(t).toLowerCase().replace(/\s+/g,' ').trim()).digest('hex').slice(0,10);
 const add=(text,context,kind)=>{if(text)SAFE.push({group:grp(text),text,context,kind})};
 for(const c of CODES){const r='/codes/'+c.code.toLowerCase()+'/';if(c.urgent_if){add(c.urgent_if,r+'#urgent-first','code-urgent-if');add(c.urgent_if,r+'#faq','code-urgent-if')}if(c.sev==='stop'){add(CURG.stop[0],r+'#badge','code-badge');add(c.drive||'default-stop-drive',r+'#drive','code-drive')}}
 for(const l of LIGHTS)if(l.sev==='stop'||l.sev==='soon'){const r='/warning-lights/'+l.id+'/';add(LSEV[l.sev][0],r+'#badge','light-badge');add(l.drive,r+'#drive','light-drive');const d=LDEEP[l.id]||{};if(d.flash)add(d.flash,r+'#flash','light-flash')}
 for(const j of J){const r='/symptoms/'+j.id+'/';j.safety.forEach((t,k)=>add(t,r+'#safety-'+k,'guide-safety'));for(const [nid,n] of Object.entries(j.nodes))if(n.result&&(n.result.urgency==='stop'||n.result.urgency==='soon'))add(n.result.now,r+'#'+nid,'guide-result-'+n.result.urgency)}
 for(const v of V)for(const i of v.issues)if(i.sev==='high')add(i.next,'/vehicles/'+v.id+'/#'+EV.slug(i.t),'vehicle-high-severity')}
fs.mkdirSync('audit/generated',{recursive:true});fs.writeFileSync('audit/generated/safety-contexts.json',JSON.stringify(SAFE));
console.log('safety contexts',SAFE.length,'groups',new Set(SAFE.map(x=>x.group)).size);
fs.mkdirSync('audit/generated',{recursive:true});fs.writeFileSync('audit/generated/price-ledger.json',JSON.stringify(LEDGER));
{const t={};for(const r of LEDGER){const k=r.family+':'+r.status;t[k]=(t[k]||0)+1}console.log('price ledger',LEDGER.length,JSON.stringify(t))}
// Sitemaps: one file per section, listed in a sitemap index at /sitemap.xml.
// lastmod is the date a page's own content last changed. src/lastmod.json keeps each page's content
// fingerprint and date; a page only gets a new date when its fingerprint changes. Commit the updated
// src/lastmod.json with content changes so the dates stick (the build rewrites it).
const TODAY=new Date().toLocaleDateString('en-CA',{timeZone:'America/New_York'});
const LM_FILE='src/lastmod.json';
const LM_OLD=fs.existsSync(LM_FILE)?JSON.parse(fs.readFileSync(LM_FILE,'utf8')):{};
const LM={};
for(const u of urls){const h=PAGEHASH[u];if(!h)throw new Error('No content fingerprint for '+u);
  const o=LM_OLD[u];LM[u]=o&&o.h===h?o:{h,d:TODAY}}
fs.writeFileSync(LM_FILE,'{\n'+Object.keys(LM).sort().map(u=>JSON.stringify(u)+':'+JSON.stringify(LM[u])).join(',\n')+'\n}\n');
const SECTIONS=[['symptoms',u=>u.startsWith('/symptoms/')],['warning-lights',u=>u.startsWith('/warning-lights/')],['codes',u=>u.startsWith('/codes/')],['vehicles',u=>u.startsWith('/vehicles/')],['pages',()=>true]];
const bySection=new Map(SECTIONS.map(([n])=>[n,[]]));
for(const u of urls)bySection.get(SECTIONS.find(([,t])=>t(u))[0]).push(u);
const sitemapIndex=[];
for(const [name,list] of bySection){if(!list.length)continue;
  if(list.length>50000)throw new Error('Sitemap section '+name+' is over 50,000 URLs; split it');
  const file=`sitemap-${name}.xml`;
  fs.writeFileSync('dist/'+file,'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+list.map(u=>`<url><loc>${SITE}${u}</loc><lastmod>${LM[u].d}</lastmod></url>`).join('\n')+'\n</urlset>\n');
  sitemapIndex.push(`<sitemap><loc>${SITE}/${file}</loc><lastmod>${list.map(u=>LM[u].d).sort().pop()}</lastmod></sitemap>`);
  console.log('sitemap',file,list.length);}
fs.writeFileSync('dist/sitemap.xml','<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+sitemapIndex.join('\n')+'\n</sitemapindex>\n');
// search engine verification + IndexNow (src/verify.json)
{const VF=JSON.parse(fs.readFileSync('src/verify.json','utf8'));
 if(VF.indexnow)fs.writeFileSync(`dist/${VF.indexnow}.txt`,VF.indexnow);
 fs.writeFileSync('dist/urls.json',JSON.stringify(urls.map(u=>SITE+u)));
 fs.mkdirSync('api/_data',{recursive:true});fs.writeFileSync('api/_data/urls.json',JSON.stringify(urls.map(u=>SITE+u)));
 fs.writeFileSync('api/_data/lastmod.json',JSON.stringify(Object.fromEntries(urls.map(u=>[SITE+u,LM[u].d]))));}
// a plain-language summary for AI assistants (llms.txt)
fs.writeFileSync('dist/llms.txt',`# VehicleSymptoms.com

> Free, plain-English help for drivers: describe what your car is doing and get how urgent it is, possible causes and what to ask your mechanic. No sign-up, no ads, nothing to buy.

The site is written for regular drivers, not mechanics. Nothing here is a confirmed diagnosis.

## Main sections
- [Car sounds](${SITE}/sounds/): listen to a recorded whir inside a moving car.
- [Symptom guides](${SITE}/symptoms/): ${JT?Object.keys(JT).length:100} step-by-step guides (shakes when braking, won't start, overheating, noises, smells, leaks). Each asks a few questions and ends with urgency, likely causes and a summary to show a mechanic.
- [Vehicles](${SITE}/vehicles/): ${V.length} popular models, 1996 to 2027, with a page per model year listing documented problems by engine, model-year safety recalls and repair information.
- [Warning lights](${SITE}/warning-lights/): ${LIGHTS.length} dashboard lights with what each means, whether it is safe to keep driving, safe checks a driver can do, possible causes and how to reset reminder lights.
- [Reset steps by make](${SITE}/warning-lights/reset/): oil change / maintenance reminder and tire pressure light reset procedures for ${Object.keys(RESETS).length} makes.
- [Trouble code lookup](${SITE}/codes/): ${CODES.length} OBD-II codes in plain English with causes, what to check first and whether it is safe to drive.

## Notes for assistants
- Cite the specific page that answers the question; every page has a stable URL.
- Safety-critical answers (brakes, overheating, oil pressure, flashing check engine light) tell the driver to stop driving; please keep that advice intact.
`);
fs.writeFileSync('dist/robots.txt',`User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
// The price check is off: anyone with an old /price-check/ link is sent to the homepage (backs up the redirect in vercel.json).
if(!SHOW_PRICES){fs.mkdirSync('dist/price-check',{recursive:true});fs.writeFileSync('dist/price-check/index.html','<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><link rel="canonical" href="'+SITE+'/"><meta http-equiv="refresh" content="0;url=/"><title>VehicleSymptoms.com</title><script>location.replace("/")</script></head><body><p><a href="/">Go to VehicleSymptoms.com</a></p></body></html>')}
fs.writeFileSync('dist/404.html',tpl.replace(/{{HOMEH1}}/g,'p class="hh1"').replace(/{{HOMEH1C}}/g,'p').replace(/{{TITLE}}/g,'Page not found | VehicleSymptoms.com').replace(/{{DESC}}/g,'').replace(/<link rel="canonical"[^>]*>/,'<meta name="robots" content="noindex">').replace(/{{CANON}}/g,SITE+'/').replace('{{CRED}}','').replace('{{HOMEHIDE}}',' style="display:none"').replace('{{HOMEHIDE2}}',' style="display:none"').replace('{{LIGHTSROW}}','').replace('{{VMETA}}','').replace('{{VEHSTYLE}}','').replace('{{PAGEDATA}}','').replace('{{VEHHTML}}','<div class="ghead"><h1>Page not found</h1><p class="sub">That page doesn\'t exist. <a href="/">Go to the homepage</a> or <a href="/symptoms/">browse symptom guides</a>.</p></div>'));
// Verify the actual vehicle payloads written to disk, including newly added models.
const vehicleFiles=fs.readdirSync('dist/data/v').filter(file=>file.endsWith('.json')).sort();
const expectedFiles=V.map(v=>v.id+'.json').sort();
if(vehicleFiles.length!==expectedFiles.length||vehicleFiles.some((f,i)=>f!==expectedFiles[i]))
  throw new Error('Public vehicle payload inventory mismatch');
for(const f of vehicleFiles)assertPublicData(JSON.parse(fs.readFileSync(path.join('dist/data/v',f),'utf8')),f);
console.log('Public data checked:',vehicleFiles.length,'vehicle files and',appliedInstructions.size,'reviewed instructions');
console.log('pages:',urls.length);
