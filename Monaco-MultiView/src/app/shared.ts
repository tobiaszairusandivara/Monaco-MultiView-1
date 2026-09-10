import type { Router } from '@angular/router';
import {
  RUNNABLE_SUBTYPES,
  SUBTYPE_RISK,
  type Challenge,
  type ChallengeListItem,
  type ChallengeSubtype,
  type RiskLevel,
} from './challenge-types';

export function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function riskOf(challenge: ChallengeListItem | Challenge): RiskLevel {
  return challenge.riskLevel ?? SUBTYPE_RISK[challenge.subtype];
}

export function isRunnable(challenge: Challenge | ChallengeListItem): boolean {
  return RUNNABLE_SUBTYPES.has(challenge.subtype) || challenge.configuration?.runtime != null;
}

export function isRunnableSubtype(subtype: ChallengeSubtype | null): boolean {
  return subtype !== null && RUNNABLE_SUBTYPES.has(subtype);
}

export function normalizeLines(text: string): string[] {
  return String(text ?? '')
    .trim()
    .split('\n')
    .map((line) => line.trim());
}

export function linesEqual(actual: string[], expected: string[]): boolean {
  return actual.length === expected.length && actual.every((line, i) => line === expected[i]);
}

export function goBack(router: Router, fallback: unknown[] = ['/dashboard']): void {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    void router.navigate(fallback as never[]);
  }
}