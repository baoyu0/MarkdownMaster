export interface MarkdownMasterSettings {
  enableLinkRemoval: boolean;
  enableHeadingConversion: boolean;
  enableBoldRemoval: boolean;
  enableReferenceRemoval: boolean;
  customRegexRules: { pattern: string; replacement: string }[];
  enableAutoFormat: boolean;
  enableTableFormat: boolean;
  enableCodeHighlight: boolean;
  enableImageOptimization: boolean;
  enableTextStatistics: boolean;
  enableTitleNumbering: boolean;
  listIndentation: number;
  specialCharHandling: 'remove' | 'escape' | 'ignore';
}