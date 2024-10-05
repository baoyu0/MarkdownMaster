import { MarkdownMasterPlugin } from '../main';

describe('MarkdownMasterPlugin', () => {
  let plugin: MarkdownMasterPlugin;

  beforeEach(() => {
    plugin = new MarkdownMasterPlugin();
  });

  test('standardizeLists', () => {
    const input = "* Item 1\n+ Item 2\n- Item 3";
    const expected = "- Item 1\n- Item 2\n- Item 3";
    expect(plugin.standardizeLists(input)).toBe(expected);
  });

  // 添加更多测试用例
  test('formatMarkdown', async () => {
    const input = "# Title\n\nSome **bold** text";
    const expected = "# Title\n\nSome text";
    expect(await plugin.formatMarkdown(input)).toBe(expected);
  });

  test('formatTables', () => {
    const input = "| A | B |\n|---|---|\n| 1 | 2 |";
    const expected = "| A   | B   |\n|-----|-----|\n| 1   | 2   |";
    expect(plugin.formatTables(input)).toBe(expected);
  });

  // 添加更多测试...
});