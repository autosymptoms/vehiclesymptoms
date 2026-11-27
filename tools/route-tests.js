// Structural route tests from audit/crawl/routes.csv (run audit/crawl/crawl.js first). Writes audit/generated/route-tests.json.
// A pass means status 200, self canonical, title, a visible H1, valid JSON-LD and a crawlable path from the home page. It does not verify content.
const fs=require('fs');const lines=fs.readFileSync(__dirname+'/../audit/crawl/routes.csv','utf8').trim().split('\n');
const parse=l=>{const o=[];let c='',q=false;for(const ch of l){if(ch==='"'){q=!q;continue}if(ch===','&&!q){o.push(c);c='';continue}c+=ch}o.push(c);return o};
const H=parse(lines[0]);const out={};let pass=0;
for(const l of lines.slice(1)){const r=Object.fromEntries(parse(l).map((v,i)=>[H[i],v]));
  // The not-found page itself: it must answer 404 and stay out of the index, not pass the 200/canonical checks.
  if(r.route==='/404.html'){const ok=r.http_status==='404'&&/noindex/.test(l);out[r.route]={status:ok?'pass':'fail',fails:ok?[]:['notfound'],thin:false,h1_count:+r.h1_count};if(ok)pass++;continue}
  const fails=[];if(r.http_status!=='200')fails.push('status');if(r.canonical_self!=='true'&&r.canonical_self!=='yes')fails.push('canonical');if(!r.title)fails.push('title');if(!(+r.h1_visible_count>=1))fails.push('h1');
  if(r.jsonld_blocks!=='0'&&r.jsonld_ok!=='true'&&r.jsonld_ok!=='yes')fails.push('jsonld');if(r.reachable_visible!=='true'&&r.reachable_visible!=='yes')fails.push('unreachable');
  out[r.route]={status:fails.length?'fail':'pass',fails,thin:r.thin==='true'||r.thin==='yes',h1_count:+r.h1_count};if(!fails.length)pass++}
fs.writeFileSync(__dirname+'/../audit/generated/route-tests.json',JSON.stringify(out));console.log('route tests',pass,'/',Object.keys(out).length,'pass');
const f={};for(const v of Object.values(out))for(const x of v.fails)f[x]=(f[x]||0)+1;console.log('fail reasons',JSON.stringify(f));
