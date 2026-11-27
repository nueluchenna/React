import { db, type Transaction, type PendingReceipt, type Budget, type AppSetting, setSetting } from '../db/db';

function escapeCsvCell(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '""';
  const str = String(value).replace(/"/g, '""');
  return `"${str}"`;
}

function triggerFileDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 1. Export Summary CSV (.csv)
 * Columns: Date, Type, Category, Merchant, Amount, Currency, Items Count, Note, Source
 * Formatted cleanly with UTF-8 BOM (\uFEFF) so Excel and Google Sheets open currency and special characters properly.
 */
export function exportSummaryCSV(transactions: Transaction[]): void {
  const headers = [
    'Date',
    'Type',
    'Category',
    'Merchant',
    'Amount',
    'Currency',
    'Items Count',
    'Note',
    'Source',
  ];

  const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date));

  const rows = sorted.map((tx) => [
    escapeCsvCell(tx.date),
    escapeCsvCell(tx.type),
    escapeCsvCell(tx.category),
    escapeCsvCell(tx.merchant),
    tx.amount.toFixed(2),
    escapeCsvCell(tx.currency),
    String(tx.lineItems?.length ?? 0),
    escapeCsvCell(tx.note),
    escapeCsvCell(tx.source),
  ]);

  const csvBody = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const bomCsv = '\uFEFF' + csvBody;
  const dateStamp = new Date().toISOString().split('T')[0];
  triggerFileDownload(bomCsv, `Manni_Summary_${dateStamp}.csv`, 'text/csv;charset=utf-8;');
}

/**
 * 2. Export Itemized Line-Items CSV (.csv)
 * Flattens every individual line item across all receipts:
 * Receipt Date, Merchant, Receipt Category, Item Name, Quantity, Unit Price, Item Total, Receipt Total
 */
export function exportItemizedCSV(transactions: Transaction[]): void {
  const headers = [
    'Receipt Date',
    'Merchant',
    'Receipt Category',
    'Item Name',
    'Quantity',
    'Unit Price',
    'Item Total',
    'Receipt Total',
  ];

  const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date));
  const rows: string[][] = [];

  for (const tx of sorted) {
    if (tx.lineItems && tx.lineItems.length > 0) {
      for (const item of tx.lineItems) {
        rows.push([
          escapeCsvCell(tx.date),
          escapeCsvCell(tx.merchant),
          escapeCsvCell(tx.category),
          escapeCsvCell(item.name),
          String(item.quantity ?? 1),
          (item.unitPrice ?? item.totalPrice ?? 0).toFixed(2),
          (item.totalPrice ?? 0).toFixed(2),
          tx.amount.toFixed(2),
        ]);
      }
    } else {
      // Fallback row for transactions without explicit line items
      rows.push([
        escapeCsvCell(tx.date),
        escapeCsvCell(tx.merchant),
        escapeCsvCell(tx.category),
        escapeCsvCell(tx.note || tx.merchant || 'General Entry'),
        '1',
        tx.amount.toFixed(2),
        tx.amount.toFixed(2),
        tx.amount.toFixed(2),
      ]);
    }
  }

  const csvBody = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const bomCsv = '\uFEFF' + csvBody;
  const dateStamp = new Date().toISOString().split('T')[0];
  triggerFileDownload(bomCsv, `Manni_Itemized_LineItems_${dateStamp}.csv`, 'text/csv;charset=utf-8;');
}

export interface FullDatabaseBackup {
  app: 'Manni' | 'SpendeeAI';
  version: number;
  exportedAt: string;
  transactions: Transaction[];
  pendingReceipts: PendingReceipt[];
  budgets: Budget[];
  settings: AppSetting[];
}

const SENSITIVE_SETTING_KEYS = new Set(['geminiApiKey', 'groqApiKey']);

/**
 * 3. Full JSON Backup & Restore
 * Exports entire IndexedDB state to a .json file (excluding secret API keys) and imports it back on any device.
 */
export async function exportFullBackupJSON(): Promise<void> {
  const [transactions, pendingReceipts, budgets, rawSettings] = await Promise.all([
    db.transactions.toArray(),
    db.pendingReceipts.toArray(),
    db.budgets.toArray(),
    db.settings.toArray(),
  ]);

  // Never include secret API keys in exported backup files
  const safeSettings = rawSettings.filter((s) => !SENSITIVE_SETTING_KEYS.has(s.key));

  const payload: FullDatabaseBackup = {
    app: 'Manni',
    version: 1,
    exportedAt: new Date().toISOString(),
    transactions,
    pendingReceipts,
    budgets,
    settings: safeSettings,
  };

  const jsonString = JSON.stringify(payload, null, 2);
  const dateStamp = new Date().toISOString().split('T')[0];
  triggerFileDownload(jsonString, `Manni_Backup_${dateStamp}.json`, 'application/json');
}

export async function importFullBackupJSON(file: File): Promise<{
  transactionsCount: number;
  budgetsCount: number;
}> {
  const text = await file.text();
  const parsed = JSON.parse(text) as Partial<FullDatabaseBackup>;

  if (!parsed || !Array.isArray(parsed.transactions)) {
    throw new Error('Invalid Manni backup file: missing transactions array.');
  }

  await db.transaction(
    'rw',
    db.transactions,
    db.pendingReceipts,
    db.budgets,
    db.settings,
    async () => {
      if (parsed.transactions?.length) {
        await db.transactions.bulkPut(parsed.transactions);
      }
      if (parsed.pendingReceipts?.length) {
        await db.pendingReceipts.bulkPut(parsed.pendingReceipts);
      }
      if (parsed.budgets?.length) {
        await db.budgets.bulkPut(parsed.budgets);
      }
      if (parsed.settings?.length) {
        for (const s of parsed.settings) {
          await setSetting(s.key, s.value);
        }
      }
    }
  );

  return {
    transactionsCount: parsed.transactions.length,
    budgetsCount: parsed.budgets?.length ?? 0,
  };
}
