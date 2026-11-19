# Runbook: one repair-estimator accuracy run

Daniel wants the price check on VehicleSymptoms.com to be the most accurate and most transparent free repair estimator: it should tell a driver whether a quote is fair, and show its work. These runs build and keep checking the numbers behind it. Each run works through as many jobs as time and limits allow.

## Where work goes
- Branch `estimator` only. **Never push to `main` and never change the live site in these runs.** Daniel reviews the preview and approves each publish himself.
- Touch only `src/estimator/` and `tools/estimator/`. Do not edit `src/prices/` (the vehicle-model task owns it), site pages, or styles.

## 1. Set up
1. Attach and clone autosymptoms/vehiclesymptoms (push access). `git fetch --depth=50 origin estimator main`, check out `estimator`, and rebase it onto `origin/main` if main has moved. `npm ci`.
2. Read `tools/estimator/QUEUE.md` and the last entries of `tools/estimator/LOG.md`.
3. If the top of LOG.md shows a run started under 90 minutes ago with no finish line, another run is live: stop. Otherwise add a `## Run <date time UTC> started` line, commit and push it.

## 2. Check a batch of jobs
Take the next 6–8 unchecked jobs (or those checked over 60 days ago). Send out one general-purpose agent per 2 jobs, in parallel. Each agent, for each job:
1. **Build our own number from first principles**, for four vehicle classes (economy car, midsize car/crossover, full-size truck/SUV, luxury/European):
   - parts: low = quality aftermarket, high = OEM list. Use at least two parts retailers or OEM parts catalogs per class, on a named example vehicle.
   - labor hours: from public sources that state a time (manufacturer recall or warranty bulletins on nhtsa.gov, parts-maker install guides, shop price pages). Give a range.
2. **Compare with at least three independent public estimates** (for example RepairPal, Kelley Blue Book, AAA, YourMechanic, Jerry, chain shop price pages). Record each source's range, URL and date.
3. Write `src/estimator/jobs/<slug>.json`:
   `{"job","unit" (e.g. "per axle"),"classes":{"economy":{"parts":[lo,hi],"hours":[lo,hi],"example"},...},"src":[urls],"benchmarks":[{"name","url","lo","hi","date","note"}],"live":[lo,hi],"finding","confidence":"high|medium|low","checked":"YYYY-MM-DD","extras":"what a quote often adds: diagnosis, shop supplies, related parts"}`
4. In `finding`, say plainly whether the live range is too wide, too low, too high or about right, and why.

Rules for agents:
- Other estimators are a **check, not a source**. Never copy their numbers into `classes`. If ours disagrees with the consensus, find out why from parts prices and labor times; change ours only when that evidence supports it.
- Real sources only, every number traceable to a URL. No invented prices or hours. Never cite au7o.io or AI-written content farms (pages.dev cost sites, scraped "cost guide" blogs).
- If a site refuses to load, skip it and use another. Do not work around blocks.
- Mark `confidence` low when fewer than two parts sources or no stated labor time was found.

## 3. Labor rates
When the queue reaches it (or whenever a run has spare room), fill `src/estimator/rates.json`: `{"ST":{"indep":[lo,hi],"dealer":[lo,hi],"src":[urls],"checked"}}`. Two sources minimum per state. Independent-shop rate first.

## 4. Review and save
1. Read every new job file yourself. Reject any with untraceable numbers, class ranges that overlap nonsensically, or benchmarks copied into `classes`. Mark those `[~]` in QUEUE.md with the reason.
2. `node -e` parse-check every JSON file. `npm run build` must still pass.
3. Update QUEUE.md (`[x] job (date) — finding in six words`) and append to LOG.md: jobs checked, biggest gaps found between the live site and the evidence, sources that were blocked.
4. Commit and push to `estimator` (`git -c push.negotiate=true push -u origin estimator`). Add the finish line to LOG.md in the same commit.

## 5. Repeat, then report
Do another batch while time and limits allow. At the end send Daniel a short SendUserMessage: jobs checked this run and in total, the 2–3 most important gaps found, and anything now ready for him to review for publishing. Do not send a message if the run stopped at step 1.3.

## Rules
- The site stays anonymous: nothing tying it to Daniel Stewart or Oceanside Auto.
- An estimate is never a quote and never a diagnosis. Keep that wording in anything user-facing you draft.
