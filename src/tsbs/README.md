# src/tsbs — manufacturer bulletins (TSBs, warranty extensions, campaigns)

One file per vehicle model. The file name is the model id used in `src/deep/<model-id>.json`.

```json
{ "id": "<model-id>", "tsbs": [ entry, ... ], "pending": [ lead, ... ] }
```

- `tsbs` holds checked entries. The build copies these into `dist/data/v/<id>.json` as `tsbs`.
- `pending` holds leads that are **not checked yet**. The build must ignore it and nothing in it is published. Each lead says where its facts came from and what to check before it moves into `tsbs`.

## Entry fields (contract 2, plan 07 §5a)

| Field | Rule |
|---|---|
| `id` | `<make>-<mfr_no>` in lower case, unique within the file |
| `mfr_no` | the maker's bulletin number, without the revision letter or version (what a dealer searches for) |
| `rev` | revision or version (`"v3"`, `"F"`) or `null` |
| `nhtsa_id` | NHTSA's numeric id of the **newest** version you checked |
| `nhtsa_pdf` | the PDF URL **as NHTSA gives it** (host `static.nhtsa.gov`). Never build it from the id: the suffix varies (`-0001`, `-9999`, `SB-…`) |
| `date` | bulletin date, `YYYY-MM-DD` |
| `type` | `tsb` · `warranty_ext` · `campaign` · `ota` · `emissions` |
| `years` | `[first, last]`, inside the bulletin's product list **and** inside the model's years in `src/deep` |
| `engines` | engine keys (`engines[].k`) from `src/deep/<id>.json`, only when the bulletin names the engine (or the model name fixes it, e.g. "Accord Hybrid"). `[]` = all or unknown; show "may apply to some engines" |
| `trans` | `"manual"`, `"auto"` (CVT counts as auto) or `null`; only when the bulletin says so |
| `component` | short component label (e.g. `ENGINE`, `POWER TRAIN`) |
| `title` | our words, ≤ 60 characters |
| `plain_summary` | our words, ≤ 280 characters, grade 6–8, no repair steps, no `$`, never "free" |
| `coverage` | `{term, from, until}` for `warranty_ext` / `campaign` only, else `null`. `until` = `YYYY-MM-DD` when the cover ends on a fixed date |
| `symptom_tags` | journey ids from `src/journeys/` the bulletin's symptoms match |
| `codes` | only codes the bulletin itself names |
| `links_to_issue` | exact `t` titles of issues in `src/deep/<id>.json` the bulletin matches |
| `supersedes` | earlier NHTSA ids of the same bulletin (display the newest only) |
| `src` | URLs: the NHTSA PDF (and the byNhtsaId API URL when used) |
| `needs_tech_review` | `true` for every `warranty_ext` (coverage terms) and every bulletin touching brakes, steering, airbags, fuel leaks, loss of drive or another safety-critical symptom. Entries with `true` must not publish until a qualified reviewer signs off |
| `verified` | `{by, date, method, note?}` — who checked what, and how |

## Writing rules

1. Facts come only from NHTSA: the per-bulletin API or the PDF NHTSA posts. Third-party TSB sites (carcomplaints, vehicleflaws…) are for **finding** leads only. Never ALLDATA or Mitchell 1 content.
2. Write the title and summary yourself. No run of 8+ words copied from the NHTSA summary or the PDF. Quote at most a short title (≤ 10 words).
3. No repair steps, torque values, part numbers, labor times or prices.
4. Say "may be covered", never "free". Give coverage terms only for `warranty_ext` / `campaign`.
5. If coverage has probably run out for most cars, say so (`coverage.until`, or in the summary).
6. Keep only bulletins a driver would notice: a symptom, noise, warning light, code, no-start, leak, or a warranty/coverage program. Skip dealer-only items (labels, VIN plates, PDI, tools, collision procedures, diagnostic flowcharts).
7. A bulletin never lowers the urgency of an issue.

## Validator

Run from the repo root. It exits non-zero on any problem.

```sh
node -e "$(sed -n '/^\/\/ VALIDATOR START/,/^\/\/ VALIDATOR END/p' src/tsbs/README.md)"
```

