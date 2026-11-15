import React, { useState } from 'react';
import {
  Clock,
  Sparkles,
  ScanText,
  Trash2,
  RefreshCw,
  Upload,
  CheckCircle2,
  AlertCircle,
  FlaskConical,
} from 'lucide-react';
import { db, type PendingReceipt } from '../db/db';
import { processSinglePendingReceipt, processOfflineQueue } from '../services/receiptQueueService';
import { generateSyntheticReceiptDataUrl } from '../db/demoData';

interface QueueViewProps {
  pendingReceipts: PendingReceipt[];
  isOffline: boolean;
  currency: string;
  onTriggerUpload: () => void;
}

export const QueueView: React.FC<QueueViewProps> = ({
  pendingReceipts,
  isOffline,
  currency,
  onTriggerUpload,
}) => {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [ocrProgress, setOcrProgress] = useState<number | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);

  const handleProcessItem = async (id: string, forceLocalOCR: boolean) => {
    setProcessingId(id);
    setOcrProgress(null);
    try {
      await processSinglePendingReceipt(id, {
        forceLocalOCR,
        onProgress: (pct) => setOcrProgress(pct),
      });
    } finally {
      setProcessingId(null);
      setOcrProgress(null);
    }
  };

  const handleSyncAll = async () => {
    setSyncingAll(true);
    try {
      await processOfflineQueue(true);
    } finally {
      setSyncingAll(false);
    }
  };

  const handleDelete = async (id: string) => {
    await db.pendingReceipts.delete(id);
  };

  const handleAddSampleReceiptToQueue = async () => {
    const sym = currency === 'USD' ? '$' : currency === 'GBP' ? '£' : '€';
    const sampleDataUrl = generateSyntheticReceiptDataUrl({
      merchant: 'BioMarkt Organic Store',
      date: new Date().toISOString().split('T')[0],
      currencySymbol: sym,
      items: [
        { name: 'Organic Honey Crisp Apples', quantity: 1, unitPrice: 4.5, totalPrice: 4.5 },
        { name: 'Almond Butter Smooth 350g', quantity: 1, unitPrice: 7.9, totalPrice: 7.9 },
        { name: 'Fresh Sourdough Baguette', quantity: 2, unitPrice: 2.8, totalPrice: 5.6 },
        { name: 'Cold Pressed Orange Juice', quantity: 1, unitPrice: 4.2, totalPrice: 4.2 },
      ],
      taxAmount: 1.99,
      totalAmount: 22.2,
    });

    await db.pendingReceipts.put({
      id: crypto.randomUUID(),
      imageDataUrl: sampleDataUrl,
      createdAt: Date.now(),
      status: 'queued',
      fileName: 'Sample_Receipt_BioMarkt.jpg',
    });
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-3 rounded-2xl bg-amber-50 text-amber-600 shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 text-lg">
              Offline Receipt Queue & OCR Lab ({pendingReceipts.length})
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Receipts captured while offline are compressed (max 1200px @ 0.75 JPEG) and safely stored in IndexedDB until connectivity returns.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleAddSampleReceiptToQueue}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs sm:text-sm transition cursor-pointer"
          >
            <FlaskConical className="w-4 h-4" />
            <span>+ Enqueue Test Receipt</span>
          </button>

          <button
            type="button"
            onClick={onTriggerUpload}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs sm:text-sm transition cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Photo</span>
          </button>

          {pendingReceipts.length > 0 && !isOffline && (
            <button
              type="button"
              disabled={syncingAll}
              onClick={handleSyncAll}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm shadow-xs transition cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${syncingAll ? 'animate-spin' : ''}`} />
              <span>{syncingAll ? 'Syncing All...' : 'Process All Now'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Empty Queue State */}
      {pendingReceipts.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-10 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-900">
            Offline Queue is All Clear!
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mt-1">
            Want to test offline queueing right now? Toggle <strong>“Simulate Offline”</strong> in the top header or click <strong>“+ Enqueue Test Receipt”</strong> above to watch a receipt get queued and extracted.
          </p>
          <button
            type="button"
            onClick={handleAddSampleReceiptToQueue}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm shadow-xs transition cursor-pointer"
          >
            <FlaskConical className="w-4 h-4" />
            <span>Generate & Queue Sample Receipt</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pendingReceipts.map((item) => {
            const isBusy = processingId === item.id || item.status === 'processing';
            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex flex-col sm:flex-row gap-4"
              >
                <img
                  src={item.imageDataUrl}
                  alt="Queued receipt"
                  className="w-full sm:w-36 h-44 object-cover rounded-xl border border-slate-200 bg-slate-50 shrink-0"
                />

                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900 text-sm truncate">
                        {item.fileName || 'Captured Receipt'}
                      </span>
                      <span
                        className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full capitalize ${
                          item.status === 'processing'
                            ? 'bg-indigo-100 text-indigo-800'
                            : item.status === 'failed'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>

                    <div className="text-xs text-slate-400 mt-1">
                      Queued {new Date(item.createdAt).toLocaleString()}
                    </div>

                    {item.errorMessage && (
                      <div className="mt-2 p-2 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-1.5">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{item.errorMessage}</span>
                      </div>
                    )}

                    {isBusy && ocrProgress !== null && (
                      <div className="mt-2">
                        <div className="text-xs font-medium text-indigo-700 mb-1">
                          Running In-Browser Tesseract OCR ({ocrProgress}%)...
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-600 transition-all"
                            style={{ width: `${ocrProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleProcessItem(item.id, false)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-xs transition cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{isBusy ? 'Extracting...' : 'Smart Extract (AI / Auto)'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleProcessItem(item.id, true)}
                      title="Run 100% offline/keyless Tesseract.js OCR in browser"
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 font-semibold text-xs transition cursor-pointer"
                    >
                      <ScanText className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Local OCR</span>
                    </button>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleDelete(item.id)}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                      title="Remove from queue"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
