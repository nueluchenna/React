import { db, type Transaction, type Budget, setSetting } from './db';

/**
 * Generates a realistic visual receipt image as a compressed JPEG data URL using an HTML5 canvas
 * so demo transactions have inspectable original receipt images.
 */
export function generateSyntheticReceiptDataUrl(params: {
  merchant: string;
  date: string;
  currencySymbol: string;
  items: Array<{ name: string; quantity: number; unitPrice: number; totalPrice: number }>;
  taxAmount?: number;
  totalAmount: number;
}): string {
  try {
    const canvas = document.createElement('canvas');
    const width = 440;
    const height = Math.max(460, 260 + params.items.length * 36);
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Paper background
    ctx.fillStyle = '#fffdf9';
    ctx.fillRect(0, 0, width, height);

    // Subtle top/bottom receipt zig-zag border
    ctx.fillStyle = '#e2e8f0';
    for (let x = 0; x < width; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 8, 8);
      ctx.lineTo(x + 16, 0);
      ctx.fill();
    }

    // Header
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(params.merchant.toUpperCase(), width / 2, 52);

    ctx.fillStyle = '#475569';
    ctx.font = '13px monospace';
    ctx.fillText(`DATE: ${params.date}   RECEIPT #${Math.floor(10000 + Math.random() * 90000)}`, width / 2, 78);

    // Dashed divider
    ctx.strokeStyle = '#94a3b8';
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(28, 96);
    ctx.lineTo(width - 28, 96);
    ctx.stroke();

    // Column headers
    ctx.textAlign = 'left';
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = '#334155';
    ctx.fillText('ITEM', 32, 120);
    ctx.textAlign = 'right';
    ctx.fillText('TOTAL', width - 32, 120);

    // Line items
    let y = 150;
    ctx.font = '14px monospace';
    ctx.fillStyle = '#0f172a';
    for (const item of params.items) {
      ctx.textAlign = 'left';
      const label = item.quantity > 1 ? `${item.quantity}x ${item.name}` : item.name;
      ctx.fillText(label.slice(0, 26), 32, y);
      ctx.textAlign = 'right';
      ctx.fillText(`${params.currencySymbol}${item.totalPrice.toFixed(2)}`, width - 32, y);
      y += 32;
    }

    // Bottom divider
    y += 8;
    ctx.beginPath();
    ctx.moveTo(28, y);
    ctx.lineTo(width - 28, y);
    ctx.stroke();

    if (params.taxAmount !== undefined) {
      y += 28;
      ctx.font = '13px monospace';
      ctx.fillStyle = '#475569';
      ctx.textAlign = 'left';
      ctx.fillText('INCLUDED TAX / VAT', 32, y);
      ctx.textAlign = 'right';
      ctx.fillText(`${params.currencySymbol}${params.taxAmount.toFixed(2)}`, width - 32, y);
    }

    y += 34;
    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'left';
    ctx.fillText('TOTAL', 32, y);
    ctx.textAlign = 'right';
    ctx.fillText(`${params.currencySymbol}${params.totalAmount.toFixed(2)}`, width - 32, y);

    y += 42;
    ctx.font = '12px monospace';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'center';
    ctx.fillText('THANK YOU FOR YOUR PURCHASE!', width / 2, y);
    ctx.fillText('Captured with Manni Local-First PWA', width / 2, y + 20);

    return canvas.toDataURL('image/jpeg', 0.78);
  } catch {
    return '';
  }
}

