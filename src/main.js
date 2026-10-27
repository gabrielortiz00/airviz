import { inject } from '@vercel/analytics';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { SolidPolygonLayer } from '@deck.gl/layers';
import './style.css';
import { prepareAirports, searchAirports } from './search.js';
import { FIRST_AIRPORT_LABEL_LAYER, addAirportLabels, setAirports } from './airport-labels.js';

// Anonymous visit counts with Vercel Web Analytics (no cookies).
inject();

const FEET_TO_METERS = 0.3048;

// Built from the FAA NASR Class_Airspace shapefile by scripts/build-airspace.sh.
const AIRSPACE_URL = '/data/airspace.geojson';

// Built by scripts/build-mode-c-veil.js: 30 NM around the airports in 14 CFR 91 Appendix D.
// Drawn as a line on the ground, like the sectional.
const VEIL_URL = '/data/mode-c-veil.geojson';

// Sectional charts draw the veil as a thin magenta line.
const VEIL_COLOR = 'rgb(176, 48, 110)';

// Colors loosely follow sectional chart conventions: B blue, C magenta.
// D is dashed blue on a sectional; cyan keeps it distinct from B in 3D.
const CLASS_COLORS = {
    B: [20, 80, 170, 100],
    C: [176, 30, 120, 90],
    D: [0, 165, 200, 70]
};

// Where the map starts, and where the home button goes back to.
const START_VIEW = {
    center: [-122.213473, 37.604249], // SF Bay Area
    zoom: 9,
    bearing: 0,
    pitch: 0
};

const map = new maplibregl.Map({
    container: 'app', // container ID from index.html
    ...START_VIEW,
    // Allow looking at airspace shelves from the side. Above about 84.3° MapLibre's terrain
    // camera lifts the camera after every move (issue #8).
    maxPitch: 84,
    // Keep the camera in the URL (#zoom/lat/lon/bearing/pitch) so a view can be shared,
    // and a link with a hash opens at that view instead of START_VIEW.
    hash: true,
    style: 'https://tiles.openfreemap.org/styles/positron'
});

// Button that flies back to the starting view, styled like MapLibre's own controls.
class HomeControl {
    onAdd(map) {
        this.container = document.createElement('div');
        this.container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
        const button = document.createElement('button');
        button.type = 'button';
        button.title = 'Back to the starting view';
        button.setAttribute('aria-label', 'Back to the starting view');
        button.innerHTML = '<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" style="display:block;margin:auto">'
            + '<path d="M4 9.5L10 4l6 5.5M6 8v7.5h3v-4h2v4h3V8" fill="none" stroke="#333" stroke-width="1.6" stroke-linejoin="round"/></svg>';
        button.addEventListener('click', () => map.flyTo(START_VIEW));
        this.container.append(button);
        return this.container;
    }

    onRemove() {
        this.container.remove();
    }
}

// Zoom buttons, and a compass that shows north and tilt. Clicking the compass resets both.
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
map.addControl(new HomeControl(), 'top-right');

// Altitudes as a pilot reads them, e.g. "SFC to 2,000 MSL" or "1,500 MSL up to but not including 2,100 MSL".
function formatAltitudes(volume) {
    let floor = volume.lowerCode === 'SFC' && Number(volume.lowerVal) === 0
        ? 'SFC'
        : `${Number(volume.lowerVal).toLocaleString()} ${volume.lowerCode}`;
    if (volume.lowerDesc === 'ABV') {
        floor = `Above ${floor}`; // the floor altitude itself belongs to the airspace below
    }
    const ceiling = `${Number(volume.upperVal).toLocaleString()} ${volume.upperCode}`;

    if (volume.upperDesc === 'TNI') {
        return `${floor} up to but not including ${ceiling}`;
    }
    return `${floor} to ${ceiling}`;
}

// The last airspace hovered, so an issue report can name it.
let lastHovered = null;

// deck.gl draws the airspace inside the MapLibre map, so it shares the camera and terrain.
const deckOverlay = new MapboxOverlay({
    interleaved: true,
    layers: [],
    getTooltip: ({ object }) => {
        if (!object) {
            return null;
        }
        lastHovered = object;
        return { text: `${object.name}\n${formatAltitudes(object)}` };
    }
});
map.addControl(deckOverlay);

