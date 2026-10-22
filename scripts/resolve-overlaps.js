// Resolve overlapping airspace so every point in space belongs to exactly one volume.
//
// The NASR shapefile stores each airport's airspace as its full shape. The "excluding ..."
// clauses in the legal descriptions are not applied, so volumes overlap. This script cuts
// each volume where it overlaps a volume that outranks it:
//
//   1. Higher class wins: B cuts C and D, C cuts D.
//   2. Same class, same airport (or Class B/C joint areas): the earlier volume wins. The class
//      is the same either way, so this only stops them from being drawn twice.
//   3. Class D vs Class D at different airports: decided by scripts/airspace-rules.json.
//      An overlap with no rule stops the build, so a new case gets looked up instead of guessed.
//
// Usage: node scripts/resolve-overlaps.js <input.geojson> <output.geojson>

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { difference, intersection } from 'polyclip-ts';

const RULES_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'airspace-rules.json');

const CLASS_RANK = { 'B': 0, 'C': 1, 'D': 2 };

// Pieces smaller than this are clipping leftovers and are dropped.
const MIN_PIECE_KM2 = 0.001;

// Class D overlaps smaller than this are boundary slivers, not real shared airspace.
const FLAG_KM2 = 0.05;


const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
    console.error('Usage: node scripts/resolve-overlaps.js <input.geojson> <output.geojson>');
    process.exit(1);
}

const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const rules = JSON.parse(fs.readFileSync(RULES_FILE, 'utf8')).classDExclusions;


// ---- geometry helpers ----

// Polygons and MultiPolygons both become MultiPolygon coordinates.
function toMultiPolygon(geometry) {
    return geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];
}

// Approximate area of a ring in km² (fine for small areas away from the poles).
function ringAreaKm2(ring) {
    let sum = 0;
    let latSum = 0;
    for (let i = 0; i < ring.length - 1; i++) {
        const [x1, y1] = ring[i];
        const [x2, y2] = ring[i + 1];
        sum += x1 * y2 - x2 * y1;
        latSum += y1;
    }
    const meanLat = latSum / (ring.length - 1);
    const kmPerDegree = 111.32;
    return Math.abs(sum / 2) * kmPerDegree * kmPerDegree * Math.cos(meanLat * Math.PI / 180);
}

function areaKm2(multiPolygon) {
    let area = 0;
    for (const [outer, ...holes] of multiPolygon) {
        area += ringAreaKm2(outer);
        for (const hole of holes) {
            area -= ringAreaKm2(hole);
        }
    }
    return area;
}

function bbox(multiPolygon) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const polygon of multiPolygon) {
        for (const [x, y] of polygon[0]) {
            minX = Math.min(minX, x); minY = Math.min(minY, y);
            maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
        }
    }
    return [minX, minY, maxX, maxY];
}

function bboxesTouch(a, b) {
    return a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
}

function bandsOverlap(a, b) {
    return a.floor < b.ceiling && b.floor < a.ceiling;
}

// Area (km²) where two volumes overlap in 3D, or 0.
function overlapKm2(a, b) {
    if (!bandsOverlap(a, b) || !bboxesTouch(a.bbox, b.bbox)) {
        return 0;
    }
    return areaKm2(intersection(a.shape, b.shape));
}

function roundCoordinates(multiPolygon) {
    return multiPolygon.map(polygon => polygon.map(ring => ring.map(([x, y]) => [
        Math.round(x * 1e6) / 1e6,
        Math.round(y * 1e6) / 1e6
    ])));
}


// ---- volumes ----

const volumes = input.features.map((feature, index) => {
    const props = feature.properties;
    const shape = toMultiPolygon(feature.geometry);
    return {
        index: index,
        ident: props.IDENT,
        name: props.NAME,
        airspaceClass: props.CLASS,
        shape: shape,
        bbox: bbox(shape),
        floor: Number(props.LOWER_VAL),
        ceiling: Number(props.UPPER_VAL),
        lowerCode: props.LOWER_CODE,
        upperCode: props.UPPER_CODE,
        upperDesc: props.UPPER_DESC
    };
});

function label(v) {
    return `${v.ident} ${v.airspaceClass} ${v.floor}-${v.ceiling}`;
}

const unresolved = [];
const usedRules = new Set();

