import { Injectable } from '@angular/core';
import type { ProjectFile } from './projects';
import type {
  ChatMessage,
  ChatReply,
  ChatStatus,
  Challenge,
  ChallengeListItem,
  CreateChallengePayload,
  EvaluationResult,
  IntegrityEvent,
  PreviewRunResult,
  RiskLevel,
  SubmissionResult,
} from './challenge-types';

export type TypeScriptCompileResult =
  | { ok: true; js: string }
  | { ok: false; errors: string[] };

export interface JavaCompileResult {
  ok: boolean;
  output: string;
  errors: string[];
}

export const SERVER_DOWN_MESSAGE =
  'Could not connect to the compilation server (port 3100). Run "npm run server" in another terminal, or use "npm run dev" to start everything together.';

interface HttpResult {
  status: number;
  data: unknown;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function messageOf(data: unknown): string {
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    if (Array.isArray(record['errors'])) {
      return (record['errors'] as string[]).join(' · ');
    }
    if (typeof record['error'] === 'string') {
      return record['error'];
    }
  }
  return SERVER_DOWN_MESSAGE;
}

@Injectable({ providedIn: 'root' })
export class CompileService {
  private readonly base = '/api';

  async serverAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.base}/status`, { signal: AbortSignal.timeout(3000) });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async fetchJson(path: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', body?: unknown): Promise<HttpResult> {
    const attempt = async (): Promise<HttpResult> => {
      const response = await fetch(`${this.base}${path}`, {
        method,
        headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(20000),
      });
      const text = await response.text();
      let data: unknown = {};
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = { raw: text };
        }
      }
      return { status: response.status, data };
    };

    for (let retry = 0; ; retry += 1) {
      try {
        return await attempt();
      } catch (error) {
        if (error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
          throw new Error('The server took too long to respond.');
        }
        if (retry < 2) {
          await delay(300);
          continue;
        }
        throw new Error(SERVER_DOWN_MESSAGE);
      }
    }
  }

  private async expectOk<T>(result: HttpResult, message: string): Promise<T> {
    if (!(result.status >= 200 && result.status < 300)) {
      throw new Error(`${message}: ${messageOf(result.data)}`);
    }
    return result.data as T;
  }

  listChallenges() {
    return this.fetchJson('/challenges', 'GET').then((result) =>
      this.expectOk<{ ok: boolean; challenges: ChallengeListItem[] }>(result, 'No se pudieron listar los desafíos'),
    );
  }

  getChallenge(challengeId: string) {
    return this.fetchJson(`/challenges/${encodeURIComponent(challengeId)}`, 'GET').then((result) =>
      this.expectOk<{ ok: boolean; challenge: Challenge }>(result, 'No se pudo obtener el desafío'),
    );
  }

  createChallenge(payload: CreateChallengePayload) {
    return this.fetchJson('/challenges', 'POST', payload).then((result) =>
      this.expectOk<{ ok: boolean; challenge: Challenge }>(result, 'No se pudo publicar el desafío'),
    );
  }

  updateChallenge(challengeId: string, payload: CreateChallengePayload) {
    return this.fetchJson(`/challenges/${encodeURIComponent(challengeId)}`, 'PUT', payload).then((result) =>
      this.expectOk<{ ok: boolean; challenge: Challenge }>(result, 'No se pudo actualizar el desafío'),
    );
  }

  deleteChallenge(challengeId: string) {
    return this.fetchJson(`/challenges/${encodeURIComponent(challengeId)}`, 'DELETE').then((result) => {
      if (!(result.status >= 200 && result.status < 300)) {
        throw new Error(messageOf(result.data));
      }
      return true;
    });
  }

  runExecution(challengeId: string, files: ProjectFile[], entry: string | undefined, evaluate: boolean) {
    return this.fetchJson(`/practical-challenges/${encodeURIComponent(challengeId)}/executions`, 'POST', {
      files,
      entry,
      evaluate,
    }).then((result) => this.expectOk<EvaluationResult>(result, 'No se pudo ejecutar el desafío'));
  }

  previewRun(files: ProjectFile[], entry: string | undefined, input: string, runtime?: string) {
    return this.fetchJson('/preview-run', 'POST', { files, entry, input, runtime }).then((result) =>
      this.expectOk<PreviewRunResult>(result, 'No se pudo ejecutar la verificación'),
    );
  }

  submit(payload: {
    challengeId: string;
    courseCohortId: string;
    studentId: string;
    files: ProjectFile[];
    entry?: string;
    chatTranscript: ChatMessage[];
    integrityEvents?: IntegrityEvent[];
  }) {
    return this.fetchJson('/submissions', 'POST', payload).then((result) =>
      this.expectOk<SubmissionResult>(result, 'No se pudo enviar la resolución'),
    );
  }

  askChat(payload: { challengeId: string | null; riskLevel: RiskLevel; messages: ChatMessage[] }) {
    return this.fetchJson('/chat', 'POST', payload).then((result) =>
      this.expectOk<ChatReply>(result, 'No se pudo contactar al asistente'),
    );
  }

  getChatStatus() {
    return this.fetchJson('/chat/status', 'GET').then((result) =>
      this.expectOk<ChatStatus>(result, 'No se pudo conocer el estado del asistente'),
    );
  }

  compileTypeScript(files: ProjectFile[], entry?: string) {
    return this.fetchJson('/ts/compile', 'POST', { files, entry }).then((result) =>
      this.expectOk<TypeScriptCompileResult>(result, 'No se pudo compilar'),
    );
  }

  compileJava(files: ProjectFile[]) {
    return this.fetchJson('/java/compile', 'POST', { files }).then((result) =>
      this.expectOk<JavaCompileResult>(result, 'No se pudo compilar'),
    );
  }

  runJava(
    files: ProjectFile[],
    onLine: (line: string) => void,
    signal: AbortSignal,
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      fetch(`${this.base}/java/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files }),
        signal,
      })
        .then(async (response) => {
          if (!response.ok || !response.body) {
            if (response.status === 409) {
              onLine('A run is already in progress.');
            } else {
              onLine(`The server responded with status ${response.status}.`);
            }
            resolve();
            return;
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';
            for (const line of lines) {
              const clean = line.replace(/\r$/, '');
              if (clean.trim()) {
                onLine(clean);
              }
            }
          }

          if (buffer.trim()) {
            onLine(buffer.replace(/\r$/, '').trim());
          }
          resolve();
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === 'AbortError') {
            onLine('--- Execution stopped by the user.');
          } else if (error instanceof TypeError) {
            onLine(SERVER_DOWN_MESSAGE);
          } else {
            const message = error instanceof Error ? error.message : String(error);
            onLine(`Error while running: ${message}`);
          }
          resolve();
        });
    });
  }

  stopJava() {
    return this.fetchJson('/java/stop', 'POST', {}).then((result) =>
      this.expectOk<{ ok: boolean; stopped: boolean }>(result, 'No se pudo detener la ejecución'),
    );
  }
}