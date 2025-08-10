declare module 'ink-text-input' {
  import type { ComponentType } from 'react';
  type Props = {
    value: string;
    onChange: (value: string) => void;
    onSubmit?: (value: string) => void;
    placeholder?: string;
  };
  const TextInput: ComponentType<Props>;
  export default TextInput;
}