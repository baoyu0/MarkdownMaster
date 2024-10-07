import { App, Plugin, PluginSettingTab, Setting, Notice, MarkdownView, Modal, TFile, EventRef, Vault, TextAreaComponent } from 'obsidian';
import { diffChars, Change } from 'diff';
import * as LangModule from './lang';

// 在文件顶部添加这个声明
declare module 'obsidian' {
    interface Vault {
        on(name: string, callback: (file: TFile) => any, ctx?: any): EventRef;
    }


    interface Setting {
        addDropdown(cb: (dropdown: DropdownComponent) => any): Setting;
        addText(cb: (text: TextAreaComponent) => any): this;
        addSlider(cb: (slider: SliderComponent) => any): this;
    }

    interface DropdownComponent {
        addOption(value: string, display: string): DropdownComponent;
        setValue(value: string): DropdownComponent;
        onChange(cb: (value: string) => any): DropdownComponent;
    }

    interface SliderComponent {
        setLimits(min: number, max: number, step: number): this;
        setValue(value: number): this;
        setDynamicTooltip(): this;
        onChange(callback: (value: number) => void): this;
    }

    interface TextAreaComponent extends HTMLElement {
        value: string;
        setValue: (value: string) => this;
        getValue: () => string;
        onChange: (callback: (value: string) => void) => this;
        inputEl: HTMLTextAreaElement;
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
    linkRemovalRegex: string;
    headingConversionLevel: string;
    enableListFormatting: boolean;
    listBulletChar: '-' | '*' | '+';
    listIndentSpaces: number;
    enableAutoTOC: boolean;
    tocDepth: number;
    enableFootnoteFormatting: boolean;
    advancedCustomRules: { name: string; rule: string }[];
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
    linkRemovalRegex: '\\[\\d+\\]\\s*http:\\/\\/[^\\s]+',
    headingConversionLevel: '1',
    enableListFormatting: true,
    listBulletChar: '-',
    listIndentSpaces: 2,
    enableAutoTOC: false,
    tocDepth: 3,
    enableFootnoteFormatting: false,
    advancedCustomRules: [],
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

    public applyFormatting(content: string): string {
        let formattedContent = content;

        if (this.settings.formatTemplate && this.settings.formatTemplate !== 'none') {
            formattedContent = this.applyFormatTemplate(formattedContent, this.settings.formatTemplate);
        }

        if (this.settings.enableLinkRemoval) {
            const regex = new RegExp(this.settings.linkRemovalRegex, 'g');
            formattedContent = formattedContent.replace(regex, '');
        }

        if (this.settings.enableHeadingConversion) {
            const headingLevel = parseInt(this.settings.headingConversionLevel);
            const regex = new RegExp(`^#{1,${headingLevel}}\\s`, 'gm');
            formattedContent = formattedContent.replace(regex, '#'.repeat(headingLevel) + ' ');
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

        if (this.settings.enableListFormatting) {
            formattedContent = this.formatLists(formattedContent);
        }

        if (this.settings.enableAutoTOC) {
            formattedContent = this.generateTOC(formattedContent);
        }

        if (this.settings.enableFootnoteFormatting) {
            formattedContent = this.formatFootnotes(formattedContent);
        }

        formattedContent = this.applyAdvancedCustomRules(formattedContent);

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
            new FormatPreviewModal(this.app, this, content, formattedContent).open();
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
        const formattedContent = this.applyFormatting(content);
        new FormatPreviewModal(this.app, this, content, formattedContent).open();
    }

    private formatLists(content: string): string {
        if (!this.settings.enableListFormatting) return content;

        const listRegex = /^(\s*)([*+-]|\d+\.)\s+/gm;
        return content.replace(listRegex, (match, indent, bullet) => {
            const newIndent = ' '.repeat(Math.floor(indent.length / this.settings.listIndentSpaces) * this.settings.listIndentSpaces);
            const newBullet = /^\d+\./.test(bullet) ? bullet : this.settings.listBulletChar;
            return `${newIndent}${newBullet} `;
        });
    }

    private generateTOC(content: string): string {
        if (!this.settings.enableAutoTOC) return content;

        const headingRegex = /^(#{1,6})\s+(.+)$/gm;
        const toc = [];
        let match;

        while ((match = headingRegex.exec(content)) !== null) {
            const level = match[1].length;
            if (level <= this.settings.tocDepth) {
                const title = match[2];
                const slug = this.slugify(title);
                toc.push(`${'  '.repeat(level - 1)}- [${title}](#${slug})`);
            }
        }

        if (toc.length > 0) {
            const tocContent = "## 目录\n\n" + toc.join('\n');
            return tocContent + '\n\n' + content;
        }

        return content;
    }

    private slugify(text: string): string {
        return text.toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^\w\-]+/g, '')
            .replace(/\-\-+/g, '-')
            .replace(/^-+/, '')
            .replace(/-+$/, '');
    }

