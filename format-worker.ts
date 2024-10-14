// 如果 types.ts 文件不存在，我们可以直接在这里定义 MarkdownMasterSettings 接口
interface MarkdownMasterSettings {
    formatOptions: {
        content: {
            enableRegexReplacement: boolean;
            regexReplacements: Array<{ regex: string; replacement: string; enabled: boolean }>;
        };
        structure: {
            enableHeadingConversion: boolean;
            headingConversionRules: { [key: string]: number };
        };
        style: {
            enableBoldRemoval: boolean;
        };
    };
}

self.onmessage = async (event: MessageEvent) => {
    const { content, settings } = event.data as { content: string, settings: MarkdownMasterSettings };
    const formattedContent = formatMarkdown(content, settings);
    self.postMessage(formattedContent);
};

function formatMarkdown(content: string, settings: MarkdownMasterSettings): string {
    let formatted = content;

    // 应用各种格式化规则
    if (settings.formatOptions.content.enableRegexReplacement) {
        formatted = applyRegexReplacements(formatted, settings.formatOptions.content.regexReplacements);
    }

    if (settings.formatOptions.structure.enableHeadingConversion) {
        formatted = convertHeadings(formatted, settings.formatOptions.structure.headingConversionRules);
    }

    if (settings.formatOptions.style.enableBoldRemoval) {
        formatted = removeBold(formatted);
    }

    // 添加其他格式化规则...

    return formatted;
}

// 实现各种格式化函数
function applyRegexReplacements(content: string, replacements: Array<{ regex: string; replacement: string; enabled: boolean }>): string {
    replacements.forEach(({ regex, replacement, enabled }) => {
        if (enabled) {
            content = content.replace(new RegExp(regex, 'g'), replacement);
        }
    });
    return content;
}

function convertHeadings(content: string, rules: { [key: string]: number }): string {
    return content.replace(/^(#{1,6})\s/gm, (match, hashes) => {
        const level = hashes.length;
        const newLevel = rules[level] || level;
        return '#'.repeat(newLevel) + ' ';
    });
}

function removeBold(content: string): string {
    return content.replace(/\*\*(.*?)\*\*/g, '$1');
}

// 添加其他必要的格式化函数...
