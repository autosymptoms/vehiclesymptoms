# Runbook: price-check autopilot

Goal: make the "Is my quote fair?" price check on VehicleSymptoms.com the most accurate and most transparent free repair estimator. A driver enters a repair and a quote and gets, in under 30 seconds on a phone: whether the quote is fair for their kind of vehicle and their state, the parts and labor split behind that answer, the sources, and what to ask the shop.

The owner gave standing approval on 2026-11-19 to finish this without asking him: research, build, test and publish to the live site whenever the publish gate below passes. Do not ask questions. Make the reasonable choice, write it in LOG.md, and keep going. Stop and tell him only for the items under "Needs the owner".

## Every run
1. `git fetch --depth=50 origin estimator main`, check out `estimator`, merge `origin/main` into it (never rebase or force-push), `npm ci`.
2. Read `tools/estimator/QUEUE.md` and the top of `tools/estimator/LOG.md`. If the top run started under 90 minutes ago and has no finish line, another run is live: stop without a message. Otherwise add `## Run <date time UTC> started`, commit and push.
3. Do the first phase below that is not finished. Spend the whole run on it; start the next phase in the same run if there is room.
4. Before finishing: parse-check every JSON file, `npm run build` (takes about 3 minutes; allow 10), update QUEUE.md, write the finish line and findings in LOG.md, commit and push `estimator` (`git -c push.negotiate=true push -u origin estimator`).
5. Send one short SendUserMessage: what was done, totals, what went live, what is next. Send a PushNotification only when something was published, when a phase finished, or when the run is blocked on the owner.

## Agents
- Use as many research agents at once as the limits allow. The web search limit is 200 searches per session turn, shared by all agents: that is 7 agents with two jobs each at about 28 searches. More than that leaves files half-finished.
- Give each agent `tools/estimator/AGENT_BRIEF.md` plus its two jobs. Agents finishing a partial file get about 20 searches.
- Review every file yourself before saving: reject untraceable numbers, benchmark figures copied into `classes`, and nonsensical ranges. Re-read at least 5 cited figures per batch at their source with a fetch agent; if any does not match, re-check that agent's whole file.

## Phase 1: finish the numbers
1. Finish every `[~]` file in QUEUE.md (fill the nulls), then every `[ ]` job, then the "missing jobs" list at the bottom of the queue.
2. Labor rates: finish `src/estimator/rates.json` for 50 states and DC with an independent-shop range and a dealer range, two sources each.
3. Raise confidence: for files marked low, look for a labor time for the example vehicle itself, or switch the example to a vehicle whose maker prints times (Honda/Acura, Hyundai/Kia, GM, FCA, Subaru, Nissan, Mazda). Find a source document for the BMW flat-rate unit conversion or stop using converted BMW times.
4. Phase 1 is finished when every job is `[x]` with no nulls and rates.json is complete. Jobs that cannot be completed after two attempts stay `[~]` with the reason and do not block the phase.

## Phase 2: build it into the price check
Work on the `estimator` branch. This phase may edit `build.js`, `src/app.js`, `src/template.html` and `src/site.css` for the price-check page only.
1. For every job with a passed file, the price check asks for (all optional) vehicle class and state, and shows: the fair range for that class at that state's labor rate; the parts range and labor hours behind it; the example vehicle; the source links; what a quote often adds; and a confidence label ("well sourced", "estimate", "rough estimate"). Without class or state it shows the range across classes at the national middle rate.
2. The verdict on a quote ("below", "within", "above the typical range") uses the built range. Keep the wording: an estimate is never a quote and never a diagnosis; say what to ask the shop next.
3. Jobs without a passed file keep today's behavior.
4. Show the method on the page in plain words: how the number is built, when it was checked, and that other estimators are used only as a cross-check.
5. Record each job's change from the old live range in LOG.md.

## Phase 3: keep it right
Re-check any job older than 60 days, oldest first. Add jobs drivers ask about. Each run, propose three evidence-backed improvements to the price check in LOG.md, build the best one, and say how it was tested.

## Publish gate (no approval needed when all pass)
1. `npm run build` passes and `node tools/qa.js` passes.
2. Every number shown traces to a URL in its job file; no nulls shown as prices; nothing from a `[~]` file is shown.
3. Serve `dist/` locally and check `/price-check/` with the installed Playwright at phone width (390 px) and desktop: a job can be picked, a quote entered, a verdict shown, sources open, no console errors, no sideways scroll. Check three jobs across classes and states by hand against their job files.
4. The change touches only the price check, `src/estimator/` and `tools/estimator/`.
5. Then publish: check out `main`, merge `estimator`, push `main` (fetch and merge again if the push is rejected; never force-push). Confirm the Vercel production deploy is ready and load the live `/price-check/` once. If it is broken, `git revert` the merge, push, and notify the owner.

## Needs the owner (stop that item, notify, carry on with the rest)
- Any change to safety advice: urgency warnings, "safe to drive" wording, or anything on symptom, warning-light or code pages. Those need qualified review.
- Anything that costs money, deletes data, changes domains, DNS, accounts or settings outside this repo, or contacts anyone.
- A publish that failed twice, or a live page that stayed broken after a revert.

## Rules that never change
- Our numbers come from parts prices and stated labor times with a source URL each. RepairPal, KBB, AAA and other estimators are a comparison check only; never copy their figures in as ours.
- No invented prices or hours. Never cite au7o.io, openlaborproject.com or AI-written cost-guide content farms. If a site refuses to load, use a different source; do not work around blocks.
- The site stays anonymous: nothing tying it to any person or shop.
- Do not edit `src/prices/`, `src/deep/`, `src/own/` or `tools/vehicle-agents/`; the vehicle-model task owns them.
- No login, paywall or required VIN. Vehicle details stay optional.
