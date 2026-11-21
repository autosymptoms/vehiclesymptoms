// Runs the site's own guide search (src/guide.js search()) on test queries. node audit/safety/search-test.js
const fs=require('fs');const J=fs.readdirSync('src/journeys').map(f=>JSON.parse(fs.readFileSync('src/journeys/'+f,'utf8')));
global.window={GUIDE_INDEX:J.map(j=>({id:j.id,title:j.title,h1:j.h1,group:j.group,cat:j.cat,syn:j.synonyms,match:j.issueMatch}))};global.document={getElementById:()=>null,addEventListener:()=>{}};global.location={hash:''};
eval(fs.readFileSync('src/guide.js','utf8'));const {search}=window.VS_GUIDES;
const Q=process.argv.slice(2).length?process.argv.slice(2):["shakes when I brake","spongy breaks","AC blowing warm","flashing engine light and shaking"];
const out={};for(const q of Q){const r=search(q,5),one=search(q,1)[0];const auto=r.length===1;out[q]={results:r.map(g=>g.id),autoRedirect:auto?r[0].id:null};
  const g=r[0]&&J.find(j=>j.id===r[0].id);if(g){out[q].firstSafety=g.safety[0]||null;out[q].firstQ=g.nodes[g.start].q;out[q].firstOpt=g.nodes[g.start].opts[0].a}}
console.log(JSON.stringify(out,null,1));
