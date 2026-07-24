export type TextDirection = 'ltr' | 'rtl';

const RTL_LANGS = new Set(['ar', 'he', 'ur', 'fa', 'yi']);
const CJK_REGEX = /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF\uD83C-\uDBFF\uDC00-\uDFFF\u3000-\u303F\uFF00-\uFFEF\uAC00-\uD7AF]/;
const RTL_CHAR_REGEX = /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0750-\u077F\u08A0-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;

export function graphemeClusterLength(input: string): number {
  const segments = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  return [...segments.segment(input)].length;
}

export function truncateGraphemeClusters(input: string, maxClusters: number): string {
  const segments = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  const segs = [...segments.segment(input)];
  if (segs.length <= maxClusters) return input;
  return segs.slice(0, maxClusters).map(s => s.segment).join('');
}

export function isCjk(input: string): boolean {
  return CJK_REGEX.test(input);
}

export function isRtlScript(input: string): boolean {
  return RTL_CHAR_REGEX.test(input);
}

export function detectDirection(input: string, language?: string): TextDirection {
  if (language && RTL_LANGS.has(language)) return 'rtl';
  if (isRtlScript(input)) return 'rtl';
  return 'ltr';
}
