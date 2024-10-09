import MarkdownMasterPlugin from '../main';
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
      formatRules: [], // 添加 formatRules 属性
    };
  });

  test('formatMarkdown handles list formatting', async () => {
    const input = "- Item 1\n  - Subitem 1\n- Item 2";
    const expected = "- Item 1\n  - Subitem 1\n- Item 2";
    
    // 使用 formatMarkdown 方法替代 standardizeLists
    const result = await plugin.formatMarkdown(input);
    expect(result).toBe(expected);
  });

  test('formatMarkdown', async () => {
    const input = "#Title\n\nSome text";
    const expected = "# Title\n\nSome text";
    expect(await plugin.formatMarkdown(input)).toBe(expected);
  });

  test('formatTables', async () => {
    const input = "|A|B|\n|-|-|\n|1|2|";
    const expected = "|A|B|\n|-|-|\n|1|2|";
    expect(await plugin.formatMarkdown(input)).toBe(expected);
  });
});