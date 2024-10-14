import { App, Plugin, PluginSettingTab, Setting, Notice, MarkdownView, Modal, TFile, EventRef, ToggleComponent, TextAreaComponent } from 'obsidian';
import { diffChars, Change } from 'diff';
import Prism from 'prismjs';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-markup';
import prettier from 'prettier/standalone';
import parserBabel from 'prettier/parser-babel';
import parserTypescript from 'prettier/parser-typescript';
import parserCss from 'prettier/parser-postcss';
import parserHtml from 'prettier/parser-html';
import parserMarkdown from 'prettier/parser-markdown';
// 根据需要添加更多语言

const ruleFunctions: { [key: string]: (content: string) => string } = {
    headings: (content: string) => {
        return content.replace(/^(#+)\s*(.*?)$/gm, (match, hashes, title) => {
            return `${hashes} ${title.trim()}`;
        });
    },
    lists: (content: string) => {
        return content.replace(/^(\s*[-*+])\s*(.*?)$/gm, (match, bullet, item) => {
            return `${bullet} ${item.trim()}`;
        });
    },
    // 可以根据需要添加更多函数
};

interface FormatRule {
    id: string;
    name: string;
    enabled: boolean;
    priority: number;
    apply: (content: string) => string;
    applyId?: string; // 添加这一行
}

interface MarkdownMasterSettings {
    formatOptions: {
        content: FormatContentOptions;
        structure: FormatStructureOptions;
        style: FormatStyleOptions;
        advanced: FormatAdvancedOptions;
    };
    formatYAMLFrontMatter: boolean;
    formatMathEquations: boolean;
    formatCustomCSSClasses: boolean;
    formatRules: FormatRule[];
}

interface FormatContentOptions {
    enableRegexReplacement: boolean;
    regexReplacements: Array<{ regex: string; replacement: string; description: string; enabled: boolean }>;
    // ... 其他内容相关选项 ...
}

interface FormatStructureOptions {
    enableHeadingConversion: boolean;
    headingConversionRules: { [key: string]: number };
    enableCascadingConversion: boolean;
    // ... 其他结构相关选项 ...
}

interface FormatStyleOptions {
    enableBoldRemoval: boolean;
    enableTableFormat: boolean;
    enableListIndentFormat: boolean;
    enableLinkFormat: boolean;
    enableBlockquoteFormat: boolean;
}

interface FormatAdvancedOptions {
    customRegexRules: { pattern: string; replacement: string }[];
    enableAutoFormat: boolean;
    enableCodeHighlight: boolean;
    enableImageOptimization: boolean;
    enableYamlMetadataFormat: boolean;
    enableMathFormat: boolean;
    enableCustomCssClassFormat: boolean;
    enableAdvancedCodeBlockProcessing: boolean;
}

const DEFAULT_SETTINGS: MarkdownMasterSettings = {
    formatOptions: {
        content: {
            enableRegexReplacement: true,
            regexReplacements: [
                {
                    regex: '\\[\\d+\\]\\s+(https?:\\/\\/\\S+)',
                    replacement: '',
                    description: '删除带数字的链接',
                    enabled: true
                }
            ],
        },
        structure: {
            enableHeadingConversion: true,
            enableCascadingConversion: true, // 新增选项
            headingConversionRules: {
                1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0
            },
        },
        style: {
            enableBoldRemoval: true,
            enableTableFormat: true,
            enableListIndentFormat: true,
            enableLinkFormat: true,
            enableBlockquoteFormat: true,
        },
        advanced: {
            customRegexRules: [],
            enableAutoFormat: false,
            enableCodeHighlight: true,
            enableImageOptimization: true,
            enableYamlMetadataFormat: false,
            enableMathFormat: false,
            enableCustomCssClassFormat: false,
            enableAdvancedCodeBlockProcessing: true,
        },
    },
    formatYAMLFrontMatter: true,
    formatMathEquations: true,
    formatCustomCSSClasses: true,
    formatRules: [
        {
            id: 'headings',
            name: '标题格式化',
            enabled: true,
            priority: 100,
            applyId: 'headings',
            apply: ruleFunctions['headings']
        },
        {
            id: 'lists',
            name: '列表格式化',
            enabled: true,
            priority: 90,
            applyId: 'lists',
            apply: ruleFunctions['lists']
        },
        // ... 添加更多格式化规则 ...
    ]
};

const REGEX_PRESETS = [
    {
        name: '删除多余空行',
        regex: '\n{3,}',
        replacement: '\n\n',
        description: '将连续的3个或更多空行替换为2个空行'
    },
    {
        name: '格式化标题空格',
        regex: '^(#+)([^\s#])',
        replacement: '$1 $2',
        description: '确保标题符号(#)后有一个空格'
    },
    {
        name: '格式化列表项空格',
        regex: '^(\\s*[-*+])([^\s])',
        replacement: '$1 $2',
        description: '确保列表项符号有空格'
    },
    {
        name: '删除行尾空格',
        regex: '[ \t]+$',
        replacement: '',
        description: '删除每行末尾的空格制表符'
    },
    {
        name: 'URL链',
        regex: '(https?://\\S+)(?=[\\s)])',
        replacement: '[$1]($1)',
        description: '将纯文本URL转换为Markdown链接格式'
    }
];

// 在文件开头添加这个类型声明
import { Workspace } from 'obsidian';
type WorkspaceEvents = keyof typeof Workspace.prototype.on;

// 定义 ExtendedPlugin 接口
interface ExtendedPlugin extends Plugin {
    addStatusBarItem(): HTMLElement;
}

export default class MarkdownMasterPlugin extends Plugin implements ExtendedPlugin {
    settings!: MarkdownMasterSettings;
    private lastContent: string = "";
    private formatHistory!: FormatHistory;
    private fileOpenRef: EventRef | null = null;
    private originalContent: string = ""; // 新增：存储原始内容
    private markdownLintErrors: Array<{ line: number; message: string }> = [];
    private cache: Map<string, string> = new Map();
    private worker: Worker | null = null;