    private formatFootnotes(content: string): string {
        if (!this.settings.enableFootnoteFormatting) return content;

        const footnoteRegex = /\[\^(\d+)\](?!:)/g;
        const footnoteDefRegex = /\[\^(\d+)\]:/g;
        let footnoteCounter = 1;
        const footnoteMap = new Map();

        content = content.replace(footnoteRegex, (match, p1) => {
            if (!footnoteMap.has(p1)) {
                footnoteMap.set(p1, footnoteCounter++);
            }
            return `[^${footnoteMap.get(p1)}]`;
        });

        content = content.replace(footnoteDefRegex, (match, p1) => {
            return `[^${footnoteMap.get(p1) || p1}]:`;
        });

        return content;
    }

    private applyAdvancedCustomRules(content: string): string {
        for (const rule of this.settings.advancedCustomRules) {
            try {
                const ruleFunction = new Function('content', rule.rule);
                content = ruleFunction(content);
            } catch (error) {
                console.error(`Error applying custom rule "${rule.name}":`, error);
            }
        }
        return content;
    }
}


class FormatPreviewModal extends Modal {
    private originalContent: string;
    private formattedContent: string;
    private plugin: MarkdownMasterPlugin;

    constructor(app: App, plugin: MarkdownMasterPlugin, originalContent: string, formattedContent: string) {
        super(app);
        this.plugin = plugin;
        this.originalContent = originalContent;
        this.formattedContent = formattedContent;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: '格式化预览' });

        const originalTextArea = contentEl.createEl('textarea', { cls: 'markdown-master-textarea' }) as unknown as HTMLTextAreaElement;
        originalTextArea.value = this.originalContent;
        originalTextArea.readOnly = true;

