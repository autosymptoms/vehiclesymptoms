// QA: how many (vehicle, guide) combinations hit the guide.js money(undefined) crash (matched issue with a cost that is not free and has no numeric lo).
const fs=require('fs'),path=require('path'),{JSDOM}=require(path.join(__dirname,'../../node_modules/jsdom'));
const D=path.join(__dirname,'../../dist');
const html=fs.readFileSync(path.join(D,'symptoms/delayed-engagement-into-gear/index.html'),'utf8');
const dom=new JSDOM(html.replace(/<script[^>]*src=[^>]*><\/script>/g,''),{runScripts:'dangerously',url:'https://www.vehiclesymptoms.com/x/'});
const w=dom.window;w.fetch=()=>new Promise(()=>{});for(const f of ['vehicles.js','guide-index.js','guide.js'])w.eval(fs.readFileSync(path.join(D,f),'utf8'));
const G=w.VS_GUIDES;const guides=fs.readdirSync(path.join(D,'symptoms')).filter(g=>fs.existsSync(path.join(D,'symptoms',g,'index.html')));
let pairs=0,crash=0,veh=new Set(),gs=new Set(),ex=[];
for(const v of w.VEHICLES){const d=JSON.parse(fs.readFileSync(path.join(D,'data/v',v.id+'.json'),'utf8'));
  for(const g of guides){const m=d.issues.filter(i=>G.matchesGuide(g,i.t));if(!m.length)continue;pairs++;
    if(m.slice(0,4).some(i=>i.cost&&!i.cost.free&&typeof i.cost.lo!=='number')){crash++;veh.add(v.id);gs.add(g);if(ex.length<5)ex.push(v.id+' x '+g)}}}
const r={vehicle_guide_pairs_with_matches:pairs,pairs_that_crash:crash,vehicles:veh.size,guides:gs.size,examples:ex,note:'All model years combined (no year filter); per-year exposure is lower.'};
console.log(JSON.stringify(r));fs.writeFileSync(path.join(__dirname,'qa-guide-crash-scope.json'),JSON.stringify(r,null,1));
