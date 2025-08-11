import { Theme } from './types.js';

const lightAnsi: Theme = {
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
};

export default lightAnsi;
