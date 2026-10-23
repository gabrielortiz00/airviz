// Airport identifiers on the map (HWD, OAK), drawn by MapLibre from the same airports.json
// the search uses.

// Airports with a tower or airline service (importance 2 and up) show from far out;
// the rest appear once you zoom in, so the map isn't covered in labels.
const MAJOR = ['>=', ['get', 'importance'], 2];
const MINOR_MINZOOM = 7;

// Minor first: MapLibre places labels from the top layer down, so major airports win
// when labels would overlap. The losing label is hidden.
const LAYERS = [
    { id: 'airport-labels-minor', filter: ['!', MAJOR], minzoom: MINOR_MINZOOM },
    { id: 'airport-labels-major', filter: MAJOR, minzoom: 3 }
];

// The lowest label layer, for drawing other layers underneath the labels.
export const FIRST_AIRPORT_LABEL_LAYER = LAYERS[0].id;

// Adds the label layers with no airports yet, so other layers can be placed below them
// right away. setAirports fills them in once the list has downloaded.
export function addAirportLabels(map) {
    map.addSource('airports', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

    for (const { id, filter, minzoom } of LAYERS) {
        map.addLayer({
            id,
            type: 'symbol',
            source: 'airports',
            filter,
            minzoom,
            layout: {
                'text-field': ['get', 'id'],
                'text-font': ['Noto Sans Bold'],
                'text-size': ['case', MAJOR, 12, 11],
                // Within a layer, bigger airports win too.
                'symbol-sort-key': ['-', ['get', 'importance']]
            },
            paint: {
                'text-color': '#1d2430',
                'text-halo-color': 'rgba(255, 255, 255, 0.9)',
                'text-halo-width': 1.5
            }
        });
    }
}

export function setAirports(map, airports) {
    map.getSource('airports').setData({
        type: 'FeatureCollection',
        features: airports
            .filter(airport => airport.type !== 'H') // heliports
            .map(airport => ({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [airport.lon, airport.lat] },
                properties: { id: airport.id, importance: airport.importance }
            }))
    });
}
