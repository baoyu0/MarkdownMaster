import { Plugin, App, PluginSettingTab, Setting, Notice, MarkdownView, Modal, TFile, EventRef, Vault, Workspace } from 'obsidian';
import { diffChars, Change } from 'diff';  // 导入 Change 类型
import Sortable from 'sortablejs';

// 删除这行
// import { ObsidianHTMLElement } from 'obsidian';

// 添加这个类型别名
type DropdownComponent = {
    addOption(value: string, display: string): DropdownComponent;
    addOptions(options: Record<string, string>): DropdownComponent;
    getValue(): string;
    setValue(value: string): DropdownComponent;
    onChange(callback: (value: string) => any): DropdownComponent;
};

// 直接定义并导出 MarkdownMasterSettings 接口
export interface MarkdownMasterSettings {
    enableAutoFormat: boolean;
    autoFormatOnSave: boolean;
    formatTemplate: string;
    enableHeadingConversion: boolean;
    sourceHeadingLevel: string;
    targetHeadingLevel: string;
    recursiveHeadingConversion: boolean;
    enableListFormatting: boolean;
    listBulletChar: '-' | '*' | '+';
    listIndentSpaces: number;
    enableLinkCleaning: boolean;
    unifyLinkStyle: boolean;
    linkStyle: 'inline' | 'reference';
    enableSymbolDeletion: boolean;
    symbolsToDelete: string;
    preserveSpacesAroundSymbols: boolean;
    customRegexRules: { pattern: string; replacement: string }[];
    enableTableFormat: boolean;
    enableCodeHighlight: boolean;
    formatRules: FormatRule[];
}

// 如果 FormatRule 接口还没有定义，也添加它
export interface FormatRule {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    priority: number;
    apply: (content: string) => string;
}

