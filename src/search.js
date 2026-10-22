// Airport search over public/data/airports.json (built by scripts/build-airports.js).

// Turn the compact rows into objects, with the words of the name and city ready to match.
export function prepareAirports(rows) {
    return rows.map(([id, icao, name, city, state, lon, lat, type, importance]) => ({
        id, icao, name, city, state, lon, lat, type, importance,
        words: `${name} ${city}`.split(/[^A-Z0-9]+/).filter(Boolean),
        text: `${name} ${city}`
    }));
}

// Lower ranks are better matches.
// 0: exact identifier (PAO or KPAO)
// 1: identifier starts with the query (KPA)
// 2: name or city starts with the query (PALO AL, NEW YORK)
// 3: every word of the query starts a word of the name or city (SAN JOSE, JOSE)
// 4: name or city contains the query anywhere
function rank(airport, query, queryWords) {
    if (query === airport.id || query === airport.icao) {
        return 0;
    }
    if (airport.id.startsWith(query) || (airport.icao && airport.icao.startsWith(query))) {
        return 1;
    }
    if (airport.name.startsWith(query) || airport.city.startsWith(query)) {
        return 2;
    }
    if (queryWords.every(q => airport.words.some(word => word.startsWith(q)))) {
        return 3;
    }
    if (airport.text.includes(query)) {
        return 4;
    }
    return null;
}

// Airports (type A) before heliports, seaplane bases and the rest.
const TYPE_ORDER = { A: 0, C: 1, G: 2, H: 3, U: 4, B: 5 };

export function searchAirports(airports, input, limit = 8) {
    const query = input.toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (query.length < 2) {
        return [];
    }
    const queryWords = query.split(' ');

    const matches = [];
    for (const airport of airports) {
        const score = rank(airport, query, queryWords);
        if (score !== null) {
            matches.push({ airport, score });
        }
    }

    // Same match quality: bigger airports first (see scripts/build-airports.js), then
    // airports before heliports and seaplane bases, then by name.
    matches.sort((a, b) =>
        a.score - b.score
        || b.airport.importance - a.airport.importance
        || (TYPE_ORDER[a.airport.type] ?? 9) - (TYPE_ORDER[b.airport.type] ?? 9)
        || a.airport.name.localeCompare(b.airport.name));

    return matches.slice(0, limit).map(match => match.airport);
}
