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
    enableLinkRemoval: boolean;
    linkRemovalRegex: string;
    linkRemovalRegexDescription?: string;
    additionalLinkRemovalRegexes?: Array<{ regex: string; description: string }>;
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
    // ... 其他样式相关选项 ...
}

interface FormatAdvancedOptions {
    customRegexRules: { pattern: string; replacement: string }[];
    enableAutoFormat: boolean;
    enableCodeHighlight: boolean;
    enableImageOptimization: boolean;
    // ... 其他高级选项 ...
}

const DEFAULT_SETTINGS: MarkdownMasterSettings = {
    formatOptions: {
        content: {
            enableLinkRemoval: true,
            linkRemovalRegex: '\\[\\d+\\]\\s+(https?:\\/\\/\\S+)',
            additionalLinkRemovalRegexes: [],
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
        },
        advanced: {
            customRegexRules: [],
            enableAutoFormat: false,
            enableCodeHighlight: true,
            enableImageOptimization: true,
        },
    },
};

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
            name: '显示格式化历史记录',
            callback: () => this.showFormatHistory()
        });

        // 修改自动格式化功能的事件注册
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
    }

    onunload() {
        // 不需要手动取消事件监听，Plugin 类会自动处理
    }

    async loadSettings() {
        const loadedData = await this.loadData();
        this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);

        // 确保有必要的设置都存在
        if (!this.settings.formatOptions.structure.headingConversionRules) {
            this.settings.formatOptions.structure.headingConversionRules = DEFAULT_SETTINGS.formatOptions.structure.headingConversionRules;
        }

        // 可以添加其他设置的检查和初始化

        await this.saveSettings();
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    formatMarkdown(content: string): string {
        let formatted = content;
        const { formatOptions } = this.settings;

        if (formatOptions.content.enableLinkRemoval) {
            try {
                const regex = new RegExp(formatOptions.content.linkRemovalRegex, 'gm');
                formatted = formatted.replace(regex, '');
            } catch (error) {
                console.error('Invalid link removal regex:', error);
            }
            
            if (formatOptions.content.additionalLinkRemovalRegexes) {
                formatOptions.content.additionalLinkRemovalRegexes.forEach((regexObj) => {
                    try {
                        const regex = new RegExp(regexObj.regex, 'gm');
                        formatted = formatted.replace(regex, '');
                    } catch (error) {
                        console.error('Invalid additional link removal regex:', error);
                    }
                });
            }
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
                            
                            // 确保新的标题级别在1到6之间
                            newLevel = Math.max(1, Math.min(6, newLevel));
                            
                            return '#'.repeat(newLevel) + ' ';
                        });
                    }
                }
            }
        }

        if (formatOptions.style.enableBoldRemoval) {
            formatted = formatted.replace(/\*\*/g, '');
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

        if (formatOptions.advanced.enableCodeHighlight) {
            formatted = this.highlightCodeBlocks(formatted);
        }

        if (formatOptions.advanced.enableImageOptimization) {
            formatted = this.optimizeImageLinks(formatted);
        }

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

    // 新增的文本统计函数
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

        this.displayDiff();

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

    displayDiff() {
        const diff = diffChars(this.originalContent, this.formattedContent);
        const diffContainer = this.contentEl.createDiv({ cls: 'markdown-master-diff' });

        diff.forEach((part: Change) => {
            const color = part.added ? 'green' : part.removed ? 'red' : 'grey';
            const span = diffContainer.createSpan();
            span.style.color = color;
            span.textContent = part.value;
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

        this.addContentFormatSettings(containerEl);
        this.addStructureFormatSettings(containerEl);
        this.addStyleFormatSettings(containerEl);
        this.addAdvancedFormatSettings(containerEl);
    }

    addContentFormatSettings(containerEl: ObsidianHTMLElement) {
        containerEl.createEl('h3', { text: '内容格式化选项' });
        
        const linkRemovalSetting = new Setting(containerEl)
            .setName('启用链接删除')
            .setDesc('根据指定的正则表达式删除特定链接')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.formatOptions.content.enableLinkRemoval)
                .onChange(async (value) => {
                    this.plugin.settings.formatOptions.content.enableLinkRemoval = value;
                    await this.plugin.saveSettings();
                    updateLinkRemovalSettingState(value);
                }));

        const linkRemovalContainer = containerEl.createEl('div', { cls: 'markdown-master-nested-settings' });
        linkRemovalContainer.style.marginLeft = '20px';

        new Setting(linkRemovalContainer)
            .setName('链接删除正则表达式')
            .setDesc('输入用于匹配要删除的链接的正则表达式')
            .addTextArea(text => text
                .setPlaceholder('输入正则表达式')
                .setValue(this.plugin.settings.formatOptions.content.linkRemovalRegex)
                .onChange(async (value) => {
                    this.plugin.settings.formatOptions.content.linkRemovalRegex = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(linkRemovalContainer)
            .setName('正则表达式说明')
            .setDesc('输入关于上面正则表达式的说明')
            .addTextArea(text => text
                .setPlaceholder('输入说明')
                .setValue(this.plugin.settings.formatOptions.content.linkRemovalRegexDescription || '')
                .onChange(async (value) => {
                    this.plugin.settings.formatOptions.content.linkRemovalRegexDescription = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(linkRemovalContainer)
            .setName('添加额外的正则表达式')
            .setDesc('添加多个正则表达式来匹配不同类型的链接')
            .addButton(button => button
                .setButtonText('添加新的正则表达式')
                .onClick(async () => {
                    if (!this.plugin.settings.formatOptions.content.additionalLinkRemovalRegexes) {
                        this.plugin.settings.formatOptions.content.additionalLinkRemovalRegexes = [];
                    }
                    this.plugin.settings.formatOptions.content.additionalLinkRemovalRegexes.push({ regex: '', description: '' });
                    await this.plugin.saveSettings();
                    this.display(); // 重新渲染设置页面
                }));

        const additionalRegexContainer = linkRemovalContainer.createEl('div', { cls: 'markdown-master-nested-settings' });
        additionalRegexContainer.style.marginLeft = '20px';

        if (this.plugin.settings.formatOptions.content.additionalLinkRemovalRegexes) {
            this.plugin.settings.formatOptions.content.additionalLinkRemovalRegexes.forEach((regexObj, index) => {
                const regexSetting = new Setting(additionalRegexContainer)
                    .addTextArea(text => text
                        .setPlaceholder('输入正则表达式')
                        .setValue(regexObj.regex)
                        .onChange(async (value) => {
                            if (this.plugin.settings.formatOptions.content.additionalLinkRemovalRegexes) {
                                this.plugin.settings.formatOptions.content.additionalLinkRemovalRegexes[index].regex = value;
                                await this.plugin.saveSettings();
                            }
                        }))
                    .addTextArea(text => text
                        .setPlaceholder('输入说明')
                        .setValue(regexObj.description)
                        .onChange(async (value) => {
                            if (this.plugin.settings.formatOptions.content.additionalLinkRemovalRegexes) {
                                this.plugin.settings.formatOptions.content.additionalLinkRemovalRegexes[index].description = value;
                                await this.plugin.saveSettings();
                            }
                        }))
                    .addButton(button => button  // 移除 ButtonComponent 类型注解
                        .setButtonText('删除')
                        .onClick(async () => {
                            if (this.plugin.settings.formatOptions.content.additionalLinkRemovalRegexes) {
                                this.plugin.settings.formatOptions.content.additionalLinkRemovalRegexes.splice(index, 1);
                                await this.plugin.saveSettings();
                                this.display(); // 重新渲染设置页面
                            }
                        }));
            });
        }

        const updateLinkRemovalSettingState = (enabled: boolean) => {
            linkRemovalContainer.style.display = enabled ? 'block' : 'none';
        };

        updateLinkRemovalSettingState(this.plugin.settings.formatOptions.content.enableLinkRemoval);

        // 保留其他内容格式化选项
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

    addStyleFormatSettings(containerEl: ObsidianHTMLElement) {
        // 实现样式格式化设置
    }

    addAdvancedFormatSettings(containerEl: ObsidianHTMLElement) {
        // 实现高级格式化设置
    }
}