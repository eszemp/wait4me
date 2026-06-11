# Wait4Me

This repository contains the Wait4Me prototype, its Python backend, and the buffer-analysis workspace used to generate the transfer-buffer times. The public prototype is available at [wait4me.ethz.ch](https://wait4me.ethz.ch).

## Folder structure

```text
wait4me/
|- README.md
|- CalculateBufferTimes/
|  |- requirements.txt
|  |- CalculateBufferTimes_README.md
|  |- data/
|  |- scripts/
|  `- scripts/.env.example
|- PythonBackend/
|  |- backend_app.py
|  |- instructions.txt
|  |- PythonBackend_README.md
|  |- requirements_server.txt
|  `- helpers/
|     |- db_interactions_stop_stats.py
|     |- db_interactions_w4m_requests.py
|     `- delay_impact_analysis.py
|- Wait4Me/
|  |- angular.json
|  |- package.json
|  |- Wait4Me_README.md
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
- `CalculateBufferTimes_README.md`: Setup notes for the analysis environment.
- `data/`: Input data, intermediate layers, and generated outputs.
- `scripts/`: Processing scripts, notebooks, and helpers.
- `scripts/.env.example`: Template for the OJP access token used by the helpers.


## PythonBackend

Flask API for passenger requests and stop statistics.

- `backend_app.py`: Main backend entry point.
- `requirements_server.txt`: Runtime dependencies for the backend service.
- `instructions.txt`: Notes for local and server deployment.
- `PythongBackend_README.md`: Setup notes for local and server deployment.
- `helpers/`: Database and analysis helper modules.


## Wait4Me

Angular frontend for the public prototype.

- `package.json`: Frontend scripts and dependencies.
- `angular.json`: Angular workspace configuration.
- `src/`: Application code, routes, styles, and supporting shims.
- `public/`: Static assets used by the UI.
