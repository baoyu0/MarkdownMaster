import { MarkdownMasterSettings } from './types';

export const DEFAULT_SETTINGS: MarkdownMasterSettings = {
  enableLinkRemoval: true,
  enableHeadingConversion: true,
  enableBoldRemoval: false,
  enableReferenceRemoval: false,
  customRegexRules: [],
  enableAutoFormat: false,
  enableTableFormat: true,
  enableCodeHighlight: true,
  enableImageOptimization: true,
  enableTextStatistics: true,
  enableTitleNumbering: false,
  listIndentation: 4,
  specialCharHandling: 'ignore'
};