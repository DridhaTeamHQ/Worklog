import { CalendarDays } from 'lucide-react-native';
import { TextField } from './Field';

interface Props {
  label?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  value: string | null;
  onChange: (value: string | null) => void;
  min?: string | null;
  placeholder?: string;
  clearable?: boolean;
}

/**
 * The web preview has no native calendar; a plain YYYY-MM-DD field keeps the forms
 * usable there. Phones get the real picker from DateField.tsx.
 */
export function DateField({ label, hint, error, required, value, onChange, placeholder = 'YYYY-MM-DD' }: Props) {
  return (
    <TextField
      label={label}
      hint={hint}
      error={error}
      required={required}
      icon={CalendarDays}
      value={value ?? ''}
      placeholder={placeholder}
      autoCapitalize="none"
      onChangeText={(text) => {
        const clean = text.trim();
        if (!clean) onChange(null);
        else if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) onChange(clean);
      }}
    />
  );
}
