import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppData } from '@/contexts/app-data';
import {
  listenToAppPreferences,
  listenToInvoiceBrandPreference,
  saveAppPreferences,
  saveInvoiceBrandPreference,
} from '@/services/preferencesService';
import React, {
    createContext,
    PropsWithChildren,
    use,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from 'react';

// ── Currency catalogue ────────────────────────────────────────────────────────

import { CurrencyOption, CURRENCIES } from '@/constants/currencies';

const DEFAULT_CURRENCY = CURRENCIES.find(c => c.code === 'INR')!;
const currencyStorageKey = (userId: string) => `@subtrack_currency:${userId}`;

// ── Context ───────────────────────────────────────────────────────────────────

type CurrencyContextType = {
  currency: CurrencyOption;
  setCurrency: (c: CurrencyOption) => void;
  formatAmount: (value: number) => string;
  formatCompact: (value: number) => string;
  loaded: boolean;
};

const CurrencyContext = createContext<CurrencyContextType | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function CurrencyProvider({ children }: PropsWithChildren) {
  "use no memo";

  const { user } = useAppData();
  const [currency, setCurrencyState] = useState<CurrencyOption>(DEFAULT_CURRENCY);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) {
      setCurrencyState(DEFAULT_CURRENCY);
      setLoaded(true);
      return;
    }

    let isMounted = true;
    setLoaded(false);

    AsyncStorage.getItem(currencyStorageKey(user.uid)).then(raw => {
      if (!isMounted) return;
      if (raw) {
        const found = CURRENCIES.find(c => c.code === raw);
        if (found) setCurrencyState(found);
      } else {
        setCurrencyState(DEFAULT_CURRENCY);
      }
      setLoaded(true);
    });

    const unsubscribe = listenToAppPreferences(
      user.uid,
      (preferences) => {
        const found = CURRENCIES.find(c => c.code === preferences?.currencyCode);
        if (found) {
          setCurrencyState(found);
          AsyncStorage.setItem(currencyStorageKey(user.uid), found.code);
        }
      },
      (error) => console.warn('Currency preference sync failed:', error)
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [user]);

  const setCurrency = useCallback((c: CurrencyOption) => {
    setCurrencyState(c);
    if (user) {
      AsyncStorage.setItem(currencyStorageKey(user.uid), c.code);
      saveAppPreferences(user.uid, { currencyCode: c.code })
        .catch((error) => console.warn('Could not save currency preference:', error));
    }
  }, [user]);

  const formatAmount = useCallback(
    (value: number) => {
      try {
        return value.toLocaleString(currency.locale, {
          style: 'currency',
          currency: currency.code,
          maximumFractionDigits: 0,
        });
      } catch {
        return `${currency.symbol}${Math.round(value).toLocaleString()}`;
      }
    },
    [currency.code, currency.symbol, currency.locale]
  );

  const formatCompact = useCallback(
    (value: number) => {
      try {
        if (value < 100000) return formatAmount(value);
        return value.toLocaleString(currency.locale, {
          style: 'currency',
          currency: currency.code,
          notation: 'compact',
          maximumFractionDigits: 1,
        });
      } catch {
        return formatAmount(value);
      }
    },
    [currency.code, currency.locale, formatAmount]
  );

  const value = useMemo(
    () => ({ currency, setCurrency, formatAmount, formatCompact, loaded }),
    [currency, setCurrency, formatAmount, formatCompact, loaded]
  );

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useCurrency() {
  const ctx = use(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider');
  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────────
// Invoice Brand — stored alongside currency so no new file is needed
// ─────────────────────────────────────────────────────────────────────────────

export type InvoiceBrand = {
  businessName: string;
  tagline: string;
  logoUri: string;
  signatureUri: string;
  signatureLabel: string;
  filePrefix: string;
};

const brandStorageKey = (userId: string) => `@invoice_brand_v1:${userId}`;

const DEFAULT_BRAND: InvoiceBrand = {
  businessName: 'SubTrack',
  tagline: 'Invoice Management',
  logoUri: '',
  signatureUri: '',
  signatureLabel: 'Authorized Signature',
  filePrefix: 'invoice',
};

type InvoiceBrandContextType = {
  brand: InvoiceBrand;
  brandLoading: boolean;
  saveBrand: (updates: Partial<InvoiceBrand>) => Promise<void>;
  resetBrand: () => Promise<void>;
};

const InvoiceBrandContext = createContext<InvoiceBrandContextType | null>(null);

export function InvoiceBrandProvider({ children }: PropsWithChildren) {
  "use no memo";

  const { user } = useAppData();
  const [brand, setBrand] = useState<InvoiceBrand>(DEFAULT_BRAND);
  const [brandLoading, setBrandLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setBrand(DEFAULT_BRAND);
      setBrandLoading(false);
      return;
    }

    let isMounted = true;
    setBrandLoading(true);

    AsyncStorage.getItem(brandStorageKey(user.uid))
      .then(raw => {
        if (!isMounted) return;
        if (!raw) {
          setBrand(DEFAULT_BRAND);
          return;
        }
        try {
          setBrand({ ...DEFAULT_BRAND, ...JSON.parse(raw) });
        } catch {
          setBrand(DEFAULT_BRAND);
        }
      })
      .finally(() => {
        if (isMounted) setBrandLoading(false);
      });

    const unsubscribe = listenToInvoiceBrandPreference(
      user.uid,
      (nextBrand) => {
        if (!nextBrand) return;
        const merged = { ...DEFAULT_BRAND, ...nextBrand };
        setBrand(merged);
        AsyncStorage.setItem(brandStorageKey(user.uid), JSON.stringify(merged));
      },
      (error) => console.warn('Invoice brand sync failed:', error)
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [user]);

  const saveBrand = useCallback(async (updates: Partial<InvoiceBrand>) => {
    const next = { ...brand, ...updates };
    setBrand(next);
    if (user) {
      await AsyncStorage.setItem(brandStorageKey(user.uid), JSON.stringify(next));
      await saveInvoiceBrandPreference(user.uid, next);
    }
  }, [brand, user]);

  const resetBrand = useCallback(async () => {
    setBrand(DEFAULT_BRAND);
    if (user) {
      await AsyncStorage.removeItem(brandStorageKey(user.uid));
      await saveInvoiceBrandPreference(user.uid, DEFAULT_BRAND);
    }
  }, [user]);

  const brandValue = useMemo(() => ({ brand, brandLoading, saveBrand, resetBrand }), [brand, brandLoading, saveBrand, resetBrand]);

  return (
    <InvoiceBrandContext.Provider value={brandValue}>
      {children}
    </InvoiceBrandContext.Provider>
  );
}

export function useInvoiceBrand() {
  const ctx = use(InvoiceBrandContext);
  if (!ctx) throw new Error('useInvoiceBrand must be used within InvoiceBrandProvider');
  return ctx;
}
