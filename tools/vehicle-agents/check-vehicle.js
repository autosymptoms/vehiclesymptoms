// Validate one new model's data files without running the full site build.
// Usage: node tools/vehicle-agents/check-vehicle.js <model-id>
//        node tools/vehicle-agents/check-vehicle.js --all   (severity, weak-source and recall-ID checks on every model)
// Checks src/deep/<id>.json, src/prices/<id>.json, src/own/<id>.json and /tmp/vs-newgaps/<id>.json
const fs = require('fs'), path = require('path');
const path0 = require('path');
const R = path0.resolve(__dirname, '../../src');
// VI-03 (Nov 27 audit): hazard issues must be rated high unless a reviewer set "sevReviewed": true with a "sevReason".
// Each rule = [subject, failure words, exclusions], tested against the issue title (case-insensitive).
const HAZARD_RULES = {
  "brake": ["brak", "fail|loss|lose|lost|reduc|weak|soft|sink|hard pedal|pedal (?:gets |goes |turns )?hard|assist|leak|ruptur|burst|crack|separat|disconnect|come loose|wear through|rub through|lengthen|longer stop|lock up|may not stop", "parking brake|park brake|brake lights?\\b|bulb|squeal|squeak|noise|pulsat|vibrat|shudder|light may not|warning light|\\bcap\\b|wear fast|wears? (?:out )?(?:fast|quickly|early)|grind|groan|hold mode|auto ?hold|regen|trailer brake|engine braking|abs light|rotor surface|oily film"],
  "steering": ["steer", "cut(?:s)? out|loss|lose|lost|fail|heavy|hard to turn|binds?|locks? up|separat|come loose|comes loose|detach|break|stiff|quit|shut(?:s)? off", "lock fail|won.t start|will not start|steering lock|column lock|buttons?|emblem|tilt|telescop|heated|call button|clock ?spring|spiral cable|airbag|air bag|controls? fail|lane|heat shield|column (?:snap|click)|wheel lock"],
  "fuel_leak": ["fuel|gasoline", "fuel (?:tank|line|pump|filler|pipe|hose|rail|tube|system|feed|supply|module|delivery|sender)?.{0,25}(?:leak|ruptur|split|crack|seep|drip)|leak\\w* (?:fuel|gas)|fuel leak", "vapor|evap|air leak|radiator|spits back|check engine|spider|injectors? (?:sticks|clog)|misfiring fuel injectors|leaking or misfiring|smell from"],
  "fire": ["\\bfire\\b|catch fire|start a fire|smolder|flames?\\b", ".", "may not fire|not fire|fire without|fire unexpectedly|fire by mistake|fire in a rollover|airbags? (?:may )?fire|when side airbags fire|backfire|misfire|won.t fire|flame-resistant|firestone"],
  "airbag": ["air ?bags?|inflator", "may not|won.t|fail|not deploy|not inflate|ruptur|explod|deploy(?:s)? (?:unexpectedly|without|by itself|on its own)|without a crash|disabled|fragment|installed wrong|wrong airbag|come loose|turn off|shut off|switch off|deactivat|missing", "light (?:on|stays|comes)|warning|clock ?spring|headliner trim"],
  "seatbelt": ["seat ?belt|pretensioner|buckle|belt anchor|child seat anchor|retractor|seat belt mounting", "may not|won.t (?:latch|lock|hold)|fail|unlatch|not latch|not lock|release|break|detach|anchor|fire|come loose|separat|may not hold|not meet", "chime|reminder|warning light|squeak|noise|hard to release|won.t retract|slow to retract"],
  "stall": ["\\bstall|shuts? off while driving|shuts? down while driving|loss of drive power|lose drive power|engine (?:dies|cuts out|quits) while driving|out of run|key can (?:slip|be bumped)", ".", "no.?crank|won.t start|will not start|no.?start|after (?:starting|a cold start)|cold start|idle|after sitting|after the van sits|remote start|refuel|filling|won.t crank|no spark|or no start"],
  "rollaway": ["roll ?away|rolls? away|rolls? (?:on hills|out of park|in park|in gear|while parked|downhill)|(?:leave|leaves|move out of|slip out of|shift out of|out of) park without|leave park|can move out of park|key can be removed (?:out of|without)|park (?:may not|won.t|might not) (?:hold|engage)|park pawl|not (?:shift|go) into park|may not hold the vehicle|can move opposite|move(?:s)? unexpectedly|without (?:the|pressing the) brake", ".", "won.t (?:come|shift) out of park|hard to move|charge|child|stuck in park"],
  "separation": ["wheel(?! cover)|lug|axle|driveshaft|drive shaft|tie rod|ball joint|control arm|subframe|knuckle|\\btread\\b|hitch|half ?shaft|track bar|trailing arm|coil spring|steering (?:shaft|gear|rack|column)|seat (?:back|frame|recliner|anchor)|seatback|hood (?:latch|may open|can open)|tow hook", "come off|comes off|detach|separat|fall(?:s)? off|come loose|comes loose|break off|breaks?\\b|fractur|snap|crack", "bushing|bent or cracked wheels|spark plug|glow plug|catalytic|heat shield|glass|power seat height|trim|cover|cap\\b|noise|rattle|squeak|wheel bearing|paint|hubcap|steering wheel (?:cover|leather|trim)|column (?:snap|click)|lock"],
};
const HZ = Object.fromEntries(Object.entries(HAZARD_RULES).map(([k, v]) => [k, v.map((s) => new RegExp(s, 'i'))]));
const hazardKinds = (t) => Object.keys(HZ).filter((k) => HZ[k][0].test(t) && HZ[k][1].test(t) && !HZ[k][2].test(t));
const sevProblem = (i) => { const h = hazardKinds(i.t || ''); if (!h.length || i.sev === 'high') return null; if (i.sevReviewed === true && i.sevReason) return null; return h; };
// VI-04: aggregator sites that may be cited as a pointer but never as an issue's only source.
const WEAK = /(?:^|\/\/|\.)(?:carwhere\.com|vehicleflaws\.com|forcar\.org|carcomplaintdata\.com|enginepatrol\.com|8020automotive\.com|rerev\.com|askmanual\.pages\.dev|autobarn\.net|theweeklydriver\.com|motorverso\.com|recallcheck\.net|vindecoder\.site|transmissionaudit\.com|cardog\.app|recalldex\.com|motorillustrated\.com|garagedreams\.net|testingautos\.com|carproblemzoo\.com)(?:[\/:?#]|$)/i;
const RID = /\b\d{2}V-?\d{3}\b/;
const weakOnly = (i) => { const s = i.src || []; return s.length > 0 && s.every((u) => /^https?:/.test(u) && WEAK.test(u)) && !s.some((u) => RID.test(u)); };
if (process.argv[2] === '--all') {
  const R0 = path0.resolve(__dirname, '../../src');
  let bad = 0, wkMissing = 0, recNoId = 0, n = 0;
  for (const f of fs.readdirSync(`${R0}/deep`).filter((x) => x.endsWith('.json')).sort()) {
    const d = JSON.parse(fs.readFileSync(`${R0}/deep/${f}`, 'utf8'));
    (d.issues || []).forEach((i, k) => {
      n++;
      const h = sevProblem(i);
      if (h) { bad++; console.log(`SEV ${d.id}#${k} [${i.sev}] ${h.join(',')}: ${i.t}`); }
      if (weakOnly(i) && !i.wk) wkMissing++;
      if (/recall/i.test(i.t) && !RID.test([i.t, i.why, i.next, ...(i.src || [])].join(' ')) && !(i.src || []).some((u) => /nhtsa\.gov/i.test(u))) recNoId++;
    });
  }
  console.log(`${n} issues: ${bad} hazard issues rated below high without sevReviewed (must be 0); ${wkMissing} weak-source-only issues missing "wk": true; ${recNoId} "(recall)" titles with no campaign ID or nhtsa.gov source (warning)`);
  process.exit(bad || wkMissing ? 1 : 0);
}
const id = process.argv[2];
if (!id) { console.log('usage: node check-vehicle.js <model-id> | --all'); process.exit(1); }
const errs = [], warns = [];
const read = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { errs.push(`${p}: ${e.message}`); return null; } };
const d = read(`${R}/deep/${id}.json`), P = read(`${R}/prices/${id}.json`), O = read(`${R}/own/${id}.json`);
let gaps = [];
if (fs.existsSync(`/tmp/vs-newgaps/${id}.json`)) { const g = read(`/tmp/vs-newgaps/${id}.json`); if (g) gaps = g; }
const CATS = ['Warning Lights', 'Smoke', 'Leaks', 'Noises', 'Smells', 'Starting Problems', 'Driving'];
const SYS = new Set();
if (d) {
  if (d.id !== id) errs.push('deep id does not match file name');
  if (!/^[a-z0-9-]+$/.test(id)) errs.push('id must be lowercase letters, digits and hyphens');
  if (!d.make || !d.model) errs.push('make/model missing');
  if (!Array.isArray(d.years) || d.years[0] < 1996 || d.years[1] > 2027 || d.years[0] > d.years[1]) errs.push('years must be [first,last] within 1996-2027');
  if (!Array.isArray(d.wmi) || !d.wmi.length || d.wmi.some(w => !/^[A-Z0-9]{3}$/.test(w))) errs.push('wmi must be a non-empty list of 3-character VIN prefixes');
  const ek = new Set();
  for (const e of d.engines || []) {
    if (!e.k || !e.name || !Array.isArray(e.y)) errs.push('engine needs k, name, y: ' + JSON.stringify(e));
    else if (e.y[0] < d.years[0] || e.y[1] > d.years[1]) errs.push('engine years outside model years: ' + e.k);
    if (ek.has(e.k)) errs.push('duplicate engine key ' + e.k); ek.add(e.k);
  }
  if (!(d.engines || []).length) errs.push('engines list is empty');
  const titles = new Set();
  for (const i of d.issues || []) {
    const tag = `issue "${i.t}"`;
    if (!(i.y && i.y[0] >= d.years[0] && i.y[1] <= d.years[1] && i.y[0] <= i.y[1])) errs.push(tag + ': y outside model years');
    if (!CATS.includes(i.cat)) errs.push(tag + ': bad cat ' + i.cat);
    if (!['high', 'med', 'low'].includes(i.sev)) errs.push(tag + ': bad sev');
    for (const k of ['sys', 't', 'sym', 'why', 'next']) if (!i[k]) errs.push(tag + ': missing ' + k);
    if (!Array.isArray(i.src) || i.src.length < 1) errs.push(tag + ': needs src URLs');
    if (titles.has(i.t)) errs.push('duplicate issue title ' + i.t); titles.add(i.t);
    if (i.engs) { for (const k of i.engs) if (!ek.has(k)) errs.push(tag + ': engs key not in engines: ' + k); if (!i.eng) warns.push(tag + ': has engs but no eng display name'); }
    // VI-14: eng text must be backed by engs keys, or by a non-engine fitment tag: trans (e.g. "CVT", "manual",
    // "8-speed automatic"), drive (e.g. "4WD") or opt: true (an option such as Magnetic Ride or key type).
    if (i.eng && !i.engs && !i.trans && !i.drive && i.opt !== true) errs.push(tag + ': has eng but no engs keys (or trans/drive/opt tag)');
    if (i.trans !== undefined && (typeof i.trans !== 'string' || !i.trans)) errs.push(tag + ': trans must be a non-empty string');
    if (i.drive !== undefined && (typeof i.drive !== 'string' || !i.drive)) errs.push(tag + ': drive must be a non-empty string');
    const hz = sevProblem(i);
    if (hz) errs.push(tag + `: hazard (${hz.join(', ')}) must be sev "high", or set "sevReviewed": true with a "sevReason"`);
    if (i.sevReviewed !== undefined && (i.sevReviewed !== true || !i.sevReason)) errs.push(tag + ': sevReviewed must be true and come with a sevReason');
    if (weakOnly(i) && !i.wk) errs.push(tag + ': only weak aggregator sources; add a primary source or mark "wk": true');
    if (i.wk !== undefined && i.wk !== true) errs.push(tag + ': wk must be true when present');
    if (/recall/i.test(i.t) && !RID.test([i.t, i.why, i.next, ...(i.src || [])].join(' ')) && !(i.src || []).some((u) => /nhtsa\.gov/i.test(u))) warns.push(tag + ': title says recall but no campaign ID (##V-###) or nhtsa.gov source');
    SYS.add(i.sys);
  }
  const n = (d.issues || []).length;
  const minN = (d.years[1]-d.years[0]+1) <= 8 ? 12 : 18;
  if (n < minN) errs.push(`only ${n} issues; aim for 20-35 (minimum ${minN} for this span)`);
  const sold = (y) => y >= d.years[0] && y <= d.years[1] && !gaps.some(g => y >= g[0] && y <= g[1]);
  const thin = [];
  for (let y = d.years[0]; y <= d.years[1]; y++) if (sold(y) && d.issues.filter(i => y >= i.y[0] && y <= i.y[1]).length < 3) thin.push(y);
  if (thin.length) errs.push('years with fewer than 3 issues (thin pages): ' + thin.join(', '));
  for (const i of d.issues || []) { let any = false; for (let y = i.y[0]; y <= i.y[1]; y++) if (sold(y)) any = true; if (!any) errs.push(`issue "${i.t}" only covers years the model was not sold`); }
  const exist = fs.readdirSync(`${R}/deep`).map(f => f.slice(0, -5)).filter(x => x !== id);
  for (const x of exist) { try { const o = JSON.parse(fs.readFileSync(`${R}/deep/${x}.json`, 'utf8')); if (o.make === d.make && o.model === d.model) errs.push('same make+model already exists as ' + x); } catch (e) {} }
}
if (P && d) {
  if (P.id !== id) errs.push('prices id mismatch');
  const titles = new Set(d.issues.map(i => i.t));
  for (const x of P.items || []) {
    if (!titles.has(x.t)) errs.push('price item title not found among issues: ' + x.t);
    if (!x.job || !Array.isArray(x.parts) || !Array.isArray(x.hours) || x.parts.length !== 2 || x.hours.length !== 2) errs.push('price item needs job, parts[lo,hi], hours[lo,hi]: ' + x.t);
    if (!Array.isArray(x.src) || !x.src.length) errs.push('price item needs src: ' + x.t);
  }
  const priced = new Set((P.items || []).map(x => x.t));
  const unpriced = d.issues.filter(i => !priced.has(i.t)).length;
  if (unpriced > d.issues.length * 0.2) warns.push(`${unpriced} of ${d.issues.length} issues have no price; price nearly all of them`);
}
if (O) {
  if (O.id !== id) errs.push('own id mismatch');
  if (typeof O.ev !== 'boolean') errs.push('own.ev must be true/false');
  if (!O.annual || !O.annual.amount) warns.push('own.annual missing');
  const keys = (O.maint || []).map(m => m.key);
  const need = O.ev ? ['front-brakes', 'rear-brakes', 'battery', 'coolant'] : ['oil', 'front-brakes', 'rear-brakes', 'battery', 'spark-plugs', 'coolant'];
  for (const k of need) if (!keys.includes(k)) warns.push('own.maint missing ' + k);
  for (const m of O.maint || []) if (!m.job || !m.every || !Array.isArray(m.parts) || !Array.isArray(m.hours)) errs.push('own.maint item incomplete: ' + m.key);
}
console.log(errs.length ? 'ERRORS:\n - ' + errs.join('\n - ') : 'No errors.');
if (warns.length) console.log('Warnings:\n - ' + warns.join('\n - '));
if (d) console.log(`${d.make} ${d.model} ${d.years.join('-')}: ${d.issues.length} issues, ${(d.engines || []).length} engines, ${(P && P.items || []).length} priced, systems: ${[...SYS].join(', ')}`);
process.exit(errs.length ? 1 : 0);
