# Melbourne Sweet Spot

An interactive map for finding the parts of Melbourne where the things you want are all within walking distance.

**Live: https://ryanward.dev/melbourne-sweet-spot/**

Pick what matters, such as a supermarket, train station, park, schools and gyms, and set how far you'd walk to each. The map shows the pockets of residential land that meet every filter, and tapping anywhere shows what's nearest. Optional filters cover cafés, restaurants, pubs, GPs, pharmacies, childcare, libraries, tram stops, public pools and beaches. There's a lower-crime filter, and personas such as Young family and DINKs set everything at once.

## How it works

Walking distances are measured along the real path network from OpenStreetMap, not in straight lines. Distances to each type of place are precalculated on a roughly 50 m grid, so all the filtering runs in the browser on static files, with no server.

Distances were spot-checked against 60 OSRM walking routes, with a median difference of about 26 m.

## Limits

Listings can be out of date, and proximity says nothing about quality. A home near a school isn't guaranteed a place there, so check zones with the school or Find My School.

## Data

Built from OpenStreetMap (ODbL), Overture Maps, Vicmap, the Victorian Department of Education, Public Transport Victoria, the Crime Statistics Agency, the ABS, Homes Victoria, Better Education and gym operators' own websites. Full credits are in the app. The map data stays under its original licences.
