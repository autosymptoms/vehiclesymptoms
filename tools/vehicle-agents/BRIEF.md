# Brief: add new vehicle models to VehicleSymptoms.com

VehicleSymptoms.com is a free site where drivers look up problems for their exact car. Every model has a page and a page per model year listing known problems: what the driver notices, why it happens, what to do, and a typical repair cost. There are 112 models today. You are adding the models assigned to you so they match the existing ones in depth and quality.

The repo is the vehiclesymptoms checkout you were given (run commands from its root). Before you start, read these examples carefully and match their structure, tone and depth:
- src/deep/honda-civic.json (model, engines and issues)
- src/prices/honda-civic.json (repair cost for each issue)
- src/own/honda-civic.json (yearly cost and routine maintenance)
- src/own/chevrolet-bolt-ev.json (an EV's maintenance file, for EV models only)

## For each model you produce 3 files (plus 1 if needed)

1. **`src/deep/<id>.json`**: `{id, make, model, years:[first,last], wmi:[...], engines:[...], issues:[...]}`
   - `id`: lowercase make-model with hyphens, e.g. `toyota-sequoia`, `chevrolet-s-10`.
   - `years`: first and last US model year, within 1996–2027. If the model started before 1996, use 1996. Include 2026/2027 only if that model year is sold or officially announced.
   - `wmi`: the 3-character VIN prefixes (World Manufacturer Identifiers) used on US-market VINs for this model. Research them; the VIN decoder uses them.
   - `engines`: every US engine offered, `{k:"short-key", name:"3.5L V6", y:[first,last]}`. Include hybrid and EV powertrains.
   - `issues`: **20–35 real, well-documented problems** spread across the whole year range, so **every model year sold has at least 3 issues**. Each issue:
     `{y:[first,last], sys, cat, sev, t, sym, why, next, src:[urls], eng?, engs?}`
     - `sys`: system, such as Engine, Transmission, Cooling, Electrical, Brakes, Suspension, Steering, HVAC, Fuel, Body, Safety, Exhaust, Emissions, Drivetrain or Hybrid/EV.
     - `cat`: exactly one of `Warning Lights`, `Smoke`, `Leaks`, `Noises`, `Smells`, `Starting Problems`, `Driving`.
     - `sev`: `high` (safety risk or very expensive), `med`, or `low`.
     - `t`: short plain title, e.g. "Timing chain rattle on cold start". Titles must be unique within the model.
     - `sym`: what the driver sees, hears or feels, in plain English.
     - `why`: the cause in plain English.
     - `next`: what the driver should do next. Practical and calm.
     - `src`: 1–3 URLs you actually found that confirm it.
     - **Engine-specific problems** set `eng` (the display name, e.g. "5.3L V8") AND `engs` (a list of the engine `k` keys it applies to). **Problems that aren't engine-specific** (sunroof leak, door lock actuator, A/C, suspension and so on) have NO `eng`/`engs`, which means they apply to every engine version of that model.
     - Include major safety recalls as issues, with "(recall)" at the end of the title.
2. **`src/prices/<id>.json`**: `{id, items:[{t, job, parts:[lo,hi], hours:[lo,hi], recall, note?, src:[urls]}]}`
   - One item per issue, with `t` copied **exactly** from the issue title. Price nearly every issue.
   - `parts` are US dollars for parts and `hours` are book labor hours. The site multiplies hours by $120–160/hr.
   - A recall repair done free by the dealer is `parts:[0,0], hours:[0,0], recall:true`.
3. **`src/own/<id>.json`**: `{id, ev:false, annual:{amount, label, src}, maint:[...]}`
   - Same structure as the Civic example, with keys `oil`, `front-brakes`, `rear-brakes`, `battery`, `spark-plugs` and `coolant`.
   - For an EV, set `ev:true` and follow the Bolt EV example (no oil or spark plugs).
4. **`/tmp/vs-newgaps/<id>.json`**, only if there are US model years inside `years` when the model wasn't sold. Write a list of `[first,last]` ranges, e.g. `[[2006,2018]]` for the Chevrolet Blazer. These years get no page, and the 3-issue rule doesn't apply to them.

## Research and writing rules
- **Lookup budget:** web searches are shared across all agents and capped per round. Use **at most 15 WebSearch calls in total**. Prefer WebFetch on known pages, such as carcomplaints.com/<Make>/<Model>/<year>/, nhtsa.gov/vehicle/<year>/<MAKE>/<MODEL>, repairpal.com/<make>/<model> and yourmechanic.com estimate pages.
- **Never cite au7o.io or cherishyourcar.com.** Both are AI-compiled, and anything sourced only to it will be deleted. Other AI-written content sites are also not acceptable sources. recharged.com may be cited only for EV maintenance-cost figures, never as the only source for a problem. rerev.com is never acceptable as the only source for a problem. Only cite pages you actually opened and read; a search-result title is not a source.
- If you can't find 3 real problems for the newest model years, end `years` at the last year that has them. Don't stretch issues into years with no evidence.
- Use WebSearch and WebFetch. Good sources include NHTSA recalls and complaints, manufacturer TSBs, CarComplaints, Consumer Reports, RepairPal, YourMechanic, KBB, reputable owner forums and repair shops. Only include problems you found real evidence for. Never invent a problem, a year range or a price.
- Write everything in **your own words**. Never copy sentences from sources.
- Write for a regular driver: clear, calm and specific, with no jargon left unexplained.
- Cover the whole year range and every generation, not just recent years. Older years (1996–2010) need problems too.
- Most common and most expensive problems first.

## Checking your work
- Run `node tools/vehicle-agents/check-vehicle.js <id>` after writing each model, and fix every error. Warnings should be fixed too where possible.
- **Do NOT run `npm run build`**: other agents are working in the same repo at the same time.
- Only create files for your own model ids. Don't edit any other file in the repo.

## Report back (short)
For each model, list the id, years, issue count, priced count and any gap years. Also flag anything you weren't sure about.
