import { Theme } from './types.js';

const terminal: Theme = {
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
};

export default terminal;
