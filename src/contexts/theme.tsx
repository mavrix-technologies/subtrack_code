import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useState, PropsWithChildren, useMemo, useEffect, useCallback } from 'react';
import { Appearance } from 'react-native';
import { lightPalette, darkPalette } from '@/constants/subtrack-theme';
import { useAppData } from '@/contexts/app-data';
import { listenToAppPreferences, saveAppPreferences } from '@/services/preferencesService';

type ThemeContextType = {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  palette: typeof lightPalette;
};

const ThemeContext = createContext<ThemeContextType | null>(null);
const themeStorageKey = (userId: string) => `@subtrack_theme:${userId}`;

export function ThemeProvider({ children }: PropsWithChildren) {
  const { user } = useAppData();
  const systemTheme = Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
  const [theme, setThemeState] = useState<'light' | 'dark'>(systemTheme);

  useEffect(() => {
    if (!user) {
      setThemeState(systemTheme);
      return;
    }

    let isMounted = true;

    AsyncStorage.getItem(themeStorageKey(user.uid)).then((stored) => {
      if (!isMounted) return;
      if (stored === 'light' || stored === 'dark') setThemeState(stored);
    });

    const unsubscribe = listenToAppPreferences(
      user.uid,
      (preferences) => {
        if (preferences?.theme === 'light' || preferences?.theme === 'dark') {
          setThemeState(preferences.theme);
          AsyncStorage.setItem(themeStorageKey(user.uid), preferences.theme);
        }
      },
      (error) => console.warn('Theme preference sync failed:', error)
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [systemTheme, user]);

  const setTheme = useCallback((nextTheme: 'light' | 'dark') => {
    setThemeState(nextTheme);
    if (user) {
      AsyncStorage.setItem(themeStorageKey(user.uid), nextTheme);
      saveAppPreferences(user.uid, { theme: nextTheme })
        .catch((error) => console.warn('Could not save theme preference:', error));
    }
  }, [user]);

  const value = useMemo(() => {
    return {
      theme,
      setTheme,
      palette: theme === 'dark' ? darkPalette : lightPalette,
    };
  }, [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return value;
}
