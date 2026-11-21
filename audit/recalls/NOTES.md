# Recall name map audit (2026-11-21)

## Method
- Scope: the 37 models in `vehicles.js` whose `model` contains " / ". Sold years = `years` range minus `gaps`. The script checked that every sold year falls in exactly one range and that no range includes an unsold year (0 problems).
- Names come from `https://api.nhtsa.gov/products/vehicle/models?modelYear=Y&make=M&issueType=r` (and `issueType=c` where a name was missing), read through WebFetch. Where possible each name was also checked with `recalls/recallsByVehicle`. A Count above 0 counts as confirmation.
- `verified:true` means the name(s) were seen at both ends of the range, or the range is bracketed by observations and no rename is known. Each range's `evidence` lists the exact observations. `verified:false` ranges carry a `missing` field.
- The lead's candidate `src/recall-map.json` was compared against this evidence and **not edited**. Output: `audit/recalls/recall-map.json` has 93 ranges: 68 verified, 25 unverified.
- Caveat: WebFetch returns a summary from a small model, not raw JSON. Some long make lists (Ford, Mercedes-Benz, Toyota) looked truncated. Because of that, a name missing from a summary was never taken as proof that the vehicle is absent.

## Key findings
1. **Every old combined label fails.** The site sends labels like "Integra / RSX". All 37 such queries (plus Integra 2023) returned HTTP 4xx through WebFetch, which means no results. A real NHTSA name that contains a slash fails the same way (`128I/135I` 2010 fails, while `128I` returns 7 and `135I` returns 4). So the encoded "/" alone breaks the query. NHTSA slash names (`FX35/45`, `M35/45`, `FX35/50`, `128I/135I`) must be queried as their parts.
2. **One name per year is not enough.** For example, BMW 2010 `1 SERIES` (3 recalls) and `128I` (7 recalls) return different campaign sets. The map therefore lists every observed variant name. Extra names that do not exist in a given year are harmless (they return 4xx/0). The front end should merge the results and remove duplicate campaign numbers.
3. **HTTP 4xx is ambiguous.** NHTSA answers 4xx both when a name has zero recalls and, apparently, in some other cases. Some names that products issueType=r lists still failed: GRAND WAGONEER ICE 2026, 370Z 2012, EX37 2013, and every Mercedes-Benz query. The site should show "lookup unavailable" for this, not "0 recalls".

