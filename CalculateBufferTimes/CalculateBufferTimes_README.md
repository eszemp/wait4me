# CalculateBufferTimes

This folder contains the Python workspace for the computation of transfer buffer times which are used for the delay impact analysis pipeline.

## Structure

```text
CalculateBufferTimes/
  |- CalculateBufferTimes_README.md
  |- requirements.txt
  |- data/
  `- scripts/
```

The `data/` folder has the following contents:

- `haltestellen-oev_2056_de.gpkg/`: Contains the input data on all stops in Switzerland and their positions (GeoPackage)
- `transfer-time/`: Contains the input data on the minimal required transfer time for each station (Text-File)
- `stop-places-schweiz/`: Left over intermediate files used in the initial calculation of the transfer buffer times (Shapefile/GeoPackage)
- `output/`: Contains the output of the calculation that is then written to the DB. Its a GeoJSON file with all stations, their timeline of transfer buffers as well as precomputed histogram counts of these different buffer times.

The `scripts/` folder has the following contents:

- `01_calculate_buffer_times.py`: Calculates the buffer times.
- `02_analyze_visualize_time_series.ipynb`: Additionally saves histogram counts and visualizes the results.
- `03_write_geojson_to_postgis_db.py`: Writes generated GeoJSON data into PostGIS.
- `helpers/`: Shared helper modules for OJP requests, transfer windows, and logging.

## Setup Virtual Environment

To prepare the environment for the scripts and notebook in `scripts/`:

1. Create a virtual environment:
   ```bash
   python -m venv env
   ```

2. Activate the virtual environment:
   ```bash
   source env/bin/activate
   ```

3. Install the required packages:
   ```bash
   pip install -r requirements.txt
   ```

4. Optional: create a Jupyter kernel for the notebook:
   ```bash
   python -m ipykernel install --user --name buffer-analysis --display-name "Buffer Analysis"
   ```

After that, you can select the "Buffer Analysis" kernel in Jupyter.

## Create Environment File for OJP API Token

Use `scripts/.env.example` as a template for the environment file to store OJP access tokens used by the helpers. Create a file named `.env` in `scripts/` with the same structure:

```bash
OJP_ACCESS_TOKEN=your_access_token_here
DB_NAME=wait4me
DB_USER=your_db_user_here
DB_PASSWORD=your_db_password_here
DB_HOST=ikgpgis.ethz.ch
DB_PORT=5432
```

The helper scripts in `scripts/helpers/` and the file handling the database import load that file automatically.

## Running the Buffer Time Calculation

After a timetable change, the buffer times will need to be recalculated for the next year. 

Because some stop places may have been added, removed or changed their name, we need to update the input data. First, download the GeoPackage with the most current data on public transport stops in Switzerland. Also ensure that the transfer time data is up to date.

In order to run the calculation, first update `START_TIME` in `01_calculate_buffer_times.py` to the first weekday before the timetable change in the target year, then run the script. If you updated the input data, ensure that the correct file names are set. Next, run `02_analyze_visualize_time_series.ipynb` to also save the histogram counts to the GeoJSON in `data/output/`. Finally, run `03_write_geojson_to_postgis_db.py` to update the database with these new buffer times.