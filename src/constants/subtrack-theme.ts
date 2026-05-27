import { MD3LightTheme } from 'react-native-paper';

export const lightPalette = {
  background: '#FFFFFF',
  surface: '#FFFFFF',
  text: '#1F2937',
  muted: '#9CA3AF',
  line: '#E5E7EB',         // slightly darker than before for visibility
  border: '#E5E7EB',       // explicit border token
  inputBg: '#FFFFFF',
  primary: '#F97316',
  primaryDark: '#EA580C',
  navBackground: '#111827',
  cardBlue: '#93B0FF',
  cardYellow: '#FFD166',
  cardTeal: '#06D6A0',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
};

export const darkPalette = {
  background: '#0F0F0F',
  surface: '#1C1C1E',
  text: '#F9FAFB',
  muted: '#6B7280',
  line: '#2C2C2E',
  border: '#3A3A3C',       // visible border in dark mode
  inputBg: '#2C2C2E',      // input fields slightly lighter than surface
  primary: '#F97316',
  primaryDark: '#EA580C',
  navBackground: '#000000',
  cardBlue: '#5C7CFA',
  cardYellow: '#FAB005',
  cardTeal: '#20C997',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
};

export const subtrackTheme = {
  ...MD3LightTheme,
  roundness: 16,
  colors: {
    ...MD3LightTheme.colors,
    primary: lightPalette.primary,
    secondary: lightPalette.navBackground,
    tertiary: lightPalette.success,
    background: lightPalette.background,
    surface: lightPalette.surface,
    surfaceVariant: '#FFFFFF',
    outline: lightPalette.line,
    error: lightPalette.danger,
  },
};
