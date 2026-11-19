# Estimator accuracy log (newest first)

## Run 2026-11-19 20:38 UTC started

## Run 2026-11-19 18:40 UTC finished 20:00 UTC (stopped: web search limit reached)
- Totals: 12 jobs researched this run (first run): 2 passed review, 10 held `[~]` with partial files saved. State labor rates: first pass saved, held.
- Batch 2 (spark plugs, A/C compressor, radiator, fuel pump + labor rates): the shared web search budget ran out mid-batch, after which pages not already seen in search results could not be fetched. Job files hold verified labor times only (mostly NHTSA-hosted Toyota/Honda warranty times) with parts and benchmarks null. rates.json: 51 entries, range about $100 (WV) to $175 (CA), versus the live flat $120–$160; all-shop averages, no dealer split.
- Set-up note: `estimator` was brought up to date with main by a merge, not a rebase (a rebase needs a force-push, which the run is not allowed to do).
- Batch 1 (8 jobs): 2 passed review (wheel bearing/hub, timing belt), 6 held `[~]` with files saved (brakes, alternator, starter, water pump, head gasket, catalytic converter). Held files have real, sourced parts prices but `hours: null` for 1–3 classes.
- Biggest gaps vs live: head gasket low end ($1,075) is far below anything the evidence builds (about $2,400 up; benchmarks $2,400–$3,400); catalytic converter is too low at both ends and CARB-state parts alone can pass the $2,450 top; alternator low end ($270) is below any buildable total (cheapest reman unit $221 before labor; about $340 up).
- Systemic problem: free public labor times are scarce. NHTSA bulletins rarely cover these jobs on the example vehicles; what was found is often a parts seller's "approx N hours" or a forum-quoted book time. Parts sourcing is solid (OEM list from dealer parts sites, aftermarket from retailers).
- Blocked/unusable: WebFetch hourly limit (shared by all agents, cost each about 20 min); PartsGeek, parts.olathetoyota.com, justanswer.com, jegs.com, go-parts.com, ford.oempartsonline.com (errors); RockAuto/AutoZone/O'Reilly intermittent or priceless; ford.com and autoparts.toyota.com show no price without scripts; AAA estimator gave no data. Not used on purpose: manuals.autorepairshq.com (leaked manual data), tpautorepair.net (templated). openlaborproject.com gives no provenance: treat as unverified.

## Baseline 2026-11-19 (set-up session) finished
- Labor rate: the live site uses a flat $120–$160/hr everywhere. That matches the national middle (PartsTech survey: about half of shops charge $120–$159), but state averages run from about $85 to $197 (Tekmetric, 2026). Location is the largest single source of error.
- Ranges are too wide to judge a quote. Live "Head gasket repair" is $1,075–$3,700 and "Alternator replacement" is $270–$975, pooled across every vehicle. A quote is called "within the typical range" up to 10% over the top end.
- The general ranges are percentiles of per-vehicle problem prices in src/prices, not built per job, and none shows a parts/labor split.
- Next: per-job files by vehicle class (this queue), then state labor rates.
