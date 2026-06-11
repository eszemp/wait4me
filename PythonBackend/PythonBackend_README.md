# PythonBackend

This folder contains the Flask backend for the Wait4Me prototype. It provides the passenger request API, stop statistics endpoints, and a hourly cleanup job for expired requests.

## Contents

```text
PythonBackend/
  |- PythonBackend_README.md
  |- backend_app.py
  |- requirements_server.txt
  |- start.sh
  |- .env.example 
  `- helpers/
     |- db_interactions_stop_stats.py
     |- db_interactions_w4m_requests.py
     `- delay_impact_analysis.py
```

- `backend_app.py`: Main Flask application.
- `requirements_server.txt`: Runtime dependencies for local execution and server deployment.
- `start.sh`: Script for starting the backend.
- `.env.example`: Template for the backend environment variables.
- `helpers/`: Database and analysis helper modules used by the backend.

## API endpoints

The flask backend offers the following API endpoints:

- `POST /create-request`: Create a new passenger request.
- `POST /update-request/<request_id>`: Update a request status.
- `GET /get-status/<request_id>`: Fetch the current request status.
- `GET /driver/get-requests?transfer_stop_ref=...&outgoing_service=...`: Fetch pending and cancelled requests for a stop/service pair.
- `GET /get-stops`: Return all stops with transfer data as GeoJSON.
- `GET /get-stop?name=...`: Return one stop by name as GeoJSON.
- `GET /health`: Health check.

## Setup Virtual Environment

1. Create and activate a virtual environment:

```bash
python -m venv venv
source venv/bin/activate
```

2. Install the dependencies:

```bash
pip install -r requirements_server.txt
```

## Create Environment File

Use `.env.example` as a template for the environment file to store OJP API and DB access credentials used by the helpers. Create a file named `.env` with the same structure:

```bash
DB_NAME=wait4me
DB_USER=your_db_user_here
DB_PASSWORD=your_db_password_here
DB_HOST=ikgpgis.ethz.ch
DB_PORT=5432
API_KEY=your_access_token_here
```

## Run the Backend Locally (Dev)

After completing setup, you can run the backend locally on your machine by running:

```bash
python backend_app.py
```

The backend will then listen on `127.0.0.1:8000`. Make sure to change the config of the frontend to point to this backend and not the production one (default). You can do this in `Wait4Me/src/app/shared/config/backend.ts`.


## Deploy Backend on Server (Prod)

For production, the backend is run with Waitress inside a `screen` session with the command:

```bash
source venv/bin/activate
waitress-serve --host=127.0.0.1 --port=8000 backend_app:backend_app
```

There is also the shell script `start.sh` that you can run to automatically start the backend with the following command:

```bash
sh start.sh
```

If you update `backend_app.py`, restart the running backend process by either restarting flask in the screen session or killing the running screen session and starting a new one.

## Notes

- The backend expects the database connection settings and access token to be available in `.env`.
- CORS is enabled in `backend_app.py`.
- A scheduled hourly cleanup job marks expired pending requests as expired.
