# heitan-web

`heitan-web` is a browser-playable version of Heitan. It currently uses Vite with TypeScript and is hosted on Firebase Hosting.

## Local development

Install dependencies:

```sh
npm install
```

Start the development server:

```sh
npm run dev
```

## Build

Create a production build:

```sh
npm run build
```

The build output is written to `dist/`.

## Deployment

Before deploying, make sure the Firebase CLI is logged in and connected to the `heitan` Firebase project (project ID: `heitan-cdc49`).

After creating a production build, deploy it with:

```sh
firebase deploy
```

Firebase Hosting serves `dist/`, the Vite build output directory.
