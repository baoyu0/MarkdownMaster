import { App, Plugin, PluginSettingTab, Setting, Notice, MarkdownView, Modal, TFile, EventRef, SliderComponent, DropdownComponent } from 'obsidian';
import { diffChars, Change } from 'diff';
import { saveAs } from 'file-saver';
import { marked } from 'marked';
import jsPDF from 'jspdf';
import { formatMarkdown, RuleFactory, FormatRule } from './formatter';
import { calculateTextStatistics, TextStatistics } from './textStatistics';
import { MarkdownMasterSettings } from './types';
import { DEFAULT_SETTINGS } from './config';

function createProgressBar() {
    let currentNotice: Notice | null = null;

    return {
        update: (progress: number, message: string) => {
            if (currentNotice) {
                currentNotice = null; // 不直接调用 hide 方法
            }
            currentNotice = new Notice(`${message} ${(progress * 100).toFixed(0)}%`, 0);
        },
        hide: () => {
            if (currentNotice) {
                currentNotice = null;
            }
        }
    };
}

export default class MarkdownMasterPlugin extends Plugin {
    settings: MarkdownMasterSettings;
    private lastContent: string = "";
    private formatHistory: FormatHistory;
    private fileOpenRef: EventRef | null = null;
    private linkRemovalRegex = /^\[(\d+)\]\s+(https?:\/\/\S+)$/gm;
    private headingConversionRegex = /^##/gm;
    private boldRemovalRegex = /\*\*/g;
    private referenceRemovalRegex = /\[\d+\]/g;
    private static readonly CHUNK_SIZE = 10000;
    private progressBar: ReturnType<typeof createProgressBar>;
    private undoStack: string[] = [];
    private redoStack: string[] = [];

    constructor() {
        super();
        this.settings = DEFAULT_SETTINGS;
        this.formatHistory = new FormatHistory();
        this.progressBar = createProgressBar();
    }

