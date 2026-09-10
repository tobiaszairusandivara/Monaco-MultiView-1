export interface FormattedTestCase {
  name: string;
  input?: string;
  expected?: string;
  source: string;
}

export interface FormattedTestFile {
  language: 'java' | 'javascript';
  testCases: FormattedTestCase[];
}

export interface FormatTestResult {
  ok: boolean;
  json?: string;
  language?: 'java' | 'javascript';
  testCount?: number;
  error?: string;
}

function literalToText(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const quote = trimmed[0];
  if (quote === '"' || quote === "'" || quote === '`') {
    let body = trimmed.slice(1);
    if (body.length > 0 && body[body.length - 1] === quote) body = body.slice(0, -1);
    return body;
  }
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return trimmed;
  if (/^(true|false|null)$/.test(trimmed)) return trimmed;
  return null;
}

function splitTopLevel(text: string, separator = ','): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  let quote = '';
  for (const char of text) {
    if (quote) {
      current += char;
      if (char === '\\') {
        current += text[text.indexOf(char) + 1] ?? '';
        continue;
      }
      if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      current += char;
      continue;
    }
    if (char === '(' || char === '[' || char === '{') {
      depth += 1;
    } else if (char === ')' || char === ']' || char === '}') {
      depth = Math.max(0, depth - 1);
    }
    if (char === separator && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  parts.push(current.trim());
  return parts;
}

function takeParenBody(text: string, fromIndex: number): string | null {
  const open = text.indexOf('(', fromIndex);
  if (open < 0) return null;
  let depth = 0;
  let quote = '';
  for (let i = open; i < text.length; i += 1) {
    const char = text[i];
    if (quote) {
      if (char === '\\') {
        i += 1;
        continue;
      }
      if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '(' || char === '[' || char === '{') {
      depth += 1;
    } else if (char === ')' || char === ']' || char === '}') {
      depth = Math.max(0, depth - 1);
      if (char === ')' && depth === 0) {
        return text.slice(open + 1, i);
      }
    }
  }
  return null;
}

function assertionSource(assertion: string): string {
  return assertion.replace(/\s+/g, ' ').trim().slice(0, 160);
}

function parseJUnit(content: string): FormattedTestCase[] {
  const tests: FormattedTestCase[] = [];
  const methodRe = /@Test\s+(?:public\s+)?void\s+(\w+)\s*\(\s*\)\s*\{/g;
  const starts: Array<{ name: string; index: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = methodRe.exec(content)) !== null) {
    starts.push({ name: match[1], index: match.index + match[0].length });
  }
  for (let i = 0; i < starts.length; i += 1) {
    const block = starts[i + 1] ? content.slice(starts[i].index, starts[i + 1].index) : content.slice(starts[i].index);
    const assertRe = /assert(?:Equals|EqualsIgnoreCase|True|False|Null|NotNull|Same)\s*\(/g;
    let assertMatch: RegExpExecArray | null;
    let expected: string | undefined;
    let source = '';
    while ((assertMatch = assertRe.exec(block)) !== null) {
      const body = takeParenBody(block, assertMatch.index);
      if (body === null) continue;
      if (!source) source = assertionSource(assertMatch[0].replace(/\s*\($/, '') + `(${body})`);
      const args = splitTopLevel(body);
      if (args.length >= 2) {
        const candidate = literalToText(args[0]);
        if (candidate !== null && expected === undefined) {
          expected = candidate;
        }
      }
    }
    if (source) {
      tests.push({ name: starts[i].name, ...(expected !== undefined ? { expected } : {}), source });
    }
  }
  return tests;
}

function parseNodeTest(content: string): FormattedTestCase[] {
  const tests: FormattedTestCase[] = [];
  const nameRe = /\b(?:test|it)\s*\(\s*['"`]([^'"`]+)['"`]\s*,/g;
  const names: Array<{ name: string; index: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = nameRe.exec(content)) !== null) {
    names.push({ name: match[1], index: match.index + match[0].length });
  }
  for (let i = 0; i < names.length; i += 1) {
    const block = names[i + 1] ? content.slice(names[i].index, names[i + 1].index) : content.slice(names[i].index);
    const assertRe = /assert\.(strictEqual|equal|deepStrictEqual|deepEqual|assertEquals)\s*\(/g;
    let assertMatch: RegExpExecArray | null;
    let expected: string | undefined;
    let source = '';
    while ((assertMatch = assertRe.exec(block)) !== null) {
      const body = takeParenBody(block, assertMatch.index);
      if (body === null) continue;
      if (!source) source = assertionSource(`assert.${assertMatch[1]}(${body})`);
      const args = splitTopLevel(body);
      if (args.length >= 2) {
        const candidate = literalToText(args[args.length - 1]);
        if (candidate !== null && expected === undefined) {
          expected = candidate;
        }
      }
    }
    if (source) {
      tests.push({ name: names[i].name, ...(expected !== undefined ? { expected } : {}), source });
    }
  }
  return tests;
}

export function formatTestFile(path: string, content: string): FormatTestResult {
  if (!content || !content.trim()) {
    return { ok: false, error: 'El archivo de tests está vacío.' };
  }
  const extension = path.toLowerCase().split('?')[0].split('.').pop() ?? '';
  const name = path.replace(/\\/g, '/').split('/').pop() ?? path;
  if (extension === 'java') {
    const testCases = parseJUnit(content);
    if (testCases.length === 0) {
      return { ok: false, error: `${name}: no se detectaron métodos @Test con aserciones (assertEquals, assertTrue, …).` };
    }
    const payload: FormattedTestFile = { language: 'java', testCases };
    return {
      ok: true,
      json: JSON.stringify(payload, null, 2),
      language: 'java',
      testCount: testCases.length,
    };
  }
  if (extension === 'js' || extension === 'mjs' || extension === 'ts' || extension === 'tsx') {
    const testCases = parseNodeTest(content);
    if (testCases.length === 0) {
      return { ok: false, error: `${name}: no se detectaron tests con aserciones (test()/it() con assert.*).` };
    }
    const payload: FormattedTestFile = { language: 'javascript', testCases };
    return {
      ok: true,
      json: JSON.stringify(payload, null, 2),
      language: 'javascript',
      testCount: testCases.length,
    };
  }
  return { ok: false, error: `${name}: extensión no soportada (usá .java, .js, .mjs, .ts o .tsx).` };
}