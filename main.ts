import { Plugin, PluginSettingTab, Setting, App, Editor, MarkdownView, TFile, Notice, Modal } from 'obsidian';
import { TRANSLATIONS, SupportedLanguage } from './src/i18n';

// 添加自定义的 debounce 函数
function debounce(func: Function, wait: number, immediate = false) {
    let timeout: NodeJS.Timeout | null = null;
    return function(this: any, ...args: any[]) {
        const context = this;
        const later = function() {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        const callNow = immediate && !timeout;
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
}

export interface MarkdownMasterSettings {
    enableAutoFormat: boolean;
    autoFormatOnSave: boolean;
    formatTemplate: string;
    enableHeadingConversion: boolean;
    sourceHeadingLevel: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
    targetHeadingLevel: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
    recursiveHeadingConversion: boolean;
    enableListFormatting: boolean;
    listBulletChar: string;
    listIndentSpaces: number;
    enableLinkCleaning: boolean;
    linkCleaningRules: Array<{ pattern: string; enabled: boolean; comment: string }>;
    unifyLinkStyle: boolean;
    linkStyle: string;
    enableSymbolDeletion: boolean;
    symbolsToDelete: string;
    preserveSpacesAroundSymbols: boolean;
    customRegexRules: Array<{ pattern: string; replacement: string }>;
    enableTableFormat: boolean;
    enableCodeHighlight: boolean;
    enableTextDeletion: boolean;
    textDeletionRules: Array<{ pattern: string; enabled: boolean; comment: string }>;
    textDeletionHistory: Array<{ pattern: string; deletedText: string; timestamp: number }>;
    language: SupportedLanguage;
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
    linkCleaningRules: [
        { pattern: '\\[([^\\]]+)\\]\\(https?://example\\.com/.*\\)', enabled: true, comment: 'Remove links to example.com' },
    ],
    unifyLinkStyle: false,
    linkStyle: 'inline',
    enableSymbolDeletion: false,
    symbolsToDelete: '*#-',
    preserveSpacesAroundSymbols: true,
    customRegexRules: [],
    enableTableFormat: false,
    enableCodeHighlight: false,
    enableTextDeletion: false,
    textDeletionRules: [],
    textDeletionHistory: [],
    language: 'zh',
};

export default class MarkdownMasterPlugin extends Plugin {
    settings: MarkdownMasterSettings;
    settingTab: MarkdownMasterSettingTab;

    private readonly debouncedSaveSettings = debounce(async () => {
        await this.saveSettings();
    }, 2000, true);

    t(key: string): string {
        return TRANSLATIONS[this.settings.language][key] || key;
    }

    async onload() {
        try {
            await this.loadSettings();

            this.addRibbonIcon('pencil', 'Markdown Master', () => {
                this.formatMarkdown();
            });

            this.addCommand({
                id: 'format-markdown',
                name: 'Format Current File',
                callback: () => this.formatMarkdown(),
            });

            this.addCommand({
                id: 'format-all-markdown',
                name: 'Format All Markdown Files',
                callback: () => this.formatAllMarkdownFiles(),
            });

            this.addCommand({
                id: 'toggle-auto-format',
                name: 'Toggle Auto Format on Save',
                callback: () => this.toggleAutoFormat(),
            });

            this.settingTab = new MarkdownMasterSettingTab(this.app, this);
            this.addSettingTab(this.settingTab);

            if (this.settings.autoFormatOnSave) {
                this.registerEvent(
                    this.app.vault.on('modify', (file: TFile) => {
                        if (file.extension === 'md') {
                            this.formatFile(file);
                        }
                    })
                );
            }
        } catch (error) {
            console.error('Failed to load Markdown Master plugin:', error);
            new Notice('Markdown Master 插件加载失败,请检查控制台日志');
        }
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        try {
            await this.saveData(this.settings);
        } catch (error) {
            console.error('Failed to save Markdown Master settings:', error);
            new Notice('Markdown Master 设置保存失败');
        }
    }

    async formatMarkdown() {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView) {
            const originalContent = activeView.editor.getValue();
            const formattedContent = await this.applyFormatRules(originalContent);
            new FormatPreviewModal(this.app, this, originalContent, formattedContent).open();
        }
    }

    async formatAllMarkdownFiles() {
        const files = this.app.vault.getMarkdownFiles();
        for (const file of files) {
            await this.formatFile(file);
        }
        new Notice('All Markdown files formatted successfully');
    }

    async formatFile(file: TFile) {
        const content = await this.app.vault.read(file);
        const formattedContent = await this.applyFormatting(content);
        await this.app.vault.modify(file, formattedContent);
    }

    async applyFormatting(content: string): Promise<string> {
        if (this.settings.enableHeadingConversion) {
            content = this.convertHeadings(content);
        }
        if (this.settings.enableListFormatting) {
            content = this.formatLists(content);
        }
        if (this.settings.enableTableFormat) {
            content = this.formatTables(content);
        }
        if (this.settings.enableLinkCleaning) {
            content = this.cleanLinks(content);
        }
        if (this.settings.unifyLinkStyle) {
            content = this.unifyLinkStyle(content);
        }
        if (this.settings.enableSymbolDeletion) {
            content = this.deleteSymbols(content);
        }
        if (this.settings.enableCodeHighlight) {
            content = this.highlightCode(content);
        }
        if (this.settings.enableTextDeletion) {
            content = this.deleteText(content);
        }
        content = this.applyCustomRules(content);
        return content;
    }

    convertHeadings(content: string): string {
        const headingLevels = {
            'h1': '#',
            'h2': '##',
            'h3': '###',
            'h4': '####',
            'h5': '#####',
            'h6': '######'
        };
        const sourceLevel = headingLevels[this.settings.sourceHeadingLevel as keyof typeof headingLevels];
        const targetLevel = headingLevels[this.settings.targetHeadingLevel as keyof typeof headingLevels];
        
        if (this.settings.recursiveHeadingConversion) {
            // 递归转换所有级别的标题
            const levelDiff = Object.keys(headingLevels).indexOf(this.settings.targetHeadingLevel) - 
                              Object.keys(headingLevels).indexOf(this.settings.sourceHeadingLevel);
            return content.replace(/^(#{1,6})\s(.+)$/gm, (match, hashes, title) => {
                const newLevel = Math.max(1, Math.min(6, hashes.length + levelDiff));
                return `${'#'.repeat(newLevel)} ${title}`;
            });
        } else {
            // 只转换指定级别的标题
            const regex = new RegExp(`^${sourceLevel}\\s(.+)$`, 'gm');
            return content.replace(regex, `${targetLevel} $1`);
        }
    }

    formatLists(content: string): string {
        // 实现列表格式化逻辑
        return content.replace(/^(\s*)([*+-]|\d+\.)\s+/gm, (match, indent, bullet) => {
            const newIndent = ' '.repeat(Math.floor(indent.length / this.settings.listIndentSpaces) * this.settings.listIndentSpaces);
            const newBullet = /^\d+\./.test(bullet) ? bullet : this.settings.listBulletChar;
            return `${newIndent}${newBullet} `;
        });
    }

    formatTables(content: string): string {
        // 实现表格格式化逻辑
        return content;
    }

    cleanLinks(content: string): string {
        this.settings.linkCleaningRules.forEach(rule => {
            if (rule.enabled) {
                const regex = new RegExp(rule.pattern, 'g');
                content = content.replace(regex, '');
            }
        });
        return content;
    }

    unifyLinkStyle(content: string): string {
        if (this.settings.linkStyle === 'reference') {
            let referenceLinks: {[key: string]: string} = {};
            let linkCount = 1;
            
            // 将内联链接转换为引用链接
            content = content.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
                if (!referenceLinks[url]) {
                    referenceLinks[url] = `[${linkCount}]`;
                    linkCount++;
                }
                return `[${text}]${referenceLinks[url]}`;
            });
            
            // 在文档末尾添加引用链接
            content += '\n\n';
            for (let url in referenceLinks) {
                content += `${referenceLinks[url]}: ${url}\n`;
            }
        } else {
            // 将引用链接转换为内联链接
            let referenceLinks: {[key: string]: string} = {};
            content = content.replace(/^\[([^\]]+)\]:\s*(.+)$/gm, (match, id, url) => {
                referenceLinks[id] = url.trim();
                return '';
            });
            
            content = content.replace(/\[([^\]]+)\]\[([^\]]+)\]/g, (match, text, id) => {
                return `[${text}](${referenceLinks[id] || ''})`;
            });
        }
        return content;
    }

    deleteSymbols(content: string): string {
        if (!this.settings.enableSymbolDeletion || !this.settings.symbolsToDelete) {
            return content;
        }

        const escapedSymbols = this.settings.symbolsToDelete.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`[${escapedSymbols}]`, 'g');
        return content.replace(regex, '');
    }

    highlightCode(content: string): string {
        // 实现代码高亮逻辑
        return content;
    }

    deleteText(content: string): string {
        if (!this.settings.enableTextDeletion) {
            return content;
        }

        this.settings.textDeletionRules.forEach(rule => {
            if (rule.enabled && rule.pattern) {
                try {
                    const regex = new RegExp(rule.pattern, 'g');
                    content = content.replace(regex, (match) => {
                        // 保存删除的文本到历史记录
                        this.settings.textDeletionHistory.push({
                            pattern: rule.pattern,
                            deletedText: match,
                            timestamp: Date.now()
                        });
                        return '';
                    });
                } catch (error) {
                    console.error(`Invalid regex pattern: ${rule.pattern}`, error);
                    // 可以选择在这里显示一个通知给用户
                    new Notice(`Invalid regex pattern: ${rule.pattern}`);
                }
            }
        });

        // 限制历史记录的数量，例如只保留最近的 100 条
        if (this.settings.textDeletionHistory.length > 100) {
            this.settings.textDeletionHistory = this.settings.textDeletionHistory.slice(-100);
        }

        this.saveSettings();
        return content;
    }

    applyCustomRules(content: string): string {
        // 应用自定义正则表达式规则
        for (const rule of this.settings.customRegexRules) {
            const regex = new RegExp(rule.pattern, 'g');
            content = content.replace(regex, rule.replacement);
        }
        return content;
    }

    toggleAutoFormat() {
        this.settings.autoFormatOnSave = !this.settings.autoFormatOnSave;
        this.saveSettings();
        new Notice(`Auto format on save ${this.settings.autoFormatOnSave ? 'enabled' : 'disabled'}`);
    }

    // 在设置更改时使用
    async updateSetting<K extends keyof MarkdownMasterSettings>(key: K, value: MarkdownMasterSettings[K]) {
        this.settings[key] = value;
        this.debouncedSaveSettings();
    }

    // 添加这个新方法
    async updateLanguage(newLanguage: SupportedLanguage) {
        this.settings.language = newLanguage;
        await this.saveSettings();
        if (this.settingTab) {
            this.settingTab.display();
        }
    }

    async applyFormatRules(content: string): Promise<string> {
        // 这里实现你的格式化逻辑
        // 例如：
        return content.replace(/\s+/g, ' ').trim();
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

        containerEl.createEl('h2', { text: this.plugin.t('Markdown Master Settings') });

        new Setting(containerEl)
            .setName(this.plugin.t('Enable Auto Format'))
            .setDesc(this.plugin.t('Automatically format Markdown content on save'))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableAutoFormat)
                .onChange(async (value) => {
                    this.plugin.settings.enableAutoFormat = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(this.plugin.t('Enable Heading Conversion'))
            .setDesc(this.plugin.t('Convert headings to specified levels'))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableHeadingConversion)
                .onChange(async (value) => {
                    this.plugin.settings.enableHeadingConversion = value;
                    await this.plugin.saveSettings();
                    this.display(); // 重新加载设置页面以显示或隐藏子选项
                }));

        if (this.plugin.settings.enableHeadingConversion) {
            new Setting(containerEl)
                .setName(this.plugin.t('Source Heading Level'))
                .setDesc(this.plugin.t('Select the source heading level for conversion'))
                .addDropdown(dropdown => dropdown
                    .addOptions({
                        'h1': this.plugin.t('First Level'),
                        'h2': this.plugin.t('Second Level'),
                        'h3': this.plugin.t('Third Level'),
                        'h4': this.plugin.t('Fourth Level'),
                        'h5': this.plugin.t('Fifth Level'),
                        'h6': this.plugin.t('Sixth Level')
                    })
                    .setValue(this.plugin.settings.sourceHeadingLevel)
                    .onChange(async (value) => {
                        this.plugin.settings.sourceHeadingLevel = value as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName(this.plugin.t('Target Heading Level'))
                .setDesc(this.plugin.t('Select the target heading level for conversion'))
                .addDropdown(dropdown => dropdown
                    .addOptions({
                        'h1': this.plugin.t('First Level'),
                        'h2': this.plugin.t('Second Level'),
                        'h3': this.plugin.t('Third Level'),
                        'h4': this.plugin.t('Fourth Level'),
                        'h5': this.plugin.t('Fifth Level'),
                        'h6': this.plugin.t('Sixth Level')
                    })
                    .setValue(this.plugin.settings.targetHeadingLevel)
                    .onChange(async (value) => {
                        this.plugin.settings.targetHeadingLevel = value as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName(this.plugin.t('Recursive Heading Conversion'))
                .setDesc(this.plugin.t('Convert all subheadings recursively'))
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.recursiveHeadingConversion)
                    .onChange(async (value) => {
                        this.plugin.settings.recursiveHeadingConversion = value;
                        await this.plugin.saveSettings();
                    }));
        }

        new Setting(containerEl)
            .setName(this.plugin.t('Enable Link Cleaning'))
            .setDesc(this.plugin.t('Clean links based on custom rules'))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableLinkCleaning)
                .onChange(async (value) => {
                    this.plugin.settings.enableLinkCleaning = value;
                    await this.plugin.saveSettings();
                    this.display(); // 重新加载设置页面以显示或隐藏子选项
                }));

        if (this.plugin.settings.enableLinkCleaning) {
            this.plugin.settings.linkCleaningRules.forEach((rule, index) => {
                const ruleContainer = containerEl.createDiv();
                new Setting(ruleContainer)
                    .setName(`Rule ${index + 1}`)
                    .setDesc('Enter regex pattern for link cleaning')
                    .addText(text => text
                        .setValue(rule.pattern)
                        .onChange(async (value: string) => {
                            this.plugin.settings.linkCleaningRules[index].pattern = value;
                            await this.plugin.saveSettings();
                        }))
                    .addText(text => {
                        (text as any).inputEl.placeholder = 'Comment';
                        text.setValue(rule.comment)
                            .onChange(async (value: string) => {
                                this.plugin.settings.linkCleaningRules[index].comment = value;
                                await this.plugin.saveSettings();
                            });
                        return text;
                    })
                    .addToggle(toggle => toggle
                        .setValue(rule.enabled)
                        .onChange(async (value) => {
                            this.plugin.settings.linkCleaningRules[index].enabled = value;
                            await this.plugin.saveSettings();
                        }))
                    .addButton(button => button
                        .setButtonText('Delete')
                        .onClick(async () => {
                            this.plugin.settings.linkCleaningRules.splice(index, 1);
                            await this.plugin.saveSettings();
                            this.display(); // 刷新设置页面
                        }));
            });

            new Setting(containerEl)
                .setName('Add New Link Cleaning Rule')
                .addButton(button => button
                    .setButtonText('Add')
                    .onClick(async () => {
                        this.plugin.settings.linkCleaningRules.push({ pattern: '', enabled: true, comment: '' });
                        await this.plugin.saveSettings();
                        this.display(); // 刷新设置页面
                    }));
        }

        new Setting(containerEl)
            .setName(this.plugin.t('Enable Text Deletion'))
            .setDesc(this.plugin.t('Delete text based on custom regex patterns'))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableTextDeletion)
                .onChange(async (value) => {
                    this.plugin.settings.enableTextDeletion = value;
                    await this.plugin.saveSettings();
                }));

        if (this.plugin.settings.enableTextDeletion) {
            this.plugin.settings.textDeletionRules.forEach((rule, index) => {
                const ruleContainer = containerEl.createDiv();
                new Setting(ruleContainer)
                    .setName(`Rule ${index + 1}`)
                    .setDesc('Enter regex pattern for text deletion')
                    .addText(text => text
                        .setValue(rule.pattern)
                        .onChange(async (value: string) => {
                            try {
                                new RegExp(value); // 测试正则表达式是否有效
                                this.plugin.settings.textDeletionRules[index].pattern = value;
                                await this.plugin.saveSettings();
                            } catch (error) {
                                new Notice('Invalid regex pattern');
                            }
                        }))
                    .addText(text => {
                        (text as any).inputEl.placeholder = 'Comment';
                        text.setValue(rule.comment)
                            .onChange(async (value: string) => {
                                this.plugin.settings.textDeletionRules[index].comment = value;
                                await this.plugin.saveSettings();
                            });
                        return text;
                    })
                    .addToggle(toggle => toggle
                        .setValue(rule.enabled)
                        .onChange(async (value) => {
                            this.plugin.settings.textDeletionRules[index].enabled = value;
                            await this.plugin.saveSettings();
                        }))
                    .addButton(button => button
                        .setButtonText('Delete')
                        .onClick(async () => {
                            this.plugin.settings.textDeletionRules.splice(index, 1);
                            await this.plugin.saveSettings();
                            this.display(); // 刷新设置页面
                        }));
            });

            new Setting(containerEl)
                .setName('Add New Text Deletion Rule')
                .addButton(button => button
                    .setButtonText('Add')
                    .onClick(async () => {
                        this.plugin.settings.textDeletionRules.push({ pattern: '', enabled: true, comment: '' });
                        await this.plugin.saveSettings();
                        this.display(); // 刷新设置页面
                    }));
        }

        new Setting(containerEl)
            .setName(this.plugin.t('Enable Symbol Deletion'))
            .setDesc(this.plugin.t('Delete specific symbols from text'))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableSymbolDeletion)
                .onChange(async (value) => {
                    this.plugin.settings.enableSymbolDeletion = value;
                    await this.plugin.saveSettings();
                }));

        if (this.plugin.settings.enableSymbolDeletion) {
            new Setting(containerEl)
                .setName('要删除的符号')
                .setDesc('输入要删除的符号（不含空格）')
                .addText(text => text
                    .setValue(this.plugin.settings.symbolsToDelete)
                    .onChange(async (value) => {
                        this.plugin.settings.symbolsToDelete = value;
                        await this.plugin.saveSettings();
                    }));
        }

        new Setting(containerEl)
            .setName(this.plugin.t('Export Settings'))
            .setDesc(this.plugin.t('Export your current settings to a JSON file'))
            .addButton(button => button
                .setButtonText(this.plugin.t('Export'))
                .onClick(() => {
                    // 导出设置的逻辑
                }));

        new Setting(containerEl)
            .setName(this.plugin.t('Import Settings'))
            .setDesc(this.plugin.t('Import settings from a JSON file'))
            .addButton(button => button
                .setButtonText(this.plugin.t('Import'))
                .onClick(() => {
                    // 导入设置的逻辑
                }));

        new Setting(containerEl)
            .setName(this.plugin.t('Language'))
            .setDesc(this.plugin.t('Select the plugin language'))
            .addDropdown(dropdown => dropdown
                .addOptions({
                    'en': 'English',
                    'zh': '中文'
                })
                .setValue(this.plugin.settings.language)
                .onChange(async (value: SupportedLanguage) => {
                    await this.plugin.updateLanguage(value);
                }));

        // 添加更多设置项...
    }
}

