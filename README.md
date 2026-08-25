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

## Tests

Run the focused domain-model tests with:

```sh
npm test
```

## Board geometry

Board geometry lives in `src/game/board-geometry.ts` and has no rendering or
game-rule dependencies. Supply Points and Objectives are stored as two-dimensional
row/column arrays. Array indices are zero-based: rows increase from top to bottom
and columns increase from left to right. Supply Points use
`supplyPoints[row][column]`, while Objectives use `objectives[row][column]`.
This directly represents the logical layout documented in
[`heitan-ludii/docs/board.md`](https://github.com/seconddeep/heitan-ludii/blob/main/docs/board.md)
without reproducing Ludii's graph, vertex index, or named-region structures.

The four Supply Points connected to an Objective are derived from the
Objective's row and column in top-left, top-right, bottom-left, and bottom-right
order. The model does not store `Sxy` / `Oxy` identifiers, connectivity IDs,
Ludii vertex indices, or rendering coordinates.

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
test/            Domain-model tests
index.html       Vite HTML entry point
firebase.json    Firebase Hosting configuration
.firebaserc      Default Firebase project selection
package.json     npm scripts and development dependencies
tsconfig.json    TypeScript configuration
```
