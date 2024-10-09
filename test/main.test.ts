import MarkdownMasterPlugin, { MarkdownMasterSettings } from '../main';
import { App, PluginManifest } from 'obsidian';

describe('MarkdownMasterPlugin', () => {
  let plugin: MarkdownMasterPlugin;

  beforeEach(() => {
    plugin = new MarkdownMasterPlugin();
    // 手动设置默认设置
    plugin.settings = {
      enableAutoFormat: false,
      autoFormatOnSave: false,
      formatTemplate: 'default',
      enableHeadingConversion: false,
      sourceHeadingLevel: 'h2',
      targetHeadingLevel: 'h1',
      recursiveHeadingConversion: false,
      enableListFormatting: true,
      listBulletChar: '-',
      listIndentSpaces: 2,
      enableLinkCleaning: false,
      unifyLinkStyle: false,
      linkStyle: 'inline',
      enableSymbolDeletion: false,
      symbolsToDelete: '',
      preserveSpacesAroundSymbols: true,
      customRegexRules: [],
      enableTableFormat: false,
      enableCodeHighlight: false,
      formatRules: [],
    } as MarkdownMasterSettings;
  });

  test('formatMarkdown handles list formatting', async () => {
    const input = "- Item 1\n  - Subitem 1\n- Item 2";
    const expected = "- Item 1\n  - Subitem 1\n- Item 2";
    
    const result = await plugin.formatMarkdown(input);
    expect(result).toBe(expected);
  });

  // ... 其他测试 ...
});