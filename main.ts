import { App, Plugin, PluginSettingTab, Setting, Notice, MarkdownView, Modal, TFile, EventRef, HTMLElement as ObsidianHTMLElement } from 'obsidian';
import { diffChars, Change } from 'diff';

interface MarkdownMasterSettings {
    formatOptions: {
        content: FormatContentOptions;
        structure: FormatStructureOptions;
        style: FormatStyleOptions;
        advanced: FormatAdvancedOptions;
    };
}

interface FormatContentOptions {
    enableRegexReplacement: boolean;
    regexReplacements: Array<{ regex: string; replacement: string; description: string; enabled: boolean }>;
    // ... 其他内容相关选项 ...
}

interface FormatStructureOptions {
    enableHeadingConversion: boolean;
    headingConversionRules: { [key: string]: number };
    enableCascadingConversion: boolean;
    // ... 其他结构相关选项 ...
}

interface FormatStyleOptions {
    enableBoldRemoval: boolean;
    enableTableFormat: boolean;
    enableListIndentFormat: boolean;
    enableLinkFormat: boolean;
    enableBlockquoteFormat: boolean;
}

interface FormatAdvancedOptions {
    customRegexRules: { pattern: string; replacement: string }[];
    enableAutoFormat: boolean;
    enableCodeHighlight: boolean;
    enableImageOptimization: boolean;
    enableYamlMetadataFormat: boolean;
    enableMathFormat: boolean;
    enableCustomCssClassFormat: boolean;
}

const DEFAULT_SETTINGS: MarkdownMasterSettings = {
    formatOptions: {
        content: {
            enableRegexReplacement: true,
            regexReplacements: [
                {
                    regex: '\\[\\d+\\]\\s+(https?:\\/\\/\\S+)',
                    replacement: '',
                    description: '删除带数字的链接',
                    enabled: true
                }
            ],
        },
        structure: {
            enableHeadingConversion: true,
            enableCascadingConversion: true, // 新增选项
            headingConversionRules: {
                1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0
            },
        },
        style: {
            enableBoldRemoval: true,
            enableTableFormat: true,
            enableListIndentFormat: true,
            enableLinkFormat: true,
            enableBlockquoteFormat: true,
        },
        advanced: {
            customRegexRules: [],
            enableAutoFormat: false,
            enableCodeHighlight: true,
            enableImageOptimization: true,
            enableYamlMetadataFormat: false,
            enableMathFormat: false,
            enableCustomCssClassFormat: false,
        },
    },
};

const REGEX_PRESETS = [
    {
        name: '删除多余空行',
        regex: '\n{3,}',
        replacement: '\n\n',
        description: '将连续的3个或更多空行替换为2个空行'
    },
    {
        name: '格式化标题空格',
        regex: '^(#+)([^\s#])',
        replacement: '$1 $2',
        description: '确保标题符号(#)后有一个空格'
    },
    {
        name: '格式化列表项空格',
        regex: '^(\\s*[-*+])([^\s])',
        replacement: '$1 $2',
        description: '确保列表项符号后有一个空格'
    },
    {
        name: '删除行尾空格',
        regex: '[ \t]+$',
        replacement: '',
        description: '删除每行末尾的空格和制表符'
    },
    {
        name: 'URL转为链接',
        regex: '(https?://\\S+)(?=[\\s)])',
        replacement: '[$1]($1)',
        description: '将纯文本URL转换为Markdown链接格式'
    }
];

export default class MarkdownMasterPlugin extends Plugin {
    settings!: MarkdownMasterSettings;
    private lastContent: string = "";
    private formatHistory!: FormatHistory;
    private fileOpenRef: EventRef;

