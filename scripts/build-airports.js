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

// A sanity check: there are about 5,000 public-use US airports. Far fewer means a bad file.
const MIN_AIRPORTS = 4000;

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
    console.error('Usage: node scripts/build-airports.js <APT_BASE.csv> <airports.json>');
    process.exit(1);
}

// The FAA's CSV quotes every field: "a","b,with comma","c ""quoted"""
function parseLine(line) {
    const fields = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (inQuotes) {
            if (char === '"' && line[i + 1] === '"') {
                field += '"';
                i++;
            } else if (char === '"') {
                inQuotes = false;
            } else {
                field += char;
            }
        } else if (char === '"') {
            inQuotes = true;
        } else if (char === ',') {
            fields.push(field);
            field = '';
        } else {
            field += char;
        }
    }
    fields.push(field);
    return fields;
}

const lines = fs.readFileSync(inputPath, 'utf8').split(/\r?\n/).filter(line => line.length > 0);
const header = parseLine(lines[0]);
const column = name => {
    const index = header.indexOf(name);
    if (index < 0) {
        console.error(`APT_BASE.csv has no ${name} column.`);
        process.exit(1);
    }
    return index;
};

const ID = column('ARPT_ID');
const ICAO = column('ICAO_ID');
const NAME = column('ARPT_NAME');
const CITY = column('CITY');
const STATE = column('STATE_CODE');
const LAT = column('LAT_DECIMAL');
const LON = column('LONG_DECIMAL');
const TYPE = column('SITE_TYPE_CODE');
const USE = column('FACILITY_USE_CODE');
const STATUS = column('ARPT_STATUS');
const COUNTRY = column('COUNTRY_CODE');
const TOWER = column('TWR_TYPE_CODE');
const PART_139 = column('FAR_139_TYPE_CODE');

// e.g. TWR_TYPE_CODE "ATCT" and FAR_139_TYPE_CODE "I E" (Class I, index E) for JFK.
function importance(row) {
    let score = row[TOWER].startsWith('ATCT') ? 1 : 0;
    const [part139Class, index] = row[PART_139].split(' ');
    if (part139Class) {
        score += 1;
        if (part139Class === 'I') {
            score += Math.max(0, 'ABCDE'.indexOf(index) + 1);
        }
    }
    return score;
}

const airports = [];
for (const line of lines.slice(1)) {
    const row = parseLine(line);
    if (row[STATUS] !== 'O' || row[USE] !== 'PU' || row[COUNTRY] !== 'US') {
        continue;
    }
    airports.push([
        row[ID],
        row[ICAO],
        row[NAME],
        row[CITY],
        row[STATE],
        Math.round(Number(row[LON]) * 1e5) / 1e5,
        Math.round(Number(row[LAT]) * 1e5) / 1e5,
        row[TYPE],
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
