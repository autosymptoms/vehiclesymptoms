# Estimator accuracy queue

Most-searched jobs first. `[ ]` not checked, `[x]` checked (date), `[~]` held with reason. Re-check any job whose date is over 60 days old. "Live" is the range the site shows today.

- [x] Brake pads and rotors (live: $220–$775) (2026-11-19) — about right; hours from comparable vehicles (low confidence)
- [x] Alternator replacement (live: $270–$975) (2026-11-19) — low end too low; $340–$1,100 fits (low confidence: economy/luxury hours are general retailer statements)
- [x] Starter replacement (live: $200–$1125) (2026-11-19) — top right, floor nearer $230–$250 (medium confidence)
- [x] Water pump replacement (live: $380–$1475) (2026-11-19) — about right; spans two different jobs (low confidence)
- [~] Head gasket repair (live: $1075–$3700) (2026-11-19) — held: luxury (BMW) hours still null, truck times are for a different engine; unsourced hours removed and replaced with Honda/Ford warranty times; live low end far too low ($1,600–$4,400 fits)
- [x] Catalytic converter replacement (live: $480–$2450) (2026-11-19) — low end too low; CARB states exceed top (low confidence)
- [x] Wheel bearing or hub replacement (live: $200–$700) (2026-11-19) — slightly low both ends; $250–$800 fits (medium confidence)
- [x] Timing belt replacement (live: $500–$1475) (2026-11-19) — about right, top slightly generous (low confidence)
- [x] Spark plug replacement (live: $130–$850) (2026-11-19) — top too high; $500–$600 fits (medium confidence)
- [x] A/C compressor replacement (live: $550–$1625) (2026-11-19) — right for compressor-only; full job higher (medium confidence)
- [x] Radiator replacement (live: $290–$1400) (2026-11-19) — about right; hours not vehicle-specific (low confidence)
- [x] Fuel pump replacement (live: $330–$1400) (2026-11-19) — about right; warranty times only (medium confidence)
- [x] Control arm replacement (one side) (live: $240–$1200) (2026-11-19) — about right once alignment is added (medium confidence)
- [x] Ball joint replacement (live: $240–$950) (2026-11-19) — top too high for one joint; ~$600 (low confidence)
- [ ] Tie rod end replacement (live: $170–$900)
- [ ] Strut or shock absorber replacement (live: $260–$1350)
- [ ] CV axle replacement (live: $200–$825)
- [ ] Sway bar link or bushing replacement (live: $100–$575)
- [ ] Radiator fan replacement (live: $140–$825)
- [ ] Thermostat replacement (live: $160–$875)
- [ ] Blower motor replacement (live: $80–$440)
- [ ] Window regulator or motor replacement (live: $180–$675)
- [ ] Door lock actuator replacement (live: $170–$700)
- [ ] Power steering pump replacement (live: $300–$1200)
- [ ] Ignition coil replacement (live: $100–$700)
- [ ] Timing chain replacement (live: $975–$3600)
- [ ] Valve cover gasket replacement (live: $150–$950)
- [ ] Oxygen sensor replacement (live: $120–$1025)
- [ ] Brake caliper replacement (live: $170–$825)
- [ ] Engine or motor mount replacement (live: $180–$925)
- [ ] Serpentine belt or tensioner replacement (live: $100–$440)
- [ ] Wheel speed (ABS) sensor replacement (live: $110–$625)
- [ ] Heater core replacement (live: $240–$1850)
- [ ] Intake manifold gasket replacement (live: $490–$1275)
- [ ] Oil pan gasket replacement (live: $260–$950)
- [ ] Rear main seal replacement (live: $400–$1925)
- [ ] Clutch replacement (live: $280–$1925)
- [ ] Transmission replacement (remanufactured) (live: $1500–$4800)
- [ ] Throttle body cleaning or replacement (live: $90–$750)
- [ ] Mass air flow sensor replacement (live: $40–$550)
- [ ] EGR valve replacement (live: $160–$675)
- [ ] Turbocharger replacement (live: $1150–$4800)

## Notes for the next run
- `[~]` jobs have a saved file; finish them (fill the nulls) before starting new jobs. Do not redo the parts that are already sourced.
- Labor times are the bottleneck. Best finds so far: recall/TSB dealer letters on static.nhtsa.gov (warranty times, so the low end). Agents may switch the example vehicle within a class to one that has a stated time.
- Web lookups are shared across agents: about 200 searches per run and an hourly page-fetch limit. Run at most 3 agents at a time and about 6 jobs per run.
- Page fetches only work for URLs a search has returned: tell agents to search first, then fetch the result. Two batches of 3 agents (12 jobs, about 170 searches) fit in one run without hitting a limit.
- Most `[x]` files are low confidence because labor times come from comparable vehicles or general statements. A later pass should look for vehicle-specific times (Toyota, Ford and BMW bulletins rarely print them; Honda, Hyundai/Kia, GM and FCA do) and consider switching example vehicles to Honda/GM models. BMW flat-rate units are converted at 10 per hour on informal sources only; a BMW document stating the conversion would firm up three files.
- Still missing: a genuine BMW alternator and brake pad list price; a timing-belt-driven water pump example with two parts sources; BMW head gasket hours.

## After the job list
- [~] Labor rates: fill src/estimator/rates.json for all 50 states + DC (at least 2 sources each) (2026-11-19) — first pass saved: 51 filled, 49 with 2 sources, but figures are all-shop averages (Tekmetric 2026 + AutoLeap blog, a soft second source), `dealer` null everywhere, NC and DC low confidence. Needs a stronger second source and a real independent/dealer split.
- [ ] Add jobs drivers ask about that are missing: battery replacement, oil change, brake fluid flush, coolant flush, transmission fluid service, tire rotation, wheel alignment, serpentine belt, cabin air filter
