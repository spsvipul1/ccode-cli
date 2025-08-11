export interface Theme {
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
