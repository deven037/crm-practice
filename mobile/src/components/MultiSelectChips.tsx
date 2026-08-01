import { Pressable, StyleSheet, Text, View } from 'react-native';

export function MultiSelectChips({
  values,
  options,
  onChange,
  testID,
}: {
  values: string[];
  options: { value: string; label: string }[];
  onChange: (values: string[]) => void;
  testID?: string;
}) {
  const toggle = (v: string) => {
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  };

  return (
    <View style={styles.wrap} testID={testID} accessibilityLabel={testID}>
      {options.map((opt) => {
        const selected = values.includes(opt.value);
        return (
          <Pressable key={opt.value} style={[styles.chip, selected && styles.chipSelected]} onPress={() => toggle(opt.value)}>
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipSelected: { backgroundColor: '#eff6ff', borderColor: '#2563eb' },
  chipText: { fontSize: 13, color: '#374151' },
  chipTextSelected: { color: '#2563eb', fontWeight: '600' },
});