    async onload() {
        console.log('Loading MarkdownMaster plugin');
        try {
            await this.loadSettings();
            console.log('Settings loaded');

            // 确保所有格式化规则都有有效的 apply 函数
            this.settings.formatRules = this.settings.formatRules.map(rule => {
                if (typeof rule.apply !== 'function') {
                    console.warn(`Rule ${rule.id} does not have a valid apply function. Using default.`);
                    return {
                        ...rule,
                        apply: (content: string) => content // 默认不做任何改变
                    };
                }
                return rule;
            });
            console.log('Format rules processed');

            // 确保 headingConversionRules 被正确初始化
            if (!this.settings.formatOptions.structure.headingConversionRules) {
                this.settings.formatOptions.structure.headingConversionRules = {
                    1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0
                };
                await this.saveSettings();
            }
            console.log('Heading conversion rules initialized');

            this.formatHistory = new FormatHistory();
            this.addSettingTab(new MarkdownMasterSettingTab(this.app, this));

            this.addRibbonIcon("pencil", "Markdown Master", (evt) => {
                this.showFormatOptions();
            });

            this.addCommand({
                id: 'format-markdown',
                name: '格式化当Markdown文件',
                callback: () => this.showFormatOptions()
            });

            this.addCommand({
                id: 'undo-format',
                name: '撤销上次格式化',
                callback: () => this.undoFormat()
            });

            this.addCommand({
                id: 'batch-format-markdown',
                name: '批量格式化所有Markdown文件',
                callback: () => this.batchFormat()
            });

            this.addCommand({
                id: 'show-format-history',
                name: '示格式化历史记录',
                callback: () => this.showFormatHistory()
            });

            // 修改自动格式化功能件注册
            if (this.settings.formatOptions.advanced.enableAutoFormat) {
                this.fileOpenRef = this.registerEvent(
                    this.app.workspace.on('file-open' as WorkspaceEvents, (file: TFile) => {
                        if (file && file.extension === 'md') {
                            this.autoFormatFile(file);
                        }
                    })
                ) as unknown as EventRef;
            }

            // 添加文本统计命令
            this.addCommand({
                id: 'show-text-statistics',
                name: '显示文本统计',
                callback: () => this.showTextStatistics()
            });

            // 添加的命令：撤销所有更改
            this.addCommand({
                id: 'revert-all-changes',
                name: '撤销有格更改',
                callback: () => this.revertAllChanges()
            });

            // 添加新的命令：预览格式化效果
            this.addCommand({
                id: 'preview-format',
                name: '预览格式化效果',
                callback: () => this.previewFormat()
            });

            // 添加新的命令
            this.addCommand({
                id: 'check-markdown-syntax',
                name: '检查Markdown语法',
                callback: () => this.checkMarkdownSyntax()
            });

            // 添加自定义 CSS
            this.addStyle(`
                .markdown-master-preview-container {
                    max-height: 60vh;
                    overflow-y: auto;
                    border: 1px solid var(--background-modifier-border);
                    padding: 10px;
                    margin-bottom: 20px;
                }
                .markdown-master-diff-preview pre {
                    white-space: pre-wrap;
                    word-wrap: break-word;
                }
                .markdown-master-diff-added {
                    background-color: #e6ffed;
                    color: #24292e;
                }
                .markdown-master-diff-removed {
                    background-color: #ffeef0;
                    color: #24292e;
                    text-decoration: line-through;
                }
                .markdown-master-regex-help {
                    margin-left: 10px;
                    text-decoration: none;
                    cursor: pointer;
                }

                .markdown-master-regex-help:hover {
                    text-decoration: underline;
                }

                .regex-test-output {
                    margin-top: 20px;
                    padding: 10px;
                    border: 1px solid var(--background-modifier-border);
                    border-radius: 5px;
                }

                .regex-test-output pre {
                    white-space: pre-wrap;
                    word-wrap: break-word;
                }

                .markdown-master-nested-settings {
                    margin-left: 20px;
                    border-left: 2px solid var(--background-modifier-border);
                    padding-left: 20px;
                }

                .markdown-master-regex-rule {
                    margin-bottom: 20px;
                    padding: 10px;
                    border: 1px solid var(--background-modifier-border);
                    border-radius: 5px;
                }

                .markdown-master-regex-rule .setting-item {
                    border-top: none;
                    padding-top: 0;
                }

                .markdown-master-regex-buttons {
                    display: flex;
                    justify-content: flex-end;
                    margin-top: 10px;
                }

                .markdown-master-regex-buttons button {
                    margin-left: 10px;
                }

                .markdown-lint-gutter-marker {
                    color: orange;
                    font-size: 18px;
                    cursor: pointer;
                }

                .markdown-lint-underline {
                    text-decoration: wavy underline orange;
                }

                /* 在这里添加 Prism.js 的基本样式 */
                code[class*="language-"],
                pre[class*="language-"] {
                    color: #000;
                    background: none;
                    text-shadow: 0 1px white;
                    font-family: Consolas, Monaco, 'Andale Mono', 'Ubuntu Mono', monospace;
                    font-size: 1em;
                    text-align: left;
                    white-space: pre;
                    word-spacing: normal;
                    word-break: normal;
                    word-wrap: normal;
                    line-height: 1.5;
                    -moz-tab-size: 4;
                    -o-tab-size: 4;
                    tab-size: 4;
                    -webkit-hyphens: none;
                    -moz-hyphens: none;
                    -ms-hyphens: none;
                    hyphens: none;
                }
                /* 添加多必要的 Prism.js 样式 */
            `);

            // 初始化 Web Worker
            this.initWorker();

            // 添加新的命令：批量格式化（使用分块处理）
            this.addCommand({
                id: 'batch-format-markdown-chunked',
                name: '批量格式化所有Markdown文件（分块处理）',
                callback: () => this.batchFormatChunked()
            });

            console.log('MarkdownMaster plugin loaded successfully');
        } catch (error) {
            console.error('Error loading MarkdownMaster plugin:', error);
        }
    }

    onunload() {
        if (this.worker) {
            this.worker.terminate();
        }
    }

    async loadSettings() {
        const loadedData = await this.loadData();
        this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);

        // 根据 applyId 应用正确的函数
        this.settings.formatRules = this.settings.formatRules.map(rule => ({
            ...rule,
            apply: rule.applyId && ruleFunctions[rule.applyId] 
                ? ruleFunctions[rule.applyId] 
                : (rule.apply || ((content: string) => content))
        }));

        // 确保 regexReplacements 数组存在
        if (!this.settings.formatOptions.content.regexReplacements) {
            this.settings.formatOptions.content.regexReplacements = [];
        }

        await this.saveSettings();
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    private showNotice(message: string, timeout: number = 4000) {
        new Notice(message, timeout);
    }

    // 初始化 Web Worker
    private initWorker() {
        if (typeof Worker !== 'undefined') {
            // 使用 Blob URL 创建 Web Worker
            const workerCode = `
                self.onmessage = async (event) => {
                    const { content, settings } = event.data;
                    // 在这里现格式化逻
                    let formatted = content;
                    // 应用各种格式化规则...
                    // 注：这应与 formatMarkdownDirectly 方法相同逻辑
                    self.postMessage(formatted);
                };
            `;
            const blob = new Blob([workerCode], { type: 'application/javascript' });
            const workerUrl = URL.createObjectURL(blob);
            this.worker = new Worker(workerUrl);
            
            this.worker.onmessage = (event: MessageEvent) => {
                // 处理来自 Worker 的消息
                console.log('Received from worker:', event.data);
            };
            this.worker.onerror = (error) => {
                console.error('Worker error:', error);
            };
        }
    }