const DEFAULT_SETTINGS: MarkdownMasterSettings = {
    enableAutoFormat: false,
    autoFormatOnSave: false,
    formatTemplate: 'default',
    enableHeadingConversion: false,
    sourceHeadingLevel: 'h2',
    targetHeadingLevel: 'h1',
    recursiveHeadingConversion: false,
    enableListFormatting: true,
    listBulletChar: '-',
    listIndentSpaces: 2,
    enableLinkCleaning: false,
    unifyLinkStyle: false,
    linkStyle: 'inline',
    enableSymbolDeletion: false,
    symbolsToDelete: '',
    preserveSpacesAroundSymbols: true,
    customRegexRules: [],
    enableTableFormat: false,
    enableCodeHighlight: false,
    formatRules: [
        {
            id: 'headings',
            name: '标题格式化',
            description: '确保标题符号后有空格',
            enabled: true,
            priority: 100,
            apply: (content: string) => content.replace(/^(#+)([^\s#])/gm, '$1 $2')
        },
        {
            id: 'lists',
            name: '列表格式化',
            description: '统一列表符号和缩进',
            enabled: true,
            priority: 90,
            apply: (content: string) => {
                // 实现列表格式化逻辑
                return content.replace(/^(\s*)([*+-]|\d+\.)\s+/gm, (match, indent, bullet) => {
                    const newIndent = ' '.repeat(Math.floor(indent.length / 2) * 2);
                    const newBullet = /^\d+\./.test(bullet) ? bullet : '-';
                    return `${newIndent}${newBullet} `;
                });
            }
        },
        // ... 添加更多默认规则
    ]
};

// 在文件顶部添加这个类型声明
type ObsidianHTMLElement = HTMLElement & {
    createEl<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: { [key: string]: any }): HTMLElementTagNameMap[K];
    createEl(tag: string, attrs?: { [key: string]: any }): ObsidianHTMLElement;
    empty(): void;
    createDiv(options?: { cls?: string }): ObsidianHTMLElement;
    createSpan(): ObsidianHTMLElement;
    textContent: string; // 添加这行，确保 textContent 是非空的字符串
};

// 在文件顶部添加这个函数
function asObsidianHTMLElement(el: HTMLElement): ObsidianHTMLElement {
    return el as unknown as ObsidianHTMLElement;
}

// 在 MarkdownMasterPlugin 类定义之前添加这个类

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

// ... MarkdownMasterPlugin 类定义和其他代码 ...

export default class MarkdownMasterPlugin extends Plugin {
    settings: MarkdownMasterSettings;
    private lastContent: string = '';
    private fileOpenRef: EventRef | null = null;
    private lastUnformattedContent: string = '';
    private formatHistory: FormatHistory;

    constructor() {
        super();
        this.settings = DEFAULT_SETTINGS;
        this.formatHistory = new FormatHistory();
    }

    async onload() {
        console.log('Loading MarkdownMaster plugin');

        // 等待应用程序完全加载
        this.app.workspace.onLayoutReady(() => {
            this.initialize();
        });
    }

    private async initialize() {
        try {
            await this.loadSettings();

            this.addRibbonIcon('pencil', 'Markdown Master', (evt: MouseEvent) => {
                this.showFormatOptions();
            });

            this.addCommand({
                id: 'format-markdown',
                name: '格式化当前Markdown文件',
                callback: () => this.showFormatOptions()
            });

            this.addCommand({
                id: 'undo-last-formatting',
                name: '撤销上次格式化',
                callback: () => this.undoLastFormatting()
            });

            this.addCommand({
                id: 'batch-format-markdown',
                name: '批量格式化所有Markdown文件',
                callback: () => this.batchFormat()
            });

            if (this.settings.enableAutoFormat) {
                this.registerFileOpenEvent();
            }

            if (this.settings.autoFormatOnSave) {
                this.registerFileSaveEvent();
            }

            this.addSettingTab(new MarkdownMasterSettingTab(this.app, this));
            console.log('MarkdownMaster plugin loaded successfully');
        } catch (error) {
            console.error('Error initializing MarkdownMaster plugin:', error);
        }
    }

    private registerFileOpenEvent() {
        this.fileOpenRef = this.registerEvent(
            this.app.workspace.on('file-open', (file: TFile) => {
                if (file && file.extension === 'md') {
                    this.autoFormatFile(file);
                }
            })
        );
    }

    private registerFileSaveEvent() {
        this.registerEvent(
            this.app.vault.on('modify', (file: TFile) => {
                if (file.extension === 'md') {
                    this.formatMarkdown(file);
                }
            })
        );
    }

    onunload() {
        if (this.fileOpenRef) {
            this.app.workspace.offref(this.fileOpenRef);
        }
    }

    async loadSettings() {
        try {
            const loadedData = await this.loadData();
            this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);
            this.settings.formatRules = this.mergeFormatRules(DEFAULT_SETTINGS.formatRules, this.settings.formatRules);
        } catch (error) {
            console.error('Error loading settings:', error);
            this.settings = DEFAULT_SETTINGS;
        }
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    mergeFormatRules(defaultRules: FormatRule[], savedRules: FormatRule[]): FormatRule[] {
        const mergedRules = [...defaultRules];
        savedRules.forEach(savedRule => {
            const index = mergedRules.findIndex(r => r.id === savedRule.id);
            if (index !== -1) {
                mergedRules[index] = { ...mergedRules[index], ...savedRule };
            } else {
                mergedRules.push(savedRule);
            }
        });
        return mergedRules;
    }

    async formatMarkdown(input: TFile | string): Promise<string> {
        try {
            let content: string;
            if (typeof input === 'string') {
                content = input;
            } else {
                content = await this.app.vault.read(input);
            }

            this.lastUnformattedContent = content;

            content = this.applyFormatTemplate(content);

            for (const rule of this.settings.formatRules) {
                if (rule.enabled) {
                    content = rule.apply(content);
                }
            }

            if (this.settings.enableHeadingConversion) {
                content = this.convertHeadings(content);
            }

            if (this.settings.enableLinkCleaning) {
                content = this.cleanLinks(content);
            }

            if (this.settings.unifyLinkStyle) {
                content = this.unifyLinks(content);
            }

            content = this.applyCustomRegexRules(content);

            this.formatHistory.addToHistory(content);

            return content;
        } catch (error) {
            this.handleError(error, '格式化文档');
            return typeof input === 'string' ? input : await this.app.vault.read(input);
        }
    }

    private applyFormatTemplate(content: string): string {
        switch (this.settings.formatTemplate) {
            case 'technical':
                content = content.replace(/^#\s/gm, '# ');
                content = content.replace(/`([^`\n]+)`/g, '`$1`');
                content = content.replace(/\n{3,}/g, '\n\n');
                // 添加更多技术文档特定的格式化规则
                break;
            case 'blog':
                content = content.replace(/^#\s/gm, '# ');
                content = content.replace(/!\[(.*?)\]\((.*?)\)/g, '![$1]($2)\n');
                // 添加更多博客文章特定的格式化规则
                break;
            case 'academic':
                content = content.replace(/^#\s/gm, '# ');
                content = content.replace(/^##\s/gm, '## ');
                content = content.replace(/(\d+)\./g, '$1\\.');
                // 添加更多学术论文特定的格式化规则
                break;
        }
        return content;
    }

    private convertHeadings(content: string): string {
        const sourceLevel = parseInt(this.settings.sourceHeadingLevel.slice(1));
        const targetLevel = parseInt(this.settings.targetHeadingLevel.slice(1));
        const levelDiff = targetLevel - sourceLevel;

        const convertLine = (line: string) => {
            const match = line.match(/^(#+)\s/);
            if (match) {
                const currentLevel = match[1].length;
                if (currentLevel >= sourceLevel) {
                    const newLevel = Math.max(1, Math.min(6, currentLevel + levelDiff));
                    return '#'.repeat(newLevel) + line.slice(currentLevel);
                }
            }
            return line;
        };

        if (this.settings.recursiveHeadingConversion) {
            return content.split('\n').map(convertLine).join('\n');
        } else {
            const regex = new RegExp(`^#{${sourceLevel}}\\s(.+)$`, 'gm');
            return content.replace(regex, `${'#'.repeat(targetLevel)} $1`);
        }
    }

    private cleanLinks(content: string): string {
        const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        return content.replace(linkRegex, (match, text, url) => {
            if (url.startsWith('http') || url.startsWith('https')) {
                return match;
            } else {
                // 处理相对链接或其他类型的链接
                return text;
            }
        });
    }

    private unifyLinks(content: string): string {
        if (this.settings.linkStyle === 'inline') {
            const refLinkRegex = /\[([^\]]+)\]\[([^\]]+)\]/g;
            const refDefRegex = /^\[([^\]]+)\]:\s*(.+)$/gm;
            const refDefs = new Map<string, string>();

            // 收集引用定义
            content = content.replace(refDefRegex, (match, id, url) => {
                refDefs.set(id, url.trim());
                return '';
            });

            // 转换引用链接为内联链接
            content = content.replace(refLinkRegex, (match, text, id) => {
                const url = refDefs.get(id);
                return url ? `[${text}](${url})` : match;
            });
        } else if (this.settings.linkStyle === 'reference') {
            const inlineLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
            const refDefs = new Map<string, string>();
            let refCounter = 1;

            // 转换内联链接为引用链接
            content = content.replace(inlineLinkRegex, (match, text, url) => {
                let id = refCounter.toString();
                refDefs.set(id, url.trim());
                refCounter++;
                return `[${text}][${id}]`;
            });

            // 添加引用定义到文档末尾
            content += '\n\n';
            for (const [id, url] of refDefs) {
                content += `[${id}]: ${url}\n`;
            }
        }
        return content;
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

    private applyFormatting(content: string): string {
        // 应用所有格式化规则
        if (this.settings.enableTableFormat) {
            content = this.formatTables(content);
        }
        if (this.settings.enableCodeHighlight) {
            content = this.formatCodeBlocks(content);
        }
        // 添加其他格式化逻辑...
        return content;
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

    showFormatOptions() {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) {
            new Notice('请打开一个Markdown文件');
            return;
        }

        const content = activeView.editor.getValue();
        this.formatMarkdown(content).then((formattedContent) => {
            new FormatPreviewModal(this.app, this, content, formattedContent).open();
        });
    }

    exportSettings(): string {
        return JSON.stringify(this.settings, null, 2);
    }

    async importSettings(settingsJson: string) {
        try {
            const newSettings = JSON.parse(settingsJson);
            this.settings = { ...DEFAULT_SETTINGS, ...newSettings };
            await this.saveSettings();
            new Notice('设置已成功导入');
        } catch (error) {
            console.error('导入设置时出错:', error);
            new Notice('导入设置失败，请检查文件格式');
        }
    }

    undoLastFormatting() {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView && this.lastUnformattedContent) {
            activeView.editor.setValue(this.lastUnformattedContent);
            new Notice('已撤销上次格式化');
            this.lastUnformattedContent = ''; // 清空撤销内容
        } else {
            new Notice('没有可撤销的格式化操作');
        }
    }

    async batchFormat() {
        const files = this.app.vault.getMarkdownFiles();
        let formattedCount = 0;

        for (const file of files) {
            const content = await this.app.vault.read(file);
            const formattedContent = await this.formatMarkdown(content);
            
            if (content !== formattedContent) {
                await this.app.vault.modify(file, formattedContent);
                formattedCount++;
            }
        }

        new Notice(`已格式化 ${formattedCount} 个文件`);
    }

    // 将 formatTables 方法改为公共方法，以便测试
    public formatTables(content: string): string {
        const tableRegex = /\|(.+)\|/g;
        return content.replace(tableRegex, (match) => {
            const cells = match.split('|').map(cell => cell.trim());
            const maxLength = Math.max(...cells.map(cell => cell.length));
            return cells.map(cell => `| ${this.padEndPolyfill(cell, maxLength)} `).join('') + '|';
        });
    }

    private padEndPolyfill(str: string, targetLength: number, padString: string = ' '): string {
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

    private formatCodeBlocks(content: string): string {
        const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
        return content.replace(codeBlockRegex, (match, lang, code) => {
            return `\`\`\`${lang || ''}\n${code.trim()}\n\`\`\``;
        });
    }

    showFormatHistory() {
        const history = this.formatHistory.getHistory();
        new FormatHistoryModal(this.app, history, (selectedContent: string) => {
            const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (activeView) {
                activeView.editor.setValue(selectedContent);
            }
        }).open();
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

    private someMethod() {
        if (!this.app || !this.app.vault) {
            console.error('App or vault is not initialized');
            return;
        }
        // 使用 this.app 或 this.app.vault 的代码
    }

    private loadCSS() {
        const styleEl = document.createElement('style');
        styleEl.textContent = `
            /* 在这里添加你的 CSS 样式 */
        `;
        document.head.appendChild(styleEl);
    }

    private applyCustomRegexRules(content: string): string {
        for (const rule of this.settings.customRegexRules) {
            const regex = new RegExp(rule.pattern, 'g');
            content = content.replace(regex, rule.replacement);
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

        const diffContainer = contentEl.createDiv({ cls: 'markdown-master-diff' });
        const diff = diffChars(this.originalContent, this.formattedContent);

        diff.forEach((part: Change) => {  // 为 part 指定 Change 类型
            const span = diffContainer.createSpan();
            span.textContent = part.value;
            if (part.added) {
                span.className = 'added';
            } else if (part.removed) {
                span.className = 'removed';
            }
        });

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

        new Setting(containerEl)
            .setName('格式化模板')
            .setDesc('选择预定义的格式化模板')
            .addDropdown((dropdown: DropdownComponent) => dropdown
                .addOption('default', '默认')
                .addOption('technical', '技术文档')
                .addOption('blog', '博客文章')
                .addOption('academic', '学术论文')
                .setValue(this.plugin.settings.formatTemplate)
                .onChange(async (value: string) => {
                    this.plugin.settings.formatTemplate = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('启用标题转换')
            .setDesc('允许在不同级别的标题之间进行转换')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableHeadingConversion)
                .onChange(async (value) => {
                    this.plugin.settings.enableHeadingConversion = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('源标题级别')
            .setDesc('选择要转换的源标题级别')
            .addDropdown((dropdown: DropdownComponent) => dropdown
                .addOption('h1', '一级标题 (#)')
                .addOption('h2', '二级标题 (##)')
                .addOption('h3', '三级标题 (###)')
                .addOption('h4', '四级标题 (####)')
                .addOption('h5', '五级标题 (#####)')
                .addOption('h6', '六级标题 (######)')
                .setValue(this.plugin.settings.sourceHeadingLevel)
                .onChange(async (value: string) => {
                    this.plugin.settings.sourceHeadingLevel = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('目标标题级别')
            .setDesc('选择要转换到的目标标题级别')
            .addDropdown((dropdown: DropdownComponent) => dropdown
                .addOption('h1', '一级标题 (#)')
                .addOption('h2', '二级标题 (##)')
                .addOption('h3', '三级标题 (###)')
                .addOption('h4', '四级标题 (####)')
                .addOption('h5', '五级标题 (#####)')
                .addOption('h6', '六级标题 (######)')
                .setValue(this.plugin.settings.targetHeadingLevel)
                .onChange(async (value: string) => {
                    this.plugin.settings.targetHeadingLevel = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('递归转换子标题')
            .setDesc('同时转换所选标题下的所有子标题')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.recursiveHeadingConversion)
                .onChange(async (value) => {
                    this.plugin.settings.recursiveHeadingConversion = value;
                    await this.plugin.saveSettings();
                }));

        // ... 其他设置项

        containerEl.createEl('h3', { text: '格式化规则优先级' });

        new Setting(containerEl)
            .setName('规则排序')
            .setDesc('拖动规则来调整优先级，越靠上优先级越高')
            .addButton(button => button
                .setButtonText('重置为默认')
                .onClick(async () => {
                    this.plugin.settings.formatRules = DEFAULT_SETTINGS.formatRules;
                    await this.plugin.saveSettings();
                    this.display();
                }));

        const ruleListContainer = containerEl.createEl('div', { cls: 'markdown-master-rule-list' }) as unknown as ObsidianHTMLElement;

        Sortable.create(ruleListContainer as HTMLElement, {
            onEnd: async (evt: Sortable.SortableEvent) => {
                const rules = this.plugin.settings.formatRules;
                if (typeof evt.oldIndex === 'number' && typeof evt.newIndex === 'number') {
                    const movedRule = rules.splice(evt.oldIndex, 1)[0];
                    rules.splice(evt.newIndex, 0, movedRule);
                    rules.forEach((rule, index) => {
                        rule.priority = rules.length - index;
                    });
                    await this.plugin.saveSettings();
                }
            }
        });

        this.plugin.settings.formatRules.forEach((rule, index) => {
            const ruleEl = asObsidianHTMLElement(ruleListContainer.createEl('div', { cls: 'markdown-master-rule-item' }));
            ruleEl.createEl('span', { text: rule.name });
            
            new Setting(asObsidianHTMLElement(ruleEl))
                .addToggle(toggle => toggle
                    .setValue(rule.enabled)
                    .onChange(async (value) => {
                        rule.enabled = value;
                        await this.plugin.saveSettings();
                    }))
                .addButton(button => button
                    .setButtonText('✏️ 编辑')
                    .onClick(() => {
                        new FormatRuleModal(this.app, rule, async (updatedRule) => {
                            this.plugin.settings.formatRules[index] = updatedRule;
                            await this.plugin.saveSettings();
                            this.display();
                        }).open();
                    }));
        });

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
                    input.accept = '.json';
                    input.onchange = async (e: Event) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file) {
                            const reader = new FileReader();
                            reader.onload = async (e) => {
                                const content = e.target?.result as string;
                                await this.plugin.importSettings(content);
                                this.display(); // 重新加载设置页面
                            };
                            reader.readAsText(file);
                        }
                    };
                    input.click();
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
            .setName('启用代码块格式化')
            .setDesc('统一代码块的缩进和空行')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableCodeHighlight)
                .onChange(async (value) => {
                    this.plugin.settings.enableCodeHighlight = value;
                    await this.plugin.saveSettings();
                }));
    }
}

// 添加 FormatHistoryModal 类
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

class FormatRuleModal extends Modal {
    rule: FormatRule;
    onSubmit: (rule: FormatRule) => void;

    constructor(app: App, rule: FormatRule, onSubmit: (rule: FormatRule) => void) {
        super(app);
        this.rule = { ...rule };
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: '编辑格式化规则' });

        new Setting(contentEl)
            .setName('规则名称')
            .addText(text => text
                .setValue(this.rule.name)
                .onChange(value => this.rule.name = value));

        new Setting(contentEl)
            .setName('描述')
            .addTextArea(text => text
                .setValue(this.rule.description)
                .onChange(value => this.rule.description = value));

        new Setting(contentEl)
            .setName('优先级')
            .addSlider(slider => slider
                .setLimits(1, 100, 1)
                .setValue(this.rule.priority)
                .setDynamicTooltip()
                .onChange(value => this.rule.priority = value));

        new Setting(contentEl)
            .addButton(button => button
                .setButtonText('保存')
                .setCta()
                .onClick(() => {
                    this.onSubmit(this.rule);
                    this.close();
                }))
            .addButton(button => button
                .setButtonText('取消')
                .onClick(() => this.close()));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}