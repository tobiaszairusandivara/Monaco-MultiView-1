import { Component, HostListener, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DEFAULT_COHORT, type ChallengeListItem } from '../challenge-types';
import { truncate } from '../shared';
import { BannerService } from '../services/banner.service';
import { ChallengesService } from '../services/challenges.service';
import { SessionService } from '../services/session.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  template: `
    <section class="view home">
      <div class="home-header">
        <div>
          <h2>{{ role() === 'ALUMNO' ? 'Desafíos disponibles' : 'Desafíos de mi curso' }}</h2>
          @if (role() !== 'ALUMNO') {
            <p class="muted">Cohorte {{ cohort }}</p>
          }
        </div>
        @if (role() !== 'ALUMNO') {
          <button type="button" class="btn btn-primary" (click)="newChallenge()">+ Nuevo desafío</button>
        }
      </div>

      @if (busy()) {
        <p class="muted">Cargando desafíos…</p>
      } @else if (challenges().length === 0) {
        <p class="muted">No hay desafíos publicados todavía.</p>
      } @else {
        <div class="card-grid">
          @for (c of challenges(); track c.challengeId) {
            <article class="card">
              <div class="card-top">
                <span class="tag">{{ c.subtype }}</span>
                <span class="badge badge-diff badge-difficulty-{{ c.difficulty }}">{{ c.difficulty }}</span>
              </div>
              <h3 class="card-title">{{ c.title }}</h3>
              <p class="card-topic">{{ c.topic || 'Sin tema' }}</p>
              @if (c.notes) {
                <p class="card-desc">{{ truncate(c.notes, 200) }}</p>
              }
              <div class="card-footer">
                @if (role() === 'ALUMNO') {
                  <button type="button" class="btn btn-primary" (click)="open(c)">Resolver</button>
                } @else {
                  <button type="button" class="btn btn-secondary" (click)="open(c)">Ver como alumno</button>
                  <button type="button" class="btn btn-secondary" (click)="edit(c)">Editar</button>
                  <button type="button" class="btn btn-danger" (click)="askDelete(c)">Eliminar</button>
                }
              </div>
            </article>
          }
        </div>
      }
    </section>

    @if (deleteTarget(); as target) {
      <div class="modal-backdrop" (click)="cancelDelete()">
        <div
          class="modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
          (click)="$event.stopPropagation()"
        >
          <h3 id="delete-modal-title">¿Eliminar el desafío?</h3>
          <p>
            Va a eliminar <strong>{{ target.title }}</strong>
            <span class="mono">({{ target.challengeId }})</span> de la lista de desafíos.
          </p>
          <p class="muted small">
            Es un soft delete: el desafío deja de listarse para los alumnos y docentes, pero se
            conservan su challengeId, versiones e historial de entregas. La operación es reversible
            por un administrador.
          </p>
          <div class="modal-actions">
            <button type="button" class="btn" (click)="cancelDelete()">Cancelar</button>
            <button type="button" class="btn btn-danger" (click)="confirmDelete()">
              Eliminar desafío
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class DashboardComponent implements OnInit {
  protected readonly session = inject(SessionService);
  protected readonly banner = inject(BannerService);
  private readonly challengesService = inject(ChallengesService);
  private readonly router = inject(Router);

  protected readonly role = this.session.role;
  protected readonly challenges = this.challengesService.list;
  protected readonly busy = this.challengesService.busy;
  protected readonly cohort = DEFAULT_COHORT;
  protected readonly truncate = truncate;
  protected readonly deleteTarget = signal<ChallengeListItem | null>(null);

  @HostListener('window:keydown', ['$event'])
  protected onWindowKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.deleteTarget()) {
      event.preventDefault();
      this.cancelDelete();
    }
  }

  ngOnInit(): void {
    void this.challengesService.load();
  }

  protected newChallenge(): void {
    void this.router.navigate(['/challenges', 'new']);
  }

  protected open(item: ChallengeListItem): void {
    void this.router.navigate(['/challenges', item.challengeId, 'solve']);
  }

  protected edit(item: ChallengeListItem): void {
    void this.router.navigate(['/challenges', item.challengeId, 'edit']);
  }

  protected askDelete(item: ChallengeListItem): void {
    this.deleteTarget.set(item);
  }

  protected cancelDelete(): void {
    this.deleteTarget.set(null);
  }

  protected async confirmDelete(): Promise<void> {
    const item = this.deleteTarget();
    if (!item) {
      return;
    }
    this.deleteTarget.set(null);
    try {
      await this.challengesService.remove(item.challengeId);
      this.banner.show(`Desafío "${item.title}" eliminado (soft delete).`);
      await this.challengesService.load();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.banner.show(`No se pudo eliminar: ${message}`);
    }
  }
}