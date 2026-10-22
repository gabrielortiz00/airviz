// Print the effective date (YYYY-MM-DD) of the NASR cycle in effect, or the next one.
//
// NASR cycles last 28 days and take effect at 0901 UTC on their effective date.
//
// Usage: node scripts/nasr-cycle.js [--next] [--at 2026-11-26T10:00:00Z]

const CYCLE_DAYS = 28;
const DAY_MS = 24 * 60 * 60 * 1000;

// Any known cycle works as a starting point; the rest are every 28 days from it.
const KNOWN_CYCLE = Date.UTC(2026, 9, 29, 9, 1); // 2026-10-29 0901 UTC

const args = process.argv.slice(2);
const atIndex = args.indexOf('--at');
const now = atIndex >= 0 ? Date.parse(args[atIndex + 1]) : Date.now();
if (Number.isNaN(now)) {
    console.error('Usage: node scripts/nasr-cycle.js [--next] [--at <ISO date>]');
    process.exit(1);
}

const cyclesSinceKnown = Math.floor((now - KNOWN_CYCLE) / (CYCLE_DAYS * DAY_MS));
const current = KNOWN_CYCLE + cyclesSinceKnown * CYCLE_DAYS * DAY_MS;
const cycle = args.includes('--next') ? current + CYCLE_DAYS * DAY_MS : current;

console.log(new Date(cycle).toISOString().slice(0, 10));
