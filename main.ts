import { App, Plugin, PluginSettingTab, Setting, Notice, MarkdownView, Modal } from 'obsidian';
import { diffChars, Change } from 'diff';

interface MarkdownMasterSettings {
    enableLinkRemoval: boolean;
    enableHeadingConversion: boolean;
    enableBoldRemoval: boolean;
    enableReferenceRemoval: boolean;
    customRegexRules: { pattern: string; replacement: string }[];
}

const DEFAULT_SETTINGS: MarkdownMasterSettings = {
    enableLinkRemoval: true,
    enableHeadingConversion: true,
    enableBoldRemoval: true,
    enableReferenceRemoval: true,
    customRegexRules: []
}

export default class MarkdownMasterPlugin extends Plugin {
    settings: MarkdownMasterSettings;
    private lastContent: string = "";
    private formatHistory: FormatHistory;

    async onload() {
        await this.loadSettings();
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

        this.formatHistory = new FormatHistory();
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    formatMarkdown(content: string): string {
        let formatted = content;

        if (this.settings.enableLinkRemoval) {
            formatted = formatted.replace(/^\[(\d+)\]\s+(https?:\/\/\S+)$/gm, '');
        }
        if (this.settings.enableHeadingConversion) {
            formatted = formatted.replace(/^##/gm, '#');
        }
        if (this.settings.enableBoldRemoval) {
            formatted = formatted.replace(/\*\*/g, '');
        }
        if (this.settings.enableReferenceRemoval) {
            formatted = formatted.replace(/\[\d+\]/g, '');
        }

        formatted = formatted.replace(/^(#+)([^\s#])/gm, '$1 $2');
        formatted = formatted.replace(/^(\s*)-([^\s])/gm, '$1- $2');
        formatted = formatted.replace(/\n{3,}/g, '\n\n');
        formatted = formatted.replace(/^(\d+)\.([^\s])/gm, '$1. $2');

        this.settings.customRegexRules.forEach(rule => {
            const regex = new RegExp(rule.pattern, 'g');
            formatted = formatted.replace(regex, rule.replacement);
        });

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
    }
}