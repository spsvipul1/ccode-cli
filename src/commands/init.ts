import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const TEMPLATE = `# CLAUDE.md

This file documents the project and provides guidance to the coding assistant.

- Language: TypeScript/Node
- Commands: document building/testing and conventions here.
`;

export function initClaudeDoc(cwd: string = process.cwd()): string {
  const p = join(cwd, 'CLAUDE.md');
  writeFileSync(p, TEMPLATE, 'utf8');
  return p;
}
