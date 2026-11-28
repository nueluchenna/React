import React, { useState, useEffect } from 'react';
import {
  Download,
  Upload,
  Trash2,
  Cloud,
  Landmark,
  CheckCircle2,
  FileSpreadsheet,
  FileJson,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
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
  const [showApiKey, setShowApiKey] = useState(false);
  const [keyTestResult, setKeyTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const [isPersisted, setIsPersisted] = useState<boolean | null>(null);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const [p, ork, orm, cachedOrModels, gk, gm, cachedGModels, k, m, backupTs] =
        await Promise.all([
          getSetting<AIProvider>('aiProvider', 'openrouter'),
          getSetting<string>('openRouterApiKey', ''),
          getSetting<string>('openRouterModel', DEFAULT_OPENROUTER_MODEL),
          getSetting<string[]>('cachedOpenRouterModels', []),
          getSetting<string>('groqApiKey', ''),
          getSetting<string>('groqModel', DEFAULT_GROQ_MODEL),
          getSetting<string[]>('cachedGroqModels', []),
          getSetting<string>('geminiApiKey', ''),
          getSetting<string>('geminiModel', 'gemini-2.5-flash'),
          getSetting<string | null>('lastBackupAt', null),
        ]);
      const migratedGroqModel =
        gm === 'meta-llama/llama-4-maverick-17b-128e-instruct' ||
        gm === 'meta-llama/llama-4-scout-17b-16e-instruct'
          ? DEFAULT_GROQ_MODEL
          : gm;

      const resolvedOrModel = (orm || DEFAULT_OPENROUTER_MODEL).trim();
      const mergedOrModels = Array.from(
        new Set([
          DEFAULT_OPENROUTER_MODEL,
          resolvedOrModel,
          ...(Array.isArray(cachedOrModels) ? cachedOrModels : []),
        ])
      );

      const mergedGroqModels = Array.from(
        new Set([
          'openai/gpt-oss-120b',
          'openai/gpt-oss-20b',
          'qwen/qwen3.8-27b',
          migratedGroqModel,
          ...(Array.isArray(cachedGModels) ? cachedGModels : []),
        ])
      );

      setProvider(p);
      setOpenRouterApiKey(ork);
      setOpenRouterModel(resolvedOrModel);
      setLiveOpenRouterModels(mergedOrModels);
      setGroqApiKey(gk);
      setGroqModel(migratedGroqModel);
      setLiveGroqModels(mergedGroqModels);
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
        const merged = Array.from(new Set([...models, openRouterModel].filter(Boolean)));
        setLiveOpenRouterModels(merged);
        await setSetting('cachedOpenRouterModels', merged);
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
        const merged = Array.from(new Set([...models, groqModel].filter(Boolean)));
        setLiveGroqModels(merged);
        await setSetting('cachedGroqModels', merged);
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
          const merged = Array.from(
            new Set([...res.availableModels, openRouterModel].filter(Boolean))
          );
          setLiveOpenRouterModels(merged);
          await setSetting('cachedOpenRouterModels', merged);
        }
        setKeyTestResult({ ok: res.ok, message: res.message });
      } else if (provider === 'groq') {
        const res = await testGroqApiKey(groqApiKey.trim(), groqModel.trim());
        if (res.availableModels && res.availableModels.length > 0) {
          const merged = Array.from(
            new Set([...res.availableModels, groqModel].filter(Boolean))
          );
          setLiveGroqModels(merged);
          await setSetting('cachedGroqModels', merged);
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
    onShowToast('Voluntary JSON backup downloaded.');
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
        ? 'OpenRouter Active'
        : 'Not connected'
      : provider === 'groq'
      ? groqApiKey.trim().length > 10
        ? 'Groq Active'
        : 'Not connected'
      : apiKey.trim().startsWith('AQ.')
      ? 'Vertex AI (AQ...)'
      : apiKey.trim().startsWith('AIza')
      ? 'AI Studio (AIza...)'
      : apiKey.trim().length > 10
      ? 'Custom Key'
      : 'Local OCR Only';

  return (
    <div className="space-y-10 pb-28 max-w-3xl mx-auto">
      {/* Page Title */}
      <div className="space-y-1">
        <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-[#0B1221]">
          Settings
        </h1>
        <p className="text-sm text-[#526077]">
          Manage AI receipt scanning, budgets, privacy, and local backups.
        </p>
      </div>

      {/* 1. AI Receipt Extraction Provider */}
      <form
        onSubmit={handleSaveAISettings}
        className="bg-[#F4F6F9] rounded-3xl p-6 space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display font-bold text-[#0B1221] text-base">
              AI receipt extraction
            </h2>
            <p className="text-xs text-[#526077] mt-0.5">
              OpenRouter (free direct vision, no card), Groq, or Google Gemini
            </p>
          </div>
          <span className="text-[11px] font-semibold px-3 py-1 rounded-full bg-white text-[#2563EB]">
            {detectedKeyType}
          </span>
        </div>

        {/* Segmented Pill Provider Switch */}
        <div className="inline-flex flex-wrap rounded-full bg-[#E1E8F0] p-1 text-xs font-semibold gap-1">
          <button
            type="button"
            onClick={() => {
              setProvider('openrouter');
              setKeyTestResult(null);
            }}
            className={`px-4 py-1.5 rounded-full transition cursor-pointer ${
              provider === 'openrouter'
                ? 'bg-white text-[#0B1221] shadow-2xs'
                : 'text-[#526077] hover:text-[#0B1221]'
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
            className={`px-4 py-1.5 rounded-full transition cursor-pointer ${
              provider === 'groq'
                ? 'bg-white text-[#0B1221] shadow-2xs'
                : 'text-[#526077] hover:text-[#0B1221]'
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
            className={`px-4 py-1.5 rounded-full transition cursor-pointer ${
              provider === 'gemini'
                ? 'bg-white text-[#0B1221] shadow-2xs'
                : 'text-[#526077] hover:text-[#0B1221]'
            }`}
          >
            Google Gemini
          </button>
        </div>

        {provider === 'openrouter' ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[#526077] mb-1.5">
                OpenRouter API key (free at openrouter.ai/keys)
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={openRouterApiKey}
                  onChange={(e) => {
                    setOpenRouterApiKey(e.target.value);
                    setKeyTestResult(null);
                  }}
                  placeholder="sk-or-v1-..."
                  className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-white text-sm text-[#0B1221] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/25"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey((v) => !v)}
                  aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7C8BA1] hover:text-[#0B1221] cursor-pointer"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-[#526077]">
                  Model
                </label>
                <button
                  type="button"
                  disabled={loadingOpenRouterModels}
                  onClick={handleRefreshOpenRouterModels}
                  className="text-[11px] font-semibold text-[#2563EB] underline underline-offset-2 disabled:opacity-40 cursor-pointer"
                >
                  {loadingOpenRouterModels ? 'Loading...' : 'Load free models'}
                </button>
              </div>
              <select
                value={openRouterModel}
                onChange={(e) => {
                  const next = e.target.value;
                  setOpenRouterModel(next);
                  setKeyTestResult(null);
                  void setSetting('openRouterModel', next);
                  void setSetting('aiProvider', 'openrouter');
                }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white text-sm text-[#0B1221] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/25"
              >
                {Array.from(new Set([...liveOpenRouterModels, openRouterModel].filter(Boolean))).map((m) => (
                  <option key={m} value={m}>
                    {m === 'openrouter/free' ? 'openrouter/free (Auto Vision)' : m}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : provider === 'groq' ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[#526077] mb-1.5">
                Groq API key (stored locally only)
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={groqApiKey}
                  onChange={(e) => {
                    setGroqApiKey(e.target.value);
                    setKeyTestResult(null);
                  }}
                  placeholder="gsk_..."
                  className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-white text-sm text-[#0B1221] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/25"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey((v) => !v)}
                  aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7C8BA1] hover:text-[#0B1221] cursor-pointer"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-[#526077]">
                  Model
                </label>
                <button
                  type="button"
                  disabled={loadingGroqModels || !groqApiKey.trim()}
                  onClick={handleRefreshGroqModels}
                  className="text-[11px] font-semibold text-[#2563EB] underline underline-offset-2 disabled:opacity-40 cursor-pointer"
                >
                  {loadingGroqModels ? 'Loading...' : 'Load live models'}
                </button>
              </div>
              <select
                value={groqModel}
                onChange={(e) => {
                  const next = e.target.value;
                  setGroqModel(next);
                  setKeyTestResult(null);
                  void setSetting('groqModel', next);
                  void setSetting('aiProvider', 'groq');
                }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white text-sm text-[#0B1221] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/25"
              >
                {Array.from(new Set([...liveGroqModels, groqModel].filter(Boolean))).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[#526077] mb-1.5">
                Gemini API key (AIza... or AQ...)
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val.trim().startsWith('gsk_')) {
                      setGroqApiKey(val);
                      setProvider('groq');
                    } else if (val.trim().startsWith('sk-or-')) {
                      setOpenRouterApiKey(val);
                      setProvider('openrouter');
                    } else {
                      setApiKey(val);
                    }
                    setKeyTestResult(null);
                  }}
                  placeholder="AIzaSy... or AQ.Ab8..."
                  className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-white text-sm text-[#0B1221] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/25"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey((v) => !v)}
                  aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7C8BA1] hover:text-[#0B1221] cursor-pointer"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#526077] mb-1.5">
                Model
              </label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white text-sm text-[#0B1221] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/25"
              >
                <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                <option value="gemini-3-flash-preview">gemini-3-flash-preview</option>
              </select>
            </div>
          </div>
        )}

        {keyTestResult && (
          <div
            className={`p-3.5 rounded-2xl text-xs flex items-start gap-2 ${
              keyTestResult.ok
                ? 'bg-white text-[#0D9488]'
                : 'bg-[#FEE2E2] text-[#BE123C]'
            }`}
          >
            {keyTestResult.ok ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <span className="break-words font-medium">{keyTestResult.message}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <button
            type="button"
            disabled={testingKey || !activeKeyValue.trim()}
            onClick={handleTestApiKey}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white hover:bg-[#E9EEF5] disabled:opacity-40 text-[#0B1221] font-semibold text-xs transition cursor-pointer"
          >
            {testingKey ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
            <span>{testingKey ? 'Testing...' : 'Test API key'}</span>
          </button>

          <button
            type="submit"
            className="px-5 py-2 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs transition cursor-pointer"
          >
            Save AI settings
          </button>
        </div>
      </form>

      {/* 2. Currency, Budget & Savings Goal */}
      <form
        onSubmit={handleSavePreferences}
        className="bg-[#F4F6F9] rounded-3xl p-6 space-y-5"
      >
        <div>
          <h2 className="font-display font-bold text-[#0B1221] text-base">
            Currency & monthly targets
          </h2>
          <p className="text-xs text-[#526077] mt-0.5">
            Set your display currency, spending limit, and savings goal
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#526077] mb-1.5">
              Currency
            </label>
            <select
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white text-sm text-[#0B1221]"
            >
              {Object.entries(CURRENCY_SYMBOLS).map(([code, sym]) => (
                <option key={code} value={code}>
                  {code} ({sym.trim()})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#526077] mb-1.5">
              Monthly budget ({selectedCurrency})
            </label>
            <input
              type="number"
              step="10"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white text-sm font-semibold tabular-nums text-[#0B1221]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#526077] mb-1.5">
              Monthly savings goal ({selectedCurrency})
            </label>
            <input
              type="number"
              step="10"
              value={savingsGoalInput}
              onChange={(e) => setSavingsGoalInput(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white text-sm font-semibold tabular-nums text-[#0B1221]"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-5 py-2 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs transition cursor-pointer"
          >
            Update targets
          </button>
        </div>
      </form>

      {/* 3. Data Safety, Persistence & Exports */}
      <div className="bg-[#F4F6F9] rounded-3xl p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display font-bold text-[#0B1221] text-base">
              Data safety & exports
            </h2>
            <p className="text-xs text-[#526077] mt-0.5">
              100% local IndexedDB storage with voluntary JSON & CSV exports
            </p>
          </div>

          <button
            type="button"
            onClick={handleRequestPersistentStorage}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer shrink-0 ${
              isPersisted
                ? 'bg-[#0B1221] text-[#60A5FA]'
                : 'bg-white text-[#0B1221] hover:bg-[#E9EEF5]'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{isPersisted ? 'Persistent storage ON' : 'Enable persistent storage'}</span>
          </button>
        </div>

        <div className="p-4 rounded-2xl bg-white text-xs text-[#526077] space-y-2.5 leading-relaxed">
          <div>
            <div className="font-semibold text-[#0B1221] mb-1">
              Privacy & third-party AI notice
            </div>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>
                <strong>Local-only database:</strong> Transactions, budgets, and receipt photos stay in this browser&apos;s IndexedDB—never on a Manni server.
              </li>
              <li>
                <strong>AI scanning:</strong> When OpenRouter, Groq, or Gemini is enabled, receipt images/OCR text are sent directly to your chosen provider. Use <strong>Local OCR</strong> or manual entry for 100% on-device processing.
              </li>
              <li>
                <strong>Safe backups:</strong> JSON backups automatically exclude your API keys. Avoid public/shared browser profiles.
              </li>
            </ul>
          </div>

          <div className="pt-2 border-t border-[#EBF0F5]">
            <div className="font-semibold text-[#0B1221] mb-1">
              What could clear local browser data?
            </div>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Clearing site data / cookies in browser settings or using Incognito mode.</li>
              <li>On iOS Safari: not opening the site for 7+ days unless added to your Home Screen.</li>
              <li>Switching devices, browsers, or uninstalling the browser.</li>
            </ul>
          </div>

          <div className="pt-1 text-[#7C8BA1]">
            {lastBackupAt
              ? `Last voluntary backup: ${new Date(lastBackupAt).toLocaleString()}`
              : 'Tip: Save a JSON backup periodically to iCloud or Google Drive.'}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => void handleExportJSON()}
            className="flex items-center justify-between p-4 rounded-2xl bg-white hover:bg-[#F8FAFC] transition text-left cursor-pointer"
          >
            <div>
              <div className="font-semibold text-xs text-[#0B1221] flex items-center gap-1.5">
                <FileJson className="w-4 h-4 text-[#2563EB]" />
                <span>Save JSON backup</span>
              </div>
              <p className="text-[11px] text-[#7C8BA1] mt-0.5">
                All receipts & images (API keys excluded)
              </p>
            </div>
            <Download className="w-4 h-4 text-[#7C8BA1]" />
          </button>

          <label className="flex items-center justify-between p-4 rounded-2xl bg-white hover:bg-[#F8FAFC] transition text-left cursor-pointer">
            <div>
              <div className="font-semibold text-xs text-[#0B1221] flex items-center gap-1.5">
                <Upload className="w-4 h-4 text-[#2563EB]" />
                <span>Restore JSON backup</span>
              </div>
              <p className="text-[11px] text-[#7C8BA1] mt-0.5">
                Import a saved backup file on any device
              </p>
            </div>
            <Upload className="w-4 h-4 text-[#7C8BA1]" />
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
            className="flex items-center justify-between p-4 rounded-2xl bg-white hover:bg-[#F8FAFC] transition text-left cursor-pointer"
          >
            <div>
              <div className="font-semibold text-xs text-[#0B1221] flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-[#2563EB]" />
                <span>Export summary CSV</span>
              </div>
              <p className="text-[11px] text-[#7C8BA1] mt-0.5">
                {transactions.length} transactions for Excel / Sheets
              </p>
            </div>
            <Download className="w-4 h-4 text-[#7C8BA1]" />
          </button>

          <button
            type="button"
            onClick={() => {
              exportItemizedCSV(transactions);
              onShowToast('Itemized Line-Items CSV exported.');
            }}
            className="flex items-center justify-between p-4 rounded-2xl bg-white hover:bg-[#F8FAFC] transition text-left cursor-pointer"
          >
            <div>
              <div className="font-semibold text-xs text-[#0B1221] flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-[#2563EB]" />
                <span>Export itemized CSV</span>
              </div>
              <p className="text-[11px] text-[#7C8BA1] mt-0.5">
                Every individual receipt line item
              </p>
            </div>
            <Download className="w-4 h-4 text-[#7C8BA1]" />
          </button>
        </div>

        <div className="pt-2 flex flex-wrap items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={onLoadDemoData}
            className="px-4 py-2 rounded-full bg-white hover:bg-[#E9EEF5] text-[#0B1221] font-semibold text-xs transition cursor-pointer"
          >
            Load realistic demo data
          </button>

          <button
            type="button"
            onClick={handleClearAllData}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#FEE2E2] hover:bg-[#FECDD3] text-[#BE123C] font-semibold text-xs transition cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear all local data</span>
          </button>
        </div>
      </div>

      {/* 4. Optional Cloud & Bank Sync Adapters */}
      <div className="bg-[#F4F6F9] rounded-3xl p-6 space-y-4">
        <div>
          <h2 className="font-display font-bold text-[#0B1221] text-base">
            Future sync adapters
          </h2>
          <p className="text-xs text-[#526077] mt-0.5">
            Pluggable architecture ready for Supabase Cloud or Open Banking
          </p>
        </div>

        {syncMessage && (
          <div className="p-3 rounded-2xl bg-white text-xs text-[#0B1221]">
            {syncMessage}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {availableSyncAdapters.map((adapter) => (
            <div
              key={adapter.id}
              className="p-4 rounded-2xl bg-white space-y-3"
            >
              <div className="flex items-center gap-2 font-semibold text-xs text-[#0B1221]">
                {adapter.id.includes('bank') ? (
                  <Landmark className="w-4 h-4 text-[#2563EB]" />
                ) : (
                  <Cloud className="w-4 h-4 text-[#2563EB]" />
                )}
                <span>{adapter.name}</span>
              </div>
              <p className="text-[11px] text-[#7C8BA1] leading-relaxed">
                {adapter.description}
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleTestSyncAdapter(adapter.id, 'connect')}
                  className="px-3 py-1 rounded-full bg-[#EBF0F5] hover:bg-[#E1E8F0] text-[11px] font-semibold text-[#0B1221] cursor-pointer"
                >
                  Connect
                </button>
                <button
                  type="button"
                  onClick={() => handleTestSyncAdapter(adapter.id, 'push')}
                  className="px-3 py-1 rounded-full bg-[#EBF0F5] hover:bg-[#E1E8F0] text-[11px] font-semibold text-[#0B1221] cursor-pointer"
                >
                  Push
                </button>
                <button
                  type="button"
                  onClick={() => handleTestSyncAdapter(adapter.id, 'pull')}
                  className="px-3 py-1 rounded-full bg-[#EBF0F5] hover:bg-[#E1E8F0] text-[11px] font-semibold text-[#0B1221] cursor-pointer"
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
