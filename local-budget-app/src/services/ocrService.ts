/**
 * Isolated Stage 1: OCR Engine (src/services/ocrService.ts)
 * - Preprocesses receipt images on HTML5 <canvas> (grayscale + contrast stretch + crisp luminance)
 * - Reuses a single cached Tesseract.js worker across scans so cold-start overhead only happens once
 */
import type { Worker } from 'tesseract.js';

export interface OCRResult {
  rawText: string;
  preprocessedDataUrl: string;
  durationMs: number;
  confidence: number;
}

let cachedWorkerPromise: Promise<Worker> | null = null;
let progressCallback: ((pct: number) => void) | null = null;

async function getReusableOCRWorker(): Promise<Worker> {
  if (!cachedWorkerPromise) {
    cachedWorkerPromise = (async () => {
      const Tesseract = await import('tesseract.js');
      const worker = await Tesseract.createWorker('eng', 1, {
        logger: (m) => {
          if (
            m.status === 'recognizing text' &&
            typeof m.progress === 'number' &&
            progressCallback
          ) {
            progressCallback(Math.round(m.progress * 100));
          }
        },
      });
      return worker;
    })().catch((err) => {
      cachedWorkerPromise = null;
      throw err;
    });
  }
  return cachedWorkerPromise;
}

/**
 * Enhances a receipt image for OCR:
 * - Preserves horizontal resolution (up to 1600px wide, tall height allowed)
 * - Converts to grayscale
 * - Stretches dynamic range (auto-contrast) so faint thermal receipt text pops against gray paper
 */
export async function preprocessImageForOCR(
  imageDataUrl: string
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        let { width, height } = img;
        const targetMaxWidth = 1600;
        const targetMaxHeight = 4400;

        if (width > targetMaxWidth) {
          height = Math.round((height * targetMaxWidth) / width);
          width = targetMaxWidth;
        }
        if (height > targetMaxHeight) {
          width = Math.round((width * targetMaxHeight) / height);
          height = targetMaxHeight;
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(imageDataUrl);
          return;
        }

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        // Pass 1: Grayscale + find 2nd/98th luminance bounds via histogram
        const hist = new Uint32Array(256);
        const totalPixels = canvas.width * canvas.height;
        const grays = new Uint8Array(totalPixels);

        for (let i = 0, p = 0; i < data.length; i += 4, p++) {
          const g = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
          grays[p] = g;
          hist[g]++;
        }

        let low = 0;
        let high = 255;
        let acc = 0;
        const lowCut = totalPixels * 0.02;
        const highCut = totalPixels * 0.96;

        for (let i = 0; i < 256; i++) {
          acc += hist[i];
          if (acc >= lowCut) {
            low = i;
            break;
          }
        }
        acc = 0;
        for (let i = 0; i < 256; i++) {
          acc += hist[i];
          if (acc >= highCut) {
            high = i;
            break;
          }
        }

        const range = Math.max(20, high - low);

        // Pass 2: Contrast stretch + mild S-curve push (dark ink darker, paper whiter)
        for (let i = 0, p = 0; i < data.length; i += 4, p++) {
          let norm = (grays[p] - low) / range;
          norm = Math.max(0, Math.min(1, norm));
          // Push light background closer to pure white while keeping dark ink crisp
          const boosted = norm > 0.72 ? Math.min(1, norm * 1.15) : norm * 0.92;
          const v = Math.round(boosted * 255);
          data[i] = v;
          data[i + 1] = v;
          data[i + 2] = v;
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(imageDataUrl);
      }
    };
    img.onerror = () => resolve(imageDataUrl);
    img.src = imageDataUrl;
  });
}

/**
 * Runs isolated Stage 1 OCR on a receipt image and returns raw text + timing + preprocessed preview.
 */
export async function runReceiptOCR(
  imageDataUrl: string,
  onProgress?: (pct: number) => void
): Promise<OCRResult> {
  const start = performance.now();
  const preprocessedDataUrl = await preprocessImageForOCR(imageDataUrl);

  progressCallback = onProgress || null;
  try {
    const worker = await getReusableOCRWorker();
    const res = await worker.recognize(preprocessedDataUrl);
    return {
      rawText: res.data.text || '',
      preprocessedDataUrl,
      durationMs: Math.round(performance.now() - start),
      confidence: Math.round(res.data.confidence || 0),
    };
  } finally {
    progressCallback = null;
  }
}
