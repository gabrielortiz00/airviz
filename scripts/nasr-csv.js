// Read a NASR CSV file (e.g. APT_BASE.csv) into rows keyed by column name.

import fs from 'node:fs';

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

// Returns one object per row, e.g. { ARPT_ID: 'PAO', ARPT_NAME: 'PALO ALTO', ... }.
// Stops with an error if any of the required columns is missing.
export function readNasrCsv(path, requiredColumns = []) {
    const lines = fs.readFileSync(path, 'utf8').split(/\r?\n/).filter(line => line.length > 0);
    const header = parseLine(lines[0]);

    for (const name of requiredColumns) {
        if (!header.includes(name)) {
            console.error(`${path} has no ${name} column.`);
            process.exit(1);
        }
    }

    return lines.slice(1).map(line => {
        const fields = parseLine(line);
        return Object.fromEntries(header.map((name, index) => [name, fields[index]]));
    });
}
