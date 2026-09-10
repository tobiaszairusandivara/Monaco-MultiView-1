# MonacoMultiView

Browser IDE with a VS Code-like layout: file explorer, Monaco editor on top, and an output console at the bottom (with a draggable separator).

> **Purpose**: this project is meant to **test Monaco's capabilities**, not to be used as-is on a server. It is not performant; it is a small test environment that could be reused at some point. See [TODO.md](TODO.md) for planned work (real domain challenges, realistic examples, basic execution tests).

Compiles and runs:

- **TypeScript (single file)**: with the Monaco worker, 100% in the browser.
- **TypeScript (multi-file)**: bundling with esbuild through the local server.
- **Simple Java** (`*.java`): with `javac` / `java`.
- **Spring Boot** (with `pom.xml`): with Maven, streaming logs live and leaving the app running until you press **Stop** (if you press **Compile** again while a run is active, it automatically stops it first). The demo runs at `http://localhost:8080` and can be tested from Swagger UI (`http://localhost:8080/swagger-ui.html`).

Requires **Node >= 18**, **JDK 21** and **Maven** installed and on the PATH.

## Development

The easiest way is **a single command** that starts the compilation server and the frontend together:

```bash
npm run dev
```

You can also start them separately, in two terminals:

```bash
# Terminal 1: compilation server (Node, port 3100)
npm run server

# Terminal 2: frontend (Angular, port 4200)
npm start
```

Then open `http://localhost:4200/`. In the toolbar you can pick between the example projects (Simple TypeScript, Simple Java, and Spring Boot Backend). The first Spring Boot compilation downloads Maven dependencies and may take a while.

IDE features:

- **Code zoom**: `Ctrl + scroll` over the editor, or the `A-` / `A+` / `100%` buttons in the editor header.
- **Collapsible explorer**: when collapsed, it leaves a narrow bar with one icon per file type in the project (TS, Java, XML, properties...).
- **Resizable panels**: editor and console grow/shrink by dragging the separator, with a 120px minimum for each, without breaking the layout.

## Development server (details)

The frontend uses `@angular/build:dev-server` with a proxy (`proxy.conf.json`) that forwards `/api` to the local server at `http://localhost:3100`.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.














