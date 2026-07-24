import type { SupportedLanguage, SUPPORTED_LANGUAGES } from '@promptchain/schema';
import { translations, type TranslationMap, type TranslationKey } from './translations';

export type TranslateFunction = (key: TranslationKey, params?: Record<string, string | number>) => string;

export interface I18nConfig {
  lang: SupportedLanguage;
  fallbackLang?: SupportedLanguage;
}

export class I18nEngine {
  private lang: SupportedLanguage;
  private fallbackLang: SupportedLanguage;
  private cache: Map<string, string> = new Map();

  constructor(config: I18nConfig) {
    this.lang = config.lang;
    this.fallbackLang = config.fallbackLang ?? 'en';
  }

  get currentLang(): SupportedLanguage {
    return this.lang;
  }

  setLang(lang: SupportedLanguage): void {
    this.lang = lang;
    this.cache.clear();
  }

  t: TranslateFunction = (key, params?): string => {
    const cacheKey = `${this.lang}:${key}${params ? JSON.stringify(params) : ''}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const langMap = translations[this.lang] as Record<string, string> | undefined;
    let template = langMap?.[key];

    if (!template) {
      const fallbackMap = translations[this.fallbackLang] as Record<string, string> | undefined;
      template = fallbackMap?.[key];
    }

    if (!template) {
      template = key;
    }

    let result = template;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        result = result.replace(`{${k}}`, String(v));
      }
    }

    this.cache.set(cacheKey, result);
    return result;
  };

  translate = this.t;
}
