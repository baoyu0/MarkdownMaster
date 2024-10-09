import MarkdownMasterPlugin from '../main';
import { App, PluginManifest } from 'obsidian';

describe('MarkdownMasterPlugin', () => {
  let plugin: MarkdownMasterPlugin;

  beforeEach(() => {
    plugin = new MarkdownMasterPlugin();
    // 手动设置默认设置
    plugin.settings = {
      // ... 其他设置 ...
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

  // ... 其他测试 ...
});