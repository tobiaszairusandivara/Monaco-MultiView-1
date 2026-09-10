# Design Decisions — Grupo 5 "Desafíos Prácticos"

> Documento de decisiones de diseño del prototipo v1 (Monaco MultiView).
> Origen de este documento: `ERROR_REGISTER` (feedback post-smoke test, 2026-09-07).
> Convención por ítem: **PREVIO** (estado actual) → **POSTERIOR** (estado a implementar).

---

## 1. Contexto

Luego del smoke test del prototipo v1 (server + frontend con wizard de creación de
desafíos, vista alumno con tutor de IA y panel JSON), se registró una lista de
problemas en `ERROR_REGISTER`. Este documento fija las decisiones tomadas para
resolverlos y el detalle técnico del cambio.

## 2. Decisiones confirmadas (Q&A)

| # | Tema | Decisión |
|---|------|----------|
| 1 | Feedback de veredicto (LeetCode) | Mostrar **siempre** `expected` vs `actual` del **primer** test que falla. |
| 2 | Alcance multi-archivo del alumno | El alumno **solo edita los archivos base existentes** (no agrega/borra/renombra). |
| 3 | Edición de desafíos publicados | Editar conserva el **`challengeId` estable**; se bumpea `metadata.version` (+1) para no romper el historial de entregas. |
| 4 | Eventos de integridad | La entrega acepta `integrityEvents` (tipos `COPY`, `PASTE`, `WINDOW_BLUR`, `WINDOW_FOCUS`) y devuelve un `integrityRisk` `{ level, reasons }` derivado de su orden temporal. |
| 5 | Niveles de riesgo de integridad | `NONE / LOW / MEDIUM / HIGH` (traducidos al inglés; `NULO` → `NONE`). El `RiskLevel` de desafío (`ALTO/MEDIO/BAJO`) queda separado y sin tocar. |
| 6 | Tamaño de los PASTE | Categorías `SMALL / MEDIUM / LARGE` (sin `MASSIVE` ni `MODERATE`); solo `PASTE_LARGE` (ratio > 0.30) eleva el riesgo y aporta razón. `< 0.10` → `SMALL`, entre `0.10` y `0.30` → `MEDIUM`. |
| 7 | Señal `COPY` | La razón `COPY` solo aparece cuando NO hay `COPY_BEFORE_PASTE` (evita redundancia cuando el COPY antecede a un PASTE). |
| 8 | `COPY` luego pérdida de foco | `COPY → FOCUS_LOST` se considera **riesgo medio** (copió y luego perdió el foco). |
| 9 | `COPY → foco → PASTE` | Copiar, perder el foco y luego pegar es **riesgo alto** (`HIGH`) **independiente del tamaño** del PASTE. |

---

## 3. Ítems de cambio (PREVIO → POSTERIOR)

### 3.1 Tutor IA: el nivel de riesgo cambia a MEDIO a mitad de conversación (BUG)

