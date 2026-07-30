import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MoreStackParamList } from './types';
import { PlaceholderScreen } from '../screens/PlaceholderScreen';
import { useAuth } from '../auth/AuthContext';
import { locatorProps, testIds } from '../testIds';

const Stack = createNativeStackNavigator<MoreStackParamList>();

type MoreMenuProps = NativeStackScreenProps<MoreStackParamList, 'MoreMenu'>;

function MoreMenuScreen({ navigation }: MoreMenuProps) {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin';

  const items: { label: string; onPress: () => void }[] = [
    { label: 'Settings', onPress: () => navigation.navigate('Settings') },
    { label: 'Test Catalog', onPress: () => navigation.navigate('TestCatalog') },
    ...(isAdmin ? [{ label: 'Admin', onPress: () => navigation.navigate('Admin') }] : []),
    { label: 'Log out', onPress: () => logout() },
  ];

  return (
    <View style={styles.container} {...locatorProps(testIds.page('more'))}>
      <FlatList
        data={items}
        keyExtractor={(i) => i.label}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={item.onPress} {...(item.label === 'Log out' ? locatorProps(testIds.action('logout', 'menu')) : {})}>
            <Text style={styles.rowText}>{item.label}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

/**
 * Admin-only routes (Admin, ObjectConfig) are only reachable from MoreMenuScreen's
 * conditional item list above — they're still registered here so a stray deep link
 * doesn't crash, but nothing in the UI surfaces them to a non-admin user.
 */
export function MoreStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="MoreMenu" component={MoreMenuScreen} options={{ title: 'More' }} />
      <Stack.Screen name="Settings">{() => <PlaceholderScreen name="Settings" />}</Stack.Screen>
      <Stack.Screen name="HelpWebView">{() => <PlaceholderScreen name="Help" />}</Stack.Screen>
      <Stack.Screen name="Admin">{() => <PlaceholderScreen name="Admin" />}</Stack.Screen>
      <Stack.Screen name="ObjectConfig">{() => <PlaceholderScreen name="Object Config" />}</Stack.Screen>
      <Stack.Screen name="TestCatalog">{() => <PlaceholderScreen name="Test Catalog" />}</Stack.Screen>
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  row: { paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  rowText: { fontSize: 16 },
});