    async onload() {
        await this.loadSettings();

        // 确保 headingConversionRules 被正确初始化
        if (!this.settings.formatOptions.structure.headingConversionRules) {
            this.settings.formatOptions.structure.headingConversionRules = {
                1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0
            };
            await this.saveSettings();
        }

        this.formatHistory = new FormatHistory();
        this.addSettingTab(new MarkdownMasterSettingTab(this.app, this));

        this.addRibbonIcon("pencil", "Markdown Master", (evt) => {
            this.showFormatOptions();
        });

        this.addCommand({
            id: 'format-markdown',
            name: '格式化当前Markdown文件',
            callback: () => this.showFormatOptions()
        });

        this.addCommand({
            id: 'undo-format',
            name: '撤销上次格式化',
            callback: () => this.undoFormat()
        });

        this.addCommand({
            id: 'batch-format-markdown',
            name: '批量格式化所有Markdown文件',
            callback: () => this.batchFormat()
        });

        this.addCommand({
            id: 'show-format-history',
            name: '示格式化历史记录',
            callback: () => this.showFormatHistory()
        });

        // 修改自动格式化功能件注册
        if (this.settings.formatOptions.advanced.enableAutoFormat) {
            this.fileOpenRef = this.registerEvent(
                this.app.workspace.on('file-open', (file: TFile) => {
                    if (file && file.extension === 'md') {
                        this.autoFormatFile(file);
                    }
                })
            );
        }

        // 添加文本统计命令
        this.addCommand({
            id: 'show-text-statistics',
            name: '显示文本统计',
            callback: () => this.showTextStatistics()
        });

        // 添加自定义 CSS
        this.addStyle(`
            .markdown-master-preview-container {
                max-height: 60vh;
                overflow-y: auto;
                border: 1px solid var(--background-modifier-border);
                padding: 10px;
                margin-bottom: 20px;
            }
            .markdown-master-diff-preview pre {
                white-space: pre-wrap;
                word-wrap: break-word;
            }
            .markdown-master-diff-added {
                background-color: #e6ffed;
                color: #24292e;
            }
            .markdown-master-diff-removed {
                background-color: #ffeef0;
                color: #24292e;
                text-decoration: line-through;
            }
            .markdown-master-regex-help {
                margin-left: 10px;
                text-decoration: none;
                cursor: pointer;
            }

            .markdown-master-regex-help:hover {
                text-decoration: underline;
            }

            .regex-test-output {
                margin-top: 20px;
                padding: 10px;
                border: 1px solid var(--background-modifier-border);
                border-radius: 5px;
            }

            .regex-test-output pre {
                white-space: pre-wrap;
                word-wrap: break-word;
            }

            .markdown-master-nested-settings {
                margin-left: 20px;
                border-left: 2px solid var(--background-modifier-border);
                padding-left: 20px;
            }

            .markdown-master-regex-rule {
                margin-bottom: 20px;
                padding: 10px;
                border: 1px solid var(--background-modifier-border);
                border-radius: 5px;
            }

            .markdown-master-regex-rule .setting-item {
                border-top: none;
                padding-top: 0;
            }

            .markdown-master-regex-buttons {
                display: flex;
                justify-content: flex-end;
                margin-top: 10px;
            }

            .markdown-master-regex-buttons button {
                margin-left: 10px;
            }
        `);
    }

    onunload() {
        // 不手动取消件监Plugin 类会自动处
    }

    async loadSettings() {
        const loadedData = await this.loadData();
        this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);

        // 确保 regexReplacements 数组存在
        if (!this.settings.formatOptions.content.regexReplacements) {
            this.settings.formatOptions.content.regexReplacements = [];
        }

        await this.saveSettings();
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    private showNotice(message: string, timeout: number = 4000) {
        new Notice(message, timeout);
    }

