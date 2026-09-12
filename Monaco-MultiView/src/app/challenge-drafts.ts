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

const REFACTORING_BASE = `// El código funciona pero tiene problemas de diseño. Refactorícelo sin cambiar
// su comportamiento: nombres, duplicación, constantes mágicas y responsabilidades.

function calc(precio: number, cant: number): number {
  let d = 0;
  if (cant > 100) {
    d = precio * 0.1;
  } else if (cant > 50) {
    d = precio * 0.05;
  }
  const x = precio - d;
  const t = x * 1.21; // IVA
  return Math.round(t * 100) / 100;
}

const precioA = 200;
const cantA = 60;
const precioB = 150;
const cantB = 200;

console.log(calc(precioA, cantA));
console.log(calc(precioB, cantB));
`;

const REFACTORING_SOLUTION = `const IVA = 0.21;

function descuentoPorCantidad(cantidad: number): number {
  if (cantidad > 100) return 0.1;
  if (cantidad > 50) return 0.05;
  return 0;
}

function aplicarDescuento(precio: number, cantidad: number): number {
  return precio * (1 - descuentoPorCantidad(cantidad));
}

function totalConIva(precioConDescuento: number): number {
  return Math.round(precioConDescuento * (1 + IVA) * 100) / 100;
}

function calcularTotal(precio: number, cantidad: number): number {
  return totalConIva(aplicarDescuento(precio, cantidad));
}

const precioA = 200;
const cantA = 60;
const precioB = 150;
const cantB = 200;

console.log(calcularTotal(precioA, cantA));
console.log(calcularTotal(precioB, cantB));
`;

const HACKATHON_BASE = `// Hackathon: construya el recomendador musical de la consigna.
// Dado un catálogo y un clima, devuelva las canciones que mejor combinan.
// Sea creativo: defina los criterios, justifique las reglas y agregue al
// menos una función extra (valen puntos por originalidad).

interface Cancion {
  titulo: string;
  genero: string;
  energia: number; // de 0 a 10
  duracionSeg: number;
}

const CATALOGO: Cancion[] = [
  { titulo: 'Noches de jazz', genero: 'jazz', energia: 3, duracionSeg: 210 },
  { titulo: 'Ritmo soleado', genero: 'pop', energia: 7, duracionSeg: 185 },
  { titulo: 'Motor salvaje', genero: 'rock', energia: 9, duracionSeg: 245 },
  { titulo: 'Pista del futuro', genero: 'electro', energia: 8, duracionSeg: 200 },
];

function recomendarPara(clima: string, canciones: Cancion[]): Cancion[] {
  // TODO: implemente las reglas de recomendación según el clima.
  return [];
}

const clima = 'lluvioso';
const playlist = recomendarPara(clima, CATALOGO);
console.log(\`Playlist para un día \${clima}:\`);
for (const cancion of playlist) {
  console.log(\`- \${cancion.titulo} (\${cancion.genero})\`);
}
`;

const HACKATHON_SOLUTION = `interface Cancion {
  titulo: string;
  genero: string;
  energia: number;
  duracionSeg: number;
}

const CATALOGO: Cancion[] = [
  { titulo: 'Noches de jazz', genero: 'jazz', energia: 3, duracionSeg: 210 },
  { titulo: 'Ritmo soleado', genero: 'pop', energia: 7, duracionSeg: 185 },
  { titulo: 'Motor salvaje', genero: 'rock', energia: 9, duracionSeg: 245 },
  { titulo: 'Pista del futuro', genero: 'electro', energia: 8, duracionSeg: 200 },
];

const GENERO_POR_CLIMA: Record<string, string> = {
  lluvioso: 'jazz',
  soleado: 'pop',
  nublado: 'rock',
  festivo: 'electro',
};

function recomendarPara(clima: string, canciones: Cancion[]): Cancion[] {
  const genero = GENERO_POR_CLIMA[clima] ?? 'pop';
  return canciones
    .filter((cancion) => cancion.genero === genero)
    .sort((a, b) => b.energia - a.energia);
}

const clima = 'lluvioso';
const playlist = recomendarPara(clima, CATALOGO);
console.log(\`Playlist para un día \${clima}:\`);
for (const cancion of playlist) {
  console.log(\`- \${cancion.titulo} (\${cancion.genero})\`);
}
`;

