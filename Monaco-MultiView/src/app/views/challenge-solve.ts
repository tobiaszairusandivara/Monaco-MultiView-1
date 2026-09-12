import { Component, HostListener, Input, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MonacoEditor } from '../monaco-editor';
import { ChatPanel } from '../chat-panel';
import { CompileService } from '../compile.service';
import type { Challenge, ChatMessage, FailingTest, IntegrityEvent, Verdict } from '../challenge-types';
import type { ProjectFile } from '../projects';
import { fileNameOf, goBack, isRunnable, isTestFilePath, prettyJson, riskOf } from '../shared';
import { BannerService } from '../services/banner.service';
import { ChallengesService } from '../services/challenges.service';
import { SessionService } from '../services/session.service';

interface CheckState {
  verdict: Verdict;
  feedback: string;
  failingTest?: FailingTest | null;
  tests?: { passed: number; total: number } | null;
}

@Component({
  selector: 'app-challenge-solve',
  standalone: true,
  imports: [MonacoEditor, ChatPanel],
  template: `
    @if (challenge(); as challenge) {
      <section class="view student-ide">
        <header class="student-head">
          <button type="button" class="btn btn-secondary" (click)="back()">← Volver</button>
          <h2>{{ challenge.title }}</h2>
          <span class="tag">{{ challenge.subtype }}</span>
          <span class="badge badge-diff badge-difficulty-{{ challenge.difficulty }}">{{ challenge.difficulty }}</span>
          @if (challenge.configuration.runtime) {
            <span class="tag">{{ challenge.configuration.runtime }}</span>
          }
          @if (session.role() !== 'ALUMNO') {
            <span class="muted small mono">{{ challenge.courseCohortId }}</span>
          }
        </header>

        <div class="student-workspace">
          @if (isRunnable(challenge)) {
            <div class="ide-shell">
              <div class="ide-main">
                <div class="workspace-tabs">
                  @for (path of filePaths(); track path) {
                    <span
                      class="file-tab mono"
                      [class.active]="path === activePath()"
                      (click)="setActivePath(path)"
                    >
                      {{ fileNameOf(path) }}
                    </span>
                  }
                  <span class="spacer"></span>
                  <button
                    type="button"
                    class="btn btn-primary"
                    [disabled]="busy()"
                    (click)="compile()"
                    title="Compilar, ejecutar y verificar (F5)"
                  >
                    Compilar <kbd>F5</kbd>
                  </button>
                  <button
                    type="button"
                    class="btn btn-success"
                    [disabled]="busy()"
                    (click)="submit()"
                    title="Enviar resolución (Ctrl+S)"
                  >
                    Enviar <kbd>Ctrl+S</kbd>
                  </button>
                </div>

                <app-monaco-editor
                  class="student-editor"
                  [value]="activeContent()"
                  language="typescript"
                  (valueChange)="onEdit($event)"
                  (integrityEvent)="recordIntegrityEvent($event)"
                />
                <div class="output-box">
                  @for (line of outputLines(); track $index) {
                    <div class="line mono">{{ line }}</div>
                  }
                </div>
                @if (check(); as check) {
                  <div class="check-strip">
                    <div class="verdict verdict-{{ check.verdict }}">
                      <strong>{{ check.verdict }}</strong>
                      <span>{{ check.feedback }}</span>
                      @if (check.tests; as tests) {
                        <span class="test-summary">
                          Tests superados: <strong>{{ tests.passed }} de {{ tests.total }}</strong>
                        </span>
                      }
                      @if (check.failingTest; as fail) {
                        <div class="fail-block">
                          <div class="fail-head">
                            Test "{{ fail.name }}" — {{ fail.status }}
                            @if (fail.input) {
                              <span> · entrada: <span class="mono">{{ fail.input }}</span></span>
                            }
                          </div>
                          <div class="cmp-line">
                            <span class="cmp-label">Salida esperada</span>
                            <span class="mono cmp-value">{{ fail.expected }}</span>
                          </div>
                          <div class="cmp-line">
                            <span class="cmp-label">Su salida</span>
                            <span class="mono cmp-value">{{ fail.actual }}</span>
                          </div>
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>
            </div>
          } @else {
            <div class="consigna-panel">
              <h3>Consigna</h3>
              <p>
                Este desafío aún no tiene evaluador automático configurado en el sandbox. El
                enunciado, los criterios y el material de referencia se muestran acá; la
                resolución queda habilitada para la próxima entrega del grupo.
              </p>
              <pre class="json-panel">{{ prettyJson(challenge.configuration.baseFiles) }}</pre>
            </div>
          }
        </div>

        <app-chat-panel
          [challengeId]="challenge.challengeId"
          [riskLevel]="riskOf(challenge)"
          [allowReset]="canCreateConversation()"
          (transcriptChange)="onTranscript($event)"
        />
      </section>
    } @else if (notFound()) {
      <section class="view">
        <p class="muted">No encontramos este desafío.</p>
        <div class="actions-bar">
          <button type="button" class="btn btn-secondary" (click)="back()">← Volver</button>
        </div>
      </section>
    }
  `,
})
export class ChallengeSolveComponent implements OnInit, OnDestroy {
  @Input() id?: string;

