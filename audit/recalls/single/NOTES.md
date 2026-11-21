# Single-name recall mapping: verification notes (2026-11-21)

Files in this folder:
- `recall-map-single.json` is the output. It uses the same range format as `src/recall-map.json` and covers 215 ids and 1,770 model-years. It has not been merged into `src/recall-map.json`.
- `raw-models.txt` holds every NHTSA list and recall check used, one line per call result.
- `build-single-map.js` rebuilds the JSON and `coverage.tsv` from the raw file: `node audit/recalls/single/build-single-map.js`.
- `coverage.tsv` lists, for each id, the years verified, the NHTSA name used and the ranges.

## Calls made (WebFetch, about 246)
- About 205 calls to `products/vehicle/models?modelYear=Y&make=M&issueType=c&max=500`, plus 3 catalog calls without `issueType` (TOYOTA 2026, HONDA 2026, FORD 2010).
  - Years 2010–2026: TOYOTA, HONDA.
  - Years 2010–2025: FORD.
  - Years 2010–2024: CHEVROLET.
  - Years 2010–2025: NISSAN, HYUNDAI.
  - Years 2010, 2012 and 2014–2025: JEEP.
  - Years 2015–2025: KIA, SUBARU, RAM, GMC, MAZDA, VOLKSWAGEN.
  - Years 2015–2023: DODGE.
  - Years 2016, 2018, 2020, 2022 and 2024: TESLA.
- About 35 calls to `recalls/recallsByVehicle` to check names where the products list showed only variant names. 9 of these returned a client error, which means no results under that name.
- 1 call was rate limited and then retried.

## Method and the main surprise
1. **Without `max`, the products endpoint returns only one page of results.** For example, the default response for TOYOTA 2011 had no TACOMA, TUNDRA or VENZA. Adding `&max=500` returns the full list. With `max` set, the `issueType=r` and `issueType=c` lists came back identical (checked on FORD 2010 and FORD 2014). So the lists used here are complaint/product names.
2. **A name in the products list is not always the name recalls use.** Some lists split one model into several names: by cab (F-150 SUPER CREW, 1500 CREW CAB, FRONTIER KING CAB), by trim (MODEL S P90D) or by powertrain (CX-90-MHEV, PROLOGUE EV, CROWN HYBRID). The recall database still files these under the plain name. Spot checks confirmed that F-150, RAM 1500, RAM 2500, FRONTIER, ACCORD (2023), CIVIC (2023), SUBURBAN, EXPRESS, MODEL S/X/Y, CYBERTRUCK, CX-90, HUMMER EV, CROWN (2023) and PROLOGUE all return recalls.
3. Variant names can fail. For example, `SUBURBAN 1500` 2018 and `CAPTIVA SPORT` 2013 both returned a client error. That is why every range here has exactly one query: the plain NHTSA name. I did not add variant queries, because `fetchRecalls` throws on a non-OK status. One failing variant would turn a working lookup into "Lookup unavailable".
4. A year counts as verified only if one of these was true:
   - the exact name appeared in that make/year list, or
   - `recallsByVehicle` returned Count > 0 for that name and year.
   Gap years and years outside the site's range are left out. Wherever a list showed only variants, that year stays unverified.

## Names that differ from the site label
- **Toyota.** Several models are filed under hybrid names once the line went hybrid-only. Recalls confirmed this for Sienna and Camry: plain SIENNA 2021, CAMRY 2025, SEQUOIA 2023 and VENZA 2021 all returned no results.
  - Sienna 2021+ is `SIENNA HYBRID` (2022 Count 5).
  - Camry 2025+ is `CAMRY HYBRID` (2025 Count 6). Note that 2024 is still `CAMRY` (Count 1).
  - Sequoia 2023+ is `SEQUOIA HYBRID` (from the list).
  - Venza 2021+ is `VENZA HYBRID` (from the list).
  - Crown is the opposite case. The recall name is `CROWN`, even though the list shows only `CROWN HYBRID`. Only 2023 is mapped.
  - Land Cruiser is `LANDCRUISER` in 2010, 2011, 2013 and 2014, `LAND CRUISER` in other years, and `LAND CRUISER HYBRID` in 2024.
  - GR Supra is `SUPRA`.
  - Tacoma and Tundra 2010 appear only cab-split, so 2010 is unverified.
