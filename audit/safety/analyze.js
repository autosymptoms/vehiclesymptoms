// Safety audit step 1: extract every urgency verdict and drive/stop sentence from source data,
// classify topic, condition and action level, and write statements.json for measure.js / report.js.
// Read-only on src/. Run from repo root: node audit/safety/analyze.js
const fs=require('fs');
const OUT='audit/safety/';
// ---- load content the same way build.js does ----
const J=fs.readdirSync('src/journeys').filter(f=>f.endsWith('.json')).sort().map(f=>JSON.parse(fs.readFileSync('src/journeys/'+f,'utf8')));
const CODES=[];{const seen=new Set();for(const f of fs.readdirSync('src/codes').filter(f=>f.endsWith('.json')).sort())for(const c of JSON.parse(fs.readFileSync('src/codes/'+f,'utf8'))){if(seen.has(c.code))continue;seen.add(c.code);CODES.push(c)}}
const LIGHTS=require('../../src/lights.js');
const LDEEP=JSON.parse(fs.readFileSync('src/lights-deep.json','utf8'));
global.window={};for(const f of ['src/vehicles.js',...fs.readdirSync('src/batches').filter(f=>/^batch\d+\.js$/.test(f)).map(f=>'src/batches/'+f)])eval(fs.readFileSync(f,'utf8'));
let V=window.VEHICLES;for(const f of fs.readdirSync('src/deep').filter(f=>f.endsWith('.json'))){const d=JSON.parse(fs.readFileSync('src/deep/'+f,'utf8'));const k=V.findIndex(v=>v.id===d.id);if(k>=0)V[k]=d;else V.push(d)}

// ---- labels copied verbatim from build.js / guide.js / app.js / pdf.js / api/_email.js ----
const UL={stop:"Stop — don't drive it",soon:"Get it checked in the next few days",check:"Book a check when convenient",diy:"Safe to check yourself first"};
const URGLINE={stop:"Don't drive it until it's checked.",soon:"Drive only if you must, gently and close to home.",check:"Not an emergency, but don't ignore it.",diy:"Start with the simple checks below."};
const CURG={stop:"Stop driving soon. This can cause damage or be unsafe.",soon:"Get it checked in the next few days",check:"Book a check when convenient"};
const LSEV={stop:"Stop driving as soon as it's safe",soon:"Get it checked soon",check:"Check it when you can",info:"Information only"};
const VSEV={high:"Stop soon",med:"Get checked",low:"Monitor"};
const EMAILU={stop:"Stop: don't drive it",soon:"Get it checked in the next few days",check:"Book a check when convenient",diy:"Safe to check yourself first"};
const DEFDRIVE={stop:'Stop driving as soon as it is safe and have it checked before going further; this problem can cause damage or affect safety.',soon:'Get it checked in the next few days and drive gently until then. If the check engine light flashes, the engine runs rough, overheats, loses power or stalls, stop and get help right away.',check:'Usually you can keep driving while you book a check. If other warning lights come on, or the car starts running or shifting differently, get it checked sooner.'};

