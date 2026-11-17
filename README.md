# VehicleSymptoms.com

Free consumer car-symptom lookup: symptom search, VIN decoder (NHTSA vPIC), and known-problem pages for the top 100 US vehicles, 1996 and newer.

- Vehicle data: `src/vehicles.js` and `src/batches/*.js`
- Page template, styles and script: `src/template.html`, `src/site.css`, `src/app.js`
- `npm run build` validates the data and generates the static site in `dist/` (one page per vehicle and model year, plus `sitemap.xml`).
- Hosted on Vercel; settings are in `vercel.json`.

Vehicle problem content is a draft pending review by a professional technician.
