# Wait4Me Frontend

This folder contains the Angular frontend for the Wait4Me prototype. It provides the public home page, passenger interface, driver interface, and the delay impact analysis.

## Contents

```text
Wait4Me/
 |- Wait4Me_README.md
 |- angular.json
 |- package.json
 |- public/
 `- src/
    |- app/
    |- environments/
    |- index.html
    |- main.ts
    |- material-theme.scss
    `- styles.css
```

- `angular.json`: Angular workspace configuration.
- `package.json`: Frontend dependencies and npm scripts.
- `public/`: Static SVG assets used across the UI.
- `src/app/`: Application code, routed feature areas, and shared utilities.
- `src/environments/`: Environment configuration for local and deployed builds.

## Subpages of the WebApp

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

## Environment file

The frontend reads API settings from `src/environments/environments.ts`.

Use `src/environments/environments.example.ts` as a template:

Then update the `apiKey` value in `environments.ts` with your valid key before starting the app.

## Request Restriction Config

Passenger request eligibility is configured in `src/app/shared/config/w4m-request-config.ts`.

The current values are intentionally testing friendly, so they allow generous timing windows and relaxed checks. For a real-world deployment, these settings should be adapted to stricter operational rules and the actual service constraints.

## Run the App Locally (Dev)

Start the app locally with:

```bash
npm start
```

This runs `ng serve` and serves the app on `http://localhost:4200/`.

## Build and Deploy on Server (Prod)

Create a production build with:

```bash
npm run build
```
or by running the following command:

```bash
ng build
```

The build output is written to `Wait4Me/dist/`. Navigate to it and copy it to the server to deploy the new version on [wait4me.ethz.ch](https://wait4me.ethz.ch):

```bash
cd Wait4Me/dist/Wait4Me
scp -r ./browser/* w3_wait4meprd@wait4me.ethz.ch:~/htdocs/
```
