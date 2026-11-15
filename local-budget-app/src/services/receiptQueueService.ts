import { db, getSetting, type Transaction } from '../db/db';
import { compressImageToDataUrl } from '../utils/imageCompression';
import { extractReceiptSmart } from './aiReceiptParser';

export interface QueueSyncNotification {
  id: string;
  type: 'queued' | 'synced' | 'error';
  message: string;
  merchant?: string;
  amount?: number;
  currency?: string;
  transactionId?: string;
}

type NotificationListener = (notif: QueueSyncNotification) => void;

const listeners = new Set<NotificationListener>();
let isDrainingQueue = false;

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

/**
 * Checks whether the app should behave as offline:
 * true if browser is offline OR user enabled "Simulate Offline Mode" in header.
 */
export async function isEffectivelyOffline(): Promise<boolean> {
  const simulateOffline = await getSetting<boolean>('simulateOffline', false);
  return !navigator.onLine || Boolean(simulateOffline);
}

/**
 * Ingests one or more receipt images (from file upload, camera snap, or clipboard paste).
 * Compresses each image to max 1200px @ 0.75 JPEG quality.
 * If offline (or Simulate Offline is active), queues in db.pendingReceipts.
 * If online, processes immediately through AI/OCR extraction and saves to db.transactions.
 */
export async function ingestReceiptFiles(
  files: File[] | Blob[],
  options?: { forceLocalOCR?: boolean }
): Promise<{ queued: number; processed: number }> {
  let queued = 0;
  let processed = 0;

  for (const file of files) {
    const compressedDataUrl = await compressImageToDataUrl(file, 1200, 0.75);
    const offline = await isEffectivelyOffline();

    if (offline) {
      const pendingId = crypto.randomUUID();
      await db.pendingReceipts.put({
        id: pendingId,
        imageDataUrl: compressedDataUrl,
        createdAt: Date.now(),
        status: 'queued',
        fileName: file instanceof File ? file.name : 'Pasted Screenshot',
      });
      queued += 1;
      emitNotification({
        id: crypto.randomUUID(),
        type: 'queued',
        message: 'Offline mode active: Receipt compressed & saved to Offline Queue.',
      });
    } else {
      // Create a transient pending record so the user sees immediate progress if desired, then process
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
 * Processes a single item from db.pendingReceipts through the AI / OCR pipeline,
 * inserts a complete record into db.transactions, removes it from db.pendingReceipts,
 * and fires a toast notification.
 */
export async function processSinglePendingReceipt(
  pendingId: string,
  options?: { forceLocalOCR?: boolean; onProgress?: (pct: number) => void }
): Promise<Transaction | null> {
  const item = await db.pendingReceipts.get(pendingId);
  if (!item) return null;

  await db.pendingReceipts.update(pendingId, {
    status: 'processing',
    errorMessage: undefined,
  });

  try {
    const extracted = await extractReceiptSmart(item.imageDataUrl, {
      forceLocalOCR: options?.forceLocalOCR,
      onProgress: options?.onProgress,
    });

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

    emitNotification({
      id: crypto.randomUUID(),
      type: 'synced',
      merchant: newTx.merchant,
      amount: newTx.amount,
      currency: newTx.currency,
      transactionId: newTx.id,
      message: `Receipt extracted: ${newTx.merchant} (${newTx.currency} ${newTx.amount.toFixed(2)})`,
    });

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
      message: `Receipt processing failed: ${msg}`,
    });
    return null;
  }
}

/**
 * Automatically drains all queued (and optionally failed) items in db.pendingReceipts
 * when connectivity is restored.
 */
export async function processOfflineQueue(includeFailed = false): Promise<number> {
  if (isDrainingQueue) return 0;
  const offline = await isEffectivelyOffline();
  if (offline) return 0;

  isDrainingQueue = true;
  let syncedCount = 0;

  try {
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
 * Registers global online & visibilitychange listeners to auto-sync queued receipts.
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

  // Also check on startup
  void processOfflineQueue(false);

  return () => {
    window.removeEventListener('online', handleOnline);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}