// Turn geojson features into one volume per polygon, with the floor as the z of every point.
// SFC floors (0) start at sea level so the terrain hides the part below ground. The few
// floors like "300 SFC" are drawn as MSL; the build log lists them.
function toVolumes(geojson) {
    const volumes = [];

    for (const feature of geojson.features) {
        const props = feature.properties;
        const floor = Number(props.LOWER_VAL) * FEET_TO_METERS;
        const ceiling = Number(props.UPPER_VAL) * FEET_TO_METERS;

        // The build always writes MultiPolygons.
        for (const rings of feature.geometry.coordinates) {
            volumes.push({
                name: props.NAME,
                airspaceClass: props.CLASS,
                floor: floor,
                ceiling: ceiling,
                // Original FAA values (feet) for the tooltip.
                lowerVal: props.LOWER_VAL,
                lowerCode: props.LOWER_CODE,
                lowerDesc: props.LOWER_DESC,
                upperVal: props.UPPER_VAL,
                upperCode: props.UPPER_CODE,
                upperDesc: props.UPPER_DESC,
                rings: rings.map(ring => ring.map(([lon, lat]) => [lon, lat, floor]))
            });
        }
    }

    return volumes;
}

// Effective date of the loaded NASR cycle, e.g. "2026-10-29".
let cycleEffective = 'unknown';

// Show which NASR cycle the data is from. A cycle takes effect at 0901 UTC on its
// effective date and lasts 28 days.
async function showCycle() {
    const cycleText = document.getElementById('cycle');
    try {
        const { effective } = await (await fetch('/data/cycle.json')).json();
        cycleEffective = effective;
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

// Copy the current URL, which holds the camera thanks to the map's hash option.
const copyLinkButton = document.getElementById('copy-link');
copyLinkButton.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(window.location.href);
        copyLinkButton.textContent = 'Copied!';
    } catch {
        copyLinkButton.textContent = 'Copy failed, use the address bar';
    }
    setTimeout(() => { copyLinkButton.textContent = 'Copy link to this view'; }, 1500);
});

// Fill in the GitHub issue form with where the map is looking (with a link to the exact
// view), the data cycle and the last airspace hovered (field ids match
// .github/ISSUE_TEMPLATE/airspace-error.yml).
document.getElementById('report-link').addEventListener('click', event => {
    const { lng, lat } = map.getCenter();
    const params = new URLSearchParams({
        template: 'airspace-error.yml',
        location: `${lat.toFixed(4)}, ${lng.toFixed(4)} (zoom ${map.getZoom().toFixed(1)}) ${window.location.href}`,
        cycle: cycleEffective
    });
    if (lastHovered) {
        params.set('airspace', lastHovered.name);
    }
    event.currentTarget.href = `https://github.com/gabrielortiz00/airviz/issues/new?${params}`;
});

map.on('load', async () => {

    // Terrain data source (AWS Terrain Tiles, terrarium encoding).
    map.addSource('terrain-dem', {
        type: 'raster-dem',
        tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
        encoding: 'terrarium',
        tileSize: 256,
        maxzoom: 15,
        attribution: 'Terrain: Mapzen, AWS Terrain Tiles'
    });

    // Exaggeration must stay at 1 so altitudes are true to scale.
    map.setTerrain({
        source: 'terrain-dem',
        exaggeration: 1
    });

    // Hillshade so the terrain is visible on the flat basemap.
    map.addLayer({
        id: 'hillshade',
        type: 'hillshade',
        source: 'terrain-dem',
        paint: {
            'hillshade-exaggeration': 0.3
        }
    });

    // Airport labels stay on top: the veil and airspace layers are inserted below them.
    addAirportLabels(map);

    const [airspace, veil] = await Promise.all([
        fetch(AIRSPACE_URL).then(response => response.json()),
        fetch(VEIL_URL).then(response => response.json())
    ]);

    // The veil's edge on the ground. MapLibre drapes lines over the terrain.
    map.addSource('mode-c-veil', { type: 'geojson', data: veil });
    map.addLayer({
        id: 'mode-c-veil-ground',
        type: 'line',
        source: 'mode-c-veil',
        paint: {
            'line-color': VEIL_COLOR,
            'line-width': 1.5,
            'line-opacity': 0.8
        }
    }, FIRST_AIRPORT_LABEL_LAYER);
    setVeilVisible(showVeil);

    for (const volume of toVolumes(airspace)) {
        volumesByClass[volume.airspaceClass].push(volume);
    }
    drawAirspace();

    try {
        setAirports(map, await loadAirports());
    } catch {
        // The map still works without airport labels.
    }

});

