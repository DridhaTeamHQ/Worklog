import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { CalendarDays, X } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { formatDateShort } from '@/lib/format';
import { PickerField } from './Field';
import { Sheet, useSheet } from './Sheet';
import { PillButton } from './Buttons';

interface Props {
  label?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  /** 'YYYY-MM-DD' or null. */
  value: string | null;
  onChange: (value: string | null) => void;
  min?: string | null;
  placeholder?: string;
  clearable?: boolean;
}

const toIso = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const fromIso = (iso: string | null) => (iso ? new Date(`${iso}T12:00:00`) : new Date());

/**
 * A date picker that fits the form: a field that opens the platform's own calendar —
 * inline in a sheet on iOS, the system dialog on Android.
 */
export function DateField({ label, hint, error, required, value, onChange, min, placeholder = 'Pick a date', clearable = true }: Props) {
  const t = useTheme();
  const sheet = useSheet();
  const [draft, setDraft] = useState<Date>(fromIso(value));

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: fromIso(value),
        mode: 'date',
        minimumDate: min ? fromIso(min) : undefined,
        onChange: (event: DateTimePickerEvent, date?: Date) => {
          if (event.type === 'set' && date) onChange(toIso(date));
        },
      });
      return;
    }
    setDraft(fromIso(value));
    sheet.open();
  };

  return (
    <>
      <PickerField
        label={label}
        hint={hint}
        error={error}
        required={required}
        value={value ? formatDateShort(value) : null}
        placeholder={placeholder}
        icon={CalendarDays}
        onPress={open}
        right={clearable && value ? (
          <Pressable onPress={() => onChange(null)} hitSlop={8} accessibilityLabel="Clear date">
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: t.colors.neutralSoft, alignItems: 'center', justifyContent: 'center' }}>
              <X size={13} color={t.colors.inkMuted} strokeWidth={2.6} />
            </View>
          </Pressable>
        ) : undefined}
      />
      {Platform.OS === 'ios' ? (
        <Sheet ref={sheet.ref} title={label || 'Pick a date'}>
          <DateTimePicker
            value={draft}
            mode="date"
            display="inline"
            minimumDate={min ? fromIso(min) : undefined}
            accentColor={t.colors.hero}
            themeVariant={t.isDark ? 'dark' : 'light'}
            onChange={(_e, date) => { if (date) setDraft(date); }}
          />
          <PillButton label="Done" block onPress={() => { onChange(toIso(draft)); sheet.close(); }} style={{ marginTop: 8 }} />
        </Sheet>
      ) : null}
    </>
  );
}
