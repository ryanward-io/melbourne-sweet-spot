# Melbourne Sweet Spot

I built this to help with house-hunting: a map of the parts of Melbourne where the things you want are all within walking distance.

**Live: https://ryanward.dev/melbourne-sweet-spot/**

Pick who's moving, or set your own filters for a supermarket, train station, park, schools, gyms and a budget, and how far you'd walk to each. The map shows the sweet spots of residential land that tick every box, and tapping anywhere shows what's close. More filters cover cafés, restaurants, pubs, GPs, pharmacies, childcare, libraries, tram stops, public pools, beaches and keeping away from schools. Personas such as Young family and Couple, no kids set everything at once.

## How it works

Walking distances are measured along the real path network from OpenStreetMap, not in straight lines (except "Away from schools", which is about noise and traffic, so it is straight-line). Distances to each type of place are precalculated on a roughly 50 m grid, stored in 20 m steps from each cell's centre and capped at about 5 km. All the filtering runs in the browser on static files, with no server, and only the grids your filters need get downloaded.

Distances were spot-checked against 60 OSRM walking routes, with a median difference of about 26 m.

## Limits

Listings can be out of date, and being close to something says nothing about how good it is. A home near a school isn't guaranteed a place there, so check zones with the school or Find My School. Budget uses suburb medians, so a family home will often cost more than the median.

## Data

Built from OpenStreetMap (ODbL, 4 November 2026), Overture Maps (October 2026 release), and State of Victoria data under CC BY 4.0: Vicmap, the Department of Education, Public Transport Victoria, Homes Victoria and the Valuer-General Victoria. High school rankings are Better Education's 2025 list, and gyms were checked against each chain's or gym's own website on 6 November 2026. Full credits are in the app under "About and data". The map data stays under its original licences.

The scripts that build the data files aren't in this repo yet.
