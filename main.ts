import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';

interface MarkdownMasterSettings {
    exampleSetting: string;
    // 添加其他设置项
}

const DEFAULT_SETTINGS: MarkdownMasterSettings = {
    exampleSetting: '',
    // 设置其他默认值
};

export default class MarkdownMasterPlugin extends Plugin {
    settings!: MarkdownMasterSettings;

    async onload() {
        console.log('Loading MarkdownMaster plugin');

        this.settings = Object.assign({}, DEFAULT_SETTINGS);
        await this.loadSettings();

        // 添加设置选项卡
        this.addSettingTab(new MarkdownMasterSettingTab(this.app, this));

        // 添加功能
        this.addCommands();
        
        // 其他初始化代码...
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    addCommands() {
        // 添加命令
        this.addCommand({
            id: 'format-markdown',
            name: 'Format Markdown',
            callback: () => {
                // 格式化逻辑
            },
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

        containerEl.createEl('h2', {text: 'Markdown Master Settings'});

        // 添加设置选项
        new Setting(containerEl)
            .setName('Example setting')
            .setDesc('This is an example setting.')
            .addTextArea(text => text
                .setPlaceholder('Enter a value')
                .setValue(this.plugin.settings.exampleSetting)
                .onChange(async (value) => {
                    this.plugin.settings.exampleSetting = value;
                    await this.plugin.saveSettings();
                }));
    }
}