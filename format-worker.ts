import { formatMarkdown } from './formatting-logic';

self.onmessage = async (event: MessageEvent) => {
    const { content, settings } = event.data;
    const formattedContent = await formatMarkdown(content, settings);
    self.postMessage(formattedContent);
};