// Does volume a win the overlap with volume b?
function beats(a, b) {
    if (a.airspaceClass !== b.airspaceClass) {
        return CLASS_RANK[a.airspaceClass] < CLASS_RANK[b.airspaceClass];
    }

    if (a.airspaceClass === 'D' && a.ident !== b.ident) {
        for (const rule of rules) {
            if (rule.airspace === b.ident && rule.excludes === a.ident) {
                usedRules.add(rule);
                return true;
            }
            if (rule.airspace === a.ident && rule.excludes === b.ident) {
                usedRules.add(rule);
                return false;
            }
        }
        const overlap = overlapKm2(a, b);
        if (overlap >= FLAG_KM2) {
            unresolved.push(`${label(a)}  vs  ${label(b)}  (${overlap.toFixed(2)} km²)`);
        }
    }

    return a.index < b.index;
}


// Find which volumes win against each volume, checking every overlapping pair once.
const winners = volumes.map(() => []);

for (let i = 0; i < volumes.length; i++) {
    for (let j = i + 1; j < volumes.length; j++) {
        const a = volumes[i];
        const b = volumes[j];
        if (!bandsOverlap(a, b) || !bboxesTouch(a.bbox, b.bbox)) {
            continue;
        }
        if (beats(a, b)) {
            winners[j].push(a);
        } else {
            winners[i].push(b);
        }
    }
}

if (unresolved.length > 0) {
    console.error('Class D overlaps with no rule in scripts/airspace-rules.json:');
    for (const line of unresolved) {
        console.error('  ' + line);
    }
    console.error('Look up who owns each overlap in the legal descriptions (FAA Order JO 7400.11, paragraph 5000) and add a rule.');
    process.exit(1);
}

// Warn about rules for airports that are both in the data but no longer overlap.
const idents = new Set(volumes.map(v => v.ident));
for (const rule of rules) {
    if (idents.has(rule.airspace) && idents.has(rule.excludes) && !usedRules.has(rule)) {
        console.warn(`Rule ${rule.airspace} excludes ${rule.excludes} no longer matches an overlap.`);
    }
}


// Cut a piece of airspace by a winning volume. Outside the winner's shape the piece keeps its
// full altitude band. Inside it, the piece keeps only the altitudes the winner doesn't cover.
function cut(piece, winner) {
    if (!bandsOverlap(piece, winner)) {
        return [piece];
    }

    const result = [];

    const outside = difference(piece.shape, winner.shape);
    if (outside.length > 0) {
        result.push({ ...piece, shape: outside });
    }

    const inside = intersection(piece.shape, winner.shape);
    if (inside.length > 0) {
        if (piece.floor < winner.floor) {
            // Below the winner: up to but not including its floor.
            result.push({
                ...piece, shape: inside,
                ceiling: winner.floor, upperCode: winner.lowerCode, upperDesc: 'TNI'
            });
        }
        if (winner.ceiling < piece.ceiling) {
            // Above the winner.
            result.push({
                ...piece, shape: inside,
                floor: winner.ceiling, lowerCode: winner.upperCode
            });
        }
    }

    return result;
}

const features = [];

for (const volume of volumes) {
    let pieces = [volume];
    for (const winner of winners[volume.index]) {
        pieces = pieces.flatMap(piece => cut(piece, winner));
    }

    for (const piece of pieces) {
        if (areaKm2(piece.shape) < MIN_PIECE_KM2) {
            continue;
        }
        features.push({
            type: 'Feature',
            properties: {
                IDENT: piece.ident,
                NAME: piece.name,
                CLASS: piece.airspaceClass,
                LOWER_VAL: piece.floor,
                LOWER_CODE: piece.lowerCode,
                UPPER_VAL: piece.ceiling,
                UPPER_CODE: piece.upperCode,
                UPPER_DESC: piece.upperDesc
            },
            geometry: { type: 'MultiPolygon', coordinates: roundCoordinates(piece.shape) }
        });
    }
}

fs.writeFileSync(outputPath, JSON.stringify({ type: 'FeatureCollection', features: features }));

const cutCount = winners.filter(list => list.length > 0).length;
console.log(`Overlaps: cut ${cutCount} of ${volumes.length} volumes into ${features.length} pieces.`);
