# CalculateBufferTimes

This folder contains the Python workspace for the buffer-time and transfer-time analysis pipeline.

## Setup

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

## OJP API token

Create a file named `.env` in `scripts/` with this content:

```bash
OJP_ACCESS_TOKEN=your_access_token_here
```

The helper scripts in `scripts/helpers/` load that file automatically.

## Contents

- `01_calculate_buffer_times.py`: Calculates the buffer times.
- `02_analyze_visualize_time_series.ipynb`: Explores and visualizes the results.
- `03_write_geojson_to_postgis_db.py`: Writes generated GeoJSON data into PostGIS.
- `helpers/`: Shared helper modules for OJP requests, transfer windows, and logging.