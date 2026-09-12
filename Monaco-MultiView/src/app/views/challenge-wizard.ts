import { Component, Input, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MonacoEditor } from '../monaco-editor';
import { ChatPanel } from '../chat-panel';
import { CompileService } from '../compile.service';
import { CHALLENGE_TEMPLATES, newDraft, templateDraft, type ChallengeTemplate } from '../challenge-drafts';
import {
  CHALLENGE_SUBTYPES,
  DEFAULT_COHORT,
  RUNNABLE_SUBTYPES,
  SUBTYPE_META,
  SUBTYPE_RISK,
  parseHiddenTests,
  type Challenge,
  type ChallengeSubtype,
  type CreateChallengePayload,
  type Difficulty,
  type Draft,
  type Verdict,
} from '../challenge-types';
import { goBack, isRunnableSubtype, linesEqual, normalizeLines } from '../shared';
import { formatTestFile } from '../test-formatter';
import { BannerService } from '../services/banner.service';
import { ChallengesService } from '../services/challenges.service';

const WIZARD_STAGES = ['Subtipo', 'Datos', 'Contenido', 'Preview'] as const;
type WizardStage = (typeof WIZARD_STAGES)[number];

interface PreviewFailDetail {
  name: string;
  input: string;
  expected: string;
  actual: string;
  status: string;
}

interface PreviewVerdictState {
  verdict: Verdict;
  feedback: string;
  tests: { passed: number; total: number } | null;
  failingTest: PreviewFailDetail | null;
}

