// Validates a symptom guide (journey) JSON file. Usage: node tools/check_journey.js <id> [dir]
const fs=require('fs');const id=process.argv[2];const dir=process.argv[3]||__dirname+'/../src/journeys';
let j;try{j=JSON.parse(fs.readFileSync(`${dir}/${id}.json`,'utf8'))}catch(e){console.log('BAD JSON: '+e.message);process.exit(1)}
const GROUPS=['start','light','noise','shake','leaksmell','hot','drive'],CATS=['Warning Lights','Smoke','Leaks','Noises','Smells','Starting Problems','Driving'],URG=['stop','soon','check','diy'];
const bad=[];const need=(c,m)=>{if(!c)bad.push(m)};
need(j.id===id,'id must equal file name');need(/^[a-z0-9-]+$/.test(j.id||''),'id must be lowercase-hyphen');
for(const k of ['title','h1','metaDesc','intro','start'])need(typeof j[k]==='string'&&j[k].length>3,'missing '+k);
need(GROUPS.includes(j.group),'group must be one of '+GROUPS);need(CATS.includes(j.cat),'cat must be one of '+CATS);
need(Array.isArray(j.synonyms)&&j.synonyms.length>=5,'need 5+ synonyms');need(Array.isArray(j.safety),'safety must be an array (can be empty)');
need(j.metaDesc&&j.metaDesc.length<=170,'metaDesc max 170 chars');
need(j.issueMatch&&Array.isArray(j.issueMatch.cats)&&Array.isArray(j.issueMatch.words),'issueMatch {cats,words}');
need(Array.isArray(j.related),'related must be an array');need(Array.isArray(j.sources)&&j.sources.length>=1,'need 1+ sources');
const N=j.nodes||{};need(N[j.start]&&N[j.start].q,'start must be a question node');
let qn=0,rn=0;const reach=new Set();const walk=k=>{if(reach.has(k)||!N[k])return;reach.add(k);(N[k].opts||[]).forEach(o=>walk(o.go))};walk(j.start);
const txt=s=>typeof s==='string'?s:'';
for(const [k,n] of Object.entries(N)){
  if(n.q){qn++;need(Array.isArray(n.opts)&&n.opts.length>=2&&n.opts.length<=7,k+': 2-7 options');
    (n.opts||[]).forEach(o=>{need(o.a&&o.go,k+': option needs a and go');need(N[o.go],k+': go target missing: '+o.go)});
    need((n.opts||[]).some(o=>/not sure/i.test(o.a)),k+': needs an "I\'m not sure" option');}
  else if(n.result){rn++;const r=n.result;
    need(URG.includes(r.urgency),k+': urgency must be one of '+URG);
    for(const f of ['title','now','why'])need(txt(r[f]).length>10,k+': missing '+f);
    need(Array.isArray(r.if),k+': if must be an array');
    need(Array.isArray(r.causes)&&r.causes.length>=2,k+': 2+ causes');(r.causes||[]).forEach(c=>need(c.name&&c.clues!==undefined,k+': cause needs name and clues'));
    need(r.confirm&&Array.isArray(r.confirm.you)&&Array.isArray(r.confirm.shop)&&r.confirm.shop.length>=1,k+': confirm {you[],shop[]}');
    const all=JSON.stringify(r);need(!/\d+\s?%/.test(all),k+': no percentages');need(!/\$\s?\d/.test(all),k+': no dollar figures');
    if(r.urgency==='stop')need(!/drive (it )?to|keep driving|drive (it )?(carefully|gently|slowly)|safe to drive/i.test(r.now),k+': a "stop" result must not tell people to drive');
    if(r.urgency==='diy')need(!/\btow(ed|ing)?\b/i.test(r.now),k+': a "diy" result should not start with a tow');}
  else bad.push(k+': node must have q or result');
  need(reach.has(k),k+': unreachable from start');}
need(qn>=2,'need 2+ questions');need(rn>=4,'need 4+ results');
console.log(bad.length?'PROBLEMS:\n'+bad.join('\n'):`OK ${qn} questions, ${rn} results`);process.exit(bad.length?1:0);