function daysAgoISO(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

export async function loadDemoData(currency = 'EUR'): Promise<number> {
  const sym = currency === 'USD' ? '$' : currency === 'GBP' ? '£' : '€';
  const now = Date.now();

  const rawDemo: Array<Omit<Transaction, 'id' | 'createdAt' | 'receiptImageDataUrl'> & { withReceipt?: boolean }> = [
    {
      type: 'income',
      amount: 3450.0,
      currency,
      category: 'Income',
      merchant: 'TechCorp Monthly Salary',
      date: daysAgoISO(14),
      note: 'Monthly net salary deposit',
      lineItems: [{ name: 'Monthly Net Pay', quantity: 1, unitPrice: 3450.0, totalPrice: 3450.0 }],
      source: 'manual',
      syncStatus: 'local_only',
    },
    {
      type: 'expense',
      amount: 64.85,
      taxAmount: 5.89,
      currency,
      category: 'Groceries',
      merchant: 'Whole Foods / BioMarkt',
      date: daysAgoISO(1),
      note: 'Weekly organic groceries & fruit',
      lineItems: [
        { name: 'Organic Avocados (4pk)', quantity: 1, unitPrice: 5.99, totalPrice: 5.99 },
        { name: 'Oat Milk Barista 1L', quantity: 3, unitPrice: 2.89, totalPrice: 8.67 },
        { name: 'Wild Salmon Fillet', quantity: 2, unitPrice: 11.5, totalPrice: 23.0 },
        { name: 'Sourdough Loaf', quantity: 1, unitPrice: 4.5, totalPrice: 4.5 },
        { name: 'Greek Yogurt & Berries', quantity: 2, unitPrice: 6.45, totalPrice: 12.9 },
        { name: 'Extra Virgin Olive Oil', quantity: 1, unitPrice: 9.79, totalPrice: 9.79 },
      ],
      source: 'ai_receipt',
      syncStatus: 'synced',
      withReceipt: true,
    },
    {
      type: 'expense',
      amount: 18.4,
      taxAmount: 2.94,
      currency,
      category: 'Food & Drink',
      merchant: 'Blue Bottle Specialty Coffee',
      date: daysAgoISO(2),
      note: 'Flat whites & almond croissants',
      lineItems: [
        { name: 'Oat Flat White', quantity: 2, unitPrice: 4.9, totalPrice: 9.8 },
        { name: 'Almond Croissant', quantity: 2, unitPrice: 4.3, totalPrice: 8.6 },
      ],
      source: 'ai_receipt',
      syncStatus: 'synced',
      withReceipt: true,
    },
    {
      type: 'expense',
      amount: 42.5,
      taxAmount: 4.25,
      currency,
      category: 'Transport',
      merchant: 'City Metro & Rail Pass',
      date: daysAgoISO(3),
      note: '7-day commuter transit pass & bike share',
      lineItems: [
        { name: 'Weekly Zone 1-3 Pass', quantity: 1, unitPrice: 36.0, totalPrice: 36.0 },
        { name: 'E-Bike Unlock Rides', quantity: 2, unitPrice: 3.25, totalPrice: 6.5 },
      ],
      source: 'ai_receipt',
      syncStatus: 'synced',
      withReceipt: true,
    },
    {
      type: 'expense',
      amount: 89.9,
      taxAmount: 14.35,
      currency,
      category: 'Shopping',
      merchant: 'Uniqlo City Center',
      date: daysAgoISO(4),
      note: 'Merino sweater & essentials',
      lineItems: [
        { name: 'Extra Fine Merino Crew Neck', quantity: 1, unitPrice: 49.9, totalPrice: 49.9 },
        { name: 'AIRism Cotton T-Shirt', quantity: 2, unitPrice: 20.0, totalPrice: 40.0 },
      ],
      source: 'ai_receipt',
      syncStatus: 'synced',
      withReceipt: true,
    },
    {
      type: 'expense',
      amount: 76.2,
      taxAmount: 6.92,
      currency,
      category: 'Food & Drink',
      merchant: 'Trattoria Napoli',
      date: daysAgoISO(5),
      note: 'Weekend dinner with friends',
      lineItems: [
        { name: 'Pizza Margherita DOP', quantity: 2, unitPrice: 16.5, totalPrice: 33.0 },
        { name: 'Truffle Tagliatelle', quantity: 1, unitPrice: 22.0, totalPrice: 22.0 },
        { name: 'Tiramisu Della Casa', quantity: 2, unitPrice: 7.5, totalPrice: 15.0 },
        { name: 'Sparkling Water 750ml', quantity: 1, unitPrice: 6.2, totalPrice: 6.2 },
      ],
      source: 'ai_receipt',
      syncStatus: 'synced',
      withReceipt: true,
    },
    {
      type: 'expense',
      amount: 48.3,
      taxAmount: 4.39,
      currency,
      category: 'Groceries',
      merchant: 'Lidl Fresh Market',
      date: daysAgoISO(6),
      note: 'Pantry staples & household supplies',
      lineItems: [
        { name: 'Free Range Eggs (12pk)', quantity: 2, unitPrice: 3.95, totalPrice: 7.9 },
        { name: 'Italian Pasta & Passata', quantity: 4, unitPrice: 2.6, totalPrice: 10.4 },
        { name: 'Fresh Seasonal Vegetables', quantity: 1, unitPrice: 14.5, totalPrice: 14.5 },
        { name: 'Dishwasher Eco Tabs', quantity: 1, unitPrice: 8.5, totalPrice: 8.5 },
        { name: 'Roasted Almonds 250g', quantity: 1, unitPrice: 7.0, totalPrice: 7.0 },
      ],
      source: 'ai_receipt',
      syncStatus: 'synced',
      withReceipt: true,
    },
    {
      type: 'expense',
      amount: 680.0,
      currency,
      category: 'Housing',
      merchant: 'Greenwood Property Co.',
      date: daysAgoISO(8),
      note: 'Monthly shared apartment rent share',
      lineItems: [{ name: 'Monthly Apartment Rent (Share)', quantity: 1, unitPrice: 680.0, totalPrice: 680.0 }],
      source: 'manual',
      syncStatus: 'local_only',
    },
    {
      type: 'expense',
      amount: 74.5,
      taxAmount: 11.9,
      currency,
      category: 'Utilities',
      merchant: 'FiberNet & City Power',
      date: daysAgoISO(9),
      note: 'Gigabit fiber internet & green electricity',
      lineItems: [
        { name: 'Fiber 1Gbps Home Internet', quantity: 1, unitPrice: 39.9, totalPrice: 39.9 },
        { name: 'Green Electricity Monthly Bill', quantity: 1, unitPrice: 34.6, totalPrice: 34.6 },
      ],
      source: 'manual',
      syncStatus: 'local_only',
    },
    {
      type: 'expense',
      amount: 32.0,
      taxAmount: 2.9,
      currency,
      category: 'Entertainment',
      merchant: 'ODEON IMAX Cinema',
      date: daysAgoISO(11),
      note: 'Sci-fi premiere tickets & popcorn',
      lineItems: [
        { name: 'IMAX Evening Ticket', quantity: 2, unitPrice: 12.5, totalPrice: 25.0 },
        { name: 'Salted Popcorn Medium', quantity: 1, unitPrice: 7.0, totalPrice: 7.0 },
      ],
      source: 'ai_receipt',
      syncStatus: 'synced',
      withReceipt: true,
    },
    {
      type: 'expense',
      amount: 29.6,
      taxAmount: 2.69,
      currency,
      category: 'Health',
      merchant: 'Apotheke Central Pharmacy',
      date: daysAgoISO(13),
      note: 'Vitamins D3, magnesium & first-aid',
      lineItems: [
        { name: 'Vitamin D3 + K2 Drops', quantity: 1, unitPrice: 14.8, totalPrice: 14.8 },
        { name: 'Magnesium Citrate 60 caps', quantity: 1, unitPrice: 14.8, totalPrice: 14.8 },
      ],
      source: 'ai_receipt',
      syncStatus: 'synced',
      withReceipt: true,
    },
    {
      type: 'expense',
      amount: 54.1,
      taxAmount: 4.92,
      currency,
      category: 'Groceries',
      merchant: 'Whole Foods / BioMarkt',
      date: daysAgoISO(16),
      note: 'Fresh produce, cheese & bakery',
      lineItems: [
        { name: 'Artisanal Cheese Selection', quantity: 1, unitPrice: 14.5, totalPrice: 14.5 },
        { name: 'Organic Chicken Breast', quantity: 2, unitPrice: 9.8, totalPrice: 19.6 },
        { name: 'Mixed Organic Greens & Fruit', quantity: 1, unitPrice: 20.0, totalPrice: 20.0 },
      ],
      source: 'ai_receipt',
      syncStatus: 'synced',
      withReceipt: true,
    },
    {
      type: 'expense',
      amount: 115.0,
      taxAmount: 10.45,
      currency,
      category: 'Travel',
      merchant: 'Eurostar High-Speed Rail',
      date: daysAgoISO(22),
      note: 'Weekend city break return ticket',
      lineItems: [{ name: 'Standard Return Rail Fare', quantity: 1, unitPrice: 115.0, totalPrice: 115.0 }],
      source: 'ai_receipt',
      syncStatus: 'synced',
      withReceipt: true,
    },
    {
      type: 'expense',
      amount: 46.8,
      taxAmount: 4.25,
      currency,
      category: 'Food & Drink',
      merchant: 'Sakura Ramen & Izakaya',
      date: daysAgoISO(35),
      note: 'Tonkotsu ramen & gyoza last month',
      lineItems: [
        { name: 'Black Garlic Tonkotsu Ramen', quantity: 2, unitPrice: 17.5, totalPrice: 35.0 },
        { name: 'Crispy Pork Gyoza (6pc)', quantity: 2, unitPrice: 5.9, totalPrice: 11.8 },
      ],
      source: 'ai_receipt',
      syncStatus: 'synced',
      withReceipt: true,
    },
    {
      type: 'expense',
      amount: 72.4,
      taxAmount: 6.58,
      currency,
      category: 'Groceries',
      merchant: 'Lidl Fresh Market',
      date: daysAgoISO(38),
      note: 'Monthly bulk grocery restock',
      lineItems: [
        { name: 'Weekly Family Produce Box', quantity: 1, unitPrice: 32.4, totalPrice: 32.4 },
        { name: 'Household & Kitchen Bundle', quantity: 1, unitPrice: 40.0, totalPrice: 40.0 },
      ],
      source: 'ai_receipt',
      syncStatus: 'synced',
      withReceipt: true,
    },
  ];

  const transactionsToInsert: Transaction[] = rawDemo.map((item, idx) => {
    const { withReceipt, ...rest } = item;
    const receiptImageDataUrl = withReceipt
      ? generateSyntheticReceiptDataUrl({
          merchant: item.merchant,
          date: item.date,
          currencySymbol: sym,
          items: item.lineItems,
          taxAmount: item.taxAmount,
          totalAmount: item.amount,
        })
      : undefined;

    return {
      ...rest,
      id: crypto.randomUUID(),
      createdAt: now - idx * 3600_000 * 12,
      receiptImageDataUrl,
    };
  });

  const defaultBudgets: Budget[] = [
    { id: 'budget-all', category: 'ALL', monthlyLimit: 1600 },
    { id: 'budget-groceries', category: 'Groceries', monthlyLimit: 350 },
    { id: 'budget-food', category: 'Food & Drink', monthlyLimit: 200 },
    { id: 'budget-transport', category: 'Transport', monthlyLimit: 120 },
    { id: 'budget-shopping', category: 'Shopping', monthlyLimit: 180 },
  ];

  await db.transaction('rw', db.transactions, db.budgets, db.settings, async () => {
    await db.transactions.bulkPut(transactionsToInsert);
    await db.budgets.bulkPut(defaultBudgets);
  });

  await setSetting('monthlyBudget', 1600);
  await setSetting('defaultCurrency', currency);

  return transactionsToInsert.length;
}
