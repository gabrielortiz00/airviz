import maplibregl from "maplibre-gl";
import 'maplibre-gl/dist/maplibre-gl.css'
import { MapboxOverlay } from '@deck.gl/mapbox';
import { SolidPolygonLayer } from '@deck.gl/layers';
import './style.css'


const FEET_TO_METERS = 0.3048;

// Built from the FAA NASR Class_Airspace shapefile by scripts/build-airspace.sh.
const AIRSPACE_FILES = [
    '/data/airspace.geojson'
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

// Altitudes as a pilot reads them, e.g. "SFC to 2,000 MSL" or "1,500 MSL up to but not including 2,100 MSL".
function formatAltitudes(volume) {
    const floor = volume.lowerCode === 'SFC' && Number(volume.lowerVal) === 0
        ? 'SFC'
        : `${Number(volume.lowerVal).toLocaleString()} ${volume.lowerCode}`;
    const ceiling = `${Number(volume.upperVal).toLocaleString()} ${volume.upperCode}`;

    if (volume.upperDesc === 'TNI') {
        return `${floor} up to but not including ${ceiling}`;
    }
    return `${floor} to ${ceiling}`;
}

// deck.gl draws the airspace inside the MapLibre map, so it shares the camera and terrain.
const deckOverlay = new MapboxOverlay({
    interleaved: true,
    layers: [],
    getTooltip: ({ object }) => object && {
        text: `${object.name}\n${formatAltitudes(object)}`
    }
});
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
                // Original FAA values (feet) for the tooltip.
                lowerVal: props.LOWER_VAL,
                lowerCode: props.LOWER_CODE,
                upperVal: props.UPPER_VAL,
                upperCode: props.UPPER_CODE,
                upperDesc: props.UPPER_DESC,
                rings: rings.map(ring => ring.map(([lon, lat]) => [lon, lat, floor]))
            });
        }
    }

    return volumes;
}

// Show which NASR cycle the data is from. A cycle takes effect at 0901 UTC on its
// effective date and lasts 28 days.
async function showCycle() {
    const cycleText = document.getElementById('cycle');
    try {
        const { effective } = await (await fetch('/data/cycle.json')).json();
        const [year, month, day] = effective.split('-').map(Number);
        const start = new Date(Date.UTC(year, month - 1, day, 9, 1));
        const end = new Date(start.getTime() + 28 * 24 * 60 * 60 * 1000);
        const now = new Date();

        const dateFormat = { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' };
        const startText = start.toLocaleDateString('en-US', dateFormat);
        const endText = end.toLocaleDateString('en-US', dateFormat);

        if (now < start) {
            cycleText.textContent = `FAA data for the upcoming cycle, effective ${startText}.`;
        } else if (now < end) {
            cycleText.textContent = `FAA data effective ${startText} to ${endText}.`;
        } else {
            cycleText.textContent = `FAA data expired ${endText}. Airspace may be out of date.`;
            cycleText.classList.add('stale');
        }
    } catch (error) {
        cycleText.textContent = 'FAA data cycle unknown. Airspace may be out of date.';
        cycleText.classList.add('stale');
    }
}

showCycle();

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

    const volumeShape = {
        data: volumes,
        extruded: true,
        getPolygon: v => v.rings,
        getElevation: v => v.ceiling - v.floor
    };

    deckOverlay.setProps({
        layers: [
            // What you see. Still hidden by terrain, but translucent faces don't hide each other.
            new SolidPolygonLayer({
                ...volumeShape,
                id: 'airspace',
                getFillColor: v => CLASS_COLORS[v.airspaceClass],
                parameters: { depthWriteEnabled: false }
            }),
            // An invisible copy for hovering. It writes depth, so the volume nearest the
            // camera is picked instead of whichever was drawn last. It also draws the highlight.
            new SolidPolygonLayer({
                ...volumeShape,
                id: 'airspace-picking',
                getFillColor: [0, 0, 0, 0],
                pickable: true,
                autoHighlight: true,
                highlightColor: [255, 255, 255, 90]
            })
        ]
    });

});