        const formattedTextArea = contentEl.createEl('textarea', { cls: 'markdown-master-textarea' }) as unknown as HTMLTextAreaElement;
        formattedTextArea.value = this.formattedContent;
        formattedTextArea.readOnly = true;

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('应用')
                .setCta()
                .onClick(() => {
                    this.applyFormatting();
                    this.close();
                }))
            .addButton(btn => btn
                .setButtonText('关闭')
                .onClick(() => this.close()));
    }

    applyFormatting() {
        const activeView = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView) {
            activeView.editor.setValue(this.formattedContent);
            new Notice('格式化已应用');
        }
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

        new Setting(containerEl)
            .setName('保存时自动格式化')
            .setDesc('保存文件时自动格式化')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoFormatOnSave)
                .onChange(async (value) => {
                    this.plugin.settings.autoFormatOnSave = value;
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
                }))
            .addText((text: TextAreaComponent) => text
                .setPlaceholder('链接删除正则表达式')
                .setValue(this.plugin.settings.linkRemovalRegex || '')
                .onChange(async (value: string) => {
                    this.plugin.settings.linkRemovalRegex = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('启用标题转换')
            .setDesc('将二级标题转换为一级标题')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableHeadingConversion)
                .onChange(async (value) => {
                    this.plugin.settings.enableHeadingConversion = value;
                    await this.plugin.saveSettings();
                }))
            .addDropdown(dropdown => dropdown
                .addOption('1', '一级标题')
                .addOption('2', '二级标题')
                .addOption('3', '三级标题')
                .setValue(this.plugin.settings.headingConversionLevel || '1')
                .onChange(async (value) => {
                    this.plugin.settings.headingConversionLevel = value;
                    await this.plugin.saveSettings();
                }));

        // ... 添加更多详细的设置选项 ...

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

        // ... 其他设置保持不变 ...

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

        new Setting(containerEl)
            .setName('启用列表格式化')
            .setDesc('统一列表符号和缩进')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableListFormatting)
                .onChange(async (value) => {
                    this.plugin.settings.enableListFormatting = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('列表符号')
            .setDesc('选择无序列表的符号')
            .addDropdown(dropdown => dropdown
                .addOption('-', '- (破折号)')
                .addOption('*', '* (星号)')
                .addOption('+', '+ (加号)')
                .setValue(this.plugin.settings.listBulletChar)
                .onChange(async (value) => {
                    this.plugin.settings.listBulletChar = value as '-' | '*' | '+';
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('列表缩进空格数')
            .setDesc('设置列表每级缩进的空格数')
            .addSlider(slider => slider
                .setLimits(2, 8, 2)
                .setValue(this.plugin.settings.listIndentSpaces)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.listIndentSpaces = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('启用自动生成目录')
            .setDesc('在文档开头自动生成目录')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableAutoTOC)
                .onChange(async (value) => {
                    this.plugin.settings.enableAutoTOC = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('目录深度')
            .setDesc('设置目录包含的标题级别')
            .addSlider(slider => slider
                .setLimits(1, 6, 1)
                .setValue(this.plugin.settings.tocDepth)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.tocDepth = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('启用脚注格式化')
            .setDesc('重新编号和格式化脚注')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableFootnoteFormatting)
                .onChange(async (value) => {
                    this.plugin.settings.enableFootnoteFormatting = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('高级自定义规则')
            .setDesc('添加复杂的自定义格式化规则（JavaScript 函数）')
            .addButton(button => button
                .setButtonText('添加规则')
                .onClick(() => {
                    const modal = new CustomRuleModal(this.app, (name, rule) => {
                        this.plugin.settings.advancedCustomRules.push({ name, rule });
                        this.plugin.saveSettings();
                        this.display();
                    });
                    modal.open();
                }));

        // 显示现有的高级自定义规则
        this.plugin.settings.advancedCustomRules.forEach((rule, index) => {
            new Setting(containerEl)
                .setName(`规则 ${index + 1}: ${rule.name}`)
                .addButton(button => button
                    .setButtonText('删除')
                    .onClick(async () => {
                        this.plugin.settings.advancedCustomRules.splice(index, 1);
                        await this.plugin.saveSettings();
                        this.display();
                    }));
        });
    }
}

class CustomRuleModal extends Modal {
    private onSubmit: (name: string, rule: string) => void;
    private nameInputEl: HTMLElement; // 修改这里
    private ruleInputEl: HTMLTextAreaElement;

    constructor(app: App, onSubmit: (name: string, rule: string) => void) {
        super(app);
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: '添加高级自定义规则' });

        new Setting(contentEl)
            .setName('规则名称')
            .addText(text => {
                this.nameInputEl = text.inputEl; // 修改这里，移除类型断言
            });

        new Setting(contentEl)
            .setName('规则内容 (JavaScript 函数)')
            .setDesc('函数应接受 content 参数并返回处理后的内容')
            .addTextArea(text => {
                this.ruleInputEl = text.inputEl;
                this.ruleInputEl.rows = 10;
                this.ruleInputEl.cols = 50;
            });

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('保存')
                .setCta()
                .onClick(() => {
                    const name = (this.nameInputEl as HTMLInputElement).value; // 在这里使用类型断言
                    const rule = this.ruleInputEl.value;
                    if (name && rule) {
                        this.onSubmit(name, rule);
                        this.close();
                    } else {
                        new Notice('请填写规则名称和内容');
                    }
                }))
            .addButton(btn => btn
                .setButtonText('取消')
                .onClick(() => this.close()));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}