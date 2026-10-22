// Check the built airspace against known points from charts and legal descriptions.
//
// Each check in scripts/airspace-checks.json is a point (lon, lat, feet MSL) and the airspace a
// pilot should be in there. Fails if any check doesn't match, so a bad cycle or a pipeline bug
// is caught before it ships.
//
// Usage: node scripts/check-airspace.js <airspace.geojson>

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CHECKS_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'airspace-checks.json');

const [airspacePath] = process.argv.slice(2);
if (!airspacePath) {
    console.error('Usage: node scripts/check-airspace.js <airspace.geojson>');
    process.exit(1);
}

const airspace = JSON.parse(fs.readFileSync(airspacePath, 'utf8'));
const checks = JSON.parse(fs.readFileSync(CHECKS_FILE, 'utf8')).checks;


// Ray casting: is the point inside this ring?
function inRing([x, y], ring) {
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

function inShape(point, geometry) {
    const polygons = geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];
    return polygons.some(([outer, ...holes]) => inRing(point, outer) && !holes.some(hole => inRing(point, hole)));
}

// Floors are included unless marked ABV (starts just above). Ceilings are included unless
// marked TNI (up to but not including).
function inBand(altitude, props) {
    const floor = Number(props.LOWER_VAL);
    const ceiling = Number(props.UPPER_VAL);
    if (props.LOWER_DESC === 'ABV' ? altitude <= floor : altitude < floor) {
        return false;
    }
    return props.UPPER_DESC === 'TNI' ? altitude < ceiling : altitude <= ceiling;
}

function airspaceAt(point, altitude) {
    return airspace.features
        .filter(f => inBand(altitude, f.properties) && inShape(point, f.geometry))
        .map(f => f.properties);
}

function describe(found) {
    if (found.length === 0) {
        return 'no B/C/D airspace';
    }
    return found.map(p => `${p.IDENT} ${p.CLASS} ${p.LOWER_VAL}-${p.UPPER_VAL} ${p.UPPER_DESC || ''}`.trim()).join(' + ');
}


let failures = 0;

for (const check of checks) {
    const found = airspaceAt(check.point, check.altitude);
    const expect = check.expect;
    let ok;

    if (expect.none) {
        ok = found.length === 0;
    } else if (expect.notIdent) {
        ok = found.length <= 1 && !found.some(p => p.IDENT === expect.notIdent);
    } else {
        ok = found.length === 1 && found[0].IDENT === expect.ident && found[0].CLASS === expect.class;
    }

    if (!ok) {
        failures++;
        console.error(`FAIL  ${check.name} at ${check.altitude} MSL`);
        console.error(`      expected ${JSON.stringify(expect)}, found ${describe(found)}`);
        console.error(`      source: ${check.source}`);
    }
}

if (failures > 0) {
    console.error(`Airspace checks: ${failures} of ${checks.length} failed.`);
    process.exit(1);
}

console.log(`Airspace checks: all ${checks.length} passed.`);