```js
// VALIDATOR START
const fs=require('fs'),D='src/tsbs',errs=[];let n=0;
const J=new Set(fs.readdirSync('src/journeys').filter(f=>f.endsWith('.json')).map(f=>f.slice(0,-5)));
const TYPES=['tsb','warranty_ext','campaign','ota','emissions'];
const BAD=/\$|\bfree\b|\btorque\b|\bNm\b|\bstep \d|\bremove the\b|\binstall the\b|\blabor\b|\bpart (no|number)/i;
for(const f of fs.readdirSync(D).filter(f=>f.endsWith('.json'))){
  const id=f.slice(0,-5),o=JSON.parse(fs.readFileSync(D+'/'+f,'utf8')),E=m=>errs.push(f+': '+m);
  if(o.id!==id)E('id does not match file name');
  if(!fs.existsSync('src/deep/'+id+'.json')){E('no src/deep/'+id+'.json');continue}
  const d=JSON.parse(fs.readFileSync('src/deep/'+id+'.json','utf8'));
  const ek=new Set(d.engines.map(e=>e.k)),titles=new Set(d.issues.map(i=>i.t)),ids=new Set();
  if(!Array.isArray(o.tsbs))E('tsbs must be an array');
  for(const t of o.tsbs||[]){n++;const e=m=>E((t.id||'?')+': '+m);
    if(!t.id||ids.has(t.id))e('missing or duplicate id');ids.add(t.id);
    if(!t.mfr_no)e('mfr_no missing');
    if(!Number.isInteger(t.nhtsa_id))e('nhtsa_id must be an integer');
    try{const u=new URL(t.nhtsa_pdf);if(u.hostname!=='static.nhtsa.gov'||!/\.pdf$/i.test(u.pathname))e('nhtsa_pdf must be a static.nhtsa.gov PDF')}catch{e('nhtsa_pdf not a URL')}
    if(!/^\d{4}-\d\d-\d\d$/.test(t.date||''))e('date must be YYYY-MM-DD');
    if(!TYPES.includes(t.type))e('bad type');
    const y=t.years;if(!Array.isArray(y)||y.length!==2||y[0]>y[1]||y[0]<d.years[0]||y[1]>d.years[1])e('years outside model years '+JSON.stringify(d.years));
    if(!Array.isArray(t.engines))e('engines must be an array');else for(const k of t.engines){if(!ek.has(k))e('unknown engine key '+k);else{const g=d.engines.find(x=>x.k===k).y;if(g[1]<y[0]||g[0]>y[1])e('engine '+k+' not offered in '+y)}}
    if(![null,'manual','auto'].includes(t.trans))e('bad trans');
    if(!t.title||t.title.length>60)e('title missing or > 60 chars');
    if(!t.plain_summary||t.plain_summary.length>280)e('plain_summary missing or > 280 chars');
    for(const s of [t.title,t.plain_summary,JSON.stringify(t.coverage||'')])if(BAD.test(s))e('forbidden wording ($, free, repair steps, part/labor): '+s);
    if(t.coverage!==null&&!['warranty_ext','campaign'].includes(t.type))e('coverage only for warranty_ext/campaign');
    if(t.coverage&&!('term' in t.coverage&&'from' in t.coverage&&'until' in t.coverage))e('coverage needs term, from, until');
    if(t.coverage&&t.coverage.until&&!/^\d{4}-\d\d-\d\d$/.test(t.coverage.until))e('coverage.until must be YYYY-MM-DD');
    for(const s of t.symptom_tags||[])if(!J.has(s))e('unknown journey '+s);
    for(const c of t.codes||[])if(!/^[PBCU][0-9A-F]{4}$/.test(c))e('bad code '+c);
    for(const s of t.links_to_issue||[])if(!titles.has(s))e('links_to_issue not an exact issue title: '+s);
    if(!Array.isArray(t.src)||!t.src.length)e('src missing');
    for(const s of t.src||[])if(!/^https:\/\/(static|api)\.nhtsa\.gov\//.test(s))e('src must be NHTSA: '+s);
    if(t.type==='warranty_ext'&&t.needs_tech_review!==true)e('warranty_ext must have needs_tech_review true until signed off');
    if(typeof t.needs_tech_review!=='boolean')e('needs_tech_review must be boolean');
    if(!t.verified||!t.verified.date||!t.verified.method)e('verified {by,date,method} missing');
  }
  if(o.pending&&!Array.isArray(o.pending))E('pending must be an array');
}
console.log(errs.length?errs.join('\n'):'OK',`(${n} entries)`);process.exit(errs.length?1:0);
// VALIDATOR END
```

Not checked offline (needs NHTSA access): that `nhtsa_id` resolves and `mfr_no` matches, that the PDF returns 200, that every year is in NHTSA's `associatedProducts`, and the 8-word copy check against NHTSA's summary. Do these in the refresh process below.

## Refresh process (monthly, once api.nhtsa.gov and static.nhtsa.gov are allowed)

1. Download the newest `MFR_COMMS_RECEIVED_<years>.zip` (or `TSBS_RECEIVED_…`) from `https://static.nhtsa.gov/odi/ffdd/tsbs/`. Layout: `TSBS.txt` / `MfrComms.txt`.
2. Filter to the site's makes and models. Map NHTSA model names to model ids (e.g. `F-150 SUPER CREW`, `F-150 SUPERCAB`, `F-150 REGULAR CAB` → `ford-f-150`; `/products/vehicle/models?modelYear=&make=&issueType=r` lists NHTSA's names).
3. Take `Warranty Program/Extension` and `Service Campaign` rows first, then service bulletins a driver would notice (rule 6).
4. Group revisions by base number; keep the newest NHTSA id; list older ids in `supersedes`.
5. For each candidate call `https://api.nhtsa.gov/safetyIssues/byNhtsaId?nhtsaId=<id>&filter=issueType&filterValue=manufacturerCommunications` (≤ 1 request/second, cache results). Take `nhtsa_pdf` from `associatedDocuments[].url` and years from `associatedProducts`.
6. Read the PDF for engine, transmission, coverage term, start point, end date and named codes.
7. Write the entry in our own words; run the validator; run the 8-word copy check against the API `summary`.
8. A different person or agent from the writer validates each model. A qualified reviewer checks 100% of `warranty_ext` and safety entries and 10% of the rest, then sets `needs_tech_review` to `false`.
9. Move `pending` leads into `tsbs` only after steps 5–8.
