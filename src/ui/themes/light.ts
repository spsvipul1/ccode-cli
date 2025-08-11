import { Theme } from './types.js';

const light: Theme = {
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
};

export default light;
