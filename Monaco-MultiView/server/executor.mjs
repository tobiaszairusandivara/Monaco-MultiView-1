import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import esbuild from 'esbuild';

const TIMEOUT_MS = 300 * 1000;
const MAVEN_TIMEOUT_MS = 600 * 1000;
const NODE_SPEC_TIMEOUT_MS = 300 * 1000;
const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;

export const EXECUTION_RUNTIMES = ['maven-test', 'node-spec'];

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

function tsEntryOf(files, entry) {
  if (entry && files.some((f) => f.path === entry)) return entry;
  if (files.some((f) => f.path === 'main.ts')) return 'main.ts';
  if (files.some((f) => f.path === 'index.ts')) return 'index.ts';
  const root = files.find((f) => /\.(ts|js)$/.test(f.path) && !f.path.includes('/'));
  return root?.path ?? null;
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

const utf8Env = () => {
  const env = { ...process.env, MAVEN_OPTS: '-Dfile.encoding=UTF-8' };
  delete env.NODE_TEST_CONTEXT;
  return env;
};

function mavenLauncher(args) {
  if (process.platform === 'win32') {
    return { command: 'cmd.exe', args: ['/d', '/s', '/c', `mvn.cmd ${args.join(' ')}`], shell: false };
  }
  return { command: 'mvn', args, shell: false };
}

function streamCell(task, label) {
  const stdout = (task.stdout ?? '').toString();
  const stderr = (task.stderr ?? '').toString();
  if (task.error?.code === 'ETIMEDOUT') {
    return { status: 'timeout', output: stdout, error: `${label} exceeded the time limit.` };
  }
  return { output: `${stdout}${stderr}`, ok: task.status === 0 };
}

function memoryOf(task) {
  try {
    return Number(task.resourceUsage?.().maxRSS || 0) * 1024;
  } catch {
    return 0;
  }
}

function clip(text, maxLines = 30, maxChars = 800) {
  const lines = String(text ?? '')
    .split('\n')
    .map((line) => line.trimEnd());
  let output = lines.slice(0, maxLines).join('\n');
  if (output.length > maxChars) {
    output = `${output.slice(0, maxChars)}…`;
  }
  return output;
}

function cleanXml(text) {
  return String(text ?? '')
    .replace(/<!\[CDATA\[/g, '')
    .replace(/\]\]>/g, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseSurefireTests(directory) {
  const reportsDir = join(directory, 'target', 'surefire-reports');
  if (!existsSync(reportsDir)) return [];
  const tests = [];
  for (const file of readdirSync(reportsDir).filter((f) => f.endsWith('.xml'))) {
    const xml = readFileSync(join(reportsDir, file), 'utf8');
    const parts = xml.split('<testcase');
    for (const part of parts.slice(1)) {
      const attrEnd = part.indexOf('>');
      const attrs = attrEnd >= 0 ? part.slice(0, attrEnd) : part;
      const body = attrEnd >= 0 ? part.slice(attrEnd + 1) : '';
      const name = attrs.match(/name="([^"]*)"/)?.[1] ?? 'test';
      const failure = body.match(/<(?:failure|error)\b[^>]*>(.*?)<\/(?:failure|error)>/s);
      const messageAttr = body.match(/<(?:failure|error)\b[^>]*\smessage="([^"]*)"/)?.[1] ?? '';
      tests.push({
        name,
        passed: !failure,
        message: clip(cleanXml(messageAttr || (failure ? failure[1] : ''))),
      });
    }
  }
  return tests;
}

function extractMavenErrors(output) {
  const lines = String(output ?? '')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.includes('ERROR') || line.includes('error:'));
  return clip(lines.slice(0, 20).join('\n'));
}

