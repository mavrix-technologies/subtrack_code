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
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';

// ── Currency catalogue ────────────────────────────────────────────────────────

export type CurrencyOption = {
  code: string;
  symbol: string;
  name: string;
  locale: string;
  flag: string;
};

export const CURRENCIES: CurrencyOption[] = [
  { code: 'USD', symbol: '$',  name: 'US Dollar',        locale: 'en-US', flag: '🇺🇸' },
  { code: 'EUR', symbol: '€',  name: 'Euro',             locale: 'de-DE', flag: '🇪🇺' },
  { code: 'GBP', symbol: '£',  name: 'British Pound',    locale: 'en-GB', flag: '🇬🇧' },
  { code: 'INR', symbol: '₹',  name: 'Indian Rupee',     locale: 'en-IN', flag: '🇮🇳' },
  { code: 'JPY', symbol: '¥',  name: 'Japanese Yen',     locale: 'ja-JP', flag: '🇯🇵' },
  { code: 'CNY', symbol: '¥',  name: 'Chinese Yuan',     locale: 'zh-CN', flag: '🇨🇳' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', locale: 'en-AU', flag: '🇦🇺' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar',  locale: 'en-CA', flag: '🇨🇦' },
  { code: 'CHF', symbol: 'Fr', name: 'Swiss Franc',      locale: 'de-CH', flag: '🇨🇭' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', locale: 'en-SG', flag: '🇸🇬' },
  { code: 'AED', symbol: 'د.إ',name: 'UAE Dirham',       locale: 'ar-AE', flag: '🇦🇪' },
  { code: 'SAR', symbol: '﷼',  name: 'Saudi Riyal',      locale: 'ar-SA', flag: '🇸🇦' },
  { code: 'KRW', symbol: '₩',  name: 'South Korean Won', locale: 'ko-KR', flag: '🇰🇷' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real',   locale: 'pt-BR', flag: '🇧🇷' },
  { code: 'MXN', symbol: 'MX$',name: 'Mexican Peso',     locale: 'es-MX', flag: '🇲🇽' },
  { code: 'RUB', symbol: '₽',  name: 'Russian Ruble',    locale: 'ru-RU', flag: '🇷🇺' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah', locale: 'id-ID', flag: '🇮🇩' },
  { code: 'TRY', symbol: '₺',  name: 'Turkish Lira',     locale: 'tr-TR', flag: '🇹🇷' },
  { code: 'ZAR', symbol: 'R',  name: 'South African Rand', locale: 'en-ZA', flag: '🇿🇦' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit', locale: 'ms-MY', flag: '🇲🇾' },
  { code: 'THB', symbol: '฿',  name: 'Thai Baht',        locale: 'th-TH', flag: '🇹🇭' },
  { code: 'PHP', symbol: '₱',  name: 'Philippine Peso',  locale: 'en-PH', flag: '🇵🇭' },
  { code: 'PKR', symbol: '₨',  name: 'Pakistani Rupee',  locale: 'en-PK', flag: '🇵🇰' },
  { code: 'BDT', symbol: '৳',  name: 'Bangladeshi Taka', locale: 'bn-BD', flag: '🇧🇩' },
  { code: 'NGN', symbol: '₦',  name: 'Nigerian Naira',   locale: 'en-NG', flag: '🇳🇬' },
];

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
        return new Intl.NumberFormat(currency.locale, {
          style: 'currency',
          currency: currency.code,
          maximumFractionDigits: 0,
        }).format(value);
      } catch {
        return `${currency.symbol}${Math.round(value).toLocaleString()}`;
      }
    },
    [currency]
  );

  const formatCompact = useCallback(
    (value: number) => {
      try {
        if (value < 100000) return formatAmount(value);
        return new Intl.NumberFormat(currency.locale, {
          style: 'currency',
          currency: currency.code,
          notation: 'compact',
          maximumFractionDigits: 1,
        }).format(value);
      } catch {
        return formatAmount(value);
      }
    },
    [currency, formatAmount]
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
  const ctx = useContext(CurrencyContext);
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

export const DEFAULT_BRAND: InvoiceBrand = {
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

  return (
    <InvoiceBrandContext.Provider value={{ brand, brandLoading, saveBrand, resetBrand }}>
      {children}
    </InvoiceBrandContext.Provider>
  );
}

export function useInvoiceBrand() {
  const ctx = useContext(InvoiceBrandContext);
  if (!ctx) throw new Error('useInvoiceBrand must be used within InvoiceBrandProvider');
  return ctx;
}
