# Independent QA report: VehicleSymptoms.com audit fixes (2026-11-21)

I did not write any of the fixes. Every check below was rerun or rewritten by me. My scripts are in `audit/qa/` and do not reuse `tools/regression.js` or `audit/links/test-links.js`. They load the built `dist/` pages in jsdom through a ResourceLoader that serves the real `/*.js` files, with my own NHTSA stubs and my own estimator fixture.

Repo state: HEAD is `01f429a` and `dist/` was built at 01:26–01:28. Commit `59acade` **does not exist in this repo** (`git cat-file` fails), so I could not confirm the claim that production runs 59acade or that 59acade matches HEAD. While I was working, another agent edited `build.js` and `src/template.html` without committing (the H1 change), and created `audit/pricing/text/` and `audit/recalls/single/`. `dist/` does not include those edits.

## 1. Existing suites rerun

| Suite | Result | Notes |
|---|---|---|
| `node tools/regression.js` | 29/29 pass, exit 0 | Its pricing tests use a fixture estimator. Production `price-est.js` ships `jobs: []`. |
| `node audit/links/test-links.js` | 890/890 pass, exit 0 | 3907/15110 issues have a guide link; labelled exact recall 224/225 |
| `node tools/route-tests.js` | 10573/10574 pass | The one failure is `/404.html`, which is expected |
| `node tools/release-check.js` | BLOCKED, exit 1 | Same counts as the committed json; only the time and revision differ |

Rerunning these tools overwrote `audit/generated/regression-results.json` and `release-check.json`. I copied the rerun outputs to `audit/qa/rerun-outputs/` and restored the originals. Console logs are in `audit/qa/run-*.txt`.

The committed `audit/generated/release-check.json` reports revision `2509662… (+uncommitted changes)`, not HEAD `01f429a`. **It is stale.** The rerun reports `01f429a (+uncommitted changes)` because of the other agent's edits in progress.

## 2. Critical fixes, retested independently

### a. Recalls: PASS on the build (`qa-recalls.js`, 15/15)
- 2023 Integra queries `make=ACURA&model=INTEGRA&modelYear=2023`. A validated 2-result response shows **2** in both the tile and the box, with both campaigns listed. A campaign repeated in one response is counted once.
- Each of these shows "Safety recalls: lookup unavailable" plus the `https://www.nhtsa.gov/recalls` link, and never 0:
  - HTTP 500
  - non-JSON body
  - `results:null`
  - missing Count
  - bad campaign number
  - wrong model year
  - wrong make
  - network reject
  - a 10 s timeout through AbortController (timers accelerated)
- Rivian 2023 sends separate R1T and R1S queries and totals 2 distinct campaigns. If one of the two fails, the page shows unavailable rather than a partial count.
- I opened all **561** combined-label year pages: 1294 NHTSA queries, and none had `/` in `model`.
- Live NHTSA, fetched today, for verified ranges across 3 makes: LINCOLN NAUTILUS 2020 Count 5, BMW Z4 2004 Count 1, TOYOTA PRIUS C 2018 Count 2. In each, every row's Make/Model/ModelYear matches the query, so the site's validator would accept it. ACURA INTEGRA 2023 live returns Count 2 (23V430000, 24V744000).
- Side effect, by design: 6,776 year pages with no verified mapping show "Lookup unavailable" whenever NHTSA really returns 0.

### b. Pricing: PARTIAL FAIL (`qa-pricing.js` 15/18, `qa-price-data.js`)
- PASS:
  - With production data, the 2023 Model Y never offers a spark-plug job and shows no `$` figure or verdict.
  - With my fixture (which contains a spark-plug estimate), the Model Y says "does not apply to a battery-electric vehicle" and the Go button stays disabled.
  - A 2015 Camry (gasoline) is still offered the job and gets a verdict.
  - The verdict clears when the state, amount, kind of vehicle, year, or vehicle (Camry to Model Y) changes.
- PASS: across 570 `dist/data/v` files, none of the 13,467 withheld objects carries lo/hi/amount, and there are zero numeric non-free price objects. `GEN_PRICES=[]`, and `EST.jobs=[]`.
- **FAIL (production path):** typing "spark plug" for a 2023 Model Y does not show the "does not apply" message. It shows "No match yet…" and then "**No sourced range yet for Spark plug replacement**: we have not found enough public parts prices…". That implies the repair applies and is only unpriced. The held-job message skips the eligibility check (`src/app.js`, `E.held` branch). The existing PRC-02 passes only because it injects a fixture job.
- **FAIL (withheld prices leak through prose):** 477 withheld maintenance records in 194 vehicles have dollar figures in `note`. These render next to "Price not verified" on vehicle pages. For example, `/vehicles/acura-ilx/2016/` shows "Iridium spark plugs… RepairPal lists $293–$345. Price not verified". I ran `src/pdf.js` with a recording jsPDF stub over all 570 vehicles × (all years + each year) = 8,051 PDFs. **2,623 PDFs print dollar figures** (list in `qa-price-pdf-dollars.txt`), all from these notes. The PDF never prints a withheld lo/hi.
- The PDF footnote (`SNAP_NOTE`) still says "Prices are U.S. national averages researched in November 2026" even though no prices are shown.

