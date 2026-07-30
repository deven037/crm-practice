import { StyleSheet, Text, View } from 'react-native';
import { locatorProps, testIds } from '../testIds';

/**
 * Temporary stand-in for screens not yet built (remaining modules land in later phases —
 * see the mobile port's task list). Keeps the real navigation structure wired and testable
 * end-to-end before every screen exists, rather than routing to nothing.
 */
export function PlaceholderScreen({ name }: { name: string }) {
  return (
    <View style={styles.container} {...locatorProps(testIds.page(name.toLowerCase().replace(/\s+/g, '-')))}>
      <Text style={styles.text}>{name} — coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  text: { color: '#6b7280', fontSize: 16 },
});
