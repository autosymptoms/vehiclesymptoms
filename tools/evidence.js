// Evidence gates used by build.js and tools/release-check.js.
// Prices: shown only with a qualifying evidence pair recorded in src/evidence/prices.json.
const fs=require('fs');
const P=JSON.parse(fs.readFileSync(__dirname+'/../src/evidence/prices.json','utf8'));
const slug=t=>String(t).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80);
const ids={
  issue:(vid,t)=>`issue:${vid}:${slug(t)}`,
  maint:(vid,job)=>`maint:${vid}:${slug(job)}`,
  annual:vid=>`annual:${vid}`,
  code:code=>`code:${code}`,
  light:(lid,name)=>`light:${lid}:${slug(name)}`,
  lightDiag:lid=>`lightdiag:${lid}`,
  common:name=>`common:${slug(name)}`,
  est:(file,cls)=>`est:${file.replace(/\.json$/,'')}:${cls}`,
};
const DATE=/^\d{4}-\d{2}-\d{2}$/;
function srcOk(s){return s&&/^https:\/\//.test(s.url||'')&&s.provider&&DATE.test(s.accessed||'')&&s.vehicle&&s.location&&typeof s.figure_lo==='number'&&typeof s.figure_hi==='number'&&s.scope}
// Returns {ok:true} or {ok:false,reason}
function priceQualifies(id){
  const e=P.prices[id];if(!e)return {ok:false,reason:'no evidence record'};
  const srcs=(e.sources||[]).filter(srcOk);
  const providers=new Set(srcs.map(s=>s.provider));
  const rp=srcs.find(s=>s.provider==='RepairPal');
  if(rp&&providers.size>=2)return {ok:true};
  if(!rp&&e.repairpal_gap&&DATE.test(e.repairpal_gap.checked||'')&&providers.size>=2)return {ok:true};
  return {ok:false,reason:rp?'RepairPal found but no independent corroboration':'no RepairPal match and fewer than two independent providers'};
}
const S=JSON.parse(fs.readFileSync(__dirname+'/../src/evidence/safety-signoff.json','utf8'));
function signoffFor(group,context){
  return S.signoffs.find(s=>s.group===group&&s.reviewer_name&&s.qualification&&DATE.test(s.date||'')&&(s.contexts_approved||[]).includes(context))||null;
}
module.exports={ids,priceQualifies,signoffFor,slug};