// One list per class, filled once on load. The arrays never change after that, so deck.gl
// builds each class's geometry only once and the checkboxes just show or hide it.
const volumesByClass = { B: [], C: [], D: [] };

// Classes checked in the panel's Airspace section.
const visibleClasses = new Set(['B', 'C', 'D']);
let showVeil = true;

// Two layers per class. Classes draw in this order, so where volumes overlap on screen,
// D tints over C and C over B. All visible layers go before all picking layers: the
// picking layers write depth, and anything drawn after them is hidden behind them.
function drawAirspace() {
    const visibleLayers = [];
    const pickingLayers = [];

    for (const airspaceClass of ['B', 'C', 'D']) {
        const volumeShape = {
            data: volumesByClass[airspaceClass],
            // Hidden layers aren't drawn or picked at all.
            visible: visibleClasses.has(airspaceClass),
            beforeId: FIRST_AIRPORT_LABEL_LAYER,
            extruded: true,
            getPolygon: v => v.rings,
            getElevation: v => v.ceiling - v.floor
        };

        // What you see. Still hidden by terrain, but translucent faces don't hide each other.
        visibleLayers.push(new SolidPolygonLayer({
            ...volumeShape,
            id: `airspace-${airspaceClass}`,
            getFillColor: CLASS_COLORS[airspaceClass],
            parameters: { depthWriteEnabled: false }
        }));
        // An invisible copy for hovering. It writes depth, so the volume nearest the
        // camera is picked instead of whichever was drawn last. It also draws the highlight.
        pickingLayers.push(new SolidPolygonLayer({
            ...volumeShape,
            id: `airspace-picking-${airspaceClass}`,
            getFillColor: [0, 0, 0, 0],
            pickable: true,
            autoHighlight: true,
            highlightColor: [255, 255, 255, 90]
        }));
    }

    deckOverlay.setProps({ layers: [...visibleLayers, ...pickingLayers] });
}

function setVeilVisible(visible) {
    showVeil = visible;
    // The ground line only exists once the map has loaded; the load handler applies it then.
    if (map.getLayer('mode-c-veil-ground')) {
        map.setLayoutProperty('mode-c-veil-ground', 'visibility', visible ? 'visible' : 'none');
    }
}

document.getElementById('toggle-veil').addEventListener('change', event => {
    setVeilVisible(event.target.checked);
});

// Class checkboxes. The swatches use the same colors as the map, at full opacity.
for (const input of document.querySelectorAll('.class-toggle input[data-class]')) {
    const airspaceClass = input.dataset.class;
    const [r, g, b] = CLASS_COLORS[airspaceClass];
    input.parentElement.querySelector('.swatch').style.background = `rgb(${r}, ${g}, ${b})`;

    input.addEventListener('change', () => {
        if (input.checked) {
            visibleClasses.add(airspaceClass);
        } else {
            visibleClasses.delete(airspaceClass);
        }
        drawAirspace();
    });
}

// Collapse the panel down to its header, and remember the choice for next time.
const panel = document.getElementById('panel');
const panelToggle = document.getElementById('panel-toggle');

function setPanelCollapsed(collapsed) {
    panel.classList.toggle('collapsed', collapsed);
    panelToggle.setAttribute('aria-expanded', String(!collapsed));
    const label = collapsed ? 'Show panel' : 'Hide panel';
    panelToggle.setAttribute('aria-label', label);
    panelToggle.title = label;
}

