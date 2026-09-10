import { Component, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { BannerService } from './services/banner.service';
import { SessionService } from './services/session.service';
import type { Role } from './challenge-types';

const ROLES: Role[] = ['PROFESOR', 'ADMIN', 'ALUMNO'];

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <div class="app">
      <header class="toolbar">
        <span class="app-title">Monaco MultiView — Desafíos Prácticos <span class="sub">(G5)</span></span>
        <div class="role-selector">
          <span class="role-label">Rol (simulado)</span>
          @for (r of roles; track r) {
            <button type="button" class="role-btn" [class.active]="r === session.role()" (click)="session.select(r)">
              {{ r }}
            </button>
          }
        </div>
      </header>

      @if (banner.message()) {
        <div class="banner">{{ banner.message() }}</div>
      }

      <main class="main">
        <router-outlet />
      </main>
    </div>
  `,
})
export class App {
  protected readonly roles = ROLES;
  protected readonly session = inject(SessionService);
  protected readonly banner = inject(BannerService);

  constructor() {
    const router = inject(Router);
    router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.banner.clear());
  }
}