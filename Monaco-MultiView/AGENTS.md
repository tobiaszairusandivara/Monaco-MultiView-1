# AGENTS.md

## Golden rules (apply throughout every session)

1. Read the `/docs` folder and the README files before working. The `TODO.md` file is obsolete — ignore it.
2. Everything in the repo is currently working. The user will only ask for specific changes or additions.
3. Do not make changes that were not requested or suggested. Never take initiative to change things on your own.
4. If instructions are ambiguous or unclear, stop and ask questions until the task is fully understood.
5. Keep all work (code, comments, messages) in English, with one exception: `DECISIONS.md`.

## What this is

"Desafíos Prácticos" (Grupo 5) prototype: an Angular 22 frontend + a plain Node ESM backend (`server/*.mjs`, no framework, no Express). Evolved from the original Monaco IDE sandbox into challenge authoring/CRUD, sandbox code execution, anti-cheat integrity signals, an AI tutor chat, and an IDE for solving challenges.

## Layout

- `src/` — Angular 22 app: standalone components only, inline templates in `views/`; `monaco-editor.ts` and `chat-panel.ts` use sidecar `.html`/`.css`.
- `server/` — Node backend: `index.mjs` (HTTP routing + API), `executor.mjs` (sandbox runtimes), `chat.mjs` (tutor AI), `integrity.mjs` (anti-cheat), `store.mjs` (JSON persistence), `practical.test.mjs` (integration tests).
- `server/data/*.json` — persistence (challenges, executions, submissions, ia-logs). In-memory cache + write-through; don't edit while the server runs. If `challenges.json` is emptied, seeds re-insert on next boot.
- `docs/` — PRD, PIV architecture proposals, design docs (Spanish). `DESIGN_DECISIONS.md` records design decisions; some file references there (e.g. `app.html`, `student-ide`) are stale — current views live in `src/app/views/`.

## Commands

- `npm run dev` — starts API (port 3100) + Angular (4200) together via `server/dev.mjs`. Use for smoke tests.
- `npm start` — frontend only. `npm run server` — API only.
- `npm run build` — production build (also the closest thing to a typecheck; there is no lint/typecheck script, no ESLint).
- `ng test` / `npm test` — NOT wired: `angular.json` has no `test` target (only `build`/`serve`) and there are no `*.spec.ts` files. The README's `ng test` line is stale.
- Real tests: `node --test server/practical.test.mjs` — spawns the API on port 3901 with a temp `MMV_DATA_DIR`. Slow: the Maven seed runs real `mvn test` (needs a warm `~/.m2`) and the frontend seed runs `npm install jsdom` + `node --test`.

## Requirements

Node >= 18 (npm 11 via `packageManager`), JDK 21, and Maven on PATH. On Windows the server launches Maven/NPM via `cmd /c mvn.cmd`/`npm.cmd`. TypeScript is bundled with esbuild, Java via `javac`/`java`.

## Backend gotchas

- Route dispatch in `handleRequest` (index.mjs) mixes prefix matching (`/api/ts`, `/api/java`) with exact matching (`/api/challenges`, `/api/submissions`, ...). Keep new routes consistent with that pattern.
- Sandbox dispatch (`executor.mjs` `executeFiles`): `configuration.runtime` ∈ `EXECUTION_RUNTIMES` = `['maven-test', 'node-spec']`; otherwise auto-detect TS (`main.ts`/`index.ts`) or Java. `isEvaluable` = runnable subtype (`algorithms`, `block-completion`, `find-bug`) OR valid runtime. Challenges without a runtime are consignas, not evaluable (422).
- Evaluation exposes only the first failing hidden test as `failingTest {name, input, expected, actual, status}` (LeetCode-style); the full hidden-test set and `expectedSolution` are never exposed.
- Anti-cheat: `assessIntegrityRisk` (integrity.mjs) is a pure function; levels `NONE/LOW/MEDIUM/HIGH`; `COPY → FOCUS_LOST → PASTE` = `HIGH`.
- Chat: provider defaults to `stub`; enable with `CHAT_PROVIDER=ollama` (+ `OLLAMA_URL`, `OLLAMA_MODEL`). Risk level is derived server-side from the challenge subtype (never trust the client). Also `PORT` (API port) and `MMV_DATA_DIR` are read from env.
- `proxy.conf.json` forwards `/api` → `http://localhost:3100` during `ng serve`/`npm run dev`.

## Frontend conventions

- Standalone components, signals (`signal()`, `computed()`), `inject()` for DI, new control flow (`@if`/`@for`/`@switch`). No NgModules, no `*ngIf`/`*ngFor`/`*ngSwitch`.
- No `HttpClient`; all API calls use plain `fetch` via `src/app/compile.service.ts`.
- Prettier: `singleQuote: true`, `printWidth: 100`. `angular.json` sets `skipTests: true` for all schematics, so generated components come without specs.
- All human-facing copy (UI text, feedback, seed contents, comments) is Spanish, formal "usted". Server UI-facing verdicts/feedback are Spanish; low-level API error strings are English. Keep that split.
- Challenge model + server-side validation: `server/index.mjs` (`validateChallengeInput`). Frontend wizard templates: `src/app/challenge-drafts.ts` + `views/challenge-wizard.ts`. Type model: `src/app/challenge-types.ts`.

## Workflow

Repo ships an OpenCode spec workflow: skills in `.opencode/skills/openspec-*` and slash commands `opsx-explore`, `opsx-propose`, `opsx-apply`, `opsx-archive`. Use them for feature changes. Git history is informal (branch `main`, no conventional commits).