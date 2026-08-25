# AGENTS.md

## Project overview

`heitan-web` is the frontend repository for a browser-playable version of Heitan. The project uses Vite and TypeScript and is deployed through Firebase Hosting. It is currently in an early implementation stage.

Keep this repository focused on the browser experience and its supporting frontend code. Do not infer that planned features already exist from the repository's purpose.

## Sources of truth

- This repository is the source of truth for the web application, frontend behavior, build setup, and Firebase Hosting configuration.
- [`seconddeep/heitan-ludii`](https://github.com/seconddeep/heitan-ludii) is the source of truth for canonical Heitan rules and the Ludii implementation.
- The issue being implemented and any explicitly linked design documents define the scope and acceptance criteria for that change.

Do not invent or independently redefine Heitan rules in this repository. When implementing or changing game behavior, consult the canonical rules and Ludii implementation in `seconddeep/heitan-ludii`. If the web implementation, an issue, and the source-of-truth rules disagree, identify and report the discrepancy before changing behavior; do not silently choose or reconcile one interpretation.

## Development principles

- Keep changes scoped to the issue and avoid speculative features or abstractions.
- Prefer simple browser-native solutions unless a dependency provides clear value.
- Preserve the separation between game rules, presentation, and platform or deployment concerns as those areas are introduced.
- Keep the application usable with standard Vite workflows.
- Update documentation when commands, structure, or operational requirements change.
- Do not commit generated output or local state such as `dist/`, `node_modules/`, or `.firebase/`.

## Current project structure

```text
public/          Static assets copied into the build unchanged
src/             Application TypeScript, CSS, and imported assets
  main.ts        Current application entry point
  counter.ts     Vite starter counter module
  style.css      Current application styles
  assets/        Assets imported by application modules
index.html       Vite HTML entry point
firebase.json    Firebase Hosting configuration
.firebaserc      Default Firebase project (`heitan-web`)
package.json     npm scripts and development dependencies
tsconfig.json    TypeScript compiler configuration
```

The files under `src/` contain the application implementation. Do not document planned Heitan functionality as completed.

## Coding and naming conventions

- Use TypeScript for application logic and keep compiler checks passing.
- Follow the established formatting in nearby files: two-space indentation, double quotes in TypeScript, and semicolons.
- Use `camelCase` for variables and functions, `PascalCase` for types and classes, and descriptive lowercase file names. Use kebab-case for multiword file names unless an introduced framework has a stronger convention.
- Prefer explicit types at module boundaries and for game-domain data; allow local inference where the type is clear.
- Keep DOM selectors, asset paths, and user-visible text intentional and accessible. Use semantic HTML and provide appropriate alternative text or ARIA attributes.
- Avoid adding global dependencies, configuration, or conventions for unrelated SecondDeep repositories.

## Changes affecting Heitan game logic

Before implementing or changing rules, move legality, turn flow, board setup, scoring, or end conditions:

1. Locate the corresponding canonical rule or Ludii behavior in `seconddeep/heitan-ludii`.
2. Record any ambiguity or discrepancy in the issue or change description before proceeding.
3. Translate the confirmed behavior into testable web-domain logic without coupling it to rendering.
4. Add tests that cover the affected rule, edge cases, and any confirmed regression.

Do not treat visual behavior, an existing web bug, or an agent's assumptions as authority for the rules.

## Testing expectations

- Run `npm run build` for every code or configuration change. It performs TypeScript checking before the Vite production build.
- There is currently no automated test script. When application logic is added, introduce focused tests as part of that work and document the command in `package.json` and `README.md`.
- Manually verify user-visible changes in the Vite development server at relevant viewport sizes and check the browser console for errors.
- For documentation-only changes, verify commands and paths against the repository configuration and check links and project identifiers.

## Firebase Hosting and deployment

- Firebase Hosting serves the Vite production output from `dist/`.
- `firebase.json` rewrites all routes to `/index.html` for client-side routing compatibility.
- `.firebaserc` selects the Firebase project ID `heitan-web`.
- Build with `npm run build` before deploying.
- Deploy Hosting with `firebase deploy --only hosting` after authenticating the Firebase CLI and confirming the active project.
- Do not change the Firebase project, add Firebase products, or modify infrastructure unless the issue explicitly requires it. Never add credentials or local Firebase state to version control.

## Issue writing conventions

- Start issues with `## Purpose`.
- Use `## Scope` to define included work.
- Add `## Out of scope` or `## Non-goals` when boundaries need to be explicit.
- Define completion with `## Acceptance criteria` or `## Done when`.
- Add issue-specific sections such as `Goals`, `Constraints`, `Data`, or `Deliverables` when useful.
- Keep the structure flexible; not every issue needs every section.
- Use normal bullet lists rather than task checkboxes unless checkboxes serve a specific practical purpose.
