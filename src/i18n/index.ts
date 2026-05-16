export type AppLanguage = 'zh-CN' | 'en-US';

export type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

export const LANGUAGE_STORAGE_KEY = '3t-app-language';

export const normalizeLanguage = (value?: string | null): AppLanguage => (
  String(value || '').toLowerCase().startsWith('en') ? 'en-US' : 'zh-CN'
);

export const getInitialLanguage = (): AppLanguage => {
  if (typeof window === 'undefined') return 'zh-CN';
  const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (saved) return normalizeLanguage(saved);
  const urlLanguage = new URLSearchParams(window.location.search).get('lang');
  if (urlLanguage) return normalizeLanguage(urlLanguage);
  return normalizeLanguage(window.navigator.language);
};

export const interpolate = (template: string, params?: Record<string, string | number>) => {
  if (!params) return template;
  return Object.entries(params).reduce(
    (text, [key, value]) => text.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value)),
    template
  );
};

export const createTranslator = (
  language: AppLanguage,
  dictionaries: Record<AppLanguage, Record<string, string>>
): TranslateFn => (key, params) => {
  const template = dictionaries[language]?.[key] || dictionaries['zh-CN']?.[key] || key;
  return interpolate(template, params);
};
