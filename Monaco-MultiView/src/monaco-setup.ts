import * as monaco from 'monaco-editor';

self.MonacoEnvironment = {
  getWorker(_moduleId: string, label: string) {
    switch (label) {
      case 'json':
        return new Worker(new URL('./workers/json.worker.ts', import.meta.url), {
          type: 'module',
          name: label,
        });
      case 'html':
        return new Worker(new URL('./workers/html.worker.ts', import.meta.url), {
          type: 'module',
          name: label,
        });
      case 'css':
      case 'scss':
      case 'less':
        return new Worker(new URL('./workers/css.worker.ts', import.meta.url), {
          type: 'module',
          name: label,
        });
      case 'typescript':
      case 'javascript':
        return new Worker(new URL('./workers/ts.worker.ts', import.meta.url), {
          type: 'module',
          name: label,
        });
      default:
        return new Worker(new URL('./workers/editor.worker.ts', import.meta.url), {
          type: 'module',
          name: label,
        });
    }
  },
};

export type MonacoCore = typeof monaco;
export default monaco;