panelToggle.addEventListener('click', () => {
    const collapsed = !panel.classList.contains('collapsed');
    setPanelCollapsed(collapsed);
    try {
        localStorage.setItem('panelCollapsed', String(collapsed));
    } catch {
        // Storage can be blocked (private browsing); the panel still works.
    }
});

try {
    setPanelCollapsed(localStorage.getItem('panelCollapsed') === 'true');
} catch {
    // Same as above.
}

// Airport search. The airport list (about 130 KB compressed) also feeds the airport labels,
// so it downloads once the map has loaded.
const AIRPORTS_URL = '/data/airports.json';

// Zoomed in and tilted, so the airport's airspace shows as 3D volumes right away.
const AIRPORT_VIEW = { zoom: 11, pitch: 55, bearing: 0 };

const searchInput = document.getElementById('airport-search');
const searchResults = document.getElementById('search-results');
const searchStatus = document.getElementById('search-status');

let airportsPromise = null;
let shownResults = [];
let activeIndex = -1;

function loadAirports() {
    if (!airportsPromise) {
        airportsPromise = fetch(AIRPORTS_URL)
            .then(response => response.json())
            .then(prepareAirports)
            .catch(error => {
                airportsPromise = null; // try again next time
                throw error;
            });
    }
    return airportsPromise;
}

function showResults(results) {
    shownResults = results;
    activeIndex = results.length > 0 ? 0 : -1;
    searchResults.replaceChildren(...results.map((airport, index) => {
        const item = document.createElement('li');
        item.id = `search-result-${index}`;
        item.setAttribute('role', 'option');

        const id = document.createElement('span');
        id.className = 'result-id';
        id.textContent = airport.id;
        const name = document.createElement('span');
        name.className = 'result-name';
        name.textContent = airport.name;
        const place = document.createElement('span');
        place.className = 'result-place';
        place.textContent = airport.state ? `${airport.city}, ${airport.state}` : airport.city;
        item.append(id, name, place);

        // mousedown, not click, so picking a result doesn't blur the input first.
        item.addEventListener('mousedown', event => {
            event.preventDefault();
            selectAirport(airport);
        });
        return item;
    }));

    searchResults.hidden = results.length === 0;
    searchInput.setAttribute('aria-expanded', String(results.length > 0));
    highlightActive();
}

function highlightActive() {
    searchResults.querySelectorAll('li').forEach((item, index) => {
        item.setAttribute('aria-selected', String(index === activeIndex));
    });
    if (activeIndex >= 0) {
        searchInput.setAttribute('aria-activedescendant', `search-result-${activeIndex}`);
    } else {
        searchInput.removeAttribute('aria-activedescendant');
    }
}

function closeResults() {
    showResults([]);
    searchStatus.textContent = '';
}

function selectAirport(airport) {
    map.flyTo({ center: [airport.lon, airport.lat], ...AIRPORT_VIEW });
    searchInput.value = `${airport.id} ${airport.name}`;
    closeResults();
    searchInput.blur(); // also closes the on-screen keyboard on phones
}

async function updateSearch() {
    const query = searchInput.value;
    let airports;
    try {
        airports = await loadAirports();
    } catch {
        searchStatus.textContent = "Couldn't load the airport list. Try again.";
        return;
    }
    if (searchInput.value !== query) {
        return; // the user kept typing; a newer search will run
    }

    const results = searchAirports(airports, query);
    showResults(results);
    searchStatus.textContent = results.length === 0 && query.trim().length >= 2
        ? 'No public-use airports match.'
        : '';
}

searchInput.addEventListener('focus', () => {
    loadAirports().catch(() => {});
    if (searchInput.value) {
        updateSearch();
    }
});
searchInput.addEventListener('input', updateSearch);
searchInput.addEventListener('blur', closeResults);

searchInput.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (shownResults.length === 0) {
            return;
        }
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        activeIndex = (activeIndex + step + shownResults.length) % shownResults.length;
        highlightActive();
    } else if (event.key === 'Enter') {
        event.preventDefault();
        if (activeIndex >= 0) {
            selectAirport(shownResults[activeIndex]);
        }
    } else if (event.key === 'Escape') {
        closeResults();
    }
});
