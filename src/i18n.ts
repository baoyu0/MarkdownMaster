export const TRANSLATIONS: Record<SupportedLanguage, Record<string, string>> = {
  zh: {
    "Markdown Master Settings": "Markdown Master 设置",
    "Enable Auto Format": "启用自动格式化",
    "Automatically format Markdown content on save": "保存时自动格式化 Markdown 内容",
    "Enable Heading Conversion": "启用标题转换",
    "Convert headings to specified levels": "将标题转换为指定级别",
    "Source Heading Level": "源标题级别",
    "Select the source heading level for conversion": "选择要转换的源标题级别",
    "Target Heading Level": "目标标题级别",
    "Select the target heading level for conversion": "选择转换后的目标标题级别",
    "Recursive Heading Conversion": "递归标题转换",
    "Convert all subheadings recursively": "递归转换所有子标题",
    "Enable Link Cleaning": "启用链接清理",
    "Clean links based on custom rules": "根据自定义规则清理链接",
    "Enable Symbol Deletion": "启用符号删除",
    "Delete specific symbols from text": "从文本中删除特定符号",
    "Symbols to Delete": "要删除的符号",
    "Enter symbols to delete (without spaces)": "输入要删除的符号（不含空格）",
    // ... 添加更多翻译
  },
  en: {
    "Markdown Master Settings": "Markdown Master Settings",
    "Enable Auto Format": "Enable Auto Format",
    "Automatically format Markdown content on save": "Automatically format Markdown content on save",
    "Enable Heading Conversion": "Enable Heading Conversion",
    "Convert headings to specified levels": "Convert headings to specified levels",
    "Source Heading Level": "Source Heading Level",
    "Select the source heading level for conversion": "Select the source heading level for conversion",
    "Target Heading Level": "Target Heading Level",
    "Select the target heading level for conversion": "Select the target heading level for conversion",
    "Recursive Heading Conversion": "Recursive Heading Conversion",
    "Convert all subheadings recursively": "Convert all subheadings recursively",
    "Enable Link Cleaning": "Enable Link Cleaning",
    "Clean links based on custom rules": "Clean links based on custom rules",
    "Enable Symbol Deletion": "Enable Symbol Deletion",
    "Delete specific symbols from text": "Delete specific symbols from text",
    "Symbols to Delete": "Symbols to Delete",
    "Enter symbols to delete (without spaces)": "Enter symbols to delete (without spaces)",
    // ... 添加更多翻译
  }
};

export type SupportedLanguage = keyof typeof TRANSLATIONS;