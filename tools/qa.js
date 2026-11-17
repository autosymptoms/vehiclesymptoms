// Site QA: link check over every page + walk every answer path of every guide + search spot checks.
const fs=require('fs'),path=require('path');const {JSDOM}=require('jsdom');
const D='dist';const pages=[];(function w(d){for(const f of fs.readdirSync(d)){const p=path.join(d,f);if(fs.statSync(p).isDirectory())w(p);else if(f==='index.html')pages.push('/'+path.relative(D,path.dirname(p)).replace(/\\/g,'/')+(path.dirname(p)===D?'':'/'))}})(D);
const exists=u=>{u=u.split('#')[0].split('?')[0];if(!u.startsWith('/'))return true;if(/\.(js|css|xml|txt)$/.test(u))return fs.existsSync(D+u);return fs.existsSync(D+u+(u.endsWith('/')?'':'/')+'index.html')};
let broken=new Map();
for(const p of pages){const h=fs.readFileSync(D+p+'index.html','utf8');for(const m of h.matchAll(/href="([^"]+)"/g)){const u=m[1].replace(/&amp;/g,'&');if(u.startsWith('/')&&!exists(u))broken.set(u,(broken.get(u)||0)+1)}}
console.log('pages:',pages.length,'| broken internal links:',broken.size?[...broken].slice(0,10):'none');
// walk every guide path
const J=fs.readdirSync('src/journeys').map(f=>JSON.parse(fs.readFileSync('src/journeys/'+f,'utf8')));
let paths=0,deep=0,problems=[];
for(const j of J){const walk=(k,d,seen)=>{const n=j.nodes[k];if(seen.has(k)){problems.push(j.id+': loop at '+k);return}if(n.result){paths++;deep=Math.max(deep,d);return}if(d>8){problems.push(j.id+': too deep');return}for(const o of n.opts)walk(o.go,d+1,new Set([...seen,k]))};walk(j.start,0,new Set());
 for(const r of j.related)if(!J.find(x=>x.id===r))problems.push(j.id+': related missing '+r);}
console.log('guides:',J.length,'| answer paths walked:',paths,'| longest path:',deep,'questions | problems:',problems.length?problems.slice(0,8):'none');
// shortcut targets
const home=fs.readFileSync(D+'/index.html','utf8');for(const m of home.matchAll(/class="sc" href="([^"]+)"/g))if(!exists(m[1]))console.log('BROKEN shortcut',m[1]);
const hub=fs.readFileSync(D+'/symptoms/index.html','utf8');for(const g of ['start','light','noise','shake','leaksmell','hot','drive'])if(!hub.includes('id="'+g+'"'))console.log('hub missing section',g);
// search spot checks in a browser context
(async()=>{const d=await JSDOM.fromURL('http://localhost:8788/',{runScripts:'dangerously',resources:'usable',beforeParse(w){w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.fetch=()=>Promise.reject()}});
await new Promise(r=>d.window.addEventListener('load',r));const S=d.window.VS_GUIDES.search;
const tests=[['shakes when I brake','car-shakes-when-braking'],['my car wont start just clicks','car-wont-start'],['brakes squeaking','squealing-brakes'],['check engine light flashing','check-engine-light-flashing'],['smells like maple syrup','sweet-smell-from-car'],['white smoke from tailpipe','white-smoke-from-exhaust'],['overheating','engine-overheating'],['grinding noise when i stop','grinding-brakes'],['ac blowing hot air','ac-blowing-warm-air'],['steering wheel vibrates on highway','vibration-at-highway-speed'],['puddle under my car','fluid-leak-under-car'],['car pulls to the right','car-pulls-to-one-side'],['battery keeps dying','battery-keeps-dying'],['smells like rotten eggs','rotten-egg-smell'],['transmission slipping','transmission-slipping'],['tpms light','tire-pressure-light-on'],['clicking noise when turning','clicking-when-turning'],['car jerks when i accelerate','car-jerks-when-accelerating'],['oil light came on','oil-pressure-light-on'],['gas smell in car','gas-smell']];
let ok=0;for(const [q,want] of tests){const r=S(q,3).map(g=>g.id);if(r.includes(want))ok++;else console.log('SEARCH MISS:',JSON.stringify(q),'->',r.join(', ')||'(nothing)')}
console.log('search checks:',ok+'/'+tests.length);
// vehicle pages link to guides
let walk=0;for(const p of pages.filter(p=>/^\/vehicles\/[^/]+\/\d{4}\/$/.test(p)))walk+=(fs.readFileSync(D+p+'index.html','utf8').match(/class="walk"/g)||[]).length;
console.log('vehicle-year pages:',pages.filter(p=>/\/\d{4}\/$/.test(p)).length,'| links from known problems to guides:',walk);
process.exit(0)})();
