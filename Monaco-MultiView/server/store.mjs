import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const DATA_DIR = process.env.MMV_DATA_DIR ?? join(process.cwd(), 'server', 'data');

const cache = new Map();

async function pathFor(name) {
  await mkdir(DATA_DIR, { recursive: true });
  return join(DATA_DIR, `${name}.json`);
}

export async function readCollection(name) {
  if (cache.has(name)) {
    return cache.get(name);
  }
  const path = await pathFor(name);
  let items = [];
  try {
    const raw = await readFile(path, 'utf8');
    items = raw ? JSON.parse(raw) : [];
  } catch {
    items = [];
  }
  cache.set(name, items);
  return items;
}

export async function saveCollection(name, items) {
  cache.set(name, items);
  const path = await pathFor(name);
  await writeFile(path, JSON.stringify(items, null, 2), 'utf8');
}

export async function nextId(prefix) {
  const stamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${stamp}${random}`;
}