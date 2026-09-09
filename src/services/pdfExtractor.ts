// Polyfill Promise.withResolvers for universal compatibility
if (typeof (Promise as any).withResolvers === 'undefined') {
  (Promise as any).withResolvers = function <T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: any) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// Configure worker
if (typeof window !== 'undefined' && 'GlobalWorkerOptions' in pdfjsLib) {
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
}

export async function extractTextFromPdf(
  fileOrBuffer: File | ArrayBuffer,
  onProgress?: (progress: { currentPage: number; totalPages: number; pageText: string; accumulatedText: string }) => void
): Promise<{ text: string; pageCount: number }> {
  let arrayBuffer: ArrayBuffer;
  if (fileOrBuffer instanceof File) {
    arrayBuffer = await fileOrBuffer.arrayBuffer();
  } else {
    arrayBuffer = fileOrBuffer;
  }

  const loadingTask = (pdfjsLib as any).getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  let fullText = '';

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    
    let lastY: number | null = null;
    let pageText = '';

    for (const item of content.items as any[]) {
      if ('str' in item) {
        if (lastY !== null && Math.abs(item.transform[5] - lastY) > 8) {
          pageText += '\n';
        } else if (pageText.length > 0 && !pageText.endsWith(' ') && !pageText.endsWith('\n')) {
          pageText += ' ';
        }
        pageText += item.str;
        lastY = item.transform[5];
      }
    }

    const cleanedPage = cleanExtractedText(pageText);
    if (cleanedPage) {
      fullText += (pageNum > 1 ? '\n\n' : '') + cleanedPage;
    }

    if (onProgress) {
      onProgress({
        currentPage: pageNum,
        totalPages: numPages,
        pageText: cleanedPage,
        accumulatedText: cleanExtractedText(fullText),
      });
    }
  }

  return {
    text: cleanExtractedText(fullText),
    pageCount: numPages,
  };
}

export async function extractTextFromTextFile(file: File): Promise<string> {
  const text = await file.text();
  return cleanExtractedText(text);
}

export function cleanExtractedText(raw: string): string {
  if (!raw) return '';

  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/(\w+)-\s*\n\s*(\w+)/g, '$1$2')
    .replace(/([^\n])\n([^\n])/g, '$1 $2')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function unwrapLines(text: string): string {
  return text
    .split('\n\n')
    .map((paragraph) => paragraph.replace(/\n/g, ' ').replace(/\s{2,}/g, ' ').trim())
    .join('\n\n');
}

export function stripPageArtifacts(text: string): string {
  return text
    .replace(/^Page\s+\d+(\s+of\s+\d+)?$/gim, '')
    .replace(/^\d+\s*$/gm, '')
    .trim();
}

export function calculateTextStats(text: string) {
  const charCount = text.length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const totalSeconds = Math.round((words / 150) * 60);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const estDuration = `${minutes}m ${seconds}s`;

  return {
    charCount,
    wordCount: words,
    estDuration,
    totalSeconds,
  };
}
