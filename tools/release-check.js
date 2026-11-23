// Release check. Run after `npm run build` and `node tools/regression.js`:  node tools/release-check.js
// Exits 1 (release blocked) when any rendered price lacks a qualifying evidence pair, a dollar figure appears in a
// public output without a shown price record, a safety-critical instruction lacks documented human sign-off,
// a combined-label model year has no verified recall mapping, a published factual claim has not been reviewed
// against its evidence, or a required route / regression has no passing test result.
// Writes audit/generated/release-check.json with every count and denominator.
const fs=require('fs'),path=require('path');
const R=p=>path.join(__dirname,'..',p);
const EV=require('./evidence.js');
const out={checked:new Date().toISOString(),revision:null,checks:{},blocked:[]};
try{out.revision=require('child_process').execSync('git rev-parse HEAD',{cwd:R('.')}).toString().trim()+(require('child_process').execSync('git status --porcelain src build.js tools',{cwd:R('.')}).toString().trim()?' (+uncommitted changes)':'')}catch(_){}
const fail=(k,msg)=>{out.blocked.push(k+': '+msg)};

// 1. Prices: every ledger record shown must qualify; count the rest by status.
const L=JSON.parse(fs.readFileSync(R('audit/generated/price-ledger.json'),'utf8'));
const byStatus={};for(const r of L)byStatus[r.status]=(byStatus[r.status]||0)+1;
const shownBad=L.filter(r=>r.status==='shown'&&!EV.priceQualifies(r.id).ok);
out.checks.prices={records:L.length,byStatus,shown_without_evidence:shownBad.length,withheld_pending_evidence:byStatus.withheld||0};
if(shownBad.length)fail('prices',shownBad.length+' shown prices lack a qualifying evidence pair');
if(byStatus.withheld)fail('prices',byStatus.withheld+' price records withheld pending evidence (audit items stay open)');

// 2. Dollar figures in public outputs. Allowed: figures from shown price records, and labor-rate/claim text registered in src/evidence/claims.json.
const C=fs.existsSync(R('src/evidence/claims.json'))?JSON.parse(fs.readFileSync(R('src/evidence/claims.json'),'utf8')):{claims:{}};
const allowedTxt=Object.values(C.claims||{}).filter(c=>c.status==='verified').map(c=>c.text);
const shownAmts=new Set();for(const r of L.filter(r=>r.status==='shown'))for(const n of [r.lo,r.hi])shownAmts.add('$'+Number(n).toLocaleString('en-US'));
const files=[];(function walk(d){for(const f of fs.readdirSync(d)){const p=path.join(d,f);const st=fs.statSync(p);if(st.isDirectory())walk(p);else if(/\.(html|js|json|xml|txt)$/.test(f)&&!/vendor/.test(p))files.push(p)}})(R('dist'));
const dollar={};let dollarFiles=0;
for(const f of files){const t=fs.readFileSync(f,'utf8');const m=t.match(/\$\d[\d,]*(?:\.\d+)?/g);if(!m)continue;let hit=false;
  for(const a of m){if(shownAmts.has(a))continue;const ctxOk=allowedTxt.some(x=>x.includes(a));if(ctxOk)continue;dollar[a]=(dollar[a]||0)+1;hit=true}if(hit)dollarFiles++}
out.checks.public_dollar_figures={files_scanned:files.length,files_with_unbacked_figures:dollarFiles,distinct_unbacked_figures:Object.keys(dollar).length,examples:Object.entries(dollar).sort((a,b)=>b[1]-a[1]).slice(0,25)};
if(dollarFiles)fail('public-dollar-figures',dollarFiles+' public files contain dollar figures with no shown price record or verified claim (labor rates, disclaimers, benchmarks)');

// 3. Safety-critical instructions need documented qualified human sign-off for every rendered context.
const SI=fs.existsSync(R('audit/generated/safety-contexts.json'))?JSON.parse(fs.readFileSync(R('audit/generated/safety-contexts.json'),'utf8')):[];
const unsigned=SI.filter(x=>!EV.signoffFor(x.group,x.context));
const groups=new Set(SI.map(x=>x.group)),ugroups=new Set(unsigned.map(x=>x.group));
out.checks.safety={instruction_groups:groups.size,rendered_contexts:SI.length,contexts_without_signoff:unsigned.length,groups_without_signoff:ugroups.size};
if(!SI.length)fail('safety','safety context inventory missing (audit/generated/safety-contexts.json)');
if(unsigned.length)fail('safety',unsigned.length+' rendered safety-critical contexts in '+ugroups.size+' groups have no documented qualified sign-off');

