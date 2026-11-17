# Green-space map layer

The optional **Show green spaces / แสดงพื้นที่สีเขียว** map control displays 31 curated park and recreation destinations across Bangkok. It is off on initial load. Tree markers have names above them; overlapping labels collapse until zoomed or focused. Selecting a tree zooms to the park and opens its name and source link. **View all parks on map** fits the camera to the selected destinations.

This is a selection of major destinations, not an inventory of every green parcel, nor a guarantee of opening hours or unrestricted access. Private housing-estate gardens are not automatically imported.

Selecting a tree also displays the original OSM polygon with a green outline and translucent fill, and fits the camera to its bounds. The popup shows approximate square metres and rai (1 rai = 1,600 m²). Area is calculated on a sphere with radius 6,371,008.8 m, subtracting interior rings; it is not a cadastral survey. Closing the popup or hiding parks clears the boundary. A selected boundary is restored after a basemap style change.

## Sources and maintenance

- Names, geometry and OSM identifiers come from the repository's `data/raw/greenery.geojson` snapshot, © OpenStreetMap contributors, [ODbL](https://www.openstreetmap.org/copyright).
- The BMA Environment Department's [park list](https://greenoffice.bangkok.go.th/loikrathong/) is a reference for selecting public-park destinations. Additional destinations include Suan Luang Rama IX, Queen Sirikit Park, Chulalongkorn University Centenary Park and Chao Phraya Sky Park.
- `frontend/scripts/export-green-spaces.mjs` records the curated names and generates the checked-in `frontend/src/lib/green-spaces.json` (JSON to stdout). Re-run it after updating the raw source and review changes before replacing the dataset.
- Coordinates use polygon centroids. For concave shapes or centroids inside holes, a refined interior point maximizes clearance from the boundaries. The tree icon is centered on this point. These are map-label positions, not entrance or navigation coordinates.

The layer is local and needs no additional API key or network request. DOM markers remain mounted when the basemap style changes. Turning the layer off removes markers, its popup and camera listeners. Thai proper names are retained in the English interface.

## Illustrative 3D trees

When a park is selected in 3D Buildings mode, deterministic low-poly trees appear within its mapped boundary (up to 360 per park). The local `/data/park-trees.json` file is fetched on demand. `backend/scripts/generate_park_trees.py` generates candidate positions in EPSG:32647, excludes water and building footprints from the local snapshot, and reserves a 2 m margin beyond each canopy with at least 10 m between trunks. The runtime also checks loaded OpenMapTiles building and water polygons against each whole canopy. Trees wait for tiles to load and refresh after camera movement; returning to 2D or clearing the park removes them. With the green-space layer enabled, switching to 3D preserves the current map location.

The trees are decorative simulations, not surveyed tree locations. Exclusions depend on mapped water/building coverage; missing source geometry cannot be detected. No external tree-model service is required.
