import { Plugin, PluginSettingTab, Setting, App, Editor, MarkdownView, TFile } from 'obsidian';

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
            name: 'Format Markdown',
            callback: () => this.formatMarkdown(),
        });

        this.addCommand({
            id: 'format-markdown-file',
            name: 'Format Current Markdown File',
            checkCallback: (checking: boolean) => {
                const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
                if (activeView) {
                    if (!checking) {
                        this.formatMarkdown();
                    }
                    return true;
                }
                return false;
            }
        });

        this.addSettingTab(new MarkdownMasterSettingTab(this.app, this));

        // this.registerEvent(
        //     this.app.workspace.on('file-menu', (menu: Menu, file: TFile, source: string) => {
        //         // ...
        //     })
        // );

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
        }
    }

    async formatFile(file: TFile) {
        const content = await this.app.vault.read(file);
        const formattedContent = await this.applyFormatting(content);
        await this.app.vault.modify(file, formattedContent);
    }

    async applyFormatting(content: string): Promise<string> {
        // 在这里实现格式化逻辑
        // 这只是一个示例，您需要根据实际需求实现完整的格式化逻辑
        if (this.settings.enableListFormatting) {
            content = this.formatLists(content);
        }
        if (this.settings.enableTableFormat) {
            content = this.formatTables(content);
        }
        // 添加更多格式化步骤...
        return content;
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
        // 这里只是一个简单的示例，实际实现可能需要更复杂的逻辑
        return content.replace(/\|(.+)\|/g, (match, cells) => {
            const formattedCells = cells.split('|').map((cell: string) => cell.trim()).join(' | ');
            return `| ${formattedCells} |`;
        });
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
            .setDesc('Automatically format Markdown content')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableAutoFormat)
                .onChange(async (value) => {
                    this.plugin.settings.enableAutoFormat = value;
                    await this.plugin.saveSettings();
                }));

        // 添加更多设置项...
    }
}