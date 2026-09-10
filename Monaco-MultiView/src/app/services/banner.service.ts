import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class BannerService {
  readonly message = signal('');

  show(text: string): void {
    this.message.set(text);
  }

  clear(): void {
    this.message.set('');
  }
}