**Problema (ERROR_REGISTER #1):** el saludo del tutor dice ALTO, pero toda respuesta
del servidor dice MEDIO en el mismo hilo de conversación.

**Causa raíz:** en `server/chat.mjs`, `produce()` resuelve el nivel del stub con
`stubFor(userMessages.at(-1)?.riskLevel ?? 'MEDIO')`. Los mensajes se mapean a
`{ role, content }` (sin `riskLevel`), por lo que siempre cae en `MEDIO`.
La autoridad del servidor (RF-IA-21) quedaba rota para el proveedor `stub`.

- **PREVIO:** el nivel de la respuesta del tutor se deriva de un campo inexistente
  en el último mensaje → siempre `MEDIO` en el stub.
- **POSTERIOR:** `askChat` pasa el `riskLevel` ya resuelto (desde el `challengeId`,
  subtipo → riesgo) a `produce()`; el stub usa ese riesgo. El nivel permanece fijo
  por subtipo durante toda la conversación (RF-IA-19 / RF-IA-21 estricto).

---

### 3.2 Chat como burbuja + panel derecho deslizante

**Problema (ERROR_REGISTER #1):** el chat ocupa una columna fija de 320px a la
izquierda. Se pide una burbuja flotante a la derecha que abra un panel lateral
desplegable, con una "X" en la esquina superior para cerrar.

- **PREVIO:** `app-chat-panel` es una columna fija dentro de un grid
  (`320px 1fr`) en `student-ide` y `preview`; siempre visible.
- **POSTERIOR:** `chat-panel` se vuelve autónomo y superpuesto: una burbuja
  flotante abajo-derecha; al hacer clic despliega un drawer derecho de ~380px con
  cierre por "X". El workspace ocupa todo el ancho. Se conservan transcript,
  chips de ayuda, saludo por riesgo y emisión de `transcriptChange`.

---

### 3.3 Feedback de veredicto tipo LeetCode (failingTest)

**Problema (ERROR_REGISTER #2):** el feedback `El desafio aun no pasa la
verificacion (test "palindromo "ana"").` es críptico y no dice qué se esperaba.

- **PREVIO:** el servidor solo devuelve `verdict` + `feedback` textual; no hay
  información de salida esperada vs obtenida.
- **POSTERIOR:** `outcomeFor()` agrega `failingTest: { name, input, expected,
  actual, status }` (primer test que no pasa; salidas recortadas a ~20 líneas /
  400 chars). Se incluye en `executions` (evaluate) y `submissions` (respuesta y
  persistencia). La UI renderiza el veredicto estilo LeetCode: bloques mono
  "Salida esperada" vs "Tu salida".
- **Nota RF:** se revela solo el caso que falla (como LeetCode); el set completo
  de tests ocultos y la solución esperada nunca se exponen (G05-E02-US02).

---

### 3.4 Edición y eliminación de desafíos por docentes (Admin/Profesor)

**Problema (ERROR_REGISTER #3):** los docentes no pueden editar los desafíos
publicados; solo crear y eliminar (soft delete existente pero sin UI).

- **PREVIO:** endpoint único `POST /api/challenges` (create) + `DELETE` (204, soft
  delete). `curl` no expone botones de edición/eliminación en la UI; el wizard no
  edita.
- **POSTERIOR:**
  - Nuevo `PUT /api/challenges/:id` con la misma validación que create (id del
    body = id del path; 404 si no existe). Actualiza campos y `configuration`,
    `metadata.version = +1`, `updatedAt`; conserva `createdAt` y `softDeleted`.
  - UI: en home (docente) y en `published`, botón **Editar** (reabre el wizard
    precargado y hace `updateChallenge`) y botón **Eliminar** (confirmación → soft
    delete). En el JSON publicado queda reflejado el nuevo `version`.
  - El `challengeId` no cambia al editar: las submissions/executions previas
    quedan ligadas a la versión anterior (v1) sin romperse.

---

### 3.5 Multiview izquierdo condicional (desafíos multi-archivo)

**Problema (ERROR_REGISTER #1):** se reemplazó el explorador/árbol de archivos del
IDE original; se pide reintroducirlo como panel desplegable izquierdo, activo
**solo** cuando el desafío requiere más de un archivo.

- **PREVIO:** la vista `student-ide` muestra un único editor con un solo
  `studentEntryContent`; `wizard` edita solo el primer archivo.
- **POSTERIOR:**
  - Modelo del alumno: `studentFiles` (clon de `baseFiles`) + `studentActivePath`;
    el editor edita el archivo activo.
  - Si `baseFiles.length > 1`: se muestra el drawer izquierdo estilo explorer
    original (lista de archivos, selección, edición por archivo). El alumno
    **solo edita archivos base existentes** (decisión #2).
  - Si `baseFiles.length === 1`: editor simple actual (sin drawer).

---

### 3.6 Wizard multi-archivo

**Problema (ERROR_REGISTER #1):** los profesores deben poder crear desafíos
multi-archivo (ej.: frontend completo, backend Spring Boot/Maven, fullstack).

- **PREVIO:** el wizard edita 1 archivo base (entry).
- **POSTERIOR:**
  - Wizard: pestañas por archivo con **Agregar** (path + contenido) y **Quitar**
    (protegido el entry); se conserva al menos el entry.
  - Las plantillas multi-archivo asocian un `configuration.runtime` cuando el
    stack es evaluable en el sandbox (3.7/3.10); sin flag "beta".

---

### 3.7 Runtimes reales en el sandbox (Maven y Frontend clásico)

**Problema:** los desafíos multi-archivo tipo Frontend y Spring Boot/Maven
pedían ejecución, pero el sandbox del prototipo no la soportaba.

- **PREVIO:** el executor respondía `unsupported: 'Maven projects are not
  executed in this prototype.'` y los seeds multi-archivo quedaban sin evaluador
  en el sandbox (422).
- **POSTERIOR (decisión explícita):** `server/executor.mjs` despacha por
  `configuration.runtime`:
  - `maven-test`: ejecuta `mvn -B test` (timeout 600 s) y parsea
    `target/surefire-reports/*.xml`. La evaluación son los tests que provee el
    docente en el proyecto; `mvn test` sin tests ejecutados no da `SUPERADO`.
  - `node-spec`: instala `jsdom` en el directorio del sandbox y corre la spec
    del docente (`tests/*.spec.mjs|*.test.mjs`) con `node --test` (reporter TAP,
    timeout 300 s). El nombre del primer test que falla se refleja en el
    `failingTest`.
  - Sin runtime: comportamiento anterior (esbuild TS, javac/java, stdio).
  - `isEvaluable(challenge)` = `RUNNABLE_SUBTYPES` o runtime válido; la rama de
    suite en `outcomeFor` clasifica `timeout/invalid/setup-error` como
    `ERROR_TECNICO` y `compile-error`/fallos de assert como `FALLADO`.
  - El sandbox limpia `NODE_TEST_CONTEXT` del entorno para que `node --test`
    corra igual aunque el server sea hijo de un runner de test.

---

### 3.8 Atajos de teclado y comprobaciones cerca de los resultados

**Problema (ERROR_REGISTER — NUEVOS):** el veredicto de las comprobaciones se
mostraba al final del layout, muy por debajo de los resultados de ejecución, y los
botones no tenían indicaciones de manejo.

- **PREVIO:** botones sin atajos; `verdict` al fondo (después de la caja de
  salida), desacoplado de los resultados.
- **POSTERIOR:**
  - Badges de atajos en los botones: **Ejecutar `F5`**, **Comprobar `F9`**,
    **Enviar `Ctrl+S`** (estilo LeetCode).
  - `@HostListener('window:keydown')` en `App` gestiona F5/F9/Ctrl+S solo en la
    vista `student-ide` (con `preventDefault` para no disparar refresh/guardado
    del navegador).
  - El veredicto (incluido el bloque LeetCode `expected vs actual`) se muestra en
    un `check-strip` **inmediatamente debajo de la barra de acciones**, antes del
    editor, mapeado al resultado de la comprobación.

---

### 3.9 Restricción de "nueva conversación" del tutor IA

**Problema (ERROR_REGISTER — NUEVOS):** los alumnos no deberían poder crear
conversaciones nuevas del tutor a voluntad; solo ADMIN/PROFESOR.

- **PREVIO:** cualquier rol veía y podía pulsar "Nueva conversación" en el chat.
- **POSTERIOR:** `chat-panel` recibe `@Input() allowReset`; en la vista alumno
  (`allowReset = role() !== 'ALUMNO'`) el botón "Nueva conversación" se oculta.
  El alumno conserva el chat del tutor (asistencia pedagógica RF-IA-19) pero no
  reinicia sesiones: la trazabilidad RF-IA-02 se preserva.
- **Nota documental:** la *consulta* al tutor sí está habilitada para alumnos
  (es la función asistencial); lo restringido es **reiniciar/crear una sesión
  nueva de chat** por parte del alumno.

---

### 3.10 Plantillas multi-archivo evaluables (Spring + Maven, Frontend JS/HTML/CSS) y consignas Angular

**Problema (ERROR_REGISTER — NUEVOS):** faltan plantillas y desafíos de tipo
Spring Boot + Maven (API con tests y POM a completar), Angular standalone con
Reactive/Template Forms y Frontend clásico JS/HTML/CSS, todos con sus tests.

- **PREVIO:** solo existían plantillas de 1 archivo TS (algorithms,
  block-completion, find-bug) y los README de consigna de los otros subtipos.
- **POSTERIOR:**
  - **Seeds** (en `SEED_CHALLENGES`):
    - `sbw-tienda-api-bpr` — Spring Boot + Maven (subtipo `refactoring`, entry
      `pom.xml`, `configuration.runtime: 'maven-test'`): el alumno completa el
      `<dependencies/>` del POM; la evaluación la hacen los tests MockMvc del
      proyecto (SUPERADO con POM completo, FALLADO con el base).
    - `frt-tienda-clasica-js` — Frontend JS/HTML/CSS (`hackathon`,
      `configuration.runtime: 'node-spec'`): incluye `tests/tienda.spec.mjs`
      (jsdom) que el docente provee y que el sandbox ejecuta.
    - `app-producto-form-angular-rf` y `app-pedido-form-angular-tf` — Angular
      standalone con Reactive/Template Forms (`modeling`) **sin runtime**: siguen
      siendo consignas; la corrida del harness Angular (JIT + jsdom)
      queda como **pendiente documentado** de la próxima entrega.
  - **Plantillas** en el wizard (paso "Subtipo"): `CHALLENGE_TEMPLATES` +
    `templateDraft()` cargan el desafío multi-archivo completo y asocian el
    `runtime` correspondiente.
  - Se elimina por completo el flag `experimental`/“beta” del backend, el
    frontend y los textos: lo evaluable se distingue por `configuration.runtime`;
    lo no evaluable se muestra como consigna sin evaluador.
  - **Trato**: todo el texto dirigido a humanos (consignas, comentarios,
    READMEs, mock del tutor, feedback del veredicto y UI) usa el registro formal
    de **"usted"**.

---

### 3.11 Validación anti-trampa: riesgo de integridad de la entrega

**Problema (ERROR_REGISTER — NUEVOS):** el prototipo no detectaba patrones de
copia/pegado o pérdida de foco en la entrega, así que no había forma de señalar
posibles trampas al evaluar una submission.

- **PREVIO:** las submissions solo guardaban `files` + `chatTranscript`; no había
  métrica de integridad.
- **POSTERIOR:**
  - `POST /api/submissions` acepta `integrityEvents` (array de
    `{ type, timestamp, characters?, lines? }`) con tipos permitidos
    `COPY`, `PASTE`, `WINDOW_BLUR`, `WINDOW_FOCUS`. Valida tipo, timestamp ISO y
    valores no negativos (400 si falla).
  - `server/integrity.mjs` expone `assessIntegrityRisk(events, { reference })`,
    función **pura** que ordena por timestamp y devuelve solo
    `{ level, reasons }` (nunca expone métricas/evidencia por fuera).
  - **Niveles** (inglés, decisión #5): `NONE / LOW / MEDIUM / HIGH`.
  - **Reglas de nivel:**
    - Sin eventos (o solo `WINDOW_*` sin peso) → `NONE`/`LOW`.
    - `COPY → FOCUS_LOST` → `MEDIUM` (decisión #8).
    - `COPY → FOCUS_LOST → PASTE` → `HIGH` sin importar el tamaño (decisión #9).
    - Pesos combinados: `copyBeforePaste` / `focusLossBeforePaste` /
      `anyWithoutPrior` (1 c/u) + `PASTE_LARGE` (1) → suma ≥ 2 → `MEDIUM`; resto
      `LOW`.
  - **Razones (orden canónico):** `COPY` (solo sin `COPY_BEFORE_PASTE`),
    `COPY_BEFORE_PASTE`, `PASTE_AFTER_FOCUS_LOSS`, `PASTE_WITHOUT_PRIOR_COPY`,
    tamaño (`PASTE_LARGE` / `PASTE_SMALL`), `WINDOW_FOCUS_LOST`.
  - **Tamaño:** `SMALL` (< 0.10), `MEDIUM` (0.10–0.30), `LARGE` (> 0.30); solo
    `LARGE` suma peso y razón (decisión #6).
  - El resultado se persiste y se devuelve en la respuesta de la submission como
    `integrityRisk`.

---

## 4. Archivos afectados

| Archivo | Tipo de cambio |
|---------|----------------|
| `server/chat.mjs` | Mock del tutor en registro formal (usted) y reglas de riesgo (RF-IA-19/20). |
| `server/executor.mjs` | `EXECUTION_RUNTIMES`, dispatch por `runtime` en `executeFiles`, `runMavenSuite`/`runNodeSpecSuite` (TAP), `parseSurefireTests`, limpieza de `NODE_TEST_CONTEXT`. |
| `server/index.mjs` | `isEvaluable`, rama de suite en `outcomeFor`, `runtime` en listado/creación, seeds con runtime y copy formal; se elimina `metadata.experimental`; previewRun/envío con runtime. |
| `server/practical.test.mjs` | Tests: runtime en seeds (sin flag experimental), evaluaciones reales Maven SUPERADO/FALLADO y Frontend SUPERADO/FALLADO con nombre del test, 422 de Angular, runtime inválido 400. |
| `server/integrity.mjs` | `INTEGRITY_RISK_LEVELS` (`NONE/LOW/MEDIUM/HIGH`), `INTEGRITY_PASTE_CATEGORIES`, `SIZE_RATIO_THRESHOLDS` y `assessIntegrityRisk(events, options)` (función pura `{ level, reasons }`). |
| `server/index.mjs` | `INTEGRITY_EVENT_TYPES`, `sanitizeIntegrityEvents` (validación 400) y el cálculo de `integrityRisk` en `POST /api/submissions` (persistido y devuelto). |
| `src/app/challenge-types.ts` | `IntegrityRiskLevel = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH'`, `IntegrityRisk { level, reasons }` e `integrityRisk?` en la respuesta de submission. |
| `src/app/challenge-types.ts` | `MigrationSandboxRuntime`, `runtime` en Configuration/Draft/payload/lista; se elimina `experimental`; `tests` en resultados de preview/execution. |
| `src/app/compile.service.ts` | `previewRun()` acepta `runtime`. |
| `src/app/chat-panel.{ts,html,css}` | Textos formales, "Usted" en saludos/quick-actions/placeholder; `@Input() allowReset` (3.9). |
| `src/app/app.ts` | Modal de eliminación (`deleteTarget`/`askDelete`/`confirmDelete`, Esc y backdrop cancelan); `isRunnable` por runtime; sin flag beta; textos formales. |
| `src/app/app.html` | Modal de confirmación centrado con detalle del soft delete; tags de runtime; sin badges beta; copy formal. |
| `src/app/app.css` | `.modal-backdrop`/`.modal`; se elimina `.badge-beta`. |
| `src/app/challenge-drafts.ts` | `runtime` en `CHALLENGE_TEMPLATES`, spec jsdom en la plantilla frontend, copy formal sin beta. |

## 5. Verificación

- `node --test server/practical.test.mjs` — 30 tests verdes (incluye evaluaciones
  reales de Maven `mvn test` y Frontend `node --test` + jsdom; requiere `~/.m2`
  tibio y acceso a npm para jsdom). *Los tests de integridad anti-trampa se
  eliminaron por decisión de alcance (solo se dejan los del prototipo).*
- `npm run build`
- Smoke: `npm run dev` → API `http://localhost:3100/api/challenges` y frontend
  `http://localhost:4200` responden 200.

---

## 6. Registro de decisiones (ASR)

| Código | Decisión | Justificación |
|--------|----------|---------------|
| D-01 | `challengeId` estable al editar; `metadata.version +1` | El contrato G05-E01-US01 identifica al desafío por id; un id nuevo rompería el historial de entregas. |
| D-02 | Solo se revela el primer `failingTest` (expected/actual) | Compromiso entre feedback usable (LeetCode) y "no exponer tests ocultos" (G05-E02-US02). |
| D-03 | El alumno edita solo archivos base existentes | Mantiene el enunciado del desafío intacto; el sandbox recibe siempre el set definido por el docente. |
| D-04 | Chat como burbuja/drawer derecho superpuesto | Aprovecha el ancho del workspace y respeta el requisito "chat primero" sin sacrificar la edición. |
| D-05 | Multiview izquierdo solo si `baseFiles.length > 1` | Evita ruido visual; el IDE simple es la experiencia por defecto para desafíos de un archivo. |
| D-06 | Evaluación real en el sandbox por `configuration.runtime` (`maven-test`, `node-spec`); se elimina el flag "beta" | El sandbox resuelve Spring Boot/Maven y Frontend clásico con los tests del docente; lo sin runtime (Angular) queda como consigna con pendiente documentado. |
| D-07 | Atajos F5/Ejecutar, F9/Comprobar, Ctrl+S/Enviar; veredicto en strip bajo la barra de acciones | Coincide con el feedback "las comprobaciones no se mapean bien, se muestran muy por debajo" y con la expectativa de shortcuts al estilo género (REPL/LeetCode). |
| D-08 | "Nueva conversación" del tutor solo para ADMIN/PROFESOR | Los alumnos no deben poder resetear el chat (trazabilidad RF-IA-02); la consulta del tutor queda habilitada (RF-IA-19). |
| D-09 | Trato formal "usted" en todo el texto dirigido a humanos | Consignas, comentarios de código, READMEs, mock del tutor y feedback del veredicto usan un registro formal y consistente. |
| D-10 | Modal de confirmación centrado/responsive para eliminar (sin `window.confirm`) | Confirma el soft delete con su detalle real (deja de listarse, conserva challengeId/versiones/historial, reversible); Esc y click fuera cancelan. |
| D-11 | Cálculo de `integrityRisk { level, reasons }` como función pura en `server/integrity.mjs` | Permite evaluar integridad de forma testeable y determinista; el output público no filtra evidencia ni métricas. |
| D-12 | Niveles de integridad en inglés `NONE/LOW/MEDIUM/HIGH` (separados del `RiskLevel` de desafío) | Evita colisión semántica entre "riesgo de desafío" y "riesgo de integridad"; termina en inglés la capa anti-trampa. |
| D-13 | Tamaños de PASTE `SMALL/MEDIUM/LARGE`, sin `MASSIVE`; solo `PASTE_LARGE` (ratio > 0.30) eleva a riesgo | `MASSIVE`/`MODERATE` no cambiaban el nivel, así que se colapsan; el único tamaño con efecto real es un paste grande. |
| D-14 | Razón `COPY` solo cuando no hay `COPY_BEFORE_PASTE` | `COPY` seguido de `PASTE` ya se explica con `COPY_BEFORE_PASTE`; emitir ambos era redundante. |
| D-15 | `COPY → pérdida de foco` eleva a `MEDIUM`; `COPY → foco → PASTE` eleva a `HIGH` sin importar el tamaño | Copiar y luego perder el foco indica que consultó fuera; copiar → perder foco → pegar es el patrón clásico de copia externa, más severo. |
| D-16 | Eliminación de tests anti-trampa del archivo de tests del prototipo | Decisión de alcance: la validación de integridad queda documentada en `DESIGN_DECISIONS`, pero sus tests se retiran del set del prototipo. |