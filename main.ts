import { App, Plugin, PluginSettingTab, Setting, Notice, MarkdownView, Modal, TFile, EventRef, Vault } from 'obsidian';
import { diffChars, Change } from 'diff';
import * as LangModule from './lang';

// 在文件顶部添加这个声明
declare module 'obsidian' {
    interface Vault {
        on(name: string, callback: (file: TFile) => any, ctx?: any): EventRef;
    }
}

interface MarkdownMasterSettings {
    enableLinkRemoval: boolean;
    enableHeadingConversion: boolean;
    enableBoldRemoval: boolean;
    enableReferenceRemoval: boolean;
    customRegexRules: { pattern: string; replacement: string }[];
    enableAutoFormat: boolean;
    enableTableFormat: boolean;
    enableCodeHighlight: boolean;
    enableImageOptimization: boolean;
    enableTextStatistics: boolean;
    enableTitleNumbering: boolean;
    language: string;
    autoFormatOnSave: boolean;
}

const DEFAULT_SETTINGS: MarkdownMasterSettings = {
    enableLinkRemoval: true,
    enableHeadingConversion: true,
    enableBoldRemoval: true,
    enableReferenceRemoval: true,
    customRegexRules: [],
    enableAutoFormat: false,
    enableTableFormat: true,
    enableCodeHighlight: true,
    enableImageOptimization: true,
    enableTextStatistics: false,
    enableTitleNumbering: true,
    language: 'en',
    autoFormatOnSave: false,
}

// 更新插件版本号
const PLUGIN_VERSION = "1.2.9";

export default class MarkdownMasterPlugin extends Plugin {
    settings!: MarkdownMasterSettings;
    private lastContent: string = "";
    private formatHistory!: FormatHistory;
    private fileOpenRef: EventRef | null = null;

    async onload() {
        await this.loadSettings();
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
        if (this.settings.enableAutoFormat) {
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

        // 修改自动保存事件监听
        if (this.settings.autoFormatOnSave) {
            this.registerEvent(
                this.app.vault.on("modify", (file: TFile) => {
                    if (file.extension === "md") {
                        this.formatMarkdown(file);
                    }
                })
            );
        }
    }

    onunload() {
        // 不需要手动取消事件监听，Plugin 类会自动处理
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async formatMarkdown(input: TFile | string): Promise<string> {
        try {
            let content: string;
            if (typeof input === 'string') {
                content = input;
            } else {
                content = await this.app.vault.read(input);
            }
            const formattedContent = this.applyFormatting(content);
            if (typeof input !== 'string') {
                await this.app.vault.modify(input, formattedContent);
                new Notice(this.getLang("formatSuccess"));
            }
            return formattedContent;
        } catch (error) {
            console.error("格式化文档时出错:", error);
            new Notice(this.getLang("formatError"));
            // 添加更详细的错误日志
            console.error("错误详情:", {
                input: typeof input !== 'string' ? input.path : "string input",
                error: error instanceof Error ? error.message : String(error)
            });
            return typeof input === 'string' ? input : await this.app.vault.read(input);
        }
    }

    private applyFormatting(content: string): string {
        // 实现格式化逻辑
        return content; // 临时返回，需要实现实际的格式化逻辑
    }

    showFormatOptions() {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) {
            new Notice('请打开一个Markdown文件');
            return;
        }

        const content = activeView.editor.getValue();
        this.formatMarkdown(content).then(formattedContent => {
            new FormatPreviewModal(this.app, content, formattedContent, (result) => {
                if (result) {
                    this.lastContent = content;
                    activeView.editor.setValue(formattedContent);
                    new Notice('Markdown文件已格式化');
                    this.formatHistory.addToHistory(content);
                }
            }).open();
        });
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
            await this.formatMarkdown(file);
        }
        new Notice('批量格式化完成');
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

    // 修改表格格式化函数，使用 String.prototype.padEnd 的替代方法
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

    async autoFormatFile(file: TFile) {
        if (file.extension !== 'md') return;
        const formattedContent = await this.formatMarkdown(file);
        const currentContent = await this.app.vault.read(file);
        if (currentContent !== formattedContent) {
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

    // 在插件类中添加获取翻译的方法
    getLang(key: string): string {
        const lang = this.settings.language || "en";
        return (LangModule.LANG as any)[lang]?.[key] || (LangModule.LANG as any).en[key] || key;
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
        contentEl.createEl('h2', { text: '格式化历史记录' });

        this.history.forEach((content, index) => {
            new Setting(contentEl)
                .setName(`历史记录 ${index + 1}`)
                .addButton(btn => btn
                    .setButtonText('恢复')
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

        new Setting(containerEl)
            .setName('删除特定链接')
            .setDesc('删除格式为 [数字] http://... 的链接')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableLinkRemoval)
                .onChange(async (value) => {
                    this.plugin.settings.enableLinkRemoval = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('转换标题')
            .setDesc('将所有二级标题转换为一级标题')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableHeadingConversion)
                .onChange(async (value) => {
                    this.plugin.settings.enableHeadingConversion = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('删除粗体')
            .setDesc('删除所有粗体标记')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableBoldRemoval)
                .onChange(async (value) => {
                    this.plugin.settings.enableBoldRemoval = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('删除引用')
            .setDesc('删除所有数字引用标记')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableReferenceRemoval)
                .onChange(async (value) => {
                    this.plugin.settings.enableReferenceRemoval = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('自定义正则表达式规则')
            .setDesc('添加自定义正则表达式规则（每行一个，格式：正则表达式|||替换内容）')
            .addTextArea(text => text
                .setPlaceholder('正则表达式|||替换内容')
                .setValue(this.plugin.settings.customRegexRules.map(rule => `${rule.pattern}|||${rule.replacement}`).join('\n'))
                .onChange(async (value) => {
                    this.plugin.settings.customRegexRules = value.split('\n')
                        .map(line => {
                            const [pattern, replacement] = line.split('|||');
                            return { pattern, replacement };
                        })
                        .filter(rule => rule.pattern && rule.replacement);
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('启用自动格式化')
            .setDesc('打开文件时自动格式化')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableAutoFormat)
                .onChange(async (value) => {
                    this.plugin.settings.enableAutoFormat = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('启用表格格式化')
            .setDesc('自动对齐表格列')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableTableFormat)
                .onChange(async (value) => {
                    this.plugin.settings.enableTableFormat = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('启用代码块高亮')
            .setDesc('优化代码块格式')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableCodeHighlight)
                .onChange(async (value) => {
                    this.plugin.settings.enableCodeHighlight = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('启用图片链接优化')
            .setDesc('将 HTTP 图片链接转换为 HTTPS')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableImageOptimization)
                .onChange(async (value) => {
                    this.plugin.settings.enableImageOptimization = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('启用文本统计')
            .setDesc('在状态栏显示文本统计信息')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableTextStatistics)
                .onChange(async (value) => {
                    this.plugin.settings.enableTextStatistics = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('优化标题编号')
            .setDesc('保留标准的Markdown标题序号，删除额外的数字编号')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableTitleNumbering)
                .onChange(async (value) => {
                    this.plugin.settings.enableTitleNumbering = value;
                    await this.plugin.saveSettings();
                }));
    }
}