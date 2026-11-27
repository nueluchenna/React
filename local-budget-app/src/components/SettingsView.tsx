import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  Cpu,
  Download,
  Upload,
  Trash2,
  Cloud,
  Landmark,
  CheckCircle2,
  FileSpreadsheet,
  FileJson,
  ShieldCheck,
  Wallet,
  AlertCircle,
  Loader2,
  HardDrive,
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
import {
  DEFAULT_GROQ_MODEL,
  DEFAULT_OPENROUTER_MODEL,
  fetchGroqModels,
  fetchOpenRouterFreeVisionModels,
  testGeminiApiKey,
  testGroqApiKey,
  testOpenRouterApiKey,
  type AIProvider,
} from '../services/aiReceiptParser';

interface SettingsViewProps {
  transactions: Transaction[];
  currency: string;
  monthlyBudget: number;
  monthlySavingsGoal: number;
  onSettingsChanged: () => void;
  onLoadDemoData: () => void;
  onShowToast: (msg: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  transactions,
  currency,
  monthlyBudget,
  monthlySavingsGoal,
  onSettingsChanged,
  onLoadDemoData,
  onShowToast,
}) => {
  const [provider, setProvider] = useState<AIProvider>('openrouter');
  const [openRouterApiKey, setOpenRouterApiKey] = useState('');
  const [openRouterModel, setOpenRouterModel] = useState(DEFAULT_OPENROUTER_MODEL);
  const [liveOpenRouterModels, setLiveOpenRouterModels] = useState<string[]>([
    DEFAULT_OPENROUTER_MODEL,
  ]);
  const [loadingOpenRouterModels, setLoadingOpenRouterModels] = useState(false);

  const [groqApiKey, setGroqApiKey] = useState('');
  const [groqModel, setGroqModel] = useState(DEFAULT_GROQ_MODEL);
  const [liveGroqModels, setLiveGroqModels] = useState<string[]>([
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'qwen/qwen3.8-27b',
  ]);
  const [loadingGroqModels, setLoadingGroqModels] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gemini-2.5-flash');
  const [selectedCurrency, setSelectedCurrency] = useState(currency);
  const [budgetInput, setBudgetInput] = useState(String(monthlyBudget));
  const [savingsGoalInput, setSavingsGoalInput] = useState(String(monthlySavingsGoal));
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const [testingKey, setTestingKey] = useState(false);
  const [keyTestResult, setKeyTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const [isPersisted, setIsPersisted] = useState<boolean | null>(null);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const [p, ork, orm, gk, gm, k, m, backupTs] = await Promise.all([
        getSetting<AIProvider>('aiProvider', 'openrouter'),
        getSetting<string>('openRouterApiKey', ''),
        getSetting<string>('openRouterModel', DEFAULT_OPENROUTER_MODEL),
        getSetting<string>('groqApiKey', ''),
        getSetting<string>('groqModel', DEFAULT_GROQ_MODEL),
        getSetting<string>('geminiApiKey', ''),
        getSetting<string>('geminiModel', 'gemini-2.5-flash'),
        getSetting<string | null>('lastBackupAt', null),
      ]);
      const migratedGroqModel =
        gm === 'meta-llama/llama-4-maverick-17b-128e-instruct' ||
        gm === 'meta-llama/llama-4-scout-17b-16e-instruct'
          ? DEFAULT_GROQ_MODEL
          : gm;

      setProvider(p);
      setOpenRouterApiKey(ork);
      setOpenRouterModel(orm || DEFAULT_OPENROUTER_MODEL);
      setGroqApiKey(gk);
      setGroqModel(migratedGroqModel);
      if (migratedGroqModel !== gm) {
        await setSetting('groqModel', migratedGroqModel);
      }
      setApiKey(k);
      setModel(m);
      setLastBackupAt(backupTs);

      if (navigator.storage?.persisted) {
        const persisted = await navigator.storage.persisted();
        setIsPersisted(persisted);
      }
    })();
  }, []);

  useEffect(() => {
    setSelectedCurrency(currency);
  }, [currency]);

  useEffect(() => {
    setBudgetInput(String(monthlyBudget));
  }, [monthlyBudget]);

  useEffect(() => {
    setSavingsGoalInput(String(monthlySavingsGoal));
  }, [monthlySavingsGoal]);

  const handleSaveAISettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await setSetting('aiProvider', provider);
    await setSetting('openRouterApiKey', openRouterApiKey.trim());
    await setSetting('openRouterModel', openRouterModel.trim() || DEFAULT_OPENROUTER_MODEL);
    await setSetting('groqApiKey', groqApiKey.trim());
    await setSetting('groqModel', groqModel);
    await setSetting('geminiApiKey', apiKey.trim());
    await setSetting('geminiModel', model);
    setKeyTestResult(null);
    onSettingsChanged();
    const label =
      provider === 'openrouter'
        ? 'OpenRouter Free Vision'
        : provider === 'groq'
        ? 'Groq'
        : 'Gemini';
    onShowToast(`${label} settings saved locally.`);
  };

  const handleRefreshOpenRouterModels = async () => {
    setLoadingOpenRouterModels(true);
    try {
      const models = await fetchOpenRouterFreeVisionModels();
      if (models.length > 0) {
        setLiveOpenRouterModels(models);
        if (!models.includes(openRouterModel)) {
          setOpenRouterModel(models[0]);
        }
        onShowToast(`Loaded ${models.length} free OpenRouter vision option(s).`);
      }
    } catch (err) {
      onShowToast(
        err instanceof Error ? err.message : 'Could not fetch OpenRouter free vision models.'
      );
    } finally {
      setLoadingOpenRouterModels(false);
    }
  };

  const handleRefreshGroqModels = async () => {
    if (!groqApiKey.trim()) return;
    setLoadingGroqModels(true);
    try {
      const models = await fetchGroqModels(groqApiKey.trim());
      if (models.length > 0) {
        setLiveGroqModels(models);
        if (!models.includes(groqModel)) {
          setGroqModel(models[0]);
        }
        onShowToast(`Loaded ${models.length} active Groq models from your account.`);
      }
    } catch (err) {
      onShowToast(
        err instanceof Error ? err.message : 'Could not fetch live Groq models.'
      );
    } finally {
      setLoadingGroqModels(false);
    }
  };

  const handleTestApiKey = async () => {
    setTestingKey(true);
    setKeyTestResult(null);
    try {
      await setSetting('aiProvider', provider);
      await setSetting('openRouterApiKey', openRouterApiKey.trim());
      await setSetting('openRouterModel', openRouterModel.trim() || DEFAULT_OPENROUTER_MODEL);
      await setSetting('groqApiKey', groqApiKey.trim());
      await setSetting('groqModel', groqModel.trim());
      await setSetting('geminiApiKey', apiKey.trim());
      await setSetting('geminiModel', model);
      onSettingsChanged();

      if (provider === 'openrouter') {
        const res = await testOpenRouterApiKey(
          openRouterApiKey.trim(),
          openRouterModel.trim()
        );
        if (res.availableModels && res.availableModels.length > 0) {
          setLiveOpenRouterModels(res.availableModels);
        }
        setKeyTestResult({ ok: res.ok, message: res.message });
      } else if (provider === 'groq') {
        const res = await testGroqApiKey(groqApiKey.trim(), groqModel.trim());
        if (res.availableModels && res.availableModels.length > 0) {
          setLiveGroqModels(res.availableModels);
        }
        setKeyTestResult({ ok: res.ok, message: res.message });
      } else {
        const res = await testGeminiApiKey(apiKey.trim(), model);
        setKeyTestResult({ ok: res.ok, message: res.message });
      }
    } finally {
      setTestingKey(false);
    }
  };

  const handleRequestPersistentStorage = async () => {
    if (!navigator.storage?.persist) {
      onShowToast('Persistent Storage API is not supported in this browser.');
      return;
    }
    const granted = await navigator.storage.persist();
    setIsPersisted(granted);
    onShowToast(
      granted
        ? 'Persistent Storage granted! Your browser will protect IndexedDB from automatic eviction.'
        : 'Browser kept standard storage mode. Install Manni as a PWA or save periodic JSON backups.'
    );
  };

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericBudget = Math.max(50, parseFloat(budgetInput) || 1500);
    const numericSavings = Math.max(0, parseFloat(savingsGoalInput) || 400);
    await setSetting('defaultCurrency', selectedCurrency);
    await setSetting('monthlyBudget', numericBudget);
    await setSetting('monthlySavingsGoal', numericSavings);
    await db.budgets.put({
      id: 'budget-all',
      category: 'ALL',
      monthlyLimit: numericBudget,
    });
    onSettingsChanged();
    onShowToast(`Saved currency (${selectedCurrency}), budget, and savings goal.`);
  };

  const handleExportJSON = async () => {
    await exportFullBackupJSON();
    const now = new Date().toISOString();
    await setSetting('lastBackupAt', now);
    setLastBackupAt(now);
    onShowToast('Voluntary JSON backup downloaded!');
  };

  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await importFullBackupJSON(file);
      onSettingsChanged();
      onShowToast(`Restored ${res.transactionsCount} transactions from backup.`);
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

  const handleTestSyncAdapter = async (
    adapterId: string,
    action: 'connect' | 'push' | 'pull'
  ) => {
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

  const activeKeyValue =
    provider === 'openrouter'
      ? openRouterApiKey
      : provider === 'groq'
      ? groqApiKey
      : apiKey;
  const detectedKeyType =
    provider === 'openrouter'
      ? openRouterApiKey.trim().length > 10
        ? 'OpenRouter Free Vision'
        : 'OpenRouter (No Key)'
      : provider === 'groq'
      ? groqApiKey.trim().length > 10
        ? 'Groq Active'
        : 'Groq (No Key)'
      : apiKey.trim().startsWith('AQ.')
      ? 'Vertex AI Express (AQ...)'
      : apiKey.trim().startsWith('AIza')
      ? 'Google AI Studio (AIza...)'
      : apiKey.trim().length > 10
      ? 'Custom Key'
      : 'Local OCR Only';

  return (
    <div className="space-y-5 pb-24 max-w-3xl mx-auto">
      {/* 1. AI Receipt Extraction Configuration */}
      <form
        onSubmit={handleSaveAISettings}
        className="bg-white rounded-2xl p-5 border border-slate-200/80 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <KeyRound className="w-4 h-4 text-slate-500" />
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">
                AI Receipt Extraction Provider
              </h3>
              <p className="text-xs text-slate-500">
                OpenRouter (Free Direct Vision, no card), Groq, or Google Gemini
              </p>
            </div>
          </div>
          <span className="text-[11px] font-medium px-2.5 py-1 rounded-md bg-slate-100 text-slate-700">
            {detectedKeyType}
          </span>
        </div>

        {/* Provider Toggle */}
        <div className="inline-flex flex-wrap rounded-xl bg-slate-100 p-1 text-xs font-medium gap-1">
          <button
            type="button"
            onClick={() => {
              setProvider('openrouter');
              setKeyTestResult(null);
            }}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              provider === 'openrouter'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            OpenRouter (Free Vision)
          </button>
          <button
            type="button"
            onClick={() => {
              setProvider('groq');
              setKeyTestResult(null);
            }}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              provider === 'groq'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Groq (OCR → LLM)
          </button>
          <button
            type="button"
            onClick={() => {
              setProvider('gemini');
              setKeyTestResult(null);
            }}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              provider === 'gemini'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Google Gemini
          </button>
        </div>

        {provider === 'openrouter' ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                OpenRouter API Key (free at openrouter.ai/keys — no credit card)
              </label>
              <input
                type="password"
                value={openRouterApiKey}
                onChange={(e) => {
                  setOpenRouterApiKey(e.target.value);
                  setKeyTestResult(null);
                }}
                placeholder="sk-or-v1-..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-600 flex items-center gap-1">
                  <Cpu className="w-3.5 h-3.5 text-slate-400" />
                  <span>Free Vision Model</span>
                </label>
                <button
                  type="button"
                  disabled={loadingOpenRouterModels}
                  onClick={handleRefreshOpenRouterModels}
                  className="text-[11px] font-medium text-emerald-700 hover:underline disabled:opacity-40 cursor-pointer"
                >
                  {loadingOpenRouterModels ? 'Loading...' : 'Load Free Models'}
                </button>
              </div>
              <select
                value={
                  liveOpenRouterModels.includes(openRouterModel)
                    ? openRouterModel
                    : liveOpenRouterModels[0]
                }
                onChange={(e) => {
                  setOpenRouterModel(e.target.value);
                  setKeyTestResult(null);
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-emerald-600"
              >
                {liveOpenRouterModels.map((m) => (
                  <option key={m} value={m}>
                    {m === 'openrouter/free' ? 'openrouter/free (Auto Free Vision)' : m}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : provider === 'groq' ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Groq API Key (stored locally on this device only)
              </label>
              <input
                type="password"
                value={groqApiKey}
                onChange={(e) => {
                  setGroqApiKey(e.target.value);
                  setKeyTestResult(null);
                }}
                placeholder="gsk_..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-600 flex items-center gap-1">
                  <Cpu className="w-3.5 h-3.5 text-slate-400" />
                  <span>Groq Model</span>
                </label>
                <button
                  type="button"
                  disabled={loadingGroqModels || !groqApiKey.trim()}
                  onClick={handleRefreshGroqModels}
                  className="text-[11px] font-medium text-emerald-700 hover:underline disabled:opacity-40 cursor-pointer"
                >
                  {loadingGroqModels ? 'Loading...' : 'Load Live Models'}
                </button>
              </div>
              <select
                value={liveGroqModels.includes(groqModel) ? groqModel : liveGroqModels[0]}
                onChange={(e) => {
                  setGroqModel(e.target.value);
                  setKeyTestResult(null);
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-emerald-600"
              >
                {liveGroqModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Gemini API Key (AIza... from AI Studio or AQ... from Vertex)
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val.trim().startsWith('gsk_')) {
                    setGroqApiKey(val);
                    setProvider('groq');
                  } else {
                    setApiKey(val);
                  }
                  setKeyTestResult(null);
                }}
                placeholder="AIzaSy... or AQ.Ab8..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5 text-slate-400" />
                <span>Gemini Model</span>
              </label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-emerald-600"
              >
                <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                <option value="gemini-3-flash-preview">gemini-3-flash-preview</option>
              </select>
            </div>
          </div>
        )}

        {keyTestResult && (
          <div
            className={`p-3 rounded-xl text-xs flex items-start gap-2 border ${
              keyTestResult.ok
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            {keyTestResult.ok ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <span className="break-words">{keyTestResult.message}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <button
            type="button"
            disabled={testingKey || !activeKeyValue.trim()}
            onClick={handleTestApiKey}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 text-slate-700 font-medium text-xs transition cursor-pointer"
          >
            {testingKey ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            )}
            <span>{testingKey ? 'Testing Key...' : 'Test API Key'}</span>
          </button>

          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs transition cursor-pointer"
          >
            <span>Save AI Settings</span>
          </button>
        </div>
      </form>

      {/* 2. Currency, Budget & Savings Goal */}
      <form
        onSubmit={handleSavePreferences}
        className="bg-white rounded-2xl p-5 border border-slate-200/80 space-y-4"
      >
        <div className="flex items-center gap-2.5">
          <Wallet className="w-4 h-4 text-slate-500" />
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">
              Currency, Budget & Savings Goal
            </h3>
            <p className="text-xs text-slate-500">
              Used for your monthly budget bar and savings analytics
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Default Currency
            </label>
            <select
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
            >
              {Object.entries(CURRENCY_SYMBOLS).map(([code, sym]) => (
                <option key={code} value={code}>
                  {code} ({sym.trim()})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Monthly Budget ({selectedCurrency})
            </label>
            <input
              type="number"
              step="10"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium tabular-nums"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Monthly Savings Goal ({selectedCurrency})
            </label>
            <input
              type="number"
              step="10"
              value={savingsGoalInput}
              onChange={(e) => setSavingsGoalInput(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium tabular-nums"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition cursor-pointer"
          >
            Update Targets
          </button>
        </div>
      </form>

      {/* 3. Storage & Data Safety + Voluntary Backups */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <HardDrive className="w-4 h-4 text-slate-500" />
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">
                Data Safety, Persistence & Exports
              </h3>
              <p className="text-xs text-slate-500">
                Your data lives locally in IndexedDB. Protect it or export anytime.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRequestPersistentStorage}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition cursor-pointer shrink-0 ${
              isPersisted
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{isPersisted ? 'Persistent Storage ON' : 'Enable Persistent Storage'}</span>
          </button>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs text-slate-600 space-y-2">
          <div>
            <div className="font-semibold text-slate-800 mb-1">
              Privacy & Third-Party AI Notice
            </div>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>
                <strong>Local-only database:</strong> Your transactions, budgets, and receipt photos stay inside this browser&apos;s IndexedDB and are never stored on a Manni server.
              </li>
              <li>
                <strong>AI receipt scanning:</strong> When Groq or Gemini is enabled, receipt images/OCR text are sent directly from your browser to your chosen AI provider. Use <strong>Local OCR</strong> or manual entry for 100% on-device processing.
              </li>
              <li>
                <strong>Safe backups &amp; shared devices:</strong> JSON backups automatically exclude your API keys. Avoid using Manni on public or shared browser profiles.
              </li>
            </ul>
          </div>

          <div className="pt-2 border-t border-slate-200/70">
            <div className="font-semibold text-slate-800 mb-1">
              What could clear local browser data?
            </div>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Manually clicking &quot;Clear Site Data / Cookies&quot; in your browser settings.</li>
              <li>Using Incognito / Private Browsing mode (wiped when the tab closes).</li>
              <li>On iOS Safari: not opening the site for 7+ days unless installed to your Home Screen as a PWA.</li>
              <li>Switching devices, browsers, or uninstalling the browser.</li>
            </ul>
          </div>

          <div className="pt-1 text-slate-500">
            {lastBackupAt
              ? `Last voluntary JSON backup: ${new Date(lastBackupAt).toLocaleString()}`
              : 'Tip: Click "Save JSON Backup" below periodically and keep it in iCloud / Google Drive.'}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => void handleExportJSON()}
            className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition text-left cursor-pointer"
          >
            <div>
              <div className="font-semibold text-xs text-slate-900 flex items-center gap-1.5">
                <FileJson className="w-4 h-4 text-emerald-600" />
                <span>Save JSON Backup</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                All receipts & images (API keys excluded for safety)
              </p>
            </div>
            <Download className="w-4 h-4 text-slate-400" />
          </button>

          <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition text-left cursor-pointer">
            <div>
              <div className="font-semibold text-xs text-slate-900 flex items-center gap-1.5">
                <Upload className="w-4 h-4 text-slate-600" />
                <span>Restore JSON Backup</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Import a saved backup file on any device
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

          <button
            type="button"
            onClick={() => {
              exportSummaryCSV(transactions);
              onShowToast('Summary CSV exported.');
            }}
            className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition text-left cursor-pointer"
          >
            <div>
              <div className="font-semibold text-xs text-slate-900 flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-slate-600" />
                <span>Export Summary CSV</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {transactions.length} transactions (Excel / Sheets)
              </p>
            </div>
            <Download className="w-4 h-4 text-slate-400" />
          </button>

          <button
            type="button"
            onClick={() => {
              exportItemizedCSV(transactions);
              onShowToast('Itemized Line-Items CSV exported.');
            }}
            className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition text-left cursor-pointer"
          >
            <div>
              <div className="font-semibold text-xs text-slate-900 flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-slate-600" />
                <span>Export Itemized CSV</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Every individual receipt line item
              </p>
            </div>
            <Download className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={onLoadDemoData}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition cursor-pointer"
          >
            Load Realistic Demo Data
          </button>

          <button
            type="button"
            onClick={handleClearAllData}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-rose-600 hover:bg-rose-50 font-medium text-xs transition cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear All Local Data</span>
          </button>
        </div>
      </div>

      {/* 4. Optional Cloud & Bank Sync Adapters */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 space-y-3">
        <div className="flex items-center gap-2.5">
          <Cloud className="w-4 h-4 text-slate-500" />
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">
              Optional Cloud & Bank Sync (Future Adapters)
            </h3>
            <p className="text-xs text-slate-500">
              Pluggable sync interface ready for Supabase Cloud or Open Banking
            </p>
          </div>
        </div>

        {syncMessage && (
          <div className="p-2.5 rounded-xl bg-slate-100 text-xs text-slate-700">
            {syncMessage}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {availableSyncAdapters.map((adapter) => (
            <div
              key={adapter.id}
              className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2.5"
            >
              <div className="flex items-center gap-2 font-semibold text-xs text-slate-900">
                {adapter.id.includes('bank') ? (
                  <Landmark className="w-4 h-4 text-slate-500" />
                ) : (
                  <Cloud className="w-4 h-4 text-slate-500" />
                )}
                <span>{adapter.name}</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {adapter.description}
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleTestSyncAdapter(adapter.id, 'connect')}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-[11px] font-medium text-slate-700 cursor-pointer"
                >
                  Connect
                </button>
                <button
                  type="button"
                  onClick={() => handleTestSyncAdapter(adapter.id, 'push')}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-[11px] font-medium text-slate-700 cursor-pointer"
                >
                  Push
                </button>
                <button
                  type="button"
                  onClick={() => handleTestSyncAdapter(adapter.id, 'pull')}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-[11px] font-medium text-slate-700 cursor-pointer"
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
