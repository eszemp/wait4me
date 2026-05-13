# Wait4Me

This repository contains code and the website for Wait4Me. Under [Wait4Me](https://wait4me.ethz.ch) you find the prototype online.


## Folder structure

```text
wait4me/
|- README.md
|- PythonBackend/
|  |- backend_app.py
|  |- instructions.txt
|  |- requirements_server.txt
|  |- helpers/
|  |  |- db_interactions.py
|  |  |- delay_impact_analysis.py
|  |  `- geofencing.py
|  `- setup/
|     `- create-db-table.py
|- UseCaseStudy/
|  |- requirements.txt
|  |- UseCaseStudy_README.md
|  |- data/
|  |  |- haltestellen-oev_2056_de.gpkg/
|  |  |- output/
|  |  |- stop-places-schweiz/
|  |  |- stop-places-schwyz/
|  |  |- stop-places-vagabond/
|  |  |- tarif-area/
|  |  |- tarifverbundkarte/
|  |  `- transfer-time/
|  |- env/
|  `- scripts/
|     |- 01_preprocess_tarif_area.ipynb
|     |- 02_preprocess_stop_places.ipynb
|     |- 03_calculate_buffer_times.py
|     |- 03_calculate_buffer_times_LOGFILE.txt
|     |- 04_analyze_visualize_time_series.ipynb
|     `- helpers/
`- Wait4Me/
	 |- angular.json
	 |- package.json
	 |- README.md
	 |- public/
	 |  `- map-data/
	 `- src/
			|- app/
			|- environments/
			|- index.html
			|- main.ts
			|- material-theme.scss
			|- styles.css
			`- typings.d.ts
```

## PythonBackend

Backend service for the Wait4Me prototype.

- `backend_app.py`: Main backend entry point (API/service logic).
- `requirements_server.txt`: Python dependencies for running the backend.
- `instructions.txt`: Notes/instructions for backend usage.
- `helpers/`: Reusable backend modules:
	- `db_interactions.py`: Database read/write utilities.
	- `delay_impact_analysis.py`: Logic for delay impact calculations.
	- `geofencing.py`: Geospatial/geofencing helper logic.
- `setup/`: Setup scripts for backend infrastructure:
	- `create-db-table.py`: Creates required database tables.

## UseCaseStudy

Analysis and data-processing workspace for the transport use case.

- `requirements.txt`: Python dependencies for analysis scripts/notebooks.
- `UseCaseStudy_README.md`: Detailed documentation for the use-case workflow.
- `data/`: Input, intermediate, and output geospatial datasets.
	- `haltestellen-oev_2056_de.gpkg/`: Raw stop data package.
	- `stop-places-*`: Stop place shapefiles and derived geopackages.
	- `tarif-area/` and `tarifverbundkarte/`: Tariff area boundaries and merged layers.
	- `transfer-time/`: Transfer-time datasets.
	- `output/`: Generated output files (e.g., geojson histograms).
- `scripts/`: Processing and analysis pipeline.
	- `01_preprocess_tarif_area.ipynb`: Prepare tariff area data.
	- `02_preprocess_stop_places.ipynb`: Prepare stop place data.
	- `03_calculate_buffer_times.py`: Compute buffer/transfer times.
	- `04_analyze_visualize_time_series.ipynb`: Analyze and visualize time series.
	- `helpers/`: Script-specific helper functions.
- `env/`: Local Python virtual environment for reproducible runs.

## Wait4Me

Angular frontend for the public prototype website.

- `package.json`: Frontend dependencies and npm scripts.
- `angular.json`: Angular workspace/project configuration.
- `public/map-data/`: Static map assets served by the frontend.
- `src/`: Frontend source code.
	- `app/`: Main Angular application modules/components.
	- `environments/`: Environment-specific configuration.
	- `main.ts`: Angular bootstrap entry point.
	- `index.html`: Main HTML host page.
	- `styles.css` and `material-theme.scss`: Global styles and Material theme.
	- `typings.d.ts`: TypeScript/global type declarations.