### c. Urgency: PASS for the claimed 52 codes, but coverage is incomplete (`qa-urgency.js`)
- On P0300, P0302, P0306, P0308, P0351 and P0335, the first urgency element after the code H1 (in document order) is `.urg-first` with the stop condition. The FAQ JSON-LD "Can I drive" answer opens with the same sentence.
- **Gap:** 37 ignition-coil codes still bury the stop condition under a softer "How urgent? Get it checked in the next few days" badge (`qa-urgency-sweep.csv`). These are **P2300–P2335** (36 codes, such as "Ignition Coil A Primary Control Circuit Low") and **P06D1**. This is the same pattern as the original P0300 failure.
- **Conflict:** on 7 pages (P0300, P0351–P0356), the drive box "Otherwise:" paragraph repeats the flashing-light case with softer advice: "slow down and get it checked right away". This sits directly under "pull over… turn the engine off".

### d. Links (rendered in jsdom): vehicle pages PASS; guide pages FAIL with a crash (`qa-links.js` 13/16)
- PASS: the 2024 Model 3 rearview-camera recall card has no walk-through link, and no card on that page links to delayed engagement. The Acura wiper issues (RSX/Integra 2023, TL 2004 and 2005) have no pulls-to-one-side link. Genuine delayed-Reverse issues link to `/symptoms/delayed-engagement-into-gear/`: Aviator 2004, Thunderbird 2004, Town Car 2003.
- **FAIL (new, high severity):** when a vehicle is set (`?v=` or the saved garage) and a matched issue has a withheld cost, the guide result throws `TypeError … toLocaleString` at `guide.js` `money(i.cost.lo)`. The result never renders, so the click on the last answer does nothing and the driver never sees the result's safety advice.
  - It affects **3,261 of 3,767** vehicle × guide pairs that have a match (557 vehicles, 96 guides; `qa-guide-crash-scope.json`).
  - Live `/guide.js` has the same unguarded `money(i.cost.lo)`, and live app.js has the withheld-price code, so this very likely happens in production too.
- `guide.js` still says "covers 100 popular models" (the site has 570).

### e. Live spot check: production does NOT match this build
- `/codes/p0300/`: the live stop box reads "If the check engine light is flashing, or the engine is shaking hard or losing power: **ease off the gas**, avoid hard acceleration… get off the road". `dist` reads "pull over when it's safe and turn the engine off. Don't keep driving… towed". The live wording matches commit `2509662`, not HEAD. The stop box is still first, and the live page also has two H1s.
- `/vehicles/`: WebFetch failed twice with client_error. The live `sitemap.xml` is about 93 bytes shorter than `dist` and ends at `/vehicles/volvo-xc90/2024/` **without the `/vehicles/` entry**, so the live sitemap has 10,572 URLs.
- `/price-check/`: the H1, title and explanatory text match `dist`; there are no dollar figures.
- `/vehicles/acura-rsx-integra/2023/`: the title, H1, canonical, breadcrumb and "Checking the NHTSA recall database…" match `dist`.
- Live `/app.js` has the recall validation, "Safety recalls: lookup unavailable", "Insufficient verified pricing" and VS_PT. Live `/guide.js` has `matchesGuide`.
- So production is an intermediate deploy: newer than 2509662 for the JS, older than HEAD for the code copy and `/vehicles/`.

## 3. Reconciliation (details in `reconciliation.csv`)
- **URLs:** 10,573 = 10,572 + `/vehicles/`. Models (570), model-years (7,175), combined labels (37) and combined year pages (561) are unchanged and verified against `dist`.
- **Price ledger:** 19,819 = inventory 20,375 − 556, where the 556 are four families left out of the ledger: code-derived common ranges 188, benchmarks 243, menu prices 73, labor rates 52. Withheld 15,177 adds up exactly. The `dist/data/v` withheld objects (13,467) are the per-vehicle subset.
- **Safety:** the CSV has 4,016 instructions, 18,726 contexts and 198 condition groups. The build/release gate has 8,083 contexts and 7,524 exact-text groups.
  - The gate leaves out year pages and the drive text of non-stop codes, so it under-counts by about 10.6k contexts.
  - Signing off the 198 CSV groups would not satisfy `signoffFor()`, which needs a text-hash group plus each context.

## 4. Where OWNER-SUMMARY.md overstates or misstates
1. "Preview and production run the audited build": **false** for production (P0300 copy, sitemap and `/vehicles/` differ). The release-check json it relies on is stamped with 2509662, not HEAD.
2. "Tesla Model Y spark plugs … fixed; PRC tests passing": the passing tests use a fixture. On the real data path the driver gets a "no sourced range yet" message rather than "does not apply".
3. "Prices withheld": withheld prices still appear as dollar figures in maintenance notes on 194 vehicles' pages and in 2,623 PDFs. Withholding also broke the guide result for 3,261 vehicle × guide pairs, which no test covers.
4. "urgent_if renders first on 52 misfire/ignition/crank codes": true, but 37 more ignition-coil codes (P2300–P2335, P06D1) still have the buried-warning pattern. 7 pages contradict themselves under "Otherwise".
5. "Safety sign-off: 8,083 contexts, 198 reviewer groups": these numbers come from two different inventories. The gate actually needs 7,524 groups. 8,083 also understates the 18,726 rendered contexts.
6. "10,573/10,573 routes pass": correct, but it is structural only. Every non-home page still has two H1s (the hidden home hero plus the page H1). Another agent's uncommitted fix emits `</p class="hh1">` as a closing tag, which is invalid HTML.

## Files
`audit/qa/harness.js`, `qa-recalls.js`, `qa-pricing.js`, `qa-price-data.js`, `qa-urgency.js`, `qa-links.js`, `qa-guide-crash-scope.js`; results in `qa-*.json`, `qa-urgency-sweep.csv`, `qa-price-pdf-dollars.txt`, `combined-pages-tested.txt`, `run-*.txt`, `rerun-outputs/`, `before/`.
