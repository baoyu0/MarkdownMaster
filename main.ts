import { App, Plugin, MarkdownView, Notice, Modal, Setting } from 'obsidian';

export default class MarkdownMasterPlugin extends Plugin {
    private lastContent: string = '';

    async onload() {
        console.log('加载 Markdown Master 插件');

        this.addRibbonIcon('pencil', 'Markdown Master', (evt: MouseEvent) => {
            this.showFormatOptions();
        });

        this.addCommand({
            id: 'format-markdown',
            name: '格式化当前Markdown文件',
            checkCallback: (checking: boolean) => {
                const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
                if (markdownView) {
                    if (!checking) {
                        this.showFormatOptions();
                    }
                    return true;
                }
                return false;
            }
        });

        this.addCommand({
            id: 'undo-format',
            name: '撤销上次格式化',
            checkCallback: (checking: boolean) => {
                if (this.lastContent) {
                    if (!checking) {
                        this.undoFormat();
                    }
                    return true;
                }
                return false;
            }
        });
    }

    onunload() {
        console.log('卸载 Markdown Master 插件');
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

    formatMarkdown(content: string): string {
        let formatted = content;

        // 1. 删除符合特定格式的链接
        formatted = formatted.replace(/^\[(\d+)\]\s+(https?:\/\/\S+)$/gm, '');

        // 2. 把所有"##"转换成"#"
        formatted = formatted.replace(/^##/gm, '#');

        // 3. 删除所有"**"
        formatted = formatted.replace(/\*\*/g, '');

        // 4. 删除所有符合正则表达式"\[\d+\]"的内容
        formatted = formatted.replace(/\[\d+\]/g, '');

        // 保留其他原有的格式化规则
        formatted = formatted.replace(/^(#+)([^\s#])/gm, '$1 $2');
        formatted = formatted.replace(/^(\s*)-([^\s])/gm, '$1- $2');
        formatted = formatted.replace(/\n{3,}/g, '\n\n');
        formatted = formatted.replace(/^(\d+)\.([^\s])/gm, '$1. $2');
        formatted = formatted.trim();

        return formatted;
    }
}

class FormatPreviewModal extends Modal {
    private result: boolean;
    private originalContent: string;
    private formattedContent: string;
    private onSubmit: (result: boolean) => void;

    constructor(app: App, originalContent: string, formattedContent: string, onSubmit: (result: boolean) => void) {
        super(app);
        this.originalContent = originalContent;
        this.formattedContent = formattedContent;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const {contentEl} = this;

        contentEl.createEl('h2', {text: '预览格式化结果'});

        new Setting(contentEl)
            .setName('原始内容')
            .setDesc('格式化前的内容')
            .addTextArea(text => text
                .setValue(this.originalContent)
                .setDisabled(true));

        new Setting(contentEl)
            .setName('格式化后内容')
            .setDesc('格式化后的内容')
            .addTextArea(text => text
                .setValue(this.formattedContent)
                .setDisabled(true));

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
        const {contentEl} = this;
        contentEl.empty();
        this.onSubmit(this.result);
    }
}