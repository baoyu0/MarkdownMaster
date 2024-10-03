import { App, Plugin, PluginSettingTab, Setting, MarkdownView, TFile, DropdownComponent } from 'obsidian';

// 添加这个接口定义
interface MenuItem {
    setTitle(title: string): MenuItem;
    setIcon(icon: string): MenuItem;
    onClick(callback: () => void): MenuItem;
}

interface MarkdownMasterSettings {
    defaultHeadingLevel: number;
    autoFormatOnSave: boolean;
    // 添加更多相关设置
}

const DEFAULT_SETTINGS: MarkdownMasterSettings = {
    defaultHeadingLevel: 2,
    autoFormatOnSave: false,
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
        // 实现格式化逻辑
        const content = await this.app.vault.read(file);
        const formattedContent = this.applyFormatting(content);
        await this.app.vault.modify(file, formattedContent);
    }

    applyFormatting(content: string): string {
        // 在这里实现具体的格式化逻辑
        // 例如：标准化标题级别、调整空行、格式化列表等
        // 这里只是一个简单的示例
        return content.replace(/^(#+)\s/gm, (match, p1) => {
            return '#'.repeat(this.settings.defaultHeadingLevel) + ' ';
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
    }
}