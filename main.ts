import { App, Plugin, PluginSettingTab, Setting, Notice, MarkdownView, Modal, TFile, EventRef, Vault } from 'obsidian';
import { diffChars, Change } from 'diff';
import * as LangModule from './lang';

// 在文件顶部添加这个声明
declare module 'obsidian' {
    interface Vault {
        on(name: string, callback: (file: TFile) => any, ctx?: any): EventRef;
    }


    interface Setting {
        addDropdown(cb: (dropdown: DropdownComponent) => any): Setting;
    }

    interface DropdownComponent {
        addOption(value: string, display: string): DropdownComponent;
        setValue(value: string): DropdownComponent;
        onChange(cb: (value: string) => any): DropdownComponent;
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
    formatTemplate: string;
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
    formatTemplate: 'none',
}


// 更新插件版本号
const PLUGIN_VERSION = "1.4.4";

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

        this.addCommand({
            id: 'show-format-preview',
            name: '显示格式化预览',
            callback: () => this.showFormatPreview()
        });

        if (this.settings.enableAutoFormat) {
            this.fileOpenRef = this.registerEvent(
                this.app.workspace.on('file-open', (file: TFile) => {
                    if (file && file.extension === 'md') {
                        this.autoFormatFile(file);
                    }
                })
            );
        }

        this.addCommand({
            id: 'show-text-statistics',
            name: '显示文本统计',
            callback: () => this.showTextStatistics()
        });

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

    private async processLargeFile(content: string, chunkSize: number = 10000): Promise<string> {
        const chunks = [];
        for (let i = 0; i < content.length; i += chunkSize) {
            chunks.push(content.slice(i, i + chunkSize));
        }

        let formattedContent = '';
        for (const chunk of chunks) {
            formattedContent += this.applyFormatting(chunk);
            // 允许其他任务执行
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        return formattedContent;
    }

    private handleError(error: unknown, context: string): void {
        console.error(`Error in ${context}:`, error);
        let errorMessage = '发生未知错误';
        if (error instanceof Error) {
            errorMessage = error.message;
        } else if (typeof error === 'string') {
            errorMessage = error;
        }
        new Notice(`${context}出错: ${errorMessage}`);
    }

    private getTextStatistics(content: string): {
        wordCount: number;
        charCount: number;
        lineCount: number;
        paragraphCount: number;
        headingCount: number;
        linkCount: number;
        imageCount: number;
    } {
        const wordCount = content.split(/\s+/).length;
        const charCount = content.length;
        const lineCount = content.split('\n').length;
        const paragraphCount = content.split(/\n\s*\n/).length;
        const headingCount = (content.match(/^#+\s/gm) || []).length;
        const linkCount = (content.match(/\[([^\]]+)\]\(([^)]+)\)/g) || []).length;
        const imageCount = (content.match(/!\[([^\]]*)\]\(([^)]+)\)/g) || []).length;

