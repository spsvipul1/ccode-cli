import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function exportConversation(messages: Array<{ role: string; content: string }>, filename?: string): string {
  const name = filename || `conversation-${Date.now()}.json`;
  const out = JSON.stringify(messages, null, 2);
  writeFileSync(join(process.cwd(), name), out, 'utf8');
  return name;
}
