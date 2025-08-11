import { Theme } from './types.js';

const darkAnsi: Theme = {
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
};

export default darkAnsi;