  private readonly router = inject(Router);

  protected readonly session = inject(SessionService);
  protected readonly banner = inject(BannerService);
  private readonly challengesService = inject(ChallengesService);
  private readonly compileService = inject(CompileService);

  protected readonly riskOf = riskOf;
  protected readonly isRunnable = isRunnable;
  protected readonly prettyJson = prettyJson;
  protected readonly fileNameOf = fileNameOf;

  protected readonly challenge = signal<Challenge | null>(null);
  protected readonly notFound = signal(false);
  protected readonly busy = signal(false);
  protected readonly files = signal<ProjectFile[]>([]);
  protected readonly activePath = signal('');
  protected readonly outputLines = signal<string[]>([]);
  protected readonly check = signal<CheckState | null>(null);
  protected transcript: ChatMessage[] = [];
  protected readonly integrityEvents = signal<IntegrityEvent[]>([]);

  private windowBlurred = false;

  private readonly onVisibilityChange = (): void => {
    if (document.hidden) {
      this.recordWindowBlur();
    } else {
      this.recordWindowFocus();
    }
  };

  protected readonly filePaths = computed(() =>
    this.files().filter((file) => !isTestFilePath(file.path)).map((file) => file.path),
  );
  protected readonly activeContent = computed(
    () => this.files().find((file) => file.path === this.activePath())?.content ?? '',
  );
  protected readonly canCreateConversation = computed(() => this.session.role() !== 'ALUMNO');

  @HostListener('window:keydown', ['$event'])
  protected onWindowKeydown(event: KeyboardEvent): void {
    if (event.key === 'F5') {
      event.preventDefault();
      void this.compile();
    } else if (event.ctrlKey && (event.key === 's' || event.key === 'S')) {
      event.preventDefault();
      void this.submit();
    }
  }

  @HostListener('window:blur')
  protected onWindowBlur(): void {
    this.recordWindowBlur();
  }

  @HostListener('window:focus')
  protected onWindowFocus(): void {
    this.recordWindowFocus();
  }

  ngOnInit(): void {
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    void this.open();
  }

  ngOnDestroy(): void {
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }

  protected recordIntegrityEvent(event: IntegrityEvent): void {
    this.integrityEvents.update((events) => [...events, event]);
  }

  private recordWindowBlur(): void {
    if (this.windowBlurred) {
      return;
    }
    this.windowBlurred = true;
    this.recordIntegrityEvent({ type: 'WINDOW_BLUR', timestamp: new Date().toISOString() });
  }

  private recordWindowFocus(): void {
    if (!this.windowBlurred) {
      return;
    }
    this.windowBlurred = false;
    this.recordIntegrityEvent({ type: 'WINDOW_FOCUS', timestamp: new Date().toISOString() });
  }

  protected async open(): Promise<void> {
    if (!this.id) {
      this.notFound.set(true);
      return;
    }
    this.busy.set(true);
    try {
      const challenge = await this.challengesService.fetch(this.id);
      this.challenge.set(challenge);
      if (isRunnable(challenge)) {
        this.files.set(challenge.configuration.baseFiles.map((file) => ({ ...file })));
        this.activePath.set(challenge.configuration.entry);
      } else {
        this.files.set([]);
        this.activePath.set('');
      }
      this.outputLines.set([]);
      this.check.set(null);
      this.transcript = [];
      this.integrityEvents.set([]);
      this.windowBlurred = false;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.banner.show(`No se pudo abrir el desafío: ${message}`);
      this.notFound.set(true);
    } finally {
      this.busy.set(false);
    }
  }

