import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ContactsStackParamList } from '../../navigation/types';
import { useContacts } from '../../api/hooks/useContacts';
import { Spinner } from '../../components/Spinner';
import { initials } from '../../utils';
import { locatorProps, testIds } from '../../testIds';

type Props = NativeStackScreenProps<ContactsStackParamList, 'contactsList'>;

export function ContactsListScreen({ navigation }: Props) {
  const [query, setQuery] = useState('');
  const { data, isLoading, isRefetching, refetch } = useContacts(query);
  const contacts = data?.data ?? [];

  return (
    <View style={styles.container} {...locatorProps(testIds.page('contacts'))}>
      {/* Deliberately no testID — locate by placeholder text */}
      <TextInput style={styles.search} placeholder="Search name, email, phone…" value={query} onChangeText={setQuery} />

      {isLoading ? (
        <Spinner label="Loading contacts…" />
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={(c) => c.id}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
          ListEmptyComponent={<Text style={styles.empty}>No contacts match "{query}".</Text>}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => navigation.navigate('contactsDetail', { id: item.id })}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials(item.name)}</Text>
              </View>
              <View style={styles.rowMain}>
                <Text style={styles.rowTitle}>{item.name}</Text>
                <Text style={styles.rowSub}>
                  {item.title || 'No title'} · {item.email}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  search: { margin: 16, marginBottom: 8, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  empty: { textAlign: 'center', color: '#6b7280', marginTop: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#2563eb', fontWeight: '700' },
  rowMain: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowSub: { color: '#6b7280', fontSize: 12, marginTop: 2 },
});