// 4. Recall mappings: every sold year of every combined-label model must have a verified mapping.
global.window={};eval(fs.readFileSync(R('vehicles.js'),'utf8'));const V=window.VEHICLES;
const sold=(v,y)=>y>=v.years[0]&&y<=v.years[1]&&!(v.gaps||[]).some(g=>y>=g[0]&&y<=g[1]);
let cy=0,cyOk=0,allY=0,allVer=0;
for(const v of V)for(let y=v.years[0];y<=v.years[1];y++){if(!sold(v,y))continue;allY++;const r=(v.rq||[]).find(r=>y>=r.from&&y<=r.to);if(r&&r.verified)allVer++;
  if(/ \/ /.test(v.model)){cy++;if(r&&r.verified&&r.queries.length)cyOk++}}
out.checks.recalls={combined_label_year_pages:cy,combined_verified:cyOk,all_year_pages:allY,all_with_verified_mapping:allVer,note:'Year pages without a verified mapping show results only after a validated non-empty lookup; zero shows as Lookup unavailable.'};
if(cyOk<cy)fail('recalls',(cy-cyOk)+' combined-label year pages lack a verified NHTSA mapping');
if(allVer<allY)fail('recalls',(allY-allVer)+' of '+allY+' year pages have no verified mapping (zero results there show as Lookup unavailable)');

// 5. Factual claims: every published vehicle issue, code, light and guide statement must be reviewed against its evidence.
let claims=0,reviewed=0;const CL=C.claims||{};
for(const v of V)for(const i of v.issues){claims++;if((CL['issue:'+v.id+':'+EV.slug(i.t)]||{}).status==='verified')reviewed++}
out.checks.claims={vehicle_issue_claims:claims,reviewed_verified:reviewed,unreviewed:claims-reviewed,note:'Codes, lights, guides, ownership counts and privacy promises are tracked in audit/claims-inventory.csv.'};
if(reviewed<claims)fail('claims',(claims-reviewed)+' of '+claims+' vehicle issue claims have not been checked against their cited evidence');

// 6. Routes and regressions need test results.
const sm=fs.readdirSync(R('dist')).filter(f=>/^sitemap-.+\.xml$/.test(f)).flatMap(f=>fs.readFileSync(R('dist/'+f),'utf8').match(/<loc>[^<]+<\/loc>/g)).map(x=>x.slice(5,-6).replace('https://www.vehiclesymptoms.com',''));
const RT=fs.existsSync(R('audit/generated/route-tests.json'))?JSON.parse(fs.readFileSync(R('audit/generated/route-tests.json'),'utf8')):{};
const untested=sm.filter(u=>!RT[u]||RT[u].status!=='pass');
out.checks.routes={sitemap_routes:sm.length,structurally_tested_pass:sm.length-untested.length,untested_or_failing:untested.length,note:'Structural tests (status, canonical, title, H1, links) do not verify content.'};
if(untested.length)fail('routes',untested.length+' routes have no passing structural test');
const REG=fs.existsSync(R('audit/generated/regression-results.json'))?JSON.parse(fs.readFileSync(R('audit/generated/regression-results.json'),'utf8')):null;
out.checks.regressions=REG?{total:REG.results.length,passed:REG.results.filter(r=>r.pass).length}:{total:0,passed:0};
if(!REG)fail('regressions','no regression results; run node tools/regression.js');else if(REG.results.some(r=>!r.pass))fail('regressions',REG.results.filter(r=>!r.pass).length+' regression tests failing');

out.release=out.blocked.length?'BLOCKED':'PASS';
fs.mkdirSync(R('audit/generated'),{recursive:true});fs.writeFileSync(R('audit/generated/release-check.json'),JSON.stringify(out,null,1));
console.log(JSON.stringify(out.checks,null,1));console.log('\nRELEASE: '+out.release);for(const b of out.blocked)console.log(' - '+b);
process.exit(out.blocked.length?1:0);