async function runMavenSuite(directory) {
  const started = Date.now();
  const launcher = mavenLauncher(['-B', '-Dfile.encoding=UTF-8', '-f', 'pom.xml', 'test']);
  let task;
  try {
    task = spawnSync(launcher.command, launcher.args, {
      cwd: directory,
      env: utf8Env(),
      timeout: MAVEN_TIMEOUT_MS,
      maxBuffer: MAX_OUTPUT_BYTES,
    });
  } catch (error) {
    return {
      status: 'invalid',
      output: '',
      error: `Maven no está disponible en este entorno: ${error.message ?? String(error)}`,
      tests: [],
      timeMs: Date.now() - started,
      memoryBytes: 0,
    };
  }
  const output = ((task.stdout ?? '') + (task.stderr ?? '')).toString();
  const tests = parseSurefireTests(directory);
  const elapsed = Date.now() - started;
  if (task.error?.code === 'ETIMEDOUT') {
    return { status: 'timeout', output, error: 'Maven exceeded the time limit.', tests, timeMs: elapsed, memoryBytes: memoryOf(task) };
  }
  if (task.status === 0 || /BUILD SUCCESS/.test(output)) {
    if (tests.length === 0) {
      return { status: 'fail', output: clip(output, 60, 4000), error: 'La suite no ejecutó ningún test.', tests, timeMs: elapsed, memoryBytes: memoryOf(task) };
    }
    return { status: 'ok', output: clip(output, 60, 4000), error: '', tests, timeMs: elapsed, memoryBytes: memoryOf(task) };
  }
  const isCompileError =
    /COMPILATION ERROR/.test(output) ||
    /cannot find symbol/.test(output) ||
    /Failed to execute goal.*maven-compiler-plugin/.test(output) ||
    (tests.length === 0 && !/Tests run:/.test(output));
  if (isCompileError) {
    return { status: 'compile-error', output: clip(output, 40, 3000), error: extractMavenErrors(output), tests: [], timeMs: elapsed, memoryBytes: memoryOf(task) };
  }
  return { status: 'fail', output: clip(output, 60, 4000), error: 'Uno o más tests no pasaron.', tests, timeMs: elapsed, memoryBytes: memoryOf(task) };
}

function npmLauncher(args) {
  if (process.platform === 'win32') {
    return { command: 'cmd.exe', args: ['/d', '/s', '/c', `npm.cmd ${args.join(' ')}`], shell: false };
  }
  return { command: 'npm', args, shell: false };
}

function findSpecFile(directory, files) {
  const candidates = (files ?? [])
    .map((f) => ({ path: f.path, absolute: join(directory, f.path.replace(/\\/g, '/')) }))
    .filter((f) => /\.(test|spec)\.m?js$/i.test(f.path));
  const underTests = candidates.find((f) => f.path.startsWith('tests/')) ?? candidates[0];
  return underTests?.absolute ?? null;
}

function parseTapTests(tapOutput) {
  const tests = [];
  const lines = String(tapOutput ?? '').split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const notOk = line.match(/^\s*not\s+ok\s+\d+\s*-\s*(.+)$/);
    if (notOk) {
      const message = tapFailureMessage(lines, i + 1);
      tests.push({ name: notOk[1].trim(), passed: false, message });
    } else {
      const okMatch = line.match(/^\s*ok\s+\d+\s*-\s*(.+)$/);
      if (okMatch) {
        tests.push({ name: okMatch[1].trim(), passed: true, message: '' });
      }
    }
  }
  return tests;
}

function tapFailureMessage(lines, from) {
  const collected = [];
  let inErrorBlock = false;
  for (let i = from; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^\s*\.\.\.\s*$/.test(line)) break;
    const stripped = line.trimEnd();
    if (/^\s*error:\s*\|-/.test(stripped)) {
      inErrorBlock = true;
      continue;
    }
    if (inErrorBlock) {
      if (/^\s*code:\s*'/.test(stripped) || /^\s*name:\s*'/.test(stripped)) {
        inErrorBlock = false;
      } else {
        collected.push(stripped.replace(/^\s+/, ''));
      }
    }
  }
  return clip(collected.join(' ').trim(), 6, 300);
}

async function runNodeSpecSuite(directory, files) {
  const started = Date.now();
  const specPath = findSpecFile(directory, files);
  if (!specPath) {
    return { status: 'invalid', output: '', error: 'No se encontró un archivo de tests (*.spec.mjs o *.test.mjs) en el desafío.', tests: [], timeMs: 0, memoryBytes: 0 };
  }
  const npmInstall = npmLauncher(['install', '--no-save', '--no-audit', '--no-fund', '--loglevel=error', 'jsdom']);
  const install = spawnSync(npmInstall.command, npmInstall.args, {
    cwd: directory,
    env: { ...process.env },
    timeout: NODE_SPEC_TIMEOUT_MS,
    maxBuffer: 16 * 1024 * 1024,
  });
  const elapsedInstall = Date.now() - started;
  if (install.status !== 0) {
    const detail = ((install.stdout ?? '') + (install.stderr ?? '')).toString().trim().split('\n').slice(0, 6).join(' | ');
    return {
      status: 'setup-error',
      output: detail,
      error: `No se pudieron instalar las dependencias del sandbox (jsdom): ${detail || 'npm falló.'}`,
      tests: [],
      timeMs: elapsedInstall,
      memoryBytes: 0,
    };
  }
  const task = spawnSync(process.execPath, ['--test', '--test-reporter=tap', specPath], {
    cwd: directory,
    env: utf8Env(),
    timeout: NODE_SPEC_TIMEOUT_MS,
    maxBuffer: MAX_OUTPUT_BYTES,
  });
  const output = ((task.stdout ?? '') + (task.stderr ?? '')).toString();
  const elapsed = Date.now() - started;
  const tests = parseTapTests(output);
  if (task.error?.code === 'ETIMEDOUT') {
    return { status: 'timeout', output, error: 'Los tests excedieron el límite de tiempo.', tests, timeMs: elapsed, memoryBytes: memoryOf(task) };
  }
  if (task.status === 0) {
    return { status: 'ok', output: clip(output, 60, 4000), error: '', tests, timeMs: elapsed, memoryBytes: memoryOf(task) };
  }
  return { status: 'fail', output: clip(output, 60, 4000), error: 'Uno o más tests no pasaron.', tests, timeMs: elapsed, memoryBytes: memoryOf(task) };
}

