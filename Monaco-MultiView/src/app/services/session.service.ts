import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { Role } from '../challenge-types';

@Injectable({ providedIn: 'root' })
export class SessionService {
  readonly role = signal<Role>('PROFESOR');

  constructor(private readonly router: Router) {}

  select(next: Role, target: unknown[] = ['/dashboard']): void {
    if (next === this.role()) {
      return;
    }
    this.role.set(next);
    void this.router.navigate(target as never[]);
  }
}