- **Chevrolet / GMC.**
  - Silverado and Sierra 2500HD/3500HD are `SILVERADO 2500/3500` and `SIERRA 2500/3500`. No "HD" in the name (confirmed: SILVERADO 2500 2020, Count 10).
  - Captiva Sport is `CAPTIVA`.
  - Suburban is filed under `SUBURBAN 1500` in the 2010–2020 lists, but the recall name is `SUBURBAN`. Only 2018 (recall check) and 2021–2024 are mapped.
  - Express lists split by cargo/passenger and GVW. Only 2018, 2023 and 2024 are mapped.
  - Hummer EV is listed as `HUMMER EV PICKUP` and `HUMMER EV SUV`. The recall name is `HUMMER EV`.
- **Ford.**
  - F-150 lists are split by cab in most years. Mapped years: 2014, 2016–2021, 2023 and 2024.
  - `F-150 LIGHTNING` returned recalls only for 2023. 2022 and 2024 gave no results under that name, so Lightning recalls in those years are probably filed under F-150. Those years are left unmapped.
  - Super Duty is `F-250 SD` and `F-350 SD`.
  - E-Series has no single name (E-150/E-250/E-350/E-450). It was skipped and needs a combined mapping.
  - 2025 lists use names like `BRONCO 2DR`, `BRONCO SPORT EARLY RELEASE` and `MAVERICK EARLY RELEASE`, so 2025 is unmapped for Bronco, Bronco Sport and Maverick. Mustang 2023 appears only as COUPE/CONVERTIBLE.
- **Honda.**
  - 2023+ lists show `ACCORD SEDAN` and `CIVIC SEDAN/HATCHBACK`, but recalls use `ACCORD` and `CIVIC`. Only 2023 was checked.
  - Prologue is `PROLOGUE` in recalls (2024 Count 3), not `PROLOGUE EV` as the list shows.
  - Clarity appears only as ELECTRIC, FUEL CELL or PLUG-IN HYBRID. It was skipped.
- **Kia.** Optima 2021+ is `K5`. The site's Optima page already covers K5. Niro 2017–2020 appears only as hybrid/EV variants.
- **Subaru.** Crosstrek 2015 is `XV CROSSTREK`.
- **Mazda.** MX-5 Miata is `MX-5`. Mazda3 2025 appears only as SEDAN/HATCHBACK.
- **Ram.** 2022+ lists are split by cab. 1500 2023 and 2500 2024 were confirmed by recall checks. `1500 CLASSIC` is a separate NHTSA model from 2019 on and is not included.
- **Jeep.** 2024–2025 lists show only `WRANGLER 2-DOOR/4-DOOR`, so those Wrangler years are unmapped. `WRANGLER UNLIMITED` exists alongside `WRANGLER` and was not added.
- **Tesla.** Lists use trim names (`MODEL S P90D`, `MODEL S (ALL VARIANTS)`). Coverage comes mostly from recall checks and is thin.

## Not covered / next steps
- No ids were verified for 1996–2009. All earlier-era models are missing, for example Astro, Cavalier, Dakota, Neon, Windstar, Celica, Tribute and RX-8.
- Makes and years not fetched:
  - 2010–2014: Kia, Subaru, Ram (RAM became its own make in 2011; 2010 trucks are DODGE RAM), GMC, Dodge, Mazda, VW. Jeep 2011 and 2013.
  - Chevrolet 2025–2026, plus 2026 for every make except Toyota and Honda.
- Before merging, consider spot-checking with `recallsByVehicle` the hybrid-only Toyota names that come only from lists (SEQUOIA HYBRID, VENZA HYBRID).