@Component({
  selector: 'app-challenge-wizard',
  standalone: true,
  imports: [MonacoEditor, ChatPanel],
  template: `
    <section class="view wizard">
      <header class="wizard-header">
        <button type="button" class="btn btn-secondary" (click)="back()">← Volver</button>
        <div class="steps">
          @for (stage of wizardStages; track stage; let i = $index) {
            <span
              class="step"
              [class.active]="wizardStage() === stage"
              [class.clickable]="canVisit(stage)"
              [class.disabled]="!canVisit(stage)"
              role="button"
              [attr.aria-disabled]="!canVisit(stage)"
              (click)="canVisit(stage) ? goToStage(stage) : null"
            >
              <span class="step-n">{{ i + 1 }}</span>
              {{ stage }}
            </span>
          }
        </div>
      </header>

      @switch (wizardStage()) {
        @case ('Subtipo') {
          <div class="wizard-body">
            <h2>¿Qué tipo de desafío va a crear?</h2>
            <div class="subtype-grid">
              @for (s of subtypes; track s) {
                <button type="button" class="subtype-card" (click)="pickSubtype(s)">
                  <span class="badge badge-{{ subtypeRisk[s] }}">riesgo {{ subtypeRisk[s] }}</span>
                  <h3>{{ subtypeMeta[s].label }}</h3>
                  <p>{{ subtypeMeta[s].description }}</p>
                </button>
              }
            </div>

            <h2 class="templates-title">O plantillas multi-archivo</h2>
            <p class="muted small">
              Desafíos completos (Spring Boot + Maven, Angular standalone, Frontend JS/HTML/CSS).
              Se crean multi-archivo con sus tests. Spring Boot + Maven y Frontend clásico se
              resuelven directamente en el sandbox; las plantillas Angular quedan como consigna
              pendiente de evaluador.
            </p>
            <div class="subtype-grid">
              @for (t of templates; track t.key) {
                <button type="button" class="subtype-card" (click)="startFromTemplate(t)">
                  <span class="tag">{{ t.stack }}</span>
                  <h3>{{ t.label }}</h3>
                  <p>{{ t.description }}</p>
                </button>
              }
            </div>
          </div>
        }

        @case ('Datos') {
          <div class="wizard-body form">
            <h2>Datos del desafío</h2>
            <label class="field">
              <span>Título *</span>
              <input
                [value]="draftTitle"
                (input)="draftTitle = $any($event.target).value"
                placeholder="Ej: Total del carrito"
              />
            </label>
            <label class="field">
              <span>Tema / sección</span>
              <input
                [value]="draftTopic"
                (input)="draftTopic = $any($event.target).value"
                placeholder="Ej: Algoritmos — sumatoria"
              />
            </label>
            <label class="field">
              <span>Dificultad (RF-DES-04)</span>
              <select [value]="draftDifficulty" (change)="onDifficultyChange($event)">
                <option value="BASICO">Básico</option>
                <option value="MEDIO">Medio</option>
                <option value="AVANZADO">Avanzado</option>
              </select>
            </label>
            <label class="field">
              <span>Descripción</span>
              <textarea
                [value]="draftNotes"
                (input)="draftNotes = $any($event.target).value"
                rows="3"
              ></textarea>
            </label>
            <footer class="wizard-footer">
              <button type="button" class="btn btn-secondary" (click)="goToStage('Subtipo')">
                ← Anterior
              </button>
              <button type="button" class="btn btn-secondary" (click)="generateDraftWithAI()">
                Generar borrador con IA
              </button>
              <button type="button" class="btn btn-primary" (click)="continueToContent()">
                Continuar →
              </button>
            </footer>
          </div>
        }

        @case ('Contenido') {
          <div class="wizard-body content">
            <h2>Contenido del desafío ({{ wizardSubtype() }})</h2>
            <div class="content-layout">
              <div class="content-editor">
                <div class="tabs">
                  @for (file of draft()?.baseFiles ?? []; track file.path; let i = $index) {
                    <button
                      type="button"
                      class="tab"
                      [class.active]="i === draftFileIndex()"
                      (click)="setDraftFile(i)"
                    >
                      {{ file.path }}
                      @if (file.path !== (draft()?.entry ?? '')) {
                        <span
                          class="tab-remove"
                          role="button"
                          (click)="$event.stopPropagation(); removeDraftFile(i)"
                          title="Quitar archivo"
                        >
                          ×
                        </span>
                      }
                    </button>
                  }
                </div>
                <div class="file-add">
                  <input
                    [value]="newFilePath"
                    (input)="newFilePath = $any($event.target).value"
                    placeholder="multi-archivo: indicá el path (ej: src/utils.ts) y agregalo"
                    autocomplete="off"
                  />
                  <button
                    type="button"
                    class="btn btn-secondary"
                    (click)="addDraftFile()"
                    title="Agregar un archivo adicional al desafío"
                  >
                    + Agregar archivo
                  </button>
                </div>
                <app-monaco-editor
                  [value]="wizardEditorContent()"
                  language="typescript"
                  (valueChange)="onWizardEditorInput($event)"
                />
              </div>
              <div class="content-side">
                <div class="side-block">
                  <header>Tests ocultos (JSON)</header>
                  <div class="test-import">
                    <input
                      type="file"
                      id="testFileInput"
                      accept=".java,.js,.mjs,.ts,.tsx"
                      (change)="onTestFilePicked($event)"
                    />
                    <label for="testFileInput" class="btn btn-secondary">Importar archivo de tests</label>
                    <span class="muted small">
                      Convierte JUnit (.java) o node:test (.js/.mjs/.ts) a JSON con language y testCases.
                    </span>
                  </div>
                  <textarea
                    [value]="draft()?.hiddenTestsText ?? ''"
                    (input)="onHiddenTestsInput($event)"
                    spellcheck="false"
                  ></textarea>
                </div>
              </div>
            </div>
            @if (contentErrors()) {
              <div class="form-error">{{ contentErrors() }}</div>
            }
            <footer class="wizard-footer">
              <button type="button" class="btn btn-secondary" (click)="goToStage('Datos')">
                ← Anterior
              </button>
              <button type="button" class="btn btn-secondary" (click)="validateContentOnly()">
                Validar
              </button>
              <button type="button" class="btn btn-primary" (click)="goToPreview()">
                Vista previa →
              </button>
            </footer>
          </div>
        }

        @case ('Preview') {
          <div class="wizard-body preview">
            <header class="preview-head">
              <h2>Vista previa (modo alumno)</h2>
              <span class="tag">{{ wizardSubtype() }}</span>
              <span class="badge badge-{{ wizardRisk() }}">riesgo {{ wizardRisk() }}</span>
            </header>
            <div class="preview-layout">
              <div class="preview-editor">
                <app-monaco-editor [value]="wizardEditorContent()" language="typescript" />
              </div>
            </div>
            <div class="output-box">
              @for (line of previewOutputLines(); track $index) {
                <div class="line mono">{{ line }}</div>
              }
            </div>
            @if (previewVerdict(); as verdict) {
              <div class="check-strip">
                <div class="verdict verdict-{{ verdict.verdict }}">
                  <strong>{{ verdict.verdict }}</strong>
                  <span>{{ verdict.feedback }}</span>
                  @if (verdict.tests; as tests) {
                    <span class="test-summary">
                      Tests superados: <strong>{{ tests.passed }} de {{ tests.total }}</strong>
                    </span>
                  }
                  @if (verdict.failingTest; as fail) {
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
            <app-chat-panel [challengeId]="null" [riskLevel]="wizardRisk()" />
            <div class="preview-actions">
              <button type="button" class="btn btn-secondary" (click)="goToStage('Contenido')">
                ← Anterior
              </button>
              <button
                type="button"
                class="btn btn-primary"
                [disabled]="previewCheckBusy() || !isRunnableSubtype(wizardSubtype())"
                (click)="runPreviewCompile()"
                title="Compilar, ejecutar y verificar"
              >
                {{ previewCheckBusy() ? 'Compilando…' : 'Compilar' }}
              </button>
              <button
                type="button"
                class="btn btn-primary"
                [disabled]="publishBusy()"
                (click)="publish()"
              >
                {{ publishBusy() ? 'Publicando…' : 'Publicar desafío' }}
              </button>
            </div>
          </div>
        }
      }
    </section>
  `,
})
export class ChallengeWizardComponent implements OnInit {
  @Input() id?: string;

