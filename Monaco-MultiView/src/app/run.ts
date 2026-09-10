const MAX_TIMEOUT_MS = 1500;

export type ExecutionResult = {
  lines: string[];
  error?: string;
};

function workerBody(): string {
  return `
self.onmessage = (event) => {
  const { code } = event.data;
  const output = { lines: [], error: undefined };
  const console = {
    log: (...args) => output.lines.push(args.map(format).join(' ')),
    info: (...args) => output.lines.push(args.map(format).join(' ')),
    warn: (...args) => output.lines.push(args.map(format).join(' ')),
    error: (...args) => output.lines.push(args.map(format).join(' ')),
    debug: (...args) => output.lines.push(args.map(format).join(' ')),
  };

  function format(arg) {
    if (typeof arg === 'string') return arg;
    if (arg instanceof Error) return arg.stack ?? arg.message;
    if (arg !== null && typeof arg === 'object') {
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    }
    return String(arg);
  }

  self.onerror = (error) => {
    output.error = error.message ?? String(error);
  };
  self.onunhandledrejection = (rejection) => {
    output.error = 'Promise rejected: ' + (rejection.reason?.message ?? String(rejection.reason));
  };

  try {
    const run = new Function('console', code);
    run(console);
  } catch (error) {
    output.error = error instanceof Error ? error.message : String(error);
  }

  self.postMessage({ output });
};
`;
}

export function runCode(js: string): Promise<ExecutionResult> {
  return new Promise((resolve) => {
    const blob = new Blob([workerBody()], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);

    const timer = setTimeout(() => {
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve({ lines: [], error: 'Execution did not finish within the time limit and was stopped.' });
    }, MAX_TIMEOUT_MS);

    worker.onmessage = (event: MessageEvent) => {
      clearTimeout(timer);
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve(event.data.output as ExecutionResult);
    };

    worker.onerror = (error) => {
      clearTimeout(timer);
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve({ lines: [], error: error.message });
    };

    worker.postMessage({ code: js });
  });
}