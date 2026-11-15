import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  Cpu,
  Download,
  Upload,
  Sparkles,
  Trash2,
  Cloud,
  Landmark,
  CheckCircle2,
  FileSpreadsheet,
  FileJson,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import {
  db,
  getSetting,
  setSetting,
  CURRENCY_SYMBOLS,
  type Transaction,
} from '../db/db';
import {
  exportSummaryCSV,
  exportItemizedCSV,
  exportFullBackupJSON,
  importFullBackupJSON,
} from '../utils/exportData';
import { availableSyncAdapters } from '../services/syncAdapter';

interface SettingsViewProps {
  transactions: Transaction[];
  currency: string;
  monthlyBudget: number;
  onSettingsChanged: () => void;
  onLoadDemoData: () => void;
  onShowToast: (msg: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  transactions,
  currency,
  monthlyBudget,
  onSettingsChanged,
  onLoadDemoData,
  onShowToast,
}) => {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gemini-2.5-flash');
  const [selectedCurrency, setSelectedCurrency] = useState(currency);
  const [budgetInput, setBudgetInput] = useState(String(monthlyBudget));
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const k = await getSetting<string>('geminiApiKey', '');
      const m = await getSetting<string>('geminiModel', 'gemini-2.5-flash');
      setApiKey(k);
      setModel(m);
    })();
  }, []);

  useEffect(() => {
    setSelectedCurrency(currency);
  }, [currency]);

  useEffect(() => {
    setBudgetInput(String(monthlyBudget));
  }, [monthlyBudget]);

  const handleSaveAISettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await setSetting('geminiApiKey', apiKey.trim());
    await setSetting('geminiModel', model);
    onSettingsChanged();
    onShowToast('AI & Gemini settings saved locally!');
  };

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericBudget = Math.max(50, parseFloat(budgetInput) || 1500);
    await setSetting('defaultCurrency', selectedCurrency);
    await setSetting('monthlyBudget', numericBudget);
    await db.budgets.put({
      id: 'budget-all',
      category: 'ALL',
      monthlyLimit: numericBudget,
    });
    onSettingsChanged();
    onShowToast(`Preferences updated (${selectedCurrency}, Budget: ${numericBudget})`);
  };

  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await importFullBackupJSON(file);
      onSettingsChanged();
      onShowToast(`Restored ${res.transactionsCount} transactions from backup!`);
    } catch (err) {
      onShowToast(
        err instanceof Error ? err.message : 'Failed to import JSON backup file.'
      );
    } finally {
      e.target.value = '';
    }
  };

  const handleClearAllData = async () => {
    await db.transaction('rw', db.transactions, db.pendingReceipts, db.budgets, async () => {
      await db.transactions.clear();
      await db.pendingReceipts.clear();
      await db.budgets.clear();
    });
    onSettingsChanged();
    onShowToast('All local transactions and queued receipts cleared.');
  };

  const handleTestSyncAdapter = async (adapterId: string, action: 'connect' | 'push' | 'pull') => {
    const adapter = availableSyncAdapters.find((a) => a.id === adapterId);
    if (!adapter) return;
    if (action === 'connect') {
      const info = await adapter.connectBank();
      setSyncMessage(`${adapter.name}: ${info.institutionName} (${info.provider}) ready.`);
    } else if (action === 'push') {
      const res = await adapter.pushTransactions(transactions);
      setSyncMessage(res.message);
    } else {
      const res = await adapter.pullTransactions();
      setSyncMessage(res.message);
    }
  };

  return (
    <div className="space-y-6 pb-24 max-w-4xl mx-auto">
      {/* 100% Free & Local Privacy Banner */}
      <div className="bg-emerald-950 text-white rounded-2xl p-5 flex items-start gap-3.5 shadow-sm">
        <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-300 shrink-0">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <div>
          <h2 className="font-bold text-base sm:text-lg">
            100% Local-First & Free Forever Architecture
          </h2>
          <p className="text-xs sm:text-sm text-emerald-100/85 mt-0.5 leading-relaxed">
            Every transaction, receipt image, and budget lives inside your browser’s local IndexedDB (`SpendeeAIDB`). Zero cloud database bills, instant offline access, and complete financial privacy.
          </p>
        </div>
      </div>

      {/* 1. AI Receipt Extraction Configuration */}
      <form
        onSubmit={handleSaveAISettings}
        className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Dual-Mode AI Receipt Extraction
              </h3>
              <p className="text-xs text-slate-500">
                Primary: Google AI Studio Gemini Structured Output • Fallback: Keyless In-Browser Tesseract OCR
              </p>
            </div>
          </div>
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              apiKey.trim().length > 10
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-amber-50 text-amber-800 border border-amber-200'
            }`}
          >
            {apiKey.trim().length > 10 ? 'Gemini Flash Active' : 'Keyless Local OCR Mode'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Google AI Studio Gemini API Key (Stored Only in LocalStorage / IndexedDB)
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIzaSy... (Leave blank to use free keyless in-browser OCR)"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5 text-slate-400" />
              <span>Gemini Model</span>
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="gemini-2.5-flash">gemini-2.5-flash (Default)</option>
              <option value="gemini-3-flash-preview">gemini-3-flash-preview</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-slate-500">
            Without an API key, SpendeeAI automatically extracts dates, totals, and items locally via `tesseract.js`.
          </p>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs sm:text-sm transition cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Save AI Settings</span>
          </button>
        </div>
      </form>

      {/* 2. Currency & Monthly Budget Target */}
      <form
        onSubmit={handleSavePreferences}
        className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-4"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">
              Currency & Monthly Budget Target
            </h3>
            <p className="text-xs text-slate-500">
              Configure your default display currency and monthly spending alert threshold
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Default Currency
            </label>
            <select
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm bg-white"
            >
              {Object.entries(CURRENCY_SYMBOLS).map(([code, sym]) => (
                <option key={code} value={code}>
                  {code} ({sym.trim()})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Monthly Overall Budget Target ({selectedCurrency})
            </label>
            <input
              type="number"
              step="10"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm font-semibold"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm transition cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Update Budget & Currency</span>
          </button>
        </div>
      </form>

      {/* 3. Spreadsheet CSV Exports & Full JSON Backup */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">
              Data Export (Excel / Sheets CSV & Full JSON Backup)
            </h3>
            <p className="text-xs text-slate-500">
              UTF-8 BOM encoded so currency symbols and accents open cleanly in Excel & Google Sheets
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              exportSummaryCSV(transactions);
              onShowToast('Exported Summary CSV!');
            }}
            className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/40 transition text-left cursor-pointer"
          >
            <div>
              <div className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Export Summary CSV (.csv)</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                1 row per transaction ({transactions.length} rows)
              </p>
            </div>
            <Download className="w-4 h-4 text-slate-400" />
          </button>

          <button
            type="button"
            onClick={() => {
              exportItemizedCSV(transactions);
              onShowToast('Exported Itemized Line-Items CSV!');
            }}
            className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 transition text-left cursor-pointer"
          >
            <div>
              <div className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                <span>Export Itemized Line-Items CSV (.csv)</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Flattens every receipt line item for Pivot Tables
              </p>
            </div>
            <Download className="w-4 h-4 text-slate-400" />
          </button>

          <button
            type="button"
            onClick={() => {
              void exportFullBackupJSON();
              onShowToast('Exported Full IndexedDB JSON Backup!');
            }}
            className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 hover:border-amber-400 hover:bg-amber-50/40 transition text-left cursor-pointer"
          >
            <div>
              <div className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <FileJson className="w-4 h-4 text-amber-600" />
                <span>Export Full JSON Backup (.json)</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Complete database state including receipt thumbnails
              </p>
            </div>
            <Download className="w-4 h-4 text-slate-400" />
          </button>

          <label className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 hover:border-teal-400 hover:bg-teal-50/40 transition text-left cursor-pointer">
            <div>
              <div className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <Upload className="w-4 h-4 text-teal-600" />
                <span>Restore JSON Backup (.json)</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Import a SpendeeAI backup file from any device
              </p>
            </div>
            <Upload className="w-4 h-4 text-slate-400" />
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleImportJSON}
              className="hidden"
            />
          </label>
        </div>

        {/* Demo Data & Reset Controls */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onLoadDemoData}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold text-xs sm:text-sm transition cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>Load Realistic Demo Data (15 Receipts)</span>
          </button>

          <button
            type="button"
            onClick={handleClearAllData}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs sm:text-sm transition cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear All Local Data</span>
          </button>
        </div>
      </div>

      {/* 4. Future Sync (Cloud & Open Banking) Preview Section */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-50 text-cyan-600">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">
              Future Sync (Cloud & Open Banking Adapters)
            </h3>
            <p className="text-xs text-slate-500">
              Pluggable `ExternalSyncAdapter` interface ready for Supabase Cloud or GoCardless/Plaid PSD2 bank feeds
            </p>
          </div>
        </div>

        {syncMessage && (
          <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-xs font-medium text-indigo-900">
            {syncMessage}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {availableSyncAdapters.map((adapter) => (
            <div
              key={adapter.id}
              className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                  {adapter.id.includes('bank') ? (
                    <Landmark className="w-4 h-4 text-indigo-600" />
                  ) : (
                    <Cloud className="w-4 h-4 text-emerald-600" />
                  )}
                  <span>{adapter.name}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {adapter.description}
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleTestSyncAdapter(adapter.id, 'connect')}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  Connect
                </button>
                <button
                  type="button"
                  onClick={() => handleTestSyncAdapter(adapter.id, 'push')}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  Push ({transactions.length})
                </button>
                <button
                  type="button"
                  onClick={() => handleTestSyncAdapter(adapter.id, 'pull')}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  Pull
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
