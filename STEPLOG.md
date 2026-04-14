# Steps In Order

1. Created and populated README.md with project details.
2. Downloaded FAA 28 day NASR Subscription Data into root directory.
3. Created Vite with Vanilla template.
4. Installed Mapbox library with npm ("npm install mapbox-gl").
5. Ensured mapbox dependency is saved in package.json.
6. Deleted all Vite starter content from main.js.
7. Imported mapboxgl and its CSS in main.js.
8. Created div with id="app" and width, height set in index.html.
9. Added access token to main.js.
10. Created new mapboxgl Map object to render basic map in browser.
11. ISSUE: Map not loading in broswer right now. Don't know why.
12. Added mapbox-gl.css as an external stylesheet link in index.html. Not sure if this is needed.
13. ISSUE: Getting error ("An API access token is required") in browser console. However, token is set in main.js. Weird.
14. BRUHHH I found the issue. I had made a typo in defining accessToken. I wrote "accesToken" with one "s". Anyway...
15. Now the map displays on the browser
16. Set lon/lat to have the center in the SF bay area.
17. Create .env and transfer mapbox key to it. .gitignore.
18. Commit and push
19. Start building a base example 2D polygon in main.js.
20. Polygon built and displayed using addLayer().
21. Created another polygon of different color over SFO.
22. Commit and push.