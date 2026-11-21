import React, { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Receipt,
  PieChart,
  Plus,
  Clock,
  Settings,
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
    <div className="min-h-screen bg-[#f7f8fa] text-slate-900 flex flex-col">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Minimal, Clean Sticky Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/70">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          {/* Brand */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold text-sm">
              S
            </div>
            <span className="font-bold text-slate-900 text-base tracking-tight">
              Spendee<span className="text-emerald-600">AI</span>
            </span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {(
              [
                { id: 'feed', label: 'Feed', icon: Receipt },
                { id: 'analytics', label: 'Analytics', icon: PieChart },
                {
                  id: 'queue',
                  label: 'Queue',
                  icon: Clock,
                  badge: pendingReceipts.length,
                },
                { id: 'settings', label: 'Settings', icon: Settings },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                    active
                      ? 'bg-slate-100 text-slate-900 font-semibold'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                  {'badge' in item && item.badge ? (
                    <span className="px-1.5 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>

          {/* Compact Status Toggle */}
          <button
            type="button"
            onClick={handleToggleSimulateOffline}
            title="Toggle simulated offline mode"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition cursor-pointer ${
              isEffectivelyOffline
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isEffectivelyOffline ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
            />
            <span>{isEffectivelyOffline ? 'Offline' : 'Online'}</span>
          </button>
        </div>
      </header>

      {/* Toast Notifications with Undo support */}
      {toasts.length > 0 && (
        <div className="fixed top-16 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start justify-between gap-2.5 p-3 rounded-xl shadow-lg border transition-all ${
                t.type === 'error'
                  ? 'bg-rose-950 text-white border-rose-800'
                  : t.type === 'warning'
                  ? 'bg-amber-950 text-amber-50 border-amber-700'
                  : t.type === 'queued'
                  ? 'bg-slate-900 text-amber-100 border-slate-700'
                  : 'bg-slate-900 text-white border-slate-800'
              }`}
            >
              <div className="flex items-start gap-2 text-xs">
                {t.type === 'error' || t.type === 'warning' ? (
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                ) : t.type === 'queued' ? (
                  <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <div className="font-medium leading-snug">{t.message}</div>
                  {t.undoTransaction && (
                    <button
                      type="button"
                      onClick={() => void handleUndoDelete(t.undoTransaction!, t.id)}
                      className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-semibold underline cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Undo Delete</span>
                    </button>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
                className="text-slate-400 hover:text-white p-0.5 cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 pt-5">
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

      {/* Mobile Add / Scan Action Sheet */}
      {showAddActionMenu && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs flex items-end justify-center pb-20 sm:pb-8"
          onClick={() => setShowAddActionMenu(false)}
        >
          <div
            className="bg-white rounded-2xl p-3 shadow-xl border border-slate-200 w-full max-w-xs mx-4 space-y-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                setShowAddActionMenu(false);
                setShowCameraModal(true);
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 text-slate-900 font-medium text-sm transition cursor-pointer"
            >
              <Camera className="w-4 h-4 text-emerald-600" />
              <span>Take Receipt Photo</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 text-slate-900 font-medium text-sm transition cursor-pointer"
            >
              <Upload className="w-4 h-4 text-slate-600" />
              <span>Upload Receipt Image</span>
            </button>

            <button
              type="button"
              onClick={handleClipboardButtonPaste}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 text-slate-900 font-medium text-sm transition cursor-pointer"
            >
              <ClipboardPaste className="w-4 h-4 text-slate-600" />
              <span>Paste Screenshot</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowAddActionMenu(false);
                setShowManualModal(true);
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 text-slate-900 font-medium text-sm transition cursor-pointer"
            >
              <Plus className="w-4 h-4 text-slate-600" />
              <span>Manual Entry</span>
            </button>
          </div>
        </div>
      )}

      {/* Sticky Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 flex items-center justify-around">
        <button
          type="button"
          onClick={() => setActiveTab('feed')}
          className={`flex flex-col items-center py-1 px-3 rounded-xl text-[11px] font-medium cursor-pointer ${
            activeTab === 'feed' ? 'text-slate-900 font-semibold' : 'text-slate-400'
          }`}
        >
          <Receipt className="w-5 h-5 mb-0.5" />
          <span>Feed</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('analytics')}
          className={`flex flex-col items-center py-1 px-3 rounded-xl text-[11px] font-medium cursor-pointer ${
            activeTab === 'analytics' ? 'text-slate-900 font-semibold' : 'text-slate-400'
          }`}
        >
          <PieChart className="w-5 h-5 mb-0.5" />
          <span>Analytics</span>
        </button>

        <button
          type="button"
          onClick={() => setShowAddActionMenu((v) => !v)}
          className="flex items-center justify-center -mt-4 w-12 h-12 rounded-full bg-emerald-600 text-white shadow-md cursor-pointer"
          aria-label="Add or scan"
        >
          <Plus className="w-6 h-6" />
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('queue')}
          className={`relative flex flex-col items-center py-1 px-3 rounded-xl text-[11px] font-medium cursor-pointer ${
            activeTab === 'queue' ? 'text-slate-900 font-semibold' : 'text-slate-400'
          }`}
        >
          <Clock className="w-5 h-5 mb-0.5" />
          <span>Queue</span>
          {pendingReceipts.length > 0 && (
            <span className="absolute top-0.5 right-2 w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
              {pendingReceipts.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center py-1 px-3 rounded-xl text-[11px] font-medium cursor-pointer ${
            activeTab === 'settings' ? 'text-slate-900 font-semibold' : 'text-slate-400'
          }`}
        >
          <Settings className="w-5 h-5 mb-0.5" />
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