        return {
            wordCount,
            charCount,
            lineCount,
            paragraphCount,
            headingCount,
            linkCount,
            imageCount
        };
    }

    async formatMarkdown(input: TFile | string): Promise<string> {
        try {
            let content: string;
            if (typeof input === 'string') {
                content = input;
            } else {
                content = await this.app.vault.read(input);
            }

            let formattedContent: string;
            if (content.length > 50000) {
                formattedContent = await this.processLargeFile(content);
            } else {
                formattedContent = this.applyFormatting(content);
            }

            if (typeof input !== 'string') {
                await this.app.vault.modify(input, formattedContent);
                new Notice(this.getLang("formatSuccess"));
            }

            if (this.settings.enableTextStatistics) {
                const stats = this.getTextStatistics(formattedContent);
                console.log('文本统计:', stats);
            }

            return formattedContent;
        } catch (error) {
            this.handleError(error, '格式化文档');
            return typeof input === 'string' ? input : await this.app.vault.read(input);
        }
    }

    private applyFormatting(content: string): string {
        let formattedContent = content;

        if (this.settings.formatTemplate && this.settings.formatTemplate !== 'none') {
            formattedContent = this.applyFormatTemplate(formattedContent, this.settings.formatTemplate);
        }

        if (this.settings.enableLinkRemoval) {
            formattedContent = this.removeCertainLinks(formattedContent);
        }

        if (this.settings.enableHeadingConversion) {
            formattedContent = this.convertHeadings(formattedContent);
        }

        if (this.settings.enableBoldRemoval) {
            formattedContent = this.removeBold(formattedContent);
        }

        if (this.settings.enableReferenceRemoval) {
            formattedContent = this.removeReferences(formattedContent);
        }

        if (this.settings.enableTableFormat) {
            formattedContent = this.formatTables(formattedContent);
        }

        if (this.settings.enableCodeHighlight) {
            formattedContent = this.highlightCodeBlocks(formattedContent);
        }

        if (this.settings.enableImageOptimization) {
            formattedContent = this.optimizeImageLinks(formattedContent);
        }

        if (this.settings.enableTitleNumbering) {
            formattedContent = this.optimizeTitleNumbering(formattedContent);
        }

        // 应用自定义正则表达式规则
        this.settings.customRegexRules.forEach(rule => {
            const regex = new RegExp(rule.pattern, 'g');
            formattedContent = formattedContent.replace(regex, rule.replacement);
        });


        return formattedContent;
    }

    // 新增的辅助方法
    private removeCertainLinks(content: string): string {
        return content.replace(/\[\d+\]\s*http:\/\/[^\s]+/g, '');
    }


    private convertHeadings(content: string): string {
        return content.replace(/^##\s/gm, '# ');
    }

    private removeBold(content: string): string {
        return content.replace(/\*\*(.*?)\*\*/g, '$1');
    }

    private removeReferences(content: string): string {
        return content.replace(/\[\d+\]/g, '');
    }

    private optimizeTitleNumbering(content: string): string {
        return content.replace(/^(#+)\s*\d+[\.\d]*\s+/gm, '$1 ');
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

    // 导出设置
    exportSettings(): string {
        return JSON.stringify(this.settings, null, 2);
    }

    // 导入设置
    async importSettings(settingsJson: string): Promise<void> {
        try {
            const newSettings = JSON.parse(settingsJson);
            this.settings = { ...DEFAULT_SETTINGS, ...newSettings };
            await this.saveSettings();
            new Notice('设置已成功导入');
        } catch (error) {
            this.handleError(error, '导入设置');
        }
    }

    // 格式化模板
    private formatTemplates: { [key: string]: (content: string) => string } = {
        'academic': (content: string) => {
            // 学术论文格式化逻辑
            content = content.replace(/^#\s/gm, '# ');  // 确保一级标题格式正确
            content = content.replace(/^##\s/gm, '## '); // 确保二级标题格式正确
            content = content.replace(/(\d+)\./g, '$1\\.'); // 修复编号后的句点
            return content;
        },
        'blog': (content: string) => {
            // 博客文章格式化逻辑
            content = content.replace(/^#\s/gm, '# ');  // 确保标题格式正确
            content = content.replace(/!\[(.*?)\]\((.*?)\)/g, '![$1]($2)\n'); // 图片单独一行
            return content;
        },
        'technical': (content: string) => {
            // 技术文档格式化逻辑
            content = content.replace(/^#\s/gm, '# ');  // 确保一级标题格式正确
            content = content.replace(/`([^`\n]+)`/g, '`$1`');  // 确保内联代码格式正确
            content = content.replace(/\n{3,}/g, '\n\n');  // 删除多余的空行
            return content;
        },
        'notes': (content: string) => {
            // 笔记格式化逻辑
            content = content.replace(/^-\s/gm, '- ');  // 确保无序列表格式正确
            content = content.replace(/^(\d+)\.\s/gm, '$1. ');  // 确保有序列表格式正确
            content = content.replace(/\*\*(.*?)\*\*/g, '**$1**');  // 确保粗体格式正确
            return content;
        },
        // 可以继续添加更多模板...
    };

    applyFormatTemplate(content: string, templateName: string): string {
        const template = this.formatTemplates[templateName];
        if (template) {
            return template(content);
        }
        return content; // 如果模板不存在，返回原内容
    }

    showFormatPreview() {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) {
            new Notice('请打开一个Markdown文件');
            return;
        }

        const content = activeView.editor.getValue();
        new FormatPreviewModal(this.app, this, content).open();
    }
}


class FormatPreviewModal extends Modal {
    private originalContent: string;
    private plugin: MarkdownMasterPlugin;

    constructor(app: App, plugin: MarkdownMasterPlugin, originalContent: string) {
        super(app);
        this.plugin = plugin;
        this.originalContent = originalContent;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: '格式化预览' });

        const originalTextArea = contentEl.createEl('textarea', { cls: 'markdown-master-textarea' });
        originalTextArea.value = this.originalContent;
        originalTextArea.readOnly = true;

        const formattedTextArea = contentEl.createEl('textarea', { cls: 'markdown-master-textarea' });
        formattedTextArea.value = this.plugin.applyFormatting(this.originalContent);
        formattedTextArea.readOnly = true;

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('关闭')
                .onClick(() => this.close()));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
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

        // 基本设置
        containerEl.createEl('h3', { text: '基本设置' });
        
        new Setting(containerEl)
            .setName('启用自动格式化')
            .setDesc('打开文件时自动格式化')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableAutoFormat)
                .onChange(async (value) => {
                    this.plugin.settings.enableAutoFormat = value;
                    await this.plugin.saveSettings();
                }));

        // 格式化选项
        containerEl.createEl('h3', { text: '格式化选项' });

        new Setting(containerEl)
            .setName('启用链接删除')
            .setDesc('删除特定格式的链接')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableLinkRemoval)
                .onChange(async (value) => {
                    this.plugin.settings.enableLinkRemoval = value;
                    await this.plugin.saveSettings();
                }));

        // ... 其他格式化选项 ...

        // 高级设置
        containerEl.createEl('h3', { text: '高级设置' });

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

        // ... 其他高级设置 ...

        // 导入/导出设置
        containerEl.createEl('h3', { text: '导入/导出设置' });

        new Setting(containerEl)
            .setName('导出设置')
            .setDesc('将当前设置导出为 JSON 文件')
            .addButton(button => button
                .setButtonText('导出')
                .onClick(() => {
                    const settingsJson = this.plugin.exportSettings();
                    const blob = new Blob([settingsJson], { type: 'application/json' });
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = 'markdown-master-settings.json';
                    a.click();
                }));

        // ... 导入设置 ...

        new Setting(containerEl)
            .setName('格式化模板')
            .setDesc('选择预定义的格式化模板')
            .addDropdown((dropdown) => {
                dropdown
                    .addOption('none', '无')
                    .addOption('academic', '学术论文')
                    .addOption('blog', '博客文章')
                    .addOption('technical', '技术文档')
                    .addOption('notes', '笔记')
                    .setValue(this.plugin.settings.formatTemplate || 'none')
                    .onChange(async (value) => {
                        this.plugin.settings.formatTemplate = value;
                        await this.plugin.saveSettings();
                    });
            });
    }
}