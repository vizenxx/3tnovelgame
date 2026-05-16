import type { AppLanguage } from './index';
import { enUS } from './en-US';
import { zhCN } from './zh-CN';

export const dictionaries: Record<AppLanguage, Record<string, string>> = {
  'zh-CN': zhCN,
  'en-US': enUS,
};
