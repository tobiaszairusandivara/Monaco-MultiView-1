import { Injectable, signal } from '@angular/core';
import { CompileService } from '../compile.service';
import type { Challenge, ChallengeListItem, CreateChallengePayload } from '../challenge-types';

@Injectable({ providedIn: 'root' })
export class ChallengesService {
  readonly list = signal<ChallengeListItem[]>([]);
  readonly busy = signal(false);
  readonly published = signal<Challenge | null>(null);

  constructor(private readonly compileService: CompileService) {}

  async load(): Promise<void> {
    this.busy.set(true);
    try {
      const result = await this.compileService.listChallenges();
      this.list.set(result.challenges);
    } finally {
      this.busy.set(false);
    }
  }

  async fetch(id: string): Promise<Challenge> {
    const result = await this.compileService.getChallenge(id);
    return result.challenge;
  }

  async save(payload: CreateChallengePayload, editingId: string | null): Promise<Challenge> {
    const result = editingId
      ? await this.compileService.updateChallenge(editingId, payload)
      : await this.compileService.createChallenge(payload);
    this.published.set(result.challenge);
    return result.challenge;
  }

  async remove(id: string): Promise<void> {
    await this.compileService.deleteChallenge(id);
  }
}