class FormatPreviewModal extends Modal {
    plugin: MarkdownMasterPlugin;
    originalContent: string;
    formattedContent: string;

    constructor(app: App, plugin: MarkdownMasterPlugin, originalContent: string, formattedContent: string) {
        super(app);
        this.plugin = plugin;
        this.originalContent = originalContent;
        this.formattedContent = formattedContent;
    }

    onOpen() {
        const {contentEl} = this;
        contentEl.empty();

        contentEl.createEl('h2', {text: this.plugin.t('Format Preview')});

        const originalDiv = contentEl.createDiv();
        originalDiv.createEl('h3', {text: this.plugin.t('Original')});
        this.renderMarkdown(originalDiv as unknown as HTMLElement, this.originalContent);

        const formattedDiv = contentEl.createDiv();
        formattedDiv.createEl('h3', {text: this.plugin.t('Formatted')});
        this.renderMarkdown(formattedDiv as unknown as HTMLElement, this.formattedContent);

        const buttonContainer = contentEl.createDiv({cls: 'button-container'});
        const applyButton = buttonContainer.createEl('button', {text: this.plugin.t('Apply Changes')});
        applyButton.addEventListener('click', () => {
            this.applyChanges();
        });

        const cancelButton = buttonContainer.createEl('button', {text: this.plugin.t('Cancel')});
        cancelButton.addEventListener('click', () => {
            this.close();
        });
    }

    renderMarkdown(container: HTMLElement, content: string) {
        // 使用 Obsidian 的 MarkdownRenderer
        (this.app as any).internalPlugins.plugins['markdown-importer'].instance.renderer.render(content, container);
    }

    applyChanges() {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView) {
            activeView.editor.setValue(this.formattedContent);
        }
        this.close();
    }

    onClose() {
        const {contentEl} = this;
        contentEl.empty();
    }
}