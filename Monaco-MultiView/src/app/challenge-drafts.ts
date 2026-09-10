import {
  DEFAULT_COHORT,
  slugify,
  SUBTYPE_META,
  type ChallengeSubtype,
  type Draft,
} from './challenge-types';

const ALGORITHMS_BASE = `interface Item {
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
`;

const ALGORITHMS_SOLUTION = `interface Item {
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
`;

const BLOCK_BASE = `function esPalindromo(texto: string): boolean {
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
`;

const BLOCK_SOLUTION = `function esPalindromo(texto: string): boolean {
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
`;

const FIND_BUG_BASE = `function promedio(enteros: number[]): number {
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
`;

const FIND_BUG_SOLUTION = `function promedio(enteros: number[]): number {
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
`;

const CONSIGNA_README = (label: string, subtype: ChallengeSubtype) => `# ${label}

Subtipo: ${subtype}
Este subtipo se muestra como consigna en el prototipo: aún no tiene un
evaluador automático en el sandbox (el flujo completo está previsto para la
próxima entrega del grupo).

## Consigna
Escriba acá el enunciado, criterios de evaluación y material de referencia.

## Criterios
1. Criterio de evaluación A.
2. Criterio de evaluación B.
`;

const DEFAULT_TESTS = (subtype: ChallengeSubtype): string => {
  switch (subtype) {
    case 'algorithms':
      return JSON.stringify([{ name: 'carrito de 3 items', expected: '35' }], null, 2);
    case 'block-completion':
      return JSON.stringify(
        [
          { name: 'palindromo "ana"', input: 'ana\n', expected: 'true' },
          { name: 'no palindromo "hola"', input: 'hola\n', expected: 'false' },
        ],
        null,
        2,
      );
    case 'find-bug':
      return JSON.stringify([{ name: 'salida completa esperada', expected: '4\n6' }], null, 2);
    default:
      return '[]';
  }
};

function templateFor(subtype: ChallengeSubtype): { base?: string; solution?: string } {
  switch (subtype) {
    case 'algorithms':
      return { base: ALGORITHMS_BASE, solution: ALGORITHMS_SOLUTION };
    case 'block-completion':
      return { base: BLOCK_BASE, solution: BLOCK_SOLUTION };
    case 'find-bug':
      return { base: FIND_BUG_BASE, solution: FIND_BUG_SOLUTION };
    default:
      return {
        base: CONSIGNA_README(SUBTYPE_META[subtype].label, subtype),
        solution: '',
      };
  }
}

export function newDraft(subtype: ChallengeSubtype, courseCohortId = DEFAULT_COHORT): Draft {
  const templates = templateFor(subtype);
  return {
    challengeId: slugify(SUBTYPE_META[subtype].label),
    courseCohortId,
    title: SUBTYPE_META[subtype].label,
    topic: SUBTYPE_META[subtype].label,
    difficulty: 'MEDIO',
    subtype,
    notes: '',
    materialDocs: [],
    language: 'typescript',
    entry: 'main.ts',
    baseFiles: [{ path: 'main.ts', content: templates.base ?? '' }],
    hiddenTestsText: DEFAULT_TESTS(subtype),
    expectedSolutionText: templates.solution ?? '',
    timeLimitMs: 60000,
  };
}

export interface ChallengeTemplate {
  key: string;
  label: string;
  stack: string;
  description: string;
  subtype: ChallengeSubtype;
  runtime?: Extract<Draft['runtime'], string>;
}

export const CHALLENGE_TEMPLATES: ChallengeTemplate[] = [
  {
    key: 'spring-boot-maven',
    label: 'API Spring Boot + Maven',
    stack: 'Backend',
    description: 'Armar una API completa con tests e integrarla al POM de Maven.',
    subtype: 'refactoring',
    runtime: 'maven-test',
  },
  {
    key: 'angular-reactive-forms',
    label: 'Angular Reactive Forms',
    stack: 'Frontend (Angular 22)',
    description: 'Componente standalone con FormGroup y validadores.',
    subtype: 'modeling',
  },
  {
    key: 'angular-template-forms',
    label: 'Angular Template Forms',
    stack: 'Frontend (Angular 22)',
    description: 'Componente standalone con formulario template-driven (ngModel).',
    subtype: 'modeling',
  },
  {
    key: 'frontend-clasico',
    label: 'Frontend JS / HTML / CSS',
    stack: 'Frontend clásico',
    description: 'Página simple con DOM, eventos y estilos.',
    subtype: 'hackathon',
    runtime: 'node-spec',
  },
];

