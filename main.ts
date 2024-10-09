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
    unifyLinkStyle: boolean;
    linkStyle: string;
    enableSymbolDeletion: boolean;
    symbolsToDelete: string;
    preserveSpacesAroundSymbols: boolean;
    customRegexRules: Array<{ pattern: string; replacement: string }>;
    enableTableFormat: boolean;
    enableCodeHighlight: boolean;
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
        // 移除空链接
        content = content.replace(/\[([^\]]+)\]\(\s*\)/g, '$1');
        
        // 移除重复的链接
        const linkMap = new Map();
        return content.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
            if (linkMap.has(url)) {
                return text;
            } else {
                linkMap.set(url, true);
                return match;
            }
        });
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
        // 实现符号删除逻辑
        return content;
    }

    highlightCode(content: string): string {
        // 实现代码高亮逻辑
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

        // 添加更多设置项...
    }
}