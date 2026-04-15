import mapboxgl from "mapbox-gl";
import 'mapbox-gl/dist/mapbox-gl.css'



mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_PUBLIC_KEY;


const map = new mapboxgl.Map({
    container: 'app', // container ID from index.html
    center: [-122.213473, 37.604249], // starting position
    zoom: 9, // starting zoom
    style: 'mapbox://styles/mapbox/light-v11'
});

// Create polygon
map.on('load', () => {


    // Hayward airspace data source.
    map.addSource('HAYWARD', {
        'type': 'geojson',
        'data': "/data/HWD_Airspace.geojson"
    })

    // Oakland airspace data source.
    map.addSource('OAKLAND', {
        'type': 'geojson',
        'data': "/data/OAK_Airspace.geojson"
    })

    // San Francisco airspace data source.
    map.addSource('SAN_FRANCISCO', {
        'type': 'geojson',
        'data': "/data/SFO_Airspace.geojson"
    })

    // San Jose airspace data source.
    map.addSource('SAN_JOSE', {
        'type': 'geojson',
        'data': "/data/SJC_Airspace.geojson"
    })

    // Reid-Hillview airspace data source.
    map.addSource('REID_HILLVIEW', {
        'type': 'geojson',
        'data': "/data/RHV_Airspace.geojson"
    })

    // Livermore airspace data source.
    map.addSource('LIVERMORE', {
        'type': 'geojson',
        'data': "/data/LVK_Airspace.geojson"
    })

    // Palo Alto airspace data source.
    map.addSource('PALO_ALTO', {
        'type': 'geojson',
        'data': "/data/PAO_Airspace.geojson"
    })

    // Palo Alto airspace data source.
    map.addSource('MONTEREY', {
        'type': 'geojson',
        'data': "/data/MRY_Airspace.geojson"
    })

    // Napa airspace data source.
    map.addSource('NAPA', {
        'type': 'geojson',
        'data': "/data/APC_Airspace.geojson"
    })

    // Concord airspace data source.
    map.addSource('CONCORD', {
        'type': 'geojson',
        'data': "/data/CCR_Airspace.geojson"
    })

    // Modesto airspace data source.
    map.addSource('MODESTO', {
        'type': 'geojson',
        'data': "/data/MOD_Airspace.geojson"
    })

    // San Carlos airspace data source.
    map.addSource('SAN_CARLOS', {
        'type': 'geojson',
        'data': "/data/SQL_Airspace.geojson"
    })

    // Sacramento SMF airspace data source.
/*    map.addSource('SACRAMENTO', {
        'type': 'geojson',
        'data': "data/SMF_Airspace.geojson"
    })*/


/*    map.addSource('square', {
        'type': 'geojson',
        'data': {
            'type': 'Feature',
            'geometry': {
                'type': 'Polygon',
                'coordinates': [
                    [
                        [-122.2902704285912,37.74147722471672],
                        [-122.2080345060424,37.600228845796],
                        [-122.0855723645021,37.59703533308231],
                        [-122.0186539420902,37.63689969266525],
                        [-122.0010909450218,37.71646253548609],
                        [-122.1067951845817,37.70803649414341],
                        [-122.1846146210758,37.7359494186303],
                        [-122.1738690504987,37.78847517668635],
                        [-122.2902704285912,37.74147722471672],
                    ]
                ]
            }
        }
    });

    //polygon over SFO
    map.addSource('sfo', {
        'type': 'geojson',
        'data': {
            'type': 'Feature',
            'geometry': {
                'type': 'Polygon',
                'coordinates': [
                    [
                        [-122.3448504900793,37.68101509612175],
                        [-122.3947276382949,37.67937904481626],
                        [-122.43595232439,37.66285346641784],
                        [-122.4405496634032,37.63418790358055],
                        [-122.4229664995798,37.60303719904559],
                        [-122.3741243346752,37.58715950503361],
                        [-122.3264471639509,37.58994086753795],
                        [-122.3096880399944,37.61440645277018],
                        [-122.3238731588524,37.65728881028559],
                        [-122.3448504900793,37.68101509612175],
                    ]
                ]
            }
        }
    })*/


/*    // Display polygon on map on this layer
    map.addLayer({
        'id': 'square',
        'type': 'fill',
        'source': 'square', // reference the data source above
        'layout': {},
        'paint': {
            'fill-color': '#0080ff', //blue
            'fill-opacity': 0.5
        }

    });

    //display sfo polygon
    map.addLayer({
        'id': 'sfo',
        'type': 'fill',
        'source': 'sfo',
        'layout': {},
        'paint': {
            'fill-color': '#e36259',
            'fill-opacity': 0.5
        }
    })*/

    // Display HAYWARD data 2D
/*    map.addLayer({
        'id': 'HAYWARD DISPLAYER',
        'type': 'fill',
        'source': 'HAYWARD',
        'layout': {},
        'paint': {
            'fill-color': '#196980',
            'fill-opacity': 0.5
        }
    })*/
    // Display HAYWARD data 3D
    map.addLayer({
        'id': 'HAYWARD_3D',
        'type': 'fill-extrusion',
        'source': 'HAYWARD',
        'layout': {},
        'filter': ['!=', ['get', 'CLASS'], 'E'],
        'paint': {
            'fill-extrusion-color': '#196980',
            'fill-extrusion-base': ["to-number", ['get', 'LOWER_VAL']],
            'fill-extrusion-height': ["to-number", ['get', 'UPPER_VAL']],
            'fill-extrusion-opacity': 0.5
        }

    })

    // Display OAKLAND data 3D
    map.addLayer({
        'id': 'OAKLAND_3D',
        'type': 'fill-extrusion',
        'source': 'OAKLAND',
        'layout': {},
        'filter': ['!=', ['get', 'CLASS'], 'E'],
        'paint': {
            'fill-extrusion-color': '#a5778c',
            'fill-extrusion-base': ["to-number", ['get', 'LOWER_VAL']],
            'fill-extrusion-height': ["to-number", ['get', 'UPPER_VAL']],
            'fill-extrusion-opacity': 0.5
        }
    })

    // Display SAN FRANCISCO data 3D
    map.addLayer({
        'id': 'SAN_FRANCISCO_3D',
        'type': 'fill-extrusion',
        'source': 'SAN_FRANCISCO',
        'layout': {},
        'filter': ['!=', ['get', 'CLASS'], 'E'],
        'paint': {
            'fill-extrusion-color': '#052c6e',
            'fill-extrusion-base': ["to-number", ['get', 'LOWER_VAL']],
            'fill-extrusion-height': ["to-number", ['get', 'UPPER_VAL']],
            'fill-extrusion-opacity': 0.5
        }
    })

    // Display SAN JOSE data 3D
    map.addLayer({
        'id': "SAN_JOSE_3D",
        'type': 'fill-extrusion',
        'source': 'SAN_JOSE',
        'layout': {},
        'filter': ['!=', ['get', 'CLASS'], 'E'],
        'paint': {
            'fill-extrusion-color': '#a5778c',
            'fill-extrusion-base': ["to-number", ['get', 'LOWER_VAL']],
            'fill-extrusion-height': ["to-number", ['get', 'UPPER_VAL']],
            'fill-extrusion-opacity': 0.5
        }
    })

    // Display REID HILLVIEW data 3D
    map.addLayer({
        'id': "REID_HILLVIEW_3D",
        'type': 'fill-extrusion',
        'source': 'REID_HILLVIEW',
        'layout': {},
        'filter': ['!=', ['get', 'CLASS'], 'E'],
        'paint': {
            'fill-extrusion-color': '#196980',
            'fill-extrusion-base': ["to-number", ['get', 'LOWER_VAL']],
            'fill-extrusion-height': ["to-number", ['get', 'UPPER_VAL']],
            'fill-extrusion-opacity': 0.5
        }
    })

    // Display LIVERMORE data 3D
    map.addLayer({
        'id': 'LIVERMORE_3D',
        'type': 'fill-extrusion',
        'source': 'LIVERMORE',
        'layout': {},
        'filter': ['!=', ['get', 'CLASS'], 'E'],
        'paint': {
            'fill-extrusion-color': '#196980',
            'fill-extrusion-base': ["to-number", ['get', 'LOWER_VAL']],
            'fill-extrusion-height': ["to-number", ['get', 'UPPER_VAL']],
            'fill-extrusion-opacity': 0.5
        }
    })

    // Display PALO ALTO data 3D
    map.addLayer({
        'id': 'PALO_ALTO_3D',
        'type': 'fill-extrusion',
        'source': 'PALO_ALTO',
        'layout': {},
        'filter': ['!=', ['get', 'CLASS'], 'E'],
        'paint': {
            'fill-extrusion-color': '#196980',
            'fill-extrusion-base': ["to-number", ['get', 'LOWER_VAL']],
            'fill-extrusion-height': ["to-number", ['get', 'UPPER_VAL']],
            'fill-extrusion-opacity': 0.5
        }
    })

    // Display MONTEREY data 3D
    map.addLayer({
        'id': 'MONTEREY_3D',
        'type': 'fill-extrusion',
        'source': 'MONTEREY',
        'layout': {},
        'filter': ['!=', ['get', 'CLASS'], 'E'],
        'paint': {
            'fill-extrusion-color': '#a5778c',
            'fill-extrusion-base': ["to-number", ['get', 'LOWER_VAL']],
            'fill-extrusion-height': ["to-number", ['get', 'UPPER_VAL']],
            'fill-extrusion-opacity': 0.5
        }
    })

    // Display NAPA data 3D
    map.addLayer({
        'id': 'NAPA_3D',
        'type': 'fill-extrusion',
        'source': 'NAPA',
        'layout': {},
        'filter': ['!=', ['get', 'CLASS'], 'E'],
        'paint': {
            'fill-extrusion-color': '#196980',
            'fill-extrusion-base': ["to-number", ['get', 'LOWER_VAL']],
            'fill-extrusion-height': ["to-number", ['get', 'UPPER_VAL']],
            'fill-extrusion-opacity': 0.5
        }
    })

    // Display CONCORD data 3D
    map.addLayer({
        'id': 'CONCORD_3D',
        'type': 'fill-extrusion',
        'source': 'CONCORD',
        'layout': {},
        'filter': ['!=', ['get', 'CLASS'], 'E'],
        'paint': {
            'fill-extrusion-color': '#196980',
            'fill-extrusion-base': ["to-number", ['get', 'LOWER_VAL']],
            'fill-extrusion-height': ["to-number", ['get', 'UPPER_VAL']],
            'fill-extrusion-opacity': 0.5
        }
    })

    // Display MODESTO data 3D
    map.addLayer({
        'id': 'MODESTO_3D',
        'type': 'fill-extrusion',
        'source': 'MODESTO',
        'layout': {},
        'filter': ['!=', ['get', 'CLASS'], 'E'],
        'paint': {
            'fill-extrusion-color': '#196980',
            'fill-extrusion-base': ["to-number", ['get', 'LOWER_VAL']],
            'fill-extrusion-height': ["to-number", ['get', 'UPPER_VAL']],
            'fill-extrusion-opacity': 0.5
        }
    })

    // Display SAN CARLOS data 3D
    map.addLayer({
        'id': 'SAN_CARLOS_3D',
        'type': 'fill-extrusion',
        'source': 'SAN_CARLOS',
        'layout': {},
        'filter': ['!=', ['get', 'CLASS'], 'E'],
        'paint': {
            'fill-extrusion-color': '#196980',
            'fill-extrusion-base': ["to-number", ['get', 'LOWER_VAL']],
            'fill-extrusion-height': ["to-number", ['get', 'UPPER_VAL']],
            'fill-extrusion-opacity': 0.5
        }
    })

    // Display SACRAMENTO SMF data 3D
/*    map.addLayer({
        'id': 'SACRAMENTO_3D',
        'type': 'fill-extrusion',
        'source': 'SACRAMENTO',
        'layout': {},
        'filter': ['!=', ['get', 'CLASS'], 'E'],
        'paint': {
            'fill-extrusion-color': '#a5778c',
            'fill-extrusion-base': ["to-number", ['get', 'LOWER_VAL']],
            'fill-extrusion-height': ["to-number", ['get', 'UPPER_VAL']],
            'fill-extrusion-opacity': 0.5
        }
    })*/

});


