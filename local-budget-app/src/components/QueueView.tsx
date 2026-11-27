import React, { useState } from 'react';
import {
  Sparkles,
  ScanText,
  Trash2,
  RefreshCw,
  Upload,
  CheckCircle2,
  AlertCircle,
  Camera,
  RotateCcw,
} from 'lucide-react';
import { db, type PendingReceipt } from '../db/db';
import {
  processSinglePendingReceipt,
  processOfflineQueue,
} from '../services/receiptQueueService';
import { ReceiptLabPanel } from './ReceiptLabPanel';

interface QueueViewProps {
  pendingReceipts: PendingReceipt[];
  isOffline: boolean;
  onTriggerUpload: () => void;
  onOpenCamera: () => void;
}

export const QueueView: React.FC<QueueViewProps> = ({
  pendingReceipts,
  isOffline,
  onTriggerUpload,
  onOpenCamera,
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

  const handleResetStuck = async (id: string) => {
    await db.pendingReceipts.update(id, {
      status: 'queued',
      errorMessage: undefined,
    });
    if (processingId === id) {
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
    if (processingId === id) {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-10 pb-28">
      {/* Header */}
      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-[#0E0F0C]">
            Queue
          </h1>
          <p className="text-sm text-[#5D615C]">
            {pendingReceipts.length === 0
              ? 'Receipts captured offline appear here until synced.'
              : `${pendingReceipts.length} receipt${pendingReceipts.length > 1 ? 's' : ''} waiting locally in IndexedDB.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenCamera}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-[#9FE870] hover:bg-[#8EDE5C] text-[#163300] font-semibold text-xs transition cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Camera</span>
          </button>

          <button
            type="button"
            onClick={onTriggerUpload}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-[#EDF0EC] hover:bg-[#E2E7E0] text-[#163300] font-semibold text-xs transition cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload</span>
          </button>

          {pendingReceipts.length > 0 && !isOffline && (
            <button
              type="button"
              disabled={syncingAll}
              onClick={handleSyncAll}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-[#163300] hover:bg-[#1F4403] disabled:opacity-50 text-white font-semibold text-xs transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingAll ? 'animate-spin' : ''}`} />
              <span>{syncingAll ? 'Syncing...' : 'Sync all'}</span>
            </button>
          )}
        </div>
      </section>

      {/* Queue List or Calm Empty State */}
      {pendingReceipts.length === 0 ? (
        <div className="rounded-3xl bg-[#F2F5F2] p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-white border border-[#E2E5E0] text-[#2F5711] flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-5 h-5" strokeWidth={1.8} />
          </div>
          <h3 className="text-base font-display font-bold text-[#0E0F0C]">
            All caught up
          </h3>
          <p className="text-sm text-[#5D615C] max-w-sm mx-auto">
            Any receipts snapped while offline will wait safely here and sync automatically once you reconnect.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {pendingReceipts.map((item) => {
            const isActiveLocally = processingId === item.id;
            const isStuck = item.status === 'processing' && !isActiveLocally;

            return (
              <div
                key={item.id}
                className="bg-[#F2F5F2] rounded-3xl p-5 flex flex-col sm:flex-row gap-4"
              >
                <img
                  src={item.imageDataUrl}
                  alt="Queued receipt"
                  className="w-full sm:w-32 h-40 object-cover rounded-2xl bg-white shrink-0"
                />

                <div className="flex-1 flex flex-col justify-between min-w-0">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[#0E0F0C] text-sm truncate">
                        {item.fileName || 'Captured receipt'}
                      </span>
                      <span
                        className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full capitalize shrink-0 ${
                          isStuck
                            ? 'bg-amber-100 text-amber-900'
                            : item.status === 'processing'
                            ? 'bg-[#163300] text-[#9FE870]'
                            : item.status === 'failed'
                            ? 'bg-[#FDECEC] text-[#A8200D]'
                            : 'bg-white text-[#163300]'
                        }`}
                      >
                        {isStuck ? 'Interrupted' : item.status}
                      </span>
                    </div>

                    <div className="text-xs text-[#6A6C6A] mt-1">
                      {new Date(item.createdAt).toLocaleString()}
                    </div>

                    {item.errorMessage && (
                      <div className="mt-2.5 p-2.5 rounded-xl bg-[#FDECEC] text-xs text-[#A8200D] flex items-start gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span className="break-words">{item.errorMessage}</span>
                      </div>
                    )}

                    {isActiveLocally && ocrProgress !== null && (
                      <div className="mt-3">
                        <div className="text-[11px] font-medium text-[#5D615C] mb-1">
                          Local OCR ({ocrProgress}%)
                        </div>
                        <div className="h-1.5 bg-[#E0E5DF] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#163300] transition-all"
                            style={{ width: `${ocrProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#E2E6E0] flex flex-wrap items-center gap-2">
                    {isStuck ? (
                      <button
                        type="button"
                        onClick={() => handleResetStuck(item.id)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-full bg-[#163300] text-white font-semibold text-xs transition cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reset</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isActiveLocally}
                        onClick={() => handleProcessItem(item.id, false)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-full bg-[#9FE870] hover:bg-[#8EDE5C] disabled:opacity-50 text-[#163300] font-semibold text-xs transition cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{isActiveLocally ? 'Extracting...' : 'Extract AI'}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={isActiveLocally}
                      onClick={() => handleProcessItem(item.id, true)}
                      title="Run offline Tesseract.js OCR"
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-full bg-white hover:bg-[#E8EDE7] disabled:opacity-50 text-[#163300] font-semibold text-xs transition cursor-pointer"
                    >
                      <ScanText className="w-3.5 h-3.5" />
                      <span>Local OCR</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="w-8 h-8 rounded-full bg-[#FDECEC] text-[#A8200D] hover:bg-[#FADADA] flex items-center justify-center transition cursor-pointer"
                      title="Remove from queue"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Isolated 3-Stage Receipt Scanner Lab */}
      <ReceiptLabPanel />
    </div>
  );
};
