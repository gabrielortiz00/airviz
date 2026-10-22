// Build public/data/mode-c-veil.geojson: a 30 NM circle around each airport in
// scripts/mode-c-veil.json, centered on its NASR airport reference point. Overlapping circles
// are merged, so New York (JFK, LaGuardia, Newark) becomes one shape, like on the charts.
//
// Usage: node scripts/build-mode-c-veil.js <APT_BASE.csv> <mode-c-veil.geojson>

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { union } from 'polyclip-ts';
import { readNasrCsv } from './nasr-csv.js';

const VEIL_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'mode-c-veil.json');

const METERS_PER_NM = 1852;
const EARTH_RADIUS_M = 6371008.8;
const CIRCLE_POINTS = 256;

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
    console.error('Usage: node scripts/build-mode-c-veil.js <APT_BASE.csv> <mode-c-veil.geojson>');
    process.exit(1);
}

const veil = JSON.parse(fs.readFileSync(VEIL_FILE, 'utf8'));
const rows = readNasrCsv(inputPath, ['ARPT_ID', 'ARPT_NAME', 'LAT_DECIMAL', 'LONG_DECIMAL', 'ARPT_STATUS']);
const airportsById = new Map(rows.map(row => [row.ARPT_ID, row]));

// Point at a distance and bearing from a start point, on a sphere (good to well under a meter
// at 30 NM, far finer than any chart).
function destination([lon, lat], bearingDeg, distanceM) {
    const toRad = Math.PI / 180;
    const angle = distanceM / EARTH_RADIUS_M;
    const bearing = bearingDeg * toRad;
    const lat1 = lat * toRad;
    const lon1 = lon * toRad;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angle)
        + Math.cos(lat1) * Math.sin(angle) * Math.cos(bearing));
    const lon2 = lon1 + Math.atan2(Math.sin(bearing) * Math.sin(angle) * Math.cos(lat1),
        Math.cos(angle) - Math.sin(lat1) * Math.sin(lat2));
    return [Math.round(lon2 / toRad * 1e6) / 1e6, Math.round(lat2 / toRad * 1e6) / 1e6];
}

function circle(center, radiusM) {
    const ring = [];
    for (let i = 0; i < CIRCLE_POINTS; i++) {
        ring.push(destination(center, 360 * i / CIRCLE_POINTS, radiusM));
    }
    ring.push(ring[0]);
    return [ring];
}

function insideRing([x, y], ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) {
            inside = !inside;
        }
    }
    return inside;
}

const centers = [];
for (const location of veil.locations) {
    const row = airportsById.get(location.airport);
    if (!row || row.ARPT_STATUS !== 'O') {
        console.error(`Mode C veil airport ${location.airport} (${location.regulation}) isn't an operational airport in APT_BASE.csv.`);
        process.exit(1);
    }
    centers.push({ id: location.airport, point: [Number(row.LONG_DECIMAL), Number(row.LAT_DECIMAL)] });
}

const radiusM = veil.radiusNm * METERS_PER_NM;
const merged = union(...centers.map(center => circle(center.point, radiusM)));

const features = merged.map(polygon => {
    const airports = centers.filter(center => insideRing(center.point, polygon[0])).map(center => center.id);
    return {
        type: 'Feature',
        properties: {
            NAME: `Mode C veil (${airports.join(', ')})`,
            AIRPORTS: airports,
            LOWER_VAL: 0,
            LOWER_CODE: 'SFC',
            UPPER_VAL: veil.ceilingMsl,
            UPPER_CODE: 'MSL'
        },
        geometry: { type: 'Polygon', coordinates: polygon }
    };
});

fs.writeFileSync(outputPath, JSON.stringify({ type: 'FeatureCollection', features }));

console.log(`Mode C veil: ${centers.length} airports merged into ${features.length} areas.`);
