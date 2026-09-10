import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { join } from 'node:path';
import process from 'node:process';

const IS_WINDOWS = process.platform === 'win32';
const API_PORT = Number(process.env.PORT || 3100);
const DESIRED_PORT = Number(process.env.NG_PORT || 4200);
const NG_PATH = join(process.cwd(), 'node_modules', '@angular', 'cli', 'bin', 'ng.js');

function prefix(label) {
  return (data) => {
    const text = data.toString('utf8').replace(/\r/g, '');
    if (!text.trim()) return;
    text
      .split('\n')
      .filter((l) => l.trim())
      .forEach((line) => process.stdout.write(`\x1b[36m${label}\x1b[0m ${line}\n`));
  };
}

function startCommand(command, args, label) {
  const child = spawn(command, args, {
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  if (child.stdout) child.stdout.on('data', prefix(label));
  if (child.stderr) child.stderr.on('data', prefix(label));
  return child;
}

function findFreePort(from) {
  return new Promise((resolve) => {
    const tryPort = (port) => {
      const server = createServer();
      server.once('error', () => tryPort(port + 1));
      server.listen(port, '127.0.0.1', () => {
        const used = server.address().port;
        server.close(() => resolve(used));
      });
    };
    try {
      tryPort(from);
    } catch (error) {
      resolve(-1);
    }
  });
}

async function start() {
  const ngPort = await findFreePort(DESIRED_PORT);
  if (ngPort < 0) {
    process.stderr.write('> No free port found for the frontend.\n');
    process.exit(1);
  }
  const notice =
    ngPort !== DESIRED_PORT
      ? `\n> Notice: port ${DESIRED_PORT} is busy. Using ${ngPort} instead.\n`
      : '';
  process.stdout.write(
    `> Starting Monaco MultiView (API at http://localhost:${API_PORT} and frontend at http://localhost:${ngPort})...\n`,
  );
  process.stdout.write('> Press Ctrl+C to stop everything.\n');
  process.stdout.write(`${notice}>\n`);

  const api = startCommand(process.execPath, ['server/index.mjs'], '[server]');
  const dev = startCommand(
    process.execPath,
    [NG_PATH, 'serve', '--port', String(ngPort)],
    '[angular]',
  );

  let shuttingDown = false;
  function stopAll() {
    if (shuttingDown) return;
    shuttingDown = true;
    for (const child of [api, dev]) {
      if (!child || !child.pid || child.exitCode !== null) continue;
      if (IS_WINDOWS) {
        killTree(child.pid).catch(() => {});
      } else {
        try {
          process.kill(-child.pid, 'SIGTERM');
        } catch {
          try {
            child.kill('SIGTERM');
          } catch {
            /* already finished */
          }
        }
      }
    }
    setTimeout(() => process.exit(0), 800);
  }

  function killTree(pid) {
    return new Promise((resolve) => {
      const killer = spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true });
      killer.on('exit', () => resolve());
    });
  }

  api.on('exit', (code) => {
    if (code !== 0 && !shuttingDown) {
      process.stderr.write('\n> The compilation server stopped unexpectedly.\n');
      stopAll();
    }
  });

  dev.on('exit', (code) => {
    process.stderr.write(`\n> The frontend exited (code ${code ?? '?'}). Stopping everything.\n`);
    stopAll();
  });

  process.on('SIGINT', () => {
    process.stdout.write('\n> Stopping...\n');
    stopAll();
  });
  process.on('SIGTERM', () => stopAll());
}

start().catch((error) => {
  process.stderr.write(`> Failed to start the environment: ${error?.message ?? error}\n`);
  process.exit(1);
});