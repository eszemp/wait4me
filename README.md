# Wait4Me

This repository contains the Wait4Me prototype, its Python backend, and the buffer-analysis workspace used to generate the transfer-buffer times. The public prototype is available at [wait4me.ethz.ch](https://wait4me.ethz.ch).

## Folder structure

```text
wait4me/
|- README.md
|- CalculateBufferTimes/
|  |- requirements.txt
|  |- UseCaseStudy_README.md
|  |- data/
|  |- scripts/
|  `- scripts/.env.example
|- PythonBackend/
|  |- backend_app.py
|  |- instructions.txt
|  |- requirements_server.txt
|  `- helpers/
|     |- db_interactions_stop_stats.py
|     |- db_interactions_w4m_requests.py
|     `- delay_impact_analysis.py
|- Wait4Me/
|  |- angular.json
|  |- package.json
|  |- README.md
|  |- public/
|  `- src/
|     |- app/
|     |- environments/
|     |- index.html
|     |- main.ts
|     |- material-theme.scss
|     |- styles.css
|     `- shims/
`- package-lock.json
```

## CalculateBufferTimes

Python workspace for the stop-buffer and transfer-time analysis pipeline.

- `requirements.txt`: Python dependencies for the analysis scripts and notebooks.
- `UseCaseStudy_README.md`: Setup notes for the analysis environment.
- `data/`: Input data, intermediate layers, and generated outputs.
- `scripts/`: Processing scripts, notebooks, and helpers.
- `scripts/.env.example`: Template for the OJP access token used by the helpers.

Typical setup:

```bash
cd CalculateBufferTimes
python -m venv env
source env/bin/activate
pip install -r requirements.txt
```

If you use the OJP API helpers, copy `scripts/.env.example` to `scripts/.env` and set `OJP_ACCESS_TOKEN`.

## PythonBackend

Flask API for passenger requests and stop statistics.

- `backend_app.py`: Main backend entry point.
- `requirements_server.txt`: Runtime dependencies for the backend service.
- `instructions.txt`: Notes for local and server deployment.
- `helpers/`: Database and analysis helper modules.

Typical local run:

```bash
cd PythonBackend
python -m venv venv
source venv/bin/activate
pip install -r requirements_server.txt
python backend_app.py
```

The backend expects its database and API configuration in a local `.env` file.

## Wait4Me

Angular frontend for the public prototype.

- `package.json`: Frontend scripts and dependencies.
- `angular.json`: Angular workspace configuration.
- `src/`: Application code, routes, styles, and supporting shims.
- `public/`: Static assets used by the UI.

Typical frontend workflow:

```bash
cd Wait4Me
npm install
npm start
```

Build and test commands:

```bash
npm run build
npm test
```

## Notes

- `PythonBackend/` and `CalculateBufferTimes/` each manage their own Python environment.
- The frontend build output is written to `Wait4Me/dist/`.
- Generated analysis outputs are stored under `CalculateBufferTimes/data/output/`.