  protected back(): void {
    goBack(this.router);
  }

  protected onEdit(value: string): void {
    const path = this.activePath();
    this.files.update((files) => files.map((file) => (file.path === path ? { ...file, content: value } : file)));
  }

  protected setActivePath(path: string): void {
    if (!isTestFilePath(path) && this.files().some((file) => file.path === path)) {
      this.activePath.set(path);
    }
  }

  protected onTranscript(transcript: ChatMessage[]): void {
    this.transcript = transcript;
  }

  private payloadFiles(): ProjectFile[] {
    return this.files().map((file) => ({ ...file }));
  }

  private writeLine(line: string): void {
    this.outputLines.update((lines) => [...lines.slice(-500), line]);
  }

  protected async compile(): Promise<void> {
    const challenge = this.challenge();
    if (!challenge || this.busy()) {
      return;
    }
    this.busy.set(true);
    this.outputLines.set([]);
    this.check.set(null);
    this.writeLine('> Compilando y ejecutando en el sandbox…');
    try {
      const run = await this.compileService.runExecution(
        challenge.challengeId,
        this.payloadFiles(),
        challenge.configuration.entry,
        false,
      );
      if (run.status === 'ok') {
        (run.output ?? '').split('\n').forEach((line) => this.writeLine(line));
      } else {
        this.writeLine(`> ${run.error ?? 'El programa no se pudo ejecutar.'}`);
      }
      if (run.timeMs !== undefined) {
        this.writeLine(`> Compilación finalizada en ${run.timeMs} ms.`);
      }

      const result = await this.compileService.runExecution(
        challenge.challengeId,
        this.payloadFiles(),
        challenge.configuration.entry,
        true,
      );
      const suiteTests = result.tests ?? run.tests ?? [];
      const tests =
        suiteTests.length > 0
          ? {
              passed: suiteTests.filter((test) => test.passed).length,
              total: suiteTests.length,
            }
          : this.hiddenTestSummary(result.verdict, result.failingTest);
      const verdict = result.verdict ?? (run.status === 'ok' ? 'FALLADO' : 'ERROR_TECNICO');
      const feedback =
        result.feedback ??
        (run.status === 'ok' ? 'Sin feedback.' : run.error ?? 'La verificación no se pudo completar.');
      this.check.set({
        verdict,
        feedback,
        failingTest: result.failingTest ?? null,
        tests,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.writeLine(`> ${message}`);
      this.check.set({ verdict: 'ERROR_TECNICO', feedback: message, failingTest: null });
    } finally {
      this.busy.set(false);
    }
  }

  private hiddenTestSummary(
    verdict: Verdict | undefined,
    failingTest: FailingTest | null | undefined,
  ): { passed: number; total: number } | null {
    const challenge = this.challenge();
    if (!challenge) {
      return null;
    }
    const hidden = challenge.configuration.hiddenTests ?? [];
    if (hidden.length === 0) {
      return null;
    }
    if (verdict === 'SUPERADO') {
      return { passed: hidden.length, total: hidden.length };
    }
    if (failingTest) {
      const index = hidden.findIndex(
        (test) =>
          test.expected === failingTest.expected && (test.input ?? '') === failingTest.input,
      );
      if (index >= 0) {
        return { passed: index, total: hidden.length };
      }
    }
    return null;
  }

  protected async submit(): Promise<void> {
    const challenge = this.challenge();
    if (!challenge || this.busy()) {
      return;
    }
    this.busy.set(true);
    try {
      const result = await this.compileService.submit({
        challengeId: challenge.challengeId,
        courseCohortId: challenge.courseCohortId,
        studentId: 'alumno-demo',
        files: this.payloadFiles(),
        entry: challenge.configuration.entry,
        chatTranscript: this.transcript,
        integrityEvents: this.integrityEvents(),
      });
      void this.router.navigate(['/challenges', challenge.challengeId, 'result'], {
        state: {
          payload: {
            submission: result,
            files: this.payloadFiles(),
            chatTranscript: this.transcript,
            integrityEvents: this.integrityEvents(),
          },
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.banner.show(`No se pudo enviar la resolución: ${message}`);
    } finally {
      this.busy.set(false);
    }
  }
}