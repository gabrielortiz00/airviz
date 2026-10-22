// Build public/data/airports.json for the airport search from the NASR APT_BASE.csv.
//
// Keeps operational, public-use US facilities only (airports, seaplane bases, gliderports and
// so on that anyone can fly into), with just the fields search needs. Each airport is an
// array to keep the file small:
// [FAA id, ICAO id, name, city, state, longitude, latitude, type, importance]
//
// Importance (0 to 7) only breaks ties between equally good search matches, so "new york"
// lists JFK before smaller fields: 1 for a control tower, 1 for a Part 139 airline
// certificate, plus 1 to 5 for Class I airports by size index (A to E).
//
// Usage: node scripts/build-airports.js <APT_BASE.csv> <airports.json>

import fs from 'node:fs';
import { readNasrCsv } from './nasr-csv.js';

// A sanity check: there are about 5,000 public-use US airports. Far fewer means a bad file.
const MIN_AIRPORTS = 4000;

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
    console.error('Usage: node scripts/build-airports.js <APT_BASE.csv> <airports.json>');
    process.exit(1);
}

const rows = readNasrCsv(inputPath, [
    'ARPT_ID', 'ICAO_ID', 'ARPT_NAME', 'CITY', 'STATE_CODE', 'LAT_DECIMAL', 'LONG_DECIMAL',
    'SITE_TYPE_CODE', 'FACILITY_USE_CODE', 'ARPT_STATUS', 'COUNTRY_CODE', 'TWR_TYPE_CODE',
    'FAR_139_TYPE_CODE'
]);

// e.g. TWR_TYPE_CODE "ATCT" and FAR_139_TYPE_CODE "I E" (Class I, index E) for JFK.
function importance(row) {
    let score = row.TWR_TYPE_CODE.startsWith('ATCT') ? 1 : 0;
    const [part139Class, index] = row.FAR_139_TYPE_CODE.split(' ');
    if (part139Class) {
        score += 1;
        if (part139Class === 'I') {
            score += Math.max(0, 'ABCDE'.indexOf(index) + 1);
        }
    }
    return score;
}

const airports = [];
for (const row of rows) {
    if (row.ARPT_STATUS !== 'O' || row.FACILITY_USE_CODE !== 'PU' || row.COUNTRY_CODE !== 'US') {
        continue;
    }
    airports.push([
        row.ARPT_ID,
        row.ICAO_ID,
        row.ARPT_NAME,
        row.CITY,
        row.STATE_CODE,
        Math.round(Number(row.LONG_DECIMAL) * 1e5) / 1e5,
        Math.round(Number(row.LAT_DECIMAL) * 1e5) / 1e5,
        row.SITE_TYPE_CODE,
        importance(row)
    ]);
}

if (airports.length < MIN_AIRPORTS) {
    console.error(`Only ${airports.length} public-use airports found, expected about 5,000. Check the APT_BASE.csv file.`);
    process.exit(1);
}

airports.sort((a, b) => a[0].localeCompare(b[0]));
fs.writeFileSync(outputPath, JSON.stringify(airports));
console.log(`Airports: ${airports.length} public-use airports.`);