async function runTypeScript(directory, entry, input) {
  const started = Date.now();
  try {
    const result = await esbuild.build({
      entryPoints: [join(directory, entry)],
      bundle: true,
      write: false,
      format: 'cjs',
      platform: 'node',
      target: 'es2020',
      outfile: 'out.cjs',
      logLevel: 'silent',
      absWorkingDir: directory,
    });
    const jsFile = join(directory, 'out.cjs');
    await writeFile(jsFile, result.outputFiles[0]?.text ?? '');
    const task = spawnSync(process.execPath, [jsFile], {
      cwd: directory,
      env: utf8Env(),
      timeout: TIMEOUT_MS,
      maxBuffer: 32 * 1024 * 1024,
      input,
    });
    const out = streamCell(task, 'Execution');
    const status = ['timeout'].includes(out.status) ? out.status : task.status === 0 ? 'ok' : 'run-error';
    return { ...out, status, timeMs: Date.now() - started, memoryBytes: memoryOf(task) };
  } catch (error) {
    const diagnostics = error.errors?.length
      ? error.errors.map((item) => item.text ?? item.message ?? String(item)).join(' | ')
      : error.message ?? String(error);
    return { status: 'compile-error', output: '', error: diagnostics, timeMs: Date.now() - started, memoryBytes: 0 };
  }
}

async function runJava(directory, files, input) {
  const started = Date.now();
  const javaFiles = files
    .filter((f) => f.path.endsWith('.java'))
    .map((f) => safePath(directory, f.path));
  const classesDir = join(directory, 'classes');
  await mkdir(classesDir, { recursive: true });
  const compilation = spawnSync(
    'javac',
    ['-J-Dfile.encoding=UTF-8', '-encoding', 'UTF-8', '-d', classesDir, ...javaFiles],
    { cwd: directory, env: utf8Env(), timeout: TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 },
  );
  if (compilation.status !== 0) {
    const output = `${compilation.stdout ?? ''}${compilation.stderr ?? ''}`.trim();
    return { status: 'compile-error', output: '', error: output || 'javac failed.', timeMs: Date.now() - started, memoryBytes: 0 };
  }
  let mainClass;
  try {
    mainClass = detectMainClass(directory, files);
  } catch (error) {
    return { status: 'run-error', output: '', error: error.message ?? String(error), timeMs: Date.now() - started, memoryBytes: 0 };
  }
  const task = spawnSync('java', ['-Dfile.encoding=UTF-8', '-cp', classesDir, mainClass], {
    cwd: directory,
    env: utf8Env(),
    timeout: TIMEOUT_MS,
    maxBuffer: 16 * 1024 * 1024,
    input,
  });
  const out = streamCell(task, 'Java run');
  const status = ['timeout'].includes(out.status) ? out.status : task.status === 0 ? 'ok' : 'run-error';
  return { ...out, status, timeMs: Date.now() - started, memoryBytes: memoryOf(task) };
}

export async function executeFiles(files, entry, input, runtime) {
  if (!Array.isArray(files) || files.length === 0) {
    return { status: 'invalid', output: '', error: 'A file list is required.', timeMs: 0, memoryBytes: 0, tests: [] };
  }
  const directory = await mkdtemp(join(os.tmpdir(), 'mmv-sbx-'));
  try {
    await writeFiles(directory, files);
    if (runtime === 'maven-test') {
      return await runMavenSuite(directory);
    }
    if (runtime === 'node-spec') {
      return await runNodeSpecSuite(directory, files);
    }
    if (files.some((f) => f.path === 'pom.xml')) {
      return { status: 'unsupported', output: '', error: 'Maven projects are not executed in this prototype.', timeMs: 0, memoryBytes: 0, tests: [] };
    }
    const tsEntry = tsEntryOf(files, entry);
    const javaFiles = files.filter((f) => f.path.endsWith('.java'));
    if (tsEntry) {
      return await runTypeScript(directory, tsEntry, input);
    }
    if (javaFiles.length > 0) {
      return await runJava(directory, files, input);
    }
    return { status: 'unsupported', output: '', error: 'No executable entry found.', timeMs: 0, memoryBytes: 0, tests: [] };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}