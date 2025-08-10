// Theme System - 6 comprehensive themes as specified
export interface ThemeConfig {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    success: string;
    warning: string;
    error: string;
    info: string;
    text: string;
    textSecondary: string;
    background: string;
    border: string;
    highlight: string;
    agent: {
      general: string;
      user: string;
      system: string;
      custom: string[];
    };
  };
  accessibility: {
    colorBlind: boolean;
    highContrast: boolean;
  };
  terminal: {
    ansiOnly: boolean;
    trueColor: boolean;
  };
}

export const THEMES: Record<string, ThemeConfig> = {
  light: {
    name: 'Light',
    colors: {
      primary: '#0066cc',
      secondary: '#6c757d',
      success: '#28a745',
      warning: '#ffc107',
      error: '#dc3545',
      info: '#17a2b8',
      text: '#212529',
      textSecondary: '#6c757d',
      background: '#ffffff',
      border: '#dee2e6',
      highlight: '#fff3cd',
      agent: {
        general: '#0066cc',
        user: '#28a745',
        system: '#dc3545',
        custom: ['#6f42c1', '#fd7e14', '#20c997', '#e83e8c', '#6610f2']
      }
    },
    accessibility: { colorBlind: false, highContrast: false },
    terminal: { ansiOnly: false, trueColor: true }
  },

  'light-ansi': {
    name: 'Light ANSI',
    colors: {
      primary: 'blue',
      secondary: 'gray',
      success: 'green',
      warning: 'yellow',
      error: 'red',
      info: 'cyan',
      text: 'black',
      textSecondary: 'gray',
      background: 'white',
      border: 'gray',
      highlight: 'yellowBright',
      agent: {
        general: 'blue',
        user: 'green',
        system: 'red',
        custom: ['magenta', 'cyan', 'yellow', 'blueBright', 'greenBright']
      }
    },
    accessibility: { colorBlind: false, highContrast: false },
    terminal: { ansiOnly: true, trueColor: false }
  },

  'dark-ansi': {
    name: 'Dark ANSI',
    colors: {
      primary: 'blueBright',
      secondary: 'gray',
      success: 'greenBright',
      warning: 'yellowBright',
      error: 'redBright',
      info: 'cyanBright',
      text: 'white',
      textSecondary: 'gray',
      background: 'black',
      border: 'gray',
      highlight: 'yellow',
      agent: {
        general: 'blueBright',
        user: 'greenBright',
        system: 'redBright',
        custom: ['magentaBright', 'cyanBright', 'yellowBright', 'blue', 'green']
      }
    },
    accessibility: { colorBlind: false, highContrast: false },
    terminal: { ansiOnly: true, trueColor: false }
  },

  'light-daltonized': {
    name: 'Light Daltonized',
    colors: {
      primary: '#0173b2',
      secondary: '#949494',
      success: '#029e73',
      warning: '#fbafe4',
      error: '#de8f05',
      info: '#cc78bc',
      text: '#000000',
      textSecondary: '#949494',
      background: '#ffffff',
      border: '#d0d0d0',
      highlight: '#ffe6cc',
      agent: {
        general: '#0173b2',
        user: '#029e73',
        system: '#de8f05',
        custom: ['#cc78bc', '#ca9161', '#fbafe4', '#949494', '#56b4e9']
      }
    },
    accessibility: { colorBlind: true, highContrast: false },
    terminal: { ansiOnly: false, trueColor: true }
  },

  'dark-daltonized': {
    name: 'Dark Daltonized',
    colors: {
      primary: '#56b4e9',
      secondary: '#cccccc',
      success: '#009e73',
      warning: '#f0e442',
      error: '#e69f00',
      info: '#cc79a7',
      text: '#ffffff',
      textSecondary: '#cccccc',
      background: '#000000',
      border: '#404040',
      highlight: '#333300',
      agent: {
        general: '#56b4e9',
        user: '#009e73',
        system: '#e69f00',
        custom: ['#cc79a7', '#f0e442', '#d55e00', '#0072b2', '#cccccc']
      }
    },
    accessibility: { colorBlind: true, highContrast: true },
    terminal: { ansiOnly: false, trueColor: true }
  },

  terminal: {
    name: 'Terminal Native',
    colors: {
      primary: 'blue',
      secondary: 'white',
      success: 'green',
      warning: 'yellow',
      error: 'red',
      info: 'cyan',
      text: 'white',
      textSecondary: 'gray',
      background: 'black',
      border: 'white',
      highlight: 'black',
      agent: {
        general: 'blue',
        user: 'green',
        system: 'red',
        custom: ['magenta', 'cyan', 'yellow', 'white', 'gray']
      }
    },
    accessibility: { colorBlind: false, highContrast: true },
    terminal: { ansiOnly: true, trueColor: false }
  }
};

export function getTheme(themeName: string): ThemeConfig {
  return THEMES[themeName] || THEMES.light;
}

export function resolveColor(color: string, theme: ThemeConfig): string {
  // Dynamic color resolution function (dB equivalent)
  if (color.startsWith('#')) return color;
  if (color in theme.colors) return (theme.colors as any)[color];
  return color;
}

export function getAgentColor(agentId: string, theme: ThemeConfig): string {
  const colors = theme.colors.agent.custom;
  const hash = agentId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}
