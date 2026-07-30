import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export function Spinner({ label }: { label?: string }) {
  return (
    <View style={styles.container} testID="spinner" accessibilityLabel="spinner">
      <ActivityIndicator size="large" />
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  label: { color: '#6b7280', fontSize: 14 },
});