const MODELING_BASE = `// Modelado de dominio: complete las reglas de préstamo de una biblioteca.
//
// Reglas de negocio:
//  1. Un usuario puede tener hasta 3 préstamos vigentes a la vez.
//  2. Un préstamo vence a los 14 días de iniciado.
//  3. Una copia solo se presta si está DISPONIBLE.

type EstadoCopia = 'DISPONIBLE' | 'PRESTADA' | 'EN_REPARACION';

interface Libro {
  isbn: string;
  titulo: string;
  autor: string;
}

interface Copia {
  codigo: string;
  libro: Libro;
  estado: EstadoCopia;
}

interface Prestamo {
  copia: Copia;
  usuario: string;
  fechaInicio: string; // ISO yyyy-mm-dd
  fechaVencimiento: string; // ISO yyyy-mm-dd
}

const DIAS_DE_PRESTAMO = 14;

function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}

function sumarDias(fecha: string, dias: number): string {
  const fechaObj = new Date(\`\${fecha}T00:00:00Z\`);
  fechaObj.setUTCDate(fechaObj.getUTCDate() + dias);
  return fechaObj.toISOString().slice(0, 10);
}

function estaVigente(prestamo: Prestamo, fecha: string): boolean {
  return prestamo.fechaVencimiento >= fecha;
}

function prestar(copia: Copia, usuario: string, prestamos: Prestamo[]): Prestamo | null {
  // TODO: aplique las reglas 1, 2 y 3 y devuelva el préstamo creado (o null).
  return null;
}

const libros = {
  principito: { isbn: '978-15', titulo: 'El Principito', autor: 'Saint-Exupéry' },
  dune: { isbn: '978-16', titulo: 'Dune', autor: 'Frank Herbert' },
};

const copia: Copia = { codigo: 'B-01', libro: libros.principito, estado: 'DISPONIBLE' };
const prestamo = prestar(copia, 'alumno-demo', []);
console.log(
  prestamo
    ? \`Préstamo de "\${prestamo.copia.libro.titulo}" a \${prestamo.usuario} (\${DIAS_DE_PRESTAMO} días).\`
    : 'No se pudo prestar.',
);

const copiaOcupada: Copia = { codigo: 'B-02', libro: libros.dune, estado: 'PRESTADA' };
const fallido = prestar(copiaOcupada, 'alumno-demo', []);
console.log(fallido ? 'Segundo préstamo.' : 'No se pudo prestar la copia ocupada.');
`;

const MODELING_SOLUTION = `type EstadoCopia = 'DISPONIBLE' | 'PRESTADA' | 'EN_REPARACION';

interface Libro {
  isbn: string;
  titulo: string;
  autor: string;
}

interface Copia {
  codigo: string;
  libro: Libro;
  estado: EstadoCopia;
}

interface Prestamo {
  copia: Copia;
  usuario: string;
  fechaInicio: string;
  fechaVencimiento: string;
}

const DIAS_DE_PRESTAMO = 14;
const MAX_PRESTAMOS_VIGENTES = 3;

function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}

function sumarDias(fecha: string, dias: number): string {
  const fechaObj = new Date(\`\${fecha}T00:00:00Z\`);
  fechaObj.setUTCDate(fechaObj.getUTCDate() + dias);
  return fechaObj.toISOString().slice(0, 10);
}

function estaVigente(prestamo: Prestamo, fecha: string): boolean {
  return prestamo.fechaVencimiento >= fecha;
}

function prestar(copia: Copia, usuario: string, prestamos: Prestamo[]): Prestamo | null {
  const vigentes = prestamos.filter((p) => p.usuario === usuario && estaVigente(p, hoy()));
  if (copia.estado !== 'DISPONIBLE' || vigentes.length >= MAX_PRESTAMOS_VIGENTES) {
    return null;
  }
  return {
    copia,
    usuario,
    fechaInicio: hoy(),
    fechaVencimiento: sumarDias(hoy(), DIAS_DE_PRESTAMO),
  };
}

const libros = {
  principito: { isbn: '978-15', titulo: 'El Principito', autor: 'Saint-Exupéry' },
  dune: { isbn: '978-16', titulo: 'Dune', autor: 'Frank Herbert' },
};

const copia: Copia = { codigo: 'B-01', libro: libros.principito, estado: 'DISPONIBLE' };
const prestamo = prestar(copia, 'alumno-demo', []);
console.log(
  prestamo
    ? \`Préstamo de "\${prestamo.copia.libro.titulo}" a \${prestamo.usuario} (\${DIAS_DE_PRESTAMO} días).\`
    : 'No se pudo prestar.',
);

const copiaOcupada: Copia = { codigo: 'B-02', libro: libros.dune, estado: 'PRESTADA' };
const fallido = prestar(copiaOcupada, 'alumno-demo', []);
console.log(fallido ? 'Segundo préstamo.' : 'No se pudo prestar la copia ocupada.');
`;