    // 使用 Web Worker 进行格式化
    private formatWithWebWorker(content: string): Promise<string> {
        return new Promise((resolve, reject) => {
            if (!this.worker) {
                reject(new Error('Web Worker not initialized'));
                return;
            }
            const messageHandler = (event: MessageEvent) => {
                this.worker!.removeEventListener('message', messageHandler);
                resolve(event.data);
            };
            this.worker.addEventListener('message', messageHandler);
            this.worker.postMessage({ content, settings: this.settings });
        });
    }

    // 分块理大文件
    async formatLargeFile(file: TFile) {
        const chunkSize = 1024 * 1024; // 1MB
        let offset = 0;
        let formattedContent = '';

        const fileContent = await this.app.vault.read(file);
        const totalSize = fileContent.length;

        while (offset < totalSize) {
            const chunk = fileContent.slice(offset, offset + chunkSize);
            formattedContent += await this.formatMarkdown(chunk);
            offset += chunkSize;

            // 更新进度
            this.updateProgress(offset, totalSize);
        }

        await this.app.vault.modify(file, formattedContent);
    }

    // 批格化（使用分块处理）
    async batchFormatChunked() {
        const files = this.app.vault.getMarkdownFiles();
        const totalFiles = files.length;
        let processedFiles = 0;

        for (const file of files) {
            await this.formatLargeFile(file);
            processedFiles++;
            this.updateProgress(processedFiles, totalFiles);
        }
        new Notice('批量格式化完成');
    }

    // 更进
    private updateProgress(current: number, total: number) {
        const percent = Math.round((current / total) * 100);
        const statusBarItem = (this as any).addStatusBarItem();
        statusBarItem.textContent = `格式化进度: ${percent}%`;
        if (percent === 100) {
            setTimeout(() => statusBarItem.remove(), 2000);
        }
    }

    // 使用缓存优化格式化
    private async getCachedOrFormat(content: string): Promise<string> {
        const hash = this.hashContent(content);
        if (this.cache.has(hash)) {
            return this.cache.get(hash)!;
        }
        const formatted = await this.formatMarkdownDirectly(content);
        this.cache.set(hash, formatted);
        return formatted;
    }

    private hashContent(content: string): string {
        return content.length + content.slice(0, 100);
    }

    // 异步处理格式化
    async formatMarkdown(content: string): Promise<string> {
        let formatted = content;
        
        // 按优先级排序规则
        const sortedRules = this.settings.formatRules
            .filter(rule => rule.enabled)
            .sort((a, b) => b.priority - a.priority);

        // 应用每个启用的规则
        for (const rule of sortedRules) {
            if (typeof rule.apply === 'function') {
                try {
                    formatted = rule.apply(formatted);
                } catch (error) {
                    console.error(`Error applying rule ${rule.id}:`, error);
                    // 可以选择在这里显示一知给用户
                    new Notice(`格式化规则 "${rule.name}" 应用失败`);
                }
            } else {
                console.warn(`Rule ${rule.id} does not have a valid apply function. Skipping.`);
            }
        }

        return formatted;
    }

    private async formatMarkdownDirectly(content: string): Promise<string> {
        let formatted = content;
        
        // YAML 前置元据格式化
        formatted = this.formatYAMLFrontMatter(formatted);
        
        // 数学公式格式化
        formatted = this.formatMathEquations(formatted);
        
        // 自定义 CSS 类格式化
        formatted = this.formatCustomCSSClasses(formatted);
        
        // 高级代码块处理
        if (this.settings.formatOptions.advanced.enableAdvancedCodeBlockProcessing) {
            formatted = await this.processCodeBlocks(formatted);
        }
        
        // 图片优化
        formatted = this.optimizeImages(formatted);
        
        // 其他格式化规则...
        
        return formatted;
    }

    private async processCodeBlocks(content: string): Promise<string> {
        const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
        
        const promises: Promise<string>[] = [];
        let lastIndex = 0;
        let match;

        while ((match = codeBlockRegex.exec(content)) !== null) {
            const [fullMatch, language, code] = match;
            const beforeCode = content.slice(lastIndex, match.index);
            promises.push(Promise.resolve(beforeCode));

            if (!language) {
                promises.push(Promise.resolve(fullMatch));
            } else {
                const formattedCodePromise = this.formatCodeWithPrettier(code, language)
                    .then(formattedCode => this.highlightCode(formattedCode, language))
                    .then(highlightedCode => `\`\`\`${language}\n${highlightedCode}\n\`\`\``);
                promises.push(formattedCodePromise);
            }

            lastIndex = match.index + fullMatch.length;
        }

        promises.push(Promise.resolve(content.slice(lastIndex)));

        const results = await Promise.all(promises);
        return results.join('');
    }

    private async formatCodeWithPrettier(code: string, language: string): Promise<string> {
        try {
            const parser = this.getPrettierParser(language);
            if (!parser) {
                return code; // 如果没有对应的解析器，返回原始代码
            }

            return await prettier.format(code, {
                parser: parser,
                plugins: [parserBabel, parserTypescript, parserCss, parserHtml, parserMarkdown],
                semi: true,
                singleQuote: true,
                tabWidth: 4,
                printWidth: 100,
            });
        } catch (error) {
            console.error('Prettier formatting error:', error);
            return code; // 如果格化失败，返回原始代码
        }
    }

    private getPrettierParser(language: string): string | undefined {
        switch (language.toLowerCase()) {
            case 'javascript':
            case 'js':
                return 'babel';
            case 'typescript':
            case 'ts':
                return 'typescript';
            case 'css':
                return 'css';
            case 'html':
                return 'html';
            case 'markdown':
            case 'md':
                return 'markdown';
            default:
                return undefined;
        }
    }

    private highlightCode(code: string, language: string): string {
        // 这里我们使用 Prism.js 进行语法高亮
        // 注意：你需要确保已经正确引入了 Prism.js 及其样式
        if (Prism.languages[language]) {
            return Prism.highlight(code, Prism.languages[language], language);
        }
        return code; // 如果没有对应的语言定义，返回原始代码
    }

    async showFormatOptions() {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) {
            new Notice('请打开一个Markdown文件');
            return;
        }

        const content = activeView.editor.getValue();
        const formattedContent = await this.formatMarkdown(content);