const SPRING_BOOT_FILES = [
  {
    path: 'pom.xml',
    content: `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
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

  <!-- Complete <dependencies/> con spring-boot-starter-web y spring-boot-starter-test (test). -->
  <dependencies>
    <!-- TODO -->
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

Complete el POM y verifique la API con los tests. El sandbox ejecuta \`mvn test\`
y evalúa con los tests de \`ProductoControllerTest\` que Usted provee como docente.
`,
  },
];

const ANGULAR_REACTIVE_FILES = [
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

Valide el ReactiveForms con las reglas de negocio (nombre con mínimo 3
caracteres; precio no negativo). La corrección queda pendiente de un evaluador
Angular en el sandbox.
`,
  },
];

const ANGULAR_TEMPLATE_FILES = [
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

Valide un formulario template-driven (ngModel): email obligatorio y válido;
cantidad mínima 1. La corrección queda pendiente de un evaluador Angular en el
sandbox.
`,
  },
];

const FRONTEND_CLASICO_FILES = [
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

Cargar un producto y renderizarlo en la lista. El sandbox ejecuta los tests de
\`tests/tienda.spec.mjs\` (jsdom) que Usted provee como docente.
`,
  },
];

function templateForStack(key: string): { files: typeof SPRING_BOOT_FILES; tests: string; title: string; topic: string; difficulty: Draft['difficulty']; entry: string } {
  switch (key) {
    case 'spring-boot-maven':
      return {
        files: SPRING_BOOT_FILES,
        tests: JSON.stringify(
          [
            { name: 'GET /api/productos responde 200 con JSON', expected: 'status 200 · application/json' },
            { name: 'POST /api/productos responde 201', expected: 'status 201' },
            { name: 'mvnw test compila con el POM completado', expected: 'BUILD SUCCESS' },
          ],
          null,
          2,
        ),
        title: 'API de tienda con Spring Boot y Maven',
        topic: 'Backend — Spring Boot, Maven y tests de integración',
        difficulty: 'AVANZADO',
        entry: 'pom.xml',
      };
    case 'angular-reactive-forms':
      return {
        files: ANGULAR_REACTIVE_FILES,
        tests: JSON.stringify(
          [
            { name: 'form.invalid es true al iniciar', expected: 'invalid true' },
            { name: 'precio negativo invalida (min 0)', expected: 'precio.errors.min presente' },
          ],
          null,
          2,
        ),
        title: 'Formulario reactivo en Angular standalone',
        topic: 'Frontend — Reactive Forms y standalones',
        difficulty: 'MEDIO',
        entry: 'src/app/product-form.component.ts',
      };
    case 'angular-template-forms':
      return {
        files: ANGULAR_TEMPLATE_FILES,
        tests: JSON.stringify(
          [
            { name: 'email vacio o mal formado invalida el form', expected: 'email.errors.required/email' },
            { name: 'cantidad menor a 1 invalida', expected: 'cantidad.errors.min presente' },
          ],
          null,
          2,
        ),
        title: 'Formulario por plantilla en Angular standalone',
        topic: 'Frontend — Template Forms y validaciones',
        difficulty: 'MEDIO',
        entry: 'src/app/order-form.component.ts',
      };
    default:
      return {
        files: FRONTEND_CLASICO_FILES,
        tests: JSON.stringify(
          [
            { name: 'agregar un item renderiza un li con ese texto', expected: 'li con textContent del input' },
            { name: 'input vacio no agrega nodos', expected: 'lista sin cambios' },
          ],
          null,
          2,
        ),
        title: 'Tienda clásica con HTML/CSS/JS',
        topic: 'Frontend clásico — DOM, eventos y renderizado',
        difficulty: 'BASICO',
        entry: 'index.html',
      };
  }
}

export function templateDraft(template: ChallengeTemplate, courseCohortId = DEFAULT_COHORT): Draft {
  const stack = templateForStack(template.key);
  return {
    challengeId: slugify(template.label),
    courseCohortId,
    title: stack.title,
    topic: stack.topic,
    difficulty: stack.difficulty,
    subtype: template.subtype,
    notes: template.runtime
      ? `Plantilla multi-archivo evaluada con el sandbox (${template.runtime}).`
      : 'Plantilla multi-archivo de consigna (la corrección depende de un evaluador especializado).',
    materialDocs: [],
    language: 'typescript',
    entry: stack.entry,
    runtime: template.runtime,
    baseFiles: stack.files,
    hiddenTestsText: stack.tests,
    expectedSolutionText: '',
    timeLimitMs: 60000,
  };
}