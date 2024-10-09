import { Plugin, PluginSettingTab, Setting, App, Editor, MarkdownView, TFile, Notice } from 'obsidian';

export interface MarkdownMasterSettings {
    enableAutoFormat: boolean;
    autoFormatOnSave: boolean;
    formatTemplate: string;
    enableHeadingConversion: boolean;
    sourceHeadingLevel: string;
    targetHeadingLevel: string;
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
};

export default class MarkdownMasterPlugin extends Plugin {
    settings: MarkdownMasterSettings;

    async onload() {
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

        this.addSettingTab(new MarkdownMasterSettingTab(this.app, this));

        if (this.settings.autoFormatOnSave) {
            this.registerEvent(
                this.app.vault.on('modify', (file: TFile) => {
                    if (file.extension === 'md') {
                        this.formatFile(file);
                    }
                })
            );
        }
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async formatMarkdown() {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView) {
            const editor = activeView.editor;
            const content = editor.getValue();
            const formattedContent = await this.applyFormatting(content);
            editor.setValue(formattedContent);
            new Notice('Markdown formatted successfully');
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
        containerEl.createEl('h2', { text: 'Markdown Master Settings' });

        new Setting(containerEl)
            .setName('Enable Auto Format')
            .setDesc('Automatically format Markdown content on save')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoFormatOnSave)
                .onChange(async (value) => {
                    this.plugin.settings.autoFormatOnSave = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Enable Heading Conversion')
            .setDesc('Convert headings to specified levels')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableHeadingConversion)
                .onChange(async (value) => {
                    this.plugin.settings.enableHeadingConversion = value;
                    await this.plugin.saveSettings();
                }));

        if (this.plugin.settings.enableHeadingConversion) {
            new Setting(containerEl)
                .setName('Source Heading Level')
                .setDesc('Select the source heading level for conversion')
                .addDropdown(dropdown => dropdown
                    .addOptions({
                        'h1': 'H1', 'h2': 'H2', 'h3': 'H3',
                        'h4': 'H4', 'h5': 'H5', 'h6': 'H6'
                    })
                    .setValue(this.plugin.settings.sourceHeadingLevel)
                    .onChange(async (value) => {
                        this.plugin.settings.sourceHeadingLevel = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('Target Heading Level')
                .setDesc('Select the target heading level for conversion')
                .addDropdown(dropdown => dropdown
                    .addOptions({
                        'h1': 'H1', 'h2': 'H2', 'h3': 'H3',
                        'h4': 'H4', 'h5': 'H5', 'h6': 'H6'
                    })
                    .setValue(this.plugin.settings.targetHeadingLevel)
                    .onChange(async (value) => {
                        this.plugin.settings.targetHeadingLevel = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('Recursive Heading Conversion')
                .setDesc('Convert all subheadings recursively')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.recursiveHeadingConversion)
                    .onChange(async (value) => {
                        this.plugin.settings.recursiveHeadingConversion = value;
                        await this.plugin.saveSettings();
                    }));
        }

        new Setting(containerEl)
            .setName('Enable Link Cleaning')
            .setDesc('Clean links based on custom rules')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableLinkCleaning)
                .onChange(async (value) => {
                    this.plugin.settings.enableLinkCleaning = value;
                    await this.plugin.saveSettings();
                    this.display(); // 刷新设置页面
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
            .setName('Enable Text Deletion')
            .setDesc('Delete text based on custom regex patterns')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableTextDeletion)
                .onChange(async (value) => {
                    this.plugin.settings.enableTextDeletion = value;
                    await this.plugin.saveSettings();
                    this.display(); // 刷新设置页面
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
            .setName('Enable Symbol Deletion')
            .setDesc('Delete specific symbols from the text')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableSymbolDeletion)
                .onChange(async (value) => {
                    this.plugin.settings.enableSymbolDeletion = value;
                    await this.plugin.saveSettings();
                    this.display(); // 刷新设置页面
                }));

        if (this.plugin.settings.enableSymbolDeletion) {
            new Setting(containerEl)
                .setName('Symbols to Delete')
                .setDesc('Enter symbols to be deleted (without spaces)')
                .addText(text => text
                    .setValue(this.plugin.settings.symbolsToDelete)
                    .onChange(async (value) => {
                        this.plugin.settings.symbolsToDelete = value;
                        await this.plugin.saveSettings();
                    }));
        }

        // 添加更多设置项...
    }
}