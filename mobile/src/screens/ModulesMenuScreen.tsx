import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ModuleKey, ModulesStackParamList } from '../navigation/types';
import { locatorProps, testIds } from '../testIds';

const MODULES: { key: ModuleKey; label: string }[] = [
  { key: 'leads', label: 'Leads' },
  { key: 'contacts', label: 'Contacts' },
  { key: 'accounts', label: 'Accounts' },
  { key: 'deals', label: 'Deals' },
  { key: 'products', label: 'Products' },
  { key: 'tickets', label: 'Tickets' },
  { key: 'campaigns', label: 'Campaigns' },
  { key: 'quotes', label: 'Quotes' },
];

type Props = NativeStackScreenProps<ModulesStackParamList, 'ModulesMenu'>;

export function ModulesMenuScreen({ navigation }: Props) {
  return (
    <View style={styles.container} {...locatorProps(testIds.page('modules'))}>
      <FlatList
        data={MODULES}
        keyExtractor={(m) => m.key}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => navigation.navigate(`${item.key}List` as never)}
          >
            <Text style={styles.rowText}>{item.label}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  row: { paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  rowText: { fontSize: 16 },
});
