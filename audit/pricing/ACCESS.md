# Pricing evidence: what access is needed (audit 2026-11-21)

Files in this folder:
- `inventory.js`: run with `node audit/pricing/inventory.js` from the repo root. It is read-only and writes `price-inventory.csv` and `price-inventory-totals.csv`.
- `evidence-attempts.csv`: what could and could not be read from RepairPal, KBB and AAA for five high-traffic repairs, as of 2026-11-21.

## Release rule being tested
A price can be published only if it has:
- a matching RepairPal estimate plus one genuinely independent corroborating source, or
- if RepairPal has no coverage, two independent applicable sources.

Two sites that use the same data provider count as one source.

## Where the inventory stands
- 20,375 published price records.
- 19,707 of them are the site's own figures: issue costs, recall-free items, maintenance items, annual ownership costs, code costs, warning-light cause costs and diagnosis fees, general ranges, and estimator job×class rows.
- The other 368 are attributed third-party figures and labor rates.
- **0 of the site's own figures have a qualifying evidence pair.**
- **0 carry a dated source URL that states the exact published figure.** Every computed range is the site's own arithmetic (parts + hours × $120–$160 an hour, or a state rate), so no outside source states it.
- 2,298 issue prices and 1,907 maintenance items cite a repairpal.com URL. None of them records RepairPal's figure, year, engine, ZIP or access date.
- The 232 estimator rows carry dated part and labor sources, but those sources back the components, not the total.
- No estimator row has a RepairPal benchmark for the same vehicle that overlaps its range together with an independent benchmark for the same vehicle. Most RepairPal benchmarks are all-vehicle averages.

## What public access gave (see evidence-attempts.csv)
- **RepairPal:**
  - The public pages show only totals, with no parts/labor split, no engine and no visible ZIP.
  - Several pages carry contradictory unlabeled ranges. Examples: 2015 Camry spark plugs shows $603–$672 in the headline but $169–$251 in the year grid. The Malibu coil page shows a $2,104–$2,382 headline.
  - The pads+rotors pages are rendered with JavaScript only.
  - Model pages say "Estimates last updated September 3, 2026".
  - Figures read through a summarizing fetcher are not citable without a human check in a real browser with a ZIP entered.
- **KBB Fair Repair Range:**
  - It is a JavaScript selector (year, make, model, style). It shows no figures without inputs and defaults to Dallas 75201.
  - It covers dealership prices only, so it is not like-for-like with the site's general-shop ranges.
  - No data provider is named.
- **AAA Repair Cost Estimator:**
  - It needs a form with ZIP, year, make, model, trim and engine. The sample summary URLs returned no figures, or "information is not available".
  - **AAA's data provider could not be identified.** No page names one. The Mitchell 1 AAA page is a software discount for shops, not a data-supply statement.
  - RepairPal is reported (in a MOTOR press-release title, 2023-01) to use MOTOR data. If AAA's labor times also come from MOTOR, AAA and RepairPal would count as one source. **Treat AAA as not proven independent until AAA confirms its provider in writing.**

Public pages alone cannot produce the evidence pairs at the scale of this inventory: 568 vehicles × 9,683 issues, plus maintenance items, codes and lights. Reading thousands of pages one by one would also amount to scraping at scale, which these sites' terms do not allow.

## Access that would unblock the evidence, best first
1. **A RepairPal data license or partner export (API or CSV).** This would give, for each year/make/model/engine/job: the total, the labor and parts split, the labor hours, the ZIP or market and the update date. It covers the "matching RepairPal estimate" leg of every vehicle record (issue, maintenance, annual) and gives written permission to cite or display. **This single access unblocks the most records**: the first leg for about 13,500 vehicle-specific records, and it makes RepairPal-less coverage explicit, so the rule's two-independent-source branch can be applied. Ask RepairPal directly. Their figures are copyrighted, and copying them in bulk without a license is not acceptable.
2. **An independent labor-time guide the owner already subscribes to at the shop: Mitchell 1 ProDemand or ALLDATA.** Use its published labor times and OE part list prices for each vehicle/engine/job, cited as "Mitchell 1 labor guide, accessed <date>". This is a strong independent leg as long as RepairPal's labor data is MOTOR, not Mitchell or ALLDATA (confirm with RepairPal). Check the subscription terms: they usually allow consulting the data for repair estimates but forbid republishing raw labor times. A written OK from the vendor to publish derived ranges, or a publisher license, is needed.
3. **Written confirmation of AAA's and KBB's estimate data providers.** Without it, neither can count as independent of RepairPal. KBB also has to be filtered to "dealer" scope.
4. **Documented shop menus.** These are dated captures of posted prices. They work for maintenance jobs only (oil, battery, brakes, rotation). Two or more posted prices from different, unaffiliated shops can serve as the independent leg. The estimator already holds 73 of these.
5. **The shop's own invoice history.** Anonymized, aggregated repair orders by vehicle and job are an independent leg. Using them must not tie the public site to the owner's business, as the project rules require. Publish them only as an aggregate statistic with no attribution.

## Separate regression to fix (not an evidence issue)
The Price Check offers every estimator job to every vehicle, with no check on powertrain. In Connecticut, a 2023 Tesla Model Y gets "Spark plug replacement", priced from the BMW 335i luxury row. See the audit report for the arithmetic: $65.22 + 2 h × $125 = $315.22, rounded down to $310; $148.62 + 2 h × $141 = $430.62, rounded up to $440. A $400 quote is judged "Within the typical range" because 400 ≤ 440 × 1.1.
