import { createHash } from 'crypto';

export function normalizeNfc(input: string): string {
  return input.normalize('NFC');
}

export function normalizeNfcSafe(input: string | null | undefined): string {
  if (!input) return '';
  return input.normalize('NFC');
}

export function computeCidNfc(content: string): string {
  const normalized = normalizeNfc(content);
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}
