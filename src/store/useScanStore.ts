import { create } from 'zustand';
import { Invoice } from './useInvoiceStore';

type ScanStatus = 'idle' | 'capturing' | 'compressing' | 'ocr_processing' | 'comparing' | 'done' | 'error';

type DuplicateCheckResult = {
  isDuplicate: boolean;
  duplicateScore: number;
  similarInvoiceId: string | null;
  warningMessage: string | null;
};

type PriceChangeAlert = {
  productName: string;
  oldPrice: number;
  newPrice: number;
  diff: number;
};

type SubscriptionRec = {
  isSubscription: boolean;
  name: string;
  interval: 'weekly' | 'monthly' | 'yearly';
  total: number;
};

export type ScanState = {
  status: ScanStatus;
  imageUri: string | null;
  base64Image: string | null;
  pdfUri: string | null;
  extractedData: (Partial<Invoice> & { items: any[]; ocrFailed?: boolean; ocrErrorMessage?: string }) | null;
  duplicateCheck: DuplicateCheckResult | null;
  confidence: { [key: string]: 'low' | 'medium' | 'high' };
  priceChanges: PriceChangeAlert[];
  subscriptionRecommendation: SubscriptionRec | null;
  error: string | null;

  reset: () => void;
  setStatus: (status: ScanStatus) => void;
  setImage: (uri: string | null, base64: string | null) => void;
  setPdfUri: (uri: string | null) => void;
  setExtractedData: (data: (Partial<Invoice> & { items: any[]; ocrFailed?: boolean; ocrErrorMessage?: string }) | null) => void;
  setDuplicateCheck: (check: DuplicateCheckResult | null) => void;
  setConfidence: (confidence: { [key: string]: 'low' | 'medium' | 'high' }) => void;
  setPriceChanges: (changes: PriceChangeAlert[]) => void;
  setSubscriptionRecommendation: (rec: SubscriptionRec | null) => void;
  setError: (error: string | null) => void;
};

export const useScanStore = create<ScanState>((set) => ({
  status: 'idle',
  imageUri: null,
  base64Image: null,
  pdfUri: null,
  extractedData: null,
  duplicateCheck: null,
  confidence: {},
  priceChanges: [],
  subscriptionRecommendation: null,
  error: null,

  reset: () =>
    set({
      status: 'idle',
      imageUri: null,
      base64Image: null,
      pdfUri: null,
      extractedData: null,
      duplicateCheck: null,
      confidence: {},
      priceChanges: [],
      subscriptionRecommendation: null,
      error: null,
    }),
  setStatus: (status) => set({ status }),
  setImage: (imageUri, base64Image) => set({ imageUri, base64Image }),
  setPdfUri: (pdfUri) => set({ pdfUri }),
  setExtractedData: (extractedData) => set({ extractedData }),
  setDuplicateCheck: (duplicateCheck) => set({ duplicateCheck }),
  setConfidence: (confidence) => set({ confidence }),
  setPriceChanges: (priceChanges) => set({ priceChanges }),
  setSubscriptionRecommendation: (subscriptionRecommendation) => set({ subscriptionRecommendation }),
  setError: (error) => set({ error }),
}));
