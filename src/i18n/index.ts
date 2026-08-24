import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import it from './it.json';
import en from './en.json';

export type Locale = 'it' | 'en';

export function detectLocale(): Locale {
  return navigator.language?.toLowerCase().startsWith('it') ? 'it' : 'en';
}

export function initI18n(locale?: Locale): typeof i18n {
  void i18n.use(initReactI18next).init({
    resources: { it: { translation: it }, en: { translation: en } },
    lng: locale ?? detectLocale(),
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });
  return i18n;
}

export function setLocale(l: Locale): void {
  void i18n.changeLanguage(l);
}
