import type { ProjectFile } from './projects';

export type RiskLevel = 'ALTO' | 'MEDIO' | 'BAJO';
export type Difficulty = 'BASICO' | 'MEDIO' | 'AVANZADO';
export type Verdict = 'SUPERADO' | 'FALLADO' | 'ERROR_TECNICO';
export type Role = 'PROFESOR' | 'ADMIN' | 'ALUMNO';
export type IntegrityEventType = 'COPY' | 'PASTE' | 'WINDOW_BLUR' | 'WINDOW_FOCUS';

export interface IntegrityEvent {
  type: IntegrityEventType;
  timestamp: string;
  characters?: number;
  lines?: number;
}

export type IntegrityRiskLevel = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';

export interface IntegrityRisk {
  level: IntegrityRiskLevel;
  reasons: string[];
}

export type ChallengeSubtype =
  | 'algorithms'
  | 'block-completion'
  | 'find-bug'
  | 'refactoring'
  | 'hackathon'
  | 'modeling'
  | 'code-review';

export const CHALLENGE_SUBTYPES: ChallengeSubtype[] = [
  'algorithms',
  'block-completion',
  'find-bug',
  'refactoring',
  'hackathon',
  'modeling',
  'code-review',
];

export const SUBTYPE_RISK: Record<ChallengeSubtype, RiskLevel> = {
  'block-completion': 'ALTO',
  'find-bug': 'ALTO',
  algorithms: 'MEDIO',
  refactoring: 'MEDIO',
  modeling: 'MEDIO',
  hackathon: 'BAJO',
  'code-review': 'BAJO',
};

export const RUNNABLE_SUBTYPES = new Set<ChallengeSubtype>([
  'algorithms',
  'block-completion',
  'find-bug',
]);

export interface SubtypeMeta {
  label: string;
  short: string;
  description: string;
  riskLevel: RiskLevel;
  runnable: boolean;
}

export const SUBTYPE_META: Record<ChallengeSubtype, SubtypeMeta> = {
  algorithms: {
    label: 'Algoritmos',
    short: 'alg',
    description: 'Resolución de un problema algorítmico completo, de entrada y salida definida.',
    riskLevel: 'MEDIO',
    runnable: true,
  },
  'block-completion': {
    label: 'Completar bloque',
    short: 'blk',
    description: 'Completar una parte faltante dentro de un código ya esqueleto.',
    riskLevel: 'ALTO',
    runnable: true,
  },
  'find-bug': {
    label: 'Encontrar el bug',
    short: 'bug',
    description: 'Detectar y corregir el defecto en un código que no funciona como debería.',
    riskLevel: 'ALTO',
    runnable: true,
  },
  refactoring: {
    label: 'Refactoring',
    short: 'ref',
    description: 'Mejorar calidad, nombres y estructura de un código que ya funciona.',
    riskLevel: 'MEDIO',
    runnable: false,
  },
  hackathon: {
    label: 'Hackathon',
    short: 'hck',
    description: 'Resolución colaborativa y creativa de una consigna abierta con límite de tiempo.',
    riskLevel: 'BAJO',
    runnable: false,
  },
  modeling: {
    label: 'Modelado de dominio',
    short: 'mdl',
    description: 'Diseñar el modelo de datos / clases de acuerdo a una descripción de negocio.',
    riskLevel: 'MEDIO',
    runnable: false,
  },
  'code-review': {
    label: 'Code review',
    short: 'rev',
    description: 'Evaluar críticamente un código ajeno y justificar mejoras.',
    riskLevel: 'BAJO',
    runnable: false,
  },
};

export interface HiddenTest {
  name: string;
  input?: string;
  expected: string;
  source?: string;
}

export interface FailingTest {
  name: string;
  input: string;
  expected: string;
  actual: string;
  status: string;
}

export type MigrationSandboxRuntime = 'maven-test' | 'node-spec';

export interface ChallengeMetadata {
  version: number;
  createdAt: string;
  updatedAt: string;
  softDeleted: boolean;
  notes?: string;
  materialDocs?: string[];
  riskLevel: RiskLevel;
}

export interface ChallengeConfiguration {
  language: string;
  entry: string;
  baseFiles: ProjectFile[];
  hiddenTests: HiddenTest[];
  expectedSolution: string;
  runtime?: MigrationSandboxRuntime;
  timeLimitMs?: number;
}

export interface Challenge {
  challengeId: string;
  courseCohortId: string;
  title: string;
  topic?: string;
  subtype: ChallengeSubtype;
  difficulty: Difficulty;
  mandatory?: boolean;
  durationMs?: number | null;
  configuration: ChallengeConfiguration;
  metadata: ChallengeMetadata;
  riskLevel?: RiskLevel;
}

