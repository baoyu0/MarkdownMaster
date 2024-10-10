export type SupportedLanguage = 'zh' | 'en';

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
    "Enable Text Deletion": "启用文本删除",
    "Delete text based on custom regex patterns": "根据自定义正则表达式模式删除文本",
    "Enable Symbol Deletion": "启用符号删除",
    "Delete specific symbols from text": "从文本中删除特定符号",
    "Symbols to Delete": "要删除的符号",
    "Enter symbols to delete (without spaces)": "输入要删除的符号（不含空格）",
    "Export Settings": "导出设置",
    "Export your current settings to a JSON file": "将当前设置导出为 JSON 文件",
    "Import Settings": "导入设置",
    "Import settings from a JSON file": "从 JSON 文件导入设置",
    "Language": "语言",
    "Select the plugin language": "选择插件语言",
    "Export": "导出",
    "Import": "导入",
  },
  en: {
    // ... 保持英文翻译不变
  }
};