        new FormatPreviewModal(this.app, content, formattedContent, async (result) => {
            if (result) {
                this.lastContent = content;
                activeView.editor.setValue(formattedContent);
                new Notice('Markdown文件已格式化');
                this.formatHistory.addToHistory(content);
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
            new Notice('没有可撤销式操作');
        }
    }

    async batchFormat() {
        const files = this.app.vault.getMarkdownFiles();
        for (const file of files) {
            const content = await this.app.vault.read(file);
            const formattedContent = await this.formatMarkdown(content);
            await this.app.vault.modify(file, formattedContent);
        }
        new Notice('批量格式化完成');
    }

    showFormatHistory() {
        const history = this.formatHistory.getHistory();
        new FormatHistoryModal(this.app, history, (selectedContent) => {
            const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (activeView) {
                activeView.editor.setValue(selectedContent);
            }
        }).open();
    }

    // 修表格格式化函数，使用 String.prototype.padEnd 的替代方法
    formatTables(content: string): string {
        const tableRegex = /\|(.+)\|/g;
        return content.replace(tableRegex, (match) => {
            const cells = match.split('|').map(cell => cell.trim());
            const maxLength = Math.max(...cells.map(cell => cell.length));
            return cells.map(cell => `| ${this.padEndPolyfill(cell, maxLength)} `).join('') + '|';
        });
    }

    // 添加 padEnd 的替代方法
    padEndPolyfill(str: string, targetLength: number, padString: string = ' '): string {
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

    // 新增的代码块高亮函数
    private highlightCodeBlocks(content: string): string {
        const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
        return content.replace(codeBlockRegex, (match, lang, code) => {
            let highlightedCode = code;
            let language = lang || 'plaintext';

            // 优化缩进
            highlightedCode = this.optimizeIndentation(highlightedCode);

            // 应用语法高亮
            if (Prism.languages[language]) {
                highlightedCode = Prism.highlight(highlightedCode, Prism.languages[language], language);
            }

            return `<pre><code class="language-${language}">${highlightedCode}</code></pre>`;
        });
    }

    private optimizeIndentation(code: string): string {
        const lines = code.split('\n');
        const minIndent = lines.reduce((min, line) => {
            const match = line.match(/^\s*/);
            const indent = match ? match[0].length : 0;
            return line.trim().length > 0 ? Math.min(min, indent) : min;
        }, Infinity);

        return lines.map(line => line.slice(minIndent)).join('\n');
    }

    // 新增的图链接化函数
    optimizeImageLinks(content: string): string {
        const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
        return content.replace(imageRegex, (match, alt, url) => {
            const optimizedUrl = url.replace(/^http:/, 'https:');
            return `![${alt}](${optimizedUrl})`;
        });
    }

    // 新增的自动格式化函数
    async autoFormatFile(file: TFile) {
        if (file.extension !== 'md') return;
        const content = await this.app.vault.read(file);
        const formattedContent = await this.formatMarkdown(content);
        if (content !== formattedContent) {
            await this.app.vault.modify(file, formattedContent);
            new Notice(`已自动格式化文件: ${file.name}`);
        }
    }

    // 新文本计函数
    showTextStatistics() {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) {
            new Notice('请打开一个Markdown文件');
            return;
        }

        const content = activeView.editor.getValue();
        const wordCount = content.split(/\s+/).length;
        const charCount = content.length;
        const lineCount = content.split('\n').length;

        new TextStatisticsModal(this.app, wordCount, charCount, lineCount).open();
    }

    // 在类添加个辅助方法
    private addStyle(cssString: string) {
        const css = document.createElement('style');
        css.id = 'markdown-master-styles';
        css.textContent = cssString;
        document.head.append(css);
    }

    // 新增的辅助方法
    private formatListIndent(content: string): string {
        // 实现列表缩进格式化逻辑
        return content.replace(/^(\s*[-*+])\s+/gm, '$1 ');
    }

    private formatLinks(content: string): string {
        // 实链接格式化逻辑
        return content.replace(/\[(.*?)\]\((.*?)\)/g, '[$1]($2)');
    }

    private formatBlockquotes(content: string): string {
        // 实引用块格式化逻辑
        return content.replace(/^>\s*/gm, '> ');
    }

    private formatYamlMetadata(content: string): string {
        // 实现YAML前置元数据格式化逻辑
        // 这里只是一个简单的示例,实际实可能需要更复杂的逻辑
        const yamlRegex = /^---\n([\s\S]*?)\n---/;
        return content.replace(yamlRegex, (match, yaml) => {
            const formattedYaml = yaml.split('\n').map((line: string) => line.trim()).join('\n');
            return `---\n${formattedYaml}\n---`;
        });
    }

    private formatMathEquations(content: string): string {
        if (!this.settings.formatMathEquations) {
            return content;
        }

        const inlineMathRegex = /\$(.+?)\$/g;
        const blockMathRegex = /\$\$([\s\S]+?)\$\$/g;

        // 格式化行内数学公式
        content = content.replace(inlineMathRegex, (match, equation) => {
            return `$${this.formatEquation(equation)}$`;
        });

        // 格式化块级数学公式
        content = content.replace(blockMathRegex, (match, equation) => {
            const formattedEquation = equation.split('\n')
                .map((line: string) => this.formatEquation(line.trim()))
                .join('\n');
            return `$$\n${formattedEquation}\n$$`;
        });

        return content;
    }

    private formatEquation(equation: string): string {
        // 移除多余的空格
        equation = equation.replace(/\s+/g, ' ').trim();

        // 在运算符周围添加空格
        equation = equation.replace(/([+\-*\/=<>])/g, ' $1 ');

        // 移除括号内部的空格
        equation = equation.replace(/\(\s*(.+?)\s*\)/g, '($1)');

        // 修复分数格式
        equation = equation.replace(/\\frac\s*{(.+?)}\s*{(.+?)}/g, '\\frac{$1}{$2}');

        // 其他特定的LaTeX格式化规则可以在这里添加

        return equation.trim();
    }

    private formatCustomCSSClasses(content: string): string {
        if (!this.settings.formatCustomCSSClasses) {
            return content;
        }

        const cssClassRegex = /\{([^}]+)\}/g;
        return content.replace(cssClassRegex, (match, classes) => {
            const formattedClasses = classes
                .split(' ')
                .map((cls: string) => cls.trim())
                .filter((cls: string) => cls !== '')
                .join(' ');
            return `{${formattedClasses}}`;
        });
    }

    toggleAutoFormat(enable: boolean) {
        if (enable) {
            this.fileOpenRef = this.registerEvent(
                this.app.workspace.on('file-open' as WorkspaceEvents, (file: TFile) => {
                    if (file && file.extension === 'md') {
                        this.autoFormatFile(file);
                    }
                })
            ) as unknown as EventRef;
        } else if (this.fileOpenRef) {
            this.app.workspace.offref(this.fileOpenRef);
            this.fileOpenRef = null;
        }
    }

