import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Receipt,
  PieChart,
  Plus,
  Clock,
  Settings,
  Wifi,
  WifiOff,
  Camera,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  X,
} from 'lucide-react';
import {
  db,
  getSetting,
  setSetting,
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

type NavTab = 'feed' | 'analytics' | 'queue' | 'settings';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('feed');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showManualModal, setShowManualModal] = useState(false);
  const [showAddActionMenu, setShowAddActionMenu] = useState(false);

  const [currency, setCurrency] = useState('EUR');
  const [monthlyBudget, setMonthlyBudget] = useState(1600);
  const [simulateOffline, setSimulateOffline] = useState(false);
  const [browserOnline, setBrowserOnline] = useState<boolean>(() => navigator.onLine);
  const [isSyncingQueue, setIsSyncingQueue] = useState(false);
  const [toasts, setToasts] = useState<QueueSyncNotification[]>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Live reactive queries from IndexedDB via dexie-react-hooks
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
    }, 5500);
  };

  const refreshSettings = async () => {
    const [cur, bud, simOff] = await Promise.all([
      getSetting<string>('defaultCurrency', 'EUR'),
      getSetting<number>('monthlyBudget', 1600),
      getSetting<boolean>('simulateOffline', false),
    ]);
    setCurrency(cur);
    setMonthlyBudget(Number(bud) || 1600);
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

  // Global Paste Listener (Ctrl+V / Mobile Clipboard Screenshot Capture)
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

  // Toggle "Online / Simulate Offline" mode in header
  const handleToggleSimulateOffline = async () => {
    const nextVal = !simulateOffline;
    setSimulateOffline(nextVal);
    await setSetting('simulateOffline', nextVal);

    if (nextVal) {
      pushToast({
        type: 'queued',
        message:
          'Simulate Offline Mode ON: Any scanned or pasted receipts will queue locally in IndexedDB.',
      });
    } else {
      pushToast({
        type: 'synced',
        message: 'Back Online! Checking Offline Queue for pending receipts...',
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

  const handleClipboardButtonPaste = async () => {
    setShowAddActionMenu(false);
    try {
      if (!navigator.clipboard?.read) {
        pushToast({
          type: 'error',
          message: 'Press Ctrl+V (or Cmd+V) anywhere on the page to paste a screenshot.',
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
          message: 'No image found in clipboard. Copy a receipt screenshot first or press Ctrl+V.',
        });
        return;
      }
      await ingestReceiptFiles(blobs);
    } catch {
      pushToast({
        type: 'error',
        message: 'Clipboard permission blocked — simply press Ctrl+V (or Cmd+V) to paste!',
      });
    }
  };

  const handleLoadDemo = async () => {
    const count = await loadDemoData(currency);
    await refreshSettings();
    pushToast({
      type: 'synced',
      message: `Loaded ${count} realistic demo receipts with itemized line items!`,
    });
  };

  const handleSyncQueueManual = async () => {
    setIsSyncingQueue(true);
    try {
      const count = await processOfflineQueue(true);
      if (count === 0 && isEffectivelyOffline) {
        pushToast({
          type: 'queued',
          message: 'Switch "Simulate Offline" back to "Online" in the top bar to sync.',
        });
      }
    } finally {
      setIsSyncingQueue(false);
    }
  };

  const existingMerchants = useMemo(() => {
    const set = new Set<string>();
    for (const tx of transactions) {
      if (tx.merchant) set.add(tx.merchant);
    }
    return Array.from(set);
  }, [transactions]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Hidden multi-file receipt input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Sticky Top Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          {/* Brand Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-sm">
              S
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-extrabold text-slate-900 text-base sm:text-lg tracking-tight leading-none">
                  Spendee<span className="text-emerald-600">AI</span>
                </h1>
                <span className="hidden sm:inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Local-First PWA
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                100% Free Offline Receipt & Expense Tracker
              </p>
            </div>
          </div>

          {/* Desktop Navigation Pills */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-2xl">
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
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    active
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  {'badge' in item && item.badge ? (
                    <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>

          {/* Right Header Controls: Visible "Online / Simulate Offline" Toggle Pill + Quick Scan */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleSimulateOffline}
              title="Click to toggle Simulate Offline Mode and test the Offline Receipt Queue!"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition cursor-pointer ${
                isEffectivelyOffline
                  ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-2xs'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              {isEffectivelyOffline ? (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                  <span>Simulate Offline: ON</span>
                </>
              ) : (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Online (Click to Test Offline)</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-2xs transition cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>Scan Receipt</span>
            </button>
          </div>
        </div>
      </header>

      {/* Toast Notifications Stack */}
      {toasts.length > 0 && (
        <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start justify-between gap-2.5 p-3.5 rounded-2xl shadow-lg border backdrop-blur-md transition-all ${
                t.type === 'error'
                  ? 'bg-rose-950/95 text-white border-rose-700'
                  : t.type === 'queued'
                  ? 'bg-amber-950/95 text-amber-50 border-amber-700'
                  : 'bg-slate-900/95 text-white border-emerald-500/40'
              }`}
            >
              <div className="flex items-start gap-2.5 text-xs sm:text-sm">
                {t.type === 'error' ? (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                ) : t.type === 'queued' ? (
                  <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                )}
                <span className="font-medium leading-snug">{t.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
                className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 pt-5">
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
            onTriggerFileUpload={() => fileInputRef.current?.click()}
            onPasteClipboard={handleClipboardButtonPaste}
            onLoadDemoData={handleLoadDemo}
            onSyncQueueNow={handleSyncQueueManual}
            onOpenQueueTab={() => setActiveTab('queue')}
            onExportSummaryCSV={() => {
              exportSummaryCSV(transactions);
              pushToast({ type: 'synced', message: 'Summary CSV downloaded!' });
            }}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsDashboard
            transactions={transactions}
            budgets={budgets}
            currency={currency}
            monthlyBudget={monthlyBudget}
            onLoadDemoData={handleLoadDemo}
          />
        )}

        {activeTab === 'queue' && (
          <QueueView
            pendingReceipts={pendingReceipts}
            isOffline={isEffectivelyOffline}
            currency={currency}
            onTriggerUpload={() => fileInputRef.current?.click()}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            transactions={transactions}
            currency={currency}
            monthlyBudget={monthlyBudget}
            onSettingsChanged={refreshSettings}
            onLoadDemoData={handleLoadDemo}
            onShowToast={(msg) => pushToast({ type: 'synced', message: msg })}
          />
        )}
      </main>

      {/* Floating Action Menu Popup when "+ Add / Scan" is tapped */}
      {showAddActionMenu && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs flex items-end justify-center pb-20 sm:pb-8"
          onClick={() => setShowAddActionMenu(false)}
        >
          <div
            className="bg-white rounded-3xl p-4 shadow-2xl border border-slate-200 w-full max-w-xs mx-4 space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 px-2 pb-1">
              Add Expense or Scan Receipt
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center gap-3 p-3 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-semibold text-sm transition cursor-pointer"
            >
              <Camera className="w-5 h-5 text-emerald-600" />
              <div className="text-left">
                <div>Snap / Upload Receipt</div>
                <div className="text-[11px] font-normal text-emerald-700">
                  AI or Local OCR extraction
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={handleClipboardButtonPaste}
              className="w-full flex items-center gap-3 p-3 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 font-semibold text-sm transition cursor-pointer"
            >
              <Sparkles className="w-5 h-5 text-indigo-600" />
              <div className="text-left">
                <div>1-Tap Paste Screenshot</div>
                <div className="text-[11px] font-normal text-indigo-700">
                  Grab receipt from clipboard
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowAddActionMenu(false);
                setShowManualModal(true);
              }}
              className="w-full flex items-center gap-3 p-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold text-sm transition cursor-pointer"
            >
              <Plus className="w-5 h-5 text-slate-700" />
              <div className="text-left">
                <div>Fast Manual Keypad Entry</div>
                <div className="text-[11px] font-normal text-slate-600">
                  Spendee calculator modal
                </div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Desktop Floating Action Button (FAB) */}
      <div className="hidden md:flex fixed bottom-6 right-6 z-30 items-center gap-2">
        <button
          type="button"
          onClick={() => setShowManualModal(true)}
          className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm shadow-lg transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Manual Entry</span>
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-sm shadow-lg shadow-emerald-900/20 transition cursor-pointer"
        >
          <Camera className="w-4 h-4" />
          <span>+ Scan Receipt</span>
        </button>
      </div>

      {/* Sticky Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 flex items-center justify-around">
        <button
          type="button"
          onClick={() => setActiveTab('feed')}
          className={`flex flex-col items-center py-1 px-3 rounded-xl text-[11px] font-semibold cursor-pointer ${
            activeTab === 'feed' ? 'text-emerald-600' : 'text-slate-500'
          }`}
        >
          <Receipt className="w-5 h-5 mb-0.5" />
          <span>Feed</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('analytics')}
          className={`flex flex-col items-center py-1 px-3 rounded-xl text-[11px] font-semibold cursor-pointer ${
            activeTab === 'analytics' ? 'text-emerald-600' : 'text-slate-500'
          }`}
        >
          <PieChart className="w-5 h-5 mb-0.5" />
          <span>Analytics</span>
        </button>

        {/* Center Raised "+ Add / Scan" FAB */}
        <button
          type="button"
          onClick={() => setShowAddActionMenu((v) => !v)}
          className="flex flex-col items-center justify-center -mt-5 w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-600/30 cursor-pointer"
        >
          <Plus className="w-6 h-6" />
          <span className="text-[9px] font-bold">Add/Scan</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('queue')}
          className={`relative flex flex-col items-center py-1 px-3 rounded-xl text-[11px] font-semibold cursor-pointer ${
            activeTab === 'queue' ? 'text-emerald-600' : 'text-slate-500'
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
          className={`flex flex-col items-center py-1 px-3 rounded-xl text-[11px] font-semibold cursor-pointer ${
            activeTab === 'settings' ? 'text-emerald-600' : 'text-slate-500'
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
          existingMerchants={existingMerchants}
          onClose={() => setShowManualModal(false)}
          onSaved={(tx) =>
            pushToast({
              type: 'synced',
              message: `Saved ${tx.merchant} (${tx.currency} ${tx.amount.toFixed(2)})`,
            })
          }
        />
      )}

      {selectedTransaction && (
        <TransactionDetailModal
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
          onUpdated={() =>
            pushToast({
              type: 'synced',
              message: 'Transaction updated!',
            })
          }
        />
      )}
    </div>
  );
}
