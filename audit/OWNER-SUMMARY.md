# VehicleSymptoms.com audit — owner summary (2026-11-21)

**Status:** preview and production run the audited build. Release check: **BLOCKED** (open items below). Google visibility: **unverified** (no Search Console access in this session).

## Baseline (recounted)
10,572 sitemap URLs (now 10,573 with /vehicles/), 570 models, 7,175 model/year pages, 37 combined labels covering 561 year pages. Production before audit: commit c23cbaa on `main` (auto-deploys to production).

## Fixed at source (tests in tools/regression.js and audit/links/test-links.js; all passing)
| Known failure | Fix | Tests |
|---|---|---|
| 2023 Integra showed 0 recalls | Per-year NHTSA map (src/recall-map.json), variant names merged and deduped, response + vehicle identity validated, errors/timeouts/unverified zero → "Lookup unavailable" + VIN lookup; page and PDF agree | REC-01..10 |
| Tesla Model Y spark plugs $310–$440 / "typical" | src/powertrain.js eligibility before suggestions, fallback and verdict (gas/diesel/hybrid/PHEV/BEV); verdict cleared on any input change | PRC-01..08, PRC-PT-* |
| P0300 buried flashing-light exception | `urgent_if` renders first on 52 misfire/ignition/crank codes, drive box, FAQ JSON-LD, meta; 22 guide/light texts reordered | URG-* |
| Camera recall → delayed engagement; wiper → pulls to one side | Strict title-only matching with required phrases and exclusions (src/guide-links.json); uncertain links omitted | 890 link checks |
| Vehicle pages only reachable by dropdown | /vehicles/ index, year links, linked breadcrumbs, 404 noindex | 10,573/10,573 routes pass structural tests; all reachable ≤3 clicks |

## Open items (each keeps the release blocked)
| Item | Count / denominator | Evidence needed |
|---|---|---|
| Prices withheld (no RepairPal + independent pair) | 15,177 of 19,819 price records (4,614 conditional recall no-charge, 28 ineligible) | RepairPal data license/export by YMM+engine+job with ZIP/date; second leg from Mitchell/ALLDATA if terms allow publishing |
| Dollar figures in prose | 2,759 public files | Rewrite or evidence each figure |
| Safety sign-off | 8,083 contexts, 198 reviewer groups (audit/safety/safety-groups.csv) | Qualified human (e.g. ASE Master) signs each group in src/evidence/safety-signoff.json |
| Recall mappings unverified | 162 of 561 combined-label year pages; 6,776 single-name year pages | NHTSA name confirmation per make/year (audit/recalls/NOTES.md); Mercedes recall queries fail at NHTSA |
| Vehicle issue claims unchecked | 15,110 of 15,110 | Open each cited source and confirm wording/year/engine |
| Wrong links on guide pages' vehicle lists | 89,882 of 121,143 pairs flagged (now filtered by the strict matcher) | Re-run audit/links/enumerate.js after build to recount |

## Next single action
Provide a RepairPal data license/export (or written permission) — it unblocks the largest group of withheld prices.