    // 新方法：撤销有更改
    async revertAllChanges() {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView) {
            const editor = activeView.editor;
            if (this.originalContent) {
                editor.setValue(this.originalContent);
                new Notice('已恢复到原始状态');
            } else {
                new Notice('没有可复的原始内');
            }
        }
    }

    // 新增方法：预览格式化效果
    async previewFormat() {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView) {
            const editor = activeView.editor;
            const currentContent = editor.getValue();
            this.originalContent = currentContent; // 保存原始内容

            const formattedContent = await this.formatMarkdown(currentContent);
            
            new FormatPreviewModal(this.app, currentContent, formattedContent, async (confirmed) => {
                if (confirmed) {
                    editor.setValue(formattedContent);
                    new Notice('已应用格式化');
                } else {
                    new Notice('已取消格式化');
                }
            }).open();
        }
    }

    async checkMarkdownSyntax() {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) {
            new Notice('请打开一个Markdown文件');
            return;
        }

        const content = activeView.editor.getValue();
        const lines = content.split('\n');

        this.markdownLintErrors = [];

        lines.forEach((line, index) => {
            // 现有的检查规则...

            // 新增规则：检查标题层级跳跃
            if (line.startsWith('#')) {
                const match = line.match(/^#+/);
                if (match) {
                    const currentLevel = match[0].length;
                    if (index > 0) {
                        const prevLine = lines[index - 1];
                        if (prevLine.startsWith('#')) {
                            const prevMatch = prevLine.match(/^#+/);
                            if (prevMatch) {
                                const prevLevel = prevMatch[0].length;
                                if (currentLevel > prevLevel + 1) {
                                    this.markdownLintErrors.push({ line: index + 1, message: '标题层级不应跳跃，建议逐级递增' });
                                }
                            }
                        }
                    }
                }
            }

            // 检查行长度
            if (line.length > 120) {
                this.markdownLintErrors.push({ line: index + 1, message: '行长度超过120个字符，建议换行' });
            }

            // 检查重复的标点符号
            if (/[，。！？]{2,}/.test(line)) {
                this.markdownLintErrors.push({ line: index + 1, message: '存在复的标点符号' });
            }

            // 检查空白后的
            if (index > 0 && lines[index - 1].trim() === '' && line.startsWith(' ')) {
                this.markdownLintErrors.push({ line: index + 1, message: '空白行后不应有缩进' });
            }

            // 查代码块的语标记
            if (line.startsWith('```') && line.trim().length > 3) {
                const language = line.trim().slice(3);
                const validLanguages = ['js', 'javascript', 'ts', 'typescript', 'python', 'java', 'c', 'cpp', 'csharp', 'php', 'ruby', 'go', 'rust', 'swift', 'kotlin', 'scala', 'html', 'css', 'sql', 'bash', 'shell', 'powershell', 'yaml', 'json', 'xml', 'markdown', 'plaintext'];
                if (!validLanguages.includes(language.toLowerCase())) {
                    this.markdownLintErrors.push({ line: index + 1, message: `未知的代码块语言标记: ${language}` });
                }
            }

            // 检查任务列表格式
            if (/^\s*-\s+\[[ x]\]\s/.test(line)) {
                if (!/^\s*-\s+\[[ x]\]\s+\S/.test(line)) {
                    this.markdownLintErrors.push({ line: index + 1, message: '任务列表项后应有内容' });
                }
            }

            // 检查表格格式
            if (line.includes('|')) {
                const cells = line.split('|').map(cell => cell.trim());
                if (cells.some(cell => cell === '')) {
                    this.markdownLintErrors.push({ line: index + 1, message: '表格单元格不应为空' });
                }
            }
        });

        if (this.markdownLintErrors.length > 0) {
            this.showLintResults();
        } else {
            new Notice('未发现Markdown语法错误');
        }
    }

    showLintResults() {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) return;

        const editor = activeView.editor;

        // 添加新的标记
        this.markdownLintErrors.forEach(error => {
            const lineNumber = error.line - 1;
            const lineContent = this.getLineContent(editor, lineNumber);
            
            if (lineContent !== undefined) {
                // 添加装订线标记
                const gutterMarker = this.createGutterMarker(error.message);
                this.addGutterMarker(editor, lineNumber, "markdown-lint-gutter", gutterMarker);

                // 加下划线
                const from = { line: lineNumber, ch: 0 };
                const to = { line: lineNumber, ch: lineContent.length };
                this.addUnderline(editor, from, to, 'markdown-lint-underline');
            }
        });

        // 显示错误摘要
        new MarkdownLintModal(this.app, this.markdownLintErrors).open();
    }

    // 修改 addGutterMarker 方法
    private addGutterMarker(editor: any, line: number, gutterType: string, element: HTMLElement) {
        const lineInfo = editor.lineInfo(line);
        if (lineInfo) {
            editor.setGutterMarker(line, gutterType, element);
        }
    }

    // 修改 addUnderline 方法
    private addUnderline(editor: any, from: {line: number, ch: number}, to: {line: number, ch: number}, className: string) {
        editor.markText(from, to, { className: className });
    }

    // 修改 getLineContent 方法
    private getLineContent(editor: any, line: number): string | undefined {
        return editor.getRange(
            { line: line, ch: 0 },
            { line: line, ch: Number.MAX_SAFE_INTEGER }
        );
    }

    createGutterMarker(message: string): HTMLElement {
        const marker = document.createElement('div');
        marker.classList.add('markdown-lint-gutter-marker');
        marker.innerHTML = '⚠️';
        marker.setAttribute('aria-label', message);
        marker.setAttribute('title', message);
        return marker;
    }

    private optimizeImages(content: string): string {
        if (!this.settings.formatOptions.advanced.enableImageOptimization) {
            return content;
        }

        const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
        return content.replace(imageRegex, (match, alt, src) => {
            // 转换为相对路径（如果是本片）
            if (src.startsWith('http://') || src.startsWith('https://')) {
                // 对于网络图片，我们可以考虑使用 HTTPS
                src = src.replace(/^http:/, 'https:');
            } else {
                // 对于本地图片，我们可以尝试使用相对路径
                src = this.getRelativePath(src);
            }

            // 添加图片尺寸属性（如果没有的话）
            if (!src.includes('|')) {
                src += '|500x';  // 默认最大度为500像素
            }

            // 添加懒加载属性
            return `![${alt}](${src}){loading=lazy}`;
        });
    }

    private getRelativePath(path: string): string {
        // 这个方法需要根据 Obsidian 的文件结构来实现
        // 这里只是一个示例
        return path.replace(/^\//, './');
    }

    private formatYAMLFrontMatter(content: string): string {
        if (!this.settings.formatYAMLFrontMatter) {
            return content;
        }

        const yamlRegex = /^---\n([\s\S]*?)\n---/;
        return content.replace(yamlRegex, (match, yaml) => {
            const formattedYaml = yaml
                .split('\n')
                .map((line: string) => {
                    const [key, ...values] = line.split(':');
                    if (values.length) {
                        const value = values.join(':').trim();
                        return `${key.trim()}: ${value}`;
                    }
                    return line;
                })
                .join('\n');
            return `---\n${formattedYaml}\n---`;
        });
    }

    addStatusBarItem(): HTMLElement {
        return this.addStatusBarItem();
    }
}

class FormatPreviewModal extends Modal {
    private originalContent: string;
    private formattedContent: string;
    private onSubmit: (result: boolean) => void;
    private result: boolean = false;

