import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, StyleSheet, useColorScheme } from 'react-native';
import {
  DEFAULT_APPEARANCE,
  isAppearanceMode,
  resolveScheme,
  tokensFor,
  type AppearanceMode,
  type ThemeTokens,
} from '@/core/theme/tokens';

const STORAGE_KEY = 'fairpath.appearance.v1';

type ThemeContextValue = {
  /** What the member chose (system | light | dark). */
  mode: AppearanceMode;
  setMode: (mode: AppearanceMode) => void;
  /** Tokens for the current scope (a forced-dark legacy scope overrides the member's choice). */
  tokens: ThemeTokens;
};

const ThemeContext = createContext<ThemeContextValue>({
  mode: DEFAULT_APPEARANCE,
  setMode: () => {},
  tokens: tokensFor('dark'),
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<AppearanceMode>(DEFAULT_APPEARANCE);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (active && isAppearanceMode(stored)) setModeState(stored);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Keep native UI (keyboard, system alerts, pickers) in step with the chosen appearance.
  useEffect(() => {
    try {
      Appearance.setColorScheme(mode === 'system' ? 'unspecified' : mode);
    } catch {
      // Not supported on every platform; the app still themes itself.
    }
  }, [mode]);

  const setMode = useCallback((next: AppearanceMode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, setMode, tokens: tokensFor(resolveScheme(mode, system)) }),
    [mode, setMode, system],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Forces a subtree to the dark palette (legacy screens that have not been migrated to tokens). */
export function ForcedDarkScope({ children }: { children: React.ReactNode }) {
  const parent = useContext(ThemeContext);
  const value = useMemo<ThemeContextValue>(() => ({ ...parent, tokens: tokensFor('dark') }), [parent]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useFairPathTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

/** Style factory bound to the current tokens: `const s = useThemedStyles(t => ({ box: { backgroundColor: t.surface } }))`. */
export function useThemedStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (tokens: ThemeTokens) => T,
): T {
  const { tokens } = useContext(ThemeContext);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => StyleSheet.create(factory(tokens)), [tokens]);
}
