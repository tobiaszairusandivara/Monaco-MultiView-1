import { Component, HostListener, Input, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MonacoEditor } from '../monaco-editor';
import { ChatPanel } from '../chat-panel';
import { CompileService } from '../compile.service';
import type { Challenge, ChatMessage, FailingTest, IntegrityEvent, Verdict } from '../challenge-types';
import type { ProjectFile } from '../projects';
import { goBack, isRunnable, prettyJson, riskOf } from '../shared';
import { BannerService } from '../services/banner.service';
import { ChallengesService } from '../services/challenges.service';
import { SessionService } from '../services/session.service';

interface CheckState {
  verdict: Verdict;
  feedback: string;
  failingTest?: FailingTest | null;
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
          <span class="badge badge-{{ riskOf(challenge) }}">riesgo {{ riskOf(challenge) }}</span>
          <span class="badge badge-diff">{{ challenge.difficulty }}</span>
          @if (challenge.configuration.runtime) {
            <span class="tag">{{ challenge.configuration.runtime }}</span>
          }
          <span class="muted small mono">{{ challenge.courseCohortId }}</span>
        </header>

        <div class="student-workspace">
          @if (isRunnable(challenge)) {
            <div class="ide-shell">
              @if (allowsMultiview()) {
                <aside class="explorer">
                  <div class="explorer-title">Archivos del desafío</div>
                  <p class="explorer-note">
                    El alumno solo puede editar los archivos base que definió el docente
                    (no puede agregar ni renombrar).
                  </p>
                  <ul class="explorer-list">
                    @for (path of filePaths(); track path) {
                      <li
                        class="explorer-item"
                        [class.active]="path === activePath()"
                        (click)="setActivePath(path)"
                      >
                        <span class="mono">{{ path }}</span>
                      </li>
                    }
                  </ul>
                </aside>
              }
              <div class="ide-main">
                <div class="workspace-tabs">
                  @for (path of filePaths(); track path) {
                    <span
                      class="file-tab mono"
                      [class.active]="path === activePath()"
                      (click)="setActivePath(path)"
                    >
                      {{ path }}
                    </span>
                  }
                  <span class="spacer"></span>
                  <button
                    type="button"
                    class="btn btn-secondary"
                    [disabled]="busy()"
                    (click)="runConsole()"
                    title="Ejecutar (F5)"
                  >
                    Ejecutar <kbd>F5</kbd>
                  </button>
                  <button
                    type="button"
                    class="btn btn-primary"
                    [disabled]="busy()"
                    (click)="checkSolution()"
                    title="Comprobar (F9)"
                  >
                    Comprobar <kbd>F9</kbd>
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

                @if (check(); as check) {
                  <div class="check-strip">
                    <div class="verdict verdict-{{ check.verdict }}">
                      <strong>{{ check.verdict }}</strong>
                      <span>{{ check.feedback }}</span>
                      @if (check.failingTest; as fail) {
                        <div class="fail-block">
                          <div class="fail-head">
                            Test "{{ fail.name }}" — {{ fail.status }}
                            @if (fail.input) {
                              <span> · entrada: <span class="mono">{{ fail.input }}</span></span>
                            }
                          </div>
                          <div class="cmp-grid">
                            <div>
                              <span class="cmp-label">Salida esperada</span>
                              <pre class="mono">{{ fail.expected }}</pre>
                            </div>
                            <div>
                              <span class="cmp-label">Su salida</span>
                              <pre class="mono">{{ fail.actual }}</pre>
                            </div>
                          </div>
                        </div>
                      }
                    </div>
                  </div>
                }
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

  protected readonly filePaths = computed(() => this.files().map((file) => file.path));
  protected readonly activeContent = computed(
    () => this.files().find((file) => file.path === this.activePath())?.content ?? '',
  );
  protected readonly allowsMultiview = computed(() => this.files().length > 1);
  protected readonly canCreateConversation = computed(() => this.session.role() !== 'ALUMNO');

  @HostListener('window:keydown', ['$event'])
  protected onWindowKeydown(event: KeyboardEvent): void {
    if (event.key === 'F5') {
      event.preventDefault();
      void this.runConsole();
    } else if (event.key === 'F9') {
      event.preventDefault();
      void this.checkSolution();
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
    if (this.files().some((file) => file.path === path)) {
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

  protected async runConsole(): Promise<void> {
    const challenge = this.challenge();
    if (!challenge || this.busy()) {
      return;
    }
    this.busy.set(true);
    this.outputLines.set([]);
    this.writeLine('> Ejecutando en el sandbox…');
    try {
      const result = await this.compileService.runExecution(
        challenge.challengeId,
        this.payloadFiles(),
        challenge.configuration.entry,
        false,
      );
      if (result.status === 'ok') {
        (result.output ?? '').split('\n').forEach((line) => this.writeLine(line));
      } else {
        this.writeLine(`> ${result.error ?? 'El programa no se pudo ejecutar.'}`);
      }
      this.writeLine('> Ejecución finalizada.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.writeLine(`> ${message}`);
    } finally {
      this.busy.set(false);
    }
  }

  protected async checkSolution(): Promise<void> {
    const challenge = this.challenge();
    if (!challenge || this.busy()) {
      return;
    }
    this.busy.set(true);
    try {
      const result = await this.compileService.runExecution(
        challenge.challengeId,
        this.payloadFiles(),
        challenge.configuration.entry,
        true,
      );
      if (result.verdict === 'ERROR_TECNICO') {
        this.check.set({
          verdict: 'ERROR_TECNICO',
          feedback: `${result.feedback ?? 'Error técnico del evaluador.'} Intentá de nuevo.`,
          failingTest: result.failingTest ?? null,
        });
      } else {
        this.check.set({
          verdict: result.verdict ?? 'FALLADO',
          feedback: result.feedback ?? 'Sin feedback.',
          failingTest: result.failingTest ?? null,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.check.set({ verdict: 'ERROR_TECNICO', feedback: message, failingTest: null });
    } finally {
      this.busy.set(false);
    }
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