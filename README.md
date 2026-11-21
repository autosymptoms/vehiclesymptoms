# VehicleSymptoms.com

Free consumer car-symptom lookup: symptom search, VIN decoder (NHTSA vPIC), and known-problem pages for the top 100 US vehicles, 1996 and newer.

- Vehicle data: `src/vehicles.js` and `src/batches/*.js`
- Page template, styles and script: `src/template.html`, `src/site.css`, `src/app.js`
- `npm run build` validates the data and generates the static site in `dist/` (one page per vehicle and model year, plus `sitemap.xml`).
- Hosted on Vercel; settings are in `vercel.json`.

Vehicle problem content is a draft pending review by a professional technician.

## MotoVisuals repair animations

The site serves a searchable title index at `/repair-animations/`. Technology from TechNet loads when a visitor opens the player. Public website iframe URLs for the approved domain are in `src/animations/config.json`; individual entries use `narrated:<part_id>` or `interactive:<part_id>`. The `individual` list contains title-specific players verified to serve the matching video. The `overviews` list maps narrated catalog IDs to the exact labels in the approved provider menu. The public directory and its search data include only titles with verified playback. Verify media playback and title identity before enabling a player or menu entry. The production build requires no API key.

To refresh the English title index, set `MOTOVISUALS_API_KEY` in your local environment and run `node tools/motovisuals-catalog.js`. Review the changes to `src/animations/titles.json` before committing. The refresh records only titles, systems, formats, and provider part IDs. Add or update relevant guide slugs and issue-title matches in `src/animations/topics.js`. The player uses the referrer origin for TechNet's domain approval. A preview hostname needs separate approval in TechNet for playback.
