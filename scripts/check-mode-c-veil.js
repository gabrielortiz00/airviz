// Check that scripts/mode-c-veil.json still matches the current regulation.
//
// Fetches 14 CFR Part 91 Appendix D from the eCFR API and compares Section 1, the Mode C veil
// list, entry by entry. Fails if it changed, so the list gets updated instead of going stale.
// If the eCFR can't be reached it only warns: an outage there shouldn't block a data update.
//
// Usage: node scripts/check-mode-c-veil.js

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VEIL_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'mode-c-veil.json');
const ECFR = 'https://www.ecfr.gov/api/versioner/v1';

async function fetchText(url) {
    // The eCFR API only answers requests that accept a compressed response.
    const response = await fetch(url, { headers: { 'Accept-Encoding': 'gzip' } });
    if (!response.ok) {
        throw new Error(`${response.status} from ${url}`);
    }
    return response.text();
}

async function currentSection1() {
    // The latest date title 14 has been published for.
    const titles = JSON.parse(await fetchText(`${ECFR}/titles.json`)).titles;
    const date = titles.find(title => title.number === 14).up_to_date_as_of;

    const xml = await fetchText(`${ECFR}/full/${date}/title-14.xml?part=91&appendix=Appendix%20D%20to%20Part%2091`);
    const text = xml.replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&').replace(/&#8217;|&rsquo;/g, "'")
        .replace(/\s+/g, ' ');

    const start = text.indexOf('each location in the following list.');
    const end = text.indexOf('Section 2.');
    if (start < 0 || end < 0) {
        throw new Error('the Appendix D text has an unexpected layout');
    }
    // Entries look like "Atlanta, GA (Hartsfield-Jackson Atlanta International Airport)".
    const entries = text.slice(start, end).replace('each location in the following list.', '')
        .match(/[^()]+\([^()]+\)/g) ?? [];
    return { date, entries: entries.map(entry => entry.trim()) };
}

const listed = JSON.parse(fs.readFileSync(VEIL_FILE, 'utf8')).locations.map(location => location.regulation);

let current;
try {
    current = await currentSection1();
} catch (error) {
    console.warn(`Couldn't check the Mode C veil list against the eCFR (${error.message}). Using scripts/mode-c-veil.json as is.`);
    process.exit(0);
}

const added = current.entries.filter(entry => !listed.includes(entry));
const removed = listed.filter(entry => !current.entries.includes(entry));

if (added.length > 0 || removed.length > 0) {
    console.error(`The Mode C veil list in 14 CFR 91 Appendix D, Section 1 changed (eCFR as of ${current.date}):`);
    for (const entry of added) {
        console.error(`  added:   ${entry}`);
    }
    for (const entry of removed) {
        console.error(`  removed: ${entry}`);
    }
    console.error('Update scripts/mode-c-veil.json to match, with the NASR identifier for each airport.');
    process.exit(1);
}

console.log(`Mode C veil list matches 14 CFR 91 Appendix D (eCFR as of ${current.date}, ${current.entries.length} locations).`);
