import { MarkdownMasterSettings } from './types';

// 定义格式化规则接口
export interface FormatRule {
  apply(content: string): string;
  priority: number;
  dependencies?: string[];
}

// 规则工厂
export class RuleFactory {
  private static ruleMap: { [key: string]: new (...args: any[]) => FormatRule } = {
    LinkRemoval: LinkRemovalRule,
    HeadingConversion: HeadingConversionRule,
    BoldRemoval: BoldRemovalRule,
    ReferenceRemoval: ReferenceRemovalRule,
    EnsureSpaceAfterHeadings: EnsureSpaceAfterHeadingsRule,
    EnsureSpaceAfterListItems: EnsureSpaceAfterListItemsRule,
    RemoveExcessiveNewlines: RemoveExcessiveNewlinesRule,
    FixOrderedListFormat: FixOrderedListFormatRule,
    TableFormat: TableFormatRule,
    CodeHighlight: CodeHighlightRule,
    ImageOptimization: ImageOptimizationRule,
    TitleNumbering: TitleNumberingRule,
    ListIndentation: ListIndentationRule,
    SpecialCharHandling: SpecialCharHandlingRule,
    CustomRegex: CustomRegexRule,
  };

  static createRule(ruleName: string, ...args: any[]): FormatRule {
    const RuleClass = this.ruleMap[ruleName];
    if (!RuleClass) {
      throw new Error(`Unknown rule: ${ruleName}`);
    }
    return new RuleClass(...args);
  }

  // 添加这个新方法
  static getRuleNames(): string[] {
    return Object.keys(this.ruleMap);
  }
}

// 实现具体的格式化规则
class LinkRemovalRule implements FormatRule {
  priority = 10;
  apply(content: string): string {
    return content.replace(/^\[(\d+)\]\s+(https?:\/\/\S+)$/gm, '');
  }
}

class HeadingConversionRule implements FormatRule {
  priority = 20;
  apply(content: string): string {
    return content.replace(/^##/gm, '#');
  }
}

class BoldRemovalRule implements FormatRule {
  priority = 30;
  apply(content: string): string {
    return content.replace(/\*\*/g, '');
  }
}

class ReferenceRemovalRule implements FormatRule {
  priority = 40;
  apply(content: string): string {
    return content.replace(/\[\d+\]/g, '');
  }
}

class EnsureSpaceAfterHeadingsRule implements FormatRule {
  priority = 50;
  dependencies = ['HeadingConversion'];
  apply(content: string): string {
    return content.replace(/^(#+)([^\s#])/gm, '$1 $2');
  }
}

class EnsureSpaceAfterListItemsRule implements FormatRule {
  priority = 60;
  apply(content: string): string {
    return content.replace(/^(\s*)-([^\s])/gm, '$1- $2');
  }
}

class RemoveExcessiveNewlinesRule implements FormatRule {
  priority = 70;
  apply(content: string): string {
    return content.replace(/\n{3,}/g, '\n\n');
  }
}

class FixOrderedListFormatRule implements FormatRule {
  priority = 80;
  apply(content: string): string {
    return content.replace(/^(\d+)\.([^\s])/gm, '$1. $2');
  }
}

class TableFormatRule implements FormatRule {
  priority = 90;
  apply(content: string): string {
    // 实现表格格式化逻辑
    return content;
  }
}

class CodeHighlightRule implements FormatRule {
  priority = 100;
  apply(content: string): string {
    return content.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
      return `\`\`\`${lang || ''}\n${code.trim()}\n\`\`\``;
    });
  }
}

class ImageOptimizationRule implements FormatRule {
  priority = 110;
  apply(content: string): string {
    return content.replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, url) => {
      const optimizedUrl = url.replace(/^http:/, 'https:');
      return `![${alt}](${optimizedUrl})`;
    });
  }
}

