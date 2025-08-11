import React, { createContext, useContext, useMemo } from 'react';
import { resolveTheme, Theme } from './themes/index.js';

const ThemeContext = createContext<Theme>(resolveTheme('light'));

export const ThemeProvider: React.FC<{ themeName?: string; children: React.ReactNode }>=({ themeName = 'light', children }) => {
  const theme = useMemo(() => resolveTheme(themeName), [themeName]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): Theme => useContext(ThemeContext);
