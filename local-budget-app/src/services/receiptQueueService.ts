import { db, getSetting, type Transaction } from '../db/db';
import { compressImageToDataUrl } from '../utils/imageCompression';
import { extractReceiptSmart } from './aiReceiptParser';

export interface QueueSyncNotification {
  id: string;
  type: 'queued' | 'synced' | 'error' | 'warning';
  message: string;
  merchant?: string;
  amount?: number;
  currency?: string;
  transactionId?: string;
  undoTransaction?: Transaction;
}

type NotificationListener = (notif: QueueSyncNotification) => void;

const listeners = new Set<NotificationListener>();
let isDrainingQueue = false;
const activeProcessingIds = new Set<string>();

export function subscribeQueueNotifications(fn: NotificationListener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function emitNotification(notif: QueueSyncNotification) {
  for (const fn of listeners) {
    try {
      fn(notif);
    } catch (e) {
      console.error('Notification listener error:', e);
    }
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`));
    }, ms);
    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Checks whether the app should behave as offline:
 * true if browser is offline OR user enabled "Simulate Offline Mode" in header.
 */
export async function isEffectivelyOffline(): Promise<boolean> {
  const simulateOffline = await getSetting<boolean>('simulateOffline', false);
  return !navigator.onLine || Boolean(simulateOffline);
}

/**
 * Recovers any receipts stuck in 'processing' from a refreshed/interrupted session.
 */
export async function recoverStuckReceipts(): Promise<number> {
  const all = await db.pendingReceipts.toArray();
  let recovered = 0;
  for (const item of all) {
    if (item.status === 'processing' && !activeProcessingIds.has(item.id)) {
      await db.pendingReceipts.update(item.id, {
        status: 'queued',
        errorMessage: 'Reset from an interrupted extraction session.',
      });
      recovered += 1;
    }
  }
  return recovered;
}

/**
 * Ingests one or more receipt images (from camera, file upload, or clipboard paste).
 */
export async function ingestReceiptFiles(
  files: File[] | Blob[],
  options?: { forceLocalOCR?: boolean }
): Promise<{ queued: number; processed: number }> {
  let queued = 0;
  let processed = 0;

  for (const file of files) {
    const compressedDataUrl = await compressImageToDataUrl(file, 1200, 0.78);
    const offline = await isEffectivelyOffline();

    if (offline) {
      const pendingId = crypto.randomUUID();
      await db.pendingReceipts.put({
        id: pendingId,
        imageDataUrl: compressedDataUrl,
        createdAt: Date.now(),
        status: 'queued',
        fileName: file instanceof File ? file.name : 'Captured Receipt',
      });
      queued += 1;
      emitNotification({
        id: crypto.randomUUID(),
        type: 'queued',
        message: 'Saved to Offline Queue. It will sync automatically when back online.',
      });
    } else {
      const pendingId = crypto.randomUUID();
      await db.pendingReceipts.put({
        id: pendingId,
        imageDataUrl: compressedDataUrl,
        createdAt: Date.now(),
        status: 'processing',
        fileName: file instanceof File ? file.name : 'Receipt Scan',
      });

      const tx = await processSinglePendingReceipt(pendingId, {
        forceLocalOCR: options?.forceLocalOCR,
      });
      if (tx) {
        processed += 1;
      }
    }
  }

  return { queued, processed };
}

/**
 * Processes a single item from db.pendingReceipts through the AI / OCR pipeline.
 */
export async function processSinglePendingReceipt(
  pendingId: string,
  options?: { forceLocalOCR?: boolean; onProgress?: (pct: number) => void }
): Promise<Transaction | null> {
  const item = await db.pendingReceipts.get(pendingId);
  if (!item) return null;

  activeProcessingIds.add(pendingId);
  await db.pendingReceipts.update(pendingId, {
    status: 'processing',
    errorMessage: undefined,
  });

  try {
    const extracted = await withTimeout(
      extractReceiptSmart(item.imageDataUrl, {
        forceLocalOCR: options?.forceLocalOCR,
        onProgress: options?.onProgress,
      }),
      45000,
      'Receipt extraction'
    );

    const engineTag =
      extracted.extractionEngine === 'openrouter'
        ? 'OpenRouter Vision'
        : extracted.extractionEngine === 'groq'
        ? 'Groq AI'
        : extracted.extractionEngine === 'gemini'
        ? 'Gemini AI'
        : 'Local OCR';

    const newTx: Transaction = {
      id: crypto.randomUUID(),
      type: extracted.category === 'Income' ? 'income' : 'expense',
      amount: extracted.totalAmount,
      taxAmount: extracted.taxAmount,
      currency: extracted.currency,
      category: extracted.category,
      merchant: extracted.merchant,
      date: extracted.date,
      createdAt: Date.now(),
      note:
        extracted.summaryNote +
        (extracted.extractionEngine === 'tesseract_fallback' ? ' (Local OCR)' : ''),
      lineItems: extracted.lineItems,
      receiptImageDataUrl: item.imageDataUrl,
      source: 'ai_receipt',
      syncStatus: 'synced',
    };

    await db.transaction('rw', db.transactions, db.pendingReceipts, async () => {
      await db.transactions.put(newTx);
      await db.pendingReceipts.delete(pendingId);
    });

    if (extracted.fallbackReason && !options?.forceLocalOCR) {
      emitNotification({
        id: crypto.randomUUID(),
        type: 'warning',
        merchant: newTx.merchant,
        amount: newTx.amount,
        currency: newTx.currency,
        transactionId: newTx.id,
        message: `Used Local OCR (${newTx.merchant} ${newTx.currency} ${newTx.amount.toFixed(
          2
        )}). AI error: ${extracted.fallbackReason.slice(0, 90)}`,
      });
    } else {
      emitNotification({
        id: crypto.randomUUID(),
        type: 'synced',
        merchant: newTx.merchant,
        amount: newTx.amount,
        currency: newTx.currency,
        transactionId: newTx.id,
        message: `${engineTag} extracted ${newTx.merchant} (${newTx.currency} ${newTx.amount.toFixed(
          2
        )})`,
      });
    }

    return newTx;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to extract receipt';
    await db.pendingReceipts.update(pendingId, {
      status: 'failed',
      errorMessage: msg,
    });
    emitNotification({
      id: crypto.randomUUID(),
      type: 'error',
      message: `Receipt extraction failed: ${msg}`,
    });
    return null;
  } finally {
    activeProcessingIds.delete(pendingId);
  }
}

/**
 * Automatically drains all queued (and optionally failed/stuck) items in db.pendingReceipts.
 */
export async function processOfflineQueue(includeFailed = false): Promise<number> {
  if (isDrainingQueue) return 0;
  const offline = await isEffectivelyOffline();
  if (offline) return 0;

  isDrainingQueue = true;
  let syncedCount = 0;

  try {
    await recoverStuckReceipts();

    const allPending = await db.pendingReceipts.orderBy('createdAt').toArray();
    const targets = allPending.filter(
      (r) => r.status === 'queued' || (includeFailed && r.status === 'failed')
    );

    for (const item of targets) {
      const stillOffline = await isEffectivelyOffline();
      if (stillOffline) break;

      const tx = await processSinglePendingReceipt(item.id);
      if (tx) syncedCount += 1;
    }
  } finally {
    isDrainingQueue = false;
  }

  return syncedCount;
}

/**
 * Registers global online & visibilitychange listeners and recovers stuck items on startup.
 */
export function registerAutoSyncListeners(): () => void {
  const handleOnline = () => {
    void processOfflineQueue(false);
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      void processOfflineQueue(false);
    }
  };

  window.addEventListener('online', handleOnline);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Recover any stuck 'processing' items immediately on startup, then drain queue if online
  void recoverStuckReceipts().then(() => processOfflineQueue(false));

  return () => {
    window.removeEventListener('online', handleOnline);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}
