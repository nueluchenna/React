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
  Camera,
  RotateCcw,
} from 'lucide-react';
import { db, type PendingReceipt } from '../db/db';
import {
  processSinglePendingReceipt,
  processOfflineQueue,
} from '../services/receiptQueueService';

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
    <div className="space-y-5 pb-24">
      {/* Header */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900 text-base">
              Receipt Queue ({pendingReceipts.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Offline or pending receipts wait here safely in IndexedDB until extracted.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenCamera}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium text-xs transition cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Camera</span>
          </button>

          <button
            type="button"
            onClick={onTriggerUpload}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium text-xs transition cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload</span>
          </button>

          {pendingReceipts.length > 0 && !isOffline && (
            <button
              type="button"
              disabled={syncingAll}
              onClick={handleSyncAll}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-xs transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingAll ? 'animate-spin' : ''}`} />
              <span>{syncingAll ? 'Syncing...' : 'Sync All'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Empty State */}
      {pendingReceipts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-10 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2.5" />
          <h3 className="text-sm font-semibold text-slate-900">Queue is empty</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            Any receipts snapped while offline will appear here and sync automatically once you reconnect.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pendingReceipts.map((item) => {
            const isActiveLocally = processingId === item.id;
            const isStuck = item.status === 'processing' && !isActiveLocally;

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-4 flex flex-col sm:flex-row gap-4"
              >
                <img
                  src={item.imageDataUrl}
                  alt="Queued receipt"
                  className="w-full sm:w-32 h-40 object-cover rounded-xl border border-slate-200 bg-slate-50 shrink-0"
                />

                <div className="flex-1 flex flex-col justify-between min-w-0">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900 text-sm truncate">
                        {item.fileName || 'Captured Receipt'}
                      </span>
                      <span
                        className={`text-[11px] font-medium px-2 py-0.5 rounded-md capitalize shrink-0 ${
                          isStuck
                            ? 'bg-amber-100 text-amber-800'
                            : item.status === 'processing'
                            ? 'bg-slate-900 text-white'
                            : item.status === 'failed'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {isStuck ? 'Interrupted' : item.status}
                      </span>
                    </div>

                    <div className="text-xs text-slate-400 mt-1">
                      {new Date(item.createdAt).toLocaleString()}
                    </div>

                    {item.errorMessage && (
                      <div className="mt-2 p-2 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span className="break-words">{item.errorMessage}</span>
                      </div>
                    )}

                    {isActiveLocally && ocrProgress !== null && (
                      <div className="mt-2.5">
                        <div className="text-[11px] font-medium text-slate-600 mb-1">
                          Local OCR ({ocrProgress}%)
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-600 transition-all"
                            style={{ width: `${ocrProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
                    {isStuck ? (
                      <button
                        type="button"
                        onClick={() => handleResetStuck(item.id)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reset Stuck Item</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isActiveLocally}
                        onClick={() => handleProcessItem(item.id, false)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-xs transition cursor-pointer"
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
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-medium text-xs transition cursor-pointer"
                    >
                      <ScanText className="w-3.5 h-3.5" />
                      <span>Local OCR</span>
                    </button>

                    {/* Delete is NEVER disabled so stuck items can always be removed */}
                    <button
                      type="button"
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
