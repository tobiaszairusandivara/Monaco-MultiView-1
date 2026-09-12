import { Component, Input, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { prettyJson } from '../shared';
import { ChallengesService } from '../services/challenges.service';
import { SessionService } from '../services/session.service';

@Component({
  selector: 'app-challenge-published',
  standalone: true,
  template: `
    <section class="view published">
      @if (notFound()) {
        <p class="muted">No encontramos la publicación de este desafío.</p>
        <div class="actions-bar">
          <button type="button" class="btn btn-secondary" (click)="back()">← Volver</button>
          <button type="button" class="btn btn-primary" (click)="toDashboard()">
            Volver a la lista
          </button>
        </div>
      } @else if (challenge(); as challenge) {
        <span class="pill ok">Publicado</span>
        <h2>{{ challenge.title }}</h2>
        <p class="muted">
          Payload del desafío entregado al Motor de Desafíos (G3) según RF-IA-21 y
          G05-E01-US01.
        </p>
        <pre class="json-panel">{{ json() }}</pre>
        <div class="actions-bar">
          <button type="button" class="btn btn-secondary" (click)="back()">← Volver</button>
          <button type="button" class="btn btn-secondary" (click)="publishAnother()">
            Nuevo desafío
          </button>
          <button type="button" class="btn btn-primary" (click)="viewAsStudent()">
            Ver como alumno
          </button>
        </div>
      }
    </section>
  `,
})
export class ChallengePublishedComponent implements OnInit {
  @Input() id?: string;

  private readonly router = inject(Router);

  protected readonly session = inject(SessionService);
  private readonly challengesService = inject(ChallengesService);

  protected readonly challenge = this.challengesService.published;
  protected readonly json = computed(() => prettyJson(this.challenge() ?? {}));
  protected readonly notFound = signal(false);

  ngOnInit(): void {
    if (!this.challenge() && this.id) {
      void this.restore(this.id);
    }
  }

  private async restore(challengeId: string): Promise<void> {
    try {
      const challenge = await this.challengesService.fetch(challengeId);
      this.challengesService.published.set(challenge);
    } catch {
      this.notFound.set(true);
    }
  }

  protected back(): void {
    this.toDashboard();
  }

  protected toDashboard(): void {
    void this.router.navigate(['/dashboard']);
  }

  protected publishAnother(): void {
    void this.router.navigate(['/challenges', 'new']);
  }

  protected viewAsStudent(): void {
    const id = this.challenge()?.challengeId ?? this.id;
    if (!id) {
      return;
    }
    this.session.select('ALUMNO', ['/challenges', id, 'solve']);
  }
}