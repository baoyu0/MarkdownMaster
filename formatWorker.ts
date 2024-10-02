import { formatMarkdown } from './formatter';
import { MarkdownMasterSettings } from './types';

self.onmessage = (e: MessageEvent) => {
  const { content, settings } = e.data;
  const formattedContent = formatMarkdown(content, settings);
  self.postMessage(formattedContent);
};