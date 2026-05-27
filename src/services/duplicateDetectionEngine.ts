import * as Crypto from 'expo-crypto';
import type { Invoice } from '@/store/useInvoiceStore';

export type DuplicateCheckResult = {
  isDuplicate: boolean;
  duplicateScore: number;
  similarInvoiceId: string | null;
  warningMessage: string | null;
};

/**
 * Normalizes a string (lowercase, alphanumeric only)
 */
function normalize(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Compares two dates to see if they represent the same day
 */
function isSameDay(d1Str: string, d2Str: string): boolean {
  try {
    const date1 = new Date(d1Str);
    const date2 = new Date(d2Str);
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  } catch {
    return false;
  }
}

/**
 * Computes a hash of the base64 image data to identify exact duplicate uploads.
 */
export async function generateImageHash(base64Data: string): Promise<string> {
  if (!base64Data) return '';
  try {
    // Strip header if present
    const cleanBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      cleanBase64
    );
    return hash;
  } catch (error) {
    console.error('Failed to generate image hash:', error);
    return '';
  }
}

/**
 * Scans existing invoices to compute duplication probabilities
 */
export function checkDuplicateInvoice(
  scanned: Partial<Invoice>,
  existingInvoices: Invoice[],
  scannedHash?: string
): DuplicateCheckResult {
  let highestScore = 0;
  let matchesInvoiceId: string | null = null;
  let matchMessage: string | null = null;

  for (const existing of existingInvoices) {
    // 1. Check exact image fingerprint match
    if (scannedHash && existing.imageHash && scannedHash === existing.imageHash) {
      return {
        isDuplicate: true,
        duplicateScore: 1.0,
        similarInvoiceId: existing.id,
        warningMessage: 'This receipt image has already been uploaded.',
      };
    }

    let score = 0;
    const detailsMatched: string[] = [];

    // 2. Compare invoice numbers
    if (
      scanned.invoiceNumber &&
      existing.invoiceNumber &&
      normalize(scanned.invoiceNumber) === normalize(existing.invoiceNumber)
    ) {
      score += 0.4;
      detailsMatched.push('invoice number');
    }

    // 3. Compare totals
    if (scanned.total !== undefined && existing.total !== undefined) {
      const diff = Math.abs(scanned.total - existing.total);
      if (diff < 0.05) {
        score += 0.3;
        detailsMatched.push('amount');
      } else if (diff < 1.0) {
        score += 0.15;
        detailsMatched.push('similar amount');
      }
    }

    // 4. Compare dates
    if (scanned.date && existing.date && isSameDay(scanned.date, existing.date)) {
      score += 0.2;
      detailsMatched.push('date');
    }

    // 5. Compare merchant/client names
    if (scanned.clientName && existing.clientName) {
      const normScanned = normalize(scanned.clientName);
      const normExisting = normalize(existing.clientName);
      if (normScanned === normExisting && normScanned.length > 2) {
        score += 0.1;
        detailsMatched.push('merchant');
      }
    }

    if (score > highestScore) {
      highestScore = score;
      matchesInvoiceId = existing.id;
      if (score >= 0.7) {
        matchMessage = `Identical ${detailsMatched.join(' and ')} detected on an existing invoice.`;
      } else if (score >= 0.5) {
        matchMessage = `Matches existing invoice on ${detailsMatched.join(', ')}.`;
      }
    }
  }

  // Threshold for warning is 0.70
  return {
    isDuplicate: highestScore >= 0.7,
    duplicateScore: highestScore,
    similarInvoiceId: matchesInvoiceId,
    warningMessage: highestScore >= 0.7 ? matchMessage : null,
  };
}
