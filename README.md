# heitan-web

`heitan-web` is the web application for a browser-playable version of Heitan. This repository provides the frontend and deployment foundation for the game.

Heitan's canonical rules and Ludii implementation live in [`seconddeep/heitan-ludii`](https://github.com/seconddeep/heitan-ludii). Refer to that repository when implementing or changing game behavior instead of redefining the rules here.

## Technology stack

- Vite
- TypeScript
- HTML and CSS
- Firebase Hosting

## Local development

Install [Node.js](https://nodejs.org/) and npm, then run:

```sh
npm install
npm run dev
```

Vite prints the local development URL and reloads the app as source files change.

## Production build

```sh
npm run build
```

This runs the TypeScript compiler and creates the production site in `dist/`. To inspect the build locally, run `npm run preview`.

## Firebase deployment

Firebase Hosting is configured in `firebase.json` to serve `dist/` and rewrite application routes to `index.html`. The default Firebase project in `.firebaserc` is `heitan-web`.

After installing and authenticating the [Firebase CLI](https://firebase.google.com/docs/cli), build and deploy the site:

```sh
npm run build
firebase deploy --only hosting
```

## Project structure

```text
public/          Static assets copied into the build
src/             TypeScript, styles, and imported assets
index.html       Vite HTML entry point
firebase.json    Firebase Hosting configuration
.firebaserc      Default Firebase project selection
package.json     npm scripts and development dependencies
tsconfig.json    TypeScript configuration
```