// ---- classifiers ----
const TOPICS=[
 ['brakes',/\bbrak(e|es|ing)\b|brake pedal|stopping distance/i],
 ['steering',/\bsteer/i],
 ['oil_pressure',/oil pressure|oil (warning )?light|red oil can/i],
 ['overheating',/overheat|temperature (gauge|light|warning)|temp gauge|gauge[^.]{0,20}\bred\b|in the red|steam|coolant temp|running hot/i],
 ['smoke_fire',/\bsmoke|\bfire\b|flames?|catch(es)? fire/i],
 ['fuel_leak_smell',/(raw )?(fuel|gas(oline)?) (leak|smell|odou?r)|smell(s|ing)? (of )?(raw )?(fuel|gas(oline)?)\b|fuel smell|leaking fuel/i],
 ['airbag',/airbag|\bsrs\b|supplemental restraint/i],
 ['high_voltage_ev',/high[- ]voltage|orange cable|hybrid (system|battery)|traction battery|\bev battery|electric vehicle|hybrid/i],
 ['misfire_cel',/misfir|check engine light[^.]{0,30}(flash|blink)|(flash|blink)ing (check engine|engine|cel|mil)|engine light (flash|blink)|\bshak(e|es|ing)\b[^.]{0,20}(hard|bad|violent)/i],
 ['power_loss_stall',/\bstall|cuts? out|cut(s|ting)? out|los(e|es|ing) power|loss of power|reduced (engine )?power|limp mode|shuts? down/i],
];
const CONDS=[
 ['CEL_FLASHING',/(check engine|engine|exhaust|emission)[^.;]{0,25}(light|lamp|mil)?[^.;]{0,15}(flash|blink)|(flash|blink)ing[^.;]{0,20}(check engine|engine light|cel|mil)/i],
 ['SEVERE_SHAKING',/shak(e|es|ing)[^.;]{0,15}(hard|badly|violent|severe|a lot)|(violent|severe|heavy)(ly)? (shak|misfir|vibrat)/i],
 ['TEMP_RED_OVERHEAT',/(temperature|temp) (gauge|light|warning)[^.;]{0,40}(red|high|hot|climb|rise)|gauge[^.;]{0,25}\bred\b|in the red|overheat|steam/i],
 ['OIL_PRESSURE_LIGHT',/oil pressure|red oil (can|light)|oil (warning )?light (comes|is|stays|flicker)/i],
 ['BRAKE_PEDAL_FLOOR_SOFT',/pedal[^.;]{0,35}(floor|sink|goes (all the way )?down|soft|spongy|low)|spongy|brakes? (fail|don'?t work|not work|feel weak)|no brakes/i],
 ['RED_BRAKE_LIGHT',/red brake (warning )?light|brake warning light|brake light (stays|is) on/i],
 ['SMOKE_FIRE',/\bsmoke|\bfire\b|flames?/i],
 ['FUEL_SMELL_LEAK',/(raw )?(fuel|gas(oline)?) (leak|smell|odou?r)|smell(s|ing)? (of )?(raw )?(fuel|gas(oline)?)\b|leaking fuel/i],
 ['STEERING_LOSS_HEAVY',/steering[^.;]{0,40}(lock|loss|lost|fail|very heavy|heavy|very hard|stiff|loose|wander)|los(e|es|ing|t) steering|can'?t steer|hard to steer/i],
 ['AIRBAG_LIGHT',/airbag|\bsrs\b/i],
 ['HIGH_VOLTAGE',/high[- ]voltage|orange cable|traction battery|hybrid system|hybrid battery/i],
 ['STALL_POWER_LOSS',/\bstall|cuts? out|los(e|es|ing) power|loss of power|reduced (engine )?power|limp|shuts? down/i],
];
const NEG=/\b(not|isn'?t|no|without)\s+(flashing|blinking|smoke|steam|shaking)|steady \(not flashing\)|light is steady/gi;
const LEVELS=[ // first match wins
 ['stop_soon',/stop driving soon|stop soon|ease off and stop|stop driving as soon as you (can|reasonably)/i],
 ['stop',/pull over|stop driving|don'?t drive|do not drive|not drive (it|the car)|turn (the |your )?(engine|car) off|switch (the )?engine off|shut (it|the engine) off|(have it|get it|be) towed|\btow(ed| it| truck)\b|step away|get (everyone )?out|call 911|not safe to drive|stop (the car|now|right away|as soon as|and get help|immediately)|^no\b|^not if|don'?t keep driving|don'?t start|do not start|stop as soon/i],
 ['urgent',/right away|immediately|\btoday\b|same[- ]day|today'?s (problem|job)|as soon as possible|without delay|straight to a shop|urgent/i],
 ['soon',/next few days|few days|\bsoon\b|day or two|this week|within a week|in the next week|book (a|the) shop/i],
 ['check',/lowurg|when (it'?s )?convenient|book a check|when you can|next service|keep an eye|monitor|week or two|next week or so/i],
 ['ok',/usually (yes|fine|you can)|keep driving|safe to drive|can (still |usually )?drive|drives normally|you are fine|^yes\b|finish (your|a local) trip/i],
];
const RANK={stop:5,stop_soon:4,urgent:3,soon:2,check:1,ok:0,diy:0,info:0};
const CAT=/overheat(s|ing)?( and (ruin|damage|destroy|wreck|melt))?( the| your)? (catalytic )?(converter|cat)\b|(converter|cat)[^.;]{0,25}overheat/gi;
const topicsOf=t=>{t=String(t).replace(CAT,' cat-damage ');return TOPICS.filter(([,r])=>r.test(t)).map(([k])=>k)};
const condsOf=t=>{const c=t.replace(CAT,' cat-damage ').replace(NEG,' ');return CONDS.filter(([,r])=>r.test(c)).map(([k])=>k)};
const levelOf=t=>{t=String(t).replace(/less urgent|not urgent|not an emergency|isn'?t urgent/gi,'lowurg');for(const [k,r] of LEVELS)if(r.test(t))return k;return ''};
const ADVICE=new RegExp(LEVELS.map(([,r])=>r.source).join('|'),'i');
const sentences=t=>String(t||'').replace(/\s+/g,' ').split(/(?<=[.!?;])\s+(?=[A-Z])|;\s+(?=[iI]f )/).map(s=>s.trim()).filter(Boolean);

const S=[]; // statements
function add(o){o.topics=o.topics||topicsOf(o.text+' '+(o.ctxText||''));o.conds=o.conds||condsOf(o.text);o.level=o.level||levelOf(o.text);S.push(o)}
// split a field into advice sentences; keep only safety-relevant ones
const CELCTX=/check engine|misfir|exhaust emission|emission light|engine light|engine sputter|rough idle|shak/i;
function addField(base,text,ctxText){for(const s of sentences(text)){const tp=topicsOf(s),cd=condsOf(s);
  if(CELCTX.test(ctxText||'')&&/\b(flash|blink)/i.test(s.replace(NEG,' '))&&!cd.includes('CEL_FLASHING')&&!/traction|slip|stability|tire|tpms|airbag|oil|brake|battery/i.test(s+' '+(ctxText||'').slice(0,40)))cd.push('CEL_FLASHING');
  if(CELCTX.test(ctxText||'')&&/(engine|car)[^.;]{0,20}shak|shak(e|es|ing)[^.;]{0,6}(hard|bad|violent)/i.test(s)&&!cd.includes('SEVERE_SHAKING'))cd.push('SEVERE_SHAKING');
  if(cd.includes('CEL_FLASHING')&&!tp.includes('misfire_cel'))tp.push('misfire_cel');if(!ADVICE.test(s))continue;if(!tp.length&&!cd.length&&!topicsOf(ctxText||'').length)continue;add({...base,text:s,topics:tp.length?tp:topicsOf(ctxText||''),conds:cd})}}

// codes
const SAFETYCODE=c=>topicsOf([c.title,c.plain,c.sys].join(' '));
for(const c of CODES){const r='/codes/'+c.code.toLowerCase()+'/';const tp=SAFETYCODE(c);const drive=c.drive||DEFDRIVE[c.sev];
  const ctx=[c.title,c.plain].join(' ');
  if(c.urgent_if)addField({kind:'urgent_if',route:r,field:'urg-first alert (c.urgent_if, above badge)',sev:c.sev,src:'src/codes '+c.code+'.urgent_if',order:0},c.urgent_if,ctx);
  add({kind:'badge',route:r,field:'urg-badge',text:(c.urgent_if?'Otherwise: ':'')+CURG[c.sev],level:c.sev==='stop'?'stop_soon':c.sev,topics:tp,conds:[],sev:c.sev,src:'build.js CURG['+c.sev+'] via src/codes '+c.code+'.sev',order:1});
  addField({kind:'plain',route:r,field:'what-it-means (c.plain)',sev:c.sev,src:'src/codes '+c.code+'.plain',order:2},c.plain,ctx);
  addField({kind:'drive',route:r,field:c.drive?'drive-box (c.drive)':'drive-box (build.js default '+c.sev+')',sev:c.sev,src:c.drive?'src/codes '+c.code+'.drive':'build.js default drive text',order:3},drive,ctx);
  addField({kind:'faq',route:r,field:'FAQ JSON-LD "Can I drive with code"',sev:c.sev,src:'urgent_if + drive',order:9},(c.urgent_if?c.urgent_if+' Otherwise: ':'')+drive,ctx);
  c._tp=tp;c._g=c.guide;
}
// lights
for(const l of LIGHTS){const r='/warning-lights/'+l.id+'/';const d=LDEEP[l.id]||{};const ctx=l.name+' '+l.meaning;const tp=topicsOf(ctx+' '+l.drive);
  add({kind:'badge',route:r,field:'urg-badge',text:LSEV[l.sev],level:l.sev==='info'?'ok':l.sev,topics:tp,conds:[],sev:l.sev,src:'build.js LSEV['+l.sev+'] via src/lights.js '+l.id+'.sev',order:1});
  addField({kind:'meaning',route:r,field:'what-it-means',sev:l.sev,src:'src/lights.js '+l.id+'.meaning',order:2},l.meaning,ctx);
  addField({kind:'drive',route:r,field:'drive-box (l.drive)',sev:l.sev,src:'src/lights.js '+l.id+'.drive',order:3},l.drive,ctx);
  if(d.flash)addField({kind:'flash',route:r,field:'drive-box lflash (deep.flash)',sev:l.sev,src:'src/lights-deep.json '+l.id+'.flash',order:4},d.flash,ctx);
  l.todo.forEach((t,i)=>addField({kind:'todo',route:r,field:'what-to-do-now #'+(i+1),sev:l.sev,src:'src/lights.js '+l.id+'.todo['+i+']',order:5},t,ctx));
  addField({kind:'faq',route:r,field:'FAQ JSON-LD "Can I drive with the light on" (l.drive)',sev:l.sev,src:'src/lights.js '+l.id+'.drive',order:9},l.drive,ctx);
  (d.faqs||[]).forEach((f,i)=>addField({kind:'faq',route:r,field:'FAQ JSON-LD deep.faqs['+i+'] "'+f.q+'"',sev:l.sev,src:'src/lights-deep.json '+l.id+'.faqs['+i+']',order:9},f.a,ctx));
  (d.dont||[]).forEach((t,i)=>addField({kind:'dont',route:r,field:'what-not-to-do #'+(i+1),sev:l.sev,src:'src/lights-deep.json '+l.id+'.dont['+i+']',order:7},t,ctx));
}
// journeys
for(const j of J){const r='/symptoms/'+j.id+'/';const ctx=j.title+' '+j.h1;
  j.safety.forEach((s,i)=>addField({kind:'safety',route:r,field:'safety box #'+(i+1),src:'src/journeys/'+j.id+'.json safety['+i+']',order:1},s,ctx));
  addField({kind:'intro',route:r,field:'intro',src:'src/journeys/'+j.id+'.json intro',order:0},j.intro,ctx);
  for(const [nid,n] of Object.entries(j.nodes)){
    if(n.help)addField({kind:'help',route:r,field:'node '+nid+' help',src:'src/journeys/'+j.id+'.json nodes.'+nid+'.help',order:nid===j.start?2:6},n.help,ctx);
    if(!n.result)continue;const x=n.result;const rctx=ctx+' '+x.title+' '+x.now;
    const tp=topicsOf(rctx);
    add({kind:'result-badge',route:r,field:'node '+nid+' result badge (+ mechanic summary, email)',text:UL[x.urgency],level:x.urgency,topics:tp,conds:condsOf(x.title),src:'src/journeys/'+j.id+'.json nodes.'+nid+'.result.urgency',order:20,rtitle:x.title,node:nid,guide:j.id});
    addField({kind:'result-now',route:r,field:'node '+nid+' result now ['+x.urgency+']',src:'src/journeys/'+j.id+'.json nodes.'+nid+'.result.now',order:21,rurg:x.urgency,node:nid,guide:j.id,rtitle:x.title},x.now,rctx);
    (x.if||[]).forEach((t,i)=>addField({kind:'result-if',route:r,field:'node '+nid+' result if['+i+'] ['+x.urgency+']',src:'src/journeys/'+j.id+'.json nodes.'+nid+'.result.if['+i+']',order:22,rurg:x.urgency,node:nid,guide:j.id,rtitle:x.title},t,rctx));
  }
}
// vehicles: only issues whose next-step text gives explicit drive/stop advice on a safety topic
for(const v of V)for(const i of v.issues){const r='/vehicles/'+v.id+'/';const ctx=[i.t,i.sym].join(' ');
  const tp=topicsOf(ctx+' '+i.next);if(!tp.length)continue;
  add({kind:'vbadge',route:r,field:'issue "'+i.t.slice(0,60)+'" sev pill',text:VSEV[i.sev],level:i.sev==='high'?'stop_soon':i.sev==='med'?'soon':'check',topics:tp,conds:[],sev:i.sev,src:'src/app.js+src/pdf.js SEV['+i.sev+'] via vehicle '+v.id,order:30,issue:i.t});
  addField({kind:'vnext',route:r,field:'issue "'+i.t.slice(0,60)+'" next',sev:i.sev,src:'vehicle '+v.id+' issue next',order:31,issue:i.t},i.next,ctx);
}
fs.writeFileSync(OUT+'statements.json',JSON.stringify({S,meta:{codes:CODES.length,journeys:J.length,lights:LIGHTS.length,vehicles:V.length,issues:V.reduce((a,v)=>a+v.issues.length,0)}}));
const by={};S.forEach(s=>by[s.kind]=(by[s.kind]||0)+1);console.log(S.length,by);
module.exports={RANK};
