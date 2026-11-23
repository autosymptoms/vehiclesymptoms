# Reset research brief (oil change / maintenance reminder and tire pressure light)

You are researching how a driver resets two **reminder** lights on specific vehicles for VehicleSymptoms.com, a free plain-English site for drivers:

1. **oil** — the oil change / oil life / maintenance reminder (for example Honda Maintenance Minder, GM Oil Life, Toyota MAINT REQD, Ford oil life, BMW Condition Based Service, Mercedes ASSYST).
2. **tpms** — the tire pressure (TPMS) light, after the pressures are set (reset button, settings menu, relearn by driving, or "no driver reset: it clears itself after driving").

Only these two. Never write steps for clearing a check engine, brake, ABS, airbag, oil pressure or any other fault light, and never suggest disconnecting the battery to clear a light.

## What "correct" means
- Every variant must come from a source you actually opened that covers **that model and those years**. Best: the maker's own owner's manual (owner sites such as owners.honda.com, toyota.com/owners, ford.com owner manuals, my.gm / chevrolet.com, ownersmanual.hyundai.com, ownersmanual.kia.com, mazdausa.com, nissanusa.com owner manuals, subaru.com, volvocars.com, techinfo/service sites, manufacturer .ca/.co.uk sites) or a full owner's-manual copy (manualslib.com, manualowl.com, manuals.plus, ownersmanuals2.com, startmycar.com). Second best: a dealer service page or an established automotive publisher (Edmunds, Cars.com, AAA, Capital One Auto Navigator, YourMechanic) that names the model and years.
- **Never** use: au7o.io, openlaborproject.com, YouTube, Reddit, Quora, Facebook, TikTok, Pinterest, wikiHow, or AI-written "how to reset any car" content farms. If a page reads like generic filler with no model-specific detail, skip it.
- If a site refuses to load, use another source. Do not work around blocks.
- Do not guess. If you cannot confirm a year range, cover fewer years, or leave the model out. A short correct file beats a long wrong one.
- **Covering a whole generation (bracketing):** you may cover every year between two model years you opened when (a) both manuals show the same procedure (same buttons or menu path), and (b) they are the same generation of the model, with no redesign in between. Name both years you opened in the `note`, for example "Checked in the 2018 and 2022 owner's manuals." One manual alone covers only its own year, unless the manual itself states the years it covers (many owner's manuals cover several model years or say "this manual applies to 2016–2019 models").
- A source that is clearly a maker's procedure shared by several models (for example a GM or Ford owner guide supplement listing the models it covers) counts for each model it names.
- Use page fetches efficiently: an owner's manual's table of contents or index tells you the page for "oil life", "maintenance reminder" or "tire pressure monitoring"; jump straight to it (for example manualowl/manualslib "?page=N").
- If a vehicle has **no** reminder to reset in some years (for example no oil-life system before a certain year, or TPMS not fitted before 2007/2008), you may record that as a `"none": true` entry, but only with a source that shows it (an owner's manual for that year with no such system, or the maker stating when it was introduced). If you are not sure, leave those years out.
- Write the steps in your own words, plainly, for a regular driver. Do not copy manual sentences word for word.
- Every oil variant starts with a step saying to reset only after the oil and filter were actually changed (or the service was done). Every tpms variant starts with setting all tires (and a monitored spare) to the cold pressure on the driver's door jamb sticker. If the light blinks for about a minute then stays on, that is a system fault that a reset will not clear: say so in a note when relevant.
- No web addresses, brand domain names or phone numbers inside the text fields. Sources go only in `src`.

## What worked for earlier agents (read this, it saves budget)
- Only open links that come up in search results. Web addresses you build yourself, and `?page=N` links typed by hand on manualowl/manualslib/manualsdir, often fail or load the wrong page. Shell downloads (curl) of manual sites are blocked; use the page fetch tool.
- Short official guides are the cheapest source and name the model and year on the cover:
  - Toyota/Lexus/Scion "Quick Reference Guide" PDFs on assets.sia.toyota.com (search: `"Quick Reference Guide" <model> <year> site:assets.sia.toyota.com`). They have the TPMS reset; the oil reset is in the full owner's manual.
  - GM "Getting to Know Your <year> <model>" guides on contentdelivery.ext.gm.com (Chevrolet, GMC, Buick, Cadillac, Pontiac, Saturn, Hummer).
  - Hyundai and Genesis: ownersmanual.hyundai.com / ownersmanual.genesis.com single-topic pages (find them through search). Kia: ownersmanual.kia.com. Mazda: owners-manual.mazda.com. Nissan: nissanusa.com owner manual and quick reference guide PDFs.
- A full owner's manual PDF is huge; use its table of contents to find the section, and read with character offsets rather than starting from page 1.
- Cover the newest generations first, then go back. Bracket two years of the same generation whenever you can.

## Model file format — `src/resets/models/<vehicle-id>.json`
Use the exact vehicle id you were given. One file per model. Example:

```json
{
  "id": "honda-civic",
  "checked": "2026-11-23",
  "oil": [
    {
      "years": [2016, 2021],
      "when": "2016–2021 with the steering-wheel SEL/RESET or ENTER buttons",
      "steps": [
        "Reset only after the oil and filter have been changed.",
        "Turn the ignition to ON without starting the engine.",
        "Press the ⓘ / SOURCE button on the steering wheel until the oil life percentage shows.",
        "Press and hold the ENTER (selector) button for about 10 seconds until the reset screen appears.",
        "Select Reset and press ENTER. The oil life returns to 100%."
      ],
      "note": "Optional short note, e.g. menu names vary on cars with the larger screen.",
      "basis": "manual",
      "src": ["https://..."]
    }
  ],
  "tpms": [
    {
      "years": [2016, 2021],
      "when": "2016–2021 (indirect system, calibrated from the display)",
      "steps": ["Set all four tires to the cold pressure on the driver's door jamb sticker.", "..."],
      "basis": "manual",
      "src": ["https://..."]
    },
    {
      "years": [1996, 2006],
      "when": "1996–2006",
      "none": true,
      "note": "These model years have no tire pressure warning light, so there is nothing to reset.",
      "basis": "manual",
      "src": ["https://..."]
    }
  ],
  "notes": "Optional one or two sentences that matter for this model."
}
```

Rules the checker enforces (`node tools/resets/check.js <id> <id> ...`):
- `years` must sit inside the model's years on the site (you are given them). Split ranges when the procedure changes.
- 2 to 12 steps per variant; `when` under 160 characters; steps under 300.
- `basis`: `"manual"` (owner's manual or maker service info), `"maker"` (other maker or dealer material), `"secondary"` (established publisher). Prefer manual.
- At least one https source per variant. Two independent sources are better when the procedure is unusual.
- You may cover only oil or only tpms if that is all you can verify.

## Make file format (only when asked) — `tools/resets/makes/<make-slug>.json`
For a make with no make-level page yet. Same shape as an entry in `src/resets.json`:

```json
{
  "make": "Volvo",
  "oil": { "variants": [ { "when": "...", "steps": ["..."], "note": "..." } ], "src": ["https://..."] },
  "tpms": { "variants": [ { "when": "...", "steps": ["..."] } ], "src": ["https://..."] },
  "notes": "What is worth knowing about this make's reminders."
}
```
`make` must be spelled exactly as given. Keep it to the 2–3 most common procedures for the make, each `when` describing which models/years it fits.

## How to work
- You have a limited number of web searches (stay within the number in your assignment). Owner's manuals usually cover several years: one manual can settle a range. Do the most common models first.
- Write each file as soon as a model is done, then run the checker on it and fix every ERROR.
- Do **not** run `npm run build`, git commands, or edit anything outside the files you were assigned.
- Finish with a short report: files written, models skipped and why, any source sites the checker listed as having no publisher name, and anything you were unsure of.
