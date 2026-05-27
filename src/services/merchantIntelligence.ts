import type { Invoice, InvoiceItem } from '@/store/useInvoiceStore';

export type SimilarMerchantResult = {
  merchantId: string;
  name: string;
  category: string;
  matchCount: number;
};

export type PriceChangeAlert = {
  productName: string;
  oldPrice: number;
  newPrice: number;
  diff: number;
};

export type SubscriptionRec = {
  isSubscription: boolean;
  name: string;
  interval: 'weekly' | 'monthly' | 'yearly';
  total: number;
};

// Known common subscriptions list for quick matching
const KNOWN_SUBSCRIPTIONS = [
  { keywords: ['netflix'], name: 'Netflix', category: 'entertainment', interval: 'monthly' },
  { keywords: ['spotify'], name: 'Spotify', category: 'entertainment', interval: 'monthly' },
  { keywords: ['youtube premium', 'youtube red'], name: 'YouTube Premium', category: 'entertainment', interval: 'monthly' },
  { keywords: ['jio', 'jiofiber', 'jiomedia'], name: 'JioFiber', category: 'utilities', interval: 'monthly' },
  { keywords: ['amazon prime', 'prime video', 'prime member'], name: 'Amazon Prime', category: 'shopping', interval: 'yearly' },
  { keywords: ['electricity', 'bescom', 'bses', 'mseb', 'power'], name: 'Electricity Bill', category: 'utilities', interval: 'monthly' },
  { keywords: ['icloud', 'apple.com/bill', 'itunes'], name: 'iCloud Storage', category: 'cloud', interval: 'monthly' },
  { keywords: ['google one', 'google storage', 'google storage cloud'], name: 'Google One', category: 'cloud', interval: 'monthly' },
  { keywords: ['chatgpt', 'openai'], name: 'ChatGPT Plus', category: 'software', interval: 'monthly' },
];

/**
 * Normalizes merchant names (lowercase, alphanumeric, no extra spaces)
 */
function normalizeMerchantName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Predicts category based on merchant name
 */
export function predictCategory(merchantName: string): string {
  const norm = normalizeMerchantName(merchantName);
  if (/grocery|dmart|supermarket|mart|reliance fresh|star bazaar|spencer/i.test(norm)) return 'groceries';
  if (/netflix|spotify|youtube|disney|hbo|prime|showtime|hotstar/i.test(norm)) return 'entertainment';
  if (/uber|ola|rapido|taxi|cab|rail|irctc|metro|fuel|petrol|shell/i.test(norm)) return 'transport';
  if (/electricity|water|bescom|airtel|jio|bsnl|broadband|internet|recharge/i.test(norm)) return 'utilities';
  if (/mcdonald|starbucks|restaurant|cafe|swiggy|zomato|pizza|burger/i.test(norm)) return 'food & dining';
  if (/amazon|flipkart|myntra|zara|h&m|decathlon|shopping/i.test(norm)) return 'shopping';
  if (/medical|pharmacy|hospital|doctor|apollo|medplus/i.test(norm)) return 'medical & healthcare';
  return 'others';
}

/**
 * Detects previous merchant invoices to offer history merging
 */
export function detectSimilarMerchant(
  scannedName: string,
  invoices: Invoice[]
): SimilarMerchantResult | null {
  const normScanned = normalizeMerchantName(scannedName);
  if (normScanned.length < 2) return null;

  const matches = invoices.filter(
    (inv) => normalizeMerchantName(inv.clientName) === normScanned
  );

  if (matches.length > 0) {
    // Return merchant profile from history
    return {
      merchantId: normScanned,
      name: matches[0].clientName,
      category: matches[0].category || predictCategory(matches[0].clientName),
      matchCount: matches.length,
    };
  }

  return null;
}

/**
 * Evaluates price differences for identical items scanned from a merchant
 */
