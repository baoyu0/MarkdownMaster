export interface TextStatistics {
  wordCount: number;
  charCount: number;
  lineCount: number;
}

export function calculateTextStatistics(content: string): TextStatistics {
  return {
    wordCount: content.split(/\s+/).length,
    charCount: content.length,
    lineCount: content.split('\n').length,
  };
}