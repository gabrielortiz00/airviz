# TODO

- Sectional / TAC overlay toggle, so the basemap can switch to the actual FAA charts. The FAA publishes them as GeoTIFFs on a 56-day cycle, so they'd need to be turned into map tiles first.

- Airport search (type ORD or Palo Alto, map flies there). Airport list from NASR APT_BASE.csv.
- Column view: click a spot, see every layer above it.
- Part-time airspace (towers that close at night). Hours are in NASR CLS_ARSP.csv.
- Altitude query: position + altitude, get the airspace you're in.
- Class E and special use airspace.

- Drag controls feel inverted on the rotation axis. Figure out which direction and flip it.
- Class checkboxes take about 0.2 s to redraw. If that feels slow, deck.gl's DataFilterExtension filters on the GPU instantly.
- Check tapping volumes on a phone.
- Verify the two inferred Class D rules (Imperial Beach/Brown Field, Waldron/Corpus Christi NAS) against JO 7400.11.
- Class B shelf checks using TAC VFR checkpoints.
- Check the Actions tab on Oct 29 for the first automatic update.