export function trackPriceChanges(
  scannedItems: InvoiceItem[],
  merchantName: string,
  invoices: Invoice[]
): PriceChangeAlert[] {
  const alerts: PriceChangeAlert[] = [];
  const normMerchant = normalizeMerchantName(merchantName);

  // Filter previous invoices from this merchant (or anywhere as a fallback)
  const historicalInvoices = invoices
    .filter((inv) => normalizeMerchantName(inv.clientName) === normMerchant)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const historicalItemMap = new Map<string, InvoiceItem>();
  for (const inv of historicalInvoices) {
    for (const item of inv.items) {
      const norm = normalizeMerchantName(item.name);
      if (!historicalItemMap.has(norm)) historicalItemMap.set(norm, item);
    }
  }

  let allItemMap: Map<string, InvoiceItem> | null = null;

  for (const scannedItem of scannedItems) {
    const normScannedItem = normalizeMerchantName(scannedItem.name);
    if (normScannedItem.length < 2) continue;

    let foundPreviousItem = historicalItemMap.get(normScannedItem);

    // General fallback: check any previous invoice if not found under this merchant
    if (!foundPreviousItem) {
      if (!allItemMap) {
        allItemMap = new Map<string, InvoiceItem>();
        const sortedAllInvoices = invoices.slice().sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        for (const inv of sortedAllInvoices) {
          for (const item of inv.items) {
            const norm = normalizeMerchantName(item.name);
            if (!allItemMap.has(norm)) allItemMap.set(norm, item);
          }
        }
      }
      foundPreviousItem = allItemMap.get(normScannedItem);
    }

    if (foundPreviousItem && foundPreviousItem.price !== scannedItem.price) {
      alerts.push({
        productName: scannedItem.name,
        oldPrice: foundPreviousItem.price,
        newPrice: scannedItem.price,
        diff: scannedItem.price - foundPreviousItem.price,
      });
    }
  }

  return alerts;
}

/**
 * Checks if the invoice looks like a recurring subscription
 */
export function detectSubscription(
  merchantName: string,
  totalAmount: number,
  invoices: Invoice[]
): SubscriptionRec | null {
  const normMerchant = normalizeMerchantName(merchantName);

  // 1. Direct match on keyword database
  const directMatch = KNOWN_SUBSCRIPTIONS.find((sub) =>
    sub.keywords.some((kw) => normMerchant.includes(kw))
  );

  if (directMatch) {
    return {
      isSubscription: true,
      name: directMatch.name,
      interval: directMatch.interval as any,
      total: totalAmount,
    };
  }

  // 2. Scan historical occurrences of this merchant
  const matches = invoices
    .filter((inv) => normalizeMerchantName(inv.clientName) === normMerchant)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (matches.length >= 2) {
    const dates = matches.map((m) => new Date(m.date).getTime());
    const intervals: number[] = [];
    for (let i = 1; i < dates.length; i++) {
      intervals.push(dates[i] - dates[i - 1]);
    }

    // Average interval in days
    const avgMs = intervals.reduce((s, x) => s + x, 0) / intervals.length;
    const avgDays = avgMs / (1000 * 60 * 60 * 24);

    // Amounts check
    const averageAmount = matches.reduce((s, x) => s + x.total, 0) / matches.length;
    const varianceRatio = Math.abs(totalAmount - averageAmount) / averageAmount;

    // Check matching intervals
    if (varianceRatio < 0.15) {
      if (avgDays >= 25 && avgDays <= 35) {
        return {
          isSubscription: true,
          name: matches[0].clientName,
          interval: 'monthly',
          total: totalAmount,
        };
      } else if (avgDays >= 6 && avgDays <= 8) {
        return {
          isSubscription: true,
          name: matches[0].clientName,
          interval: 'weekly',
          total: totalAmount,
        };
      } else if (avgDays >= 350 && avgDays <= 380) {
        return {
          isSubscription: true,
          name: matches[0].clientName,
          interval: 'yearly',
          total: totalAmount,
        };
      }
    }
  }

  return null;
}
