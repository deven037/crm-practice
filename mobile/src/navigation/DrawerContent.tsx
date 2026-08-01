import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import { useAuth } from '../auth/AuthContext';
import { DrawerParamList } from './types';
import { locatorProps, testIds } from '../testIds';

/**
 * Mirrors the web app's grouped sidebar (src/components/Layout.tsx NAV_GROUPS) — same
 * section labels/order/icons, so the mental model carries over between platforms. Nav
 * items themselves are deliberately left without testIDs (locate by visible text), matching
 * the web sidebar's convention — only structural chrome (toggle, logout) gets one.
 */
const NAV_GROUPS: {
  label: string;
  items: { route: keyof DrawerParamList; label: string; icon: string; adminOnly?: boolean }[];
}[] = [
  { label: 'Main', items: [{ route: 'Dashboard', label: 'Dashboard', icon: '📊' }] },
  {
    label: 'Sales',
    items: [
      { route: 'LeadsStack', label: 'Leads', icon: '🎯' },
      { route: 'ContactsStack', label: 'Contacts', icon: '👤' },
      { route: 'AccountsStack', label: 'Accounts', icon: '🏢' },
      { route: 'ProductsStack', label: 'Products', icon: '📦' },
      { route: 'CampaignsStack', label: 'Campaigns', icon: '📣' },
      { route: 'QuotesStack', label: 'Quotes', icon: '🧾' },
      { route: 'DealsStack', label: 'Deals', icon: '💰' },
    ],
  },
  {
    label: 'Work',
    items: [
      { route: 'Tasks', label: 'Tasks', icon: '✅' },
      { route: 'TicketsStack', label: 'Tickets', icon: '🎫' },
    ],
  },
  {
    label: 'System',
    items: [
      { route: 'Admin', label: 'Admin', icon: '🛡️', adminOnly: true },
      { route: 'TestCatalog', label: 'Test Cases', icon: '🧪' },
      { route: 'Settings', label: 'Settings', icon: '⚙️' },
    ],
  },
];

export function DrawerContent({ navigation, state }: DrawerContentComponentProps) {
  const { user, logout } = useAuth();
  const activeRoute = state.routes[state.index]?.name;

  return (
    <View style={styles.container} {...locatorProps(testIds.raw('sidebar'))}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.brand}>
          <Text style={styles.brandText}>◆ Practice CRM</Text>
        </View>

        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((item) => !item.adminOnly || user?.role === 'admin');
          if (items.length === 0) return null;
          return (
            <View key={group.label} style={styles.group}>
              <Text style={styles.groupLabel}>{group.label}</Text>
              {items.map((item) => {
                const active = activeRoute === item.route;
                return (
                  <Pressable
                    key={item.route}
                    style={[styles.item, active && styles.itemActive]}
                    onPress={() => navigation.navigate(item.route)}
                  >
                    <Text style={styles.itemIcon}>{item.icon}</Text>
                    <Text style={[styles.itemLabel, active && styles.itemLabelActive]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.footerUser}>{user?.name} · {user?.role}</Text>
        <Pressable style={styles.logoutBtn} onPress={() => logout()} {...locatorProps(testIds.raw('logout-btn'))}>
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { paddingBottom: 24 },
  brand: { padding: 20, paddingTop: 32 },
  brandText: { fontSize: 18, fontWeight: '700' },
  group: { marginTop: 16 },
  groupLabel: { fontSize: 11, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', paddingHorizontal: 20, marginBottom: 4 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 10 },
  itemActive: { backgroundColor: '#eff6ff' },
  itemIcon: { fontSize: 16 },
  itemLabel: { fontSize: 15, color: '#111827' },
  itemLabelActive: { color: '#2563eb', fontWeight: '600' },
  footer: { borderTopWidth: 1, borderTopColor: '#e5e7eb', padding: 20, gap: 10 },
  footerUser: { fontSize: 12, color: '#6b7280' },
  logoutBtn: { alignSelf: 'flex-start' },
  logoutText: { color: '#dc2626', fontWeight: '600' },
});
