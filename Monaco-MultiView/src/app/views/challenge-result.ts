import { Component, Input, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { ChatMessage, IntegrityEvent, SubmissionResult } from '../challenge-types';
import type { ProjectFile } from '../projects';
import { goBack, prettyJson } from '../shared';
import { SessionService } from '../services/session.service';

interface SubmitPayload {
  submission: SubmissionResult;
  files: ProjectFile[];
  chatTranscript: ChatMessage[];
  integrityEvents?: IntegrityEvent[];
}

@Component({
  selector: 'app-challenge-result',
  standalone: true,
  template: `
    <section class="view student-submitted">
      @if (payload(); as payload) {
        <div class="result-card" [class.result-centered]="isStudent()">
          <span class="pill {{ pillClass(payload.submission.verdict) }}">
            {{ payload.submission.verdict }}
          </span>
          <h2>{{ payload.submission.feedback }}</h2>
          <p class="muted small mono">
            Submission {{ payload.submission.submissionId }} · {{ payload.submission.submittedAt }}
          </p>
          @if (!isStudent()) {
            <p class="muted">
              Resultado homogéneo entregado al Motor G3 (G05-E04): veredicto, feedback y
              trazabilidad de la resolución.
            </p>
          }
          @if (payload.submission.failingTest; as fail) {
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
          @if (!isStudent()) {
            <pre class="json-panel">{{ json() }}</pre>
          }
          <div class="actions-bar">
            <button type="button" class="btn btn-secondary" (click)="retry()">
              Volver a intentar
            </button>
            <button type="button" class="btn" (click)="toDashboard()">Volver a la lista</button>
          </div>
        </div>
      } @else {
        <p class="muted">No encontramos la entrega de esta resolución.</p>
        <div class="actions-bar">
          <button type="button" class="btn btn-secondary" (click)="back()">← Volver</button>
          <button type="button" class="btn" (click)="toDashboard()">Volver a la lista</button>
        </div>
      }
    </section>
  `,
})
export class ChallengeResultComponent implements OnInit {
  @Input() id?: string;

  protected readonly payload = signal<SubmitPayload | null>(null);
  protected readonly json = computed(() =>
    prettyJson({
      submission: this.payload()?.submission ?? null,
      files: this.payload()?.files ?? [],
      chatTranscript: this.payload()?.chatTranscript ?? [],
    }),
  );
  protected readonly challengeId = computed(() => this.payload()?.submission.challengeId ?? this.id ?? null);

  protected readonly session = inject(SessionService);
  protected readonly isStudent = computed(() => this.session.role() === 'ALUMNO');
  private readonly router = inject(Router);

  protected pillClass(verdict: string): string {
    return verdict === 'SUPERADO' ? 'ok' : verdict === 'ERROR_TECNICO' ? 'warn' : 'fail';
  }

  ngOnInit(): void {
    const state = (window.history.state ?? {}) as { payload?: SubmitPayload };
    if (state.payload) {
      this.payload.set(state.payload);
    }
  }

  protected retry(): void {
    const id = this.challengeId();
    if (id) {
      void this.router.navigate(['/challenges', id, 'solve']);
    }
  }

  protected toDashboard(): void {
    void this.router.navigate(['/dashboard']);
  }

  protected back(): void {
    goBack(this.router);
  }
}