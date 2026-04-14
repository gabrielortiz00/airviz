import mapboxgl from "mapbox-gl";
import 'mapbox-gl/dist/mapbox-gl.css'


mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_PUBLIC_KEY;
console.log(mapboxgl.accessToken)


const map = new mapboxgl.Map({
    container: 'app', // container ID from index.html
    center: [-122.213473, 37.604249], // starting position
    zoom: 9 // starting zoom
});
