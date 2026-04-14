import mapboxgl from "mapbox-gl";
import 'mapbox-gl/dist/mapbox-gl.css'



mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_PUBLIC_KEY;
console.log(mapboxgl.accessToken)


const map = new mapboxgl.Map({
    container: 'app', // container ID from index.html
    center: [-122.213473, 37.604249], // starting position
    zoom: 9 // starting zoom
});

// Create polygon
map.on('load', () => {
    map.addSource('square', {
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
    })


    // Display polygon on map on this layer
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
    })

});


