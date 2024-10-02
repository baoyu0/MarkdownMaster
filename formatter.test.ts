import { formatMarkdown } from './formatter';
import { MarkdownMasterSettings } from './types';

const defaultSettings: MarkdownMasterSettings = {
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
    listIndentation: 2,
    specialCharHandling: 'ignore'
};

describe('formatMarkdown', () => {
    test('removes links when enabled', () => {
        const input = '[1] https://example.com\nSome text';
        const expected = 'Some text';
        expect(formatMarkdown(input, defaultSettings)).toBe(expected);
    });

    test('converts headings when enabled', () => {
        const input = '## Heading';
        const expected = '# Heading';
        expect(formatMarkdown(input, defaultSettings)).toBe(expected);
    });

    test('does not remove bold when disabled', () => {
        const input = '**Bold text**';
        const expected = '**Bold text**';
        expect(formatMarkdown(input, defaultSettings)).toBe(expected);
    });

    // 添加更多测试用例...
});

// 为每个规则添加单独的测试
describe('LinkRemovalRule', () => {
    // ...
});

describe('HeadingConversionRule', () => {
    // ...
});

// ... 其他规则的测试