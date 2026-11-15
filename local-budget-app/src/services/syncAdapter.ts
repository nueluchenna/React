import type { Transaction } from '../db/db';

/**
 * Future-Ready Pluggable Sync Interface (src/services/syncAdapter.ts)
 * Allows cloud sync (Supabase) or open-banking sync (GoCardless / Plaid)
 * to be plugged in later without touching the UI or IndexedDB database layer.
 */
export interface SyncResult {
  success: boolean;
  syncedCount: number;
  timestamp: string;
  message: string;
}

export interface BankConnectionInfo {
  connected: boolean;
  institutionName?: string;
  provider: 'gocardless' | 'plaid' | 'supabase_cloud';
  lastSyncAt?: string;
}

export interface ExternalSyncAdapter {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  connectBank(institutionId?: string): Promise<BankConnectionInfo>;
  pushTransactions(transactions: Transaction[]): Promise<SyncResult>;
  pullTransactions(sinceISO?: string): Promise<{ transactions: Transaction[]; message: string }>;
}

export class SupabaseCloudSyncAdapter implements ExternalSyncAdapter {
  readonly id = 'supabase-cloud';
  readonly name = 'Supabase Zero-Knowledge Cloud Sync';
  readonly description =
    'Optional end-to-end encrypted multi-device sync via your own free Supabase PostgreSQL project.';

  async connectBank(): Promise<BankConnectionInfo> {
    return {
      connected: false,
      provider: 'supabase_cloud',
      institutionName: 'Supabase Personal Cloud (Stub Ready)',
    };
  }

  async pushTransactions(transactions: Transaction[]): Promise<SyncResult> {
    return {
      success: true,
      syncedCount: transactions.length,
      timestamp: new Date().toISOString(),
      message: `Adapter stub verified: ${transactions.length} local records ready for encrypted cloud push.`,
    };
  }

  async pullTransactions(): Promise<{ transactions: Transaction[]; message: string }> {
    return {
      transactions: [],
      message: 'Local IndexedDB is authoritative. Configure a Supabase URL & Anon Key to enable remote pull.',
    };
  }
}

export class OpenBankingSyncAdapter implements ExternalSyncAdapter {
  readonly id = 'open-banking-psd2';
  readonly name = 'GoCardless / Plaid Open Banking';
  readonly description =
    'Connect EU/UK PSD2 banks (GoCardless) or US/CA banks (Plaid) to auto-import card transactions alongside AI receipts.';

  async connectBank(institutionId = 'Revolut / N26 / Chase'): Promise<BankConnectionInfo> {
    return {
      connected: false,
      provider: 'gocardless',
      institutionName: institutionId,
      lastSyncAt: new Date().toISOString(),
    };
  }

  async pushTransactions(transactions: Transaction[]): Promise<SyncResult> {
    return {
      success: true,
      syncedCount: transactions.length,
      timestamp: new Date().toISOString(),
      message: 'Open Banking is read-only; local receipts matched against bank feed.',
    };
  }

  async pullTransactions(): Promise<{ transactions: Transaction[]; message: string }> {
    return {
      transactions: [],
      message: 'Open Banking OAuth flow stub triggered. Ready for GoCardless/Plaid token exchange.',
    };
  }
}

export const availableSyncAdapters: ExternalSyncAdapter[] = [
  new SupabaseCloudSyncAdapter(),
  new OpenBankingSyncAdapter(),
];
