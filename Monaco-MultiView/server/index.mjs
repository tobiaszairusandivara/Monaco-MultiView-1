import http from 'node:http';
import os from 'node:os';
import { execFile, spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import esbuild from 'esbuild';
import { executeFiles, EXECUTION_RUNTIMES } from './executor.mjs';
import { askChat, chatStatus, logInteraction } from './chat.mjs';
import { assessIntegrityRisk } from './integrity.mjs';
import { nextId, readCollection, saveCollection } from './store.mjs';

const PORT = process.env.PORT || 3100;
const MAX_BODY_SIZE = 20 * 1024 * 1024;
const COMPILE_TIMEOUT_MS = 300 * 1000;

const DIFFICULTIES = ['BASICO', 'MEDIO', 'AVANZADO'];
const CHALLENGE_SUBTYPES = [
  'algorithms',
  'block-completion',
  'find-bug',
  'refactoring',
  'hackathon',
  'modeling',
  'code-review',
];
const RUNNABLE_SUBTYPES = new Set(['algorithms', 'block-completion', 'find-bug']);

function isEvaluable(challenge) {
  return (
    RUNNABLE_SUBTYPES.has(challenge.subtype) ||
    EXECUTION_RUNTIMES.includes(challenge.configuration?.runtime)
  );
}

const SUBTYPE_RISK = {
  'block-completion': 'ALTO',
  'find-bug': 'ALTO',
  algorithms: 'MEDIO',
  refactoring: 'MEDIO',
  modeling: 'MEDIO',
  hackathon: 'BAJO',
  'code-review': 'BAJO',
};

const SEED_CHALLENGES = [
  {
    challengeId: 'dsa-total-carrito-medio',
    courseCohortId: 'TUP-2026-01',
    title: 'Total del carrito (algoritmos)',
    topic: 'Algoritmos — sumatoria sobre arreglos',
    subtype: 'algorithms',
    difficulty: 'MEDIO',
    configuration: {
      language: 'typescript',
      entry: 'main.ts',
      baseFiles: [
        {
          path: 'main.ts',
          content: `interface Item {
  nombre: string;
  precio: number;
}

function totalDelCarrito(carrito: Item[]): number {
  // TODO: sume los precios de todos los items del carrito.
  return 0;
}

const carrito: Item[] = [
  { nombre: 'Lapiz', precio: 10 },
  { nombre: 'Cuaderno', precio: 20 },
  { nombre: 'Goma', precio: 5 },
];

console.log(totalDelCarrito(carrito));
`,
        },
      ],
      hiddenTests: [
        { name: 'carrito de 3 items', expected: '35' },
      ],
      expectedSolution: `interface Item {
  nombre: string;
  precio: number;
}

function totalDelCarrito(carrito: Item[]): number {
  return carrito.reduce((acumulado, item) => acumulado + item.precio, 0);
}

const carrito: Item[] = [
  { nombre: 'Lapiz', precio: 10 },
  { nombre: 'Cuaderno', precio: 20 },
  { nombre: 'Goma', precio: 5 },
];

console.log(totalDelCarrito(carrito));
`,
    },
    metadata: { version: 1, softDeleted: false, notes: 'Seed de demostración (algorithms, riesgo MEDIO).' },
  },
  {
    challengeId: 'blq-palindromo-alto',
    courseCohortId: 'TUP-2026-01',
    title: 'Completar la función esPalindromo',
    topic: 'Strings — palíndromos',
    subtype: 'block-completion',
    difficulty: 'MEDIO',
    configuration: {
      language: 'typescript',
      entry: 'main.ts',
      baseFiles: [
        {
          path: 'main.ts',
          content: `function esPalindromo(texto: string): boolean {
  // TODO: implemente la función para que devuelva true cuando \`texto\` es un palíndromo.
  return undefined as unknown as boolean;
}

// No modifique el bloque de abajo: lea líneas desde stdin.
const lineas = process.stdin;
let entrada = '';
lineas.on('data', (chunk: Buffer) => { entrada += chunk.toString(); });
lineas.on('end', () => {
  for (const linea of entrada.trim().split('\\n')) {
    console.log(esPalindromo(linea));
  }
});
`,
        },
      ],
      hiddenTests: [
        { name: 'palindromo "ana"', input: 'ana\n', expected: 'true' },
        { name: 'no palindromo "hola"', input: 'hola\n', expected: 'false' },
      ],
      expectedSolution: `function esPalindromo(texto: string): boolean {
  const limpio = texto.toLowerCase();
  return limpio === limpio.split('').reverse().join('');
}

// No modifique el bloque de abajo: lea líneas desde stdin.
const lineas = process.stdin;
let entrada = '';
lineas.on('data', (chunk: Buffer) => { entrada += chunk.toString(); });
lineas.on('end', () => {
  for (const linea of entrada.trim().split('\\n')) {
    console.log(esPalindromo(linea));
  }
});
`,
    },
    metadata: { version: 1, softDeleted: false, notes: 'Seed de demostración (block-completion, riesgo ALTO).' },
  },
  {
    challengeId: 'fb-promedio-alto',
    courseCohortId: 'TUP-2026-01',
    title: 'Encontrar el bug en promedio()',
    topic: 'Arreglos — recorrido e índices',
    subtype: 'find-bug',
    difficulty: 'MEDIO',
    configuration: {
      language: 'typescript',
      entry: 'main.ts',
      baseFiles: [
        {
          path: 'main.ts',
          content: `function promedio(enteros: number[]): number {
  let total = 0;
  // Hay un error en esta función: no recorre el arreglo correctamente.
  for (let i = 0; i <= enteros.length; i++) {
    total += enteros[i];
  }
  return total / enteros.length;
}

const casoA = [2, 4, 6];
const casoB = [2, 10];

console.log(promedio(casoA));
console.log(promedio(casoB));
`,
        },
      ],
      hiddenTests: [
        { name: 'salida completa esperada', expected: '4\n6' },
      ],
      expectedSolution: `function promedio(enteros: number[]): number {
  let total = 0;
  for (let i = 0; i < enteros.length; i++) {
    total += enteros[i];
  }
  return total / enteros.length;
}

const casoA = [2, 4, 6];
const casoB = [2, 10];

console.log(promedio(casoA));
console.log(promedio(casoB));
`,
    },
    metadata: { version: 1, softDeleted: false, notes: 'Seed de demostración (find-bug, riesgo ALTO).' },
  },
  {
    challengeId: 'sbw-tienda-api-bpr',
    courseCohortId: 'TUP-2026-01',
    title: 'API de tienda con Spring Boot y Maven',
    topic: 'Backend — Spring Boot, Maven y tests de integración',
    subtype: 'refactoring',
    difficulty: 'AVANZADO',
    configuration: {
      language: 'java',
      entry: 'pom.xml',
      runtime: 'maven-test',
      baseFiles: [
        {
          path: 'pom.xml',
          content: `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.3.0</version>
    <relativePath/>
  </parent>
  <groupId>com.tienda</groupId>
  <artifactId>api-tienda</artifactId>
  <version>0.0.1-SNAPSHOT</version>
  <name>api-tienda</name>

  <!--
    Consigna: complete el <dependencies/> con spring-boot-starter-web y
    spring-boot-starter-test (scope test). Cuando el POM esté completo,
    "mvn test" debe finalizar con BUILD SUCCESS y los tests de MockMvc deben pasar.
  -->
  <properties>
    <java.version>17</java.version>
  </properties>

  <dependencies>
    <!-- TODO: agregar spring-boot-starter-web y spring-boot-starter-test (scope test) -->
  </dependencies>
</project>
`,
        },
        {
          path: 'src/main/java/com/tienda/ApiApplication.java',
          content: `package com.tienda;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class ApiApplication {
  public static void main(String[] args) {
    SpringApplication.run(ApiApplication.class, args);
  }
}
`,
        },
        {
          path: 'src/main/java/com/tienda/ProductoController.java',
          content: `package com.tienda;

import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/productos")
public class ProductoController {
  public record Producto(String nombre, Double precio) {}

  @GetMapping
  public List<Producto> listar() {
    return List.of(new Producto("Lapiz", 10.0), new Producto("Cuaderno", 20.0));
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public Producto crear(@RequestBody Producto producto) {
    return producto;
  }
}
`,
        },
        {
          path: 'src/test/java/com/tienda/ProductoControllerTest.java',
          content: `package com.tienda;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class ProductoControllerTest {

  @Autowired private MockMvc mockMvc;

  @Test
  void listarProductos() throws Exception {
    mockMvc.perform(get("/api/productos"))
        .andExpect(status().isOk())
        .andExpect(content().contentType(MediaType.APPLICATION_JSON))
        .andExpect(jsonPath("$[0].nombre").value("Lapiz"));
  }

  @Test
  void crearProducto() throws Exception {
    mockMvc.perform(post("/api/productos")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\\"nombre\\":\\"Goma\\",\\"precio\\":5}"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.nombre").value("Goma"));
  }
}
`,
        },
        {
          path: 'README.md',
          content: `# API de tienda (Spring Boot + Maven)

Consigna: complete el POM y verifique la API con los tests de \`ProductoControllerTest\`.
El sandbox ejecuta \`mvn test\`: se evalúa con los tests que Usted provee como docente.
`,
        },
      ],
      hiddenTests: [
        { name: 'GET /api/productos responde 200 con JSON de la lista', expected: 'status 200 · content-type application/json' },
        { name: 'POST /api/productos crea y responde 201', expected: 'status 201' },
        { name: 'mvn test compila con el POM completado', expected: 'BUILD SUCCESS' },
      ],
      expectedSolution: '',
    },
    metadata: { version: 1, softDeleted: false, notes: 'Seed Spring Boot + Maven (maven-test): complete el POM para pasar los tests de la API.' },
  },
  {
    challengeId: 'app-producto-form-angular-rf',
    courseCohortId: 'TUP-2026-01',
    title: 'Formulario reactivo en Angular standalone',
    topic: 'Frontend — Angular moderno, Reactive Forms y standalones',
    subtype: 'modeling',
    difficulty: 'MEDIO',
    configuration: {
      language: 'typescript',
      entry: 'src/app/product-form.component.ts',
      baseFiles: [
        {
          path: 'src/app/product-form.component.ts',
          content: `import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: \`
    <form [formGroup]="form" (ngSubmit)="submit()">
      <input formControlName="nombre" placeholder="Nombre" />
      <input formControlName="precio" type="number" placeholder="Precio" />
      <button type="submit" [disabled]="form.invalid">Guardar</button>
    </form>
  \`,
})
export class ProductFormComponent {
  form: FormGroup;

  constructor(fb: FormBuilder) {
    this.form = fb.group({
      nombre: ['', [Validators.required, Validators.minLength(3)]],
      precio: [0, [Validators.required, Validators.min(0)]],
    });
  }

  submit() {
    console.log(this.form.value);
  }
}
`,
        },
        {
          path: 'src/app/app.config.ts',
          content: `import { ApplicationConfig } from '@angular/core';

export const appConfig: ApplicationConfig = {
  providers: [],
};
`,
        },
        {
          path: 'README.md',
          content: `# Formulario reactivo en Angular standalone

Consigna: valide el formulario reactivo con las reglas de negocio (nombre con
mínimo 3 caracteres; precio no negativo). La corrección {modeling} queda
pendiente de un evaluador Angular en el sandbox.
`,
        },
      ],
      hiddenTests: [
        { name: 'form.invalid es true al iniciar (sin datos validos)', expected: 'invalid true' },
        { name: 'precio queda invalido con valor negativo (min 0)', expected: 'precio.errors.min presente' },
      ],
      expectedSolution: '',
    },
    metadata: { version: 1, softDeleted: false, notes: 'Seed Angular standalone + Reactive Forms: desafío de consigna (sin runtime en esta iteración).' },
  },
  {
    challengeId: 'app-pedido-form-angular-tf',
    courseCohortId: 'TUP-2026-01',
    title: 'Formulario por plantilla en Angular standalone',
    topic: 'Frontend — Angular Template Forms y validaciones',
    subtype: 'modeling',
    difficulty: 'MEDIO',
    configuration: {
      language: 'typescript',
      entry: 'src/app/order-form.component.ts',
      baseFiles: [
        {
          path: 'src/app/order-form.component.ts',
          content: `import { Component } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';

@Component({
  selector: 'app-order-form',
  standalone: true,
  imports: [FormsModule],
  template: \`
    <form #pedido="ngForm" (ngSubmit)="enviar(pedido)">
      <input name="email" ngModel required email placeholder="Email" />
      <input name="cantidad" ngModel required min="1" type="number" placeholder="Cantidad" />
      <button type="submit" [disabled]="pedido.invalid">Confirmar</button>
    </form>
  \`,
})
export class OrderFormComponent {
  enviar(form: NgForm) {
    console.log(form.value);
  }
}
`,
        },
        {
          path: 'src/app/app.config.ts',
          content: `import { ApplicationConfig } from '@angular/core';

export const appConfig: ApplicationConfig = {
  providers: [],
};
`,
        },
        {
          path: 'README.md',
          content: `# Formulario por plantilla en Angular standalone

Consigna: valide el formulario template-driven (ngModel): email obligatorio y
válido; cantidad mínima 1. La corrección {modeling} queda pendiente de un
evaluador Angular en el sandbox.
`,
        },
      ],
      hiddenTests: [
        { name: 'form invalido con email vacio o mal formado', expected: 'email.errors.required/email presente' },
        { name: 'form invalido con cantidad < 1', expected: 'cantidad.errors.min presente' },
      ],
      expectedSolution: '',
    },
    metadata: { version: 1, softDeleted: false, notes: 'Seed Angular standalone + Template Forms: desafío de consigna (sin runtime en esta iteración).' },
  },
  {
    challengeId: 'frt-tienda-clasica-js',
    courseCohortId: 'TUP-2026-01',
    title: 'Tienda clásica con HTML/CSS/JS',
    topic: 'Frontend clásico — DOM, eventos y renderizado',
    subtype: 'hackathon',
    difficulty: 'BASICO',
    configuration: {
      language: 'html',
      entry: 'index.html',
      runtime: 'node-spec',
      baseFiles: [
        {
          path: 'index.html',
          content: `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>Tienda clásica</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <h1>Tienda clásica</h1>
    <form id="add-item">
      <input id="item-name" placeholder="Nombre del producto" autocomplete="off" />
      <button type="submit">Agregar</button>
    </form>
    <ul id="items"></ul>
    <script src="script.js"></script>
  </body>
</html>
`,
        },
        {
          path: 'style.css',
          content: `body {
  font-family: system-ui, sans-serif;
  max-width: 480px;
  margin: 24px auto;
}
#items li {
  padding: 6px 8px;
  border-bottom: 1px solid #ddd;
}
`,
        },
        {
          path: 'script.js',
          content: `const form = document.getElementById('add-item');
const input = document.getElementById('item-name');
const list = document.getElementById('items');

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = input.value.trim();
  if (!name) return; // los items vacíos no se agregan
  const li = document.createElement('li');
  li.textContent = name;
  list.appendChild(li);
  input.value = '';
});
`,
        },
        {
          path: 'tests/tienda.spec.mjs',
          content: `import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

function build() {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const script = readFileSync(new URL('../script.js', import.meta.url), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/' });
  dom.window.eval(script);
  return dom.window;
}

test('agregar un item renderiza un <li> con ese texto', () => {
  const w = build();
  const input = w.document.getElementById('item-name');
  const form = w.document.getElementById('add-item');
  input.value = 'Lapiz';
  form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  const lis = w.document.querySelectorAll('#items li');
  assert.equal(lis.length, 1);
  assert.equal(lis[0].textContent, 'Lapiz');
});

test('input vacio no agrega nodos', () => {
  const w = build();
  const form = w.document.getElementById('add-item');
  form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  assert.equal(w.document.querySelectorAll('#items li').length, 0);
});
`,
        },
        {
          path: 'README.md',
          content: `# Tienda clásica (HTML/CSS/JS)

Consigna: cargar un producto y renderizarlo en la lista. El sandbox ejecuta los
tests de \`tests/tienda.spec.mjs\` (jsdom) que Usted provee como docente.
`,
        },
      ],
      hiddenTests: [
        { name: 'agregar un item renderiza un <li> con ese texto', expected: 'li con textContent del input' },
        { name: 'input vacio no agrega nodos', expected: 'lista sin cambios' },
      ],
      expectedSolution: '',
    },
    metadata: { version: 1, softDeleted: false, notes: 'Seed Frontend clásico (node-spec): se evalúa con los tests jsdom de tests/tienda.spec.mjs.' },
  },
];



let activeProcess = null;

const UTF8_OUTPUT_FLAGS = ['-Dsun.stdout.encoding=UTF-8', '-Dsun.stderr.encoding=UTF-8'];

const utf8Env = () => ({
  ...process.env,
  MAVEN_OPTS: '-Dfile.encoding=UTF-8',
});

function mavenLauncher(args) {
  if (process.platform === 'win32') {
    return {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', `mvn.cmd ${args.join(' ')}`],
      shell: false,
    };
  }
  return { command: 'mvn', args, shell: false };
}

function safePath(directory, path) {
  const clean = path.replace(/\\/g, '/').replace(/^\.?\/+/, '');
  const target = resolve(directory, clean);
  const base = resolve(directory);
  if (target !== base && !target.startsWith(base + sep)) {
    throw new Error(`Invalid path: ${path}`);
  }
  return target;
}

async function writeFiles(directory, files) {
  for (const file of files ?? []) {
    const path = safePath(directory, file.path);
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, file.content ?? '', 'utf8');
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let accumulated = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      accumulated += chunk;
      if (accumulated.length > MAX_BODY_SIZE) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(accumulated ? JSON.parse(accumulated) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(body));
}

function sendError(res, status, message) {
  sendJson(res, status, { ok: false, error: message });
}

function detectEntry(files, entry) {
  if (entry && files.some((f) => f.path === entry)) {
    return entry;
  }
  if (files.some((f) => f.path === 'main.ts')) return 'main.ts';
  if (files.some((f) => f.path === 'index.ts')) return 'index.ts';
  const rootTs = files.find((f) => /\.(ts|tsx|js|jsx)$/.test(f.path) && !f.path.includes('/'));
  if (rootTs) return rootTs.path;
  throw new Error('No TypeScript entry file found (main.ts, index.ts, or a .ts at the root).');
}

function formatDiagnostics(items) {
  return items.map((item) => {
    const location = item.location
      ? `${item.location.file}:${item.location.line}:${item.location.column}`
      : 'unknown';
    const detail = item.text
      .split('\n')
      .filter((l) => l.trim())
      .join(' | ');
    return `${location} - ${detail}`;
  });
}

async function compileTypeScript(req, res) {
  const { files, entry } = await readBody(req);
  if (!Array.isArray(files) || files.length === 0) {
    return sendError(res, 400, 'A file list is required in the request body.');
  }

  const directory = await mkdtemp(join(os.tmpdir(), 'monaco-ts-'));
  try {
    await writeFiles(directory, files);
    const input = detectEntry(files, entry);
    const result = await esbuild.build({
      entryPoints: [join(directory, input)],
      bundle: true,
      write: false,
      format: 'iife',
      platform: 'neutral',
      target: 'es2020',
      outfile: 'output.js',
      logLevel: 'silent',
      absWorkingDir: directory,
    });

    const js = result.outputFiles[0]?.text ?? '';
    sendJson(res, 200, { ok: true, js });
  } catch (error) {
    const diagnostics = error.errors?.length
      ? formatDiagnostics(error.errors)
      : [error.message ?? String(error)];
    sendJson(res, 200, { ok: false, errors: diagnostics });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

const isMavenProject = (directory) => existsSync(join(directory, 'pom.xml'));

async function compileJava(req, res) {
  const { files } = await readBody(req);
  if (!Array.isArray(files) || files.length === 0) {
    return sendError(res, 400, 'A file list is required in the request body.');
  }

  const directory = await mkdtemp(join(os.tmpdir(), 'monaco-java-'));
  try {
    await writeFiles(directory, files);

    if (isMavenProject(directory)) {
      const launcher = mavenLauncher([
        '-B',
        '-DskipTests',
        '-Dfile.encoding=UTF-8',
        'clean',
        'compile',
      ]);
      const task = spawnSync(launcher.command, launcher.args, {
        cwd: directory,
        env: utf8Env(),
        shell: false,
        timeout: COMPILE_TIMEOUT_MS,
        maxBuffer: 64 * 1024 * 1024,
      });
      const output = `${task.stdout ?? ''}${task.stderr ?? ''}`.trim();
      const errors = output
        .split('\n')
        .filter((l) => l.includes('ERROR') || l.includes('error:'))
        .map((l) => l.trim());
      const ok = task.status === 0 && output.includes('BUILD SUCCESS');
      return sendJson(res, 200, { ok, output, errors });
    }

    const javaFiles = files
      .filter((f) => f.path.endsWith('.java'))
      .map((f) => safePath(directory, f.path));
    if (javaFiles.length === 0) {
      return sendError(res, 400, 'The project has no .java files and no pom.xml.');
    }

    const classesDir = join(directory, 'classes');
    await mkdir(classesDir, { recursive: true });
    const task = spawnSync(
      'javac',
      ['-J-Dfile.encoding=UTF-8', '-encoding', 'UTF-8', '-d', classesDir, ...javaFiles],
      {
        cwd: directory,
        env: utf8Env(),
        timeout: COMPILE_TIMEOUT_MS,
        maxBuffer: 16 * 1024 * 1024,
      },
    );
    const output = `${task.stdout ?? ''}${task.stderr ?? ''}`.trim();
    const errors = output
      .split('\n')
      .filter((l) => l.includes('error'))
      .map((l) => l.trim());
    return sendJson(res, 200, { ok: task.status === 0, output, errors });
  } catch (error) {
    return sendError(res, 500, error.message ?? String(error));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function detectMainClass(directory, files) {
  const mainFile = files.find((f) => {
    if (!f.path.endsWith('.java')) return false;
    const content = readFileSync(safePath(directory, f.path), 'utf8');
    return /(public\s+static\s+void\s+main\s*\()/.test(content);
  });
  if (!mainFile) {
    throw new Error('No main(String[]) method found in the project.');
  }
  const content = readFileSync(safePath(directory, mainFile.path), 'utf8');
  const packageName = content.match(/package\s+([\w.]+)\s*;/)?.[1] ?? '';
  const className =
    content.match(/public\s+(?:abstract\s+|final\s+)?class\s+(\w+)/)?.[1] ??
    content.match(/(?:class|interface)\s+(\w+)/)?.[1] ??
    mainFile.path.replace('.java', '').split('/').pop();
  return packageName ? `${packageName}.${className}` : className;
}

function killProcess() {
  return new Promise((resolve) => {
    const child = activeProcess;
    if (!child || !child.pid) {
      resolve();
      return;
    }
    if (process.platform === 'win32') {
      execFile('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true }, () => resolve());
    } else {
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        try {
          child.kill('SIGKILL');
        } catch {
          /* already finished */
        }
      }
      resolve();
    }
  });
}

function cleanupRun(directory = null) {
  activeProcess = null;
  if (directory) {
    rm(directory, { recursive: true, force: true }).catch(() => {});
  }
}

function warnAndEnd(res, message) {
  try {
    if (!res.destroyed && !res.writableEnded) {
      res.write(`\n${message}\n`);
      res.end();
    }
  } catch {
    /* response already closed */
  }
}

function streamOutput(child, res) {
  return new Promise((resolve) => {
    const streams = [child.stdout, child.stderr].filter(Boolean);
    let remainder = Buffer.alloc(0);

    const sendLine = (line) => {
      if (line.trim() && !res.destroyed) {
        res.write(`${line}\n`);
      }
    };

    const flushLines = (data) => {
      const combined = Buffer.concat([remainder, Buffer.from(data)]);
      const chunks = combined.toString('utf8').split('\n');
      remainder = Buffer.from(chunks.pop() ?? '');
      for (const chunk of chunks) {
        sendLine(chunk.replace(/\r$/, ''));
      }
    };

    child.on('error', () => {});
    for (const stream of streams) {
      stream.on('data', flushLines);
    }

    const closed = () => {
      if (remainder.length > 0) {
        sendLine(remainder.toString('utf8').replace(/\r$/, ''));
        remainder = Buffer.alloc(0);
      }
      resolve();
    };

    child.on('exit', closed);
  });
}

async function runJava(req, res) {
  const { files } = await readBody(req);
  if (activeProcess) {
    return sendError(res, 409, 'A run is already in progress.');
  }
  if (!Array.isArray(files) || files.length === 0) {
    return sendError(res, 400, 'A file list is required in the request body.');
  }

  res.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  });

  const directory = await mkdtemp(join(os.tmpdir(), 'monaco-run-'));
  try {
    await writeFiles(directory, files);

    if (isMavenProject(directory)) {
      const launcher = mavenLauncher(['-B', 'spring-boot:run']);
      activeProcess = spawn(launcher.command, launcher.args, {
        cwd: directory,
        env: utf8Env(),
        shell: false,
      });
      res.write('> mvn -B spring-boot:run\n');
    } else {
      const javaFiles = files
        .filter((f) => f.path.endsWith('.java'))
        .map((f) => safePath(directory, f.path));
      const classesDir = join(directory, 'classes');
      await mkdir(classesDir, { recursive: true });
      const compilation = spawnSync(
        'javac',
        ['-J-Dfile.encoding=UTF-8', '-encoding', 'UTF-8', '-d', classesDir, ...javaFiles],
        { cwd: directory, env: utf8Env(), timeout: COMPILE_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 },
      );
      if (compilation.status !== 0) {
        const output = `${compilation.stdout ?? ''}${compilation.stderr ?? ''}`.trim();
        warnAndEnd(res, output || 'javac compilation error.');
        return;
      }

      const mainClass = detectMainClass(directory, files);
      activeProcess = spawn('java', [...UTF8_OUTPUT_FLAGS, '-Dfile.encoding=UTF-8', '-cp', classesDir, mainClass], {
        cwd: directory,
        env: utf8Env(),
        shell: false,
      });
      res.write(`> java -cp classes ${mainClass}\n`);
    }

    await streamOutput(activeProcess, res);
    if (!res.destroyed && !res.writableEnded) {
      res.end();
    }
  } catch (error) {
    warnAndEnd(res, `Error: ${error.message ?? String(error)}`);
  } finally {
    await killProcess();
    cleanupRun(directory);
  }
}

async function stopRun(req, res) {
  await killProcess();
  cleanupRun(null);
  sendJson(res, 200, { ok: true, stopped: true });
}

function normalizeLines(text) {
  return String(text ?? '')
    .trim()
    .split('\n')
    .map((line) => line.trim());
}

function linesEqual(actual, expected) {
  return actual.length === expected.length && actual.every((line, i) => line === expected[i]);
}

function clip(text, maxLines = 20, maxChars = 400) {
  const lines = String(text ?? '')
    .split('\n')
    .map((line) => line.trimEnd());
  let output = lines.slice(0, maxLines).join('\n');
  if (output.length > maxChars) {
    output = `${output.slice(0, maxChars)}…`;
  }
  return output;
}

async function ensureSeed() {
  const challenges = await readCollection('challenges');
  if (challenges.length === 0) {
    const stamped = SEED_CHALLENGES.map((challenge) => ({
      ...challenge,
      metadata: {
        ...challenge.metadata,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        riskLevel: SUBTYPE_RISK[challenge.subtype],
      },
    }));
    await saveCollection('challenges', stamped);
    console.log(`Seeded ${stamped.length} demo challenges.`);
  }
}

async function findChallenge(challengeId) {
  const challenges = await readCollection('challenges');
  return challenges.find((c) => c.challengeId === challengeId && !c.metadata?.softDeleted) ?? null;
}

function validateChallengeInput(body) {
  const errors = [];
  if (!body.challengeId || typeof body.challengeId !== 'string') errors.push('challengeId is required.');
  if (!body.courseCohortId || typeof body.courseCohortId !== 'string') errors.push('courseCohortId is required.');
  if (!body.title || typeof body.title !== 'string') errors.push('title is required.');
  if (!CHALLENGE_SUBTYPES.includes(body.subtype)) {
    errors.push(`subtype must be one of: ${CHALLENGE_SUBTYPES.join(', ')}.`);
  }
  if (body.difficulty && !DIFFICULTIES.includes(body.difficulty)) {
    errors.push('difficulty must be BASICO, MEDIO or AVANZADO.');
  }
  const config = body.configuration ?? {};
  if (!config.language) errors.push('configuration.language is required.');
  if (!Array.isArray(config.baseFiles) || config.baseFiles.length === 0) {
    errors.push('configuration.baseFiles must be a non-empty array.');
  } else if (config.baseFiles.some((f) => !f.path || typeof f.content !== 'string')) {
    errors.push('Each baseFile must have a path and a string content.');
  }
  if (RUNNABLE_SUBTYPES.has(body.subtype)) {
    if (!Array.isArray(config.hiddenTests) || config.hiddenTests.length === 0) {
      errors.push('configuration.hiddenTests must have at least one test for runnable subtypes.');
    }
    if (typeof config.expectedSolution !== 'string' || !config.expectedSolution.trim()) {
      errors.push('configuration.expectedSolution is required for runnable subtypes.');
    }
  }
  if (config.runtime && !EXECUTION_RUNTIMES.includes(config.runtime)) {
    errors.push(`configuration.runtime must be one of: ${EXECUTION_RUNTIMES.join(', ')}.`);
  }
  return errors;
}

async function listChallenges(req, res) {
  const challenges = await readCollection('challenges');
  const visible = challenges
    .filter((c) => !c.metadata?.softDeleted)
    .map(({ configuration, ...challenge }) => ({
      ...challenge,
      notes: challenge.metadata?.notes ?? '',
      configuration: {
        language: configuration.language,
        entry: configuration.entry,
        runtime: configuration.runtime,
        fileCount: configuration.baseFiles?.length ?? 0,
        entryContent: isEvaluable(challenge)
          ? configuration.baseFiles?.find((f) => f.path === configuration.entry)?.content ?? ''
          : '',
        testCount: configuration.hiddenTests?.length ?? 0,
      },
      riskLevel: SUBTYPE_RISK[challenge.subtype],
    }));
  sendJson(res, 200, { ok: true, challenges: visible });
}

async function getChallenge(req, res, challengeId) {
  const challenge = await findChallenge(challengeId);
  if (!challenge) {
    return sendError(res, 404, 'Challenge not found.');
  }
  sendJson(res, 200, {
    ok: true,
    challenge: { ...challenge, riskLevel: SUBTYPE_RISK[challenge.subtype] },
  });
}

async function createChallenge(req, res) {
  const body = await readBody(req);
  const errors = validateChallengeInput(body);
  if (errors.length > 0) {
    return sendJson(res, 400, { ok: false, errors });
  }
  const challenges = await readCollection('challenges');
  if (challenges.some((c) => c.challengeId === body.challengeId && !c.metadata?.softDeleted)) {
    return sendError(res, 409, 'A challenge with that challengeId already exists.');
  }
  const archived = challenges.find((c) => c.challengeId === body.challengeId && c.metadata?.softDeleted);
  if (archived) {
    const previous = archived.metadata?.version ?? 1;
    Object.assign(archived, {
      courseCohortId: body.courseCohortId,
      title: body.title,
      topic: body.topic ?? '',
      subtype: body.subtype,
      difficulty: body.difficulty ?? 'BASICO',
      configuration: body.configuration,
    });
    archived.metadata = {
      ...archived.metadata,
      version: previous + 1,
      updatedAt: new Date().toISOString(),
      softDeleted: false,
      notes: body.notes ?? archived.metadata?.notes ?? '',
      materialDocs: body.materialDocs ?? archived.metadata?.materialDocs ?? [],
      riskLevel: SUBTYPE_RISK[body.subtype],
    };
    await saveCollection('challenges', challenges);
    return sendJson(res, 201, { ok: true, challenge: { ...archived, riskLevel: archived.metadata.riskLevel } });
  }
  const challenge = {
    challengeId: body.challengeId,
    courseCohortId: body.courseCohortId,
    title: body.title,
    topic: body.topic ?? '',
    subtype: body.subtype,
    difficulty: body.difficulty ?? 'BASICO',
    configuration: body.configuration,
    metadata: {
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      softDeleted: false,
      notes: body.notes ?? '',
      materialDocs: body.materialDocs ?? [],
      riskLevel: SUBTYPE_RISK[body.subtype],
    },
  };
  challenges.push(challenge);
  await saveCollection('challenges', challenges);
  sendJson(res, 201, { ok: true, challenge: { ...challenge, riskLevel: challenge.metadata.riskLevel } });
}

async function updateChallenge(req, res, challengeId) {
  const body = await readBody(req);
  if (body.challengeId !== challengeId) {
    return sendError(res, 400, 'The challengeId in the body must match the URL.');
  }
  const errors = validateChallengeInput(body);
  if (errors.length > 0) {
    return sendJson(res, 400, { ok: false, errors });
  }
  const challenges = await readCollection('challenges');
  const existing = challenges.find((c) => c.challengeId === challengeId && !c.metadata?.softDeleted);
  if (!existing) {
    return sendError(res, 404, 'Challenge not found.');
  }
  const previous = existing.metadata?.version ?? 1;
  Object.assign(existing, {
    courseCohortId: body.courseCohortId,
    title: body.title,
    topic: body.topic ?? '',
    subtype: body.subtype,
    difficulty: body.difficulty ?? 'BASICO',
    configuration: body.configuration,
  });
  existing.metadata = {
    ...existing.metadata,
    version: previous + 1,
    updatedAt: new Date().toISOString(),
    softDeleted: false,
    notes: body.notes ?? existing.metadata.notes ?? '',
    materialDocs: body.materialDocs ?? existing.metadata.materialDocs ?? [],
    riskLevel: SUBTYPE_RISK[body.subtype],
  };
  await saveCollection('challenges', challenges);
  sendJson(res, 200, { ok: true, challenge: { ...existing, riskLevel: existing.metadata.riskLevel } });
}

async function softDeleteChallenge(req, res, challengeId) {
  const challenges = await readCollection('challenges');
  const matches = challenges.filter((c) => c.challengeId === challengeId);
  if (matches.length === 0) {
    return sendError(res, 404, 'Challenge not found.');
  }
  for (const challenge of matches) {
    if (!challenge.metadata?.softDeleted) {
      challenge.metadata.softDeleted = true;
      challenge.metadata.updatedAt = new Date().toISOString();
    }
  }
  await saveCollection('challenges', challenges);
  res.writeHead(204, { 'Access-Control-Allow-Origin': '*' });
  res.end();
}

async function outcomeFor(configuration, files, entry) {
  const runtime = configuration.runtime;
  if (runtime === 'maven-test' || runtime === 'node-spec') {
    const attempt = await executeFiles(files, entry ?? configuration.entry, '', runtime);
    if (['timeout', 'invalid', 'setup-error', 'unsupported'].includes(attempt.status)) {
      const detail = clip(attempt.error || attempt.output, 25, 600);
      return {
        verdict: 'ERROR_TECNICO',
        feedback: `El evaluador no pudo procesar su solución: ${detail}`,
        failingTest: { name: 'ejecución de la suite', input: '', expected: 'la suite completa ejecuta y pasa', actual: clip(attempt.error || attempt.output, 10, 400), status: attempt.status },
      };
    }
    if (attempt.status === 'compile-error') {
      return {
        verdict: 'FALLADO',
        feedback: `Su solución no compiló: ${clip(attempt.error || attempt.output, 20, 400)}`,
        failingTest: { name: 'compilación de la solución', input: '', expected: 'el proyecto compila y la suite ejecuta', actual: clip(attempt.error || attempt.output, 10, 400), status: 'compile-error' },
      };
    }
    if (attempt.status === 'fail') {
      const failing = (attempt.tests ?? []).find((t) => !t.passed);
      if (failing) {
        return {
          verdict: 'FALLADO',
          feedback: `El test "${failing.name}" no pasó: ${failing.message || 'la verificación esperada no se cumplió.'}`,
          failingTest: {
            name: failing.name,
            input: '',
            expected: 'el test pasa',
            actual: clip(failing.message || 'La verificación esperada no se cumplió.', 10, 400),
            status: 'assertion',
          },
        };
      }
      return {
        verdict: 'FALLADO',
        feedback: 'Uno o más tests no pasaron.',
        failingTest: { name: 'suite de tests', input: '', expected: 'la suite completa pasa', actual: clip(attempt.error || attempt.output, 10, 400), status: 'assertion' },
      };
    }
    return { verdict: 'SUPERADO', feedback: 'Todas las verificaciones pasaron.' };
  }

  const tests = configuration.hiddenTests ?? [];
  for (const test of tests) {
    const attempt = await executeFiles(files, entry ?? configuration.entry, test.input ?? '');
    const input = test.input ?? '';
    if (['timeout', 'unsupported', 'invalid'].includes(attempt.status)) {
      return {
        verdict: 'ERROR_TECNICO',
        feedback: `El evaluador no pudo procesar su solución: ${attempt.error}`,
        failingTest: {
          name: test.name,
          input,
          expected: clip(test.expected),
          actual: clip(attempt.error),
          status: attempt.status,
        },
      };
    }
    if (attempt.status !== 'ok') {
      return {
        verdict: 'FALLADO',
        feedback: `Su programa no terminó correctamente: ${attempt.error}`,
        failingTest: {
          name: test.name,
          input,
          expected: clip(test.expected),
          actual: clip(attempt.error),
          status: attempt.status,
        },
      };
    }
    if (!linesEqual(normalizeLines(attempt.output), normalizeLines(test.expected))) {
      return {
        verdict: 'FALLADO',
        feedback: `El test "${test.name}" no pasó: la salida esperada no coincide con la obtenida.`,
        failingTest: {
          name: test.name,
          input,
          expected: clip(test.expected),
          actual: clip(attempt.output),
          status: 'mismatch',
        },
      };
    }
  }
  return { verdict: 'SUPERADO', feedback: 'Todas las verificaciones pasaron.' };
}

async function runChallengeExecution(req, res, challengeId) {
  const challenge = await findChallenge(challengeId);
  if (!challenge) {
    return sendError(res, 404, 'Challenge not found.');
  }
  const { files, entry, evaluate = false } = await readBody(req);
  if (!Array.isArray(files) || files.length === 0) {
    return sendError(res, 400, 'A file list is required in the request body.');
  }
  if (!isEvaluable(challenge)) {
    return sendError(res, 422, `The subtype "${challenge.subtype}" has no sandbox evaluator in this prototype.`);
  }
  const executionId = await nextId('exec');
  if (evaluate === true) {
    const outcome = await outcomeFor(challenge.configuration, files, entry);
    const executions = await readCollection('executions');
    executions.push({
      executionId,
      challengeId,
      courseCohortId: challenge.courseCohortId,
      evaluate: true,
      submittedAt: new Date().toISOString(),
      verdict: outcome.verdict,
      feedback: outcome.feedback,
      failingTest: outcome.failingTest ?? null,
    });
    await saveCollection('executions', executions);
    return sendJson(res, 200, {
      ok: true,
      executionId,
      challengeId,
      evaluate: true,
      verdict: outcome.verdict,
      feedback: outcome.feedback,
      failingTest: outcome.failingTest ?? null,
    });
  }
  const attempt = await executeFiles(files, entry ?? challenge.configuration.entry, '', challenge.configuration.runtime);
  const executions = await readCollection('executions');
  executions.push({
    executionId,
    challengeId,
    courseCohortId: challenge.courseCohortId,
    evaluate: false,
    submittedAt: new Date().toISOString(),
    status: attempt.status,
  });
  await saveCollection('executions', executions);
  sendJson(res, 200, {
    ok: true,
    executionId,
    challengeId,
    evaluate: false,
    status: attempt.status,
    output: attempt.output,
    error: attempt.error,
    tests: attempt.tests ?? [],
    timeMs: attempt.timeMs,
    memoryBytes: attempt.memoryBytes,
  });
}

const INTEGRITY_EVENT_TYPES = ['COPY', 'PASTE', 'WINDOW_BLUR', 'WINDOW_FOCUS'];

class IntegrityEventValidationError extends Error {}

function sanitizeIntegrityEvents(events) {
  if (events === undefined) {
    return [];
  }
  if (!Array.isArray(events)) {
    throw new IntegrityEventValidationError('integrityEvents must be an array.');
  }
  const sanitized = [];
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (!event || typeof event !== 'object' || !INTEGRITY_EVENT_TYPES.includes(event.type)) {
      throw new IntegrityEventValidationError(
        `integrityEvents[${index}].type must be one of ${INTEGRITY_EVENT_TYPES.join(', ')}.`,
      );
    }
    const timestamp = typeof event.timestamp === 'string' ? new Date(event.timestamp) : null;
    if (!timestamp || Number.isNaN(timestamp.getTime())) {
      throw new IntegrityEventValidationError(`integrityEvents[${index}].timestamp must be a valid ISO date.`);
    }
    const sanitizedEvent = { type: event.type, timestamp: event.timestamp };
    for (const field of ['characters', 'lines']) {
      if (event[field] !== undefined) {
        if (typeof event[field] !== 'number' || !Number.isFinite(event[field]) || event[field] < 0) {
          throw new IntegrityEventValidationError(
            `integrityEvents[${index}].${field} must be a non-negative number when present.`,
          );
        }
        sanitizedEvent[field] = event[field];
      }
    }
    sanitized.push(sanitizedEvent);
  }
  return sanitized;
}

async function createSubmission(req, res) {
  const body = await readBody(req);
  if (!body.challengeId || !body.courseCohortId) {
    return sendError(res, 400, 'challengeId and courseCohortId are required.');
  }
  const challenge = await findChallenge(body.challengeId);
  if (!challenge) {
    return sendError(res, 404, 'Challenge not found.');
  }
  if (body.courseCohortId !== challenge.courseCohortId) {
    return sendError(res, 400, 'courseCohortId does not match the challenge.');
  }
  if (!isEvaluable(challenge)) {
    return sendError(res, 422, `The subtype "${challenge.subtype}" has no sandbox evaluator in this prototype.`);
  }
  if (!Array.isArray(body.files) || body.files.length === 0) {
    return sendError(res, 400, 'A file list is required in the request body.');
  }
  let integrityEvents;
  try {
    integrityEvents = sanitizeIntegrityEvents(body.integrityEvents);
  } catch (error) {
    if (error instanceof IntegrityEventValidationError) {
      return sendError(res, 400, error.message);
    }
    throw error;
  }
  const originalSolution = challenge.configuration.expectedSolution ?? '';
  const integrityRisk = assessIntegrityRisk(integrityEvents, {
    reference: {
      characters: originalSolution.length,
      lines: originalSolution.split('\n').length,
    },
  });
  const outcome = await outcomeFor(challenge.configuration, body.files, body.entry);
  const submissionId = await nextId('sub');
  const submissions = await readCollection('submissions');
  submissions.push({
    submissionId,
    challengeId: challenge.challengeId,
    courseCohortId: challenge.courseCohortId,
    studentId: body.studentId ?? 'alumno-demo',
    verdict: outcome.verdict,
    feedback: outcome.feedback,
    failingTest: outcome.failingTest ?? null,
    fileCount: body.files.length,
    chatTranscript: body.chatTranscript ?? [],
    integrityEvents,
    integrityRisk,
    submittedAt: new Date().toISOString(),
  });
  await saveCollection('submissions', submissions);
  sendJson(res, 201, {
    ok: true,
    submissionId,
    challengeId: challenge.challengeId,
    courseCohortId: challenge.courseCohortId,
    studentId: body.studentId ?? 'alumno-demo',
    verdict: outcome.verdict,
    feedback: outcome.feedback,
    failingTest: outcome.failingTest ?? null,
    integrityEvents,
    integrityRisk,
    submittedAt: submissions[submissions.length - 1].submittedAt,
  });
}

async function handleChat(req, res) {
  const body = await readBody(req);
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) {
    return sendError(res, 400, 'A non-empty message list is required.');
  }
  let riskLevel = body.riskLevel ?? 'MEDIO';
  let expectedSolution;
  if (body.challengeId) {
    const challenge = await findChallenge(body.challengeId);
    if (!challenge) {
      return sendError(res, 404, 'Challenge not found.');
    }
    riskLevel = SUBTYPE_RISK[challenge.subtype];
    expectedSolution = challenge.configuration.expectedSolution;
  }
  const result = await askChat({ messages, riskLevel, expectedSolution });
  await logInteraction({
    challengeId: body.challengeId ?? null,
    riskLevel,
    messages,
    reply: result.reply,
    blocked: result.blocked,
  });
  sendJson(res, 200, { ok: true, reply: result.reply, blocked: result.blocked, riskLevel });
}

async function handleChatStatus(req, res) {
  sendJson(res, 200, { ok: true, chat: chatStatus() });
}

async function previewRun(req, res) {
  const { files, entry, input, runtime } = await readBody(req);
  if (!Array.isArray(files) || files.length === 0) {
    return sendError(res, 400, 'A file list is required in the request body.');
  }
  const attempt = await executeFiles(files, entry, input ?? '', runtime);
  sendJson(res, 200, {
    ok: true,
    status: attempt.status,
    output: attempt.output,
    error: attempt.error,
    tests: attempt.tests ?? [],
    timeMs: attempt.timeMs,
    memoryBytes: attempt.memoryBytes,
  });
}

async function handleRequest(req, res) {
  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      return res.end();
    }

    const url = new URL(req.url, `http://localhost:${PORT}`);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (req.method === 'POST' && req.url.startsWith('/api/ts/compile')) return compileTypeScript(req, res);
    if (req.method === 'POST' && req.url.startsWith('/api/java/compile')) return compileJava(req, res);
    if (req.method === 'POST' && req.url.startsWith('/api/java/run')) return runJava(req, res);
    if (req.method === 'POST' && req.url.startsWith('/api/java/stop')) return stopRun(req, res);
    if (req.method === 'GET' && req.url.startsWith('/api/status')) {
      return sendJson(res, 200, { ok: true, running: Boolean(activeProcess) });
    }

    if (req.method === 'GET' && path === '/api/challenges') return listChallenges(req, res);
    if (req.method === 'POST' && path === '/api/challenges') return createChallenge(req, res);
    if (req.method === 'GET' && path.startsWith('/api/challenges/')) return getChallenge(req, res, path.slice('/api/challenges/'.length));
    if (req.method === 'PUT' && path.startsWith('/api/challenges/')) {
      return updateChallenge(req, res, path.slice('/api/challenges/'.length));
    }
    if (req.method === 'DELETE' && path.startsWith('/api/challenges/')) {
      return softDeleteChallenge(req, res, path.slice('/api/challenges/'.length));
    }
    if (req.method === 'POST' && path.startsWith('/api/practical-challenges/') && path.endsWith('/executions')) {
      return runChallengeExecution(req, res, path.slice('/api/practical-challenges/'.length, -'/executions'.length));
    }
    if (req.method === 'POST' && path === '/api/submissions') return createSubmission(req, res);
    if (req.method === 'POST' && path === '/api/chat') return handleChat(req, res);
    if (req.method === 'GET' && path === '/api/chat/status') return handleChatStatus(req, res);
    if (req.method === 'POST' && path === '/api/preview-run') return previewRun(req, res);

    sendJson(res, 404, { ok: false, error: 'Resource not found.' });
  } catch (error) {
    sendError(res, 500, error.message ?? String(error));
  }
}

const server = http.createServer(handleRequest);
await ensureSeed();
server.listen(PORT, () => {
  console.log(`Monaco MultiView server listening on http://localhost:${PORT}`);
});