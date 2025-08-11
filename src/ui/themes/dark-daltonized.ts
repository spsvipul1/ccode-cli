import { Theme } from './types.js';

const darkDaltonized: Theme = {
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
};

export default darkDaltonized;