  protected readonly wizardStages = WIZARD_STAGES;
  protected readonly subtypes = CHALLENGE_SUBTYPES;
  protected readonly subtypeMeta = SUBTYPE_META;
  protected readonly subtypeRisk = SUBTYPE_RISK;
  protected readonly templates = CHALLENGE_TEMPLATES;
  protected readonly isRunnableSubtype = isRunnableSubtype;

  protected readonly wizardStage = signal<WizardStage>('Subtipo');
  protected readonly draft = signal<Draft | null>(null);
  protected readonly draftFileIndex = signal(0);
  protected readonly editingChallengeId = signal<string | null>(null);
  protected readonly contentErrors = signal('');
  protected readonly previewVerdict = signal<PreviewVerdictState | null>(null);
  protected readonly previewOutputLines = signal<string[]>([]);
  protected readonly previewCheckBusy = signal(false);
  protected readonly publishBusy = signal(false);
  protected newFilePath = '';
  protected draftTitle = '';
  protected draftTopic = '';
  protected draftDifficulty: Difficulty = 'MEDIO';
  protected draftNotes = '';

  protected readonly wizardEditorContent = computed(() => {
    const draft = this.draft();
    if (!draft) {
      return '';
    }
    return draft.baseFiles[this.draftFileIndex()]?.content ?? '';
  });
  protected readonly wizardSubtype = computed(() => this.draft()?.subtype ?? null);
  protected readonly wizardRisk = computed(() => {
    const subtype = this.draft()?.subtype;
    return subtype ? SUBTYPE_RISK[subtype] : 'MEDIO';
  });

  private readonly router = inject(Router);

  protected readonly banner = inject(BannerService);
  private readonly challengesService = inject(ChallengesService);
  private readonly compileService = inject(CompileService);

  ngOnInit(): void {
    if (this.id) {
      void this.openForEdit(this.id);
    }
  }

  protected back(): void {
    const index = WIZARD_STAGES.indexOf(this.wizardStage());
    if (index > 0) {
      this.wizardStage.set(WIZARD_STAGES[index - 1]);
      return;
    }
    goBack(this.router);
  }

  protected canVisit(stage: WizardStage): boolean {
    return WIZARD_STAGES.indexOf(stage) <= WIZARD_STAGES.indexOf(this.wizardStage());
  }

