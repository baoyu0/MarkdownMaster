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

        this.addCommand({
            id: 'test-format',
            name: '测试Markdown格式化',
            callback: () => this.testFormat(),
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

    testFormat() {
        const testContent = `
## 这是一个二级标题
这是一些普通文本，包含**粗体**和*斜体*。

- 这是一个列表项
-这是一个没有空格的列表项

这是一个引用[1]，还有另一个引用[2]。

1. 这是一个有序列表
2.这是一个没有空格的有序列表项

### 这是一个三级标题
        `;

        const formattedContent = this.formatMarkdown(testContent);
        new TestFormatModal(this.app, testContent, formattedContent).open();
    }

    formatMarkdown(content: string): string {
        let formatted = content;

        // 应用格式化规则
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

class TestFormatModal extends Modal {
    private originalContent: string;
    private formattedContent: string;

    constructor(app: App, originalContent: string, formattedContent: string) {
        super(app);
        this.originalContent = originalContent;
        this.formattedContent = formattedContent;
    }

    onOpen() {
        const {contentEl} = this;

        contentEl.createEl('h2', {text: '格式化测试结果'});

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
                .setButtonText('关闭')
                .setCta()
                .onClick(() => this.close()));
    }

    onClose() {
        const {contentEl} = this;
        contentEl.empty();
    }
}