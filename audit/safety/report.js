// Safety audit step 3: build safety-instructions.csv, ordering-issues.csv, conflicts.csv
// from statements.json (analyze.js) and positions.json (measure.js). node audit/safety/report.js
const fs=require('fs');const D='audit/safety/';
const {S}=JSON.parse(fs.readFileSync(D+'statements.json','utf8'));
const P=JSON.parse(fs.readFileSync(D+'positions.json','utf8'));
const FOLD=600;
const RANK={stop:5,stop_soon:4,urgent:3,soon:2,check:1,ok:0,diy:0,info:0,'':-1};
const STOPCONDS=new Set(['CEL_FLASHING','SEVERE_SHAKING','TEMP_RED_OVERHEAT','OIL_PRESSURE_LIGHT','BRAKE_PEDAL_FLOOR_SOFT','RED_BRAKE_LIGHT','SMOKE_FIRE','FUEL_SMELL_LEAK','STEERING_LOSS_HEAVY','STALL_POWER_LOSS','HIGH_VOLTAGE']);
const csv=v=>{v=v==null?'':String(v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
const writeCsv=(f,head,rows)=>{fs.writeFileSync(D+f,[head.join(','),...rows.map(r=>head.map(h=>csv(r[h])).join(','))].join('\n')+'\n');console.log(f,rows.length)};
const norm=t=>t.replace(/\s+/g,' ').trim();
const safety=S.filter(s=>s.topics.length||s.conds.length);
// ---- position of a statement on its page ----
function pos(s){
  if(['vbadge','vnext'].includes(s.kind))return{st:'unknown',hint:'vehicle page issue card (client-rendered list; not measured)'};
  if(s.kind==='faq')return{st:'n/a',hint:'JSON-LD/FAQ accordion (search snippet; not first-screen)'};
  const p=P[s.route]||{};
  if(s.kind==='badge'){const b=p['@@BADGE@@'];return b?{st:b.top<=FOLD?'yes':'no',top:b.top,hint:'badge at '+b.top+'px'}:{st:'unknown',hint:'not measured'}}
  if(s.kind.startsWith('result')){const est=s.kind==='result-badge'?0:s.kind==='result-now'?120:260;
    return{st:est<=FOLD?'yes':'no',top:est,hint:'interactive result card (guide scrolls result to top): est. '+est+'px; in static "Full guide" list it is inside a collapsed <details>'}}
  const m=p[s.text];if(!m||m.missing)return{st:'unknown',hint:'text not found on built page'};
  return{st:m.vis&&m.top<=FOLD?'yes':'no',top:m.top,hint:(m.vis?'':'hidden/collapsed; ')+m.top+'px below header'};
}
safety.forEach(s=>{s.pos=pos(s);s.ctx=s.route+' '+s.field});
// ---- 1. distinct instructions ----
const primaryCond=s=>{const c=s.conds.filter(x=>STOPCONDS.has(x)||x==='AIRBAG_LIGHT');return c.length?c.sort().join('+'):'GENERAL'};
const groupOf=s=>(s.topics[0]||'general').toUpperCase()+'|'+primaryCond(s)+'|'+(s.level||'none').toUpperCase();
const rows=new Map();
for(const s of safety){
  const keys=['badge','vbadge','result-badge'].includes(s.kind)?s.topics.map(t=>s.kind+'::'+s.text+'::'+t):[s.kind.startsWith('result')||s.kind==='safety'?'g::'+norm(s.text):'x::'+norm(s.text)];
  if(!keys.length)keys.push(s.kind+'::'+s.text+'::general');
  for(const k of keys){const topic=k.split('::')[2]||s.topics.join(';')||'general';
    let r=rows.get(k);if(!r){r={topic,exact_text:s.text,urgency:s.level||'(none)',ctx:[],pos:[],kinds:new Set(),srcs:new Set(),conds:new Set(),stmts:[]};rows.set(k,r)}
    r.ctx.push(s.ctx);r.pos.push(s.pos);r.kinds.add(s.kind);r.srcs.add(s.src.replace(/ [A-Z][0-9A-F]{4}\.(sev|plain|drive)$/,'.$1'));s.conds.forEach(c=>r.conds.add(c));r.stmts.push(s)}
}
let n=0;const instr=[];const groupLevels={};
for(const r of rows.values()){const cond=[...r.conds].filter(x=>STOPCONDS.has(x)||x==='AIRBAG_LIGHT').sort().join('+')||'GENERAL';
  r.group=(r.topic.split(';')[0]).toUpperCase()+'|'+cond+'|'+r.urgency.toUpperCase();
  r.cond=cond;(groupLevels[cond]=groupLevels[cond]||new Set()).add(r.urgency)}
for(const r of rows.values()){n++;
  const vis=r.pos.filter(p=>p.st==='yes'||p.st==='no');const no=vis.filter(p=>p.st==='no').length;
  const fs_=vis.length?(no?'no':'yes'):r.pos.some(p=>p.st==='n/a')&&!r.pos.some(p=>p.st==='unknown')?'n/a':'unknown';
  let conf='';if(r.cond!=='GENERAL'){const others=[...groupLevels[r.cond]].filter(l=>l!==r.urgency&&Math.abs(RANK[l]-RANK[r.urgency])>=1);if(others.length)conf='same condition '+r.cond+' also advised as: '+others.join('/')}
  const badgeSoft=r.kinds.has('badge')&&RANK[r.urgency]<4;
  instr.push({instruction_id:'SI-'+String(n).padStart(4,'0'),topic:r.topic,exact_text:r.exact_text,urgency:r.urgency,contexts:[...new Set(r.ctx)].join('; '),equivalent_group:r.group,conflicts:conf,first_screen_ok:fs_,signoff_status:'missing',
    notes:[r.ctx.length+' context(s)',vis.length?(vis.length-no)+'/'+vis.length+' visual contexts within first '+FOLD+'px':'',[...r.kinds].join('+'),'source: '+[...r.srcs].slice(0,4).join(' | ')+(r.srcs.size>4?' (+'+(r.srcs.size-4)+' more)':''),badgeSoft&&r.cond==='GENERAL'?'soft lead badge on a safety-topic page':''].filter(Boolean).join('; ')})}
instr.sort((a,b)=>a.equivalent_group.localeCompare(b.equivalent_group)||a.instruction_id.localeCompare(b.instruction_id));
writeCsv('safety-instructions.csv',['instruction_id','topic','exact_text','urgency','contexts','equivalent_group','conflicts','first_screen_ok','signoff_status','notes'],instr);
const ctxCount=instr.reduce((a,r)=>a+r.contexts.split('; ').length,0);const grpCount=new Set(instr.map(r=>r.equivalent_group)).size;
// ---- 2. ordering issues ----
const LEADS={
 CEL_FLASHING:"If the check engine light is flashing or the engine is shaking hard, pull over when it's safe and turn the engine off. Don't keep driving; get it towed or checked right away.",
 SEVERE_SHAKING:"If the engine is shaking hard or the check engine light is flashing, pull over when it's safe and turn the engine off.",
 TEMP_RED_OVERHEAT:"If the temperature gauge is in the red or you see steam, pull over when it's safe and turn the engine off.",
 OIL_PRESSURE_LIGHT:"If the red oil pressure light comes on while driving, pull over when it's safe and turn the engine off.",
 BRAKE_PEDAL_FLOOR_SOFT:"If the brake pedal sinks toward the floor or the brakes feel weak, stop when it's safe and don't drive it; have it towed.",
 RED_BRAKE_LIGHT:"If the red brake warning light stays on with the parking brake off, don't drive it until the brakes are checked.",
 SMOKE_FIRE:"If you see smoke or flames, pull over, turn the engine off and get everyone away from the car.",
 FUEL_SMELL_LEAK:"If you smell raw fuel or see a fuel leak, stop, turn the engine off and step away from the car; don't restart it.",
 STEERING_LOSS_HEAVY:"If steering suddenly gets very heavy, loose or stops responding, slow down and stop when it's safe; don't drive it.",
 STALL_POWER_LOSS:"If the engine stalls or loses power while you're moving, steer to a safe spot; steering and brakes will feel heavier.",
 HIGH_VOLTAGE:"If the car warns of a high-voltage or hybrid system fault and power is limited or it says to stop, pull over safely and don't touch orange cables.",
};
const ord=[];const byRoute={};safety.forEach(s=>(byRoute[s.route]=byRoute[s.route]||[]).push(s));
const BADGE={};S.filter(s=>s.kind==='badge').forEach(s=>{s.pos=s.pos||pos(s);BADGE[s.route]=s});
for(const [route,ss] of Object.entries(byRoute)){
  if(route.startsWith('/vehicles/'))continue;
  const badge=BADGE[route];
  if(badge&&RANK[badge.level]<4){
    const ex=ss.filter(s=>!['badge','faq'].includes(s.kind)&&RANK[s.level]>=3&&s.conds.some(c=>STOPCONDS.has(c))).sort((a,b)=>(a.pos.top??1e9)-(b.pos.top??1e9));
    const b=(P[route]||{})['@@BADGE@@'];
    const bt=b?b.bottom:0;const early=ex.filter(x=>x.pos.top!=null&&x.pos.top<=bt&&x.pos.st==='yes');
    if(ex.length&&!early.length){const e=ex[0];const conds=[...new Set(ex.flatMap(x=>x.conds.filter(c=>STOPCONDS.has(c))))];
      ord.push({route,lead_text:(b?b.text:badge.text),buried_exception:e.text,position_hint:'badge at '+(b?b.top:'?')+'px; first stop-exception in '+e.field+' at '+(e.pos.top??'?')+'px'+((e.pos.top??1e9)>FOLD?' (BELOW first screen)':' (first screen, but after softer badge)')+'; level of exception text: '+e.level+'; conditions: '+conds.join('+'),recommended_lead:LEADS[conds.includes('CEL_FLASHING')?'CEL_FLASHING':conds[0]]+' Otherwise: '+badge.text.toLowerCase()+'.'})}
    else if(!ex.length){const tp=badge.topics.filter(t=>['brakes','steering','oil_pressure','overheating','airbag','fuel_leak_smell','high_voltage_ev','smoke_fire'].includes(t));
      if(tp.length&&route.startsWith('/codes/')&&badge.level==='check')ord.push({route,lead_text:(b?b.text:badge.text),buried_exception:'(none on page) safety-topic code ('+tp.join('+')+') with generic "check" drive text and no stop exception',position_hint:'badge at '+(b?b.top:'?')+'px; no stop exception anywhere on page',recommended_lead:'Add a topic-specific stop exception as the first line of drive text, e.g. '+(tp[0]==='brakes'?LEADS.RED_BRAKE_LIGHT:tp[0]==='oil_pressure'?LEADS.OIL_PRESSURE_LIGHT:tp[0]==='overheating'?LEADS.TEMP_RED_OVERHEAT:tp[0]==='steering'?LEADS.STEERING_LOSS_HEAVY:tp[0]==='fuel_leak_smell'?LEADS.FUEL_SMELL_LEAK:tp[0]==='high_voltage_ev'?LEADS.HIGH_VOLTAGE:tp[0]==='airbag'?'If the airbag light stays on, the airbags may not deploy in a crash; get it checked soon and check open recalls with your VIN.':LEADS.SMOKE_FIRE)})}
  }
  if(route.startsWith('/symptoms/')){
    const sb=ss.filter(s=>s.kind==='safety').sort((a,b)=>(a.pos.top??1e9)-(b.pos.top??1e9));
    if(sb.length&&(sb[0].pos.top??0)>FOLD)ord.push({route,lead_text:'intro paragraph + H1 (no badge)',buried_exception:sb[0].text,position_hint:'safety box starts at '+sb[0].pos.top+'px (BELOW first screen)',recommended_lead:'Move safety box above intro or shorten intro'});
    const res={};ss.filter(s=>s.node).forEach(s=>(res[s.node]=res[s.node]||[]).push(s));
    for(const [nid,rs] of Object.entries(res)){const rb=rs.find(s=>s.kind==='result-badge');if(!rb||RANK[rb.level]>=4)continue;
      const ex=rs.filter(s=>s.kind!=='result-badge'&&RANK[s.level]>=4&&s.conds.some(c=>STOPCONDS.has(c)));if(!ex.length)continue;
      const conds=[...new Set(ex.flatMap(x=>x.conds.filter(c=>STOPCONDS.has(c))))];
      ord.push({route:route+'#'+nid,lead_text:rb.text+' (result: '+rb.rtitle+')',buried_exception:ex[0].text,position_hint:'interactive result: soft badge first, exception in '+ex[0].field+' (est. '+(ex[0].pos.top)+'px after result top); conditions '+conds.join('+'),recommended_lead:'Keep badge but add an "Stop if:" line inside/next to the badge: '+LEADS[conds.includes('CEL_FLASHING')?'CEL_FLASHING':conds[0]]})}
  }
}
writeCsv('ordering-issues.csv',['route','lead_text','buried_exception','position_hint','recommended_lead'],ord);
// ---- 3. conflicts ----
const C=[];const addC=o=>C.push({conflict_id:'CF-'+String(C.length+1).padStart(4,'0'),...o});
const shortT=t=>t.length>220?t.slice(0,217)+'...':t;
// a) same page, same condition, different level across fields
for(const [route,ss] of Object.entries(byRoute)){if(route.startsWith('/vehicles/'))continue;
  const byC={};ss.filter(s=>!s.kind.startsWith('result')&&s.kind!=='badge').forEach(s=>s.conds.filter(c=>STOPCONDS.has(c)).forEach(c=>(byC[c]=byC[c]||[]).push(s)));
  for(const [c,list] of Object.entries(byC)){const lv=[...new Set(list.map(s=>s.level))];if(lv.length<2)continue;
    const hi=list.reduce((a,b)=>RANK[b.level]>RANK[a.level]?b:a),lo=list.reduce((a,b)=>RANK[b.level]<RANK[a.level]?b:a);if(RANK[hi.level]-RANK[lo.level]<1||hi.text===lo.text)continue;
    addC({type:'same-page field mismatch',condition_or_symptom:c,context_a:route+' '+hi.field,text_a:shortT(hi.text),level_a:hi.level,context_b:route+' '+lo.field,text_b:shortT(lo.text),level_b:lo.level,severity:RANK[hi.level]>=5&&RANK[lo.level]<=3?'high':'medium',recommendation:'Use one signed-off sentence for '+c+' in every field of this page (drive box, plain, FAQ JSON-LD).'})}}
// b) code/light page vs its linked guide for same condition
const guideConds={};safety.filter(s=>s.route.startsWith('/symptoms/')&&(s.kind==='safety'||s.kind.startsWith('result'))).forEach(s=>{const g=s.route.split('/')[2];s.conds.filter(c=>STOPCONDS.has(c)).forEach(c=>{const k=g+'|'+c;if(!guideConds[k]||RANK[s.level]>RANK[guideConds[k].level])guideConds[k]=s})});
const LIGHTS=require('../../src/lights.js');const codeGuide={};for(const f of fs.readdirSync('src/codes'))for(const c of JSON.parse(fs.readFileSync('src/codes/'+f,'utf8')))if(c.guide)codeGuide['/codes/'+c.code.toLowerCase()+'/']=[c.guide];
LIGHTS.forEach(l=>codeGuide['/warning-lights/'+l.id+'/']=l.guides);
const seenB=new Set();
for(const [route,ss] of Object.entries(byRoute)){const gs=codeGuide[route];if(!gs)continue;
  for(const s of ss.filter(s=>['plain','drive','flash','meaning','todo'].includes(s.kind)))for(const c of s.conds.filter(c=>STOPCONDS.has(c)))for(const g of gs){const gs_=guideConds[g+'|'+c];if(!gs_)continue;
    if(RANK[gs_.level]-RANK[s.level]>=1||RANK[s.level]-RANK[gs_.level]>=2){const k=route+c+g+s.text;if(seenB.has(k))continue;seenB.add(k);
      addC({type:'page vs linked symptom guide',condition_or_symptom:c,context_a:gs_.route+' '+gs_.field,text_a:shortT(gs_.text),level_a:gs_.level,context_b:route+' '+s.field,text_b:shortT(s.text),level_b:s.level,severity:RANK[gs_.level]>=5&&RANK[s.level]<=3?'high':'medium',recommendation:'Page and its "Walk through it" guide must give the same action for '+c+'; adopt the guide\'s stop wording (pending sign-off).'})}}}
// c) decision result: badge urgency vs unconditional now text
for(const s of safety.filter(s=>s.kind==='result-now'&&s.rurg)){const unc=!/^if\b|\bif\b/i.test(s.text);if(!unc||!s.level)continue;
  const d=RANK[s.level]-RANK[s.rurg];if(Math.abs(d)>=2||(s.rurg==='stop'&&RANK[s.level]<4)||(s.level==='stop'&&RANK[s.rurg]<=2))addC({type:'result badge vs result "what to do now"',condition_or_symptom:s.rtitle,context_a:s.route+' node '+s.node+' result badge (also mechanic summary + email label)',text_a:s.rurg,level_a:s.rurg,context_b:s.route+' '+s.field,text_b:shortT(s.text),level_b:s.level,severity:(s.level==='stop'&&RANK[s.rurg]<=2)||(s.rurg==='stop'&&RANK[s.level]<=2)?'high':'medium',recommendation:'Align result.urgency with result.now (badge drives mechanic summary and email label).'})}
// d) cross-site condition summary: stop vs non-stop advice for the same condition
const lvlBy={};safety.filter(s=>!['badge','vbadge','result-badge'].includes(s.kind)).forEach(s=>s.conds.filter(c=>STOPCONDS.has(c)).forEach(c=>{(lvlBy[c]=lvlBy[c]||{});(lvlBy[c][s.level]=lvlBy[c][s.level]||[]).push(s)}));
for(const [c,m] of Object.entries(lvlBy)){if(!m.stop)continue;for(const l of ['stop_soon','urgent','soon','check','ok'])if(m[l]){const a=m.stop[0],b=m[l][0];
  addC({type:'site-wide: same condition, different action',condition_or_symptom:c,context_a:a.ctx+' (+'+(m.stop.length-1)+' more stop contexts)',text_a:shortT(a.text),level_a:'stop',context_b:m[l].slice(0,6).map(x=>x.ctx).join('; ')+(m[l].length>6?'; +'+(m[l].length-6)+' more':''),text_b:shortT(b.text),level_b:l,severity:RANK[l]<=3?'high':'medium',recommendation:'Review the '+m[l].length+' '+l+' context(s) for '+c+'; most should use the stop wording unless the condition is genuinely milder (e.g. a single brief flicker).'})}}
// e) vehicle issue pill vs next-step text
const vb={};safety.filter(s=>s.kind==='vnext').forEach(s=>{if(s.level==='stop'&&s.sev!=='high'){const k=s.route+s.issue;if(vb[k])return;vb[k]=1;
  addC({type:'vehicle issue pill vs next-step',condition_or_symptom:s.issue,context_a:s.route+' issue pill (also PDF report)',text_a:s.sev==='med'?'Get checked':'Monitor',level_a:s.sev==='med'?'soon':'check',context_b:s.ctx,text_b:shortT(s.text),level_b:'stop',severity:'high',recommendation:'Set issue sev to high (and rename the "Stop soon" label; see vocab conflict).'})}});
const vstop=safety.filter(s=>s.kind==='vnext'&&s.level==='stop'&&s.sev==='high');
addC({type:'label vocabulary',condition_or_symptom:'stop-level badge wording',context_a:'build.js UL.stop / src/guide.js URG.stop (symptom results, mechanic summary)',text_a:"Stop — don't drive it",level_a:'stop',context_b:'build.js CURG.stop (20 code pages); build.js LSEV.stop (lights); src/app.js + src/pdf.js SEV.high (vehicle issues, PDF); api/_email.js URG.stop',text_b:"\"Stop driving soon. This can cause damage or be unsafe.\" / \"Stop driving as soon as it's safe\" / \"Stop soon\" / \"Stop: don't drive it\"",level_b:'stop_soon',severity:'high',recommendation:'One stop label site-wide ("Stop driving — don\'t drive it until it\'s checked"); "soon" weakens it. '+vstop.length+' vehicle next-step texts say stop/do-not-drive while the pill reads "Stop soon".'});
writeCsv('conflicts.csv',['conflict_id','type','condition_or_symptom','context_a','text_a','level_a','context_b','text_b','level_b','severity','recommendation'],C);
fs.writeFileSync(D+'summary.json',JSON.stringify({instructions:instr.length,contexts:ctxCount,groups:grpCount,ordering:ord.length,orderingByPrefix:ord.reduce((a,o)=>{const k=o.route.split('/')[1]+(o.route.includes('#')?'#result':'');a[k]=(a[k]||0)+1;return a},{}),conflicts:C.length,conflictsByType:C.reduce((a,c)=>{a[c.type]=(a[c.type]||0)+1;return a},{}),highConf:C.filter(c=>c.severity==='high').length},null,1));
console.log(fs.readFileSync(D+'summary.json','utf8'));