  protected goToStage(stage: WizardStage): void {
    if (!this.canVisit(stage)) {
      return;
    }
    if (stage !== 'Subtipo' && !this.draft()) {
      return;
    }
    this.contentErrors.set('');
    this.wizardStage.set(stage);
  }

  protected pickSubtype(subtype: ChallengeSubtype): void {
    const draft = newDraft(subtype, DEFAULT_COHORT);
    this.draft.set(draft);
    this.draftTitle = draft.title;
    this.draftTopic = draft.topic;
    this.draftDifficulty = draft.difficulty;
    this.draftNotes = draft.notes;
    this.newFilePath = '';
    this.contentErrors.set('');
    this.previewVerdict.set(null);
    this.previewOutputLines.set([]);
    this.editingChallengeId.set(null);
    this.wizardStage.set('Datos');
  }

  protected startFromTemplate(template: ChallengeTemplate): void {
    const draft = templateDraft(template, DEFAULT_COHORT);
    this.draft.set(draft);
    this.draftTitle = draft.title;
    this.draftTopic = draft.topic;
    this.draftDifficulty = draft.difficulty;
    this.draftNotes = draft.notes;
    this.newFilePath = '';
    this.contentErrors.set('');
    this.previewVerdict.set(null);
    this.previewOutputLines.set([]);
    this.editingChallengeId.set(null);
    this.wizardStage.set('Datos');
    this.banner.show(
      draft.runtime
        ? `Plantilla cargada: la solución se evaluará en el sandbox con ${draft.runtime} (${template.label}).`
        : `Plantilla cargada sin evaluador automático: ${template.label}. Complete los archivos y publique la consigna.`,
    );
  }

  protected onDifficultyChange(event: Event): void {
    this.draftDifficulty = (event.target as HTMLSelectElement).value as Difficulty;
  }

  private syncDetailsIntoDraft(): void {
    this.draft.update((d) =>
      d
        ? {
            ...d,
            title: this.draftTitle.trim(),
            topic: this.draftTopic.trim(),
            difficulty: this.draftDifficulty,
            notes: this.draftNotes.trim(),
          }
        : d,
    );
  }

  protected continueToContent(): void {
    if (!this.draftTitle.trim()) {
      this.banner.show('El título del desafío es obligatorio.');
      return;
    }
    this.syncDetailsIntoDraft();
    this.draftFileIndex.set(0);
    this.contentErrors.set('');
    this.wizardStage.set('Contenido');
  }

  protected generateDraftWithAI(): void {
    const current = this.draft();
    if (!current) {
      return;
    }
    const generated = newDraft(current.subtype, current.courseCohortId);
    this.draft.update((d) =>
      d
        ? {
            ...d,
            baseFiles: generated.baseFiles,
            hiddenTestsText: generated.hiddenTestsText,
            expectedSolutionText: generated.expectedSolutionText,
          }
        : d,
    );
    this.draftFileIndex.set(0);
    this.banner.show('Borrador generado por IA (simulado). Revisá el código y los tests ocultos.');
    this.wizardStage.set('Contenido');
  }

  protected setDraftFile(index: number): void {
    this.draftFileIndex.set(index);
  }

  protected onWizardEditorInput(value: string): void {
    this.draft.update((d) =>
      d
        ? {
            ...d,
            baseFiles: d.baseFiles.map((file, index) =>
              index === this.draftFileIndex() ? { ...file, content: value } : file,
            ),
          }
        : d,
    );
  }

  protected onHiddenTestsInput(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.draft.update((d) => (d ? { ...d, hiddenTestsText: value } : d));
  }

  protected async onTestFilePicked(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    const content = await file.text();
    const result = formatTestFile(file.name, content);
    if (!result.ok) {
      this.banner.show(result.error ?? 'No se pudo interpretar el archivo de tests.');
      return;
    }
    this.draft.update((d) => (d ? { ...d, hiddenTestsText: result.json ?? d.hiddenTestsText } : d));
    const label = result.language === 'java' ? 'JUnit (Java)' : 'node:test (JS)';
    this.banner.show(
      `Importados ${result.testCount} test(s) de ${label}. Se generó el JSON { language, testCases }; revisalo y validá.`,
    );
    this.contentErrors.set('');
  }

