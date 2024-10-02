import { MarkdownMasterSettings } from './types';

// 定义格式化规则接口
export interface FormatRule {
  apply(content: string): string;
  priority: number;
  dependencies?: string[];
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

// ... 其他规则类的实现 ...

// 格式化器类
class Formatter {
  private rules: FormatRule[] = [];

  addRule(rule: FormatRule): void {
    this.rules.push(rule);
  }

  format(content: string): string {
    return this.rules.reduce((formattedContent, rule) => rule.apply(formattedContent), content);
  }
}

// 规则工厂
export class RuleFactory {
  private static ruleMap: { [key: string]: new (...args: any[]) => FormatRule } = {
    LinkRemoval: LinkRemovalRule,
    HeadingConversion: HeadingConversionRule,
    // ... 其他规则
  };

  static createRule(ruleName: string, ...args: any[]): FormatRule {
    const RuleClass = this.ruleMap[ruleName];
    if (!RuleClass) {
      throw new Error(`Unknown rule: ${ruleName}`);
    }
    return new RuleClass(...args);
  }

  static getRuleNames(): string[] {
    return Object.keys(this.ruleMap);
  }
}

// 主格式化函数
export function formatMarkdown(content: string, settings: MarkdownMasterSettings): string {
  const formatter = new Formatter();

  if (settings.enableLinkRemoval) formatter.addRule(RuleFactory.createRule('LinkRemoval'));
  if (settings.enableHeadingConversion) formatter.addRule(RuleFactory.createRule('HeadingConversion'));
  // ... 其他规则的添加 ...

  if (Array.isArray(settings.customRegexRules)) {
    settings.customRegexRules.forEach(rule => {
      formatter.addRule(RuleFactory.createRule('CustomRegex', rule.pattern, rule.replacement));
    });
  }

  return formatter.format(content).trim();
}