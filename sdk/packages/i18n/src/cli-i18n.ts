import { I18nEngine } from './engine';
import type { SupportedLanguage } from '@promptchain/schema';

let _i18n: I18nEngine | null = null;

export function getCliI18n(): I18nEngine {
  if (!_i18n) {
    _i18n = new I18nEngine({ lang: detectCliLang() });
  }
  return _i18n;
}

export function setCliLang(lang: SupportedLanguage): void {
  const i18n = getCliI18n();
  i18n.setLang(lang);
}

export function parseLangFlag(lang?: string): SupportedLanguage {
  if (!lang) return 'en';
  const supported = ['en', 'zh', 'es', 'ar', 'hi', 'pt', 'ru', 'ja', 'ko', 'fr', 'de', 'tr', 'vi', 'th', 'it', 'pl', 'nl', 'sv', 'da', 'fi'];
  if (supported.includes(lang)) return lang as SupportedLanguage;
  console.warn(`Unsupported language "${lang}", falling back to en`);
  return 'en';
}

function detectCliLang(): SupportedLanguage {
  const envLang = process.env.LC_ALL || process.env.LC_MESSAGES || process.env.LANG || 'en_US';
  const langCode = envLang.split('.')[0].split('_')[0].toLowerCase();
  return parseLangFlag(langCode);
}
