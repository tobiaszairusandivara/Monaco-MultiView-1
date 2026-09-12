import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import { join } from 'node:path';
import { triggersAntiLeak, normalizeText } from '../server/chat.mjs';

const PORT = 3901;
const BASE = `http://localhost:${PORT}`;
let child;

async function request(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

async function fullChallenge(id) {
  const { body } = await request(`/api/challenges/${id}`);
  return body.challenge;
}

before(async () => {
  const dataDir = await mkdtemp(join(os.tmpdir(), 'mmv-test-data-'));
  child = spawn(process.execPath, ['server/index.mjs'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(PORT), MMV_DATA_DIR: dataDir },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    const onData = (chunk) => {
      if (String(chunk).includes('listening on')) resolve();
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', reject);
    setTimeout(() => reject(new Error('Server did not start in time.')), 15000).unref();
  });
  await request('/api/challenges');
});

after(() => {
  if (child && !child.killed) child.kill();
});

describe('create and list challenges (G05-E01-US01)', () => {
  test('GET /api/challenges returns seeded runnable demos with riskLevel', async () => {
    const { status, body } = await request('/api/challenges');
    assert.equal(status, 200);
    assert.equal(body.ok, true);
    const subtypes = body.challenges.map((c) => c.subtype);
    for (const s of ['algorithms', 'block-completion', 'find-bug']) {
      assert.ok(subtypes.includes(s), `expected seeded subtype ${s}`);
    }
    for (const c of body.challenges) {
      assert.ok(['ALTO', 'MEDIO', 'BAJO'].includes(c.riskLevel));
      assert.ok(typeof c.configuration.language === 'string');
      assert.ok(typeof c.configuration.testCount === 'number');
      assert.equal(typeof c.metadata.softDeleted, 'boolean');
    }
  });

  test('migration seeds expose a sandbox runtime and no experimental flag', async () => {
    const { body } = await request('/api/challenges');
    for (const c of body.challenges) {
      assert.equal(c.metadata.experimental, undefined, `${c.challengeId} must not be flagged experimental`);
    }
    const maven = await fullChallenge('sbw-tienda-api-bpr');
    assert.equal(maven.configuration.runtime, 'maven-test');
    assert.equal(maven.configuration.entry, 'pom.xml');
    assert.ok(maven.configuration.baseFiles.some((f) => f.path.endsWith('.java')));

    const frontend = await fullChallenge('frt-tienda-clasica-js');
    assert.equal(frontend.configuration.runtime, 'node-spec');
    assert.ok(frontend.configuration.baseFiles.some((f) => f.path === 'tests/tienda.spec.mjs'));

    for (const id of ['app-producto-form-angular-rf', 'app-pedido-form-angular-tf']) {
      const listed = body.challenges.find((c) => c.challengeId === id);
      assert.ok(listed, `expected Angular seed ${id}`);
      assert.equal(listed.configuration.runtime, undefined, `${id} is not evaluable in this iteration`);
      assert.ok(listed.configuration.fileCount > 1, `${id} must be multi-file`);
      assert.ok(listed.configuration.testCount > 0, `${id} should include its provided spec`);
    }
  });

  test('POST /api/challenges creates and is returned with 201', async () => {
    const payload = {
      challengeId: `test-algo-${Date.now()}`,
      courseCohortId: 'TUP-2026-02',
      title: 'Sumar dos numeros',
      topic: 'Basicos',
      subtype: 'algorithms',
      difficulty: 'BASICO',
      configuration: {
        language: 'typescript',
        entry: 'main.ts',
        baseFiles: [{ path: 'main.ts', content: 'console.log(1 + 1);' }],
        hiddenTests: [{ name: 'suma', expected: '2' }],
        expectedSolution: 'console.log(1 + 1);',
      },
    };
    const { status, body } = await request('/api/challenges', { method: 'POST', body: payload });
    assert.equal(status, 201);
    assert.equal(body.ok, true);
    assert.equal(body.challenge.riskLevel, 'MEDIO');
    const again = await request('/api/challenges');
    assert.ok(again.body.challenges.some((c) => c.challengeId === payload.challengeId));
  });

  test('POST /api/challenges without courseCohortId returns 400', async () => {
    const { status, body } = await request('/api/challenges', {
      method: 'POST',
      body: { challengeId: 'x', title: 'x', subtype: 'algorithms', configuration: { language: 'typescript', baseFiles: [], hiddenTests: [], expectedSolution: '' } },
    });
    assert.equal(status, 400);
    assert.ok(body.errors.some((e) => e.includes('courseCohortId')));
  });

  test('DELETE /api/challenges/:id soft-deletes (204) and hides the record', async () => {
    const created = await request('/api/challenges', {
      method: 'POST',
      body: {
        challengeId: `test-del-${Date.now()}`,
        courseCohortId: 'TUP-2026-02',
        title: 'A borrar',
        subtype: 'algorithms',
        difficulty: 'BASICO',
        configuration: {
          language: 'typescript',
          entry: 'main.ts',
          baseFiles: [{ path: 'main.ts', content: 'console.log("x");' }],
          hiddenTests: [{ name: 't', expected: 'x' }],
          expectedSolution: 'console.log("x");',
        },
      },
    });
    const id = created.body.challenge.challengeId;
    const del = await request(`/api/challenges/${id}`, { method: 'DELETE' });
    assert.equal(del.status, 204);
    const got = await request(`/api/challenges/${id}`);
    assert.equal(got.status, 404);
    const list = await request('/api/challenges');
    assert.ok(!list.body.challenges.some((c) => c.challengeId === id));
  });

  test('DELETE is idempotent and recreating the same id resurrects without duplicates', async () => {
    const id = `test-lifecycle-${Date.now()}`;
    const payload = (title) => ({
      challengeId: id,
      courseCohortId: 'TUP-2026-02',
      title,
      topic: 'Ciclo de vida',
      subtype: 'algorithms',
      difficulty: 'BASICO',
      configuration: {
        language: 'typescript',
        entry: 'main.ts',
        baseFiles: [{ path: 'main.ts', content: 'console.log(1 + 1);' }],
        hiddenTests: [{ name: 'suma', expected: '2' }],
        expectedSolution: 'console.log(1 + 1);',
      },
    });

    const created = await request('/api/challenges', { method: 'POST', body: payload('Version A') });
    assert.equal(created.status, 201);
    assert.equal(created.body.challenge.metadata.version, 1);

    const first = await request(`/api/challenges/${id}`, { method: 'DELETE' });
    assert.equal(first.status, 204);

    const again = await request(`/api/challenges/${id}`, { method: 'DELETE' });
    assert.equal(again.status, 204, 'DELETE must be idempotent on an already-deleted id');

    const resurrected = await request('/api/challenges', { method: 'POST', body: payload('Version B') });
    assert.equal(resurrected.status, 201);
    assert.equal(resurrected.body.challenge.title, 'Version B');
    assert.equal(resurrected.body.challenge.metadata.version, 2, 're-create must bump version without duplicating');
    assert.equal(resurrected.body.challenge.metadata.softDeleted, false);

    const listed = await request('/api/challenges');
    const matches = listed.body.challenges.filter((c) => c.challengeId === id);
    assert.equal(matches.length, 1, 'the id must appear exactly once in the list');

    const final = await request(`/api/challenges/${id}`, { method: 'DELETE' });
    assert.equal(final.status, 204);
    const gone = await request(`/api/challenges/${id}`);
    assert.equal(gone.status, 404);
  });
});

describe('durationMs nullable validation (regression: editar un desafío no-hackathon)', () => {
  test('POST accepts durationMs: null and persists it', async () => {
    const id = `test-duration-null-${Date.now()}`;
    const { status, body } = await request('/api/challenges', {
      method: 'POST',
      body: {
        challengeId: id,
        courseCohortId: 'TUP-2026-02',
        title: 'Refactor base',
        topic: 'Refactoring',
        subtype: 'refactoring',
        difficulty: 'MEDIO',
        mandatory: false,
        durationMs: null,
        configuration: {
          language: 'typescript',
          entry: 'main.ts',
          baseFiles: [{ path: 'main.ts', content: '// codigo a refactorizar' }],
          hiddenTests: [],
          expectedSolution: '',
        },
      },
    });
    assert.equal(status, 201);
    assert.equal(body.challenge.durationMs, null);
  });

  test('PUT on a non-hackathon challenge with durationMs: null does not fail (regression)', async () => {
    const id = `test-duration-update-${Date.now()}`;
    const base = {
      challengeId: id,
      courseCohortId: 'TUP-2026-02',
      title: 'Algoritmo base',
      topic: 'Basicos',
      subtype: 'algorithms',
      difficulty: 'BASICO',
      mandatory: true,
      durationMs: null,
      configuration: {
        language: 'typescript',
        entry: 'main.ts',
        baseFiles: [{ path: 'main.ts', content: 'console.log(1 + 1);' }],
        hiddenTests: [{ name: 'suma', expected: '2' }],
        expectedSolution: 'console.log(1 + 1);',
      },
    };
    const created = await request('/api/challenges', { method: 'POST', body: base });
    assert.equal(created.status, 201);
    const { status, body } = await request(`/api/challenges/${id}`, {
      method: 'PUT',
      body: { ...base, title: 'Algoritmo corregido', durationMs: null },
    });
    assert.equal(status, 200);
    assert.equal(body.challenge.title, 'Algoritmo corregido');
    assert.equal(body.challenge.durationMs, null);
  });

  test('hackathon seed exposes its time limit', async () => {
    const challenge = await fullChallenge('frt-tienda-clasica-js');
    assert.equal(challenge.durationMs, 5400000);
  });

  test('POST rejects a negative durationMs with 400', async () => {
    const { status, body } = await request('/api/challenges', {
      method: 'POST',
      body: {
        challengeId: `test-duration-bad-${Date.now()}`,
        courseCohortId: 'TUP-2026-02',
        title: 'Mal',
        subtype: 'hackathon',
        difficulty: 'BASICO',
        durationMs: -1,
        configuration: {
          language: 'typescript',
          entry: 'main.ts',
          baseFiles: [{ path: 'main.ts', content: 'console.log(1);' }],
          hiddenTests: [],
        },
      },
    });
    assert.equal(status, 400);
    assert.ok(body.errors.some((e) => e.includes('durationMs')));
  });
});

describe('execution and verdicts (G05-E02)', () => {
  test('expected solution for algorithms seed is SUPERADO', async () => {
    const challenge = await fullChallenge('dsa-total-carrito-medio');
    const files = [{ path: challenge.configuration.entry, content: challenge.configuration.expectedSolution }];
    const { status, body } = await request(`/api/practical-challenges/${challenge.challengeId}/executions`, {
      method: 'POST',
      body: { files, evaluate: true },
    });
    assert.equal(status, 200);
    assert.equal(body.verdict, 'SUPERADO');
  });

  test('incomplete base files for algorithms seed is FALLADO', async () => {
    const challenge = await fullChallenge('dsa-total-carrito-medio');
    const files = [{ path: challenge.configuration.entry, content: challenge.configuration.baseFiles[0].content }];
    const { body } = await request(`/api/practical-challenges/${challenge.challengeId}/executions`, {
      method: 'POST',
      body: { files, evaluate: true },
    });
    assert.equal(body.verdict, 'FALLADO');
  });

  test('non-evaluate execution returns raw output without revealing tests', async () => {
    const challenge = await fullChallenge('dsa-total-carrito-medio');
    const files = [{ path: challenge.configuration.entry, content: challenge.configuration.expectedSolution }];
    const { body } = await request(`/api/practical-challenges/${challenge.challengeId}/executions`, {
      method: 'POST',
      body: { files, evaluate: false },
    });
    assert.equal(body.status, 'ok');
    assert.match(body.output.trim(), /^35$/);
    assert.equal(body.verdict, undefined);
    assert.equal(body.feedback, undefined);
  });

  test('preview-run runs arbitrary files (teacher sanity check without a challenge)', async () => {
    const { status, body } = await request('/api/preview-run', {
      method: 'POST',
      body: {
        files: [{ path: 'main.ts', content: 'console.log("hola mundo");' }],
        entry: 'main.ts',
        input: '',
      },
    });
    assert.equal(status, 200);
    assert.equal(body.status, 'ok');
    assert.equal(body.output.trim(), 'hola mundo');
  });

  test('subtype sin runtime no es evaluable (422)', async () => {
    const created = await request('/api/challenges', {
      method: 'POST',
      body: {
        challengeId: `test-sin-runtime-${Date.now()}`,
        courseCohortId: 'TUP-2026-02',
        title: 'Refactor a revisar',
        subtype: 'refactoring',
        difficulty: 'AVANZADO',
        configuration: {
          language: 'typescript',
          entry: 'main.ts',
          baseFiles: [{ path: 'main.ts', content: '// codigo a refactorizar' }],
          hiddenTests: [],
        },
      },
    });
    const id = created.body.challenge.challengeId;
    const { status } = await request(`/api/practical-challenges/${id}/executions`, {
      method: 'POST',
      body: { files: [{ path: 'main.ts', content: 'console.log("x");' }], evaluate: true },
    });
    assert.equal(status, 422);
  });

  test('los seeds Angular sin runtime no son evaluables (422)', async () => {
    for (const id of ['app-producto-form-angular-rf', 'app-pedido-form-angular-tf']) {
      const { status } = await request(`/api/practical-challenges/${id}/executions`, {
        method: 'POST',
        body: { files: [{ path: 'src/app/product-form.component.ts', content: '// consigna' }], evaluate: true },
      });
      assert.equal(status, 422, `${id} should be 422`);
    }
  });
});

describe('sandbox runtimes (Maven y Frontend clÃ¡sico)', () => {
  test('maven seed evaluates SUPERADO with a complete POM', async () => {
    const challenge = await fullChallenge('sbw-tienda-api-bpr');
    const completePom = `<?xml version="1.0" encoding="UTF-8"?>
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
  <properties>
    <java.version>17</java.version>
  </properties>
  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-test</artifactId>
      <scope>test</scope>
    </dependency>
  </dependencies>
</project>
`;
    const files = challenge.configuration.baseFiles
      .filter((f) => f.path !== 'README.md')
      .map((f) => (f.path === 'pom.xml' ? { path: f.path, content: completePom } : f));
    const { status, body } = await request(`/api/practical-challenges/${challenge.challengeId}/executions`, {
      method: 'POST',
      body: { files, evaluate: true },
    });
    assert.equal(status, 200);
    assert.equal(body.verdict, 'SUPERADO');
  });

  test('maven seed is FALLADO with the incomplete base POM', async () => {
    const challenge = await fullChallenge('sbw-tienda-api-bpr');
    const files = challenge.configuration.baseFiles.filter((f) => f.path !== 'README.md');
    const { status, body } = await request(`/api/practical-challenges/${challenge.challengeId}/executions`, {
      method: 'POST',
      body: { files, evaluate: true },
    });
    assert.equal(status, 200);
    assert.equal(body.verdict, 'FALLADO');
  });

  test('frontend seed evaluates SUPERADO with its own working script', async () => {
    const challenge = await fullChallenge('frt-tienda-clasica-js');
    const files = challenge.configuration.baseFiles.filter((f) => f.path !== 'README.md');
    const { status, body } = await request(`/api/practical-challenges/${challenge.challengeId}/executions`, {
      method: 'POST',
      body: { files, evaluate: true },
    });
    assert.equal(status, 200);
    assert.equal(body.verdict, 'SUPERADO');
  });

  test('frontend seed is FALLADO when the behavior is broken', async () => {
    const challenge = await fullChallenge('frt-tienda-clasica-js');
    const broken = challenge.configuration.baseFiles
      .filter((f) => f.path !== 'README.md')
      .map((f) =>
        f.path === 'script.js'
          ? { path: f.path, content: '// sin listeners: la pagina no agrega items\n' }
          : f,
      );
    const { status, body } = await request(`/api/practical-challenges/${challenge.challengeId}/executions`, {
      method: 'POST',
      body: { files: broken, evaluate: true },
    });
    assert.equal(status, 200);
    assert.equal(body.verdict, 'FALLADO');
    assert.ok(body.failingTest);
    assert.equal(body.failingTest.name, 'agregar un item renderiza un <li> con ese texto');
    assert.equal(body.failingTest.status, 'assertion');
  });

  test('invalid runtime is rejected at creation (400)', async () => {
    const { status, body } = await request('/api/challenges', {
      method: 'POST',
      body: {
        challengeId: `test-bad-runtime-${Date.now()}`,
        courseCohortId: 'TUP-2026-02',
        title: 'Runtime invalido',
        subtype: 'refactoring',
        difficulty: 'MEDIO',
        configuration: {
          language: 'java',
          entry: 'pom.xml',
          runtime: 'docker-run',
          baseFiles: [{ path: 'pom.xml', content: '<project/>' }],
          hiddenTests: [],
        },
      },
    });
    assert.equal(status, 400);
    assert.ok(body.errors.some((e) => e.includes('configuration.runtime must be one of')));
  });
});

describe('submissions (G05-E04 contract to G3)', () => {
  test('missing cohort returns 400', async () => {
    const challenge = await fullChallenge('dsa-total-carrito-medio');
    const { status } = await request('/api/submissions', {
      method: 'POST',
      body: { challengeId: challenge.challengeId, files: [] },
    });
    assert.equal(status, 400);
  });

  test('SUPERADO submission returns verdict and feedback', async () => {
    const challenge = await fullChallenge('dsa-total-carrito-medio');
    const files = [{ path: challenge.configuration.entry, content: challenge.configuration.expectedSolution }];
    const { status, body } = await request('/api/submissions', {
      method: 'POST',
      body: {
        challengeId: challenge.challengeId,
        courseCohortId: challenge.courseCohortId,
        studentId: 'alumno-test',
        files,
        chatTranscript: [{ role: 'user', text: 'ayudame' }],
      },
    });
    assert.equal(status, 201);
    assert.equal(body.verdict, 'SUPERADO');
    assert.ok(body.submissionId);
    assert.ok(body.feedback.length > 0);
  });

  test('FALLADO submission stores first failingTest (expected vs actual)', async () => {
    const challenge = await fullChallenge('fb-promedio-alto');
    const { status, body } = await request('/api/submissions', {
      method: 'POST',
      body: {
        challengeId: challenge.challengeId,
        courseCohortId: challenge.courseCohortId,
        studentId: 'alumno-test',
        files: challenge.configuration.baseFiles,
      },
    });
    assert.equal(status, 201);
    assert.equal(body.verdict, 'FALLADO');
    assert.ok(body.failingTest, 'failingTest must be present on a failed submission');
    assert.equal(body.failingTest.name, 'salida completa esperada');
    assert.equal(body.failingTest.expected, '4\n6');
    assert.match(body.failingTest.actual, /NaN/);
    assert.equal(body.failingTest.status, 'mismatch');
  });

});


describe('verdict feedback (failingTest, LeetCode-style)', () => {
  test('FALLADO execution exposes the first failing test with expected and actual', async () => {
    const challenge = await fullChallenge('fb-promedio-alto');
    const { body } = await request(`/api/practical-challenges/${challenge.challengeId}/executions`, {
      method: 'POST',
      body: { files: challenge.configuration.baseFiles, evaluate: true },
    });
    assert.equal(body.verdict, 'FALLADO');
    assert.ok(body.failingTest, 'failingTest must be present on a failed evaluation');
    assert.equal(body.failingTest.expected, '4\n6');
    assert.match(body.failingTest.actual, /NaN/);
    assert.equal(body.failingTest.status, 'mismatch');
  });

  test('SUPERADO execution has no failingTest', async () => {
    const challenge = await fullChallenge('dsa-total-carrito-medio');
    const files = [{ path: challenge.configuration.entry, content: challenge.configuration.expectedSolution }];
    const { body } = await request(`/api/practical-challenges/${challenge.challengeId}/executions`, {
      method: 'POST',
      body: { files, evaluate: true },
    });
    assert.equal(body.verdict, 'SUPERADO');
    assert.equal(body.failingTest, null);
  });
});

describe('update challenges (PUT /api/challenges/:id, D-01)', () => {
  test('PUT updates fields and bumps metadata.version keeping a stable challengeId', async () => {
    const id = `test-put-${Date.now()}`;
    const payload = {
      challengeId: id,
      courseCohortId: 'TUP-2026-02',
      title: 'Version inicial',
      topic: 'Basicos',
      subtype: 'algorithms',
      difficulty: 'BASICO',
      configuration: {
        language: 'typescript',
        entry: 'main.ts',
        baseFiles: [{ path: 'main.ts', content: 'console.log(1 + 1);' }],
        hiddenTests: [{ name: 'suma', expected: '2' }],
        expectedSolution: 'console.log(1 + 1);',
      },
    };
    const created = await request('/api/challenges', { method: 'POST', body: payload });
    assert.equal(created.status, 201);
    assert.equal(created.body.challenge.metadata.version, 1);

    const { status, body } = await request(`/api/challenges/${id}`, {
      method: 'PUT',
      body: { ...payload, title: 'Version corregida', difficulty: 'AVANZADO' },
    });
    assert.equal(status, 200);
    assert.equal(body.challenge.challengeId, id);
    assert.equal(body.challenge.title, 'Version corregida');
    assert.equal(body.challenge.difficulty, 'AVANZADO');
    assert.equal(body.challenge.riskLevel, 'MEDIO');
    assert.equal(body.challenge.metadata.version, 2);
    assert.equal(body.challenge.metadata.experimental, undefined);
    assert.equal(body.challenge.metadata.createdAt, created.body.challenge.metadata.createdAt);

    const list = await request('/api/challenges');
    const listed = list.body.challenges.find((c) => c.challengeId === id);
    assert.equal(listed.title, 'Version corregida');
  });

  test('PUT with unknown challengeId returns 404', async () => {
    const payload = {
      challengeId: 'no-existe',
      courseCohortId: 'TUP-2026-02',
      title: 'x',
      subtype: 'algorithms',
      configuration: {
        language: 'typescript',
        entry: 'main.ts',
        baseFiles: [{ path: 'main.ts', content: 'console.log(1);' }],
        hiddenTests: [{ name: 't', expected: '1' }],
        expectedSolution: 'console.log(1);',
      },
    };
    const { status } = await request(`/api/challenges/${payload.challengeId}`, { method: 'PUT', body: payload });
    assert.equal(status, 404);
  });

  test('PUT with mismatched body challengeId returns 400', async () => {
    const challenge = await fullChallenge('dsa-total-carrito-medio');
    const { status } = await request('/api/challenges/otro-id', {
      method: 'PUT',
      body: {
        challengeId: 'dsa-total-carrito-medio',
        courseCohortId: challenge.courseCohortId,
        configuration: challenge.configuration,
      },
    });
    assert.equal(status, 400);
  });
});

describe('chat safeguards (RF-IA-19/20/21)', () => {
  test('GET /api/chat/status reports provider when unset', async () => {
    const { status, body } = await request('/api/chat/status');
    assert.equal(status, 200);
    assert.equal(body.chat.provider, 'stub');
  });

  test('riskLevel is derived server-side from subtype (RF-IA-21)', async () => {
    const algo = await fullChallenge('dsa-total-carrito-medio');
    const { body } = await request('/api/chat', {
      method: 'POST',
      body: { challengeId: algo.challengeId, messages: [{ role: 'user', text: 'como avanzo?' }], riskLevel: 'BAJO' },
    });
    assert.equal(body.riskLevel, 'MEDIO');
  });

  test('stub reply matches the resolved risk (regression D-01: never MEDIO for ALTO)', async () => {
    const alto = await fullChallenge('blq-palindromo-alto');
    const altoReply = await request('/api/chat', {
      method: 'POST',
      body: { challengeId: alto.challengeId, messages: [{ role: 'user', text: 'dame una pista' }] },
    });
    assert.equal(altoReply.body.riskLevel, 'ALTO');
    assert.match(altoReply.body.reply, /\(riesgo ALTO\)/);

    const medio = await fullChallenge('dsa-total-carrito-medio');
    const medioReply = await request('/api/chat', {
      method: 'POST',
      body: { challengeId: medio.challengeId, messages: [{ role: 'user', text: 'dame una pista' }] },
    });
    assert.equal(medioReply.body.riskLevel, 'MEDIO');
    assert.match(medioReply.body.reply, /\(riesgo MEDIO\)/);
  });

  test('stub tutor replies without leaking the solution for ALTO', async () => {
    const challenge = await fullChallenge('blq-palindromo-alto');
    const { body } = await request('/api/chat', {
      method: 'POST',
      body: { challengeId: challenge.challengeId, messages: [{ role: 'user', text: 'dame la solucion' }] },
    });
    assert.equal(body.riskLevel, 'ALTO');
    assert.ok(body.reply.length > 0);
    assert.equal(body.blocked, false);
    assert.ok(!body.reply.includes('return limpio') && !body.reply.includes('split'));
  });

  test('triggersAntiLeak blocks near-verbatim solution responses', () => {
    const expected = 'function esPalindromo(texto) { return texto === texto.split("").reverse().join(""); }';
    const candidate = 'function esPalindromo(texto) { return texto === texto.split("").reverse().join(""); }';
    assert.equal(triggersAntiLeak(candidate, expected), true);
    assert.equal(triggersAntiLeak('no se como resolverlo', expected), false);
    assert.equal(normalizeText('  Hola   Mundo!! '), 'hola mundo');
  });
});