## Corrections to the lead's candidate map
- Mercedes: `M-CLASS` -> `ML-CLASS` (1998-2015). Added `GLE CLASS` (no hyphen, seen 2021), `GLE-CLASS COUPE` and `GLE-CLASS HYBRID`. Dropped `SLC-CLASS` (it starts in 2017, after the site's 2016 end). Added GL450/GL350 for 2017 next to GLS-CLASS.
- BMW: 1 Series also needs `128I`, `135I` and `135IS`. 2014-2015 use `228I`/`228I XDRIVE`/`M235I` (no "2 SERIES"). 2016-2021 use `2 SERIES`/`M2`/`M240I`/`2 SERIES GRAN`/`M2 COMPETITION`. 2022+ use `2 SERIES COUPE`/`2 SERIES GRAN COUPE`/`M2`/`M2 COUPE`. 6 Series 2012-2018 uses `640I`/`650I`/`650XI`/`xDrive`/`M6`. 8 Series adds `M8`, `8 SERIES GRAN`, the coupe/convertible names, and others. The candidate's 6 Series range included the 2011 gap year and its Z4 range included the 2017-2018 gap years; both are fixed.
- Infiniti: FX split into 2003-08 (FX35, FX45) and 2009-13 (FX35, FX50, FX37). EX35 2008-12 and EX37 2013. M split into 2003-04 M45, 2006-10 M35+M45 and 2011-13 M37, M56, `M35 HEV`. Added `Q70 HYBRID` and `Q70L`, `G25` (2011-12), and `G35 COUPE`/`G35 SEDAN`. The QX50 range is split around the 2018 gap.
- Ford: added `F-450 SD` and `F-550 SD`. Chassis cabs are listed under SD; 1999 `F-450 SD` returns 11 recalls.
- Acura `RLX SPORT HYBRID`; Alfa 2017 is Giulia only (Stelvio starts 2018), and `GIULIA QUADRIFOGLIO` was added; Hyundai `XG300L`, plus XG300 kept for 2002.
- Jeep: `WAGONEER L` and `GRAND WAGONEER L` from 2023. 2026 uses `... ICE` names. Wagoneer S (an EV) is excluded.
- Land Rover: 1999-2004 adds `DISCOVERY II`/`DISCOVERY SERIES II`; LR4 adds `LR4 (5 SEAT)`/`LR4 (7 SEAT)`; 2025 uses prefixed "LAND ROVER ..." names.
- Lincoln: `CORSAIR PHEV`, `CORSAIR GAS` (2025) and `NAUTILUS FHEV`.
- Nissan: `350Z ROADSTER` (through 2009) and `370Z ROADSTER`. 2009 is split because the 350Z Roadster and the 370Z were both sold. NV adds `NV1500`/`NV2500`/`NV3500`; `NV` alone works for 2012 and 2016.
- Pontiac: NHTSA lists TRANS SPORT and MONTANA together for 1997-1999.
- Porsche: 2006+ adds `CAYMAN S`/`GTS`/`GT4`. 2017+ uses `718 BOXSTER`/`718 CAYMAN`, and 2025 shows trim names like `982 718 CAYMAN S`.
- Prius v ends in 2017, so 2018-2019 is Prius c only. Suzuki Vitara applies to 1999-2004 only; Grand Vitara XL-7 is excluded.
- Volvo: S40-only 2000-2004 and S40+V50 2005-2011. V70XC for 1998-2003, XC70 from 2003, XC70-only 2011-2016. S90/V90 2017+ trim names (`S90 T5/T6/T8/B6`, `S90PHEV`, `V90 T5/T6`, `V90 CC`/`V90CC`).
- Rivian: one range for 2022-2026, R1T and R1S as separately labelled queries.

## Conflicts / oddities
- Acura 2001 issueType=r lists RSX (it was a 2002 model) and Infiniti 2002 lists I30. Probably cross-listed recalls; the ranges stay at 1996-2001/2002 and 2002-2006/2002-2004.
- The BMW "1 SERIES" name appears in 2000-2007 lists, before the car existed in the US. It is treated as a NHTSA data artifact and only queried for 2008-2013.
- Jeep 2022 Wagoneer and Grand Wagoneer returned the identical 10 campaigns. One campaign number came back from the fetch summary as `21V00A000`, which is not valid; re-check it from raw JSON.
- `17V295000` came back for 2017 Toyota 86, Prius c and Corolla iM. That is plausible for a multi-model campaign but should be confirmed in raw JSON.
- Nissan 2020-2021 lists one model value that is literally "NV1500, NV2500, NV3500", and a misspelled "NV3500 PASSGENGER VAN". Neither could be queried.

## Unresolved (exact evidence needed)
Running raw `curl` against the NHTSA API from a networked machine would resolve most of these.
- **All Mercedes-Benz recall queries fail** (5 ranges are unverified for end years). Needed: raw `curl` of `recallsByVehicle?make=MERCEDES-BENZ&model=GL-CLASS&modelYear=2012` (and ML-CLASS/SLK-CLASS) to see the status and body. Also products 2015, 2024 and 1998 MERCEDES-BENZ issueType=r in raw JSON (the summaries looked truncated).
- BMW 8 Series 2019/2026 and Z4 2009-2011/2016: products BMW issueType=r for 2009, 2011, 2016, 2019 and 2026 (raw JSON).
- Ford Freestyle 2007, Hyundai XG350 2005, Corolla iM 2018, Toyota 86 2020, GR86 2025, Prius c 2012, Nissan 370Z 2020, Nissan NV 2021, Lincoln Corsair 2026, Jeep Wagoneer 2026: a raw recallsByVehicle response, or products issueType=c, for that year.
- Land Rover Discovery 1996-1998 ("DISCOVERY SERIES"?), 2017 and 2025.
- Suzuki VITARA 1999/2004; Volvo S90/V90 1997-1998 and V70 1998; Volvo S90/V90 2019-2022 trim names.
- Porsche 2006-2016 Boxster/Cayman (every recall query failed) and 2018-2025 trim-level names.

## Files
- `recall-map.json`: the corrected map, in the requested shape. Unverified ranges have an extra `missing` field.
- `recall-tests.csv`: 51 rows covering all 37 ids. `old_count` is a fetch error for every old label; `new_count` is `fetch_error` where the corrected name also failed. Mercedes GLE has no successful test (marked `not_run`).
