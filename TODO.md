# TODO

- Sectional / TAC overlay toggle, so the basemap can switch to the actual FAA charts. The FAA publishes them as GeoTIFFs on a 56-day cycle, so they'd need to be turned into map tiles first.

- Column view: click a spot, see every layer above it.
- Part-time airspace (towers that close at night). Hours are in NASR CLS_ARSP.csv.
- Altitude query: position + altitude, get the airspace you're in.
- Class E and special use airspace.

- Tilting on phones is hard to find (issue #6). It works with two fingers side by side, level, dragged up or down together. Add that to the About text, and a "3D" button in the corner controls that tilts to about 60° and back.
- Drag controls feel inverted on the rotation axis. Figure out which direction and flip it.
- Class checkboxes take about 0.2 s to redraw. If that feels slow, deck.gl's DataFilterExtension filters on the GPU instantly.
- Check tapping volumes on a phone.
- Verify the two inferred Class D rules (Imperial Beach/Brown Field, Waldron/Corpus Christi NAS) against JO 7400.11.
- Class B shelf checks using TAC VFR checkpoints.
- Check the Actions tab on Oct 29 for the first automatic update.

- Security: upgrade maplibre-gl to 6.4.1 or later to fix GHSA-jrc7-96c5-q579 (XSS in its HTML sanitizer, only reachable through map attribution text). Blocked until deck.gl supports MapLibre v6 terrain; 9.4.0 still reads map.transform. Check new deck.gl releases.
- Security: run npm audit fix for the dev tools (vite, postcss, nanoid, source-map-js). Only affects the local dev server, not visitors.
- Security: add a vercel.json with security headers (no framing, referrer policy, content security policy).
- Security: turn on two-factor auth for GitHub, Vercel and Namecheap, and check the domain lock on gabrielortiz.io. Revoke the old Mapbox token if it's still active.