    formatMarkdown(content: string): string {
        let formatted = content;
        const { formatOptions } = this.settings;
        let replacementCount = 0;

        if (formatOptions.content.enableRegexReplacement) {
            formatOptions.content.regexReplacements.forEach((regexObj) => {
                try {
                    const regex = new RegExp(regexObj.regex, 'gm');
                    const originalContent = formatted;
                    formatted = formatted.replace(regex, regexObj.replacement);
                    const currentReplacements = (originalContent.match(regex) || []).length;
                    replacementCount += currentReplacements;
                } catch (error) {
                    console.error('Invalid regex replacement:', error);
                    this.showNotice(`错误：无效的正则表达式 "${regexObj.regex}"`);
                }
            });
        }

        if (formatOptions.structure.enableHeadingConversion) {
            const rules = formatOptions.structure.headingConversionRules;
            if (rules && typeof rules === 'object') {
                // 首先，按照标题级别从高到低排序
                const sortedLevels = Object.keys(rules).map(Number).sort((a, b) => a - b);
                
                for (const fromLevel of sortedLevels) {
                    const toLevel = rules[fromLevel];
                    if (fromLevel !== toLevel && toLevel !== 0) {
                        const levelDiff = toLevel - fromLevel;
                        const regex = new RegExp(`^#{${fromLevel},6}\\s+`, 'gm');
                        
                        formatted = formatted.replace(regex, (match) => {
                            const currentLevel = match.trim().length;
                            let newLevel = currentLevel + levelDiff;
                            
                            // 确保新的标级别在1到6之间
                            newLevel = Math.max(1, Math.min(6, newLevel));
                            
                            return '#'.repeat(newLevel) + ' ';
                        });
                    }
                }
            }
        }

        if (formatOptions.style.enableBoldRemoval) {
            formatted = formatted.replace(/\*\*(.*?)\*\*/g, '$1');
        }

        formatted = formatted.replace(/^(#+)([^\s#])/gm, '$1 $2');
        formatted = formatted.replace(/^(\s*)-([^\s])/gm, '$1- $2');
        formatted = formatted.replace(/\n{3,}/g, '\n\n');
        formatted = formatted.replace(/^(\d+)\.([^\s])/gm, '$1. $2');

        formatOptions.advanced.customRegexRules.forEach(rule => {
            const regex = new RegExp(rule.pattern, 'g');
            formatted = formatted.replace(regex, rule.replacement);
        });

        if (formatOptions.style.enableTableFormat) {
            formatted = this.formatTables(formatted);
        }

        if (formatOptions.style.enableListIndentFormat) {
            formatted = this.formatListIndent(formatted);
        }

        if (formatOptions.style.enableLinkFormat) {
            formatted = this.formatLinks(formatted);
        }

        if (formatOptions.style.enableBlockquoteFormat) {
            formatted = this.formatBlockquotes(formatted);
        }

        if (formatOptions.advanced.enableCodeHighlight) {
            formatted = this.highlightCodeBlocks(formatted);
        }

        if (formatOptions.advanced.enableImageOptimization) {
            formatted = this.optimizeImageLinks(formatted);
        }

        if (formatOptions.advanced.enableYamlMetadataFormat) {
            formatted = this.formatYamlMetadata(formatted);
        }

        if (formatOptions.advanced.enableMathFormat) {
            formatted = this.formatMathEquations(formatted);
        }

        if (formatOptions.advanced.enableCustomCssClassFormat) {
            formatted = this.formatCustomCssClasses(formatted);
        }

        this.showNotice(`格式化完成，共进行了 ${replacementCount} 次替换`);
        return formatted.trim();
    }

    showFormatOptions() {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) {
            new Notice('请打开一个Markdown文件');
            return;
        }

        const content = activeView.editor.getValue();
        const formattedContent = this.formatMarkdown(content);

        new FormatPreviewModal(this.app, content, formattedContent, (result) => {
            if (result) {
                this.lastContent = content;
                activeView.editor.setValue(formattedContent);
                new Notice('Markdown文件已格式化');
                this.formatHistory.addToHistory(content);
            }
        }).open();
    }

    undoFormat() {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView && this.lastContent) {
            activeView.editor.setValue(this.lastContent);
            this.lastContent = '';
            new Notice('已撤销上次格式化');
        } else {
            new Notice('没有可撤销的格式化操作');
        }
    }

    async batchFormat() {
        const files = this.app.vault.getMarkdownFiles();
        for (const file of files) {
            const content = await this.app.vault.read(file);
            const formattedContent = this.formatMarkdown(content);
            await this.app.vault.modify(file, formattedContent);
        }
        new Notice('批格式化完成');
    }

    showFormatHistory() {
        const history = this.formatHistory.getHistory();
        new FormatHistoryModal(this.app, history, (selectedContent) => {
            const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (activeView) {
                activeView.editor.setValue(selectedContent);
            }
        }).open();
    }

    // 修表格格式化函数，使用 String.prototype.padEnd 的替代方法
    formatTables(content: string): string {
        const tableRegex = /\|(.+)\|/g;
        return content.replace(tableRegex, (match) => {
            const cells = match.split('|').map(cell => cell.trim());
            const maxLength = Math.max(...cells.map(cell => cell.length));
            return cells.map(cell => `| ${this.padEndPolyfill(cell, maxLength)} `).join('') + '|';
        });
    }

    // 添加 padEnd 的替代方法
    padEndPolyfill(str: string, targetLength: number, padString: string = ' '): string {
        targetLength = targetLength >> 0;
        if (str.length > targetLength) {
            return String(str);
        } else {
            targetLength = targetLength - str.length;
            if (targetLength > padString.length) {
                padString += padString.repeat(targetLength / padString.length);
            }
            return String(str) + padString.slice(0, targetLength);
        }
    }

    // 新增的代码块高亮函数
    highlightCodeBlocks(content: string): string {
        const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
        return content.replace(codeBlockRegex, (match, lang, code) => {
            return `\`\`\`${lang || ''}\n${code.trim()}\n\`\`\``;
        });
    }

