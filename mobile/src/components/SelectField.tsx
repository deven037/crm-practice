import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

interface Option {
  value: string;
  label: string;
}

/**
 * Lightweight custom picker (no @react-native-picker/picker dependency) — a tap opens a
 * modal list, matching the web app's custom Select component in spirit. testId (if given)
 * is applied to the trigger button; the modal's option rows are deliberately left
 * unlabeled (locate by visible text), mirroring the web app's "custom dropdown options —
 * locate by role=option + text" convention (see LOCATORS.md).
 */
export function SelectField({
  value,
  options,
  onChange,
  testID,
}: {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  testID?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <>
      <Pressable style={styles.trigger} onPress={() => setOpen(true)} testID={testID} accessibilityLabel={testID}>
        <Text>{selected?.label ?? 'Select…'}</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <FlatList
              data={options}
              keyExtractor={(o) => o.value}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.option}
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                >
                  <Text style={item.value === value ? styles.optionSelected : undefined}>{item.label}</Text>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '60%', paddingVertical: 8 },
  option: { paddingVertical: 14, paddingHorizontal: 20 },
  optionSelected: { fontWeight: '700', color: '#2563eb' },
});
