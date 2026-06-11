# Wait4Me Frontend

This folder contains the Angular frontend for the Wait4Me prototype. It provides the public home page, passenger interface, driver interface, and the delay impact analysis.

## Contents

- `angular.json`: Angular workspace configuration.
- `package.json`: Frontend dependencies and npm scripts.
- `src/app/`: Application code, routed feature areas, and shared utilities.
- `public/`: Static SVG assets used across the UI.
- `src/environments/`: Environment configuration for local and deployed builds.

The main routes are defined in `src/app/app.routes.ts`:

- `/`: Home screen
- `/passenger`: Passenger interface
- `/passenger/connection-details`: Passenger connection details
- `/passenger/walking-route`: Passenger walking route
- `/driver`: Driver interface
- `/driver/connection-details`: Driver connection details
- `/delay-impact-analysis`: Delay impact analysis view

## Local setup

1. Use the Node.js version from `.nvmrc`.
2. Install dependencies:

```bash
npm install
```

If you want the exact lockfile state, use `npm ci` instead.

## Development server

Start the app locally with:

```bash
npm start
```

This runs `ng serve` and serves the app on `http://localhost:4200/`.

## Build

Create a production build with:

```bash
npm run build
```

The build output is written to `dist/`.

## Tests

Run the frontend test suite with:

```bash
npm test
```
