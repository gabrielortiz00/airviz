# TODO

- Sectional / TAC overlay toggle, so the basemap can switch to the actual FAA charts. The FAA publishes them as GeoTIFFs on a 56-day cycle, so they'd need to be turned into map tiles first.

- Sectional airport symbols instead of the plain airport codes: the chart symbol (circle with four ticks) next to the code, blue for towered and magenta for non-towered. Needs a real tower flag in airports.json (build-airports.js already reads TWR_TYPE_CODE; importance is only a rough stand-in). Check contrast where a blue symbol sits inside a Class B or a magenta one inside a Class C. A quick prototype (not kept) drew the icon on a canvas and added it with map.addImage, then used it as icon-image in the same symbol layers as the codes.

- Easier issue reports for people without a GitHub account: a short form in the panel (what looks wrong, what the chart says) that sends to a form service like Formspree, which emails the report. Location, zoom, cycle and last hovered airspace go along as hidden fields. No server code or secrets; the form address is public by design. Copy real reports to GitHub by hand. Keep a small "or open a GitHub issue" link, mention the form service in About, and allow formspree.io in the content security policy when the security headers go in.

- Column view: click a spot, see every layer above it.
- Part-time airspace (towers that close at night). Hours are in NASR CLS_ARSP.csv.
- Altitude query: position + altitude, get the airspace you're in.
- Class E and special use airspace.

- Tilting on phones is hard to find (issue #6). It works with two fingers side by side, level, dragged up or down together. Add that to the About text, and a "3D" button in the corner controls that tilts to about 60° and back.
- Drag controls feel inverted on the rotation axis. Figure out which direction and flip it.
- Verify the two inferred Class D rules (Imperial Beach/Brown Field, Waldron/Corpus Christi NAS) against JO 7400.11.
- Class B shelf checks using TAC VFR checkpoints.
- Check the Actions tab on Oct 29 for the first automatic update.

- Security: upgrade maplibre-gl to 6.4.1 or later to fix GHSA-jrc7-96c5-q579 (XSS in its HTML sanitizer, only reachable through map attribution text). Blocked until deck.gl supports MapLibre v6 terrain; 9.4.0 still reads map.transform. Check new deck.gl releases.
- Security: run npm audit fix for the dev tools (vite, postcss, nanoid, source-map-js). Only affects the local dev server, not visitors.
- Security: add a vercel.json with security headers (no framing, referrer policy, content security policy).
- Security: turn on two-factor auth for GitHub, Vercel and Namecheap, and check the domain lock on gabrielortiz.io. Revoke the old Mapbox token if it's still active.