class TitleNumberingRule implements FormatRule {
  priority = 120;
  dependencies = ['HeadingConversion'];
  apply(content: string): string {
    return content.replace(/^(#{1,6}\s+(?:\d+\.)*\d+(?:\s*-\s*)?)\s*(?:\d+\.)*\s*(.+)$/gm, '$1 $2');
  }
}

class ListIndentationRule implements FormatRule {
  priority = 130;
  constructor(private indentation: number) {}
  apply(content: string): string {
    return content.replace(/^(\s*)[-*+]/gm, (match, spaces) => {
      return ' '.repeat(this.indentation) + match.trim();
    });
  }
}

class SpecialCharHandlingRule implements FormatRule {
  priority = 140;
  constructor(private handling: 'remove' | 'escape' | 'ignore') {}
  apply(content: string): string {
    if (this.handling === 'remove') {
      return content.replace(/[^\w\s]/g, '');
    } else if (this.handling === 'escape') {
      return content.replace(/[^\w\s]/g, '\\$&');
    }
    return content;
  }
}

class CustomRegexRule implements FormatRule {
  priority = 150;
  constructor(private pattern: string, private replacement: string) {}
  apply(content: string): string {
    const regex = new RegExp(this.pattern, 'g');
    return content.replace(regex, this.replacement);
  }
}

// 格式化器类
class Formatter {
  private rules: FormatRule[] = [];

  addRule(rule: FormatRule): void {
    this.rules.push(rule);
  }

  format(content: string): string {
    // 按优先级排序规则
    this.rules.sort((a, b) => a.priority - b.priority);

    // 创建依赖图
    const dependencyGraph: { [key: string]: string[] } = {};
    this.rules.forEach(rule => {
      const ruleName = rule.constructor.name;
      dependencyGraph[ruleName] = rule.dependencies || [];
    });

    // 拓扑排序
    const sortedRules = this.topologicalSort(dependencyGraph);

    // 按排序后的顺序应用规则
    return sortedRules.reduce((formattedContent, ruleName) => {
      const rule = this.rules.find(r => r.constructor.name === ruleName);
      return rule ? rule.apply(formattedContent) : formattedContent;
    }, content);
  }

  private topologicalSort(graph: { [key: string]: string[] }): string[] {
    const result: string[] = [];
    const visited: { [key: string]: boolean } = {};
    const temp: { [key: string]: boolean } = {};

    const visit = (node: string) => {
      if (temp[node]) {
        throw new Error('Circular dependency detected');
      }
      if (!visited[node]) {
        temp[node] = true;
        (graph[node] || []).forEach(visit);
        temp[node] = false;
        visited[node] = true;
        result.unshift(node);
      }
    };

    Object.keys(graph).forEach(node => {
      if (!visited[node]) {
        visit(node);
      }
    });

    return result;
  }
}

// 主格式化函数
export function formatMarkdown(content: string, settings: MarkdownMasterSettings): string {
  const formatter = new Formatter();

  if (settings.enableLinkRemoval) formatter.addRule(RuleFactory.createRule('LinkRemoval'));
  if (settings.enableHeadingConversion) formatter.addRule(RuleFactory.createRule('HeadingConversion'));
  if (settings.enableBoldRemoval) formatter.addRule(RuleFactory.createRule('BoldRemoval'));
  if (settings.enableReferenceRemoval) formatter.addRule(RuleFactory.createRule('ReferenceRemoval'));

  formatter.addRule(RuleFactory.createRule('EnsureSpaceAfterHeadings'));
  formatter.addRule(RuleFactory.createRule('EnsureSpaceAfterListItems'));
  formatter.addRule(RuleFactory.createRule('RemoveExcessiveNewlines'));
  formatter.addRule(RuleFactory.createRule('FixOrderedListFormat'));

  settings.customRegexRules.forEach(rule => {
    formatter.addRule(RuleFactory.createRule('CustomRegex', rule.pattern, rule.replacement));
  });

  if (settings.enableTableFormat) formatter.addRule(RuleFactory.createRule('TableFormat'));
  if (settings.enableCodeHighlight) formatter.addRule(RuleFactory.createRule('CodeHighlight'));
  if (settings.enableImageOptimization) formatter.addRule(RuleFactory.createRule('ImageOptimization'));
  if (settings.enableTitleNumbering) formatter.addRule(RuleFactory.createRule('TitleNumbering'));

  formatter.addRule(RuleFactory.createRule('ListIndentation', settings.listIndentation));
  formatter.addRule(RuleFactory.createRule('SpecialCharHandling', settings.specialCharHandling));

  return formatter.format(content).trim();
}