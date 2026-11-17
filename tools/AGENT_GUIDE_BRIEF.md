# Brief: write symptom guides for VehicleSymptoms.com

VehicleSymptoms.com is a free site that helps drivers understand what their car is doing, how urgent it is, and what to tell their mechanic. Each symptom guide is a short guided flow: a few questions that genuinely change the answer, then a standardized result. We want to be clearly better than RepairPal, 2CarPros or StartMyCar: more decisive about urgency, better questions, plain English, no filler, and never alarmist or falsely reassuring.

## Study the example first
`/home/claude/vs-repo/src/journeys/car-wont-start.json` is the gold-standard example. Match its structure, tone and depth exactly. Read it fully before writing.

## What makes a great guide
- QUESTIONS THAT CHANGE THE ANSWER. Ask the urgency-changing question first (e.g. "Is the temperature gauge in the red or is there steam?"). Every question must lead to different results. Don't push everyone through the same number of questions. 2-4 questions deep on any path is typical.
- Every question has an "I'm not sure" option that leads somewhere sensible (often a cautious general result or a simpler follow-up question).
- Plain-language options with real-world descriptions ("rapid click-click-click", "a puddle the size of a coin"). Use `help` to explain any term a regular driver might not know.
- RESULTS (4-12 per guide). Each result must have:
  - `title`: the most likely explanation, said plainly.
  - `urgency`: one of
    - `stop`: don't drive it (safety risk or real chance of serious damage). `now` must NOT suggest driving, not even to a shop. Say tow or mobile mechanic.
    - `soon`: get it checked within a few days; drive gently/short distances only if needed.
    - `check`: book a check when convenient.
    - `diy`: safe to do the simple checks yourself first.
  - `now`: the single clearest next action.
  - `if`: 1-3 conditions that change the recommendation ("If X, then Y"). Escalate when there's a safety sign.
  - `why`: 2-3 sentences explaining the reasoning.
  - `causes`: 2-4 possible causes, most likely first, each with `clues` (what points to it) and optional `against` (what makes it less likely). No likelihood percentages.
  - `confirm.you`: safe owner checks (can be empty for dangerous situations); `confirm.shop`: the tests a technician would do.
- The heading, explanation and next action must agree. Never "stop driving" in one place and "drive to a shop" in another.
- `safety`: 0-4 short "stop and get help right away if" lines for genuine danger signs (fuel smell, smoke, brake failure, overheating in the red, flashing check engine light with shaking, etc.).
- Never give unconditional "it's safe to drive" assurances. No dollar figures. No percentages. No brand/product recommendations.
- Write in your own words for regular drivers. Short sentences. US English. Never copy text from any website.

## Accuracy
- You may use WebSearch (mode "standard") / WebFetch to verify facts you are not certain of: at most 2 lookups per guide (the whole session shares a small search budget, so only look up specifics you are genuinely unsure of). Prefer manufacturer/NHTSA/AAA/ASE/university or major repair-information sources. Put 1-3 real reference URLs you actually saw in `sources` (an authoritative general page is fine, e.g. NHTSA recalls, AAA, Car Care Council).
- Technical claims must be standard, widely accepted automotive knowledge. If unsure, leave it out.

## Fields
- `id`: given to you. `title`: short label (e.g. "Brakes squeal"). `h1`: the driver's question as they'd search it ("Why do my brakes squeal?"). `metaDesc`: ≤170 chars.
- `group`: given to you (start|light|noise|shake|leaksmell|hot|drive). `cat`: one of "Warning Lights","Smoke","Leaks","Noises","Smells","Starting Problems","Driving".
- `synonyms`: 8-15 phrases people actually type ("squeaky brakes", "brakes squeaking when stopping"). Include common misspellings without apostrophes (e.g. "wont").
- `intro`: 2-3 sentences. `start`: id of the first question node.
- `nodes`: question nodes `{q, help?, opts:[{a, go}]}` (2-7 options) and result nodes `{result:{...}}`. Node ids: `q_...` and `r_...`.
- `related`: 2-5 ids from the topic list in `/home/claude/vs-repo/tools/guide_topics.txt` (plus "car-wont-start").
- `issueMatch`: `{"cats":[...], "words":[...]}`: the site categories and 5-10 lowercase keywords used to match known vehicle problems to this guide (e.g. for brake squeal: ["brake","pad","rotor","squeal","caliper"]).

## Output and validation
Write each guide to `/home/claude/vs-repo/src/journeys/<id>.json` (pretty-printed JSON). Then run
`node /home/claude/vs-repo/tools/check_journey.js <id>` and fix until it prints OK.
Do not edit any other file.

## Final reply (short)
For each guide: id, number of questions/results, and anything you were unsure about. Do not paste the JSON.
