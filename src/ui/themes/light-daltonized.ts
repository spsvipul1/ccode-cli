import { Theme } from './types.js';

const lightDaltonized: Theme = {
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
};

export default lightDaltonized;
