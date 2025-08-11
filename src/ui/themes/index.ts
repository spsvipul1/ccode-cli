import light from './light.js';
import lightAnsi from './light-ansi.js';
import darkAnsi from './dark-ansi.js';
import lightDaltonized from './light-daltonized.js';
import darkDaltonized from './dark-daltonized.js';
import terminal from './terminal.js';
import { Theme } from './types.js';

export { Theme } from './types.js';

export const themes: Record<string, Theme> = {
  light,
  'light-ansi': lightAnsi,
  'dark-ansi': darkAnsi,
  'light-daltonized': lightDaltonized,
  'dark-daltonized': darkDaltonized,
  terminal
};

export const resolveTheme = (name: string): Theme => themes[name] || light;

export const resolveColor = (color: string, theme: Theme): string => {
  if (color.startsWith('#')) return color;
  const parts = color.split('.') as string[];
  if (parts.length === 2) {
    const [parent, child] = parts;
    const group: any = (theme.colors as any)[parent];
    if (group && typeof group === 'object' && child in group) {
      return group[child];
    }
  }
  const key = color as keyof Theme['colors'];
  if (theme.colors[key]) return theme.colors[key] as string;
  return color;
};

export const getAgentColor = (agentId: string, theme: Theme): string => {
  const colors = theme.colors.agent.custom;
  const hash = agentId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};
