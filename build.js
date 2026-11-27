// Builds the static site into dist/.
// 1. Vehicle data: src/vehicles.js + src/batches/*.js, then src/deep/<id>.json overrides a model by id.
// 2. Symptom guides: src/journeys/<id>.json (each checked by tools/check_journey.js).
// 3. Pages: home, /symptoms/ hub, /symptoms/<id>/, /vehicles/<id>/, /vehicles/<id>/<year>/, sitemap.
const fs=require('fs'),path=require('path');
const {JSDOM}=require('jsdom');
// Repair animations are switched off for now (owner decision, Nov 22 2026). Everything in src/animations is kept;
// set SHOW_ANIMATIONS to true to bring them back.
const SHOW_ANIMATIONS=false;
const animations = SHOW_ANIMATIONS ? require('./src/animations/render').createLibrary() : null;
const SITE='https://www.vehiclesymptoms.com';
const BYLINE='<p class="byline">VehicleSymptoms team · Updated November 2026 · <a href="/about/">How we work</a></p>';
const CRED='Plain-English guides for drivers, based on NHTSA safety and recall information, owner\'s manuals and published service information. A starting point, not a diagnosis.';

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
const publishers=sources=>[...new Set(sources.map(s=>publisherLabel(s&&typeof s==='object'?s.u:s)).filter(Boolean))];
// Outbound links visitors may follow (U.S. government, AAA, carmakers' owner's manuals): same whitelist the link check enforces.
const {isAllowedOutbound}=require('./tools/check-visitor-links.js');
const isWhitelistedUrl=value=>typeof value==='string'&&!/\s/.test(value)&&isAllowedOutbound(value);
// A readable publisher name for any source URL: the curated name, else the site's own name from its address (no dots).
function sourceName(source){
  const url=source&&typeof source==='object'?source.u:source;
  const known=publisherLabel(url);if(known)return known;
  let host;try{host=new URL(url).hostname.toLowerCase().replace(/^(?:www|m)\./,'')}catch{return null}
  const parts=host.split('.');const label=parts.length>2&&/^(?:co|com|org|gov)$/.test(parts[parts.length-2])?parts[parts.length-3]:parts[parts.length-2];
  return label?label.replace(/(^|-)([a-z])/g,(m,d,c)=>(d?' ':'')+c.toUpperCase()):null;
}
const extLink=(href,text)=>`<a href="${escA(href)}" target="_blank" rel="noopener nofollow">${escH(text)} <span aria-hidden="true">↗</span><span class="sr-only"> (opens another site)</span></a>`;
function assertPublicData(value,context){
  if(typeof value==='string'){
    if(isExternal(value)&&!isWhitelistedUrl(value))throw new Error('Outside URL in public data: '+context);
  }else if(value&&typeof value==='object'){
    for(const [key,child] of Object.entries(value)){
      if(isExternal(key))throw new Error('Outside URL in public data key: '+context);
      assertPublicData(child,context+'.'+key);
    }
  }
}
function publicJson(value,context){
  const serialized=JSON.stringify(value,(key,item)=>{
    if((key==='src'||key==='sources')&&Array.isArray(item)&&item.every(v=>typeof v==='string'||(v&&typeof v==='object'&&typeof v.u==='string'&&Object.keys(v).every(k=>k==='t'||k==='u'))))return publishers(item);
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
// Prices are switched off site-wide (owner decision, Nov 22 2026): no repair costs, price guide, ownership costs or price check anywhere.
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
// ---------- model reset steps (src/resets/models/<id>.json; format in tools/resets/BRIEF.md, checked by tools/resets/check.js) ----------
let resetN=0;
if(fs.existsSync('src/resets/models'))for(const f of fs.readdirSync('src/resets/models').filter(f=>f.endsWith('.json')).sort()){
  const d=JSON.parse(fs.readFileSync('src/resets/models/'+f,'utf8'));const v=V.find(v=>v.id===d.id);if(!v){console.log('reset file for unknown vehicle',f);continue}
  const ok=x=>x&&Array.isArray(x.years)&&x.years[0]>=v.years[0]&&x.years[1]<=v.years[1]&&Array.isArray(x.src)&&x.src.length&&(x.none===true||(Array.isArray(x.steps)&&x.steps.length>=2));
  const keep=list=>(list||[]).filter(x=>{if(ok(x))return true;console.log('reset variant dropped',f,x&&x.years);return false}).map(x=>({years:x.years,when:x.when,...(x.none?{none:true}:{steps:x.steps}),...(x.note?{note:x.note}:{}),src:x.src}));
  const r={oil:keep(d.oil),tpms:keep(d.tpms),...(d.notes?{notes:d.notes}:{})};
  if(r.oil.length||r.tpms.length){v.reset=r;resetN++}
}
console.log(resetN+' models with reset steps');
{const RK=fs.existsSync('src/resets.json')?JSON.parse(fs.readFileSync('src/resets.json','utf8')):{};const slug=m=>m.toLowerCase().replace(/[^a-z0-9]+/g,'-');for(const v of V)if(RK[slug(v.make)]){v.resetMake=slug(v.make);const k=RK[v.resetMake];if(!(k.oil&&k.oil.variants&&k.oil.variants.length)&&!(k.tpms&&k.tpms.variants&&k.tpms.variants.length))v.resetMakeNoSteps=true;else delete v.resetMakeNoSteps}}
const CATS=['Warning Lights','Smoke','Leaks','Noises','Smells','Starting Problems','Driving'],ids=new Set();let bad=0;
V.forEach(v=>{if(ids.has(v.id)){console.log('DUP',v.id);bad++}ids.add(v.id);
 if(!/^[a-z0-9-]+$/.test(v.id)||v.years[0]<1996||v.years[1]>2027){console.log('BADV',v.id);bad++}
 v.issues=v.issues.filter(i=>{const ok=i.y&&i.y[0]>=v.years[0]&&i.y[1]<=v.years[1]&&i.y[0]<=i.y[1]&&CATS.includes(i.cat)&&['high','med','low'].includes(i.sev)&&i.t&&i.sym&&i.why&&i.next;if(!ok){console.log('dropped bad issue',v.id,i.t);bad++}return ok})});
V.sort((a,b)=>(a.make+a.model).localeCompare(b.make+b.model));
// Recall queries per model year (src/recall-map.json). Combined labels resolve to the actual NHTSA model(s); every sold year must be covered.
{const RM=fs.existsSync('src/recall-map.json')?JSON.parse(fs.readFileSync('src/recall-map.json','utf8')).models:{};
 for(const v of V){if(RM[v.id])v.rq=RM[v.id].map(r=>({from:r.from,to:r.to,verified:r.verified!==false,queries:r.queries}));
  if(/ \/ /.test(v.model)){for(let y=v.years[0];y<=v.years[1];y++)if(sold(v,y)&&!(v.rq||[]).some(r=>y>=r.from&&y<=r.to)){console.log('RECALL MAP MISSING',v.id,y);bad++}}}}
// Audit Nov 27: a combined label ("Integra / RSX") shows the one name that was actually sold in a year ("2005 Acura RSX").
// A year gets its own name only when every NHTSA name filed for it belongs to the same part of the label, under the same make.
for(const v of V){delete v.yn;if(!/ \/ /.test(v.model)||!v.rq)continue;
  const nm=t=>String(t).toUpperCase().replace(/[^A-Z0-9]/g,''),parts=v.model.split(' / '),last=parts[parts.length-1].split(' '),tail=last.slice(1).join(' ');
  // "1 / 2 Series" means "1 Series" and "2 Series".
  const segs=parts.slice(0,-1).every(x=>!/ /.test(x))&&/^(?:Series|Super Duty|Class)$/.test(tail)?parts.map((x,i)=>({name:i<parts.length-1?x+' '+tail:x,core:x.split(' ')[0]})):parts.map(x=>({name:x,core:x}));
  const yn=[];
  for(const r of v.rq){const hit=new Set();let ok=true;
    for(const q of r.queries){const L=nm(q.label||q.model);const m=segs.filter(s=>{const c=nm(s.core);return L.startsWith(c)||c.startsWith(L)});
      if(m.length!==1||nm(q.make)!==nm(v.nmake||v.make)){ok=false;break}hit.add(m[0].name)}
    if(ok&&hit.size===1)yn.push({from:r.from,to:r.to,name:[...hit][0]})}
  if(yn.length)v.yn=yn}
const modelAt=(v,y)=>{const r=y&&(v.yn||[]).find(x=>y>=x.from&&y<=x.to);return r?r.name:v.model};
if (animations) for (const v of V) for (const issue of v.issues) {
  const item = animations.forText(issue.t);
  if (item) issue.animation = { title: item.title, href: animations.link(item) };
}
// Issue sources for visitors (contract 3, Nov 27 2026): sl = [{n: publisher, u: link or null}] (a link only for the
// outbound whitelist), rid = NHTSA recall IDs named in the title, next step or source links, wk = weak-sources-only flag (contract 4).
const normRid=m=>m.replace(/^(\d{2})V[- ]?(\d{3})\d{0,3}$/,'$1V-$2');
const RID_RX=/\b\d{2}V[- ]?\d{3}(?:\d{3})?\b/g;
let slN=0,ridN=0,wkN=0;
for(const v of V)for(const i of v.issues){
  const sl=[],byName=new Map();
  for(const s of Array.isArray(i.src)?i.src:[]){const n=sourceName(s);if(!n)continue;const u=isWhitelistedUrl(s)?s:null;
    const prev=byName.get(n);if(prev){if(!prev.u&&u)prev.u=u;continue}const e={n,u};byName.set(n,e);sl.push(e)}
  if(sl.length){i.sl=sl;slN++}else delete i.sl;
  const rid=[...new Set([i.t,i.next,...(Array.isArray(i.src)?i.src:[])].join(' ').match(RID_RX)||[])].map(normRid);
  if(rid.length){i.rid=[...new Set(rid)];ridN++}else delete i.rid;
  // Also flag issues whose visible sources are all weak aggregators and which name no recall ID (Nov 27 final check P7).
  const WEAK_HOSTS=['carwhere.com','vehicleflaws.com','forcar.org','carcomplaintdata.com','enginepatrol.com','8020automotive.com','rerev.com','motorverso.com','recallcheck.net','theweeklydriver.com'];
  const urls=(Array.isArray(i.src)?i.src:[]).filter(s=>/^https?:/i.test(s));
  const isWeak=u=>{try{const h=new URL(u).hostname.toLowerCase();return WEAK_HOSTS.some(w=>h===w||h.endsWith('.'+w))}catch(e){return false}};
  if(!i.rid&&urls.length&&urls.every(isWeak))i.wk=true;
  if(i.wk===true)wkN++;else delete i.wk;
}
console.log(`issue sources: ${slN} issues with sl, ${ridN} with recall IDs, ${wkN} weak-only`);
// ---------- manufacturer bulletins (src/tsbs/<model-id>.json, contract 2; schema in 07-tsb-plan.md §5a) ----------
const TSB_TYPES=['tsb','warranty_ext','campaign','ota','emissions'];let tsbN=0;const TSB_REVIEW=[];
if(fs.existsSync('src/tsbs'))for(const f of fs.readdirSync('src/tsbs').filter(f=>f.endsWith('.json')).sort()){
  const T=JSON.parse(fs.readFileSync('src/tsbs/'+f,'utf8'));const v=V.find(x=>x.id===T.id);
  const fail=m=>{throw new Error('Bulletin file '+f+': '+m)};
  if(!v)fail('no vehicle with id '+T.id);if(f!==T.id+'.json')fail('file name must be <id>.json');if(!Array.isArray(T.tsbs))fail('tsbs must be an array');
  const engKeys=new Set((v.engines||[]).map(e=>e.k)),titles=new Set(v.issues.map(i=>i.t)),ids=new Set();
  for(const b of T.tsbs){const w=m=>fail((b&&b.id||'?')+': '+m);
    if(!b||typeof b.id!=='string'||!/^[a-z0-9-]+$/.test(b.id))w('id must be lowercase-hyphen');if(ids.has(b.id))w('duplicate id');ids.add(b.id);
    if(typeof b.mfr_no!=='string'||!b.mfr_no.trim())w('mfr_no missing');
    if(!Number.isInteger(b.nhtsa_id)&&!/^\d+$/.test(String(b.nhtsa_id)))w('nhtsa_id must be numeric');
    let pdf;try{pdf=new URL(b.nhtsa_pdf)}catch{w('nhtsa_pdf is not a URL')}
    if(pdf.protocol!=='https:'||pdf.hostname!=='static.nhtsa.gov')w('nhtsa_pdf host must be static.nhtsa.gov');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(b.date||''))w('date must be YYYY-MM-DD');
    if(!TSB_TYPES.includes(b.type))w('type must be one of '+TSB_TYPES);
    if(!Array.isArray(b.years)||b.years.length!==2||!b.years.every(Number.isInteger)||b.years[0]>b.years[1]||b.years[0]<v.years[0]||b.years[1]>v.years[1])w('years must be within '+v.years.join('-'));
    if(!Array.isArray(b.engines)||b.engines.some(k=>!engKeys.has(k)))w('engines must be engine keys from the model file ('+[...engKeys].join(',')+')');
    if(b.trans!=null&&!['manual','auto'].includes(b.trans))w('trans must be manual, auto or null');
    if(typeof b.title!=='string'||!b.title.trim()||b.title.length>60)w('title must be 1-60 characters');
    if(typeof b.plain_summary!=='string'||!b.plain_summary.trim()||b.plain_summary.length>280)w('plain_summary must be 1-280 characters');
    if(b.coverage!=null&&(typeof b.coverage!=='object'||typeof b.coverage.term!=='string'))w('coverage must be {term, from, until} or null');
    if(b.coverage&&!['warranty_ext','campaign'].includes(b.type))w('coverage only for warranty_ext or campaign');
    for(const k of ['symptom_tags','codes','links_to_issue','src'])if(!Array.isArray(b[k]))w(k+' must be an array');
    for(const t of b.links_to_issue)if(!titles.has(t))w('links_to_issue "'+t+'" is not an issue title in src/deep/'+v.id+'.json');
    if(!b.src.length||b.src.some(u=>!/^https:\/\//.test(u)))w('src needs at least one https URL');
    if(b.src.some(u=>/alldata|mitchell1|au7o\.io|vehicleflaws/i.test(u)))w('source not allowed (ALLDATA, Mitchell, au7o.io, vehicleflaws)');
    if(typeof b.needs_tech_review!=='boolean')w('needs_tech_review must be true or false');
    const text=JSON.stringify([b.title,b.plain_summary,b.coverage]);
    if(/\$\s?\d|\d\s?(?:dollars|usd)\b/i.test(text))w('no money amounts');
    if(/\bfree\b/i.test(text))w('never promise "free"; say "may be covered"');
  }
  // Public copy: only the fields the vehicle page shows.
  // Only "tsbs" is read; the "pending" leads are never published. Entries marked needs_tech_review render in this preview
  // and are listed in audit/review/tsb-needs-review.json for the technician before anything is published (07 §6 rule 8).
  for(const b of T.tsbs)if(b.needs_tech_review)TSB_REVIEW.push({model:T.id,id:b.id,mfr_no:b.mfr_no,type:b.type,component:b.component||'',title:b.title,plain_summary:b.plain_summary,coverage:b.coverage||null,nhtsa_pdf:b.nhtsa_pdf});
  v.tsbs=T.tsbs.map(b=>({id:b.id,mfr_no:b.mfr_no,rev:b.rev||null,nhtsa_id:Number(b.nhtsa_id),nhtsa_pdf:b.nhtsa_pdf,date:b.date,type:b.type,years:b.years,engines:b.engines,trans:b.trans??null,
    component:b.component||'',title:b.title,plain_summary:b.plain_summary,coverage:b.coverage||null,symptom_tags:b.symptom_tags,codes:b.codes,links_to_issue:b.links_to_issue,src:b.src,needs_tech_review:b.needs_tech_review}));
  tsbN+=v.tsbs.length;
}
console.log(tsbN+' manufacturer bulletins ('+TSB_REVIEW.length+' need technician review)');
fs.mkdirSync('audit/review',{recursive:true});fs.writeFileSync('audit/review/tsb-needs-review.json',JSON.stringify(TSB_REVIEW,null,1)+'\n');
// Internal review fields never reach visitors (a11: sevReviewed/sevReason).
for(const v of V)for(const i of v.issues){delete i.sevReviewed;delete i.sevReason}
const data='// Generated by build.js — edit files in src/ instead.\nwindow.VEHICLES='+publicJson(V,'vehicles')+';\n';
fs.writeFileSync('vehicles.js',data);
function issueInYear(v,i,y){if(!(y>=i.y[0]&&y<=i.y[1]))return false;const tags=i.engs||[],E=v.engines||[];
  if(!tags.length||!E.length||!tags.every(t=>E.some(e=>e.k===t)))return true;
  return E.some(e=>tags.includes(e.k)&&y>=e.y[0]&&y<=e.y[1])}
const thin=V.reduce((a,v)=>{for(let y=v.years[0];y<=v.years[1];y++)if(sold(v,y)&&v.issues.filter(i=>issueInYear(v,i,y)).length<2)a++;return a},0);
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

// ---------- roadside help (src/roadside/<id>.json + _hub.json, contract 1; written by the roadside content agent) ----------
// ROADSIDE_DIR overrides the folder (tests use tools/fixtures/roadside). With no folder the site builds without /roadside/.
const RDIR=process.env.ROADSIDE_DIR||'src/roadside';
const RS=[];let RSHUB=null;
if(fs.existsSync(RDIR)){
  const fail=(f,m)=>{throw new Error('Roadside '+f+': '+m)};
  const strs=(a,max,f,k)=>{if(!Array.isArray(a)||a.some(x=>typeof x!=='string'||!x.trim()))fail(f,k+' must be a list of text');if(max&&a.length>max)fail(f,k+' has more than '+max+' items')};
  const srcs=(a,f)=>{if(!Array.isArray(a)||!a.length||a.some(s=>!s||typeof s.t!=='string'||!s.t.trim()||!/^https:\/\//.test(s.u||'')))fail(f,'sources must be [{t,u}] with https URLs');
    for(const s of a)if(!isAllowedOutbound(s.u))console.log('roadside source not on the outbound whitelist (shown as text, no link):',f,s.u)};
  const policy=(o,f)=>{const t=JSON.stringify(o);if(/\$\s?\d/.test(t))fail(f,'no money amounts');if(/(?<!toll-)\bfree\b/i.test(t))fail(f,'never promise "free"; say "may be covered"');
    if(/\b(?:1[-. ]?)?\(?\d{3}\)?[-. ]\d{3}[-. ]\d{4}\b|\b1-8\d\d\b/.test(t))fail(f,'no phone numbers other than 911');if(/oceanside|stewart|daniel/i.test(t))fail(f,'brand-only: no personal or shop names')};
  for(const f of fs.readdirSync(RDIR).filter(f=>f.endsWith('.json')&&f!=='_hub.json').sort()){
    const r=JSON.parse(fs.readFileSync(path.join(RDIR,f),'utf8'));
    if(r.id+'.json'!==f||!/^[a-z0-9-]+$/.test(r.id))fail(f,'id must equal the file name (lowercase-hyphen)');
    for(const k of ['title','h1','metaDesc','tile'])if(typeof r[k]!=='string'||!r[k].trim())fail(f,'missing '+k);
    if(r.metaDesc.length>155)fail(f,'metaDesc over 155 characters');if(r.tile.length>22)fail(f,'tile over 22 characters');
    if(!Number.isInteger(r.order))fail(f,'order must be a whole number');if(!['stop','soon','info'].includes(r.danger))fail(f,'danger must be stop, soon or info');
    strs(r.first,5,f,'first');if(!r.first.length)fail(f,'first needs at least one step');strs(r.dont||[],4,f,'dont');strs(r.call||[],0,f,'call');strs(r.related||[],0,f,'related');strs(r.lights||[],0,f,'lights');
    if(r.steps!=null&&(!Array.isArray(r.steps)||r.steps.some(s=>!s||typeof s.h!=='string'||typeof s.t!=='string')))fail(f,'steps must be [{h,t}]');
    srcs(r.sources,f);policy(r,f);RS.push(r);
  }
  RS.sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id));
  if(fs.existsSync(path.join(RDIR,'_hub.json'))){RSHUB=JSON.parse(fs.readFileSync(path.join(RDIR,'_hub.json'),'utf8'));
    if(typeof RSHUB.h1!=='string'||typeof RSHUB.intro!=='string')fail('_hub.json','needs h1 and intro');strs(RSHUB.whoToCall||[],0,'_hub.json','whoToCall');
    if(RSHUB.sources)srcs(RSHUB.sources,'_hub.json');policy(RSHUB,'_hub.json')}
}
const HAS_RS=RS.length>0;
console.log(`${RS.length} roadside pages${HAS_RS?' from '+RDIR:''}`);
// RS-10: a full-width red button above the homepage search, plus a "Smoke or fire" shortcut chip.
const smokeRs=RS.find(r=>/smoke|fire/.test(r.id));
const ROADSIDEBTN=HAS_RS?'<a class="rs-cta" href="/roadside/" data-va="roadside_tap"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 2 20h20z"/><path d="M12 10v4"/><circle cx="12" cy="17" r=".6" fill="currentColor"/></svg><span>Stuck on the road or something feels dangerous? <b>Tap here</b></span></a>':'';
const SMOKECHIP=HAS_RS?`<a class="sc sc-danger" href="${smokeRs?'/roadside/'+smokeRs.id+'/':'/roadside/'}" data-va="roadside_tap">Smoke or fire</a>`:'';

// ---------- output ----------
const tpl=fs.readFileSync('src/template.html','utf8')
  .replace('{{ANIMATIONLINK}}', animations ? ' · <a href="/repair-animations/">Repair animations</a>' : '')
  .replace('{{ROADSIDEBTN}}',()=>ROADSIDEBTN).replace('{{SMOKECHIP}}',()=>SMOKECHIP)
  .replace('{{FOOTLINKS}}',HAS_RS?' · <a href="/roadside/" style="color:var(--blue2)">Roadside help</a>':'')
  .replace(/{{NMODELS}}/g,String(V.length));
fs.rmSync('dist',{recursive:true,force:true});fs.mkdirSync('dist');
// Phones only download what a page needs: a small vehicle list everywhere, full data per vehicle on demand.
{const lite=V.map(v=>{const o={};for(const k of Object.keys(v))if(k!=='issues'&&k!=='own'&&k!=='reset'&&k!=='tsbs')o[k]=v[k];o.hasReset=!!v.reset;o.issues=[];o.n=v.issues.length;return o});
 fs.writeFileSync('dist/vehicles.js','// Generated by build.js. Full per-vehicle data lives in /data/v/<id>.json\nwindow.VEHICLES='+publicJson(lite,'vehicle index')+';\n'+
  "(function(){const c={};window.VS_LOAD=function(id){const v=(window.VEHICLES||[]).find(x=>x.id===id);if(!v)return Promise.resolve(null);if(v._full)return Promise.resolve(v);"+
  "return c[id]=c[id]||fetch('/data/v/'+id+'.json').then(r=>r.json()).then(d=>{Object.assign(v,d,{_full:true});return v}).catch(()=>v)}})();\n");
 fs.mkdirSync('dist/data/v',{recursive:true});for(const v of V)fs.writeFileSync('dist/data/v/'+v.id+'.json',publicJson({issues:v.issues,own:v.own||null,engines:v.engines||[],reset:v.reset||null,tsbs:v.tsbs||[]},'vehicle '+v.id));}fs.writeFileSync('dist/guide-index.js',indexJs);
for(const f of ['app.js','guide.js','site.css','pdf.js','powertrain.js'])fs.copyFileSync('src/'+f,'dist/'+f);
// Browser tab icons and the image shown when a page link is shared.
for(const [from,to] of [['favicon.ico','favicon.ico'],['favicon.svg','favicon.svg'],['icon-180.png','apple-touch-icon.png'],['icon-192.png','icon-192.png'],['og-image.png','og-image.png']])fs.copyFileSync('src/brand/'+from,'dist/'+to);
// T-20: the Public Sans font is served from this site (SIL Open Font License, src/fonts/OFL-public-sans.txt), not from Google.
fs.mkdirSync('dist/fonts',{recursive:true});for(const f of fs.readdirSync('src/fonts'))fs.copyFileSync('src/fonts/'+f,'dist/fonts/'+f);
fs.mkdirSync('dist/vendor',{recursive:true});fs.copyFileSync('src/vendor/jspdf.umd.min.js','dist/vendor/jspdf.umd.min.js');
fs.mkdirSync('dist/email',{recursive:true});for(const f of fs.readdirSync('src/email'))fs.copyFileSync('src/email/'+f,'dist/email/'+f);
// ---------- warning lights data (src/lights.js + optional depth in src/lights-deep.json) ----------
const LIGHTS=require('./src/lights.js');
const RESETS=fs.existsSync('src/resets.json')?JSON.parse(fs.readFileSync('src/resets.json','utf8')):{};
const LDEEP=fs.existsSync('src/lights-deep.json')?JSON.parse(fs.readFileSync('src/lights-deep.json','utf8')):{};
const LCOL={red:'#FF5A5F',amber:'#FFB020',green:'#34C77B',blue:'#5AB0FF'};
const lsev=l=>l.sevLabel?[l.sevLabel,l.sevClass||LSEV[l.sev][1]]:LSEV[l.sev];
const LSEV={stop:["Stop driving as soon as it's safe","high"],soon:["Get it checked soon","med"],check:["Check it when you can","info"],info:["Information only","low"]};
const LCOLNAME={red:'Red: serious, act now',amber:'Amber/yellow: check soon',green:'Green: system on',blue:'Blue: information'};
const lIcon=(l,size)=>`<svg class="licon" width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" style="color:${LCOL[l.color]}" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${l.icon}</svg>`;
// the row of most-looked-up lights shown high on the home page
// Lights where one observation changes the advice: the card asks it, and the light page opens with it.
// Wording of each choice follows the linked guide (the flashing guide's first safety line; the steady guide's intro).
const FIRSTQ={'check-engine-light':{card:'Steady or flashing?',q:'First: is it steady or flashing?',
  help:'Flashing means blinking on and off, about once a second. The advice is different, so start here.',
  opts:[{a:'Flashing or blinking',d:'The most urgent check engine warning. Pull over as soon as it is safe and turn the engine off, even if the engine feels smooth.',href:'/symptoms/check-engine-light-flashing/',cls:'hi'},
        {a:'Steady (lit, not blinking)',d:'A stored fault. Often not an emergency, but how the car is driving decides how soon to act.',href:'/symptoms/check-engine-light-on/',cls:'md'}]}};
const ROWIDS=['check-engine-light','oil-pressure-light','engine-temperature-light','battery-light','brake-warning-light','tire-pressure-light','abs-light','airbag-light','service-light','oil-change-light','traction-control-light','master-warning-light'];
const escA=t=>String(t).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
const escH=t=>String(t==null?'':t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const VERIFY=JSON.parse(fs.readFileSync('src/verify.json','utf8'));
const VMETA=(VERIFY.google?`<meta name="google-site-verification" content="${VERIFY.google}">`:'')+(VERIFY.bing?`<meta name="msvalidate.01" content="${VERIFY.bing}">`:'');
const LIGHTSROW=(()=>{const pick=ROWIDS.map(id=>LIGHTS.find(l=>l.id===id)).filter(Boolean);
 return `<div class="lrow dashboard-lights">${pick.map(l=>`<a class="lr${FIRSTQ[l.id]?' lr-q':''}" href="/warning-lights/${l.id}/${FIRSTQ[l.id]?'#first':''}">${lIcon(l,56)}<b>${escH(l.name.replace(/ \(.*\)$/,'').replace(/ light$/i,'').replace(/ warning$/i, l.id === 'master-warning-light' ? ' warning' : ''))}</b>${FIRSTQ[l.id]?`<span class="lsev lq">${escH(FIRSTQ[l.id].card)}</span>`:`<span class="lsev ${lsev(l)[1]}">${escH(lsev(l)[0])}</span>`}</a>`).join('')}<a class="lr lr-all" href="/warning-lights/"><b>All lights</b><span>Red, amber, green and blue</span></a></div>`})();
const scripts=['vehicles.js','guide-index.js','guide.js','powertrain.js','app.js'].map(f=>f==='vehicles.js'?data:f==='guide-index.js'?indexJs:fs.readFileSync('src/'+f,'utf8'));

// one browser instance renders every vehicle page
const shell=tpl.replace(/{{[A-Z]+}}/g,'').replace(/<script (?:defer )?src="\/[a-z-]+\.js"><\/script>\n?/g,'');
const R=new JSDOM(shell.replace('</body>',()=>scripts.map(s=>'<script>'+s+'</script>').join('')+'</body>'),{runScripts:'dangerously',url:SITE+'/vehicles/x/'});
R.window.fetch=()=>new Promise(()=>{});R.window.scrollTo=()=>{};R.window.HTMLElement.prototype.scrollIntoView=()=>{};
const RW=R.window;

function write(p,html){const f='dist'+p+'index.html';fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,html)}
const PAGEHASH={};
// Shorten a meta description at a sentence or word boundary instead of mid-word.
function clip(text,max=160){text=String(text).replace(/\s+/g,' ').trim();if(text.length<=max)return text;const cut=text.slice(0,max+1);
  const end=Math.max(cut.lastIndexOf('. '),cut.lastIndexOf('? '),cut.lastIndexOf('! '));if(end>max*0.55)return cut.slice(0,end+1);
  return cut.slice(0,cut.lastIndexOf(' ')).replace(/[\s,;:–—-]+$/,'')+'…';}
// The full homepage block ships only on "/" (T-11). app.js checks for each homepage element, so other pages get nothing.
const HOMESTUB='';
const BRAND=' | VehicleSymptoms.com';
// T-13: titles over 70 characters drop the brand suffix; descriptions are cut at 155 characters.
const fitTitle=t=>t.length>70&&t.endsWith(BRAND)?t.slice(0,-BRAND.length):t;
function fill(title,desc,{canon=null,inner='',pageData='',home=false,noindex=false}={}){
  let h=home?tpl.replace('<!--HOME-->','').replace('<!--/HOME-->',''):tpl.replace(/<!--HOME-->[\s\S]*?<!--\/HOME-->/,()=>HOMESTUB);
  if(!canon)h=h.replace(/<link rel="canonical"[^>]*>\n?/,'');
  if(noindex)h=h.replace('<meta name="description"','<meta name="robots" content="noindex">\n<meta name="description"');
  return h.replace(/{{TITLE}}/g,()=>escA(title)).replace(/{{DESC}}/g,()=>escA(desc)).replace(/{{CANON}}/g,()=>canon||SITE+'/').replace('{{CRED}}',()=>home?escH(CRED):'')
    .replace(/{{HOMEH1}}/g,home?'h1':'p class="hh1"').replace(/{{HOMEH1C}}/g,home?'h1':'p').replace('{{HOMEHIDE}}',home?'':' style="display:none"').replace('{{VMETA}}',()=>canon?VMETA:'').replace('{{HOMEHIDE2}}',home?'':' style="display:none"').replace('{{LIGHTSROW}}',()=>home?LIGHTSROW:'').replace('{{VEHSTYLE}}',home?'display:none;':'')
    .replace('{{PAGEDATA}}',()=>pageData).replace('{{VEHHTML}}',()=>inner);
}
const decodeH=s=>String(s).replace(/&nbsp;/g,' ').replace(/&#39;|&#x27;|&apos;/g,"'").replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const visibleText=h=>decodeH(String(h).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();
// T-14: BreadcrumbList structured data from the page's own visible breadcrumb trail.
function crumbLd(inner,p){const m=String(inner).match(/<div class="crumb">([\s\S]*?)<\/div>/);if(!m)return '';
  const items=[];const re=/<a href="([^"]+)">([\s\S]*?)<\/a>/g;let x,last=0;
  while((x=re.exec(m[1]))){items.push({name:visibleText(x[2]),item:new URL(decodeH(x[1]),SITE+p).href.replace(/#.*$/,'')});last=re.lastIndex}
  const tail=visibleText(m[1].slice(last)).replace(/^›\s*/,'').trim();if(tail)items.push({name:tail,item:SITE+p});
  if(items.length<2)return '';
  return '<script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:items.map((it,i)=>({'@type':'ListItem',position:i+1,name:it.name,item:it.item}))}).replace(/</g,'\\u003c')+'</script>\n';}
const HOMEBLOCK=(tpl.match(/<!--HOME-->([\s\S]*?)<!--\/HOME-->/)||['',''])[1];
function page(p,title,desc,{inner='',pageData='',home=false,noindex=false}={}){desc=clip(desc,155);title=fitTitle(title);
  const h=fill(title,desc,{canon:SITE+p,inner,pageData:pageData+crumbLd(inner,p),home,noindex});
  // T-15: lastmod follows what a visitor reads (title, description and visible text), not scripts or markup, so a rebuild
  // of the same content keeps its dates.
  PAGEHASH[p]=createHash('sha1').update(JSON.stringify([title,desc,visibleText(home?HOMEBLOCK.replace('{{LIGHTSROW}}',LIGHTSROW)+inner:inner),noindex])).digest('hex').slice(0,16);
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
// The car sounds page is off for now (only one recording, cause unconfirmed). src/sounds is kept; set SHOW_SOUNDS to true to bring it back.
const SHOW_SOUNDS=false;
const sound = require('./src/sounds/page.js');
if (SHOW_SOUNDS) {
if (!J.some(j => j.id === sound.guide)) throw new Error('Missing guide for the car sound recording');
urls.push(page('/sounds/', 'Car Sounds | VehicleSymptoms.com', 'Listen to a real whir inside a moving car and open the matching symptom guide.', {inner: sound.html}));
fs.copyFileSync('src/sounds/'+sound.clip, 'dist/sounds/'+sound.clip);
}
const HOMEFAQ=[...fs.readFileSync('src/template.html','utf8').matchAll(/<details class="faq"><summary>(.*?)<\/summary><p>(.*?)<\/p><\/details>/g)].map(m=>({'@type':'Question',name:m[1],acceptedAnswer:{'@type':'Answer',text:m[2]}}));
const homeLd='<script type="application/ld+json">'+JSON.stringify([{'@context':'https://schema.org','@type':'WebSite',name:'VehicleSymptoms.com',url:SITE+'/'},{'@context':'https://schema.org','@type':'FAQPage',mainEntity:HOMEFAQ}]).replace(/</g,'\\u003c')+'</script>\n';
urls.push(page('/',"What's Wrong With My Car? Free Car Symptom Help | VehicleSymptoms.com",'Free, plain-English help for car problems: what to check, how urgent it may be and what to ask your mechanic. No sign-up needed.',{home:true,pageData:homeLd}));

function sourceCredits(sources){return publishers(sources).map(escH).join(' · ')||'Editorial evidence on file'}
// A source's page title: the given title, else a readable version of the last part of its address.
function sourceTitle(s){if(s&&typeof s==='object'&&s.t)return s.t;let u;try{u=new URL(s&&typeof s==='object'?s.u:s)}catch{return ''}
  const seg=u.pathname.split('/').filter(Boolean).pop()||'';const t=decodeURIComponent(seg).replace(/\.(?:html?|php|aspx?|pdf)$/i,'').replace(/[-_+]+/g,' ').trim();
  return t.length>=6&&/[a-z]{3}/i.test(t)&&!/^(?:index|default|home)$/i.test(t)?t.charAt(0).toUpperCase()+t.slice(1):''}
const RECALL_LOOKUP='https://www.nhtsa.gov/recalls';
const isRecallLookup=s=>/^https:\/\/(?:www\.)?nhtsa\.gov\/recalls\/?$/i.test(String(s&&typeof s==='object'?s.u:s));
const recallLine=(cls='lsrc')=>`<p class="${cls} recall-line">Check open recalls for your exact car: enter your VIN at ${extLink(RECALL_LOOKUP,'NHTSA.gov/recalls').replace('<a ','<a data-va="recall_check" ')} (the U.S. government's site). A dealer can also check it.</p>`;
// SG-H1: sources listed with their page titles; links only for the outbound whitelist (government, AAA, owner's manuals).
function sourceList(sources){const seen=new Set();
  return sources.filter(s=>!isRecallLookup(s)).map(s=>{const u=s&&typeof s==='object'?s.u:s,n=sourceName(s);if(!n)return '';const t=sourceTitle(s),label=t?n+': '+t:n;
    if(seen.has(label))return '';seen.add(label);return '<li>'+(isWhitelistedUrl(u)?extLink(u,label):escH(label))+'</li>'}).filter(Boolean).join('')}
// Optional journey field "roadside": ["<roadside id>"] links to the matching /roadside/ page near the top of the guide.
const rsJump=j=>(Array.isArray(j.roadside)?j.roadside:[]).map(id=>{const r=RS.find(x=>x.id===id);if(!r){if(HAS_RS)console.log('guide '+j.id+': roadside id not found:',id);return ''}
  return `<a class="rs-jump" href="/roadside/${r.id}/" data-va="roadside_tap">What to do right now: ${escH(r.title)} →</a>`}).join('');
const PULLOVER='<p class="pullover"><b>Pull over before you read this.</b> Don\'t use your phone while driving.</p>';
// SG-M5: real stop conditions ("If…", "When…") go under "Stop and get help right away:"; other safety notes under "Stay safe while you check:".
// An optional journey field "safetyTips" adds more "Stay safe while you check:" bullets.
function safetyBox(list,tips){const stop=list.filter(t=>/^(?:If|When)\b/.test(t)),care=[...list.filter(t=>!/^(?:If|When)\b/.test(t)),...(Array.isArray(tips)?tips:[])];if(!stop.length&&!care.length)return '';
  return `<div class="safety" id="safety">${stop.length?`<b>Stop and get help right away:</b><ul>${stop.map(t=>`<li>${escH(t)}</li>`).join('')}</ul>`:''}${care.length?`<b class="safety-care">Stay safe while you check:</b><ul>${care.map(t=>`<li>${escH(t)}</li>`).join('')}</ul>`:''}</div>`}
// symptom guide pages
const GL={start:"Won't start",light:"Warning light",noise:"Noise",shake:"Shaking",leaksmell:"Leak, smell or smoke",hot:"Running hot",drive:"Driving & handling"};
const UL={stop:["Stop — don't drive it","high"],soon:["Get it checked in the next few days","med"],check:["Book a check when convenient","info"],diy:["Check it yourself first","low"]};
for(const j of J){
  const results=Object.values(j.nodes).filter(n=>n.result).map(n=>n.result);
  const firstQ=j.nodes[j.start];
  const animation = animations?.contextual(animations.guide.get(j.id)) || '';
  const inner=`<div class="crumb"><a href="/">Home</a> › <a href="/symptoms/">Symptom guides</a> › ${escH(j.title)}</div>
<div class="ghead"><div class="eyebrow">${escH(GL[j.group])}</div><h1>${escH(j.h1)}</h1></div>
${PULLOVER}${safetyBox(j.safety,j.safetyTips)}${rsJump(j)}<p class="sub gintro">${escH(j.intro)}</p>
${SHOW_SOUNDS&&j.id===sound.guide?`<p><a href="/sounds/#${sound.section}">Hear a whir inside a moving car</a></p>`:''}
${BYLINE}<div id="guideApp"><div class="flow card"><div class="step-n">Question 1</div><h2 class="fq">${escH(firstQ.q)}</h2>${firstQ.help?`<p class="help">${escH(firstQ.help)}</p>`:''}<div class="opts">${firstQ.opts.map(o=>`<button class="opt">${escH(o.a)}</button>`).join('')}</div></div></div>
${animation}
<div class="fullguide"><h2 style="font-size:20px">Full guide: every possible outcome</h2><p class="muted" style="margin-top:-4px">Prefer to read it all? Here's every result this guide can reach.</p>
${results.map(r=>`<details><summary>${escH(r.title)}<span class="urg ${UL[r.urgency][1]}">${UL[r.urgency][0]}</span></summary><div class="fg"><p><b>What to do now:</b> ${escH(r.now)}</p>${(r.links||[]).filter(l=>l&&/^\/[a-z0-9\/#-]*$/.test(l.u)).map(l=>`<p><a class="rs-jump" href="${escA(l.u)}">${escH(l.t)} →</a></p>`).join('')}${(r.if||[]).length?`<p><b>Watch for:</b></p><ul class="fg-if">${r.if.map(x=>`<li>${escH(x)}</li>`).join('')}</ul>`:''}<p><b>Why:</b> ${escH(r.why)}</p><p><b>Possible causes:</b> ${r.causes.map(c=>escH(c.name)).join('; ')}.</p><p><b>A shop will usually test:</b> ${r.confirm.shop.map(escH).join('; ')}.</p></div></details>`).join('\n')}
${j.related.length?`<h2 style="font-size:20px;margin-top:26px">Related guides</h2><div class="glist">${j.related.map(id=>{const r=J.find(x=>x.id===id);return`<a class="gcard" href="/symptoms/${r.id}/"><b>${escH(r.title)}</b><span>${escH(r.h1)}</span></a>`}).join('')}</div>`:''}
<section class="srcs-sec"><h2 style="font-size:18px">Sources and references</h2><ul class="srcs">${sourceList(j.sources)||'<li>Editorial evidence on file</li>'}</ul>${recallLine()}</section>
<div class="trust" style="margin-top:18px">This guide helps you understand what may be going on and how urgent it is. It doesn't replace an in-person inspection.</div></div>`;
  urls.push(page(`/symptoms/${j.id}/`,`${j.h1.replace(/\?$/,'')}? Causes & What to Do | VehicleSymptoms.com`.replace('??','?'),j.metaDesc,{inner,pageData:`${animation ? animationScript : ''}<script>window.JOURNEY=${publicJson(j,'guide '+j.id).replace(/</g,'\\u003c')};</script>\n`}));
}
// ---------- trouble codes (src/codes/*.json) ----------
const CODES=[];const cseen=new Set();
if(fs.existsSync('src/codes'))for(const f of fs.readdirSync('src/codes').filter(f=>f.endsWith('.json')).sort()){
  for(const c of JSON.parse(fs.readFileSync('src/codes/'+f,'utf8'))){if(cseen.has(c.code))continue;cseen.add(c.code);CODES.push(c)}}
CODES.sort((a,b)=>a.code.localeCompare(b.code));
const CODEBY=new Map(CODES.map(c=>[c.code,c]));
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
// Codes for brakes, oil pressure, fuel leaks, steering, airbags and brake lights get a system-specific
// "stop if" line instead of the generic engine advice (audit Nov 24 2026).
function codeSafety(c){
  const t=(c.title+' '+c.plain+' '+(c.symptoms||[]).join(' ')).toLowerCase(),ti=c.title.toLowerCase();
  // TC-18: comfort and trailer modules don't get the steering or brake stop box; parking-brake modules get their own advice.
  if(/heated steering wheel|trailer brake/.test(ti))return null;
  if(/park(?:ing)? brake/.test(ti)&&/module|communication/.test(ti))return {urgent_if:"If the parking brake won't hold or release, park on level ground, leave it in Park and have it checked before relying on it."};
  if(/brake (?:light|lamp)|stop lamp|brake switch|brake pedal (?:position )?switch|torque converter\/brake switch/.test(ti))return {drive:"Your brake lights may not work, so drivers behind can't see you slowing down, and cruise control or shifting out of Park may be affected. Check the brake lights with a helper and get it fixed right away."};
  if(!/shift lock/.test(ti)&&(/brake (?:booster|vacuum|pressure|fluid|pedal)|brake (?:system )?control module|brake pedal (?:may )?(?:feel|get|go|becom)\w* (?:hard|stiff)|hard brake pedal|vacuum pump|brake assist/.test(t)||c.sys==='Brakes'))
    return {urgent_if:"If the brake pedal goes hard or sinks, the car takes longer to stop, or the red brake light comes on, slow down, pull off the road when it's safe and have it towed. Don't keep driving."};
  if(/oil pressure/.test(ti))return {urgent_if:"If the red oil pressure light comes on or the gauge drops to zero, pull over as soon as it's safe and turn the engine off. Check the oil level, and don't drive it until real oil pressure has been tested."};
  if(/fuel (?:system )?leak|fuel smell|smell of fuel|raw fuel/.test(t))return {urgent_if:"If you smell strong raw fuel or see fuel dripping, don't drive it: turn the engine off, keep sparks away and move away from the car. Have it towed."};
  if(/steering/.test(ti)||c.sys==='Steering')return {urgent_if:"If the steering takes more effort than normal or a red steering warning comes on, slow down, pull over when it's safe and have it towed."};
  if(/airbag|air bag|restraint|seat ?belt pretension|occupant (?:classification|sensor)|squib|deployment/.test(t))return {drive:"The car drives normally, but the airbags or seat belt tensioners may not work in a crash. Have it checked right away by a shop with an airbag scanner, and check your VIN for open airbag recalls."};
  return null}
for(const c of CODES){const s=codeSafety(c);if(!s)continue;if(s.urgent_if&&!c.urgent_if)c.urgent_if=s.urgent_if;if(s.drive&&!c.drive)c.drive=s.drive}
// The search description names the same urgent condition as the page itself, never a generic one.
function urgShort(u){
  // Specific conditions first (a09 request R1), so a stall or coolant box never reads as a flashing-light warning.
  if(/cuts out while you're driving/i.test(u))return 'if the engine cuts out while driving, get to the side of the road and have it towed.';
  if(/temperature gauge climbs/i.test(u))return 'a climbing temperature gauge or steam means pull over; never open a hot coolant cap.';
  if(/won't speed up or drops to idle/i.test(u))return 'a car that suddenly won\'t speed up means get off the road.';
  if(/parking brake won't hold/i.test(u))return 'a parking brake that won\'t hold or release means park on level ground in Park.';
  if(/flashing|shaking hard/i.test(u))return 'flashing check engine light or hard shaking means get off the road.';
  if(/brake pedal|red brake/i.test(u))return 'a hard or sinking brake pedal or a red brake light means pull off the road.';
  if(/steering/i.test(u))return 'steering that takes more effort or a red steering warning means pull over.';
  if(/oil pressure/i.test(u))return 'a red oil pressure light means pull over and turn the engine off.';
  if(/fuel/i.test(u))return 'a strong fuel smell or dripping fuel means don\'t drive it.';
  if(/stall/i.test(u))return 'stalling at stops means don\'t keep driving it.';
  if(/transmission|slips|limp mode/i.test(u))return 'slipping, late shifts or limp mode mean stop driving.';
  return 'see when to stop driving.';
}
const famName=c=>({P:'Powertrain',B:'Body',C:'Chassis',U:'Network'})[c[0]];
// TC-10: related codes. A code's own "related" list (curated) comes first, then this list for the most-searched codes,
// then codes from the same system with the nearest numbers.
const RELATED={P0455:['P0442','P0456','P0457','P0440','P0446'],P0442:['P0455','P0456','P0457','P0440','P0446'],P0456:['P0442','P0455','P0457','P0440'],P0457:['P0455','P0442','P0456','P0440'],
 P0440:['P0442','P0455','P0456','P0446'],P0446:['P0440','P0442','P0455','P0456'],P0420:['P0430','P0136','P0141','P0300'],P0430:['P0420','P0156','P0161','P0300'],
 P0171:['P0174','P0101','P0300','P0172'],P0174:['P0171','P0101','P0300','P0175'],P0172:['P0175','P0171','P0300'],P0175:['P0172','P0174','P0300'],
 P0300:['P0301','P0302','P0303','P0304','P0171','P0420'],P0128:['P0125','P0116','P0117','P0118'],P0101:['P0100','P0102','P0103','P0171','P0174'],
 P0401:['P0400','P0402','P0404','P0405'],P0011:['P0012','P0014','P0016','P0017'],P0016:['P0017','P0018','P0019','P0011','P0335','P0340'],
 P0335:['P0336','P0340','P0016','P0300'],P0340:['P0341','P0335','P0016','P0011'],P0700:['P0715','P0730','P0741','P0750'],P0730:['P0731','P0732','P0733','P0734','P0700'],
 P0741:['P0740','P0700','P0730'],P0507:['P0505','P0506','P0171','P0101'],P0135:['P0141','P0155','P0161','P0420'],P0141:['P0135','P0161','P0420'],
 P0562:['P0563','P0620','P0560'],P0606:['P0605','P0601','P0603'],P0299:['P0234','P0101','P0171'],P0087:['P0088','P0190','P0171']};
function relatedCodes(c){const have=x=>CODEBY.get(x);const out=[],add=x=>{const k=have(x);if(k&&k!==c&&!out.includes(k))out.push(k)};
  for(const x of c.related||[])add(String(x).toUpperCase());for(const x of RELATED[c.code]||[])add(x);
  if(out.length<8){const same=CODES.filter(x=>x!==c&&x.sys===c.sys&&x.code[0]===c.code[0]&&!out.includes(x)),n=parseInt(c.code.slice(1),16);
    same.sort((a,b)=>Math.abs(parseInt(a.code.slice(1),16)-n)-Math.abs(parseInt(b.code.slice(1),16)-n)||a.code.localeCompare(b.code));
    for(const x of same){if(out.length>=8)break;out.push(x)}}
  return out}
// TC-21: what "bank" and "sensor" mean, on oxygen sensor, catalyst and fuel trim pages.
function bankNote(c){const t=c.title;const notes=[];
  if(/\bbank\s*[12]\b/i.test(t))notes.push('Bank 1 is the side of the engine with cylinder 1; four-cylinder engines have only one bank.');
  if(/\b(?:o2|oxygen|a\/f|air.fuel ratio) sensor\b/i.test(t)&&/\bsensor\s*[123]\b/i.test(t))notes.push('Sensor 1 is the oxygen sensor before the catalytic converter; Sensor 2 is after it.');
  return notes.length?`<p class="lmuted bank-note">${escH(notes.join(' '))}</p>`:''}
// TC-03: name the sources behind each page's causes and advice, not just the code-title standard.
// Parts-catalog code lists and slide uploads are not named as publishers (a09 R2): a code citing only those reads "not yet checked".
const WEAK_CODE_SRC=/(?:^|\.)(?:jhmbuttco\.com|slideshare\.net)$/i;
const srcHost=u=>{try{return new URL(u).hostname.toLowerCase()}catch{return ''}};
function codeSources(c){const names=[...new Set((c.src||[]).filter(u=>!WEAK_CODE_SRC.test(srcHost(u))).map(sourceName).filter(Boolean))];
  return `<p class="lsrc">Code title: SAE J2012 standard definition. ${names.length?'Causes and advice compiled from: '+names.map(escH).join(' · ')+'.':'Causes and advice: general guidance, not yet checked against a published source.'} Vehicle-specific notes are reported patterns, not confirmed for every vehicle.</p>${recallLine()}`}
// TC-07: how to get your codes read.
const CODEREAD='<section class="card csec coderead"><h2>How to get your code read</h2><p>Have more codes? Many auto parts stores will read your codes for free, or a basic OBD2 code reader plugs into the port under the dashboard on the driver\'s side. Write down every code, since the first one isn\'t always the cause.</p></section>';
const JT=Object.fromEntries(J.map(j=>[j.id,j]));
for(let k=0;k<CODES.length;k++){const c=CODES[k],low=c.code.toLowerCase(),u=CURG[c.sev];
  const fam=relatedCodes(c);
  const veh=(codeVeh[c.code]||[]).slice(0,10);const g=c.guide&&JT[c.guide];
  const drive=c.drive||(c.sev==='stop'?'Stop driving as soon as it is safe and have it checked before going further; this problem can cause damage or affect safety.':c.sev==='soon'?"If the check engine light flashes, or the engine runs rough, overheats, loses power or stalls, pull over when it's safe and turn the engine off. Otherwise get it checked in the next few days and drive gently until then.":"This code doesn't usually change how the car drives, but book a check. If other warning lights come on, or the car starts running or shifting differently, get it checked sooner.");
  // With an urgent condition shown first, the "Otherwise" text must only cover the non-urgent case.
  const otherwise=c.urgent_if?(drive.split(/(?<=\.)\s+/).filter(x=>!/flash|blink|shak|stall|overheat/i.test(x)).join(' ').replace(/^Otherwise,?\s+/i,'').replace(/^./,m=>m.toUpperCase())||'If none of that applies and the car drives normally, drive gently and get it checked in the next few days.'):drive;
  const testFirst=c.test_first||'A shop should confirm the fault with a scan tool and a few tests before replacing parts. The code points to where to test, not to a confirmed failed part.';
  const faq=[{q:`What does ${c.code} mean?`,a:c.plain},{q:`Can I drive with code ${c.code}?`,a:(c.urgent_if?c.urgent_if+' Otherwise: '+otherwise:drive)},{q:`What causes ${c.code}?`,a:'Common possibilities to test include: '+c.causes.slice(0,4).map(x=>x.name.toLowerCase()).join('; ')+'. A shop should confirm the cause before replacing parts.'}];
  const ld='<script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@type':'FAQPage',mainEntity:faq.map(f=>({'@type':'Question',name:f.q,acceptedAnswer:{'@type':'Answer',text:f.a}}))}).replace(/</g,'\\u003c')+'</script>\n';
  const inner=`<div class="crumb"><a href="/">Home</a> › <a href="/codes/">Code lookup</a> › ${c.code}</div>
<div class="ghead"><div class="eyebrow">${escH(famName(c.code))} code · ${escH(c.sys)}</div><h1><span class="code-big">${c.code}</span> ${escH(c.title)}</h1></div>
${c.urgent_if?`<div class="urg-first" role="alert"><b class="urg-first-h">Pull over now only if:</b> ${escH(c.urgent_if)}</div>`:''}<div class="urg ${u[1]}"><b>How urgent?</b> ${c.urgent_if?'Otherwise: ':''}${escH(u[0])}</div>
${BYLINE}<div id="codeMy"></div>
<section class="card csec"><h2>What it means</h2><p class="lead2">${escH(c.plain)}</p>${bankNote(c)}</section>
${CODEREAD}
<section class="card csec drivebox" style="border-left-color:${c.sev==='stop'||c.urgent_if?'#C62F37':c.sev==='soon'?'#D08700':'#0B63CE'}"><h2>Can I keep driving?</h2>${c.urgent_if?`<p><b>${escH(c.urgent_if)}</b></p><p>Otherwise: ${escH(otherwise)}</p>`:`<p>${escH(drive)}</p>`}</section>
<section class="card csec"><h2>What to test before replacing parts</h2><p>${escH(testFirst)}</p><ol class="nums">${c.checks.map(x=>`<li>${escH(x).replace(/the Bulletins page/g,'<a href="/bulletins/">the Bulletins page</a>')}</li>`).join('')}</ol></section>
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
${codeSources(c)}
<div class="trust">Trouble codes point to where a problem was detected, not always to the failed part. A scan and a few tests confirm the cause before parts are replaced. This is a general guide, not a diagnosis.</div>`;
  urls.push(page('/codes/'+low+'/',`${c.code}: ${c.title} — Can I Drive? | VehicleSymptoms.com`,(c.meta?c.meta:c.urgent_if?`${c.code}: ${urgShort(c.urgent_if)} ${c.plain}`:`${c.code} means: ${c.plain}`).replace(/^(.*)$/s,m=>clip(m,155)),{inner,pageData:ld}));
}
// TC-05: say plainly which kinds of codes aren't here yet (worked out from the codes that are).
function codeCoverage(){const n=re=>CODES.filter(c=>re.test(c.code)).length,b=n(/^B/),cc=n(/^C/),hy=n(/^P0[A-D]/),miss=[];
  if(b<50)miss.push((b?'Most body':'Body')+' (B) codes such as airbag faults');if(cc<50)miss.push('most chassis (C) codes such as ABS');if(hy<20)miss.push((hy?'most ':'')+'hybrid battery codes');miss.push('carmaker-specific codes');
  const list=miss.length>1?miss.slice(0,-1).join(', ')+' and '+miss[miss.length-1]:miss[0];
  return `${CODES.length.toLocaleString('en-US')} ${b+cc<50?'standard engine, transmission and network':'standard'} codes so far. ${list.charAt(0).toUpperCase()+list.slice(1)} aren't here yet.`}
if(CODES.length){
  const groups={};for(const c of CODES){const k=c.code.slice(0,3);(groups[k]=groups[k]||[]).push(c)}
  const common=CODES.filter(c=>c.common);
  const idx='window.CODE_INDEX='+JSON.stringify(CODES.map(c=>[c.code,c.title,c.sys])).replace(/</g,'\\u003c')+';';
  fs.writeFileSync('dist/codes-index.js',idx);
  urls.push(page('/codes/',`Car Trouble Code Lookup (OBD-II): ${CODES.length.toLocaleString('en-US')} Codes Explained | VehicleSymptoms.com`,'Look up OBD-II trouble codes like P0420 or P0300. Plain-English meaning, how urgent it is, common causes, and what to check first.',{pageData:'<script src="/codes-index.js"></script>\n',inner:`<div class="crumb"><a href="/">Home</a> › Code lookup</div>
<div class="ghead"><div class="eyebrow">Code lookup</div><h1>What does your trouble code mean?</h1><p class="sub">Type the code from your scanner or parts-store scan, like <b>P0420</b> or <b>P0300</b>. You'll get the meaning in plain English, how urgent it is, the likely causes and what to check first.</p></div>
<form class="codesearch" id="codeForm" autocomplete="off"><input id="codeQ" type="search" placeholder="Enter a code, e.g. P0420, or a word like misfire" aria-label="Trouble code"><button class="btn" type="submit">Look it up</button></form>
<div id="codeRes" class="glist" style="margin-top:12px"></div>
<p class="muted" style="font-size:14px">${codeCoverage()}</p>
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
 'master-warning-light':['check-engine-light','door-open-light'],
 // New lights (a03, Nov 27 2026). Entries for ids not in src/lights.js are skipped when the page is built.
 'glow-plug-light':['ev-plug-light'],'ev-plug-light':['glow-plug-light'],'reduced-power-light':['hybrid-system-light','wrench-light'],'hybrid-system-light':['reduced-power-light','check-engine-light'],
 'pre-collision-light':['lane-assist-light','brake-warning-light'],'check-fuel-cap-light':['check-engine-light'],'bulb-out-light':['master-warning-light'],
 'od-off-light':['transmission-warning-light'],'ready-light':['hybrid-system-light'],'auto-start-stop-light':['battery-light'],'washer-fluid-light':['low-fuel-light'],'key-battery-light':['security-light'],'security-light':['key-battery-light']};
const codeSet=new Set(CODES.map(c=>c.code));
const money=n=>'$'+Number(n).toLocaleString('en-US');
const rngC=(lo,hi)=>lo===0&&hi===0?'No charge':money(lo)+'–'+money(hi);
// Warning-light cause prices and diagnosis fees go through the same evidence gate.
const lPrice=(lid,c)=>{const id=EV.ids.light(lid,c.name),g=EV.priceQualifies(id);LEDGER.push({id,family:'light-cause',scope:'general (all vehicles)',job:c.name,lo:c.lo,hi:c.hi,status:g.ok?'shown':'withheld',reason:g.reason||''});return g.ok?rngC(c.lo,c.hi):'Price not verified'};
const lDiag=(lid,d)=>{const id=EV.ids.lightDiag(lid),g=EV.priceQualifies(id);LEDGER.push({id,family:'light-diagnosis',scope:'general (all vehicles)',job:'Diagnose '+lid,lo:d[0],hi:d[1],status:g.ok?'shown':'withheld',reason:g.reason||''});return g.ok?rngC(d[0],d[1]):null};
// T-10: search snippets lead with the action: "[light] on? [how urgent]. [first step]."
const LIGHTDESC={'oil-pressure-light':"Red oil pressure light on? Stop driving as soon as it's safe: pull over and shut the engine off. Low oil pressure can ruin the engine within minutes.",
 'brake-warning-light':"Red brake light on? Make sure the parking brake is fully released. If it stays on, stop driving as soon as it's safe. Low brake fluid or a brake fault is likely.",
 'check-engine-light':"Check engine light on? If it's flashing, pull over when it's safe and turn the engine off. If it's steady, check that the gas cap is tight and get it checked soon.",
 'battery-light':"Battery light on? Turn off what you don't need and drive only to a safe place off the road. If the gauge climbs or steering gets heavy, stop and turn the engine off."};
function lightDesc(l){if(l.metaDesc)return l.metaDesc;if(LIGHTDESC[l.id])return LIGHTDESC[l.id];
  const nm=l.name.replace(/ \(.*\)$/,'').replace(/ light$/i,' light');const col=l.color==='red'?'Red ':'';
  // A light's own stop condition beats its first step in the snippet.
  const first=l.stopIf?' Stop if '+String(l.stopIf).replace(/^stop if:?\s*/i,'').trim():l.todo&&l.todo[0]?' '+l.todo[0].replace(/\s+$/,''):'';return clip(`${col&&!/^red/i.test(nm)?col+nm.charAt(0).toLowerCase()+nm.slice(1):nm} on? ${lsev(l)[0]}.${first}`,155)}
for(const l of LIGHTS){const u=lsev(l);const gs=l.guides.filter(g=>JT[g]).map(g=>JT[g]);const cs=l.codes.filter(c=>codeSet.has(c));
  const d=LDEEP[l.id]||{};
  const animation = animations?.contextual(animations.guide.get(l.id)) || '';
  const faq=[{q:`What does the ${l.name.toLowerCase()} mean?`,a:l.meaning},{q:`Can I drive with the ${l.name.toLowerCase()} on?`,a:l.drive},...(d.faqs||[])];
  const ld='<script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@type':'FAQPage',mainEntity:faq.map(f=>({'@type':'Question',name:f.q,acceptedAnswer:{'@type':'Answer',text:f.a}}))}).replace(/</g,'\\u003c')+'</script>\n';
  const inner=`<div class="crumb"><a href="/">Home</a> › <a href="/warning-lights/">Warning lights</a> › ${escH(l.name)}</div>
<div class="lhead"><div class="lbig" style="border-color:${LCOL[l.color]}55">${lIcon(l,72)}</div><div><div class="eyebrow">${escH(l.color==='red'&&l.sev==='info'?'Red reminder light':LCOLNAME[l.color])}</div><h1>${escH(l.name)}</h1>${l.aka.length?`<p class="muted" style="margin:4px 0 0">Also called: ${l.aka.map(escH).join(', ')}</p>`:''}</div></div>
${FIRSTQ[l.id]?(f=>`<section class="card csec firstq" id="first"><h2>${escH(f.q)}</h2><p class="pg-sub">${escH(f.help)}</p><div class="fq-opts">${f.opts.map(o=>`<a class="fq-o ${o.cls}" href="${o.href}"><b>${escH(o.a)}</b><span>${escH(o.d)}</span></a>`).join('')}</div></section>`)(FIRSTQ[l.id]):''}
<div class="urg ${u[1]}"><b>How urgent?</b> ${FIRSTQ[l.id]?'If steady: ':''}${escH(u[0])}${l.stopIf?`<span class="urg-stopif"><b>Stop if:</b> ${escH(String(l.stopIf).replace(/^stop if:?\s*/i,''))}</span>`:''}${l.sev==='stop'&&l.todo.length?`<span class="urg-next"><b>First step:</b> ${escH(l.todo[0])} <a href="#todo">All steps</a></span>`:''}</div>
${BYLINE}<section class="card csec"><h2>What it means</h2><p class="lead2">${escH(l.meaning)}</p>${d.look?`<p class="lmuted">${escH(d.look)}</p>`:''}</section>
<section class="card csec drivebox" style="border-left-color:${LCOL[l.color]}"><h2>Can I keep driving?</h2><p>${escH(l.drive)}</p>${d.flash?`<p class="lflash"><b>If it's flashing or blinking:</b> ${escH(d.flash)}</p>`:''}</section>
<div class="cgrid"><section class="card csec" id="todo"><h2>What to do now</h2><ol class="nums">${l.todo.map(x=>`<li>${escH(x)}</li>`).join('')}</ol></section>
<section class="card csec"><h2>Common causes</h2><ul class="dots">${l.causes.map(x=>`<li>${escH(x)}</li>`).join('')}</ul></section></div>
${animation}
${d.diy&&d.diy.length?`<section class="card csec ldiy"><div class="pg-head"><h2>Checks you can do yourself</h2><span class="pg-badge">Safe, no tools in most cases</span></div>
<p class="pg-sub">Do these with the car parked and the engine off and cool. If anything looks or smells hot, wait.</p>
${d.diy.map((x,i)=>`<div class="diy"><div class="diy-n">${i+1}</div><div><b>${escH(x.t)}</b><p>${escH(x.how)}</p><span class="diy-m">${escH(x.mins)} · ${escH(x.tools)}</span></div></div>`).join('')}
</section>`:''}
${d.dont&&d.dont.length?`<section class="card csec ldont"><h2>What not to do</h2><ul class="xs">${d.dont.map(x=>`<li>${escH(x)}</li>`).join('')}</ul></section>`:''}
${d.causes2&&d.causes2.length?`<section class="card csec"><div class="pg-head"><h2>What it usually turns out to be</h2></div>
<p class="pg-sub">Most likely first.${SHOW_PRICES?' Prices are typical US parts-and-labor totals for that repair, not a quote for your vehicle.':''}</p>
${d.causes2.map(c=>`<div class="c2"><div class="c2-h"><b>${escH(c.name)}</b>${SHOW_PRICES?`<span class="c2-p">${lPrice(l.id,c)}</span>`:''}</div><p><span class="c2-l">How you can tell</span> ${escH(c.tell)}</p><p><span class="c2-l">The repair</span> ${escH(c.fix)}</p></div>`).join('')}
${SHOW_PRICES&&d.diag&&lDiag(l.id,d.diag)?`<p class="lsoon-note">A shop usually charges ${lDiag(l.id,d.diag)} just to diagnose this light, and many put that toward the repair.</p>`:''}</section>`:''}
${d.shop?`<section class="card csec"><h2>What a shop will do</h2><p>${escH(d.shop)}</p></section>`:''}
${d.reset?`<section class="card csec lreset" id="reset"><h2>${d.reset.real?'How to reset this light':'Can I reset this light?'}</h2><p>${d.reset.real?escH(d.reset.how):'<b>No. This light goes out when the problem is fixed.</b> '+escH(String(d.reset.how).replace(/^No\.\s*This light goes out when the problem is fixed\.\s*/i,''))}</p>${d.reset.note?`<p class="lmuted">${escH(d.reset.note)}</p>`:''}
${d.reset.real?(Object.keys(RESETS).length&&/oil|service|maint|tire|tyre/i.test(l.id)?`<div class="lsoon"><p class="eyebrow">Step by step</p><b>Pick your make for the button sequence</b><div class="mkrow">${Object.keys(RESETS).sort((a,b)=>RESETS[a].make.localeCompare(RESETS[b].make)).map(m=>`<a href="/warning-lights/reset/${m}/">${escH(RESETS[m].make)}</a>`).join('')}</div><p class="lsoon-note">Exact steps for every single year and model are still being added. If your make isn't here yet, your owner's manual has the sequence.</p></div>`:`<div class="lsoon"><p class="eyebrow">Exact steps</p><b>Reset steps for your exact vehicle</b><p>The button sequence varies by make, model and year. Your owner's manual has the exact steps for your car.</p></div>`):''}</section>`:''}
${gs.length?`<section class="csec"><h2 style="font-size:18px">Walk through it step by step</h2><div class="glist">${gs.map(g=>`<a class="gcard" href="/symptoms/${g.id}/"><b>${escH(g.title)}</b><span>${escH(g.h1)}</span></a>`).join('')}</div></section>`:''}
${cs.length?`<section class="csec"><h2 style="font-size:18px">Trouble codes often stored with this light</h2><div class="codechips">${cs.map(c=>{const x=CODES.find(y=>y.code===c);return `<a href="/codes/${c.toLowerCase()}/"><b>${c}</b> ${escH(x.title)}</a>`}).join('')}</div></section>`:''}
<section class="csec"><h2 style="font-size:18px">Common questions</h2>${faq.map((f,i)=>`<details class="faq"${i===0?' open':''}><summary>${escH(f.q)}</summary><p>${escH(f.a)}</p></details>`).join('')}</section>
${d.src&&d.src.length?`<p class="lsrc">Sources: ${sourceCredits(d.src)}</p>`:''}
${(SEE[l.id]||[]).some(x=>LIGHTS.some(y=>y.id===x))?`<section class="csec"><h2 style="font-size:18px">Not your light? These get mixed up with it</h2><div class="lrow">${(SEE[l.id]||[]).map(x=>LIGHTS.find(y=>y.id===x)).filter(Boolean).map(x=>`<a class="lr" href="/warning-lights/${x.id}/">${lIcon(x,34)}<b>${escH(x.name.replace(/ (warning )?light$/i,''))}</b><span class="lsev ${LSEV[x.sev][1]}">${escH(LSEV[x.sev][0])}</span></a>`).join('')}</div></section>`:''}
<div class="trust">Symbols vary a little between makes. Your owner's manual shows the exact lights for your vehicle. This is a general guide, not a diagnosis.</div>`;
  urls.push(page('/warning-lights/'+l.id+'/',`${l.name}: What It Means & Can You Drive? | VehicleSymptoms.com`,lightDesc(l),{inner,pageData:ld+(animation ? animationScript : '')}));
}
// How people describe the symbols ("oil can", "thermometer", "horseshoe"), so the light search finds them.
const LSHAPE={'check-engine-light':'engine motor cel mil service engine soon engine shape','oil-pressure-light':'oil can genie lamp dripping','engine-temperature-light':'thermometer temp temperature coolant hot overheating overheat water waves',
 'battery-light':'battery charging alternator','brake-warning-light':'brake exclamation circle parentheses','abs-light':'abs antilock brakes','airbag-light':'airbag air bag srs person seat ball',
 'tire-pressure-light':'tire tyre horseshoe tpms exclamation flat pressure','traction-control-light':'skid skidding squiggly wavy lines swerving slip esc esp vsc tcs traction stability',
 'power-steering-light':'steering wheel eps','transmission-warning-light':'gear transmission thermometer','coolant-level-light':'coolant level radiator','low-fuel-light':'fuel gas pump gas station empty',
 'seat-belt-light':'seatbelt seat belt person','master-warning-light':'triangle exclamation','security-light':'key lock car with lock immobilizer theft','service-light':'wrench spanner service',
 'door-open-light':'door ajar open','key-battery-light':'key fob remote','4wd-light':'4wd awd 4x4 four wheel drive','high-beam-light':'headlight high beam brights blue','cruise-control-light':'cruise speedometer',
 'parking-brake-light':'handbrake hand brake emergency brake parking brake p','electronic-parking-brake-light':'epb parking brake p auto hold','oil-level-light':'oil level add oil','oil-change-light':'oil change oil life',
 'washer-fluid-light':'washer windshield wiper fluid','glow-plug-light':'coil spiral diesel glow plug','def-light':'def adblue diesel exhaust fluid','dpf-light':'dpf particulate filter diesel',
 'lane-assist-light':'lane camera collision','blind-spot-light':'blind spot mirror','brake-pad-wear-light':'brake pad wear','maintenance-required-light':'maint reqd maintenance wrench',
 'stability-control-off-light':'esc off vsc off tcs off skid off','slip-indicator-light':'slip vdc','esp-bas-light':'esp bas','exhaust-emission-light':'exhaust emission','epc-light':'epc',
 'hybrid-system-light':'hybrid car exclamation','water-in-fuel-light':'water fuel wif','wrench-light':'wrench reduced power ford'};
const lkeys=l=>[l.name,...(l.aka||[]),LSHAPE[l.id]||'',l.keywords||''].join(' ').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
// The homepage search checks dashboard lights too (a01, RS-09): [id, name, color, sev, keywords], the same keywords as the hub's data-k.
fs.appendFileSync('dist/guide-index.js','window.LIGHT_INDEX='+JSON.stringify(LIGHTS.map(l=>[l.id,l.name,l.color,l.sev,lkeys(l)])).replace(/</g,'\\u003c')+';\n');
const lcard=l=>`<a class="lcard c-${l.color}" href="/warning-lights/${l.id}/${FIRSTQ[l.id]?'#first':''}" data-c="${l.color}" data-k="${escH(lkeys(l))}">${lIcon(l,44)}<b>${escH(l.name.replace(/ \(.*\)$/,''))}</b>${FIRSTQ[l.id]?`<span class="lsev lq">${escH(FIRSTQ[l.id].card)}</span>`:`<span class="lsev ${lsev(l)[1]}">${escH(lsev(l)[0])}</span>`}</a>`;
urls.push(page('/warning-lights/','Dashboard Warning Lights: What Each Light Means | VehicleSymptoms.com','Every common dashboard warning light explained: what it means, whether you can keep driving, and what to do now. Red, amber, green and blue lights.',{inner:`<div class="crumb"><a href="/">Home</a> › Warning lights</div>
<div class="ghead"><div class="eyebrow">Warning lights</div><h1>Which light is on?</h1><p class="sub">Tap the symbol that matches your dashboard. Each light tells you what it means, how urgent it is, what you can check yourself and how to reset it when resetting is the right thing to do.</p></div>
<p class="lflash-tip"><b>Light flashing?</b> A flashing red light or a flashing check engine light is more urgent than a steady one.</p>
<div class="lkey"><span><i style="background:#FF5A5F"></i>Red: serious, act now</span><span><i style="background:#FFB020"></i>Amber: check soon</span><span><i style="background:#34C77B"></i>Green or blue: information</span></div>
<div class="codesearch"><input id="lsearch" type="search" placeholder="Search a light by name, like &quot;oil&quot; or &quot;ABS&quot;" aria-label="Search warning lights"></div>
<div class="lfilter" id="lfilter" role="group" aria-label="Filter lights by color"><button class="on" data-c="all" aria-pressed="true">All</button><button data-c="red" aria-pressed="false">Red</button><button data-c="amber" aria-pressed="false">Amber</button><button data-c="info" aria-pressed="false">Green / blue</button></div><p class="lcount" id="lcount" role="status" aria-live="polite"></p>
<div class="lgrid" id="lgrid">${[...LIGHTS].sort((a,b)=>{const r={stop:0,soon:1,check:2,info:3};const k=l=>r[l.sev]-(l.sevClass==='high'?0.5:0);return k(a)-k(b)||a.name.localeCompare(b.name)}).map(lcard).join('')}</div>
<div class="lnone" id="lnone" hidden></div>
${LIGHTS.some(l=>(LDEEP[l.id]||{}).reset&&LDEEP[l.id].reset.real)?`<section class="csec"><h2 style="font-size:18px">Service and reminder lights you can reset</h2><p class="pg-sub">Service reminders come on by mileage or time and are meant to be reset once the work is done. Tire pressure, DEF and DPF lights are different: they mean something needs attention, so fix the cause first and reset only after. ${Object.keys(RESETS).length?`<a href="/warning-lights/reset/">Reset steps by make</a>.`:''}</p><div class="glist">${LIGHTS.filter(l=>(LDEEP[l.id]||{}).reset&&LDEEP[l.id].reset.real).map(l=>`<a class="gcard" href="/warning-lights/${l.id}/#reset"><b>${escH(l.name)}</b><span>How to reset it</span></a>`).join('')}</div></section>`:''}
<p class="muted" style="margin-top:18px;font-size:14px">Several lights on at once, or the whole dash lit up? See <a href="/symptoms/dashboard-lights-all-on/" style="color:var(--blue2)">all dashboard lights on</a>. Got a code from a scanner? Use <a href="/codes/" style="color:var(--blue2)">Code lookup</a>.</p>`}));
console.log(`${LIGHTS.length} warning lights`);
// ---------- reset pages (src/resets.json) ----------
const EVMAKE=m=>/^(tesla|rivian|polestar|lucid)$/.test(m);
// R-05: the years a model's checked steps actually cover, e.g. "2014" or "2013–2015, 2018".
const yrs=list=>{const ys=new Set();for(const x of list)for(let y=x.years[0];y<=x.years[1];y++)ys.add(y);const a=[...ys].sort((p,q)=>p-q),out=[];
  for(let i=0;i<a.length;){let j=i;while(j+1<a.length&&a[j+1]===a[j]+1)j++;out.push(a[i]===a[j]?String(a[i]):a[i]+'–'+a[j]);i=j+1}return out.join(', ')};
// R-09: safety first on the reset pages.
const RESET_FIRST=`<div class="safety reset-first" id="before-reset"><b>Before you reset anything:</b><ul>${["If a tire looks flat or has a bulge, don't drive on it. Use the spare or call for help.",
 "Fill tires when cold to the pressure on the sticker in the driver's door jamb, not the bigger number on the tire sidewall.",
 "If the tire light flashes for about a minute (60–90 seconds) when you start the car and then stays on, the warning system itself is faulty. A reset won't fix it, so check all four tires with a gauge and have it inspected.",
 "A red oil-can light means low oil pressure, not an oil-change reminder: stop the engine and don't reset anything."].map(t=>`<li>${escH(t)}</li>`).join('')}</ul></div>`;const oilWord=m=>EVMAKE(m)?'maintenance':'oil change';
if(Object.keys(RESETS).length){
  const mkeys=Object.keys(RESETS).sort((a,b)=>RESETS[a].make.localeCompare(RESETS[b].make));
  const varBlock=(s,title)=>s?`<section class="card csec"><h2>${escH(title)}</h2>${s.variants.map((x,i)=>`<div class="rvar"><div class="rv-h"><span class="rv-n">${i+1}</span><b>${escH(x.when)}</b></div><ol class="nums">${x.steps.map(t=>`<li>${escH(t)}</li>`).join('')}</ol>${x.note?`<p class="lmuted">${escH(x.note)}</p>`:''}</div>`).join('')}${s.src&&s.src.length?`<p class="lsrc">Sources: ${sourceCredits(s.src)}</p>`:''}</section>`:'';
  for(const m of mkeys){const r=RESETS[m];const models=V.filter(v=>v.make===r.make);
    // R-15: the structured-data answer says which models/years its steps are for, and that others differ.
    const faqA=x=>x&&x.variants[0]&&x.variants[0].steps?(x.variants[0].when?x.variants[0].when+': ':'')+x.variants[0].steps.join(' ')+' Steps differ by model and year; see the page for others.':'';
    const faq=[{q:`How do I reset the oil change light on ${/^[aeiou]/i.test(String(r.make))?'an':'a'} ${r.make}?`,a:faqA(r.oil)},
               {q:`How do I reset the tire pressure light on ${/^[aeiou]/i.test(String(r.make))?'an':'a'} ${r.make}?`,a:faqA(r.tpms)}].filter(f=>f.a);
    const ld=faq.length?'<script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@type':'FAQPage',mainEntity:faq.map(f=>({'@type':'Question',name:f.q,acceptedAnswer:{'@type':'Answer',text:f.a}}))}).replace(/</g,'\\u003c')+'</script>\n':'';
    const inner=`<div class="crumb"><a href="/">Home</a> › <a href="/warning-lights/">Warning lights</a> › <a href="/warning-lights/reset/">Reset a light</a> › ${escH(r.make)}</div>
<div class="ghead"><div class="eyebrow">Reset a light after the work is done</div><h1>How to reset the ${oilWord(m)} and tire pressure lights on ${/^[aeiou]/i.test(String(escH(r.make)))?'an':'a'} ${escH(r.make)}</h1>
<p class="sub">The ${oilWord(m)} message is a reminder: do the service first, then reset it. The tire pressure light is a warning: it means a tire is low, or, if it flashed for about a minute before staying on, the monitoring system has a fault. Check and set every tire's pressure first, and have the system checked if it flashed. Clearing a warning does not fix anything.</p></div>
${BYLINE}
${RESET_FIRST}
${varBlock(r.oil,EVMAKE(m)?'Maintenance reminder':'Oil change or maintenance reminder')}
${varBlock(r.tpms,'Tire pressure (TPMS) light')}
${r.notes?`<section class="card csec"><h2>Worth knowing on ${/^[aeiou]/i.test(String(escH(r.make)))?'an':'a'} ${escH(r.make)}</h2><p>${escH(r.notes)}</p></section>`:''}
<section class="csec"><h2 style="font-size:18px">If the light comes straight back</h2><div class="glist"><a class="gcard" href="/warning-lights/oil-change-light/"><b>Oil change light</b><span>What it means and what it is not</span></a><a class="gcard" href="/warning-lights/tire-pressure-light/"><b>Tire pressure light</b><span>Low air, a leak, or a dead sensor</span></a><a class="gcard" href="/warning-lights/check-engine-light/"><b>Check engine light</b><span>A fault, not a reminder</span></a></div></section>
${models.some(v=>v.reset)?`<section class="csec"><h2 style="font-size:18px">Model-specific steps we've checked</h2><p class="pg-sub">Checked against the owner's manual or the maker for the years shown. For other years, use the steps above or your owner's manual.</p><div class="mgrid">${models.filter(v=>v.reset).map(v=>`<a href="/vehicles/${v.id}/#reset">${escH(v.model)}<span>${[v.reset.oil.length?(EVMAKE(m)?'maintenance ':'oil ')+yrs(v.reset.oil):'',v.reset.tpms.length?'tire light '+yrs(v.reset.tpms):''].filter(Boolean).join(' · ')}</span></a>`).join('')}</div></section>`:''}
${models.filter(v=>!v.reset).length?`<section class="csec"><h2 style="font-size:18px">${models.some(v=>v.reset)?'Other ':''}${escH(r.make)} models on the site</h2><div class="mgrid">${models.filter(v=>!v.reset).map(v=>`<a href="/vehicles/${v.id}/">${escH(v.model)}<span>${v.years[0]}–${v.years[1]}</span></a>`).join('')}</div></section>`:''}
<div class="trust">Button sequences vary by model year and trim. Your owner's manual is the final word for your exact vehicle. If a reminder will not clear after the service, something else is setting it. If the tire pressure light flashes and then stays on, the system has a fault, and resetting will not fix it.</div>`;
    urls.push(page('/warning-lights/reset/'+m+'/',`How to Reset the ${EVMAKE(m)?'Maintenance':'Oil Change'} & Tire Pressure Light on ${/^[aeiou]/i.test(String(r.make))?'an':'a'} ${r.make} | VehicleSymptoms.com`,`Step-by-step: reset the ${r.make} ${EVMAKE(m)?'maintenance':'oil change or maintenance'} reminder and the tire pressure (TPMS) light, in plain English, free.`.slice(0,165),{inner,pageData:ld}));}
  urls.push(page('/warning-lights/reset/','How to Reset a Service or Tire Pressure Light | VehicleSymptoms.com','Reset the oil change, maintenance and tire pressure lights by make. Plain-English steps, free, no sign-up.',{inner:`<div class="crumb"><a href="/">Home</a> › <a href="/warning-lights/">Warning lights</a> › Reset a light</div>
<div class="ghead"><div class="eyebrow">Reset a light after the work is done</div><h1>Which make are you resetting?</h1><p class="sub">The oil change or maintenance message is a reminder: do the service, then reset it. The tire pressure light is a warning that a tire is low or, if it flashed first, that the system has a fault. Fix the cause first, then reset it if your car needs it.</p></div>
<div class="lrow">${mkeys.map(m=>`<a class="lr lr-all" href="/warning-lights/reset/${m}/"><b>${escH(RESETS[m].make)}</b><span>${[RESETS[m].oil?(EVMAKE(m)?'Maintenance':'Oil change'):'',RESETS[m].tpms?'tire pressure':''].filter(Boolean).join(' · ').replace(/^t/,'T')||'Reminder notes'}</span></a>`).join('')}</div>
<section class="csec"><h2 style="font-size:18px">Lights you should not just clear</h2><p class="pg-sub">A check engine light, an oil pressure light, a brake light or an airbag light is a fault. Clearing it hides the warning until the fault sets it again.</p><div class="glist">${['check-engine-light','oil-pressure-light','brake-warning-light','airbag-light'].map(id=>{const l=LIGHTS.find(x=>x.id===id);return l?`<a class="gcard" href="/warning-lights/${id}/"><b>${escH(l.name)}</b><span>${escH(lsev(l)[0])}</span></a>`:''}).join('')}</div></section>`}));
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
urls.push(page('/symptoms/','All Car Symptom Guides | VehicleSymptoms.com','Step-by-step guides for car problems: won\'t start, warning lights, noises, shaking, leaks, smells, smoke, overheating and more.',{inner:`<div class="crumb"><a href="/">Home</a> › Symptom guides</div><div class="ghead"><h1>Symptom guides</h1><p class="sub">Pick what your car is doing. Each guide asks a few quick questions and tells you how urgent it is and what to do next.</p></div><div id="guideHub">${Object.entries(GL).map(([k,l])=>{const list=J.filter(j=>j.group===k);return list.length?`<section class="hubsec" id="${k}"><h2>${escH(l)}</h2>${SHOW_SOUNDS&&k==='noise'?'<p><a href="/sounds/">Listen to a car sound</a></p>':''}<div class="glist">${list.map(j=>`<a class="gcard" href="/symptoms/${j.id}/"><b>${escH(j.title)}</b><span>${escH(j.h1)}</span></a>`).join('')}</div></section>`:''}).join('')}</div>`}));

// privacy, about / our standards
urls.push(page('/privacy/','Privacy | VehicleSymptoms.com','How VehicleSymptoms.com handles your information.',{inner:`<div class="crumb"><a href="/">Home</a> › Privacy</div><div class="ghead"><h1>Privacy</h1><p class="sub">Short version: we collect as little as possible and never sell your information.</p></div>
<div class="card prose"><h2>No account, no sign-up</h2><p>You can use everything on the site without an account.</p>
<h2>"My garage" and saved progress</h2><p>If you save a vehicle to "My garage", or start a symptom guide, those details are stored only in your own browser on your device (browser local storage and session storage). They are not sent to us, unless you choose to email yourself a result (below). To clear them, tap Remove next to a vehicle in My garage (on the homepage) or Remove from garage on the vehicle's page, or clear this site's data in your browser settings.</p>
<h2>Emailing yourself a result</h2><p>This is the one time anything from a guide leaves your device. If you ask us to email you a result, we send your email address, the guide, your answers and, if you picked one, your vehicle and year to our email provider, Resend, to build and send that one email. We don't add your address to any contact or mailing list, we don't send you marketing email, and these addresses are never used for outreach. Resend keeps its own delivery records as its privacy policy describes.</p>
<h2>VIN and recall lookups</h2><p>VINs are decoded directly by the U.S. government's free NHTSA database from your browser. We don't store them. Recall information comes from NHTSA's public database.</p><p><b>Recall lookups.</b> Your browser asks NHTSA's public database directly for your vehicle's make, model and year, so NHTSA sees your IP address as with any website.</p>
<h2>Offline copies</h2><p>To work with no signal, the site saves its warning-light and roadside guides, and pages you open, in your browser on this device. Clear them by clearing this site's data.</p>
<h2>Hosting</h2><p>Our host, Vercel, processes IP addresses to deliver pages. When you email yourself a result, your IP address is held briefly to stop abuse and is not stored.</p>
${animations ? '<h2>Repair animations</h2><p>Opening an animation loads the MotoVisuals player. Your browser connects to MotoVisuals and sends the site origin so it can check the approved domain.</p>' : ''}
<h2>Visitor statistics</h2><p>We use Vercel Web Analytics to count page views and visits. It doesn't use cookies and doesn't identify you personally. We count which guides reach a result; no personal data, and never what you type.</p>
<h2>Links to other sites</h2><p>A few pages link to U.S. government sites (such as NHTSA.gov), AAA or a carmaker's owner's manual so you can check a fact or look up your VIN. Those links open the other site in a new tab, and that site's own privacy policy applies there.</p>
<h2>Selling or sharing</h2><p>We don't sell or rent your personal information. We don't run ads or affiliate links.</p>
<p class="muted">Last updated November 2026.</p></div>`}));
urls.push(page('/about/','About VehicleSymptoms.com','What VehicleSymptoms.com is and how our guides work.',{inner:`<div class="crumb"><a href="/">Home</a> › About</div><div class="ghead"><div class="eyebrow">About</div><h1>About VehicleSymptoms.com</h1><p class="sub">Free, plain-English help for drivers with a car problem: what to check, how urgent it may be and what to ask a mechanic.</p></div>
<div class="card prose"><h2>How we work</h2>
<ul><li><b>Guidance, not a diagnosis.</b> A website can't inspect your car. Possible causes are directions for testing, and we say what a shop should test before replacing parts.</li>
<li><b>Safety first.</b> When symptoms point to a possible brake, steering, fire or engine-damage risk, we tell you to stop and get help.</li>
<li><b>Honest about gaps.</b> If we haven't documented problems for a vehicle or year, we say so. A short list is not a reliability rating.</li>
<li><b>Where our information comes from.</b> Guides draw on NHTSA safety and recall data, owner's manuals and published service and safety information. Each page lists its sources, and we update pages when we find something better.</li>
<li><b>Free, no sign-up.</b> No ads and no affiliate links.</li></ul></div>`}));
// ---------- /bulletins/: what a technical service bulletin is (07-tsb-plan.md §5c) ----------
urls.push(page('/bulletins/',"What's a Technical Service Bulletin (TSB)? | VehicleSymptoms.com","A bulletin is the carmaker's note to dealers about a known problem and its fix. It isn't a recall. Here's how to use one at the dealer.",{inner:`<div class="crumb"><a href="/">Home</a> › Bulletins</div>
<div class="ghead"><div class="eyebrow">Manufacturer bulletins</div><h1>What's a "bulletin" (TSB)?</h1></div>
<div class="safety"><b>A bulletin is not a recall. If your car has an open recall, that comes first.</b></div>
${recallLine('recall-first')}
<div class="card prose"><p>A technical service bulletin is a note from the car's maker to its dealers that says: "We've seen this problem on these cars, and here's how to fix it."</p>
<ul><li><b>It's not a recall.</b> Recalls are for safety defects, and the recall repair is usually covered by the maker. A bulletin is usually for problems that are annoying or costly but not a safety recall.</li>
<li><b>The fix may not be covered.</b> It may be covered if your car is still under warranty. Sometimes the maker offers an <b>extended warranty</b> or <b>"special coverage"</b> for one part, and then it may be covered even on an older car. If not, you may have to pay.</li>
<li><b>How to use it:</b> Tell the dealer, "I think bulletin [number] matches my problem. Can you check my VIN?" Write the number down or show this page.</li>
<li><b>If you already paid</b> for a repair that later got special coverage, ask the maker about reimbursement.</li>
<li>Every bulletin here links to the copy the maker filed with the U.S. government's safety agency, NHTSA.</li></ul>
${tsbN?'<p>Bulletins we have checked show on your vehicle\'s year page, under "Known fixes from the manufacturer", below any urgent safety items.</p>':'<p>We are adding bulletins model by model. They will show on your vehicle\'s year page, below any urgent safety items.</p>'}</div>
<section class="srcs-sec"><h2 style="font-size:18px">Sources</h2><ul class="srcs"><li>Consumer Reports: How to get a technical service bulletin (TSB) repair</li><li>${extLink('https://www.nhtsa.gov/nhtsa-datasets-and-apis','National Highway Traffic Safety Administration (NHTSA): Datasets and APIs, including manufacturer communications').replace('<a ','<a data-va="nhtsa_open" ')}</li></ul></section>
<div class="trust">Whether a bulletin applies to your car depends on its VIN, engine and history. Only a dealer can confirm it and say what's covered.</div>`}));
// ---------- /roadside/ hub and pages (contract 1). Urgent steps first, big tap targets, linked sources. ----------
const RSLABEL={stop:'Act now',soon:'Act soon',info:'Good to know'};
const PRINTABLE=new Set(['emergency-kit']);// pages with a "Print this list" button and a checklist print layout
const rsRelated=id=>{const r=RS.find(x=>x.id===id);if(r)return {href:'/roadside/'+r.id+'/',t:r.title,d:RSLABEL[r.danger]};const j=JT[id];if(j)return {href:'/symptoms/'+j.id+'/',t:j.title,d:j.h1};
  const l=LIGHTS.find(x=>x.id===id);if(l)return {href:'/warning-lights/'+l.id+'/',t:l.name,d:lsev(l)[0]};console.log('roadside related id not found:',id);return null};
const RSTRUST='<div class="trust">This is general safety information, not a replacement for emergency help. If anyone is hurt, you see smoke or fire, or you are stuck in a traffic lane, call 911.</div>';
if(HAS_RS){
  const hub=RSHUB||{h1:'Stuck on the road?',intro:"If you're on the road right now: turn on your hazard lights and get off the road if you can. If anyone is hurt, you see smoke, or you're stuck in a traffic lane, call 911."};
  urls.push(page('/roadside/',`${hub.h1.replace(/[?.!]$/,'')}: What to Do Right Now | VehicleSymptoms.com`,hub.metaDesc||clip(hub.intro,155),{inner:`<div class="crumb"><a href="/">Home</a> › Roadside help</div>
<div class="ghead"><div class="eyebrow">Roadside help</div><h1>${escH(hub.h1)}</h1></div>
<div class="rs-first rs-stop"><p>${escH(hub.intro)}</p></div>
<h2 class="rs-pick">What's happening?</h2>
<div class="rs-tiles">${RS.map(r=>`<a class="rs-tile rs-${r.danger}" href="/roadside/${r.id}/"><b>${escH(r.tile)}</b><span>${RSLABEL[r.danger]}</span></a>`).join('')}</div>
${(hub.whoToCall||[]).length?`<section class="card csec rs-who"><h2>Who to call</h2><ul class="dots">${hub.whoToCall.map(t=>`<li>${escH(t)}</li>`).join('')}</ul></section>`:''}
<p class="muted" style="font-size:14px">A warning light on the dash? See <a href="/warning-lights/" style="color:var(--blue2)">warning lights</a>. Something else? <a href="/symptoms/" style="color:var(--blue2)">Start with what the car is doing</a>.</p>
${(hub.sources||[]).length?`<section class="srcs-sec"><h2 style="font-size:18px">Sources</h2><ul class="srcs">${sourceList(hub.sources)}</ul></section>`:''}
${RSTRUST}`}));
  for(const r of RS){const rel=(r.related||[]).map(rsRelated).filter(Boolean);
    // Warning lights named by the page: red first, then amber, then the rest.
    const lts=(r.lights||[]).map(id=>{const l=LIGHTS.find(x=>x.id===id);if(!l)console.log('roadside light id not found:',r.id,id);return l}).filter(Boolean)
      .map((l,k)=>[l,k]).sort((a,b)=>(({red:0,amber:1})[a[0].color]??2)-(({red:0,amber:1})[b[0].color]??2)||a[1]-b[1]).map(x=>x[0]);
    urls.push(page('/roadside/'+r.id+'/',`${r.title} | VehicleSymptoms.com`,r.metaDesc,{inner:`<div class="crumb"><a href="/">Home</a> › <a href="/roadside/">Roadside help</a> › ${escH(r.title)}</div>
<div class="ghead rs-head${PRINTABLE.has(r.id)?' rs-printable':''}"><div class="eyebrow">Roadside help</div><h1>${escH(r.h1)}</h1></div>
<section class="rs-first rs-${r.danger}" id="first" aria-labelledby="rs-first-h"><h2 id="rs-first-h">Do this first</h2><ol class="rs-list">${r.first.map(t=>`<li>${escH(t)}</li>`).join('')}</ol></section>
${(r.dont||[]).length?`<section class="rs-dont" aria-labelledby="rs-dont-h"><h2 id="rs-dont-h">Don't</h2><ul class="xs">${r.dont.map(t=>`<li>${escH(t)}</li>`).join('')}</ul></section>`:''}
${(r.call||[]).length?`<section class="rs-call" aria-labelledby="rs-call-h"><h2 id="rs-call-h">When to call for help</h2><ul class="dots">${r.call.map(t=>`<li>${escH(t)}</li>`).join('')}</ul></section>`:''}
${(r.steps||[]).length?`<section class="card csec rs-how"><h2>${r.id==='emergency-kit'?'The list':'Step by step'}</h2>${r.steps.map(x=>`<div class="rs-step"><h3>${escH(x.h)}</h3><p>${escH(x.t)}</p></div>`).join('')}${PRINTABLE.has(r.id)?'<p class="rs-print-row"><button type="button" class="btn rs-print" onclick="window.print()">Print this list</button></p>':''}</section>`:''}
${lts.length?`<section class="csec rs-lights"><h2 style="font-size:18px">Dashboard lights for this</h2><div class="lrow">${lts.map(x=>`<a class="lr" href="/warning-lights/${x.id}/">${lIcon(x,34)}<b>${escH(x.name.replace(/ (warning )?light$/i,''))}</b><span class="lsev ${lsev(x)[1]}">${escH(lsev(x)[0])}</span></a>`).join('')}</div></section>`:''}
${rel.length?`<section class="csec rs-related"><h2 style="font-size:18px">Related help</h2><div class="glist">${rel.map(x=>`<a class="gcard" href="${x.href}"><b>${escH(x.t)}</b><span>${escH(x.d)}</span></a>`).join('')}</div></section>`:''}
<section class="srcs-sec rs-srcs"><h2 style="font-size:18px">Sources</h2><ul class="srcs">${sourceList(r.sources)}</ul></section>
<p class="rs-back-row"><a class="rs-back" href="/roadside/">← All roadside help</a></p>
${RSTRUST}`}))}
}

// Model guides selected from the November Search Console report.
const modelSearchCopy = {
  "honda-accord": ["Honda Accord Common Problems by Year", "Looking at a used Honda Accord? Choose a model year to see reported problems, symptoms to watch for and questions to ask before buying."],
  "mazda-mazda6": ["Mazda6 Common Problems by Year, Including 2016", "Explore common Mazda6 problems by model year. Select the 2016 Mazda6 or another year to check symptoms and see what to ask a mechanic."],
  "mercedes-benz-c-class": ["Mercedes-Benz C-Class Common Problems by Year", "Researching a used Mercedes-Benz C-Class? Choose the model year, then check which listed issues match the engine and symptoms of the car you are considering."],
  "audi-q5": ["Used Audi Q5 Common Problems by Model Year", "Compare reported Audi Q5 problems by year. Choose the year of a used Q5 to review symptoms and questions to bring to a pre-purchase inspection."],
  "honda-civic": ["Used Honda Civic Common Problems by Year", "Choose a Honda Civic model year to see reported faults, the symptoms a driver might notice and what to ask about a used Civic."],
};

// vehicle pages
let noindexYears=0;
for(const v of V){
  const nm=v.make+' '+v.model;
  const render=y=>{RW.eval(`state.q='';state.tab='All';renderVehicle(VEHICLES.find(x=>x.id==='${v.id}'),${y||null})`);return RW.document.getElementById('vehicleView').innerHTML};
  const copy = modelSearchCopy[v.id];
  const title = copy ? copy[0] : `${nm} Common Problems by Model Year`;
  urls.push(page(`/vehicles/${v.id}/`,`${title} | VehicleSymptoms.com`,copy?.[1] ?? `Known ${nm} problems from ${v.years[0]} to ${v.years[1]}: ${v.issues.slice(0,3).map(i=>i.t.toLowerCase()).join('; ')}. Symptoms, causes and what to do.`,{inner:render(null)}));
  for(let y=v.years[0];y<=v.years[1];y++){if(!sold(v,y))continue;
    const nm=v.make+' '+modelAt(v,y);
    const is=v.issues.filter(i=>issueInYear(v,i,y));
    const systems = [...new Set(is.map(issue => issue.sys).filter(Boolean))];
    const subject = systems.length ? systems.slice(0, 2).join(' & ') + ' Problems' : 'Symptoms & Recall Lookup';
    // T-12: a year with no documented problems stays reachable but is kept out of search results and the sitemap.
    const yp=page(`/vehicles/${v.id}/${y}/`,`${y} ${nm}: ${subject} | VehicleSymptoms.com`,
      (is.length?`${is.length} known problem${is.length>1?'s':''} for the ${y} ${nm}: ${is.slice(0,3).map(i=>i.t.toLowerCase()).join('; ')}. Plus safety recalls and what to do.`:`Safety recall lookup and symptom guides for the ${y} ${nm}. We haven't documented model-specific problems for this year yet.`),{inner:render(y),noindex:!is.length});
    if(is.length)urls.push(yp);else noindexYears++;
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
 for(const l of LIGHTS)if(l.sev==='stop'||l.sev==='soon'){const r='/warning-lights/'+l.id+'/';add(lsev(l)[0],r+'#badge','light-badge');add(l.drive,r+'#drive','light-drive');const d=LDEEP[l.id]||{};if(d.flash)add(d.flash,r+'#flash','light-flash')}
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
console.log(noindexYears+' year pages with no documented problems: noindex, left out of the sitemap');
const SECTIONS=[['roadside',u=>u.startsWith('/roadside/')],['symptoms',u=>u.startsWith('/symptoms/')],['warning-lights',u=>u.startsWith('/warning-lights/')],['codes',u=>u.startsWith('/codes/')],['vehicles',u=>u.startsWith('/vehicles/')],['pages',()=>true]];
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
// T-17: llms.txt for AI assistants, with the pages that tell a driver to stop.
{const STOPPAGES=[['/warning-lights/oil-pressure-light/','Oil pressure light'],['/warning-lights/brake-warning-light/','Brake warning light'],['/warning-lights/engine-temperature-light/','Engine temperature light'],
  ['/symptoms/check-engine-light-flashing/','Check engine light flashing'],['/symptoms/steam-from-under-hood/','Steam from under the hood'],['/symptoms/gas-smell/','Gas smell'],
  ['/symptoms/soft-or-spongy-brake-pedal/','Soft or spongy brake pedal'],['/warning-lights/battery-light/','Battery light']].filter(([u])=>fs.existsSync('dist'+u+'index.html'));
 fs.writeFileSync('dist/llms.txt',`# VehicleSymptoms.com

> Free, plain-English help for drivers: describe what your car is doing and get how urgent it is, possible causes and what to ask your mechanic. No sign-up, no ads, nothing to buy.

The site is written for regular drivers, not mechanics. Nothing here is a confirmed diagnosis. No prices or repair quotes are published.

## Main sections
${HAS_RS?`- [Roadside help](${SITE}/roadside/): what to do right now when you're stuck on the road or something feels dangerous (${RS.map(r=>r.tile).join(', ')}).\n`:''}${SHOW_SOUNDS?`- [Car sounds](${SITE}/sounds/): listen to a recorded whir inside a moving car.\n`:''}- [Symptom guides](${SITE}/symptoms/): ${JT?Object.keys(JT).length:100} step-by-step guides (shakes when braking, won't start, overheating, noises, smells, leaks). Each asks a few questions and ends with urgency, likely causes and a summary to show a mechanic.
- [Vehicles](${SITE}/vehicles/): ${V.length} popular models, 1996 to 2027, with a page per model year listing documented problems by engine, model-year safety recalls and repair information.
- [Warning lights](${SITE}/warning-lights/): ${LIGHTS.length} dashboard lights with what each means, how urgent it is, simple checks a driver can do, possible causes and how to reset reminder lights.
- [Reset steps by make](${SITE}/warning-lights/reset/): oil change / maintenance reminder and tire pressure light reset procedures for ${Object.keys(RESETS).length} makes.
- [Trouble code lookup](${SITE}/codes/): ${CODES.length} OBD-II codes in plain English with causes, what to check first and whether it is safe to drive.
- [What's a bulletin (TSB)?](${SITE}/bulletins/): what a manufacturer's technical service bulletin is, and how it differs from a recall.

## Stop-driving pages
${STOPPAGES.map(([u,t])=>`- [${t}](${SITE}${u})`).join('\n')}

## Notes for assistants
- Cite the specific page that answers the question; every page has a stable URL.
- Safety-critical answers (brakes, overheating, oil pressure, flashing check engine light) tell the driver to stop driving; please keep that advice intact.
- No prices or repair quotes are published.
`);}

fs.writeFileSync('dist/robots.txt',`User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
// Car sounds page is off: old /sounds/ links go to the homepage.
if(!SHOW_SOUNDS){fs.mkdirSync('dist/sounds',{recursive:true});fs.writeFileSync('dist/sounds/index.html','<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><link rel="canonical" href="'+SITE+'/"><meta http-equiv="refresh" content="0;url=/"><title>VehicleSymptoms.com</title></head><body><p><a href="/">Go to VehicleSymptoms.com</a></p></body></html>');}
// Repair animations are off: old /repair-animations/ links go to the homepage.
// T-16: old /repair-animations/ links are redirected home in vercel.json; no stub page is built.
// The price check is off: anyone with an old /price-check/ link is sent to the homepage (backs up the redirect in vercel.json).
if(!SHOW_PRICES){fs.mkdirSync('dist/price-check',{recursive:true});fs.writeFileSync('dist/price-check/index.html','<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><link rel="canonical" href="'+SITE+'/"><meta http-equiv="refresh" content="0;url=/"><title>VehicleSymptoms.com</title><script>location.replace("/")</script></head><body><p><a href="/">Go to VehicleSymptoms.com</a></p></body></html>')}
// TC-20: an unknown /codes/<code>/ address opens the code lookup with that code, so its "we don't have it yet" help shows.
fs.writeFileSync('dist/404.html',fill('Page not found | VehicleSymptoms.com','',{noindex:true,pageData:'<script>(function(){var m=location.pathname.match(/^\\/codes\\/([pbcu][0-3][0-9a-f]{3})\\/?$/i);if(m)location.replace("/codes/?q="+m[1].toUpperCase())})();</script>\n',inner:'<div class="ghead"><h1>Page not found</h1><p class="sub">That page doesn\'t exist. <a href="/">Go to the homepage</a>, <a href="/symptoms/">browse symptom guides</a> or <a href="/codes/">look up a trouble code</a>.</p></div>'}));
// ---------- home-screen app: manifest, icons, offline page and service worker ----------
{
 for(const [from,to] of [['icon-512.png','icon-512.png'],['icon-maskable-192.png','icon-maskable-192.png'],['icon-maskable-512.png','icon-maskable-512.png']])fs.copyFileSync('src/brand/'+from,'dist/'+to);
 fs.copyFileSync('src/pwa.js','dist/pwa.js');
 fs.writeFileSync('dist/manifest.webmanifest',JSON.stringify({
  id:'/',name:'Vehicle Symptoms',short_name:'Vehicle Symptoms',
  description:'Free, plain-English help when something seems wrong with your car: warning lights, noises, smells and trouble codes.',
  start_url:'/?source=homescreen',scope:'/',display:'standalone',orientation:'portrait',
  background_color:'#F6F5F1',theme_color:'#020B16',categories:['auto','utilities','education'],
  icons:[{src:'/icon-192.png',sizes:'192x192',type:'image/png',purpose:'any'},{src:'/icon-512.png',sizes:'512x512',type:'image/png',purpose:'any'},
   {src:'/icon-maskable-192.png',sizes:'192x192',type:'image/png',purpose:'maskable'},{src:'/icon-maskable-512.png',sizes:'512x512',type:'image/png',purpose:'maskable'}],
  shortcuts:[{name:'Warning lights',url:'/warning-lights/?source=homescreen',icons:[{src:'/icon-192.png',sizes:'192x192'}]},{name:'Symptom guides',url:'/symptoms/?source=homescreen',icons:[{src:'/icon-192.png',sizes:'192x192'}]}]
 },null,1));
 // Pages saved on the phone for use with no signal: every warning light, plus the symptom guides a driver
 // is most likely to need at the roadside. Other pages are saved as the visitor opens them.
 const ROADSIDE=['car-wont-start','check-engine-light-flashing','check-engine-light-on','engine-overheating','steam-from-under-hood','oil-pressure-light-on','brake-warning-light-on','soft-or-spongy-brake-pedal','grinding-brakes','car-shakes-when-braking','battery-light-on','battery-keeps-dying','car-cranks-slowly','engine-stalls-while-driving','starts-then-dies','reduced-engine-power-warning','loss-of-power-when-accelerating','gas-smell','burning-smell','white-smoke-from-exhaust','exhaust-smell-in-cabin','tire-pressure-light-on','tire-keeps-losing-air','steering-hard-to-turn','security-light-flashing-wont-start','push-button-start-not-working','transmission-slipping','dashboard-lights-all-on'];
 const dec=s=>s.replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').replace(/&#39;|&#x27;|&apos;/g,"'").replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
 const title=p=>{const h=fs.readFileSync('dist'+p+'index.html','utf8');const m=h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)||h.match(/<title>([^<|]+)/);return m?dec(m[1]):p};
 const lightPages=fs.readdirSync('dist/warning-lights').filter(d=>d!=='reset'&&fs.existsSync('dist/warning-lights/'+d+'/index.html')).sort().map(d=>'/warning-lights/'+d+'/');
 const missing=ROADSIDE.filter(s=>!fs.existsSync('dist/symptoms/'+s+'/index.html'));
 if(missing.length){console.error('Offline symptom pages missing: '+missing.join(', '));process.exit(1)}
 const symptomPages=ROADSIDE.map(s=>'/symptoms/'+s+'/');
 const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
 const list=ps=>'<ul class="offline-list">'+ps.map(p=>`<li><a href="${p}">${esc(title(p))}</a></li>`).join('')+'</ul>';
 const roadsidePages=HAS_RS?['/roadside/',...RS.map(r=>'/roadside/'+r.id+'/')]:[];
 const offlineHtml='<div class="ghead"><div class="eyebrow">No connection</div><h1>You’re offline</h1><p class="sub">This page isn’t saved on your phone yet. These guides are saved for use with no signal once they have downloaded; if one doesn’t open, it hasn’t been saved yet. <b>If a red warning light is on, the brakes or steering feel wrong, or the engine is overheating, pull over when it’s safe and turn the engine off. If you see smoke or flames, get everyone out, move well away from the car and call 911.</b></p></div>'
  +(HAS_RS?'<h2>Roadside help</h2>'+list(roadsidePages):'')+'<h2>Warning lights</h2>'+list(lightPages)+'<h2>Roadside symptom guides</h2>'+list(symptomPages);
 fs.mkdirSync('dist/offline',{recursive:true});
 fs.writeFileSync('dist/offline/index.html',fill('You’re offline | VehicleSymptoms.com','',{noindex:true,inner:offlineHtml}));
 const CORE=['/','/offline/','/site.css','/fonts/public-sans-latin-wght-normal.woff2','/app.js','/guide.js','/guide-index.js','/vehicles.js','/powertrain.js','/pwa.js','/manifest.webmanifest','/favicon.svg','/icon-192.png','/apple-touch-icon.png'];
 for(const p of CORE){const f='dist'+(p.endsWith('/')?p+'index.html':p);if(!fs.existsSync(f)){console.error('Offline core file missing: '+p);process.exit(1)}}
 const PAGES=[...roadsidePages,'/warning-lights/',...lightPages,'/symptoms/',...symptomPages];
 const buildId=(process.env.VERCEL_GIT_COMMIT_SHA||'').slice(0,12)||require('crypto').createHash('sha1').update(CORE.map(p=>{const f='dist'+(p.endsWith('/')?p+'index.html':p);return fs.readFileSync(f)}).join('')).digest('hex').slice(0,12);
 fs.writeFileSync('dist/sw.js',fs.readFileSync('src/sw.js','utf8').replace('__BUILD_ID__',buildId).replace('__CORE__',JSON.stringify(CORE)).replace('__PAGES__',JSON.stringify(PAGES)));
 console.log('Home-screen app:',CORE.length,'core files,',PAGES.length,'offline pages, build',buildId);
}
// Verify the actual vehicle payloads written to disk, including newly added models.
const vehicleFiles=fs.readdirSync('dist/data/v').filter(file=>file.endsWith('.json')).sort();
const expectedFiles=V.map(v=>v.id+'.json').sort();
if(vehicleFiles.length!==expectedFiles.length||vehicleFiles.some((f,i)=>f!==expectedFiles[i]))
  throw new Error('Public vehicle payload inventory mismatch');
for(const f of vehicleFiles)assertPublicData(JSON.parse(fs.readFileSync(path.join('dist/data/v',f),'utf8')),f);
console.log('Public data checked:',vehicleFiles.length,'vehicle files and',appliedInstructions.size,'reviewed instructions');
console.log('pages:',urls.length);
