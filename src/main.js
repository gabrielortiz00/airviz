import maplibregl from "maplibre-gl";
import 'maplibre-gl/dist/maplibre-gl.css'
import { MapboxOverlay } from '@deck.gl/mapbox';
import { SolidPolygonLayer } from '@deck.gl/layers';


const FEET_TO_METERS = 0.3048;

// Airspace files exported from the FAA NASR Class_Airspace shapefile.
const AIRSPACE_FILES = [
    '/data/SFO_Airspace.geojson', // San Francisco
    '/data/OAK_Airspace.geojson', // Oakland
    '/data/SJC_Airspace.geojson', // San Jose
    '/data/HWD_Airspace.geojson', // Hayward
    '/data/RHV_Airspace.geojson', // Reid-Hillview
    '/data/LVK_Airspace.geojson', // Livermore
    '/data/PAO_Airspace.geojson', // Palo Alto
    '/data/SQL_Airspace.geojson', // San Carlos
    '/data/CCR_Airspace.geojson', // Concord
    '/data/APC_Airspace.geojson', // Napa
    '/data/MOD_Airspace.geojson', // Modesto
    '/data/MRY_Airspace.geojson', // Monterey
    '/data/BOS_Airspace.geojson'  // Boston
];

// Colors loosely follow sectional chart conventions: B blue, C magenta.
// D is dashed blue on a sectional; cyan keeps it distinct from B in 3D.
const CLASS_COLORS = {
    'B': [20, 80, 170, 100],
    'C': [176, 30, 120, 90],
    'D': [0, 165, 200, 70]
};


const map = new maplibregl.Map({
    container: 'app', // container ID from index.html
    center: [-122.213473, 37.604249], // starting position
    zoom: 9, // starting zoom
    maxPitch: 85, // allow looking at airspace shelves from the side
    style: 'https://tiles.openfreemap.org/styles/positron'
});

// deck.gl draws the airspace inside the MapLibre map, so it shares the camera and terrain.
const deckOverlay = new MapboxOverlay({ interleaved: true, layers: [] });
map.addControl(deckOverlay);


// Floor in meters MSL. SFC floors start at sea level so the terrain hides the part below ground.
function floorMeters(props) {
    if (props.LOWER_CODE === 'SFC') {
        if (Number(props.LOWER_VAL) !== 0) {
            // Floors like "300 SFC" follow the terrain, which a flat floor can't show yet.
            console.warn(`Treating ${props.LOWER_VAL} SFC floor as MSL: ${props.NAME}`);
            return Number(props.LOWER_VAL) * FEET_TO_METERS;
        }
        return 0;
    }
    return Number(props.LOWER_VAL) * FEET_TO_METERS;
}

// Turn geojson features into one volume per polygon, with the floor as the z of every point.
function toVolumes(geojson) {
    const volumes = [];

    for (const feature of geojson.features) {
        const props = feature.properties;
        if (!(props.CLASS in CLASS_COLORS)) {
            continue; // Class E is not drawn for now
        }

        const floor = floorMeters(props);
        const ceiling = Number(props.UPPER_VAL) * FEET_TO_METERS;
        const polygons = feature.geometry.type === 'MultiPolygon'
            ? feature.geometry.coordinates
            : [feature.geometry.coordinates];

        for (const rings of polygons) {
            volumes.push({
                name: props.NAME,
                airspaceClass: props.CLASS,
                floor: floor,
                ceiling: ceiling,
                rings: rings.map(ring => ring.map(([lon, lat]) => [lon, lat, floor]))
            });
        }
    }

    return volumes;
}

async function loadAirspace(urls) {
    const files = await Promise.all(urls.map(url => fetch(url).then(response => response.json())));
    return files.flatMap(toVolumes);
}


map.on('load', async () => {

    // Terrain data source (AWS Terrain Tiles, terrarium encoding).
    map.addSource('terrain-dem', {
        'type': 'raster-dem',
        'tiles': ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
        'encoding': 'terrarium',
        'tileSize': 256,
        'maxzoom': 15,
        'attribution': 'Terrain: Mapzen, AWS Terrain Tiles'
    });

    // Exaggeration must stay at 1 so altitudes are true to scale.
    map.setTerrain({
        'source': 'terrain-dem',
        'exaggeration': 1
    });

    // Hillshade so the terrain is visible on the flat basemap.
    map.addLayer({
        'id': 'hillshade',
        'type': 'hillshade',
        'source': 'terrain-dem',
        'paint': {
            'hillshade-exaggeration': 0.3
        }
    });

    const volumes = await loadAirspace(AIRSPACE_FILES);

    deckOverlay.setProps({
        layers: [
            new SolidPolygonLayer({
                id: 'airspace',
                data: volumes,
                extruded: true,
                getPolygon: v => v.rings,
                getElevation: v => v.ceiling - v.floor,
                getFillColor: v => CLASS_COLORS[v.airspaceClass],
                // Still hidden by terrain, but translucent faces don't hide each other.
                parameters: { depthWriteEnabled: false }
            })
        ]
    });

});
