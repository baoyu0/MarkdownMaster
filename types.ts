export interface MarkdownMasterSettings {
  enableLinkRemoval: boolean;
  enableHeadingConversion: boolean;
  // ... 其他属性
  customRegexRules: { pattern: string; replacement: string }[];
  // ... 其他属性
  [key: string]: boolean | string | number | { pattern: string; replacement: string }[] | 'remove' | 'escape' | 'ignore';
}