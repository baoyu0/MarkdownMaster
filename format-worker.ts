self.onmessage = async (event: MessageEvent) => {
    const { content, settings } = event.data;
    // 在这里实现格式化逻辑
    let formattedContent = content;
    // 应用各种格式化规则...
    // 注意：这里的格式化逻辑应该与 main.ts 中的 formatMarkdownDirectly 方法逻辑相同
    self.postMessage(formattedContent);
};