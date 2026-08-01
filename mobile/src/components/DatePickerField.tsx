import { useState } from 'react';
import { Platform, Pressable, Text } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { formatDate } from '../utils';

/**
 * Native date picker — Android shows its own modal dialog on tap, iOS shows an inline
 * wheel that must be dismissed. A real automation surface: the picker is a native
 * system dialog, not something our own testID convention can reach into directly.
 */
export function DatePickerField({
  value,
  onChange,
  testID,
}: {
  value: string;
  onChange: (iso: string) => void;
  testID?: string;
}) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setShowPicker(true)}
        style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 }}
        testID={testID}
        accessibilityLabel={testID}
      >
        <Text>{formatDate(value)}</Text>
      </Pressable>
      {showPicker && (
        <DateTimePicker
          value={value ? new Date(value) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(event, date) => {
            setShowPicker(Platform.OS === 'ios');
            if (event.type === 'set' && date) onChange(date.toISOString());
          }}
        />
      )}
    </>
  );
}
