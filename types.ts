export interface MarkdownMasterSettings {
  // ... 其他属性
  [key: string]: boolean | string | number | { pattern: string; replacement: string }[] | 'remove' | 'escape' | 'ignore';
}