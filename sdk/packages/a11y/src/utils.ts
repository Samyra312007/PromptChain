export function accessibleLabel(...parts: (string | undefined | null)[]): string {
  return parts.filter(Boolean).join(' ');
}

export function stripAnsi(text: string): string {
  return text.replace(/\u001b\[[0-9;]*m/g, '');
}

export function truncateUtf8(text: string, maxBytes: number): string {
  let encoded = Buffer.from(text, 'utf8');
  if (encoded.length <= maxBytes) return text;
  while (encoded.length > maxBytes) {
    text = text.slice(0, -1);
    encoded = Buffer.from(text, 'utf8');
  }
  return text;
}

export function byteSize(value: unknown): number {
  if (typeof value === 'string') return Buffer.byteLength(value);
  if (value instanceof Buffer) return value.length;
  if (value === null || value === undefined) return 0;
  try {
    return Buffer.byteLength(JSON.stringify(value));
  } catch {
    return 1024;
  }
}
