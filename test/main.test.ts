import MarkdownMasterPlugin from '../main';
import { App, MarkdownView, Editor } from 'obsidian';
import { MarkdownMasterSettings } from '../main'; // 假设 MarkdownMasterSettings 在 main.ts 中定义

jest.mock('obsidian');

describe('MarkdownMasterPlugin', () => {
  let plugin: MarkdownMasterPlugin;
  let mockApp: jest.Mocked<App>;
  let mockView: jest.Mocked<MarkdownView>;
  let mockEditor: jest.Mocked<Editor>;

  beforeEach(() => {
    mockApp = {
      workspace: {
        getActiveViewOfType: jest.fn(),
      },
    } as unknown as jest.Mocked<App>;

    mockEditor = {
      getValue: jest.fn(),
      setValue: jest.fn(),
    } as unknown as jest.Mocked<Editor>;

    mockView = {
      editor: mockEditor,
    } as unknown as jest.Mocked<MarkdownView>;

    (mockApp.workspace.getActiveViewOfType as jest.Mock).mockReturnValue(mockView);

    plugin = new MarkdownMasterPlugin();
    (plugin as any).app = mockApp;

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
      formatRules: [
        {
          id: 'headings',
          name: '标题格式化',
          description: '确保标题符号后有空格',
          enabled: true,
          priority: 100,
          apply: (content: string) => content.replace(/^(#+)([^\s#])/gm, '$1 $2')
        },
        {
          id: 'lists',
          name: '列表格式化',
          description: '统一列表符号和缩进',
          enabled: true,
          priority: 90,
          apply: (content: string) => {
            return content.replace(/^(\s*)([*+-]|\d+\.)\s+/gm, (match, indent, bullet) => {
              const newIndent = ' '.repeat(Math.floor(indent.length / 2) * 2);
              const newBullet = /^\d+\./.test(bullet) ? bullet : '-';
              return `${newIndent}${newBullet} `;
            });
          }
        },
      ],
    } as MarkdownMasterSettings;
  });

  test('formatMarkdown handles list formatting', async () => {
    const input = "- Item 1\n  - Subitem 1\n- Item 2";
    const expected = "- Item 1\n  - Subitem 1\n- Item 2";
    
    mockEditor.getValue.mockReturnValue(input);
    await plugin.formatMarkdown();
    expect(mockEditor.setValue).toHaveBeenCalledWith(expected);
  });

  test('formatMarkdown handles heading formatting', async () => {
    const input = "#Title\n##Subtitle";
    const expected = "# Title\n## Subtitle";
    
    mockEditor.getValue.mockReturnValue(input);
    await plugin.formatMarkdown();
    expect(mockEditor.setValue).toHaveBeenCalledWith(expected);
  });

  test('formatMarkdown handles link cleaning', async () => {
    plugin.settings.enableLinkCleaning = true;
    const input = "[Link](http://example.com) [Local](local.md)";
    const expected = "[Link](http://example.com) Local";
    
    mockEditor.getValue.mockReturnValue(input);
    await plugin.formatMarkdown();
    expect(mockEditor.setValue).toHaveBeenCalledWith(expected);
  });

  test('formatMarkdown handles link style unification', async () => {
    plugin.settings.unifyLinkStyle = true;
    plugin.settings.linkStyle = 'reference';
    const input = "[Link](http://example.com)";
    const expected = "[Link][1]\n\n[1]: http://example.com";
    
    mockEditor.getValue.mockReturnValue(input);
    await plugin.formatMarkdown();
    expect(mockEditor.setValue).toHaveBeenCalledWith(expected);
  });

  test('formatMarkdown applies custom regex rules', async () => {
    plugin.settings.customRegexRules = [
      { pattern: 'TODO', replacement: 'DONE' }
    ];
    const input = "TODO: Complete this task";
    const expected = "DONE: Complete this task";
    
    mockEditor.getValue.mockReturnValue(input);
    await plugin.formatMarkdown();
    expect(mockEditor.setValue).toHaveBeenCalledWith(expected);
  });

  test('formatTables formats tables correctly', () => {
    const input = "|A|B|\n|-|-|\n|1|2|";
    const expected = "| A | B |\n|---|---|\n| 1 | 2 |";
    
    const result = plugin.formatTables(input);
    expect(result).toBe(expected);
  });

  test('formatMarkdown handles code blocks correctly', async () => {
    plugin.settings.enableCodeHighlight = true;
    const input = "```js\nconst x = 1;\n```";
    const expected = "```js\nconst x = 1;\n```";
    
    mockEditor.getValue.mockReturnValue(input);
    await plugin.formatMarkdown();
    expect(mockEditor.setValue).toHaveBeenCalledWith(expected);
  });

  test('convertHeadings converts headings correctly', () => {
    plugin.settings.sourceHeadingLevel = 'h2';
    plugin.settings.targetHeadingLevel = 'h1';
    const input = "## Heading\n### Subheading";
    const expected = "# Heading\n### Subheading";
    expect(plugin.convertHeadings(input)).toBe(expected);
  });

  test('cleanLinks removes empty and duplicate links', () => {
    const input = "[Empty]()\n[Duplicate](http://example.com)\n[Duplicate](http://example.com)";
    const expected = "Empty\n[Duplicate](http://example.com)\nDuplicate";
    expect(plugin.cleanLinks(input)).toBe(expected);
  });

  test('unifyLinkStyle converts inline links to reference links', () => {
    plugin.settings.linkStyle = 'reference';
    const input = "This is an [inline link](http://example.com).";
    const expected = "This is an [inline link][1].\n\n[1]: http://example.com\n";
    expect(plugin.unifyLinkStyle(input)).toBe(expected);
  });

  test('unifyLinkStyle converts reference links to inline links', () => {
    plugin.settings.linkStyle = 'inline';
    const input = "This is a [reference link][1].\n\n[1]: http://example.com";
    const expected = "This is a [reference link](http://example.com).\n\n";
    expect(plugin.unifyLinkStyle(input)).toBe(expected);
  });
});