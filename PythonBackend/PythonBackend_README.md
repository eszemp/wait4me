# PythonBackend

This folder contains the Flask backend for the Wait4Me prototype. It provides the passenger request API, stop statistics endpoints, and the hourly cleanup job for expired requests.

## Contents

- `backend_app.py`: Main Flask application.
- `requirements_server.txt`: Runtime dependencies for local execution and server deployment.
- `instructions.txt`: Deployment and operational notes.
- `helpers/`: Database and analysis helper modules used by the backend.
- `.env.example`: Template for the backend environment variables.

## Local setup

1. Create and activate a virtual environment:

```bash
python -m venv venv
source venv/bin/activate
```

2. Install the dependencies:

```bash
pip install -r requirements_server.txt
```

3. Create a local `.env` file in this folder and populate it with the database credentials and API token used by the helpers. Use `.env.example` as the starting point.

4. Start the backend:

```bash
python backend_app.py
```

The server listens on `127.0.0.1:8000`.

## API endpoints

- `POST /create-request`: Create a new passenger request.
- `POST /update-request/<request_id>`: Update a request status.
- `GET /get-status/<request_id>`: Fetch the current request status.
- `GET /driver/get-requests?transfer_stop_ref=...&outgoing_service=...`: Fetch pending and cancelled requests for a stop/service pair.
- `GET /get-stops`: Return all stops with transfer data as GeoJSON.
- `GET /get-stop?name=...`: Return one stop by name as GeoJSON.
- `GET /health`: Health check endpoint.

## Server deployment

For production, the backend is typically run with Waitress inside a `screen` session:

```bash
python3 -m pip install -r PythonBackend/requirements_server.txt
waitress-serve --host=127.0.0.1 --port=8000 backend_app:backend_app
```

If you update `backend_app.py`, restart the running backend process.

## Notes

- The backend expects the database connection settings and access token to be available in `.env`.
- CORS is enabled in `backend_app.py`.
- A scheduled hourly cleanup job marks expired pending requests as expired.