    async onload() {
        await this.loadSettings();
        this.addSettingTab(new MarkdownMasterSettingTab(this.app, this));

        this.addRibbonIcon("pencil", "Markdown Master", async (evt) => {
            await this.showFormatOptions();
        });

        this.addCommand({
            id: 'format-markdown',
            name: '格式化当前Markdown文件',
            callback: () => this.showFormatOptions(),
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

        // 删除 syncVersions 函数的调用
        // await this.syncVersions();
    }

    onunload() {
        // 不需要手动取消事件监听，Plugin 类会自动处理
    }

    async loadSettings() {
        const data = await this.loadData();
        this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async formatMarkdown(content: string): Promise<string> {
        this.progressBar.update(0, '正在格式化...');
        try {
            const formattedContent = formatMarkdown(content, this.settings);
            this.progressBar.update(100, '格式化完成');
            return formattedContent;
        } catch (error) {
            console.error('格式化过程中发生错误:', error);
            new Notice('格式化过程中发生错误，请查看控制台日志');
            throw error;
        } finally {
            this.progressBar.hide();
        }
    }

    async showTextStatistics() {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) {
            new Notice('请打开一个Markdown文件');
            return;
        }

        const content = activeView.editor.getValue();
        const stats = calculateTextStatistics(content);
        new TextStatisticsModal(this.app, stats).open();
    }

    async showFormatOptions() {
        try {
            const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (!activeView) {
                throw new Error('请打开一个Markdown文件');
            }

            const content = activeView.editor.getValue();
            const formattedContent = await this.formatMarkdown(content);

            new FormatPreviewModal(this.app, content, formattedContent, async (result) => {
                if (result) {
                    this.lastContent = content;
                    activeView.editor.setValue(formattedContent);
                    new Notice('Markdown文件已格式化');
                    this.formatHistory.addToHistory(content);
                }
            }).open();
        } catch (error: unknown) {
            console.error('格式化选项显示失败:', error);
            new Notice(`格式化选项显示失败: ${error instanceof Error ? error.message : String(error)}`);
        }
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
        return this.measurePerformance(async () => {
            try {
                const files = this.app.vault.getMarkdownFiles();
                const progress = new Progress();
                
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    progress.setMessage(`正在格式化 ${file.name} (${i + 1}/${files.length})`);
                    progress.setProgress(i / files.length);
                    
                    try {
                        const content = await this.app.vault.read(file);
                        const formattedContent = await this.formatMarkdown(content);
                        await this.app.vault.modify(file, formattedContent);
                    } catch (error: unknown) {
                        console.error(`格式化文件 ${file.name} 时出错:`, error);
                        new Notice(`格式化文件 ${file.name} 时出错，已跳过。`);
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
                
                progress.hide();
                new Notice('批量格式化完成');
            } catch (error: unknown) {
                console.error('批量格式化失败:', error);
                new Notice(`批量格式化失败: ${error instanceof Error ? error.message : String(error)}`);
            }
        }, "批量格式化");
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

    async autoFormatFile(file: TFile) {
        if (file.extension !== 'md') return;
        const content = await this.app.vault.read(file);
        const formattedContent = await this.formatMarkdown(content);
        if (content !== formattedContent) {
            await this.app.vault.modify(file, formattedContent);
            new Notice(`已自动格式化文件: ${file.name}`);
        }
    }

    async showFormatPreview() {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) {
            new Notice('请打开一个Markdown文件');
            return;
        }

        const content = activeView.editor.getValue();
        const formattedContent = await this.formatMarkdown(content);

        new FormatPreviewModal(this.app, content, formattedContent, (result) => {
            if (result) {
                activeView.editor.setValue(formattedContent);
                new Notice('Markdown文件已格式化');
            }
        }).open();
    }

    undo() {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView && this.undoStack.length > 0) {
            const content = this.undoStack.pop()!;
            this.redoStack.push(activeView.editor.getValue());
            activeView.editor.setValue(content);
            new Notice('已撤销上次格式化');
        } else {
            new Notice('没有可撤销的操作');
        }
    }

    redo() {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView && this.redoStack.length > 0) {
            const content = this.redoStack.pop()!;
            this.undoStack.push(activeView.editor.getValue());
            activeView.editor.setValue(content);
            new Notice('已重做格式化');
        } else {
            new Notice('没有可重做的操作');
        }
    }

    async exportFormattedContent(format: 'md' | 'html' | 'pdf') {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) {
            new Notice('请打开一个Markdown文件');
            return;
        }

        const content = activeView.editor.getValue();
        const formattedContent = await this.formatMarkdown(content);

        switch (format) {
            case 'md':
                const blob = new Blob([formattedContent], { type: 'text/markdown;charset=utf-8' });
                saveAs(blob, 'formatted.md');
                break;
            case 'html':
                const html = await marked(formattedContent);
                const htmlBlob = new Blob([html], { type: 'text/html;charset=utf-8' });
                saveAs(htmlBlob, 'formatted.html');
                break;
            case 'pdf':
                const pdf = new jsPDF();
                pdf.text(formattedContent, 10, 10);
                pdf.save('formatted.pdf');
                break;
        }

        new Notice(`已导出为 ${format.toUpperCase()} 格式`);
    }

    private async measurePerformance<T>(
        operation: () => Promise<T>,
        operationName: string
    ): Promise<T> {
        const start = performance.now();
        try {
            return await operation();
        } finally {
            const end = performance.now();
            console.log(`${operationName} 耗时: ${end - start} 毫秒`);
        }
    }

    saveRulePriorities(rules: { name: string; priority: number }[]) {
        // 更新设置中的规则优先级
        rules.forEach(rule => {
            const ruleInstance = RuleFactory.createRule(rule.name);
            ruleInstance.priority = rule.priority;
        });
        this.saveSettings();
    }

    // 删除 syncVersions 函数
    // async syncVersions() { ... }
}

class FormatPreviewModal extends Modal {
    private originalContent: string;
    private formattedContent: string;
    private onConfirm: (result: boolean) => void;

