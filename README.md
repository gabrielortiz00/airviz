# AirViz

Interactive 3D visualization of the US National Airspace System, built to give pilots a better spatial understanding of the airspace they're flying in.

## The Problem

Pilots, especially students, learn airspace from sectional charts, flat, 2D maps that make it genuinely hard to build an accurate mental model of what the airspace actually looks like in three dimensions. Class B airspace around a busy terminal like San Francisco stacks multiple shelves at different altitudes, like an upside-down wedding cake. On a sectional, that's a mess of concentric circles with altitude numbers scattered everywhere. In reality, it's a specific 3D volume you either are or aren't inside.

AirViz puts that structure in 3D, in the browser, on top of a real interactive map.

Example: A cut-out of the San Francisco Sectional Area Chart as of 04/14/2026:
![San Francisco Sectional Area Chart](/src/assets/SFO_Sectional_Cutout.png)

## Features

- **3D airspace rendering** — FAA airspace boundaries (Class B, C, D, E, and special use) rendered as 3D volumes with accurate floor and ceiling altitudes
- **Column view** — click any point on the map to see every layer of airspace at that location, stacked from the ground up
- **Altitude query** — specify a lat/lon coordinate and altitude and get back exactly what airspace you're in

## Tech Stack

- [Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/) — base map
- [deck.gl](https://deck.gl/) — 3D geometry rendering layer
- Vanilla JavaScript

## Data

Airspace geometry and altitude data comes from the FAA's [NASR (National Airspace System Resources)](https://www.faa.gov/air_traffic/flight_info/aeronav/aero_data/NASR_Subscription/) database, updated every 28 days. This is the same authoritative data source used by professional aviation applications.

## Status

Early development. Currently scoped to the Oakland / San Francisco terminal area.

## Running Locally

_Setup instructions coming once the initial build is in place._

## Roadmap

- [ ] Oakland / San Francisco terminal area (initial scope)
- [ ] Nationwide airspace coverage
- [ ] Real-time flight data overlay
- [ ] Mobile-friendly layout

## License

MIT