    // 新增的图片链接优化函数
    optimizeImageLinks(content: string): string {
        const imageRegex = /!\[(.*?)\]\((.*?)\)/g;
        return content.replace(imageRegex, (match, alt, url) => {
            const optimizedUrl = url.replace(/^http:/, 'https:');
            return `![${alt}](${optimizedUrl})`;
        });
    }

    // 新增的自动格式化函数
    async autoFormatFile(file: TFile) {
        if (file.extension !== 'md') return;
        const content = await this.app.vault.read(file);
        const formattedContent = this.formatMarkdown(content);
        if (content !== formattedContent) {
            await this.app.vault.modify(file, formattedContent);
            new Notice(`已自动格式化文件: ${file.name}`);
        }
    }

    // 新的文本计函数
    showTextStatistics() {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) {
            new Notice('请打开一个Markdown文件');
            return;
        }

        const content = activeView.editor.getValue();
        const wordCount = content.split(/\s+/).length;
        const charCount = content.length;
        const lineCount = content.split('\n').length;

        new TextStatisticsModal(this.app, wordCount, charCount, lineCount).open();
    }

    // 在类添加个辅助方法
    private addStyle(cssString: string) {
        const css = document.createElement('style');
        css.id = 'markdown-master-styles';
        css.textContent = cssString;
        document.head.append(css);
    }

    // 新增的辅助方法
    private formatListIndent(content: string): string {
        // 实现列表缩进格式化逻辑
        return content.replace(/^(\s*[-*+])\s+/gm, '$1 ');
    }

    private formatLinks(content: string): string {
        // 实现链接格式化逻辑
        return content.replace(/\[(.*?)\]\((.*?)\)/g, '[$1]($2)');
    }

    private formatBlockquotes(content: string): string {
        // 实现引用块格式化逻辑
        return content.replace(/^>\s*/gm, '> ');
    }

    private formatYamlMetadata(content: string): string {
        // 实现YAML前置元数据格式化逻辑
        // 这里只是一个简单的示例,实际实现可能需要更复杂的逻辑
        const yamlRegex = /^---\n([\s\S]*?)\n---/;
        return content.replace(yamlRegex, (match, yaml) => {
            const formattedYaml = yaml.split('\n').map((line: string) => line.trim()).join('\n');
            return `---\n${formattedYaml}\n---`;
        });
    }

    private formatMathEquations(content: string): string {
        // 实现数学公式格式化逻辑
        // 这里只是一个简单的示例,实际实可能需要更复杂的逻辑
        return content.replace(/\$\$([\s\S]*?)\$\$/g, (match, math) => {
            const formattedMath = math.trim().replace(/\s+/g, ' ');
            return `$$\n${formattedMath}\n$$`;
        });
    }

    private formatCustomCssClasses(content: string): string {
        // 实现自定义CSS类格式化逻辑
        // 这里只是一个简单的示例,实际实现可能需要更复杂的逻辑
        return content.replace(/\{([^}]+)\}/g, (match, classes) => {
            const formattedClasses = classes.split(' ').filter(Boolean).join(' ');
            return `{${formattedClasses}}`;
        });
    }

    toggleAutoFormat(enable: boolean) {
        if (enable) {
            this.fileOpenRef = this.registerEvent(
                this.app.workspace.on('file-open', (file: TFile) => {
                    if (file && file.extension === 'md') {
                        this.autoFormatFile(file);
                    }
                })
            );
        } else if (this.fileOpenRef) {
            this.fileOpenRef.unregister();
            this.fileOpenRef = null;
        }
    }
}

class FormatPreviewModal extends Modal {
    private originalContent: string;
    private formattedContent: string;
    private onSubmit: (result: boolean) => void;
    private result: boolean = false;

