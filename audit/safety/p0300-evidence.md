# P0300 and test-query safety evidence

Accessed 2026-11-21. Quotes are 15 words or fewer. No human sign-off exists yet: `src/evidence/safety-signoff.json` has `"signoffs": []`, and nothing else in the repo records a review or sign-off. Everything below needs qualified review before it is published.

## P0300 / flashing check engine light (MIL)

| Source | URL | Passage |
|---|---|---|
| Honda owner info, Malfunction Indicators (OEM) | https://techinfo.honda.com/rjanisis/pubs/QS/AH/BTJB1919GW/enu/GUID-F55CE315-6AF3-4A95-93B5-FDDE6A874B89.html | "If the indicator blinks, a misfire in the engine's cylinders is detected." / "Stop in a safe place and wait for the engine to cool down." |
| Honda owner's manual (Jazz 2016, India) (OEM) | https://hondacarindia.com/ownersmanual/webom/eng/jazz/2016/details/106278046-15355 | "Park the vehicle in a safe place with no flammable items" (then, if it blinks again: drive to a dealer at 31 mph or less) |
| Ram 2022 2500/3500 owner's manual (OEM, Mopar) | https://vehicleinfo.mopar.com/assets/publications/en-us/Ram/2022/2500_3500/om_html/GUID-F1C2D92A-05FC-41AF-B9A0-287CE3AC362F.html | "If the MIL is flashing, severe catalytic converter damage and power loss will soon occur." / "Immediate service is required." |
| California Air Resources Board, OBD II fact sheet (regulator) | https://ww2.arb.ca.gov/resources/fact-sheets/board-diagnostic-ii-obd-ii-systems-fact-sheet | "a malfunction is occurring that could be damaging your catalytic converter." |

The sources don't fully agree. Honda says to stop in a safe place. Ram/Mopar says immediate service and warns of power loss. CARB says service as soon as possible. The safest common ground, and the wording the site's own guide result `engine-sputtering-misfire#r_severe_misfire` already uses (stop: pull over, engine off, tow), is to stop.

**Current P0300 lead.** This is in the working tree after the lead's fix, where `urgent_if` is rendered above the badge, at about 174px: "If the check engine light is flashing, or the engine is shaking hard or losing power: ease off the gas, … get off the road and have it checked right away." It is now first. But the same page still gives three different actions for the same condition:

- `plain`: "ease off and stop driving soon" (596px)
- `drive`: "slow down and get it checked right away" (about 1040px)
- the guide result: "Pull over… turn the engine off… towed"

**Proposed lead** (for sign-off; use it for P0300–P0316 plus the 35 coil and crank-sensor P03xx codes that still lack `urgent_if`):

> If the check engine light is flashing or the engine is shaking hard, pull over when it's safe and turn the engine off. Don't keep driving: a heavy misfire can overheat and ruin the catalytic converter and leave you without power in traffic. Have it towed or checked right away. Otherwise (steady light, runs only a little rough): get it checked in the next few days.

## Test queries (site search = `search()` in src/guide.js, run by audit/safety/search-test.js)

| Query | Routed to | Urgent condition first? | Evidence |
|---|---|---|---|
| "shakes when I brake" | List of 5; top result is /symptoms/car-shakes-when-braking/ (no auto-open) | Yes on the page: safety box at about 406px ("brake pedal feels soft, sinks… stop driving"); Q1 option 1 is the soft-pedal path. No: results r_rotors, r_rear_brakes and r_after_service lead with "Get it checked in the next few days", and the stop condition is only in `if[]`. | Honda brake system indicator: "Press the brake pedal lightly to check pedal pressure." / "If abnormal, take immediate action." (same Honda Malfunction Indicators URL) |
| "spongy breaks" (misspelling) | Opens /symptoms/soft-or-spongy-brake-pedal/ automatically (single result) | Mostly. The safety box is first (pedal-to-floor emergency steps), but it doesn't say "then don't drive it / tow". Result r_old_fluid is rated "soon" while the driver has already reported a soft pedal. | South Australia DIT, footbrake failure: https://dit.sa.gov.au/ontherighttrack/driving_safely/be_ready_for_emergencies/footbrake_failure "Pump the pedal several times…" / "put the handbrake on, increasing the pressure gradually." / "Change to a lower gear." The page also says to tow the car rather than keep driving. |
| "AC blowing warm" | List of 4: /symptoms/ac-blowing-warm-air/, heater-blowing-cold-air, and two smoke guides ("blowing" matches the smoke synonyms) | Yes on the page: safety box at about 382px ("temperature gauge climbs toward the red… pull over… turn off the engine"). No: result r_fan_condenser leads with "Book a check when convenient". | Honda, How to Handle Overheating: https://techinfo.honda.com/rjanisis/pubs/OM/AH/AT402525IOM/enu/details/131271047-15886.html "Immediately park the vehicle in a safe place." / "Do not open the hood if steam is coming out." |
| "flashing engine light and shaking" | List of 5; top result is /symptoms/check-engine-light-flashing/ (no auto-open; traction-control-light-on is also listed) | Yes: the intro (152px) and safety box #1 (382px) are "pull over… turn the engine off", and Q1 option 1 is the shaking path, which reaches a stop result. Four soft results (r_load_misfire, r_cold_misfire, r_flashed_once, r_unsure_light) keep the flashing stop only in `if[]`. | Honda / Mopar MIL passages above |

Pixel positions come from headless Chrome at a 390x844 viewport on the current dist/, measured from the bottom of the header. The first screen is taken as 600px.
