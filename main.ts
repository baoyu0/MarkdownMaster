import { App, Plugin, PluginSettingTab, Setting, MarkdownView, TFile, DropdownComponent, Modal } from 'obsidian';
import { marked, Tokens } from 'marked';

// 添加这个接口定义
interface MenuItem {
    setTitle(title: string): MenuItem;
    setIcon(icon: string): MenuItem;
    onClick(callback: () => void): MenuItem;
}

interface MarkdownMasterSettings {
    defaultHeadingLevel: number;
    autoFormatOnSave: boolean;
    standardizeListFormat: boolean;
    adjustEmptyLines: boolean;
    formatTables: boolean;
    standardizeLinksAndImages: boolean;
    // 添加更多相关设置
}

const DEFAULT_SETTINGS: MarkdownMasterSettings = {
    defaultHeadingLevel: 2,
    autoFormatOnSave: false,
    standardizeListFormat: true,
    adjustEmptyLines: true,
    formatTables: true,
    standardizeLinksAndImages: true,
    // 设置其他默认值
};

export default class MarkdownMasterPlugin extends Plugin {
    settings!: MarkdownMasterSettings;

    async onload() {
        console.log('加载 MarkdownMaster 插件');

        await this.loadSettings();

        // 添加设置选项卡
        this.addSettingTab(new MarkdownMasterSettingTab(this.app, this));

        // 添加命令
        this.addCommands();
        
        // 修复 'file-menu' 事件类型
        this.registerEvent(
            this.app.workspace.on('file-menu', (menu, file: TFile) => {
                menu.addItem((item: MenuItem) => {
                    item.setTitle('使用 MarkdownMaster 格式化')
                        .setIcon('brackets-glyph')
                        .onClick(async () => {
                            await this.formatMarkdown(file);
                        });
                });
            })
        );

        // 修复文件变更监听
        if (this.settings.autoFormatOnSave) {
            this.registerEvent(
                this.app.vault.on('modify', (file: TFile) => {
                    if (file && file.extension === 'md') {
                        this.formatMarkdown(file);
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

    addCommands() {
        this.addCommand({
            id: 'format-markdown',
            name: '格式化当前 Markdown 文件',
            callback: () => {
                // 使用 this.app.workspace.getActiveFile() 替代
                const file = this.app.workspace.getActiveFile();
                if (file) {
                    this.formatMarkdown(file);
                }
            },
        });
    }

    async formatMarkdown(file: TFile) {
        const content = await this.app.vault.read(file);
        new FormatPreviewModal(this.app, this, file, content).open();
    }

    applyFormatting(content: string): string {
        if (this.settings.standardizeListFormat) {
            content = this.standardizeLists(content);
        }
        if (this.settings.adjustEmptyLines) {
            content = this.adjustEmptyLines(content);
        }
        if (this.settings.formatTables) {
            content = this.formatTables(content);
        }
        if (this.settings.standardizeLinksAndImages) {
            content = this.standardizeLinksAndImages(content);
        }
        return content.replace(/^(#+)\s/gm, (match, p1) => {
            return '#'.repeat(this.settings.defaultHeadingLevel) + ' ';
        });
    }

    private standardizeLists(content: string): string {
        return content.replace(/^(\s*)[*+-]\s/gm, '$1- ')
                      .replace(/^(\s*)\d+\.\s/gm, '$11. ');
    }

    private adjustEmptyLines(content: string): string {
        return content.replace(/\n{3,}/g, '\n\n');
    }

    private formatTables(content: string): string {
        const tokens = marked.lexer(content);
        let formattedContent = '';
        
        tokens.forEach(token => {
            if (token.type === 'table') {
                formattedContent += this.formatTable(token as Tokens.Table);
            } else {
                formattedContent += token.raw;
            }
        });
        
        return formattedContent;
    }

    private formatTable(tableToken: Tokens.Table): string {
        const headers: Tokens.TableCell[] = tableToken.header;
        const rows: Tokens.TableCell[][] = tableToken.rows;
        const align: Array<'left' | 'center' | 'right' | null> = tableToken.align;

        // 计算每列的最大宽度
        const columnWidths = headers.map((header: Tokens.TableCell, index: number) => {
            const cellLengths = [header.text.length, ...rows.map((row: Tokens.TableCell[]) => row[index].text.length)];
            return Math.max(...cellLengths);
        });

        // 格式化表头
        let formattedTable = '| ' + headers.map((header: Tokens.TableCell, index: number) => 
            header.text.padEnd(columnWidths[index], ' ')
        ).join(' | ') + ' |\n';

        // 添加对齐行
        formattedTable += '|' + columnWidths.map((width: number, index: number) => {
            const alignment = align[index];
            if (alignment === 'center') return ':' + '-'.repeat(width) + ':';
            if (alignment === 'right') return '-'.repeat(width) + ':';
            return '-'.repeat(width + 1);
        }).join('|') + '|\n';

        // 格式化数据行
        rows.forEach((row: Tokens.TableCell[]) => {
            formattedTable += '| ' + row.map((cell: Tokens.TableCell, index: number) => 
                cell.text.padEnd(columnWidths[index], ' ')
            ).join(' | ') + ' |\n';
        });

        return formattedTable;
    }

    private standardizeLinksAndImages(content: string): string {
        return content.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '[$1]($2)')
                      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '![$1]($2)');
    }
}

class MarkdownMasterSettingTab extends PluginSettingTab {
    plugin: MarkdownMasterPlugin;

    constructor(app: App, plugin: MarkdownMasterPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;

        containerEl.empty();

        containerEl.createEl('h2', {text: 'Markdown Master 设置'});

        new Setting(containerEl)
            .setName('默认标题级别')
            .setDesc('设置格式化时的默认标题级别')
            .addDropdown((dropdown: DropdownComponent) => dropdown
                .addOption('1', 'H1')
                .addOption('2', 'H2')
                .addOption('3', 'H3')
                .addOption('4', 'H4')
                .addOption('5', 'H5')
                .addOption('6', 'H6')
                .setValue(this.plugin.settings.defaultHeadingLevel.toString())
                .onChange(async (value: string) => {
                    this.plugin.settings.defaultHeadingLevel = parseInt(value);
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('保存时自动格式化')
            .setDesc('启用此选项将在保存文件时自动应用格式化')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoFormatOnSave)
                .onChange(async (value) => {
                    this.plugin.settings.autoFormatOnSave = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('标准化列表格式')
            .setDesc('统一列表的标记符号')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.standardizeListFormat)
                .onChange(async (value) => {
                    this.plugin.settings.standardizeListFormat = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('调整空行')
            .setDesc('统一文档中的空行数量')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.adjustEmptyLines)
                .onChange(async (value) => {
                    this.plugin.settings.adjustEmptyLines = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('格式化表格')
            .setDesc('美化表格的显示格式')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.formatTables)
                .onChange(async (value) => {
                    this.plugin.settings.formatTables = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('标准化链接和图片语法')
            .setDesc('统一链接和图片的Markdown语法')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.standardizeLinksAndImages)
                .onChange(async (value) => {
                    this.plugin.settings.standardizeLinksAndImages = value;
                    await this.plugin.saveSettings();
                }));
    }
}

class FormatPreviewModal extends Modal {
    constructor(app: App, private plugin: MarkdownMasterPlugin, private file: TFile, private content: string) {
        super(app);
    }

    onOpen() {
        const {contentEl} = this;
        contentEl.empty(); // 清空现有内容
        contentEl.createEl('h2', {text: '格式化预览'}); // 使用 createEl 创建标题
        const previewEl = contentEl.createDiv({cls: 'markdown-preview'}); // 正确使用 createDiv
        const formattedContent = this.plugin.applyFormatting(this.content);
        
        // 使用 Obsidian 的 MarkdownRenderer
        (this.app as any).markdownRenderer.renderMarkdown(formattedContent, previewEl, this.file.path, this);

        new Setting(contentEl)
            .addButton((btn) =>
                btn
                    .setButtonText('应用格式化')
                    .setCta()
                    .onClick(async () => {
                        await this.plugin.app.vault.modify(this.file, formattedContent);
                        this.close();
                    }));
    }

    onClose() {
        const {contentEl} = this;
        contentEl.empty();
    }
}