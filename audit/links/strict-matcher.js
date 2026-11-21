// Strict issue->guide matcher. Same logic as the proposed forIssue()/matchesGuide() in src/guide.js (see proposed.patch).
function compile(R){
  const C={not:R.not.map(p=>new RegExp(p,'i')),order:R.order,g:{}};
  for(const id of R.order){const r=R.guides[id];if(!r)throw new Error('order lists a guide with no rule: '+id);
    C.g[id]={any:r.any.map(p=>new RegExp(p,'i')),not:(r.not||[]).map(p=>new RegExp(p,'i'))}}
  for(const id in R.guides)if(!R.order.includes(id))throw new Error('rule missing from order: '+id);
  return C}
const norm=t=>String(t==null?'':t).replace(/[‘’]/g,"'").replace(/[“”]/g,'"');
// does this guide's rule accept the text?
function matchesGuide(C,id,text){const t=norm(text),r=C.g[id];if(!r)return false;
  if(C.not.some(x=>x.test(t))||r.not.some(x=>x.test(t)))return false;return r.any.some(x=>x.test(t))}
// the one guide a vehicle issue title links to (first in C.order), or null
function strictFor(C,title){const t=norm(title);if(C.not.some(x=>x.test(t)))return null;
  for(const id of C.order){const r=C.g[id];if(r.not.some(x=>x.test(t)))continue;const m=r.any.find(x=>x.test(t));if(m)return{id,term:(t.match(m)||[''])[0]}}
  return null}
module.exports={compile,strictFor,matchesGuide};
