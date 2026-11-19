# Runbook: one vehicle-model batch run

Daniel asked for this to run unattended every 4 hours. Each run should add as many vehicle models as it can, review them, publish them to the live site, and repeat until it runs out of time or limits. Don't stop after one batch if there is room for another.

## 1. Set up
1. Attach and clone the repo autosymptoms/vehiclesymptoms (push access), then `npm ci`.
2. Read `tools/vehicle-agents/BRIEF.md` (agent instructions) and `tools/vehicle-agents/QUEUE.md` (models in priority order).
3. Make the gap-years scratch folder: `mkdir -p /tmp/vs-newgaps`.
4. Skip any queue id that already has `src/deep/<id>.json`. Also skip lines marked `CLAIMED by ...` unless the claim is more than 8 hours old. Before sending out a batch, mark its ids `CLAIMED by scheduled run <date time>` in QUEUE.md and push that change, so parallel sessions don't duplicate work.

## 2. Send out a batch
- Start about 10 general-purpose agents in parallel, each with 2–3 models from the top of the queue.
- Each agent's prompt:
  > Read tools/vehicle-agents/BRIEF.md in the repo at <path> and follow it exactly. Your models: <id (Make Model, years, notes)>...
- Keep batches at about 10 agents. The web search budget is about 200 per round, shared, and there is an hourly fetch limit. Bigger batches just run dry.

## 3. Review (when all agents report)
1. Run `node tools/vehicle-agents/cleanup.js <ids...>`. It drops problems sourced only to au7o.io, strips those links and fixes NHTSA API links.
2. Run `node tools/vehicle-agents/check-vehicle.js <id>` for each new model.
   - Hold back any model with fewer than 12 issues, or with 2+ sold years at 0–1 issues. Move its files out of src/ and mark it `[~]` in QUEUE.md with the reason.
   - Thin recent years (fewer than 3) are acceptable.
3. Don't publish 2026/2027 years that have no documented problems. Cap `years` at the last documented year.
4. Merge `/tmp/vs-newgaps/<id>.json` into `src/gaps.json`. Keep its one-token-per-line format: `JSON.stringify(g,null,1).replace(/^ +/gm,'')`.

## 4. Build, check and publish
1. Run `npm run build`. Expect no `BAD`, `DUP` or `dropped` lines.
2. Serve dist on port 8788 (`npx http-server dist -p 8788 -s &`), then run `node tools/qa.js`. It must show "broken internal links: none" and search checks 20/20.
3. Update QUEUE.md: published ids get `[x]`.
4. Commit on a branch with a clear message listing the models, then push that branch to `main`. Daniel approved publishing these model batches directly to the live site.
5. Wait about 3 minutes, then confirm the Vercel commit status is success: `gh api repos/autosymptoms/vehiclesymptoms/commits/<sha>/status`.

## 5. Repeat
Go back to step 2 with the next models while time and limits allow.

## 6. Report
Before ending, send Daniel a short summary with SendUserMessage, covering:
- models added
- current total model count
- anything held back, and why
- what's next in the queue

## Rules
- Write problems only from real sources, in original wording. Never invent problems, years or prices.
- Never cite au7o.io or other AI-written content sites.
- The site must stay anonymous: nothing tying it to Daniel Stewart or Oceanside Auto.
- Don't change site design or other pages in these runs. Only vehicle data and the queue.