const CODE_REVIEW_BASE = `// Code review: evalúe el siguiente código y proponga mejoras.
// Escriba su revisión como comentarios "// REVISIÓN:" debajo de cada punto
// mejorable (nombres, duplicación, validaciones, errores, idioma).

function m(x: number, y: number): number {
  let p = 1;
  for (let i = 0; i < y; i++) {
    p *= x;
  }
  // REVISIÓN: (escriba acá su hallazgo y la mejora sugerida)
  return p;
}

function dividir(a: number, b: number): number {
  // REVISIÓN: (escriba acá su hallazgo y la mejora sugerida)
  return a / b;
}

function procesar(numeros: number[]): void {
  let total = 0;
  let cantidad = 0;
  for (const n of numeros) {
    total += n;
    cantidad++;
  }
  const promedio = total / cantidad;
  console.log('El promedio es ' + promedio);
}

procesar([3, 5, 7]);
console.log(m(2, 3));
console.log(dividir(10, 0));
`;

const CODE_REVIEW_SOLUTION = `// Revisión aplicada: nombres claros, validación de entradas y casos borde.

function potencia(base: number, exponente: number): number {
  // REVISIÓN: [Nombres] "m/x/y/p" no comunican intención. Se renombró la función.
  if (exponente < 0) {
    throw new Error('El exponente no puede ser negativo.');
  }
  let resultado = 1;
  for (let i = 0; i < exponente; i++) {
    resultado *= base;
  }
  return resultado;
}

function dividir(numerador: number, denominador: number): number {
  // REVISIÓN: [Robustez] dividir(10, 0) devuelve Infinity. Se valida el denominador.
  if (denominador === 0) {
    throw new Error('No se puede dividir por cero.');
  }
  return numerador / denominador;
}

function procesar(numeros: number[]): void {
  // REVISIÓN: [Caso borde] con un arreglo vacío el promedio da NaN.
  if (numeros.length === 0) {
    console.log('No hay números para procesar.');
    return;
  }
  const total = numeros.reduce((acc, n) => acc + n, 0);
  const promedio = total / numeros.length;
  console.log(\`El promedio es \${promedio}\`);
}

procesar([3, 5, 7]);
console.log(potencia(2, 3));
console.log(dividir(10, 2));
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
    case 'refactoring':
      return JSON.stringify(
        [
          { name: 'salida completa esperada', expected: '229.9\n163.35' },
          { name: 'sin descuento (cantidad <= 50)', expected: '121' },
        ],
        null,
        2,
      );
    case 'hackathon':
      return JSON.stringify(
        [
          {
            name: 'salida completa esperada',
            expected: 'Playlist para un día lluvioso:\n- Noches de jazz (jazz)',
          },
          {
            name: 'clima soleado: pop',
            expected: 'Playlist para un día soleado:\n- Ritmo soleado (pop)',
          },
        ],
        null,
        2,
      );
    case 'modeling':
      return JSON.stringify(
        [
          {
            name: 'salida completa esperada',
            expected: 'Préstamo de "El Principito" a alumno-demo (14 días).\nNo se pudo prestar la copia ocupada.',
          },
        ],
        null,
        2,
      );
    case 'code-review':
      return JSON.stringify(
        [{ name: 'salida completa esperada', expected: 'El promedio es 5\n8\n5' }],
        null,
        2,
      );
    default:
      return '[]';
  }
};

export const HACKATHON_DEFAULT_DURATION_MS = 90 * 60 * 1000;

function templateFor(subtype: ChallengeSubtype): { base?: string; solution?: string } {
  switch (subtype) {
    case 'algorithms':
      return { base: ALGORITHMS_BASE, solution: ALGORITHMS_SOLUTION };
    case 'block-completion':
      return { base: BLOCK_BASE, solution: BLOCK_SOLUTION };
    case 'find-bug':
      return { base: FIND_BUG_BASE, solution: FIND_BUG_SOLUTION };
    case 'refactoring':
      return { base: REFACTORING_BASE, solution: REFACTORING_SOLUTION };
    case 'hackathon':
      return { base: HACKATHON_BASE, solution: HACKATHON_SOLUTION };
    case 'modeling':
      return { base: MODELING_BASE, solution: MODELING_SOLUTION };
    case 'code-review':
      return { base: CODE_REVIEW_BASE, solution: CODE_REVIEW_SOLUTION };
    default: {
      const other = subtype as ChallengeSubtype;
      return {
        base: CONSIGNA_README(SUBTYPE_META[other].label, other),
        solution: '',
      };
    }
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
    mandatory: false,
    subtype,
    durationMs: subtype === 'hackathon' ? HACKATHON_DEFAULT_DURATION_MS : null,
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
    mandatory: false,
    subtype: template.subtype,
    durationMs: template.subtype === 'hackathon' ? HACKATHON_DEFAULT_DURATION_MS : null,
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