    constructor(app: App, originalContent: string, formattedContent: string, onSubmit: (result: boolean) => void) {
        super(app);
        this.originalContent = originalContent;
        this.formattedContent = formattedContent;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: '预览格式化结果' });

        const previewContainer = contentEl.createEl('div', { cls: 'markdown-master-preview-container' });
        
        // 添加原始内容和格式化后内容的对比
        this.createComparisonView(previewContainer);

        // 添加差异视图
        this.createDiffView(previewContainer);

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
        const { contentEl } = this;
        contentEl.empty();
        this.onSubmit(this.result);
    }

    private createComparisonView(container: HTMLElement) {
        const comparisonDiv = container.createEl('div', { cls: 'markdown-master-comparison' });
        
        const originalDiv = comparisonDiv.createEl('div', { cls: 'markdown-master-original' });
        originalDiv.createEl('h3', { text: '原始内容' });
        originalDiv.createEl('pre').createEl('code', { text: this.originalContent });

        const formattedDiv = comparisonDiv.createEl('div', { cls: 'markdown-master-formatted' });
        formattedDiv.createEl('h3', { text: '格式化后内容' });
        formattedDiv.createEl('pre').createEl('code', { text: this.formattedContent });
    }

    private createDiffView(container: HTMLElement) {
        const diffDiv = container.createEl('div', { cls: 'markdown-master-diff' });
        diffDiv.createEl('h3', { text: '差异对比' });
        const diffPre = diffDiv.createEl('pre');
        const diffCode = diffPre.createEl('code');

        const diff = diffChars(this.originalContent, this.formattedContent);

        diff.forEach((part: Change) => {
            const span = diffCode.createEl('span');
            span.textContent = part.value;
            if (part.added) {
                span.classList.add('markdown-master-diff-added');
            } else if (part.removed) {
                span.classList.add('markdown-master-diff-removed');
            }
        });
    }
}

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
        contentEl.createEl('h2', { text: '格式化历记录' });

        this.history.forEach((content, index) => {
            new Setting(contentEl)
                .setName(`历史记录 ${index + 1}`)
                .addButton(btn => btn
                    .setButtonText('恢')
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

// 新增的文本统计模态框
class TextStatisticsModal extends Modal {
    private wordCount: number;
    private charCount: number;
    private lineCount: number;

    constructor(app: App, wordCount: number, charCount: number, lineCount: number) {
        super(app);
        this.wordCount = wordCount;
        this.charCount = charCount;
        this.lineCount = lineCount;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: '文本统计' });

        contentEl.createEl('p', { text: `单词数：${this.wordCount}` });
        contentEl.createEl('p', { text: `字符数：${this.charCount}` });
        contentEl.createEl('p', { text: `行数：${this.lineCount}` });
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

        this.addStructureFormatSettings(containerEl);
        this.addContentFormatSettings(containerEl);
        this.addStyleFormatSettings(containerEl);
        this.addAdvancedFormatSettings(containerEl);
        this.addFormatRulesPrioritySettings(containerEl);
    }

    addStructureFormatSettings(containerEl: HTMLElement) {
        containerEl.createEl('h3', { text: '结构格式化选项' });
        
        new Setting(containerEl)
            .setName('启用标题转换')
            .setDesc('根据下面的规则转换标级别')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.formatOptions.structure.enableHeadingConversion)
                .onChange(async (value) => {
                    this.plugin.settings.formatOptions.structure.enableHeadingConversion = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('级联标题转换')
            .setDesc('当转换某个级别的标题时，同步转换其所有子标题')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.formatOptions.structure.enableCascadingConversion)
                .onChange(async (value) => {
                    this.plugin.settings.formatOptions.structure.enableCascadingConversion = value;
                    await this.plugin.saveSettings();
                }));

        const tableContainer = containerEl.createEl('div', { cls: 'markdown-master-table' });
        const table = tableContainer.createEl('table');
        const headerRow = table.createEl('tr');
        headerRow.createEl('th', { text: '原标题级别' });
        headerRow.createEl('th', { text: '转换为' });

        for (let i = 1; i <= 6; i++) {
            const row = table.createEl('tr');
            const fromCell = row.createEl('td');
            fromCell.createEl('span', { text: `${i}级标题` });
            const toCell = row.createEl('td');
            
            (new Setting(toCell) as any)
                .addDropdown((dropdown: any) => {
                    dropdown
                        .addOptions({
                            '0': '不转换',
                            '1': '一级标题',
                            '2': '二级标题',
                            '3': '三级标题',
                            '4': '四级标题',
                            '5': '五级标题',
                            '6': '六级标题'
                        })
                        .setValue((this.plugin.settings.formatOptions.structure.headingConversionRules[i] ?? '0').toString())
                        .onChange(async (value: string) => {
                            if (!this.plugin.settings.formatOptions.structure.headingConversionRules) {
                                this.plugin.settings.formatOptions.structure.headingConversionRules = {};
                            }
                            this.plugin.settings.formatOptions.structure.headingConversionRules[i] = parseInt(value);
                            await this.plugin.saveSettings();
                        });
                });
        }
    }

    addContentFormatSettings(containerEl: HTMLElement) {
        console.log("开始添加内容格式化设置");
        const titleEl = containerEl.createEl('h3', { text: '正则表达式替换 ' });
        
        // 添加一个链接到正则表式说明文档
        const regexHelpLink = titleEl.createEl('a', {
            text: '📘',
            href: '#',
            cls: 'markdown-master-regex-help',
            attr: { 'aria-label': '正则表达式帮助' }
        });
        
        // 使用类型守卫来确保regexHelpLink是HTMLAnchorElement
        if (regexHelpLink instanceof HTMLAnchorElement) {
            regexHelpLink.addEventListener('click', (e: MouseEvent) => {
                e.preventDefault();
                this.showRegexHelpModal();
            });
        }
        
        new Setting(containerEl)
            .setName('启用正则表达式替换')
            .setDesc('使用自定义的正则表达式进行内容替换')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.formatOptions.content.enableRegexReplacement)
                .onChange(async (value) => {
                    console.log("切换正则表达式替换:", value);
                    this.plugin.settings.formatOptions.content.enableRegexReplacement = value;
                    await this.plugin.saveSettings();
                    this.display(); // 重新渲染整个设置页面
                }));

        if (this.plugin.settings.formatOptions.content.enableRegexReplacement) {
            console.log("正则表达替换已启用");
            const regexReplacementContainer = containerEl.createEl('div', { cls: 'markdown-master-nested-settings' });
            regexReplacementContainer.style.marginLeft = '20px';

            new Setting(regexReplacementContainer)
                .setName('添加新的正则表达式替换规则')
                .setDesc('添加多个正则表达式来匹配和替换不同的内容')
                .addButton(button => button
                    .setButtonText('添加新规则')
                    .onClick(() => {
                        console.log("点击添加新规则钮");
                        this.addNewRegexRule();
                    }));

            if (this.plugin.settings.formatOptions.content.regexReplacements) {
                console.log("当前规则数量:", this.plugin.settings.formatOptions.content.regexReplacements.length);
                this.plugin.settings.formatOptions.content.regexReplacements.forEach((regexObj, index) => {
                    this.createRegexRuleSetting(regexReplacementContainer, regexObj, index);
                });
            } else {
                console.log("regexReplacements 数组不在");
            }
        } else {
            console.log("则表达式替未启用");
        }
    }

    // 添加一个新方来显示正则表达式帮助模态框
    private showRegexHelpModal() {
        const modal = new RegexHelpModal(this.app);
        modal.open();
    }

    private async addNewRegexRule() {
        console.log("开始添加新规则");
        if (!this.plugin.settings.formatOptions.content.regexReplacements) {
            this.plugin.settings.formatOptions.content.regexReplacements = [];
        }
        this.plugin.settings.formatOptions.content.regexReplacements.push({ regex: '', replacement: '', description: '', enabled: true });
        await this.plugin.saveSettings();
        console.log("新规则已添加，当前规则数量:", this.plugin.settings.formatOptions.content.regexReplacements.length);
        this.display(); // 重新渲染整个设置页面
    }

    private createRegexRuleSetting(container: HTMLElement, regexObj: { regex: string; replacement: string; description: string; enabled: boolean }, index: number) {
        console.log("创建规则设置:", index);
        const ruleContainer = container.createEl('div', { cls: 'markdown-master-regex-rule' });

        new Setting(ruleContainer)
            .setName(`规则 ${index + 1}`)
            .addToggle(toggle => toggle
                .setValue(regexObj.enabled)
                .onChange(async (value) => {
                    this.plugin.settings.formatOptions.content.regexReplacements[index].enabled = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(ruleContainer)
            .setName('正则表达式')
            .addTextArea(text => text
                .setPlaceholder('输入正则表达式')
                .setValue(regexObj.regex)
                .onChange(async (value) => {
                    this.plugin.settings.formatOptions.content.regexReplacements[index].regex = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(ruleContainer)
            .setName('替换容')
            .addTextArea(text => text
                .setPlaceholder('输入替换内容')
                .setValue(regexObj.replacement)
                .onChange(async (value) => {
                    this.plugin.settings.formatOptions.content.regexReplacements[index].replacement = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(ruleContainer)
            .setName('说明')
            .addTextArea(text => text
                .setPlaceholder('输说明')
                .setValue(regexObj.description)
                .onChange(async (value) => {
                    this.plugin.settings.formatOptions.content.regexReplacements[index].description = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(ruleContainer)
            .setName('预设模板')
            // @ts-ignore
            .addDropdown((dropdown) => {
                dropdown
                    .addOption('custom', '自定义')
                    .addOptions(REGEX_PRESETS.reduce((acc, preset, i) => {
                        acc[i.toString()] = preset.name;
                        return acc;
                    }, {} as Record<string, string>))
                    .setValue('custom')
                    .onChange((value: string) => {
                        if (value !== 'custom') {
                            const preset = REGEX_PRESETS[parseInt(value)];
                            regexObj.regex = preset.regex;
                            regexObj.replacement = preset.replacement;
                            regexObj.description = preset.description;
                            this.plugin.saveSettings();
                            this.display(); // 重新渲染设置页面
                        }
                    });
            });

        const buttonContainer = ruleContainer.createEl('div', { cls: 'markdown-master-regex-buttons' });

        new Setting(buttonContainer)
            .addButton(button => button
                .setButtonText('测试')
                .onClick(() => {
                    new RegexTestModal(this.app, regexObj).open();
                }))
            .addButton(button => button
                .setButtonText('删除')
                .onClick(async () => {
                    console.log("删除规则:", index);
                    this.plugin.settings.formatOptions.content.regexReplacements.splice(index, 1);
                    await this.plugin.saveSettings();
                    this.display(); // 重新渲染整个设置页面
                }));
    }

    addStyleFormatSettings(containerEl: HTMLElement) {
        containerEl.createEl('h3', { text: '样式格式化选项' });

        new Setting(containerEl)
            .setName('启用粗体移除')
            .setDesc('移除所有粗体标记')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.formatOptions.style.enableBoldRemoval)
                .onChange(async (value) => {
                    this.plugin.settings.formatOptions.style.enableBoldRemoval = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('启用表格格式化')
            .setDesc('格式化表格，使其对齐')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.formatOptions.style.enableTableFormat)
                .onChange(async (value) => {
                    this.plugin.settings.formatOptions.style.enableTableFormat = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('启列表缩进格式化')
            .setDesc('统一列表的缩进')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.formatOptions.style.enableListIndentFormat)
                .onChange(async (value) => {
                    this.plugin.settings.formatOptions.style.enableListIndentFormat = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('启用链接式化')
            .setDesc('统一链接的格式')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.formatOptions.style.enableLinkFormat)
                .onChange(async (value) => {
                    this.plugin.settings.formatOptions.style.enableLinkFormat = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('启引用块格式化')
            .setDesc('统一引用块的格式')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.formatOptions.style.enableBlockquoteFormat)
                .onChange(async (value) => {
                    this.plugin.settings.formatOptions.style.enableBlockquoteFormat = value;
                    await this.plugin.saveSettings();
                }));
    }

    addAdvancedFormatSettings(containerEl: HTMLElement) {
        containerEl.createEl('h3', { text: '高级格式化选项' });

        new Setting(containerEl)
            .setName('启用自动格式化')
            .setDesc('在打开Markdown文件时自动应用格式化')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.formatOptions.advanced.enableAutoFormat)
                .onChange(async (value) => {
                    this.plugin.settings.formatOptions.advanced.enableAutoFormat = value;
                    await this.plugin.saveSettings();
                    // 重新注册或取消自动格式化事件
                    this.plugin.toggleAutoFormat(value);
                }));

        new Setting(containerEl)
            .setName('启用代码块高亮')
            .setDesc('优化代码块的格式和高亮')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.formatOptions.advanced.enableCodeHighlight)
                .onChange(async (value) => {
                    this.plugin.settings.formatOptions.advanced.enableCodeHighlight = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('启用图片优化')
            .setDesc('优化图片链接，添加懒加载和尺寸属性')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.formatOptions.advanced.enableImageOptimization)
                .onChange(async (value) => {
                    this.plugin.settings.formatOptions.advanced.enableImageOptimization = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('启用YAML前置元数据格式化')
            .setDesc('格式化Markdown文件开头的YAML前置元数据')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.formatOptions.advanced.enableYamlMetadataFormat)
                .onChange(async (value) => {
                    this.plugin.settings.formatOptions.advanced.enableYamlMetadataFormat = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('公式格式化')
            .setDesc('格式化LaTeX数学公式')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.formatOptions.advanced.enableMathFormat)
                .onChange(async (value) => {
                    this.plugin.settings.formatOptions.advanced.enableMathFormat = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('启用自定义CSS类格式��')
            .setDesc('格式化自定义CSS类标记')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.formatOptions.advanced.enableCustomCssClassFormat)
                .onChange(async (value) => {
                    this.plugin.settings.formatOptions.advanced.enableCustomCssClassFormat = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('启用高级代码块处理')
            .setDesc('增强代码块的处理，包括语法高亮和格式化')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.formatOptions.advanced.enableAdvancedCodeBlockProcessing)
                .onChange(async (value) => {
                    this.plugin.settings.formatOptions.advanced.enableAdvancedCodeBlockProcessing = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('格式化 YAML 前置元数据')
            .setDesc('启用 YAML 前置元数据的格式化')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.formatYAMLFrontMatter)
                .onChange(async (value) => {
                    this.plugin.settings.formatYAMLFrontMatter = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('格式化数学公式')
            .setDesc('启用 LaTeX 数学公式的格式化')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.formatMathEquations)
                .onChange(async (value) => {
                    this.plugin.settings.formatMathEquations = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('格式化自定义 CSS 类')
            .setDesc('启用自定义 CSS 类的格式化')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.formatCustomCSSClasses)
                .onChange(async (value) => {
                    this.plugin.settings.formatCustomCSSClasses = value;
                    await this.plugin.saveSettings();
                }));
    }

    addFormatRulesPrioritySettings(containerEl: HTMLElement) {
        containerEl.createEl('h3', { text: '格式化规则优先级' });

        this.plugin.settings.formatRules.forEach((rule, index) => {
            new Setting(containerEl)
                .setName(rule.name)
                .setDesc(`优先级: ${rule.priority}`)
                .addTextArea((text: TextAreaComponent) => text
                    .setPlaceholder('输入优先级 (0-100)')
                    .setValue(rule.priority.toString())
                    .onChange(async (value: string) => {
                        const numValue = Number(value);
                        if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
                            this.plugin.settings.formatRules[index].priority = numValue;
                            await this.plugin.saveSettings();
                        }
                    }))
                .addToggle((toggle: ToggleComponent) => toggle
                    .setValue(rule.enabled)
                    .onChange(async (value: boolean) => {
                        this.plugin.settings.formatRules[index].enabled = value;
                        await this.plugin.saveSettings();
                    }));
        });
    }
}

// 添加一个新的模态框类来显示正则表达式帮助
class RegexHelpModal extends Modal {
    constructor(app: App) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: '正则表达式帮助' });

        const content = contentEl.createEl('div');
        
        content.createEl('p', { text: '正则表达式是一种强大的文本匹配和操作工具。以是一基本语法：' });
        const ul1 = content.createEl('ul');
        [
            { code: '.', desc: '匹配任意单个字符' },
            { code: '*', desc: '匹配前面的元素零次或多次' },
            { code: '+', desc: '匹配前面的元素一次或多次' },
            { code: '?', desc: '匹配前面的元素零次或一次' },
            { code: '^', desc: '匹配行的开始' },
            { code: '$', desc: '匹配行的结束' },
            { code: '[]', desc: '匹配方括号内的任意一个字符' },
            { code: '[^]', desc: '匹配不在方括号内的任意一个字符' }
        ].forEach(item => {
            const li = ul1.createEl('li');
            li.createEl('code', { text: item.code });
            li.createEl('span', { text: ` - ${item.desc}` });
        });

        content.createEl('p', { text: '更多详细信息，请访问：' });
        const ul2 = content.createEl('ul');
        [
            { text: 'MDN 正则表达式指南', href: 'https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Guide/Regular_Expressions' },
            { text: 'Regex101 - 在线正则表达式测试工具', href: 'https://regex101.com/' }
        ].forEach(item => {
            const li = ul2.createEl('li');
            li.createEl('a', { text: item.text, href: item.href, attr: { target: '_blank' } });
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class RegexTestModal extends Modal {
    private regexObj: { regex: string; replacement: string; description: string; enabled: boolean };
    private inputEl!: HTMLTextAreaElement;
    private outputEl!: HTMLDivElement;
    private explanationEl!: HTMLDivElement;

    constructor(app: App, regexObj: { regex: string; replacement: string; description: string; enabled: boolean }) {
        super(app);
        this.regexObj = regexObj;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: '正则表达式测' });

        new Setting(contentEl)
            .setName('测试文本')
            .setDesc('输入要测试的文本')
            .addTextArea((text) => {
                this.inputEl = (text as any).inputEl;
                text.setPlaceholder('在此输入测试文本');
                text.onChange(this.updateResult.bind(this));
            });

        this.outputEl = contentEl.createEl('div', { cls: 'regex-test-output' }) as unknown as HTMLDivElement;
        this.explanationEl = contentEl.createEl('div', { cls: 'regex-test-explanation' }) as unknown as HTMLDivElement;

        new Setting(contentEl)
            .addButton(button => button
                .setButtonText('关闭')
                .onClick(() => this.close())
            );
    }

    updateResult() {
        const inputText = this.inputEl.value;
        try {
            const regex = new RegExp(this.regexObj.regex, 'gm');
            const matches = inputText.match(regex) || [];
            const result = inputText.replace(regex, this.regexObj.replacement);

            this.outputEl.innerHTML = `
                <h3>替换结果：</h3>
                <pre>${result}</pre>
                <h3>匹配详情：</h3>
                <ul>
                    ${matches.map((match, i) => `
                        <li>
                            匹配 ${i + 1}：
                            <pre>${JSON.stringify(match, null, 2)}</pre>
                        </li>
                    `).join('')}
                </ul>
            `;

            this.explanationEl.innerHTML = `
                <h3>正则表达式解释：</h3>
                <p>${this.explainRegex(this.regexObj.regex)}</p>
            `;
        } catch (error: unknown) {
            this.outputEl.innerHTML = `
                <h3>错误：</h3>
                <pre>${error instanceof Error ? error.message : String(error)}</pre>
            `;
            this.explanationEl.innerHTML = '';
        }
    }

    explainRegex(regex: string): string {
        // 这里可以添加更详细的正则表达式解释逻辑
        // 以下只是一个简单的示例
        return regex.split('').map(char => {
            switch(char) {
                case '^': return '匹配行的开始';
                case '$': return '匹配行的结束';
                case '.': return '匹配任意字符';
                case '*': return '匹配前面的表达式0次或多次';
                case '+': return '匹配前面的表达式1次或多次';
                case '?': return '匹配前面的表达式0次或1次';
                default: return `匹配字符 "${char}"`;
            }
        }).join('<br>');
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class MarkdownLintModal extends Modal {
    constructor(app: App, private errors: Array<{ line: number; message: string }>) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: 'Markdown语法检查结果' });

        const list = contentEl.createEl('ul');
        this.errors.forEach(error => {
            const item = list.createEl('li');
            item.textContent = `第${error.line}行: ${error.message}`;
        });

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('关闭')
                .onClick(() => this.close())
            );
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}