    constructor(app: App, originalContent: string, formattedContent: string, onSubmit: (result: boolean) => void) {
        super(app);
        this.originalContent = originalContent;
        this.formattedContent = formattedContent;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: '预览格式化结果' });

        const previewContainer = contentEl.createEl('div', { cls: 'markdown-master-preview-container' });
        const diffPreview = previewContainer.createEl('div', { cls: 'markdown-master-diff-preview' });

        diffPreview.createEl('h3', { text: '对比视图' });

        this.createDiffView(diffPreview);

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('应用更改')
                .setCta()
                .onClick(() => {
                    this.result = true;
                    this.close();
                }))
            .addButton(btn => btn
                .setButtonText('取消')
                .onClick(() => {
                    this.result = false;
                    this.close();
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
        this.onSubmit(this.result);
    }

    private createDiffView(container: ObsidianHTMLElement) {
        const diff = diffChars(this.originalContent, this.formattedContent);
        const pre = container.createEl('pre');
        const code = pre.createEl('code');

        diff.forEach((part: Change) => {
            const span = code.createEl('span');
            span.textContent = part.value;
            if (part.added) {
                (span as any).addClass('markdown-master-diff-added');
            } else if (part.removed) {
                (span as any).addClass('markdown-master-diff-removed');
            }
        });
    }
}

class FormatHistory {
    private history: string[] = [];
    private maxHistory = 5;

    addToHistory(content: string) {
        this.history.unshift(content);
        if (this.history.length > this.maxHistory) {
            this.history.pop();
        }
    }

    getHistory(): string[] {
        return this.history;
    }

    clear() {
        this.history = [];
    }
}

class FormatHistoryModal extends Modal {
    private history: string[];
    private onSelect: (content: string) => void;

    constructor(app: App, history: string[], onSelect: (content: string) => void) {
        super(app);
        this.history = history;
        this.onSelect = onSelect;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: '格式化历记录' });

        this.history.forEach((content, index) => {
            new Setting(contentEl)
                .setName(`历史记录 ${index + 1}`)
                .addButton(btn => btn
                    .setButtonText('恢')
                    .onClick(() => {
                        this.onSelect(content);
                        this.close();
                    }));
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// 新增的文本统计模态框
class TextStatisticsModal extends Modal {
    private wordCount: number;
    private charCount: number;
    private lineCount: number;

    constructor(app: App, wordCount: number, charCount: number, lineCount: number) {
        super(app);
        this.wordCount = wordCount;
        this.charCount = charCount;
        this.lineCount = lineCount;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: '文本统计' });

        contentEl.createEl('p', { text: `单词数：${this.wordCount}` });
        contentEl.createEl('p', { text: `字符数：${this.charCount}` });
        contentEl.createEl('p', { text: `行数：${this.lineCount}` });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class MarkdownMasterSettingTab extends PluginSettingTab {
    plugin: MarkdownMasterPlugin;

    constructor(app: App, plugin: MarkdownMasterPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl('h2', { text: 'Markdown Master 设置' });

        this.addStructureFormatSettings(containerEl);
        this.addContentFormatSettings(containerEl);
        this.addStyleFormatSettings(containerEl);
        this.addAdvancedFormatSettings(containerEl);
    }

    addStructureFormatSettings(containerEl: ObsidianHTMLElement) {
        containerEl.createEl('h3', { text: '结构格式化选项' });
        
        new Setting(containerEl)
            .setName('启用标题转换')
            .setDesc('根据下面的规则转换标题级别')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.formatOptions.structure.enableHeadingConversion)
                .onChange(async (value) => {
                    this.plugin.settings.formatOptions.structure.enableHeadingConversion = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('级联标题转换')
            .setDesc('当转换某个级别的标题时，同步转换其所有子标题')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.formatOptions.structure.enableCascadingConversion)
                .onChange(async (value) => {
                    this.plugin.settings.formatOptions.structure.enableCascadingConversion = value;
                    await this.plugin.saveSettings();
                }));

        const tableContainer = containerEl.createEl('div', { cls: 'markdown-master-table' });
        const table = tableContainer.createEl('table');
        const headerRow = table.createEl('tr');
        headerRow.createEl('th', { text: '原标题级别' });
        headerRow.createEl('th', { text: '转换为' });

        for (let i = 1; i <= 6; i++) {
            const row = table.createEl('tr');
            const fromCell = row.createEl('td');
            fromCell.createEl('span', { text: `${i}级标题` });
            const toCell = row.createEl('td');
            
            (new Setting(toCell) as any)
                .addDropdown((dropdown: any) => {
                    dropdown
                        .addOptions({
                            '0': '不转换',
                            '1': '一级标题',
                            '2': '二级标题',
                            '3': '三级标题',
                            '4': '四级标题',
                            '5': '五级标题',
                            '6': '六级标题'
                        })
                        .setValue((this.plugin.settings.formatOptions.structure.headingConversionRules[i] ?? '0').toString())
                        .onChange(async (value: string) => {
                            if (!this.plugin.settings.formatOptions.structure.headingConversionRules) {
                                this.plugin.settings.formatOptions.structure.headingConversionRules = {};
                            }
                            this.plugin.settings.formatOptions.structure.headingConversionRules[i] = parseInt(value);
                            await this.plugin.saveSettings();
                        });
                });
        }
    }

    addContentFormatSettings(containerEl: ObsidianHTMLElement) {
        console.log("开始添加内容格式化设置");
        const titleEl = containerEl.createEl('h3', { text: '正则表达式替换 ' });
        
        // 添加一个链接到正则表式说明文档
        const regexHelpLink = titleEl.createEl('a', {
            text: '📘',
            href: '#',
            cls: 'markdown-master-regex-help',
            attr: { 'aria-label': '正则表达式帮助' }
        });
        
        // 使用类型守卫来确保regexHelpLink是HTMLAnchorElement
        if (regexHelpLink instanceof HTMLAnchorElement) {
            regexHelpLink.addEventListener('click', (e: MouseEvent) => {
                e.preventDefault();
                this.showRegexHelpModal();
            });
        }
        
        new Setting(containerEl)
            .setName('启用正则表达式替换')
            .setDesc('使用自定义的正则表达式进行内容替换')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.formatOptions.content.enableRegexReplacement)
                .onChange(async (value) => {
                    console.log("切换正则表达式替换:", value);
                    this.plugin.settings.formatOptions.content.enableRegexReplacement = value;
                    await this.plugin.saveSettings();
                    this.display(); // 重新渲染整个设置页面
                }));

        if (this.plugin.settings.formatOptions.content.enableRegexReplacement) {
            console.log("正则表达替换已启用");
            const regexReplacementContainer = containerEl.createEl('div', { cls: 'markdown-master-nested-settings' });
            regexReplacementContainer.style.marginLeft = '20px';

            new Setting(regexReplacementContainer)
                .setName('添加新的正则表达式替换规则')
                .setDesc('添加多个正则表达式来匹配和替换不同的内容')
                .addButton(button => button
                    .setButtonText('添加新规则')
                    .onClick(() => {
                        console.log("点击添加新规则按钮");
                        this.addNewRegexRule();
                    }));

            if (this.plugin.settings.formatOptions.content.regexReplacements) {
                console.log("当前规则数量:", this.plugin.settings.formatOptions.content.regexReplacements.length);
                this.plugin.settings.formatOptions.content.regexReplacements.forEach((regexObj, index) => {
                    this.createRegexRuleSetting(regexReplacementContainer, regexObj, index);
                });
            } else {
                console.log("regexReplacements 数组不存在");
            }
        } else {
            console.log("正则表达式替换未启用");
        }
    }

    // 添加一个新方来显示正则表达式帮助模态框
    private showRegexHelpModal() {
        const modal = new RegexHelpModal(this.app);
        modal.open();
    }

    private async addNewRegexRule() {
        console.log("开始添加新规则");
        if (!this.plugin.settings.formatOptions.content.regexReplacements) {
            this.plugin.settings.formatOptions.content.regexReplacements = [];
        }
        this.plugin.settings.formatOptions.content.regexReplacements.push({ regex: '', replacement: '', description: '', enabled: true });
        await this.plugin.saveSettings();
        console.log("新规则已添加，当前规则数量:", this.plugin.settings.formatOptions.content.regexReplacements.length);
        this.display(); // 重新渲染整个设置页面
    }

    private createRegexRuleSetting(container: ObsidianHTMLElement, regexObj: { regex: string; replacement: string; description: string; enabled: boolean }, index: number) {
        console.log("创建规则设置:", index);
        const ruleContainer = container.createEl('div', { cls: 'markdown-master-regex-rule' });

        new Setting(ruleContainer)
            .setName(`规则 ${index + 1}`)
            .addToggle(toggle => toggle
                .setValue(regexObj.enabled)
                .onChange(async (value) => {
                    this.plugin.settings.formatOptions.content.regexReplacements[index].enabled = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(ruleContainer)
            .setName('正则表达式')
            .addTextArea(text => text
                .setPlaceholder('输入正则表达式')
                .setValue(regexObj.regex)
                .onChange(async (value) => {
                    this.plugin.settings.formatOptions.content.regexReplacements[index].regex = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(ruleContainer)
            .setName('替换内容')
            .addTextArea(text => text
                .setPlaceholder('输入替换内容')
                .setValue(regexObj.replacement)
                .onChange(async (value) => {
                    this.plugin.settings.formatOptions.content.regexReplacements[index].replacement = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(ruleContainer)
            .setName('说明')
            .addTextArea(text => text
                .setPlaceholder('输说明')
                .setValue(regexObj.description)
                .onChange(async (value) => {
                    this.plugin.settings.formatOptions.content.regexReplacements[index].description = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(ruleContainer)
            .setName('预设模板')
            // @ts-ignore
            .addDropdown((dropdown) => {
                dropdown
                    .addOption('custom', '自定义')
                    .addOptions(REGEX_PRESETS.reduce((acc, preset, i) => {
                        acc[i.toString()] = preset.name;
                        return acc;
                    }, {} as Record<string, string>))
                    .setValue('custom')
                    .onChange((value: string) => {
                        if (value !== 'custom') {
                            const preset = REGEX_PRESETS[parseInt(value)];
                            regexObj.regex = preset.regex;
                            regexObj.replacement = preset.replacement;
                            regexObj.description = preset.description;
                            this.plugin.saveSettings();
                            this.display(); // 重新渲染设置页面
                        }
                    });
            });

        const buttonContainer = ruleContainer.createEl('div', { cls: 'markdown-master-regex-buttons' });

        new Setting(buttonContainer)
            .addButton(button => button
                .setButtonText('测试')
                .onClick(() => {
                    new RegexTestModal(this.app, regexObj).open();
                }))
            .addButton(button => button
                .setButtonText('删除')
                .onClick(async () => {
                    console.log("删除规则:", index);
                    this.plugin.settings.formatOptions.content.regexReplacements.splice(index, 1);
                    await this.plugin.saveSettings();
                    this.display(); // 重新渲染整个设置页面
                }));
    }

    addStyleFormatSettings(containerEl: ObsidianHTMLElement) {
        containerEl.createEl('h3', { text: '样式格式化选项' });

        new Setting(containerEl)
            .setName('启用粗体移除')
            .setDesc('移除所有粗体标记')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.formatOptions.style.enableBoldRemoval)
                .onChange(async (value) => {
                    this.plugin.settings.formatOptions.style.enableBoldRemoval = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('启用表格格式化')
            .setDesc('格式化表格，使其对齐')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.formatOptions.style.enableTableFormat)
                .onChange(async (value) => {
                    this.plugin.settings.formatOptions.style.enableTableFormat = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('启用列表缩进格式化')
            .setDesc('统一列表的缩进')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.formatOptions.style.enableListIndentFormat)
                .onChange(async (value) => {
                    this.plugin.settings.formatOptions.style.enableListIndentFormat = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('启用链接式化')
            .setDesc('统一链接的格式')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.formatOptions.style.enableLinkFormat)
                .onChange(async (value) => {
                    this.plugin.settings.formatOptions.style.enableLinkFormat = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('启引用块格式化')
            .setDesc('统一引用块的格式')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.formatOptions.style.enableBlockquoteFormat)
                .onChange(async (value) => {
                    this.plugin.settings.formatOptions.style.enableBlockquoteFormat = value;
                    await this.plugin.saveSettings();
                }));
    }

    addAdvancedFormatSettings(containerEl: ObsidianHTMLElement) {
        containerEl.createEl('h3', { text: '高级格式化选项' });

        new Setting(containerEl)
            .setName('启用自动格式化')
            .setDesc('在打开Markdown文件时自动应用格式化')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.formatOptions.advanced.enableAutoFormat)
                .onChange(async (value) => {
                    this.plugin.settings.formatOptions.advanced.enableAutoFormat = value;
                    await this.plugin.saveSettings();
                    // 重新注册或取消自动格式化事件
                    this.plugin.toggleAutoFormat(value);
                }));

        new Setting(containerEl)
            .setName('启用代码块高亮')
            .setDesc('优化代码块的格式和高亮')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.formatOptions.advanced.enableCodeHighlight)
                .onChange(async (value) => {
                    this.plugin.settings.formatOptions.advanced.enableCodeHighlight = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('启用图片链接优化')
            .setDesc('优化图片链接，如将http转换为https')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.formatOptions.advanced.enableImageOptimization)
                .onChange(async (value) => {
                    this.plugin.settings.formatOptions.advanced.enableImageOptimization = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('启用YAML前置元数据格式化')
            .setDesc('格式化Markdown文件开头的YAML前置元数据')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.formatOptions.advanced.enableYamlMetadataFormat)
                .onChange(async (value) => {
                    this.plugin.settings.formatOptions.advanced.enableYamlMetadataFormat = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('启用数学公式格式化')
            .setDesc('格式化LaTeX数学公式')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.formatOptions.advanced.enableMathFormat)
                .onChange(async (value) => {
                    this.plugin.settings.formatOptions.advanced.enableMathFormat = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('启用自定义CSS类格式化')
            .setDesc('格式化自定义CSS类标记')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.formatOptions.advanced.enableCustomCssClassFormat)
                .onChange(async (value) => {
                    this.plugin.settings.formatOptions.advanced.enableCustomCssClassFormat = value;
                    await this.plugin.saveSettings();
                }));
    }
}

// 添加一个新的模态框类来显示正则表达式帮助
class RegexHelpModal extends Modal {
    constructor(app: App) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: '正则表达式帮助' });

        const content = contentEl.createEl('div');
        
        content.createEl('p', { text: '正则表达式是一种强大的文本匹配和操作工具。以是一些基本语法：' });
        const ul1 = content.createEl('ul');
        [
            { code: '.', desc: '匹配任意单个字符' },
            { code: '*', desc: '匹配前面的元素零次或多次' },
            { code: '+', desc: '匹配前面的元素一次或多次' },
            { code: '?', desc: '匹配前面的元素零次或一次' },
            { code: '^', desc: '匹配行的开始' },
            { code: '$', desc: '匹配行的结束' },
            { code: '[]', desc: '匹配方括号内的任意一个字符' },
            { code: '[^]', desc: '匹配不在方括号内的任意一个字符' }
        ].forEach(item => {
            const li = ul1.createEl('li');
            li.createEl('code', { text: item.code });
            li.createEl('span', { text: ` - ${item.desc}` });
        });

        content.createEl('p', { text: '更多详细信息，请访问：' });
        const ul2 = content.createEl('ul');
        [
            { text: 'MDN 正则表达式指南', href: 'https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Guide/Regular_Expressions' },
            { text: 'Regex101 - 在线正则表达式测试工具', href: 'https://regex101.com/' }
        ].forEach(item => {
            const li = ul2.createEl('li');
            li.createEl('a', { text: item.text, href: item.href, attr: { target: '_blank' } });
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class RegexTestModal extends Modal {
    private regexObj: { regex: string; replacement: string; description: string; enabled: boolean };
    private inputEl!: HTMLTextAreaElement;
    private outputEl!: HTMLDivElement;
    private explanationEl!: HTMLDivElement;

    constructor(app: App, regexObj: { regex: string; replacement: string; description: string; enabled: boolean }) {
        super(app);
        this.regexObj = regexObj;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: '正则表达式测试' });

        new Setting(contentEl)
            .setName('测试文本')
            .setDesc('输入要测试的文本')
            .addTextArea((text) => {
                this.inputEl = (text as any).inputEl;
                text.setPlaceholder('在此输入测试文本');
                text.onChange(this.updateResult.bind(this));
            });

        this.outputEl = contentEl.createEl('div', { cls: 'regex-test-output' }) as unknown as HTMLDivElement;
        this.explanationEl = contentEl.createEl('div', { cls: 'regex-test-explanation' }) as unknown as HTMLDivElement;

        new Setting(contentEl)
            .addButton(button => button
                .setButtonText('关闭')
                .onClick(() => this.close()));
    }

    updateResult() {
        const inputText = this.inputEl.value;
        try {
            const regex = new RegExp(this.regexObj.regex, 'gm');
            const matches = inputText.match(regex) || [];
            const result = inputText.replace(regex, this.regexObj.replacement);

            this.outputEl.innerHTML = `
                <h3>替换结果：</h3>
                <pre>${result}</pre>
                <h3>匹配详情：</h3>
                <ul>
                    ${matches.map((match, i) => `
                        <li>
                            匹配 ${i + 1}：
                            <pre>${JSON.stringify(match, null, 2)}</pre>
                        </li>
                    `).join('')}
                </ul>
            `;

            this.explanationEl.innerHTML = `
                <h3>正则表达式解释：</h3>
                <p>${this.explainRegex(this.regexObj.regex)}</p>
            `;
        } catch (error: unknown) {
            this.outputEl.innerHTML = `
                <h3>错误：</h3>
                <pre>${error instanceof Error ? error.message : String(error)}</pre>
            `;
            this.explanationEl.innerHTML = '';
        }
    }

    explainRegex(regex: string): string {
        // 这里可以添加更详细的正则表达式解释逻辑
        // 以下只是一个简单的示例
        return regex.split('').map(char => {
            switch(char) {
                case '^': return '匹配行的开始';
                case '$': return '匹配行的结束';
                case '.': return '匹配任意字符';
                case '*': return '匹配前面的表达式0次或多次';
                case '+': return '匹配前面的表达式1次或多次';
                case '?': return '匹配前面的表达式0次或1次';
                default: return `匹配字符 "${char}"`;
            }
        }).join('<br>');
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}