import type { LocalizedString, SupportedLanguage, SUPPORTED_LANGUAGES } from '@promptchain/schema';

export interface ResolveOptions {
  prefer: SupportedLanguage;
  fallback?: SupportedLanguage;
}

export function detectLanguage(input: string): string {
  if (!input) return 'en';

  const firstChar = input.codePointAt(0);
  if (!firstChar) return 'en';

  if (firstChar >= 0x4E00 && firstChar <= 0x9FFF) return 'zh';
  if (firstChar >= 0x3040 && firstChar <= 0x309F) return 'ja';
  if (firstChar >= 0xAC00 && firstChar <= 0xD7AF) return 'ko';
  if (firstChar >= 0x0600 && firstChar <= 0x06FF) return 'ar';
  if (firstChar >= 0x0400 && firstChar <= 0x04FF) return 'ru';
  if (firstChar >= 0x0E00 && firstChar <= 0x0E7F) return 'th';
  if (firstChar >= 0x0980 && firstChar <= 0x09FF) return 'hi';

  if (firstChar >= 0x0590 && firstChar <= 0x05FF) return 'he';

  return 'en';
}

export function resolveLocalizedField(
  field: LocalizedString | undefined,
  text: string,
  options: ResolveOptions,
): string {
  if (!field) return text;

  const preferred = field[options.prefer];
  if (preferred) return preferred;

  if (options.fallback) {
    const fb = field[options.fallback];
    if (fb) return fb;
  }

  const en = field['en'];
  if (en) return en;

  const firstValue = Object.values(field)[0];
  if (firstValue) return firstValue;

  return text;
}
