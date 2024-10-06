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
        // 可以添加更多模板...
    };

    applyFormatTemplate(content: string, templateName: string): string {
        const template = this.formatTemplates[templateName];
        if (template) {
            return template(content);
        }
        return content; // 如果模板不存在，返回原内容
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

        new Setting(containerEl)
            .setName('导入设置')
            .setDesc('从 JSON 文件导入设置')
            .addButton(button => button
                .setButtonText('导入')
                .onClick(() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'application/json';
                    input.onchange = async (e: Event) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file) {
                            const reader = new FileReader();
                            reader.onload = async (e) => {
                                const content = e.target?.result as string;
                                await this.plugin.importSettings(content);
                                this.display(); // 刷新设置页面
                            };
                            reader.readAsText(file);
                        }
                    };
                    input.click();
                }));

        new Setting(containerEl)
            .setName('格式化模板')
            .setDesc('选择预定义的格式化模板')
            .addDropdown((dropdown) => {
                dropdown
                    .addOption('none', '无')
                    .addOption('academic', '学术论文')
                    .addOption('blog', '博客文章')
                    // 可以添加更多模板选项
                    .setValue(this.plugin.settings.formatTemplate || 'none')
                    .onChange(async (value) => {
                        this.plugin.settings.formatTemplate = value;
                        await this.plugin.saveSettings();
                    });
            });
    }
}