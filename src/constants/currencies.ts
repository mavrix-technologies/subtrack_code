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
