# heitan-web

**[Play Heitan in your browser](https://play.seconddeep.com/)**

`heitan-web` contains the public browser-playable Heitan application, including its frontend, automated tests, and Firebase Hosting configuration.

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

Run the automated test suite with:

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

## Analytics

The production application uses Firebase Analytics for a small set of aggregate
product-usage events. Analytics requires a Firebase Web app connected to Google
Analytics and the following Vite environment variables at build time:

```sh
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
VITE_FIREBASE_PROJECT_ID=heitan-web
```

These values are Firebase Web client configuration and are included in the
browser bundle. Do not put service-account credentials or other secrets in
`VITE_` variables.

Analytics is attempted automatically in production when all required values are
present. It is disabled by default during local development. To test Analytics
locally, put the Firebase configuration in `.env.local` and add:

```sh
VITE_FIREBASE_ANALYTICS_ENABLED=true
```

The application records only these events:

| Event | When it is recorded | Parameters |
| --- | --- | --- |
| `page_view` | Automatically by Firebase Analytics when it initializes | Firebase defaults |
| `game_start` | The first successful placement in a game | `board_size` |
| `game_complete` | The first time a game reaches its completed state | `board_size`, `result` |
| `undo` | A placement is successfully undone | `board_size` |
| `board_size_selected` | A board size is confirmed in the New Game dialog | `board_size` |
| `rules_open` | The Rules link is opened | None |

`game_start` and `game_complete` are each recorded at most once per game. Undoing
back to the initial state or undoing after completion does not record either event
again. Starting a New Game creates a new game session and resets those limits.
The `result` value is limited to `black_win`, `white_win`, or `draw`.

No board positions, move histories, score details, player identities, or user
accounts are sent by this integration. Missing configuration, unsupported browser
features, initialization failures, and tracking failures do not block gameplay.

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
test/            Automated tests
index.html       Vite HTML entry point
firebase.json    Firebase Hosting configuration
.firebaserc      Default Firebase project selection
package.json     npm scripts and development dependencies
tsconfig.json    TypeScript configuration
```
