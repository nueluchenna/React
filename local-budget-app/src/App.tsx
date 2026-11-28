import React, { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Home,
  BarChart2,
  Plus,
  Clock,
  SlidersHorizontal,
  Camera,
  CheckCircle2,
  AlertCircle,
  Upload,
  ClipboardPaste,
  X,
  RotateCcw,
} from 'lucide-react';
import {
  db,
  getSetting,
  setSetting,
  formatCurrency,
  type Transaction,
} from './db/db';
import { loadDemoData } from './db/demoData';
import {
  ingestReceiptFiles,
  processOfflineQueue,
  registerAutoSyncListeners,
  subscribeQueueNotifications,
  type QueueSyncNotification,
} from './services/receiptQueueService';
import { exportSummaryCSV } from './utils/exportData';
import { TransactionFeed } from './components/TransactionFeed';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { QueueView } from './components/QueueView';
import { SettingsView } from './components/SettingsView';
import { ManualEntryModal } from './components/ManualEntryModal';
import { TransactionDetailModal } from './components/TransactionDetailModal';
import { CameraCaptureModal } from './components/CameraCaptureModal';

type NavTab = 'feed' | 'analytics' | 'queue' | 'settings';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('feed');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showManualModal, setShowManualModal] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [showAddActionMenu, setShowAddActionMenu] = useState(false);

  const [currency, setCurrency] = useState('EUR');
  const [monthlyBudget, setMonthlyBudget] = useState(1600);
  const [monthlySavingsGoal, setMonthlySavingsGoal] = useState(400);
  const [simulateOffline, setSimulateOffline] = useState(false);
  const [browserOnline, setBrowserOnline] = useState<boolean>(() => navigator.onLine);
  const [isSyncingQueue, setIsSyncingQueue] = useState(false);
  const [toasts, setToasts] = useState<QueueSyncNotification[]>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const transactions = useLiveQuery(() => db.transactions.toArray(), [], []);
  const pendingReceipts = useLiveQuery(
    () => db.pendingReceipts.orderBy('createdAt').reverse().toArray(),
    [],
    []
  );
  const budgets = useLiveQuery(() => db.budgets.toArray(), [], []);

  const isEffectivelyOffline = !browserOnline || simulateOffline;

  const pushToast = (notif: Omit<QueueSyncNotification, 'id'>) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [{ ...notif, id }, ...prev.slice(0, 3)]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6500);
  };

  const refreshSettings = async () => {
    const [cur, bud, sav, simOff] = await Promise.all([
      getSetting<string>('defaultCurrency', 'EUR'),
      getSetting<number>('monthlyBudget', 1600),
      getSetting<number>('monthlySavingsGoal', 400),
      getSetting<boolean>('simulateOffline', false),
    ]);
    setCurrency(cur);
    setMonthlyBudget(Number(bud) || 1600);
    setMonthlySavingsGoal(Number(sav) || 400);
    setSimulateOffline(Boolean(simOff));
  };

  useEffect(() => {
    void refreshSettings();

    const unsubAutoSync = registerAutoSyncListeners();
    const unsubNotifs = subscribeQueueNotifications((notif) => {
      pushToast(notif);
    });

    const handleOnlineStatus = () => setBrowserOnline(navigator.onLine);
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);

    return () => {
      unsubAutoSync();
      unsubNotifs();
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
    };
  }, []);

  // Global Paste Listener (Ctrl+V)
  useEffect(() => {
    const handleGlobalPaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) imageFiles.push(blob);
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        await ingestReceiptFiles(imageFiles);
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, []);

  const handleToggleSimulateOffline = async () => {
    const nextVal = !simulateOffline;
    setSimulateOffline(nextVal);
    await setSetting('simulateOffline', nextVal);

    if (nextVal) {
      pushToast({
        type: 'queued',
        message: 'Offline mode enabled. Captured receipts will queue locally.',
      });
    } else {
      pushToast({
        type: 'synced',
        message: 'Back online. Syncing any queued receipts...',
      });
      setIsSyncingQueue(true);
      try {
        await processOfflineQueue(false);
      } finally {
        setIsSyncingQueue(false);
      }
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    e.target.value = '';
    setShowAddActionMenu(false);
    await ingestReceiptFiles(files);
  };

  const handleCameraCaptured = async (file: File) => {
    await ingestReceiptFiles([file]);
  };

  const handleClipboardButtonPaste = async () => {
    setShowAddActionMenu(false);
    try {
      if (!navigator.clipboard?.read) {
        pushToast({
          type: 'error',
          message: 'Press Ctrl+V (or Cmd+V) anywhere to paste a screenshot.',
        });
        return;
      }
      const clipboardItems = await navigator.clipboard.read();
      const blobs: Blob[] = [];
      for (const item of clipboardItems) {
        const imgType = item.types.find((t) => t.startsWith('image/'));
        if (imgType) {
          const blob = await item.getType(imgType);
          blobs.push(blob);
        }
      }
      if (blobs.length === 0) {
        pushToast({
          type: 'error',
          message: 'No image in clipboard. Copy a receipt screenshot first.',
        });
        return;
      }
      await ingestReceiptFiles(blobs);
    } catch {
      pushToast({
        type: 'error',
        message: 'Press Ctrl+V (or Cmd+V) directly to paste an image.',
      });
    }
  };

  const handleLoadDemo = async () => {
    const count = await loadDemoData(currency);
    await refreshSettings();
    pushToast({
      type: 'synced',
      message: `Loaded ${count} realistic demo transactions.`,
    });
  };

  const handleSyncQueueManual = async () => {
    setIsSyncingQueue(true);
    try {
      const count = await processOfflineQueue(true);
      if (count === 0 && isEffectivelyOffline) {
        pushToast({
          type: 'queued',
          message: 'Switch back to Online in the header to sync queued receipts.',
        });
      }
    } finally {
      setIsSyncingQueue(false);
    }
  };

  const handleUndoDelete = async (tx: Transaction, toastId: string) => {
    await db.transactions.put(tx);
    setToasts((prev) => prev.filter((t) => t.id !== toastId));
    pushToast({
      type: 'synced',
      message: `Restored ${tx.merchant} (${formatCurrency(tx.amount, tx.currency || currency)})`,
    });
  };

  return (
    <div className="min-h-screen bg-white text-[#0B1221] flex flex-col">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Minimal Manni Top Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-4">
          {/* Manni Brand Identity Mark */}
          <button
            type="button"
            onClick={() => setActiveTab('feed')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="relative w-9 h-9 rounded-xl bg-[#0B1221] flex items-center justify-center transition-transform group-hover:scale-105">
              <svg
                viewBox="0 0 24 24"
                className="w-4 h-4 fill-white"
                aria-hidden="true"
              >
                <path d="M3.5 19V5h3.2L12 13.4 17.3 5h3.2v14h-3v-8.8L13.1 17h-2.2L6.5 10.2V19h-3Z" />
              </svg>
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#2563EB] ring-2 ring-white" />
            </div>
            <span className="font-display font-extrabold text-[#0B1221] text-lg tracking-tight">
              manni
            </span>
          </button>

          {/* Desktop Navigation Pills */}
          <nav className="hidden md:flex items-center gap-1.5">
            {(
              [
                { id: 'feed', label: 'Home' },
                { id: 'analytics', label: 'Analytics' },
                { id: 'queue', label: 'Queue', badge: pendingReceipts.length },
                { id: 'settings', label: 'Settings' },
              ] as const
            ).map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm transition cursor-pointer ${
                    active
                      ? 'bg-[#EBF0F5] text-[#0B1221] font-semibold'
                      : 'text-[#526077] hover:text-[#0B1221] hover:bg-[#F4F6F9] font-medium'
                  }`}
                >
                  <span>{item.label}</span>
                  {'badge' in item && item.badge ? (
                    <span className="px-1.5 py-0.2 rounded-full bg-[#2563EB] text-white text-[10px] font-bold">
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>

          {/* Compact Connection Status Pill */}
          <button
            type="button"
            onClick={handleToggleSimulateOffline}
            title="Toggle simulated offline mode"
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${
              isEffectivelyOffline
                ? 'bg-[#FEE2E2] text-[#BE123C]'
                : 'bg-[#EBF0F5] text-[#0B1221] hover:bg-[#E1E8F0]'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isEffectivelyOffline ? 'bg-[#BE123C]' : 'bg-[#0D9488]'
              }`}
            />
            <span>{isEffectivelyOffline ? 'Offline' : 'Online'}</span>
          </button>
        </div>
      </header>

      {/* Clean Floating Toast Notifications */}
      {toasts.length > 0 && (
        <div className="fixed top-20 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-[calc(100%-2.5rem)] pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start justify-between gap-3 px-4 py-3.5 rounded-2xl shadow-lg transition-all ${
                t.type === 'error'
                  ? 'bg-[#BE123C] text-white'
                  : 'bg-[#0B1221] text-white'
              }`}
            >
              <div className="flex items-start gap-2.5 text-xs leading-relaxed">
                {t.type === 'error' || t.type === 'warning' ? (
                  <AlertCircle className="w-4 h-4 text-[#60A5FA] shrink-0 mt-0.5" />
                ) : t.type === 'queued' ? (
                  <Clock className="w-4 h-4 text-[#60A5FA] shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-[#2DD4BF] shrink-0 mt-0.5" />
                )}
                <div className="space-y-1.5">
                  <div className="font-medium">{t.message}</div>
                  {t.undoTransaction && (
                    <button
                      type="button"
                      onClick={() => void handleUndoDelete(t.undoTransaction!, t.id)}
                      className="inline-flex items-center gap-1 text-[#60A5FA] hover:underline font-semibold cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Undo delete</span>
                    </button>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
                className="text-white/60 hover:text-white p-0.5 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Spacious Main Content Canvas */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-5 sm:px-8 pt-6 sm:pt-10">
        {activeTab === 'feed' && (
          <TransactionFeed
            transactions={transactions}
            pendingReceipts={pendingReceipts}
            currency={currency}
            monthlyBudget={monthlyBudget}
            isOffline={isEffectivelyOffline}
            isSyncingQueue={isSyncingQueue}
            onSelectTransaction={(tx) => setSelectedTransaction(tx)}
            onOpenManualEntry={() => setShowManualModal(true)}
            onOpenCamera={() => setShowCameraModal(true)}
            onTriggerFileUpload={() => fileInputRef.current?.click()}
            onPasteClipboard={handleClipboardButtonPaste}
            onLoadDemoData={handleLoadDemo}
            onSyncQueueNow={handleSyncQueueManual}
            onOpenQueueTab={() => setActiveTab('queue')}
            onExportSummaryCSV={() => {
              exportSummaryCSV(transactions);
              pushToast({ type: 'synced', message: 'Summary CSV downloaded.' });
            }}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsDashboard
            transactions={transactions}
            budgets={budgets}
            currency={currency}
            monthlyBudget={monthlyBudget}
            monthlySavingsGoal={monthlySavingsGoal}
            onLoadDemoData={handleLoadDemo}
          />
        )}

        {activeTab === 'queue' && (
          <QueueView
            pendingReceipts={pendingReceipts}
            isOffline={isEffectivelyOffline}
            onTriggerUpload={() => fileInputRef.current?.click()}
            onOpenCamera={() => setShowCameraModal(true)}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            transactions={transactions}
            currency={currency}
            monthlyBudget={monthlyBudget}
            monthlySavingsGoal={monthlySavingsGoal}
            onSettingsChanged={refreshSettings}
            onLoadDemoData={handleLoadDemo}
            onShowToast={(msg) => pushToast({ type: 'synced', message: msg })}
          />
        )}
      </main>

      {/* Mobile Add / Scan Bottom Sheet */}
      {showAddActionMenu && (
        <div
          className="fixed inset-0 z-40 bg-[#0B1221]/40 backdrop-blur-xs flex items-end justify-center p-4 pb-24 sm:pb-8"
          onClick={() => setShowAddActionMenu(false)}
        >
          <div
            className="bg-white rounded-3xl p-4 shadow-2xl w-full max-w-sm space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 pt-1 pb-2 text-xs font-semibold text-[#526077]">
              Quick actions
            </div>
            <button
              type="button"
              onClick={() => {
                setShowAddActionMenu(false);
                setShowCameraModal(true);
              }}
              className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-sm transition cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>Scan receipt with camera</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl bg-[#F4F6F9] hover:bg-[#E9EEF5] text-[#0B1221] font-medium text-sm transition cursor-pointer"
            >
              <Upload className="w-4 h-4 text-[#2563EB]" />
              <span>Upload receipt photo</span>
            </button>

            <button
              type="button"
              onClick={handleClipboardButtonPaste}
              className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl bg-[#F4F6F9] hover:bg-[#E9EEF5] text-[#0B1221] font-medium text-sm transition cursor-pointer"
            >
              <ClipboardPaste className="w-4 h-4 text-[#2563EB]" />
              <span>Paste screenshot</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowAddActionMenu(false);
                setShowManualModal(true);
              }}
              className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl bg-[#F4F6F9] hover:bg-[#E9EEF5] text-[#0B1221] font-medium text-sm transition cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#2563EB]" />
              <span>Add manual transaction</span>
            </button>
          </div>
        </div>
      )}

      {/* Flat Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-[#E6EAF0] px-3 py-2 flex items-center justify-around">
        <button
          type="button"
          onClick={() => setActiveTab('feed')}
          className={`flex flex-col items-center gap-1 py-1 px-3 text-[11px] cursor-pointer transition ${
            activeTab === 'feed'
              ? 'text-[#0B1221] font-semibold'
              : 'text-[#7C8BA1] font-medium'
          }`}
        >
          <Home className="w-5 h-5" strokeWidth={activeTab === 'feed' ? 2.2 : 1.7} />
          <span>Home</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('analytics')}
          className={`flex flex-col items-center gap-1 py-1 px-3 text-[11px] cursor-pointer transition ${
            activeTab === 'analytics'
              ? 'text-[#0B1221] font-semibold'
              : 'text-[#7C8BA1] font-medium'
          }`}
        >
          <BarChart2 className="w-5 h-5" strokeWidth={activeTab === 'analytics' ? 2.2 : 1.7} />
          <span>Analytics</span>
        </button>

        <button
          type="button"
          onClick={() => setShowAddActionMenu((v) => !v)}
          className="flex items-center justify-center w-11 h-11 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white transition cursor-pointer"
          aria-label="Quick actions"
        >
          <Plus className="w-5 h-5" strokeWidth={2.5} />
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('queue')}
          className={`relative flex flex-col items-center gap-1 py-1 px-3 text-[11px] cursor-pointer transition ${
            activeTab === 'queue'
              ? 'text-[#0B1221] font-semibold'
              : 'text-[#7C8BA1] font-medium'
          }`}
        >
          <Clock className="w-5 h-5" strokeWidth={activeTab === 'queue' ? 2.2 : 1.7} />
          <span>Queue</span>
          {pendingReceipts.length > 0 && (
            <span className="absolute top-0.5 right-2 w-4 h-4 rounded-full bg-[#2563EB] text-white text-[10px] font-bold flex items-center justify-center">
              {pendingReceipts.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center gap-1 py-1 px-3 text-[11px] cursor-pointer transition ${
            activeTab === 'settings'
              ? 'text-[#0B1221] font-semibold'
              : 'text-[#7C8BA1] font-medium'
          }`}
        >
          <SlidersHorizontal className="w-5 h-5" strokeWidth={activeTab === 'settings' ? 2.2 : 1.7} />
          <span>Settings</span>
        </button>
      </nav>

      {/* Modals */}
      {showManualModal && (
        <ManualEntryModal
          currency={currency}
          transactions={transactions}
          onClose={() => setShowManualModal(false)}
          onSaved={(tx) =>
            pushToast({
              type: 'synced',
              message: `Saved ${tx.merchant} (${formatCurrency(tx.amount, tx.currency || currency)})`,
            })
          }
        />
      )}

      {showCameraModal && (
        <CameraCaptureModal
          onCapture={(file) => void handleCameraCaptured(file)}
          onClose={() => setShowCameraModal(false)}
        />
      )}

      {selectedTransaction && (
        <TransactionDetailModal
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
          onUpdated={() =>
            pushToast({
              type: 'synced',
              message: 'Transaction updated.',
            })
          }
          onDeleted={(deletedTx) =>
            pushToast({
              type: 'synced',
              message: `Deleted ${deletedTx.merchant} (${formatCurrency(
                deletedTx.amount,
                deletedTx.currency || currency
              )})`,
              undoTransaction: deletedTx,
            })
          }
        />
      )}
    </div>
  );
}
