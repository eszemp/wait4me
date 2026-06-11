# Wait4Me

Wait4Me is an application that allows public transport passengers to request a delay for their connection, if they are likely to miss it due to a delay. Drivers can accept or decline this request based on additional information about the impact of this delay. It was developed by Christian Blaser and Estelle Zemp as part of the Geomatics Master Project at ETH Zurich during the Spring Semester 2026. The Wait4Me project is a collaboration with [SKI+](https://www.oev-info.ch/de/organisation/ueber-ski). 

This repository contains the Wait4Me prototype, its Python backend, and the workspace used to calculate the transfer-buffer times which are used in the application. A deployed version of the prototype is publicily available at [wait4me.ethz.ch](https://wait4me.ethz.ch).

## Folder structure

```text
wait4me/
|- README.md
|- CalculateBufferTimes/
|  |- CalculateBufferTimes_README.md
|  |- requirements.txt
|  |- data/
|  |- scripts/
|- PythonBackend/
|  |- PythonBackend_README.md
|  |- backend_app.py
|  |- requirements_server.txt
|  `- helpers/
|     |- db_interactions_stop_stats.py
|     |- db_interactions_w4m_requests.py
|     `- delay_impact_analysis.py
|- Wait4Me/
|  |- Wait4Me_README.md
|  |- angular.json
|  |- package.json
|  |- public/
|  `- src/
|     |- app/
|     |- environments/
|     |- index.html
|     |- main.ts
|     |- material-theme.scss
|     `- styles.css
|- FindTestCases/
|  |- FindTestCases_README.md
|  |- realtime_testcases.py
|  `- testcases.txt
`- package-lock.json
```

## CalculateBufferTimes

Python workspace for the stop-buffer and transfer-time analysis pipeline.

- `CalculateBufferTimes_README.md`: Setup notes for the analysis environment.
- `requirements.txt`: Python dependencies for the analysis scripts and notebooks.
- `data/`: Input data, intermediate layers, and generated outputs.
- `scripts/`: Processing scripts, notebooks, and helpers.


## PythonBackend

Flask API for passenger requests and stop statistics.


- `PythonBackend_README.md`: Setup notes for local and server deployment.
- `backend_app.py`: Main backend entry point.
- `requirements_server.txt`: Runtime dependencies for the backend service.
- `helpers/`: Database and analysis helper modules.


## Wait4Me

Angular frontend for the public prototype.

- `package.json`: Frontend scripts and dependencies.
- `angular.json`: Angular workspace configuration.
- `src/`: Application code, routes, styles, and supporting shims.
- `public/`: Static assets used by the UI.

## FindTestCases

- `FindTestCases_README.md`: Setup notes for script.
- `realtime_testcases.py`: Script that finds currently delayed services and connections with broken transfers.
- `testcases.txt`: Result of the script (possible routes with broken connections).

## License

This project is licensed under the MIT License. See the LICENSE file for details.