export interface ChallengeListItem {
  challengeId: string;
  courseCohortId: string;
  title: string;
  topic: string;
  notes: string;
  subtype: ChallengeSubtype;
  difficulty: Difficulty;
  mandatory: boolean;
  riskLevel: RiskLevel;
  metadata: { version: number; createdAt: string; updatedAt: string; softDeleted: boolean };
  configuration: {
    language: string;
    entry: string;
    runtime?: MigrationSandboxRuntime;
    fileCount: number;
    entryContent: string;
    testCount: number;
  };
}

export interface Draft {
  challengeId: string;
  courseCohortId: string;
  title: string;
  topic: string;
  difficulty: Difficulty;
  mandatory: boolean;
  subtype: ChallengeSubtype;
  durationMs: number | null;
  notes: string;
  materialDocs: string[];
  language: 'typescript';
  entry: string;
  runtime?: MigrationSandboxRuntime;
  baseFiles: ProjectFile[];
  hiddenTestsText: string;
  expectedSolutionText: string;
  timeLimitMs: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface ChatReply {
  ok: boolean;
  reply: string;
  blocked: boolean;
  riskLevel: RiskLevel;
}

export interface ChatStatus {
  ok: boolean;
  chat: { provider: string; model: string; ollamaUrl: string | null };
}

export interface PreviewRunResult {
  ok: boolean;
  status: string;
  output: string;
  error: string;
  tests?: Array<{ name: string; passed: boolean; message?: string }>;
  timeMs?: number;
  memoryBytes?: number;
}

export interface EvaluationResult {
  ok: boolean;
  executionId: string;
  challengeId: string;
  evaluate: boolean;
  verdict?: Verdict;
  feedback?: string;
  failingTest?: FailingTest | null;
  status?: string;
  output?: string;
  error?: string;
  tests?: Array<{ name: string; passed: boolean; message?: string }>;
  timeMs?: number;
  memoryBytes?: number;
}

export interface SubmissionResult {
  ok: boolean;
  submissionId: string;
  challengeId: string;
  courseCohortId: string;
  studentId: string;
  verdict: Verdict;
  feedback: string;
  failingTest?: FailingTest | null;
  submittedAt: string;
  integrityEvents?: IntegrityEvent[];
  integrityRisk?: IntegrityRisk;
}

export interface CreateChallengePayload {
  challengeId: string;
  courseCohortId: string;
  title: string;
  topic: string;
  subtype: ChallengeSubtype;
  difficulty: Difficulty;
  mandatory: boolean;
  durationMs?: number | null;
  notes: string;
  materialDocs: string[];
  configuration: {
    language: string;
    entry: string;
    runtime?: MigrationSandboxRuntime;
    baseFiles: ProjectFile[];
    hiddenTests: HiddenTest[];
    expectedSolution: string;
    timeLimitMs?: number;
  };
}

export const DEFAULT_COHORT = 'TUP-2026-01';

export function slugify(text: string): string {
  const cleaned = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'desafio';
}

export function parseHiddenTests(
  text: string,
): { tests: HiddenTest[]; language?: string } | { tests: null; error: string; language?: string } {
  try {
    const value = JSON.parse(text);
    if (Array.isArray(value)) {
      for (const test of value) {
        if (!test || typeof test.name !== 'string' || typeof test.expected !== 'string') {
          return { tests: null, error: 'Cada test debe tener name (string) y expected (string).' };
        }
        if (test.input !== undefined && typeof test.input !== 'string') {
          return { tests: null, error: 'El campo input (si existe) debe ser un string.' };
        }
      }
      return { tests: value as HiddenTest[] };
    }
    if (value && typeof value === 'object' && Array.isArray(value.testCases)) {
      const language = value.language;
      if (language !== undefined && language !== 'java' && language !== 'javascript') {
        return { tests: null, error: 'El campo language del JSON de tests debe ser "java" o "javascript".' };
      }
      const tests: HiddenTest[] = [];
      for (const testCase of value.testCases) {
        if (!testCase || typeof testCase.name !== 'string' || !testCase.name.trim()) {
          return { tests: null, error: 'Cada testCase del JSON debe tener un name (string) no vacío.' };
        }
        const test: HiddenTest = {
          name: testCase.name,
          expected:
            typeof testCase.expected === 'string'
              ? testCase.expected
              : typeof testCase.source === 'string'
                ? testCase.source
                : '',
        };
        if (typeof testCase.input === 'string') {
          test.input = testCase.input;
        }
        if (typeof testCase.source === 'string') {
          test.source = testCase.source;
        }
        tests.push(test);
      }
      if (tests.length === 0) {
        return { tests: null, error: 'El JSON de tests no contiene testCases.' };
      }
      return { tests, language };
    }
    return { tests: null, error: 'El JSON debe ser un arreglo de tests o un objeto { language, testCases }.' };
  } catch (error) {
    return { tests: null, error: error instanceof Error ? `JSON invalido: ${error.message}` : 'JSON invalido.' };
  }
}