  protected addDraftFile(): void {
    const draft = this.draft();
    if (!draft) {
      return;
    }
    const path = this.newFilePath.trim().replace(/\\/g, '/').replace(/^\.?\//, '');
    const entry = draft.entry.replace(/\\/g, '/').replace(/^\.?\//, '');
    if (!path) {
      this.banner.show('Indique el nombre del archivo a agregar.');
      return;
    }
    if (path === entry) {
      this.banner.show('Ese nombre es el archivo de entrada (entry); use otro para el archivo adicional.');
      return;
    }
    if (draft.baseFiles.some((file) => file.path.replace(/\\/g, '/').replace(/^\.?\//, '') === path)) {
      this.banner.show(`El archivo "${path}" ya existe en el desafío.`);
      return;
    }
    this.draft.update((d) =>
      d
        ? {
            ...d,
            baseFiles: [...d.baseFiles, { path, content: '// nuevo archivo: ' + path + '\n' }],
          }
        : d,
    );
    this.draftFileIndex.set(draft.baseFiles.length);
    this.newFilePath = '';
  }

  protected removeDraftFile(index: number): void {
    const draft = this.draft();
    if (!draft) {
      return;
    }
    const file = draft.baseFiles[index];
    const entry = draft.entry.replace(/\\/g, '/').replace(/^\.?\//, '');
    if (file && file.path.replace(/\\/g, '/').replace(/^\.?\//, '') === entry) {
      this.banner.show('No se puede quitar el archivo de entrada; cambie el entry o quite otro archivo.');
      return;
    }
    this.draft.update((d) =>
      d
        ? {
            ...d,
            baseFiles: d.baseFiles.filter((_, i) => i !== index),
          }
        : d,
    );
    if (this.draftFileIndex() >= index && this.draftFileIndex() > 0) {
      this.draftFileIndex.set(index === 0 ? 0 : index - 1);
    }
    if (this.draftFileIndex() >= (this.draft()?.baseFiles.length ?? 0)) {
      this.draftFileIndex.set(Math.max(0, this.draft()!.baseFiles.length - 1));
    }
  }

  private validateContent(): boolean {
    const draft = this.draft();
    if (!draft) {
      return false;
    }
    if (draft.baseFiles.length === 0) {
      this.contentErrors.set('El desafío no tiene archivos de contenido.');
      return false;
    }
    for (const file of draft.baseFiles) {
      if (!file.content.trim()) {
        this.contentErrors.set(`El archivo "${file.path}" está vacío.`);
        return false;
      }
    }
    const parsed = parseHiddenTests(draft.hiddenTestsText);
    if (parsed.tests === null) {
      this.contentErrors.set(parsed.error);
      return false;
    }
    if (draft.runtime === 'maven-test') {
      const hasTest = draft.baseFiles.some(
        (file) => file.path.endsWith('.java') && /@Test\b/.test(file.content),
      );
      if (!hasTest) {
        this.contentErrors.set(
          'Un desafío evaluado con Maven requiere al menos un test JUnit (@Test) entre los archivos.',
        );
        return false;
      }
    } else if (draft.runtime === 'node-spec') {
      const hasSpec = draft.baseFiles.some((file) => /\.(test|spec)\.m?js$/i.test(file.path));
      if (!hasSpec) {
        this.contentErrors.set(
          'Un desafío evaluado con node:test requiere un archivo *.test.mjs o *.spec.mjs entre los archivos.',
        );
        return false;
      }
    } else if (RUNNABLE_SUBTYPES.has(draft.subtype)) {
      if (parsed.language === 'java' && draft.runtime !== 'maven-test') {
        this.contentErrors.set(
          'Los tests JUnit (Java) no pueden evaluar un subtipo TypeScript; usá la plantilla Maven o tests en JSON.',
        );
        return false;
      }
      if (parsed.tests.length === 0) {
        this.contentErrors.set('Los subtipos ejecutables requieren al menos un test.');
        return false;
      }
    }
    this.contentErrors.set('');
    return true;
  }

  protected validateContentOnly(): void {
    this.validateContent();
  }

  protected goToPreview(): void {
    if (!this.validateContent()) {
      return;
    }
    this.previewVerdict.set(null);
    this.previewOutputLines.set([]);
    this.wizardStage.set('Preview');
  }

  protected async runPreviewCompile(): Promise<void> {
    const draft = this.draft();
    if (!draft) {
      return;
    }
    this.previewCheckBusy.set(true);
    this.previewOutputLines.set([]);
    this.previewVerdict.set(null);
    this.writePreviewLine('> Compilando y ejecutando en el sandbox…');
    try {
      const run = await this.compileService.previewRun(
        draft.baseFiles.map((file) => ({ ...file })),
        draft.entry,
        '',
        draft.runtime ?? undefined,
      );
      if (run.status === 'ok') {
        (run.output ?? '').split('\n').forEach((line) => this.writePreviewLine(line));
      } else {
        this.writePreviewLine(`> ${run.error ?? 'El programa no se pudo ejecutar.'}`);
      }
      if (run.timeMs !== undefined) {
        this.writePreviewLine(`> Compilación finalizada en ${run.timeMs} ms.`);
      }

      const suiteTests = run.tests ?? [];
      if (suiteTests.length > 0) {
        const passed = suiteTests.filter((test) => test.passed).length;
        const failing = suiteTests.find((test) => !test.passed);
        this.previewVerdict.set({
          verdict: passed === suiteTests.length ? 'SUPERADO' : 'FALLADO',
          feedback:
            passed === suiteTests.length
              ? 'Todas las verificaciones pasaron.'
              : `El test "${failing?.name ?? 'desconocido'}" no pasó la verificación esperada.`,
          tests: { passed, total: suiteTests.length },
          failingTest: failing
            ? {
                name: failing.name,
                input: '',
                expected: 'el test pasa',
                actual: failing.message || 'La verificación esperada no se cumplió.',
                status: 'assertion',
              }
            : null,
        });
        return;
      }

      const parsed = parseHiddenTests(draft.hiddenTestsText);
      if (parsed.tests === null) {
        this.previewVerdict.set({
          verdict: 'ERROR_TECNICO',
          feedback: parsed.error,
          tests: null,
          failingTest: null,
        });
        return;
      }
      const runnable = parsed.tests.filter((test) => !test.source || test.input !== undefined);
      if (runnable.length === 0) {
        this.previewVerdict.set({
          verdict: 'ERROR_TECNICO',
          feedback: 'Ningún test del JSON tiene input/expected ejecutable en el preview.',
          tests: null,
          failingTest: null,
        });
        return;
      }
      const files = draft.baseFiles.map((file) => ({ ...file }));
      let passedCount = 0;
      let networkFailures = 0;
      let firstFail: PreviewFailDetail | null = null;
      for (const test of runnable) {
        try {
          const attempt = await this.compileService.previewRun(
            files,
            draft.entry,
            test.input ?? '',
            draft.runtime ?? undefined,
          );
          const passed =
            attempt.status === 'ok' &&
            linesEqual(normalizeLines(attempt.output), normalizeLines(test.expected));
          if (passed) {
            passedCount += 1;
          } else if (!firstFail) {
            firstFail = {
              name: test.name,
              input: test.input ?? '',
              expected: test.expected,
              actual:
                attempt.status === 'ok'
                  ? attempt.output
                  : attempt.error || attempt.status || 'sin salida',
              status: attempt.status,
            };
          }
        } catch (error) {
          networkFailures += 1;
          if (!firstFail) {
            const message = error instanceof Error ? error.message : String(error);
            firstFail = {
              name: test.name,
              input: test.input ?? '',
              expected: test.expected,
              actual: message,
              status: 'network',
            };
          }
        }
      }
      const passedAll = passedCount === runnable.length;
      this.previewVerdict.set({
        verdict: passedAll ? 'SUPERADO' : networkFailures === runnable.length ? 'ERROR_TECNICO' : 'FALLADO',
        feedback: passedAll
          ? 'Todas las verificaciones pasaron.'
          : networkFailures === runnable.length
            ? 'El evaluador no respondió; revisá que el servidor de compilación esté levantado.'
            : `Se superaron ${passedCount} de ${runnable.length} verificaciones.`,
        tests: { passed: passedCount, total: runnable.length },
        failingTest: firstFail,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.writePreviewLine(`> ${message}`);
      this.previewVerdict.set({
        verdict: 'ERROR_TECNICO',
        feedback: message,
        tests: null,
        failingTest: null,
      });
    } finally {
      this.previewCheckBusy.set(false);
    }
  }

  private writePreviewLine(line: string): void {
    this.previewOutputLines.update((lines) => [...lines.slice(-500), line]);
  }

  protected async publish(): Promise<void> {
    if (!this.validateContent()) {
      return;
    }
    this.syncDetailsIntoDraft();
    const draft = this.draft();
    if (!draft) {
      return;
    }
    const parsed = parseHiddenTests(draft.hiddenTestsText);
    if (parsed.tests === null) {
      return;
    }
    this.publishBusy.set(true);
    try {
      const payload: CreateChallengePayload = {
        challengeId: draft.challengeId,
        courseCohortId: draft.courseCohortId,
        title: draft.title,
        topic: draft.topic,
        subtype: draft.subtype,
        difficulty: draft.difficulty,
        notes: draft.notes,
        materialDocs: draft.materialDocs,
        configuration: {
          language: draft.language,
          entry: draft.entry,
          runtime: draft.runtime,
          baseFiles: draft.baseFiles,
          hiddenTests: parsed.tests,
          expectedSolution: draft.expectedSolutionText,
          timeLimitMs: draft.timeLimitMs,
        },
      };
      const editing = this.editingChallengeId();
      const challenge = await this.challengesService.save(payload, editing);
      void this.router.navigate(['/challenges', challenge.challengeId, 'published']);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.banner.show(`No se pudo publicar: ${message}`);
    } finally {
      this.publishBusy.set(false);
    }
  }

  protected publishAnother(): void {
    void this.router.navigate(['/challenges', 'new']);
  }

  private async openForEdit(challengeId: string): Promise<void> {
    try {
      const challenge = await this.challengesService.fetch(challengeId);
      this.editingChallengeId.set(challenge.challengeId);
      this.draft.set(this.draftFromChallenge(challenge));
      this.draftTitle = challenge.title;
      this.draftTopic = challenge.topic ?? '';
      this.draftDifficulty = challenge.difficulty;
      this.draftNotes = challenge.metadata?.notes ?? '';
      this.newFilePath = '';
      this.contentErrors.set('');
      this.previewVerdict.set(null);
    this.previewOutputLines.set([]);
      this.wizardStage.set('Datos');
      this.banner.show(
        `Editando "${challenge.title}" (v${challenge.metadata?.version ?? 1}). Al publicar se crea la v${(challenge.metadata?.version ?? 1) + 1} conservando el challengeId.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.banner.show(`No se pudo abrir la edición: ${message}`);
    }
  }

  private draftFromChallenge(challenge: Challenge): Draft {
    return {
      challengeId: challenge.challengeId,
      courseCohortId: challenge.courseCohortId,
      title: challenge.title,
      topic: challenge.topic ?? '',
      difficulty: challenge.difficulty,
      subtype: challenge.subtype,
      notes: challenge.metadata?.notes ?? '',
      materialDocs: [...(challenge.metadata?.materialDocs ?? [])],
      language: 'typescript',
      entry: challenge.configuration.entry,
      runtime: challenge.configuration.runtime,
      baseFiles: challenge.configuration.baseFiles.map((file) => ({ ...file })),
      hiddenTestsText: JSON.stringify(challenge.configuration.hiddenTests ?? [], null, 2),
      expectedSolutionText: challenge.configuration.expectedSolution ?? '',
      timeLimitMs: challenge.configuration.timeLimitMs ?? 60000,
    };
  }
}