    constructor(app: App, originalContent: string, formattedContent: string, onConfirm: (result: boolean) => void) {
        super(app);
        this.originalContent = originalContent;
        this.formattedContent = formattedContent;
        this.onConfirm = onConfirm;
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
                    this.close();
                    this.onConfirm(true);
                }))
            .addButton(btn => btn
                .setButtonText('取消')
                .onClick(() => {
                    this.close();
                    this.onConfirm(false);
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
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

    open() {
        super.open();
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

    open() {
        super.open();
    }
}

class TextStatisticsModal extends Modal {
    private wordCount: number;
    private charCount: number;
    private lineCount: number;

    constructor(app: App, stats: TextStatistics) {
        super(app);
        this.wordCount = stats.wordCount;
        this.charCount = stats.charCount;
        this.lineCount = stats.lineCount;
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

    open() {
        super.open();
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
                .setValue(this.plugin.settings.enableLinkRemoval as boolean)
                .onChange(async (value) => {
                    this.plugin.settings.enableLinkRemoval = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('转换标题')
            .setDesc('将所有二级标题转换为一级标题')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableHeadingConversion as boolean)
                .onChange(async (value) => {
                    this.plugin.settings.enableHeadingConversion = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('删除粗体')
            .setDesc('删除所有粗体标记')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableBoldRemoval as boolean)
                .onChange(async (value) => {
                    this.plugin.settings.enableBoldRemoval = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('删除引用')
            .setDesc('删除所有数字引用标记')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableReferenceRemoval as boolean)
                .onChange(async (value) => {
                    this.plugin.settings.enableReferenceRemoval = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('自定义正则表达式规则')
            .setDesc('添加自定义正则表达式规则（每行一个，格式：正则表达式|||替换内容）')
            .addTextArea(text => text
                .setPlaceholder('正则表达式|||替换内容')
                .setValue((this.plugin.settings.customRegexRules as { pattern: string; replacement: string }[]).map(rule => `${rule.pattern}|||${rule.replacement}`).join('\n'))
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
                .setValue(this.plugin.settings.enableAutoFormat as boolean)
                .onChange(async (value) => {
                    this.plugin.settings.enableAutoFormat = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('启用表格格式化')
            .setDesc('自动对齐表格列')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableTableFormat as boolean)
                .onChange(async (value) => {
                    this.plugin.settings.enableTableFormat = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('启用代码块高亮')
            .setDesc('优化代码块格式')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableCodeHighlight as boolean)
                .onChange(async (value) => {
                    this.plugin.settings.enableCodeHighlight = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('启用图片链接优化')
            .setDesc('将 HTTP 图片链接转换为 HTTPS')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableImageOptimization as boolean)
                .onChange(async (value) => {
                    this.plugin.settings.enableImageOptimization = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('启用文本统计')
            .setDesc('在状态栏显示文本统计信息')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableTextStatistics as boolean)
                .onChange(async (value) => {
                    this.plugin.settings.enableTextStatistics = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('优化标题编号')
            .setDesc('保留标准的Markdown标题序号，删除额外的数字编号')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableTitleNumbering as boolean)
                .onChange(async (value) => {
                    this.plugin.settings.enableTitleNumbering = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('列表缩进')
            .setDesc('设置列表项的缩进空格数')
            .addSlider((slider: SliderComponent) => slider
                .setLimits(2, 8, 1)
                .setValue(this.plugin.settings.listIndentation as number)
                .setDynamicTooltip()
                .onChange(async (value: number) => {
                    this.plugin.settings.listIndentation = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('特殊字符处理')
            .setDesc('选择如何处理特殊字符')
            .addDropdown((dropdown: DropdownComponent) => dropdown
                .addOption('remove', '移除')
                .addOption('escape', '转义')
                .addOption('ignore', '忽略')
                .setValue(this.plugin.settings.specialCharHandling as string)
                .onChange(async (value) => {
                    if (value === 'remove' || value === 'escape' || value === 'ignore') {
                        this.plugin.settings.specialCharHandling = value;
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(containerEl)
            .setName('规则优先级')
            .setDesc('自定义格式化规则的优先级')
            .addButton(button => button
                .setButtonText('编辑优先级')
                .onClick(() => {
                    new RulePriorityModal(this.app, this.plugin).open();
                }));

        new Setting(containerEl)
            .setName('管理格式化规则')
            .setDesc('打开规则管理界面')
            .addButton(button => button
                .setButtonText('管理规则')
                .onClick(() => {
                    new RuleManagementModal(this.app, this.plugin).open();
                }));
    }
}

class RulePriorityModal extends Modal {
    constructor(app: App, private plugin: MarkdownMasterPlugin) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: '编辑规则优先级' });

        // 使用新的 getRuleNames 方法
        RuleFactory.getRuleNames().forEach(ruleName => {
            const rule = RuleFactory.createRule(ruleName);
            new Setting(contentEl)
                .setName(ruleName)
                .addSlider((slider: SliderComponent) => slider
                    .setLimits(1, 200, 1)
                    .setValue(rule.priority)
                    .setDynamicTooltip()
                    .onChange(async (value: number) => {
                        // 更新规则优先级
                        rule.priority = value;
                        await this.plugin.saveSettings();
                    }));
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class Progress {
    private message: string = '';
    private value: number = 0;

    setMessage(message: string) {
        this.message = message;
        this.updateUI();
    }

    setProgress(value: number) {
        this.value = value;
        this.updateUI();
    }

    hide() {
        // 实现隐藏进度条的逻辑
    }

    private updateUI() {
        // 实现更新UI的逻辑
        console.log(`Progress: ${this.message} (${this.value * 100}%)`);
    }
}

class RuleManagementModal extends Modal {
    private rules: { name: string; priority: number; enabled: boolean }[] = [];

    constructor(app: App, private plugin: MarkdownMasterPlugin) {
        super(app);
        this.loadRules();
    }

    private loadRules() {
        this.rules = RuleFactory.getRuleNames().map(name => ({
            name,
            priority: RuleFactory.createRule(name).priority,
            enabled: this.isRuleEnabled(name)
        }));
        this.rules.sort((a, b) => a.priority - b.priority);
    }

    private isRuleEnabled(ruleName: string): boolean {
        const setting = `enable${ruleName}` as keyof MarkdownMasterSettings;
        return this.plugin.settings[setting] as boolean || false;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        ((contentEl as unknown) as HTMLElement).classList.add('markdown-master-rule-management');

        contentEl.createEl('h2', { text: '管理格式化规则' });

        const ruleList = contentEl.createEl('ul', { cls: 'rule-list' });
        this.rules.forEach((rule, index) => {
            const li = ruleList.createEl('li', { cls: 'rule-item', attr: { 'data-index': index.toString() } });
            li.createEl('span', { text: rule.name, cls: 'rule-name' });
            const priorityEl = li.createEl('span', { text: rule.priority.toString(), cls: 'rule-priority' });
            const toggleEl = (li.createEl('input', { type: 'checkbox', cls: 'rule-toggle' }) as unknown) as HTMLInputElement;
            toggleEl.checked = rule.enabled;

            toggleEl.addEventListener('change', () => {
                rule.enabled = toggleEl.checked;
                this.saveRuleState(rule.name, rule.enabled);
            });

            ((li as unknown) as HTMLElement).addEventListener('dragstart', (e: DragEvent) => {
                e.dataTransfer?.setData('text/plain', index.toString());
            });

            ((li as unknown) as HTMLElement).addEventListener('dragover', (e: DragEvent) => {
                e.preventDefault();
            });

            ((li as unknown) as HTMLElement).addEventListener('drop', (e: DragEvent) => {
                e.preventDefault();
                const fromIndex = parseInt(e.dataTransfer?.getData('text/plain') || '-1');
                const toIndex = index;
                if (fromIndex !== -1 && fromIndex !== toIndex) {
                    const [movedRule] = this.rules.splice(fromIndex, 1);
                    this.rules.splice(toIndex, 0, movedRule);
                    this.updatePriorities();
                    this.redrawRuleList();
                }
            });
        });

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('保存并关闭')
                .setCta()
                .onClick(() => {
                    this.saveRules();
                    this.close();
                }));
    }

    private redrawRuleList() {
        const ruleList = ((this.contentEl as unknown) as HTMLElement).querySelector('.rule-list');
        if (ruleList) {
            ruleList.innerHTML = '';
            this.rules.forEach((rule, index) => {
                // 重新创建规则列表项
                // ... (类似于 onOpen 方法中的代码)
            });
        }
    }

    private updatePriorities() {
        this.rules.forEach((rule, index) => {
            rule.priority = index + 1;
        });
    }

    private saveRuleState(ruleName: string, enabled: boolean) {
        const setting = `enable${ruleName}` as keyof MarkdownMasterSettings;
        (this.plugin.settings as any)[setting] = enabled;
        this.plugin.saveSettings();
    }

    private saveRules() {
        // 保存规则优先级
        this.plugin.saveRulePriorities(this.rules);
    }
}